import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { insertUserSchema, insertUtmLinkSchema, insertSourceTemplateSchema, updateUserSchema, insertTagSchema, insertCampaignLandingPageSchema, insertAccountSchema, insertInvitationSchema, userRoleSchema, pricingPlans, accounts, users } from "../shared/schema.js";
import { requirePermission, requireAccountAccess, hasPermission, canManageUser, canChangeUserRole, canModifyCampaign, validateAccountAccess } from "./permissions.js";
import { validateUrl, stripUtmParameters, sanitizeUtmParameter, campaignValidationSchema, generateUTMLink, checkDuplicateCampaign, formatValidationError, termTemplateSchema } from "../shared/validation.js";
import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { z } from "zod";
import { seedUtmTemplates, getUniqueSourcesAndMediums } from "./seedUtmTemplates.js";
import vendorRoutes from "./vendorRoutes.js";
import pricingRoutes from "./routes/pricing.js";
import { setupVendorSystem, assignDefaultPricingPlans } from "./setupVendorSystem.js";

const authMiddleware = async (req: any, res: any, next: any) => {
  const firebaseUid = req.headers['x-firebase-uid'];
  const authHeader = req.headers['authorization'];

  if (!firebaseUid || !authHeader) {
    return res.status(401).json({ message: "Unauthorized - Missing authentication headers" });
  }

  // Basic validation that the auth header contains a Bearer token
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "Unauthorized - Invalid token format" });
  }

  // For production, you would verify the Firebase token here
  // For now, we're doing basic validation that both headers are present

  const user = await storage.getUserByFirebaseUid(firebaseUid as string);
  if (!user) {
    console.log(`User not found for Firebase UID: ${firebaseUid}`);
    return res.status(401).json({ message: "User not found" });
  }

  req.user = user;
  req.userId = user.id;
  req.accountId = user.accountId;
  next();
};

// Load user features middleware
const loadFeatures = async (req: any, res: any, next: any) => {
  try {
    if (!req.userId) {
      return next();
    }

    const user = await storage.getUserWithAccountAndPlan(req.userId);
    if (user?.account?.pricingPlan?.features) {
      req.userFeatures = user.account.pricingPlan.features;
      req.userAccount = {
        id: user.accountId,
        name: user.account.name,
        pricingPlanId: user.account.pricingPlanId
      };
    }

    next();
  } catch (error) {
    console.error('Feature middleware error:', error);
    next();
  }
};

// Feature check function
const requireFeature = (featureKey: string) => {
  return (req: any, res: any, next: any) => {
    const hasFeature = req.userFeatures?.[featureKey];

    if (!hasFeature) {
      return res.status(403).json({
        error: 'Feature not available',
        message: `This feature (${featureKey}) is not included in your current plan.`,
        featureKey,
        requiresUpgrade: true
      });
    }

    next();
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Seed UTM templates on startup
  await seedUtmTemplates();

  // Setup vendor system (admin user, pricing plans)
  await setupVendorSystem();
  await assignDefaultPricingPlans();

  // Public routes (no auth required)
  app.use("/api", pricingRoutes);

  // Create or get user
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByFirebaseUid(userData.firebaseUid);
      if (existingUser) {
        return res.json(existingUser);
      }

      // If no pricing plan specified, default to the free plan
      if (!userData.pricingPlanId) {
        const freePlan = await db.query.pricingPlans.findFirst({
          where: eq(pricingPlans.planCode, 'free')
        });
        if (freePlan) {
          userData.pricingPlanId = freePlan.id;
        }
      }

      // Create user with their own company account (Super Admin role automatically assigned)
      const { user, account } = await storage.createUserWithAccount({
        firebaseUid: userData.firebaseUid,
        email: userData.email || '',
        role: 'super_admin',
        categories: [],
        defaultSources: [],
        defaultMediums: [],
        defaultCampaignNames: [],
        isSetupComplete: false,
        showCampaignTerm: true,
        showInternalCampaignId: true,
        showCategory: true,
        showCustomFields: false,
        customField1Name: undefined,
        customField1InUrl: false,
        customField1Options: undefined,
        customField2Name: undefined,
        customField2InUrl: false,
        customField2Options: undefined,
        customField3Name: undefined,
        customField3InUrl: false,
        customField3Options: undefined,
        // Include profile data in user object for account creation
        industry: userData.industry,
        teamSize: userData.teamSize,
        useCases: userData.useCases || []
      }, userData.accountName || `${(userData.email || '').split('@')[0]}'s Company`, userData.pricingPlanId);

      // Create user template copies from base templates with account context
      await storage.createUserTemplatesFromBase(user.id, account.id);

      // Create user term template copies from base term templates
      await storage.createUserTermTemplatesFromBase(user.id, account.id);

      // Create default source templates for new users with account context
      const defaultSources = getUniqueSourcesAndMediums();
      for (const sourceData of defaultSources) {
        await storage.createSourceTemplate({
          ...sourceData,
          userId: user.id,
          accountId: account.id
        });
      }

      res.json(user);
    } catch (error: any) {
      // Don't return error for duplicate user creation attempts
      if (error.message && error.message.includes('duplicate key value violates unique constraint')) {
        // If it's a duplicate error, try to get the existing user
        try {
          const existingUser = await storage.getUserByFirebaseUid(userData.firebaseUid);
          if (existingUser) {
            return res.json(existingUser);
          }
        } catch (getError) {
          // If we can't get the existing user, return the original error
        }
      }
      res.status(400).json({ message: error.message });
    }
  });

  // Get user by Firebase UID (for auth flow - no auth middleware needed)
  app.get("/api/users/:uid", async (req, res) => {
    try {
      const { uid } = req.params;
      const user = await storage.getUserByFirebaseUid(uid);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get current user
  app.get("/api/user", authMiddleware, async (req: any, res) => {
    res.json(req.user);
  });

  // Get user features
  app.get("/api/user-features", authMiddleware, loadFeatures, async (req: any, res) => {
    try {
      res.json({
        features: req.userFeatures || {},
        account: req.userAccount || null
      });
    } catch (error) {
      console.error("Get user features error:", error);
      res.status(500).json({ error: "Failed to get user features" });
    }
  });

  // Get current user's account
  app.get("/api/user/account", authMiddleware, async (req: any, res) => {
    try {
      const account = await storage.getUserAccount(req.user.id);
      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }
      res.json({ ...req.user, account });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update user settings
  app.patch("/api/user", authMiddleware, async (req: any, res) => {
    try {
      const updates = updateUserSchema.parse(req.body);

      // Ensure user can only update their own data
      const updatedUser = await storage.updateUser(req.user.id, updates);

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found or access denied" });
      }

      res.json(updatedUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Create UTM link with validation
  app.post("/api/utm-links", authMiddleware, requirePermission('create_campaigns'), async (req: any, res) => {
    try {
      // Validate landing page URL first
      const { targetUrl, utm_source, utm_medium, utm_campaign, utm_content, utm_term } = req.body;

      // URL validation
      const urlValidation = validateUrl(targetUrl);
      if (!urlValidation.isValid) {
        return res.status(400).json({
          message: "Invalid landing page URL",
          details: urlValidation.error
        });
      }

      // UTM parameter validation and sanitization
      const sanitizedSource = sanitizeUtmParameter(utm_source);
      const sanitizedMedium = sanitizeUtmParameter(utm_medium);
      const sanitizedCampaign = sanitizeUtmParameter(utm_campaign);
      const sanitizedContent = utm_content ? sanitizeUtmParameter(utm_content) : undefined;
      const sanitizedTerm = utm_term ? sanitizeUtmParameter(utm_term) : undefined;

      // Parameter length validation
      if (!sanitizedSource || sanitizedSource.length === 0) {
        return res.status(400).json({ message: "Source is required and cannot be empty after sanitization" });
      }
      if (!sanitizedMedium || sanitizedMedium.length === 0) {
        return res.status(400).json({ message: "Medium is required and cannot be empty after sanitization" });
      }
      if (!sanitizedCampaign || sanitizedCampaign.length === 0) {
        return res.status(400).json({ message: "Campaign is required and cannot be empty after sanitization" });
      }
      if (sanitizedSource.length > 100) {
        return res.status(400).json({ message: "Source must be 100 characters or less" });
      }
      if (sanitizedMedium.length > 50) {
        return res.status(400).json({ message: "Medium must be 50 characters or less" });
      }
      if (sanitizedCampaign.length > 100) {
        return res.status(400).json({ message: "Campaign must be 100 characters or less" });
      }
      if (sanitizedContent && sanitizedContent.length > 100) {
        return res.status(400).json({ message: "Content must be 100 characters or less" });
      }
      if (sanitizedTerm && sanitizedTerm.length > 100) {
        return res.status(400).json({ message: "Term must be 100 characters or less" });
      }

      // Generate the final UTM link
      const finalUtmLink = generateUTMLink(
        urlValidation.cleanUrl!,
        sanitizedSource,
        sanitizedMedium,
        sanitizedCampaign,
        sanitizedContent,
        sanitizedTerm
      );

      // Create the UTM link data
      const utmLinkData = insertUtmLinkSchema.parse({
        ...req.body,
        userId: req.user.id,
        accountId: req.user.accountId,
        targetUrl: urlValidation.cleanUrl, // Store clean URL
        utm_source: sanitizedSource,
        utm_medium: sanitizedMedium,
        utm_campaign: sanitizedCampaign,
        utm_content: sanitizedContent || '',
        utm_term: sanitizedTerm || '',
        generatedUrl: finalUtmLink
      });

      const utmLink = await storage.createUtmLink(utmLinkData);
      res.json(utmLink);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        const fieldErrors = formatValidationError(error);
        return res.status(400).json({
          message: "Validation failed",
          errors: fieldErrors
        });
      }
      res.status(400).json({ message: error.message });
    }
  });

  // Get user's UTM links
  app.get("/api/utm-links", authMiddleware, requirePermission('read_campaigns'), async (req: any, res) => {
    try {
      // Validate and sanitize input parameters
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000); // Cap at 1000
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0); // Prevent negative offset
      const includeArchived = req.query.includeArchived === 'true';

      // Only access user's own data
      const links = await storage.getUserUtmLinks(req.user.id, limit, offset, includeArchived);
      res.json(links);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delete UTM links by campaign (for editing campaigns)
  app.delete("/api/utm-links/campaign/:campaignName", authMiddleware, requirePermission('edit_campaigns'), async (req: any, res) => {
    try {
      const campaignName = decodeURIComponent(req.params.campaignName);

      // Validate campaign name
      if (!campaignName || campaignName.length > 255) {
        return res.status(400).json({ message: "Invalid campaign name" });
      }

      // Only delete user's own campaign data
      const success = await storage.deleteUtmLinksByCampaign(req.user.id, campaignName);

      if (success) {
        res.json({ message: "Campaign links deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete campaign links" });
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Archive campaign
  app.post("/api/campaigns/:campaignName/archive", authMiddleware, requirePermission('delete_campaigns'), async (req: any, res) => {
    try {
      const campaignName = decodeURIComponent(req.params.campaignName);

      // Validate campaign name
      if (!campaignName || campaignName.length > 255) {
        return res.status(400).json({ message: "Invalid campaign name" });
      }

      // Only archive user's own campaign data
      const success = await storage.archiveCampaign(req.user.id, campaignName);

      if (success) {
        res.json({ message: "Campaign archived successfully" });
      } else {
        res.status(500).json({ message: "Failed to archive campaign" });
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Unarchive campaign
  app.post("/api/campaigns/:campaignName/unarchive", authMiddleware, requirePermission('delete_campaigns'), async (req: any, res) => {
    try {
      const campaignName = decodeURIComponent(req.params.campaignName);

      // Validate campaign name
      if (!campaignName || campaignName.length > 255) {
        return res.status(400).json({ message: "Invalid campaign name" });
      }

      // Only unarchive user's own campaign data
      const success = await storage.unarchiveCampaign(req.user.id, campaignName);

      if (success) {
        res.json({ message: "Campaign unarchived successfully" });
      } else {
        res.status(500).json({ message: "Failed to unarchive campaign" });
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Export user's UTM links as CSV
  app.get("/api/utm-links/export", authMiddleware, requirePermission('read_campaigns'), async (req: any, res) => {
    try {
      // Get all user's links for export
      const links = await storage.getUserUtmLinks(req.user.id, 1000, 0);
      const user = await storage.getUser(req.user.id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Build dynamic headers based on data availability
      const csvHeaders = ["Campaign Name", "Source", "Medium"];

      // Check if any link has content data
      const hasContent = links.some(link => link.utm_content);
      if (hasContent) csvHeaders.push("Content");

      // Check if any link has term data
      const hasTerm = links.some(link => link.utm_term);
      if (hasTerm) csvHeaders.push("Term");

      // Check if any link has category data
      const hasCategory = links.some(link => link.category);
      if (hasCategory) csvHeaders.push("Category");

      // Check if any link has internal campaign ID
      const hasInternalId = links.some(link => link.internalCampaignId);
      if (hasInternalId) csvHeaders.push("Internal Campaign ID");

      // Check custom fields dynamically
      const hasCustomField1 = links.some(link => link.customField1Value);
      if (hasCustomField1) {
        const fieldName = user.customField1Name || "Custom Field 1";
        csvHeaders.push(fieldName);
      }

      const hasCustomField2 = links.some(link => link.customField2Value);
      if (hasCustomField2) {
        const fieldName = user.customField2Name || "Custom Field 2";
        csvHeaders.push(fieldName);
      }

      const hasCustomField3 = links.some(link => link.customField3Value);
      if (hasCustomField3) {
        const fieldName = user.customField3Name || "Custom Field 3";
        csvHeaders.push(fieldName);
      }

      // Always include these standard fields
      csvHeaders.push("Target URL", "Full UTM Link", "Created Date");

      // Convert links to CSV rows with dynamic columns
      const csvRows = links.map(link => {
        const row = [
          `"${link.utm_campaign}"`,
          `"${link.utm_source}"`,
          `"${link.utm_medium}"`
        ];

        if (hasContent) row.push(`"${link.utm_content || ''}"`);
        if (hasTerm) row.push(`"${link.utm_term || ''}"`);
        if (hasCategory) row.push(`"${link.category || ''}"`);
        if (hasInternalId) row.push(`"${link.internalCampaignId || ''}"`);
        if (hasCustomField1) row.push(`"${link.customField1Value || ''}"`);
        if (hasCustomField2) row.push(`"${link.customField2Value || ''}"`);
        if (hasCustomField3) row.push(`"${link.customField3Value || ''}"`);

        // Standard fields
        row.push(
          `"${link.targetUrl}"`,
          `"${link.fullUtmLink}"`,
          `"${link.createdAt ? new Date(link.createdAt).toLocaleDateString() : ''}"`
        );

        return row;
      });

      // Combine headers and rows
      const csvContent = [csvHeaders.join(","), ...csvRows.map(row => row.join(","))].join("\n");

      // Set response headers for CSV download
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="utm-links-${new Date().toISOString().split('T')[0]}.csv"`);

      res.send(csvContent);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Source Templates API routes
  app.get("/api/source-templates", authMiddleware, async (req: any, res) => {
    try {
      const templates = await storage.getUserSourceTemplates(req.user.id);
      res.json(templates);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/source-templates", authMiddleware, requirePermission('manage_templates'), async (req: any, res) => {
    try {
      const validatedData = insertSourceTemplateSchema.parse({
        ...req.body,
        userId: req.user.id,
      });

      const template = await storage.createSourceTemplate(validatedData);
      res.json(template);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/source-templates/:id", authMiddleware, requirePermission('manage_templates'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      const template = await storage.updateSourceTemplate(id, req.user.id, updates);
      if (!template) {
        return res.status(404).json({ message: "Source template not found or access denied" });
      }

      res.json(template);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/source-templates/:id", authMiddleware, requirePermission('manage_templates'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteSourceTemplate(id, req.user.id);

      if (!success) {
        return res.status(404).json({ message: "Source template not found or access denied" });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Tags API routes
  app.get("/api/tags", authMiddleware, async (req: any, res) => {
    try {
      const tags = await storage.getUserTags(req.user.id);
      res.json(tags);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/tags", authMiddleware, requirePermission('manage_tags'), async (req: any, res) => {
    try {
      // Handle the case where req.body is incorrectly structured
      let requestBody = req.body;
      if (req.body && typeof req.body.body === 'string') {
        try {
          requestBody = JSON.parse(req.body.body);
        } catch (e) {
          console.error("Failed to parse nested body:", e);
        }
      }

      console.log("Processed request body:", requestBody);
      console.log("User object:", { id: req.user.id, accountId: req.user.accountId });
      console.log("Request accountId:", req.accountId);

      const tagData = insertTagSchema.parse(requestBody);

      // Check if tag already exists
      const existingTag = await storage.getTagByName(req.user.id, tagData.name);
      if (existingTag) {
        return res.json(existingTag);
      }

      // Ensure we have accountId - fallback to getting it from user
      const accountId = req.accountId || req.user.accountId;
      if (!accountId) {
        console.error("No accountId found for user:", req.user.id);
        return res.status(400).json({ message: "Account information missing" });
      }

      console.log("Creating tag with accountId:", accountId);
      const tag = await storage.createTag({
        ...tagData,
        userId: req.user.id,
        accountId: accountId,
      });

      res.json(tag);
    } catch (error: any) {
      console.error("Tag creation error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/tags/:id", authMiddleware, requirePermission('manage_tags'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "Tag name is required" });
      }

      // Check if another tag with this name already exists
      const existingTag = await storage.getTagByName(req.user.id, name.trim());
      if (existingTag && existingTag.id !== id) {
        return res.status(400).json({ message: "A tag with this name already exists" });
      }

      const updatedTag = await storage.updateTag(id, req.user.id, name.trim());

      if (!updatedTag) {
        return res.status(404).json({ message: "Tag not found or access denied" });
      }

      res.json(updatedTag);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/tags/:id", authMiddleware, requirePermission('manage_tags'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteTag(id, req.user.id);

      if (!success) {
        return res.status(404).json({ message: "Tag not found or access denied" });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Campaign Landing Pages API routes
  app.get("/api/campaign-landing-pages/:campaignName", authMiddleware, async (req: any, res) => {
    try {
      const campaignName = decodeURIComponent(req.params.campaignName);

      // Validate campaign name
      if (!campaignName || campaignName.length > 255) {
        return res.status(400).json({ message: "Invalid campaign name" });
      }

      // Only access user's own campaign landing pages
      const landingPages = await storage.getCampaignLandingPages(req.user.id, campaignName);
      res.json(landingPages);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/campaign-landing-pages", authMiddleware, async (req: any, res) => {
    try {
      const campaignName = req.query.campaignName as string;

      // If no campaign name provided, return all campaign landing pages for the user
      if (!campaignName) {
        const allLandingPages = await storage.getAllCampaignLandingPages(req.user.id);
        return res.json(allLandingPages);
      }

      // Validate campaign name
      if (campaignName.length > 255) {
        return res.status(400).json({ message: "Invalid campaign name" });
      }

      // Only access user's own campaign landing pages
      const landingPages = await storage.getCampaignLandingPages(req.user.id, campaignName);
      res.json(landingPages);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get all unique URLs used by the user for autocomplete
  app.get("/api/unique-urls", authMiddleware, async (req: any, res) => {
    try {
      // Only access user's own data
      const uniqueUrls = await storage.getAllUniqueUrls(req.user.id);
      res.json(uniqueUrls);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/campaign-landing-pages", authMiddleware, requirePermission('create_campaigns'), async (req: any, res) => {
    try {
      const { url, campaignName, isExistingCampaign } = req.body;

      // URL validation
      const urlValidation = validateUrl(url);
      if (!urlValidation.isValid) {
        return res.status(400).json({
          message: "Invalid landing page URL",
          details: urlValidation.error
        });
      }

      // Campaign name validation and sanitization
      if (!campaignName || campaignName.trim().length === 0) {
        return res.status(400).json({ message: "Campaign name is required" });
      }

      const sanitizedCampaignName = sanitizeUtmParameter(campaignName);
      if (!sanitizedCampaignName || sanitizedCampaignName.length === 0) {
        return res.status(400).json({ message: "Campaign name cannot be empty after sanitization" });
      }
      if (sanitizedCampaignName.length > 100) {
        return res.status(400).json({ message: "Campaign name must be 100 characters or less" });
      }

      // Only check for duplicate campaign names when creating NEW campaigns
      if (!isExistingCampaign) {
        const existingLinks = await storage.getUserUtmLinks(req.user.id, 1000, 0);
        const existingCampaigns = [...new Set(existingLinks.map(link => link.utm_campaign))];
        const duplicateCheck = checkDuplicateCampaign(sanitizedCampaignName, existingCampaigns);

        if (duplicateCheck.isDuplicate) {
          return res.status(400).json({ message: duplicateCheck.error });
        }
      }

      const landingPageData = insertCampaignLandingPageSchema.parse({
        ...req.body,
        userId: req.user.id,
        accountId: req.user.accountId,
        url: urlValidation.cleanUrl, // Store clean URL
        campaignName: sanitizedCampaignName
      });

      const landingPage = await storage.createCampaignLandingPage(landingPageData);
      res.json(landingPage);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        const fieldErrors = formatValidationError(error);
        return res.status(400).json({
          message: "Validation failed",
          errors: fieldErrors
        });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/campaign-landing-pages/:campaignName", authMiddleware, async (req: any, res) => {
    try {
      const campaignName = decodeURIComponent(req.params.campaignName);

      // Validate campaign name
      if (!campaignName || campaignName.length > 255) {
        return res.status(400).json({ message: "Invalid campaign name" });
      }

      // Only delete user's own campaign landing pages
      const success = await storage.deleteCampaignLandingPages(req.user.id, campaignName);
      res.json({ success });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get all unique URLs used by the user for autocomplete
  app.get("/api/unique-urls", authMiddleware, async (req: any, res) => {
    try {
      // Only access user's own data
      const uniqueUrls = await storage.getAllUniqueUrls(req.user.id);
      res.json(uniqueUrls);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // UTM Templates API routes
  app.get("/api/utm-templates", async (req, res) => {
    try {
      const templates = await storage.getUtmTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/utm-content/:source/:medium", authMiddleware, async (req: any, res) => {
    try {
      const { source, medium } = req.params;

      // Validate parameters
      if (!source || !medium) {
        return res.status(400).json({ message: "Source and medium are required" });
      }

      // Get user's template content for this source-medium combination
      // Base templates are already copied to the user's account during registration
      const userTemplates = await storage.getUserUtmContentByCombination(req.user.id, source, medium);
      const contentOptions = userTemplates.map(t => t.utmContent);

      res.json(contentOptions);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // User UTM Template routes
  app.post("/api/user-utm-templates", authMiddleware, async (req: any, res) => {
    try {
      const { utmSource, utmMedium, utmContent, description } = req.body;

      if (!utmSource || !utmMedium || !utmContent) {
        return res.status(400).json({ message: "Source, medium, and content are required" });
      }

      const userTemplate = await storage.createUserUtmTemplate({
        userId: req.user.id,
        utmSource,
        utmMedium,
        utmContent,
        description,
        isArchived: false,
        isCustom: true // true because user-created
      });

      res.json(userTemplate);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/user-utm-templates", authMiddleware, async (req: any, res) => {
    try {
      const userTemplates = await storage.getUserUtmTemplates(req.user.id);
      res.json(userTemplates);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/user-utm-templates/:id/archive", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.archiveUserUtmTemplate(id, req.user.id);
      res.json({ success });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/user-utm-templates/:id/unarchive", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.unarchiveUserUtmTemplate(id, req.user.id);
      res.json({ success });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/user-utm-templates/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteUserUtmTemplate(id, req.user.id);
      res.json({ success });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Term Templates API routes
  app.get("/api/term-templates", authMiddleware, async (req: any, res) => {
    try {
      const category = req.query.category as string;
      const userTermTemplates = await storage.getUserTermTemplatesByCategory(req.user.id, category);
      res.json(userTermTemplates);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/term-templates", authMiddleware, requirePermission('manage_templates'), async (req: any, res) => {
    try {
      const validatedData = termTemplateSchema.parse(req.body);

      const userTermTemplate = await storage.createUserTermTemplate({
        ...validatedData,
        userId: req.user.id,
        accountId: req.user.accountId,
        isCustom: true // true because user-created
      });

      res.json(userTermTemplate);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/base-term-templates", authMiddleware, async (req: any, res) => {
    try {
      const category = req.query.category as string;
      const baseTermTemplates = await storage.getBaseTermTemplatesByCategory(category);
      res.json(baseTermTemplates);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/term-templates/:id/archive", authMiddleware, requirePermission('manage_templates'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.archiveUserTermTemplate(id, req.user.id);
      res.json({ success });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/term-templates/:id/unarchive", authMiddleware, requirePermission('manage_templates'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.unarchiveUserTermTemplate(id, req.user.id);
      res.json({ success });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/term-templates/:id", authMiddleware, requirePermission('manage_templates'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteUserTermTemplate(id, req.user.id);
      res.json({ success });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Account Management Endpoints

  // Create new account (admin only)
  app.post("/api/accounts", authMiddleware, async (req: any, res) => {
    try {
      const accountData = insertAccountSchema.parse(req.body);

      // Check if user is super_admin
      const user = await storage.getUser(req.user.id);
      if (!user || user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only super admins can create accounts" });
      }

      const account = await storage.createAccount(accountData);
      res.json(account);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get account details
  app.get("/api/accounts/:id", authMiddleware, async (req: any, res) => {
    try {
      const accountId = parseInt(req.params.id);

      // Check if user has access to this account
      const user = await storage.getUser(req.user.id);
      if (!user || user.accountId !== accountId) {
        return res.status(403).json({ message: "Access denied to this account" });
      }

      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }

      res.json(account);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get user's account (single account model)
  app.get("/api/user/account", authMiddleware, async (req: any, res) => {
    try {
      const userWithAccount = await storage.getUserWithAccount(req.user.id);

      if (!userWithAccount) {
        return res.status(404).json({ message: "User account not found" });
      }

      // Return single account object (not array)
      res.json({
        id: userWithAccount.id,
        userId: userWithAccount.id,
        accountId: userWithAccount.accountId,
        role: userWithAccount.role,
        invitedBy: userWithAccount.invitedBy,
        joinedAt: userWithAccount.joinedAt,
        account: userWithAccount.account
      });
    } catch (error: any) {
      console.error("Error getting user account:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Update account settings (admin/super_admin only)
  app.put("/api/accounts/:id", authMiddleware, async (req: any, res) => {
    try {
      const accountId = parseInt(req.params.id);
      const updates = req.body;

      // Check if user is admin or super_admin for this account
      const user = await storage.getUser(req.user.id);
      if (!user || user.accountId !== accountId || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Only admins can update account settings" });
      }

      const updatedAccount = await storage.updateAccount(accountId, updates);
      res.json(updatedAccount);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get account users (admin/super_admin only)
  app.get("/api/accounts/:id/users", authMiddleware, async (req: any, res) => {
    try {
      const accountId = parseInt(req.params.id);

      // Check if user is admin or super_admin for this account
      const user = req.user; // Use the user from middleware directly
      if (!user || user.accountId !== accountId || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({
          message: "Only admins can view account users",
          debug: {
            userAccountId: user?.accountId,
            requestedAccountId: accountId,
            userRole: user?.role,
            hasPermission: user ? ['admin', 'super_admin'].includes(user.role) : false
          }
        });
      }

      const accountUsers = await storage.getAccountUsers(accountId);
      res.json(accountUsers);
    } catch (error: any) {
      console.error("Error in /api/accounts/:id/users:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Invite user to account (admin/super_admin only)
  app.post("/api/accounts/:id/invite", authMiddleware, async (req: any, res) => {
    try {
      const accountId = parseInt(req.params.id);
      const { email, role } = req.body;

      // Check if user is admin or super_admin for this account
      const user = await storage.getUser(req.user.id);
      if (!user || user.accountId !== accountId || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Only admins can invite users" });
      }

      // Validate role
      const validatedRole = userRoleSchema.parse(role);

      // Generate unique invitation token
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);

      const invitation = await storage.createInvitation({
        accountId,
        email,
        role: validatedRole,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        invitedBy: req.user.id
      });

      // Send invitation email
      try {
        const account = await storage.getAccount(accountId);
        const inviterUser = await storage.getUser(req.user.id);

        // For now, just log the invitation details
        console.log('=== INVITATION SENT ===');
        console.log('To:', email);
        console.log('From:', inviterUser?.email || 'Unknown');
        console.log('Account:', account?.name || 'Unknown Account');
        console.log('Role:', validatedRole);
        console.log('Invitation Token:', token);
        console.log('Invitation URL:', `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/accept-invitation/${token}`);
        console.log('Expires:', invitation.expiresAt);
        console.log('=====================');

        // TODO: Implement actual email sending when email service is configured
        // await sendInvitationEmail({
        //   email,
        //   inviterName: inviterUser?.email || 'Team Member',
        //   accountName: account?.name || 'UTM Builder Account',
        //   invitationToken: token,
        //   role: validatedRole
        // });
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Don't fail the invitation if email fails
      }

      res.json(invitation);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Remove user from account (super_admin only)
  app.delete("/api/accounts/:id/users/:userId", authMiddleware, async (req: any, res) => {
    try {
      const accountId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);

      // Check if requesting user is super_admin for this account
      const user = await storage.getUser(req.user.id);
      if (!user || user.accountId !== accountId || user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only super admins can remove users" });
      }

      // Don't allow removing the last super_admin
      const accountUsers = await storage.getAccountUsers(accountId);
      const superAdmins = accountUsers.filter(u => u.role === 'super_admin');
      const targetUser = accountUsers.find(u => u.id === userId);

      if (targetUser?.role === 'super_admin' && superAdmins.length === 1) {
        return res.status(400).json({ message: "Cannot remove the last super admin" });
      }

      const success = await storage.removeUserFromAccount(userId);
      res.json({ success });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update user role (super_admin only)
  app.put("/api/accounts/:id/users/:userId/role", authMiddleware, async (req: any, res) => {
    try {
      const accountId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);
      const { role } = req.body;

      // Check if requesting user is super_admin for this account
      const user = await storage.getUser(req.user.id);
      if (!user || user.accountId !== accountId || user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only super admins can change user roles" });
      }

      // Validate role
      const validatedRole = userRoleSchema.parse(role);

      const updatedUser = await storage.updateUserRole(userId, validatedRole);
      res.json(updatedUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get invitation details
  app.get("/api/invitations/:token", async (req: any, res) => {
    try {
      const { token } = req.params;

      // Get invitation with related data
      const invitation = await storage.getInvitationByToken(token);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // Check if invitation is valid
      if (invitation.status !== 'pending') {
        return res.status(400).json({ message: "Invitation already used or expired" });
      }

      if (new Date() > invitation.expiresAt) {
        await storage.updateInvitationStatus(invitation.id, 'expired');
        return res.status(400).json({ message: "Invitation expired" });
      }

      // Get additional data
      const account = await storage.getAccount(invitation.accountId);
      const inviter = await storage.getUser(invitation.invitedBy);

      res.json({
        ...invitation,
        account: account ? { id: account.id, name: account.name } : null,
        inviter: inviter ? { email: inviter.email } : null
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // =====================================
  // ACCOUNT MANAGEMENT ENDPOINTS WITH ROLE-BASED PERMISSIONS
  // =====================================

  // Get account users (Super Admin and Admin only)
  app.get("/api/accounts/:accountId/users", authMiddleware, requireAccountAccess('accountId'), requirePermission('manage_users'), async (req: any, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const users = await storage.getAccountUsers(accountId);
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update user role (Super Admin and Admin only, with restrictions)
  app.patch("/api/users/:userId/role", authMiddleware, requirePermission('change_user_roles'), async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { role } = req.body;

      // Validate role
      if (!['viewer', 'editor', 'admin', 'super_admin'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      // Get target user
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate account access
      if (!validateAccountAccess(req.user, targetUser.accountId)) {
        return res.status(403).json({ message: "Access denied. User does not belong to your account." });
      }

      // Check if current user can change this user's role to the new role
      if (!canChangeUserRole(req.user, targetUser, role)) {
        return res.status(403).json({
          message: "Cannot change user role. Insufficient permissions.",
          details: req.user.role === 'admin' && (targetUser.role === 'super_admin' || role === 'super_admin')
            ? "Admins cannot manage Super Admin roles"
            : "You can only modify users with lower privileges"
        });
      }

      const updatedUser = await storage.updateUserRole(userId, role);
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user role" });
      }

      res.json(updatedUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Create invitation (Super Admin and Admin only)
  app.post("/api/invitations", authMiddleware, requirePermission('invite_users'), async (req: any, res) => {
    try {
      const { email, role } = req.body;

      // Validate role
      if (!['viewer', 'editor', 'admin', 'super_admin'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      // Admin cannot invite Super Admin
      if (req.user.role === 'admin' && role === 'super_admin') {
        return res.status(403).json({ message: "Admins cannot invite Super Admins" });
      }

      // Generate invitation token
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invitation = await storage.createInvitation({
        accountId: req.user.accountId,
        email,
        role,
        token,
        expiresAt,
        invitedBy: req.user.id
      });

      res.json({
        ...invitation,
        inviteUrl: `${req.get('origin') || 'http://localhost:5000'}/invite/${token}`
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get account invitations (Super Admin and Admin only)
  app.get("/api/accounts/:accountId/invitations", authMiddleware, requireAccountAccess('accountId'), requirePermission('invite_users'), async (req: any, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const invitations = await storage.getAccountInvitations(accountId);
      res.json(invitations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete user from account (Super Admin only)
  app.delete("/api/users/:userId", authMiddleware, requirePermission('delete_users'), async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);

      // Get target user
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate account access
      if (!validateAccountAccess(req.user, targetUser.accountId)) {
        return res.status(403).json({ message: "Access denied. User does not belong to your account." });
      }

      // Cannot delete yourself
      if (req.user.id === userId) {
        return res.status(400).json({ message: "Cannot delete yourself" });
      }

      // Only Super Admin can delete users
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only Super Admins can delete users" });
      }

      const success = await storage.removeUserFromAccount(userId);
      if (success) {
        res.json({ message: "User deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete user" });
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Accept invitation
  app.post("/api/invitations/:token/accept", async (req: any, res) => {
    try {
      const { token } = req.params;
      const { firebaseUid } = req.body;

      // Get invitation
      const invitation = await storage.getInvitationByToken(token);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // Check if invitation is valid
      if (invitation.status !== 'pending') {
        return res.status(400).json({ message: "Invitation already used or expired" });
      }

      if (new Date() > invitation.expiresAt) {
        await storage.updateInvitationStatus(invitation.id, 'expired');
        return res.status(400).json({ message: "Invitation expired" });
      }

      // Get or create user (single account model)
      let user = await storage.getUserByFirebaseUid(firebaseUid);
      if (!user) {
        // Create user directly with the invited account
        user = await storage.createUser({
          email: invitation.email,
          firebaseUid,
          accountId: invitation.accountId,
          role: invitation.role,
          invitedBy: invitation.invitedBy
        });
      } else {
        // If user exists but doesn't have account, update them
        if (!user.accountId) {
          await storage.updateUser(user.id, {
            accountId: invitation.accountId,
            role: invitation.role,
            invitedBy: invitation.invitedBy
          });
          user = await storage.getUser(user.id); // Get updated user
        }
      }

      // Mark invitation as accepted
      await storage.updateInvitationStatus(invitation.id, 'accepted');

      res.json({ user, account: await storage.getAccount(invitation.accountId) });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Mount vendor routes under /vendor-api (not easily guessable)
  app.use('/vendor-api', vendorRoutes);

  // Get pricing plans for public signup
  app.get("/api/pricing-plans", async (req, res) => {
    try {
      const plans = await db
        .select({
          id: pricingPlans.id,
          planCode: pricingPlans.planCode,
          planName: pricingPlans.planName,
          description: pricingPlans.description,
          monthlyPriceCents: pricingPlans.monthlyPriceCents,
          annualPriceCents: pricingPlans.annualPriceCents,
          maxCampaigns: pricingPlans.maxCampaigns,
          maxUsers: pricingPlans.maxUsers,
          maxUtmLinks: pricingPlans.maxUtmLinks,
          features: pricingPlans.features
        })
        .from(pricingPlans)
        .where(eq(pricingPlans.isActive, true))
        .orderBy(pricingPlans.sortOrder);

      res.json(plans);
    } catch (error: any) {
      console.error('Error fetching pricing plans:', error);
      res.status(500).json({ message: "Failed to fetch pricing plans" });
    }
  });

  // One-time admin endpoint: upgrade account to enterprise and fix plan features
  app.post("/api/admin/upgrade-enterprise", async (req, res) => {
    try {
      const { email, adminKey } = req.body;
      if (adminKey !== "utm-admin-2026") {
        return res.status(403).json({ message: "Invalid admin key" });
      }
      if (!email) {
        return res.status(400).json({ message: "Email required" });
      }

      // Update all pricing plans to include tagManagement
      const allPlans = await db.select().from(pricingPlans);
      for (const plan of allPlans) {
        const features = (plan.features as Record<string, boolean>) || {};
        const shouldHaveTagMgmt = ['starter', 'professional', 'enterprise'].includes(plan.planCode);
        if (features.tagManagement === undefined) {
          features.tagManagement = shouldHaveTagMgmt;
          await db.update(pricingPlans).set({ features }).where(eq(pricingPlans.id, plan.id));
        }
      }

      // Find enterprise plan
      const [enterprisePlan] = await db.select().from(pricingPlans).where(eq(pricingPlans.planCode, 'enterprise'));
      if (!enterprisePlan) {
        return res.status(404).json({ message: "Enterprise plan not found" });
      }

      // Find user by email
      const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (user.length === 0) {
        return res.status(404).json({ message: `User ${email} not found` });
      }

      // Update account to enterprise
      const [updated] = await db
        .update(accounts)
        .set({ pricingPlanId: enterprisePlan.id, subscriptionTier: 'enterprise' })
        .where(eq(accounts.id, user[0].accountId))
        .returning();

      res.json({
        message: `Account upgraded to enterprise`,
        accountId: updated.id,
        planId: enterprisePlan.id,
        plansUpdated: allPlans.length
      });
    } catch (error: any) {
      console.error("Admin upgrade error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
