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
router.get('/analytics/dashboard', authenticateVendor, async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to as string) : new Date();

    // Get UTM sources usage
    const sourcesData = await db
      .select({
        name: utmLinks.utm_source,
        count: count(utmLinks.id),
        type: sql<'base' | 'custom'>`CASE 
          WHEN EXISTS (SELECT 1 FROM source_templates WHERE source_templates.source_name = ${utmLinks.utm_source} AND source_templates.vendor_managed = true) 
          THEN 'base'::text 
          ELSE 'custom'::text 
        END`,
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

    // Get UTM mediums usage
    const mediumsData = await db
      .select({
        name: utmLinks.utm_medium,
        count: count(utmLinks.id),
        type: sql<'base' | 'custom'>`CASE 
          WHEN ${utmLinks.utm_medium} IN ('cpc', 'social', 'email', 'organic', 'referral', 'affiliate', 'display', 'video', 'print', 'sms', 'push') 
          THEN 'base'::text 
          ELSE 'custom'::text 
        END`,
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

    // Get UTM content usage
    const contentData = await db
      .select({
        name: utmLinks.utm_content,
        count: count(utmLinks.id),
        type: sql<'base' | 'custom'>`CASE 
          WHEN EXISTS (SELECT 1 FROM user_utm_templates WHERE user_utm_templates.utm_content = ${utmLinks.utm_content}) 
          THEN 'base'::text 
          ELSE 'custom'::text 
        END`,
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

    // Get UTM terms usage
    const termsData = await db
      .select({
        name: utmLinks.utm_term,
        count: count(utmLinks.id),
        type: sql<'base' | 'custom'>`CASE 
          WHEN EXISTS (SELECT 1 FROM user_term_templates WHERE user_term_templates.term_value = ${utmLinks.utm_term}) 
          THEN 'base'::text 
          ELSE 'custom'::text 
        END`,
        lastUsed: sql<string>`MAX(${utmLinks.createdAt})`,
        createdAt: sql<string>`MIN(${utmLinks.createdAt})`
      })
      .from(utmLinks)
      .where(and(
        sql`${utmLinks.createdAt} >= ${fromDate}`,
        sql`${utmLinks.createdAt} <= ${toDate}`,
        sql`${utmLinks.utm_term} IS NOT NULL`,
        sql`${utmLinks.utm_term} != ''`
      ))
      .groupBy(utmLinks.utm_term)
      .orderBy(desc(count(utmLinks.id)));

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



export default router;