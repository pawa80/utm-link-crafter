import { Request, Response, Router } from "express";
import { db } from "./db";
import { 
  vendorUsers, 
  vendorSessions, 
  accounts, 
  users, 
  pricingPlans, 
  accountStatusHistory,
  utmLinks,
  campaignLandingPages,
  sourceTemplates,
  userUtmTemplates,
  userTermTemplates,
  baseUtmTemplates,
  baseTermTemplates,
  tags
} from "@shared/schema";
import { eq, desc, count, sql, and, isNull, or } from "drizzle-orm";
import { authenticateVendor, loginVendorUser, logoutVendorUser, hashPassword } from "./vendorAuth";
import { insertVendorUserSchema, insertPricingPlanSchema, updateAccountSchema } from "@shared/schema";

const router = Router();

// Public vendor authentication routes (no auth required)
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await loginVendorUser(email, password, req);
    
    if (result.success) {
      res.json({
        token: result.token,
        vendorUser: result.vendorUser
      });
    } else {
      res.status(401).json({ error: result.error });
    }
  } catch (error) {
    console.error('Vendor login route error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/auth/logout', authenticateVendor, async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      await logoutVendorUser(token);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Verify vendor session
router.get('/auth/verify', authenticateVendor, (req: any, res: Response) => {
  res.json({ vendorUser: req.vendorUser });
});

// Protected vendor routes (require authentication)

// Dashboard analytics
router.get('/analytics/dashboard', authenticateVendor, async (req: Request, res: Response) => {
  try {
    // Get total counts across all accounts
    const [totalAccounts] = await db.select({ count: count() }).from(accounts);
    const [totalUsers] = await db.select({ count: count() }).from(users);
    const [totalCampaigns] = await db.select({ 
      count: count(sql`DISTINCT utm_campaign`) 
    }).from(utmLinks);
    const [totalUtmLinks] = await db.select({ count: count() }).from(utmLinks);

    // Get account status breakdown
    const accountStatusBreakdown = await db
      .select({
        status: accounts.accountStatus,
        count: count()
      })
      .from(accounts)
      .groupBy(accounts.accountStatus);

    // Get pricing plan breakdown
    const planBreakdown = await db
      .select({
        planName: pricingPlans.planName,
        count: count()
      })
      .from(accounts)
      .leftJoin(pricingPlans, eq(accounts.pricingPlanId, pricingPlans.id))
      .groupBy(pricingPlans.planName);

    // Get recent account activity
    const recentAccounts = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        accountStatus: accounts.accountStatus,
        createdAt: accounts.createdAt,
        userCount: count(users.id)
      })
      .from(accounts)
      .leftJoin(users, eq(accounts.id, users.accountId))
      .groupBy(accounts.id, accounts.name, accounts.accountStatus, accounts.createdAt)
      .orderBy(desc(accounts.createdAt))
      .limit(10);

    res.json({
      totals: {
        accounts: totalAccounts.count,
        users: totalUsers.count,
        campaigns: totalCampaigns.count,
        utmLinks: totalUtmLinks.count
      },
      accountStatusBreakdown,
      planBreakdown,
      recentAccounts
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Account management
router.get('/accounts', authenticateVendor, async (req: Request, res: Response) => {
  try {
    const { status, planId, limit = 50, offset = 0 } = req.query;

    let query = db
      .select({
        account: accounts,
        plan: pricingPlans,
        userCount: count(users.id),
        campaignCount: sql<number>`COUNT(DISTINCT ${utmLinks.utm_campaign})`,
        utmLinkCount: count(utmLinks.id)
      })
      .from(accounts)
      .leftJoin(pricingPlans, eq(accounts.pricingPlanId, pricingPlans.id))
      .leftJoin(users, eq(accounts.id, users.accountId))
      .leftJoin(utmLinks, eq(accounts.id, utmLinks.accountId))
      .groupBy(accounts.id, pricingPlans.id);

    // Apply filters
    if (status) {
      query = query.where(eq(accounts.accountStatus, status as string));
    }
    if (planId) {
      query = query.where(eq(accounts.pricingPlanId, Number(planId)));
    }

    const accountsData = await query
      .orderBy(desc(accounts.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    res.json(accountsData);
  } catch (error) {
    console.error('Accounts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Update account status
router.patch('/accounts/:id/status', authenticateVendor, async (req: any, res: Response) => {
  try {
    const accountId = Number(req.params.id);
    const { newStatus, reason } = req.body;
    const vendorUserId = req.vendorUser.id;

    // Get current account status
    const [currentAccount] = await db
      .select({ accountStatus: accounts.accountStatus })
      .from(accounts)
      .where(eq(accounts.id, accountId));

    if (!currentAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Update account status
    await db
      .update(accounts)
      .set({
        accountStatus: newStatus,
        statusReason: reason,
        statusChangedAt: new Date(),
        statusChangedBy: vendorUserId
      })
      .where(eq(accounts.id, accountId));

    // Record status change in history
    await db.insert(accountStatusHistory).values({
      accountId,
      oldStatus: currentAccount.accountStatus,
      newStatus,
      reason,
      changedBy: vendorUserId
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Account status update error:', error);
    res.status(500).json({ error: 'Failed to update account status' });
  }
});

// Update account pricing plan
router.patch('/accounts/:id/plan', authenticateVendor, async (req: Request, res: Response) => {
  try {
    const accountId = Number(req.params.id);
    const { pricingPlanId } = req.body;

    await db
      .update(accounts)
      .set({ pricingPlanId })
      .where(eq(accounts.id, accountId));

    res.json({ success: true });
  } catch (error) {
    console.error('Account plan update error:', error);
    res.status(500).json({ error: 'Failed to update account plan' });
  }
});

// Pricing plan management
router.get('/pricing-plans', authenticateVendor, async (req: Request, res: Response) => {
  try {
    const plans = await db
      .select()
      .from(pricingPlans)
      .orderBy(pricingPlans.sortOrder);
    
    res.json(plans);
  } catch (error) {
    console.error('Pricing plans fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch pricing plans' });
  }
});

router.post('/pricing-plans', authenticateVendor, async (req: Request, res: Response) => {
  try {
    const planData = insertPricingPlanSchema.parse(req.body);
    
    const [newPlan] = await db
      .insert(pricingPlans)
      .values(planData)
      .returning();
    
    res.json(newPlan);
  } catch (error) {
    console.error('Pricing plan creation error:', error);
    res.status(500).json({ error: 'Failed to create pricing plan' });
  }
});

// Custom element analytics (most used across accounts)
router.get('/analytics/custom-elements', authenticateVendor, async (req: Request, res: Response) => {
  try {
    // Most used custom UTM mediums
    const customMediums = await db
      .select({
        medium: utmLinks.utm_medium,
        count: count()
      })
      .from(utmLinks)
      .groupBy(utmLinks.utm_medium)
      .orderBy(desc(count()))
      .limit(50);

    // Most used custom UTM content
    const customContent = await db
      .select({
        content: utmLinks.utm_content,
        count: count()
      })
      .from(utmLinks)
      .where(and(isNull(utmLinks.utm_content), sql`${utmLinks.utm_content} != ''`))
      .groupBy(utmLinks.utm_content)
      .orderBy(desc(count()))
      .limit(50);

    // Most used custom UTM terms
    const customTerms = await db
      .select({
        term: utmLinks.utm_term,
        count: count()
      })
      .from(utmLinks)
      .where(and(isNull(utmLinks.utm_term), sql`${utmLinks.utm_term} != ''`))
      .groupBy(utmLinks.utm_term)
      .orderBy(desc(count()))
      .limit(50);

    // Most used custom sources
    const customSources = await db
      .select({
        source: utmLinks.utm_source,
        count: count()
      })
      .from(utmLinks)
      .groupBy(utmLinks.utm_source)
      .orderBy(desc(count()))
      .limit(50);

    res.json({
      customMediums,
      customContent,
      customTerms,
      customSources
    });
  } catch (error) {
    console.error('Custom elements analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch custom elements data' });
  }
});

// Base template management
router.get('/base-templates/:type', authenticateVendor, async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    
    let templates;
    switch (type) {
      case 'utm':
        templates = await db.select().from(baseUtmTemplates).orderBy(baseUtmTemplates.createdAt);
        break;
      case 'term':
        templates = await db.select().from(baseTermTemplates).orderBy(baseTermTemplates.createdAt);
        break;
      default:
        return res.status(400).json({ error: 'Invalid template type' });
    }
    
    res.json(templates);
  } catch (error) {
    console.error('Base templates fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch base templates' });
  }
});

router.post('/base-templates/utm', authenticateVendor, async (req: Request, res: Response) => {
  try {
    const templateData = req.body;
    
    const [newTemplate] = await db
      .insert(baseUtmTemplates)
      .values({ ...templateData, vendorManaged: true })
      .returning();
    
    res.json(newTemplate);
  } catch (error) {
    console.error('Base UTM template creation error:', error);
    res.status(500).json({ error: 'Failed to create base UTM template' });
  }
});

router.post('/base-templates/term', authenticateVendor, async (req: Request, res: Response) => {
  try {
    const templateData = req.body;
    
    const [newTemplate] = await db
      .insert(baseTermTemplates)
      .values({ ...templateData, vendorManaged: true })
      .returning();
    
    res.json(newTemplate);
  } catch (error) {
    console.error('Base term template creation error:', error);
    res.status(500).json({ error: 'Failed to create base term template' });
  }
});

export default router;