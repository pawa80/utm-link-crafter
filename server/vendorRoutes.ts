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

// Analytics dashboard with UTM element usage
// Dashboard Overview Totals
router.get('/dashboard/overview', authenticateVendor, async (req: Request, res: Response) => {
  try {
    // Get total counts
    const [accountsResult] = await db.select({ count: count() }).from(accounts);
    const [usersResult] = await db.select({ count: count() }).from(users);
    
    // Count distinct campaigns by querying utm_campaign column directly
    const [campaignsResult] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${utmLinks.utm_campaign})` })
      .from(utmLinks)
      .where(eq(utmLinks.isArchived, false));
      
    const [utmLinksResult] = await db.select({ count: count() }).from(utmLinks).where(eq(utmLinks.isArchived, false));

    // Get account status breakdown
    const accountStatusBreakdown = await db
      .select({
        status: accounts.accountStatus,
        count: count()
      })
      .from(accounts)
      .groupBy(accounts.accountStatus);

    // Get plan breakdown (using subscription tier since there's no plan_name column)
    const planBreakdown = await db
      .select({
        planName: accounts.subscriptionTier,
        count: count()
      })
      .from(accounts)
      .groupBy(accounts.subscriptionTier);

    // Get recent accounts
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
      .limit(5);

    res.json({
      totals: {
        accounts: accountsResult.count,
        users: usersResult.count,
        campaigns: campaignsResult.count,
        utmLinks: utmLinksResult.count
      },
      accountStatusBreakdown,
      planBreakdown,
      recentAccounts: recentAccounts.map(account => ({
        ...account,
        createdAt: account.createdAt?.toISOString() || new Date().toISOString()
      }))
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview data' });
  }
});

router.get('/analytics/dashboard', authenticateVendor, async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to as string) : new Date();

    // Get UTM sources usage with proper base/custom classification from account templates
    const sourcesData = await db
      .select({
        name: utmLinks.utm_source,
        count: count(utmLinks.id),
        type: sql<'base' | 'custom'>`COALESCE(
          (SELECT LOWER(${sourceTemplates.type}) FROM ${sourceTemplates} 
           WHERE ${sourceTemplates.sourceName} = ${utmLinks.utm_source} 
           LIMIT 1), 
          'custom'
        )::text`,
        lastUsed: sql<string>`MAX(${utmLinks.createdAt})`,
        createdAt: sql<string>`MIN(${utmLinks.createdAt})`
      })
      .from(utmLinks)
      .where(and(
        sql`${utmLinks.createdAt} >= ${fromDate}`,
        sql`${utmLinks.createdAt} <= ${toDate}`,
        sql`${utmLinks.utm_source} IS NOT NULL`
      ))
      .groupBy(utmLinks.utm_source)
      .orderBy(desc(count(utmLinks.id)));

    // Get UTM mediums usage with proper base/custom classification from account templates
    const mediumsData = await db
      .select({
        name: utmLinks.utm_medium,
        count: count(utmLinks.id),
        type: sql<'base' | 'custom'>`COALESCE(
          (SELECT LOWER(${userUtmTemplates.type}) FROM ${userUtmTemplates} 
           WHERE ${userUtmTemplates.utmMedium} = ${utmLinks.utm_medium} 
           LIMIT 1), 
          'custom'
        )::text`,
        lastUsed: sql<string>`MAX(${utmLinks.createdAt})`,
        createdAt: sql<string>`MIN(${utmLinks.createdAt})`
      })
      .from(utmLinks)
      .where(and(
        sql`${utmLinks.createdAt} >= ${fromDate}`,
        sql`${utmLinks.createdAt} <= ${toDate}`,
        sql`${utmLinks.utm_medium} IS NOT NULL`
      ))
      .groupBy(utmLinks.utm_medium)
      .orderBy(desc(count(utmLinks.id)));

    // Get UTM content usage with proper base/custom classification from account templates
    const contentData = await db
      .select({
        name: utmLinks.utm_content,
        count: count(utmLinks.id),
        type: sql<'base' | 'custom'>`COALESCE(
          (SELECT LOWER(${userUtmTemplates.type}) FROM ${userUtmTemplates} 
           WHERE ${userUtmTemplates.utmContent} = ${utmLinks.utm_content} 
           LIMIT 1), 
          'custom'
        )::text`,
        lastUsed: sql<string>`MAX(${utmLinks.createdAt})`,
        createdAt: sql<string>`MIN(${utmLinks.createdAt})`
      })
      .from(utmLinks)
      .where(and(
        sql`${utmLinks.createdAt} >= ${fromDate}`,
        sql`${utmLinks.createdAt} <= ${toDate}`,
        sql`${utmLinks.utm_content} IS NOT NULL`,
        sql`${utmLinks.utm_content} != ''`
      ))
      .groupBy(utmLinks.utm_content)
      .orderBy(desc(count(utmLinks.id)));

    // Get ALL term templates from user_term_templates (including zero usage) across all accounts
    const allTermTemplates = await db
      .select({
        termValue: userTermTemplates.termValue,
        type: userTermTemplates.type,
        createdAt: userTermTemplates.createdAt
      })
      .from(userTermTemplates);

    // Get usage counts for each term
    const termUsageCounts = await db
      .select({
        term: utmLinks.utm_term,
        count: count(utmLinks.id),
        lastUsed: sql<string>`MAX(${utmLinks.createdAt})`
      })
      .from(utmLinks)
      .where(and(
        sql`${utmLinks.createdAt} >= ${fromDate}`,
        sql`${utmLinks.createdAt} <= ${toDate}`,
        sql`${utmLinks.utm_term} IS NOT NULL`
      ))
      .groupBy(utmLinks.utm_term);

    // Combine term templates with usage data
    const termsData = allTermTemplates.map(template => {
      const usage = termUsageCounts.find(u => u.term === template.termValue);
      return {
        name: template.termValue,
        count: usage?.count || 0,
        type: template.type?.toLowerCase() as 'base' | 'custom' || 'custom',
        lastUsed: usage?.lastUsed || null,
        createdAt: template.createdAt?.toISOString() || new Date().toISOString()
      };
    }).sort((a, b) => b.count - a.count);

    // Get usage timeline
    const timelineData = await db
      .select({
        date: sql<string>`DATE(${utmLinks.createdAt})`,
        count: count(utmLinks.id)
      })
      .from(utmLinks)
      .where(and(
        sql`${utmLinks.createdAt} >= ${fromDate}`,
        sql`${utmLinks.createdAt} <= ${toDate}`
      ))
      .groupBy(sql`DATE(${utmLinks.createdAt})`)
      .orderBy(sql`DATE(${utmLinks.createdAt})`);

    res.json({
      sources: sourcesData,
      mediums: mediumsData,
      content: contentData,
      terms: termsData,
      usage_timeline: timelineData
    });
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
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
    let conditions = [];
    if (status) {
      conditions.push(eq(accounts.accountStatus, status as string));
    }
    if (planId) {
      conditions.push(eq(accounts.pricingPlanId, Number(planId)));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
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

// Get UTM templates grouped by source - MUST come before :type route
router.get('/base-templates/utm-grouped', authenticateVendor, async (req: Request, res: Response) => {
  try {
    const templates = await db.select().from(baseUtmTemplates).orderBy(baseUtmTemplates.utmSource, baseUtmTemplates.utmMedium);
    
    // Group templates by source
    const sourceGroups: Record<string, { mediums: Record<string, { content: string[], templates: any[] }> }> = {};
    
    templates.forEach(template => {
      const source = template.utmSource;
      const medium = template.utmMedium;
      const content = template.utmContent;
      
      if (!sourceGroups[source]) {
        sourceGroups[source] = { mediums: {} };
      }
      
      if (!sourceGroups[source].mediums[medium]) {
        sourceGroups[source].mediums[medium] = { content: [], templates: [] };
      }
      
      sourceGroups[source].mediums[medium].content.push(content);
      sourceGroups[source].mediums[medium].templates.push({
        id: template.id,
        source: template.utmSource,
        medium: template.utmMedium,
        content: template.utmContent,
        isActive: template.isActive,
        vendorManaged: template.vendorManaged,
        createdAt: template.createdAt
      });
    });
    
    // Convert to array format
    const result = Object.entries(sourceGroups).map(([source, sourceData]) => ({
      source,
      mediums: Object.entries(sourceData.mediums).map(([medium, mediumData]) => ({
        medium,
        content: mediumData.content,
        templates: mediumData.templates
      }))
    }));
    
    res.json(result);
  } catch (error) {
    console.error('Grouped UTM templates fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch grouped UTM templates' });
  }
});

// Base template management
router.get('/base-templates/:type', authenticateVendor, async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    
    let templates;
    switch (type) {
      case 'utm':
        const utmTemplates = await db.select().from(baseUtmTemplates).orderBy(baseUtmTemplates.createdAt);
        // Map to expected format
        templates = utmTemplates.map(template => ({
          id: template.id,
          source: template.utmSource,
          medium: template.utmMedium,
          content: template.utmContent,
          isActive: template.isActive,
          vendorManaged: template.vendorManaged,
          createdAt: template.createdAt
        }));
        break;
      case 'term':
        const termTemplates = await db.select().from(baseTermTemplates).orderBy(baseTermTemplates.createdAt);
        // Map to expected format
        templates = termTemplates.map(template => ({
          id: template.id,
          term: template.termValue,
          category: template.category,
          isActive: true, // baseTermTemplates doesn't have isActive field
          vendorManaged: template.vendorManaged,
          createdAt: template.createdAt
        }));
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
    const { source, medium, content } = req.body;
    
    const [newTemplate] = await db
      .insert(baseUtmTemplates)
      .values({ 
        utmSource: source,
        utmMedium: medium,
        utmContent: content,
        vendorManaged: true 
      })
      .returning();
    
    res.json({
      id: newTemplate.id,
      source: newTemplate.utmSource,
      medium: newTemplate.utmMedium,
      content: newTemplate.utmContent,
      isActive: newTemplate.isActive,
      vendorManaged: newTemplate.vendorManaged,
      createdAt: newTemplate.createdAt
    });
  } catch (error) {
    console.error('Base UTM template creation error:', error);
    res.status(500).json({ error: 'Failed to create base UTM template' });
  }
});

router.post('/base-templates/term', authenticateVendor, async (req: Request, res: Response) => {
  try {
    const { term, category } = req.body;
    
    const [newTemplate] = await db
      .insert(baseTermTemplates)
      .values({ 
        termValue: term,
        category: category,
        vendorManaged: true 
      })
      .returning();
    
    res.json({
      id: newTemplate.id,
      term: newTemplate.termValue,
      category: newTemplate.category,
      isActive: true, // baseTermTemplates doesn't have isActive field
      vendorManaged: newTemplate.vendorManaged,
      createdAt: newTemplate.createdAt
    });
  } catch (error) {
    console.error('Base term template creation error:', error);
    res.status(500).json({ error: 'Failed to create base term template' });
  }
});



// Pricing Plans Management
router.get('/pricing-plans', authenticateVendor, async (req: Request, res: Response) => {
  try {
    const plans = await db
      .select({
        id: pricingPlans.id,
        planCode: pricingPlans.planCode,
        planName: pricingPlans.planName,
        description: pricingPlans.description,
        monthlyPriceCents: pricingPlans.monthlyPriceCents,
        annualPriceCents: pricingPlans.annualPriceCents,
        trialDays: pricingPlans.trialDays,
        maxCampaigns: pricingPlans.maxCampaigns,
        maxUsers: pricingPlans.maxUsers,
        maxUtmLinks: pricingPlans.maxUtmLinks,
        features: pricingPlans.features,
        isActive: pricingPlans.isActive,
        sortOrder: pricingPlans.sortOrder,
        createdAt: pricingPlans.createdAt,
        accountCount: count(accounts.id)
      })
      .from(pricingPlans)
      .leftJoin(accounts, eq(pricingPlans.id, accounts.pricingPlanId))
      .groupBy(
        pricingPlans.id,
        pricingPlans.planCode,
        pricingPlans.planName,
        pricingPlans.description,
        pricingPlans.monthlyPriceCents,
        pricingPlans.annualPriceCents,
        pricingPlans.trialDays,
        pricingPlans.maxCampaigns,
        pricingPlans.maxUsers,
        pricingPlans.maxUtmLinks,
        pricingPlans.features,
        pricingPlans.isActive,
        pricingPlans.sortOrder,
        pricingPlans.createdAt
      )
      .orderBy(pricingPlans.sortOrder, pricingPlans.createdAt);

    console.log('Raw plans from DB:', JSON.stringify(plans.slice(0, 2), null, 2));

    const response = plans.map(plan => ({
      id: plan.id,
      planCode: plan.planCode,
      planName: plan.planName,
      description: plan.description,
      monthlyPriceCents: plan.monthlyPriceCents,
      annualPriceCents: plan.annualPriceCents,
      trialDays: plan.trialDays,
      maxCampaigns: plan.maxCampaigns,
      maxUsers: plan.maxUsers,
      maxUtmLinks: plan.maxUtmLinks,
      features: plan.features,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
      accountCount: plan.accountCount,
      createdAt: plan.createdAt?.toISOString() || new Date().toISOString()
    }));

    console.log('Final response:', JSON.stringify(response.slice(0, 2), null, 2));
    
    res.json(response);
  } catch (error) {
    console.error('Pricing plans fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch pricing plans' });
  }
});

router.post('/pricing-plans', authenticateVendor, async (req: Request, res: Response) => {
  try {
    const {
      planCode,
      planName,
      description,
      monthlyPriceCents,
      annualPriceCents,
      trialDays,
      maxCampaigns,
      maxUsers,
      maxUtmLinks,
      features,
      isActive,
      sortOrder
    } = req.body;

    const [newPlan] = await db.insert(pricingPlans).values({
      planCode,
      planName,
      description,
      monthlyPriceCents,
      annualPriceCents,
      trialDays,
      maxCampaigns,
      maxUsers,
      maxUtmLinks,
      features: features || {},
      isActive,
      sortOrder
    }).returning();

    res.json(newPlan);
  } catch (error) {
    console.error('Pricing plan creation error:', error);
    res.status(500).json({ error: 'Failed to create pricing plan' });
  }
});

router.put('/pricing-plans/:id', authenticateVendor, async (req: Request, res: Response) => {
  try {
    const planId = Number(req.params.id);
    const {
      planCode,
      planName,
      description,
      monthlyPriceCents,
      annualPriceCents,
      trialDays,
      maxCampaigns,
      maxUsers,
      maxUtmLinks,
      features,
      isActive,
      sortOrder
    } = req.body;

    const [updatedPlan] = await db
      .update(pricingPlans)
      .set({
        planCode,
        planName,
        description,
        monthlyPriceCents,
        annualPriceCents,
        trialDays,
        maxCampaigns,
        maxUsers,
        maxUtmLinks,
        features: features || {},
        isActive,
        sortOrder
      })
      .where(eq(pricingPlans.id, planId))
      .returning();

    if (!updatedPlan) {
      return res.status(404).json({ error: 'Pricing plan not found' });
    }

    res.json(updatedPlan);
  } catch (error) {
    console.error('Pricing plan update error:', error);
    res.status(500).json({ error: 'Failed to update pricing plan' });
  }
});

router.delete('/pricing-plans/:id', authenticateVendor, async (req: Request, res: Response) => {
  try {
    const planId = Number(req.params.id);

    // Check if any accounts are using this plan
    const [accountsCount] = await db
      .select({ count: count() })
      .from(accounts)
      .where(eq(accounts.pricingPlanId, planId));

    if (accountsCount.count > 0) {
      return res.status(400).json({ 
        error: `Cannot delete pricing plan. ${accountsCount.count} accounts are currently using this plan.` 
      });
    }

    const [deletedPlan] = await db
      .delete(pricingPlans)
      .where(eq(pricingPlans.id, planId))
      .returning();

    if (!deletedPlan) {
      return res.status(404).json({ error: 'Pricing plan not found' });
    }

    res.json({ success: true, deletedPlan });
  } catch (error) {
    console.error('Pricing plan deletion error:', error);
    res.status(500).json({ error: 'Failed to delete pricing plan' });
  }
});

export default router;