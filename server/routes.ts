import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertUtmLinkSchema, insertSourceTemplateSchema, updateUserSchema, insertTagSchema, insertCampaignLandingPageSchema, insertAccountSchema, insertUserAccountSchema, insertInvitationSchema, userRoleSchema } from "@shared/schema";
import { z } from "zod";
import { seedUtmTemplates, getUniqueSourcesAndMediums } from "./seedUtmTemplates";

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
    return res.status(401).json({ message: "User not found" });
  }
  
  req.user = user;
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Seed UTM templates on startup
  await seedUtmTemplates();
  
  // Create or get user
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByFirebaseUid(userData.firebaseUid);
      if (existingUser) {
        return res.json(existingUser);
      }
      
      // Create user
      const user = await storage.createUser(userData);
      
      // Create default account for new user
      const account = await storage.createAccount({
        name: `${userData.email}'s Account`,
        subscriptionTier: "trial",
        trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        featureFlags: {},
        usageLimits: {
          maxCampaigns: 50,
          maxLinksPerCampaign: 100,
          maxTemplates: 200
        }
      });
      
      // Add user to their account as super_admin
      await storage.addUserToAccount({
        userId: user.id,
        accountId: account.id,
        role: "super_admin"
      });
      
      // Create user template copies from base templates with account context
      await storage.createUserTemplatesFromBase(user.id, account.id);
      
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
      res.status(400).json({ message: error.message });
    }
  });

  // Get current user
  app.get("/api/user", authMiddleware, async (req: any, res) => {
    res.json(req.user);
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

  // Create UTM link
  app.post("/api/utm-links", authMiddleware, async (req: any, res) => {
    try {
      const utmLinkData = insertUtmLinkSchema.parse({
        ...req.body,
        userId: req.user.id,
      });
      
      const utmLink = await storage.createUtmLink(utmLinkData);
      res.json(utmLink);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get user's UTM links
  app.get("/api/utm-links", authMiddleware, async (req: any, res) => {
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
  app.delete("/api/utm-links/campaign/:campaignName", authMiddleware, async (req: any, res) => {
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
  app.post("/api/campaigns/:campaignName/archive", authMiddleware, async (req: any, res) => {
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
  app.post("/api/campaigns/:campaignName/unarchive", authMiddleware, async (req: any, res) => {
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
  app.get("/api/utm-links/export", authMiddleware, async (req: any, res) => {
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

  app.post("/api/source-templates", authMiddleware, async (req: any, res) => {
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

  app.patch("/api/source-templates/:id", authMiddleware, async (req: any, res) => {
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

  app.delete("/api/source-templates/:id", authMiddleware, async (req: any, res) => {
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

  app.post("/api/tags", authMiddleware, async (req: any, res) => {
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
      const tagData = insertTagSchema.parse(requestBody);
      
      // Check if tag already exists
      const existingTag = await storage.getTagByName(req.user.id, tagData.name);
      if (existingTag) {
        return res.json(existingTag);
      }
      
      const tag = await storage.createTag({
        ...tagData,
        userId: req.user.id,
      });
      
      res.json(tag);
    } catch (error: any) {
      console.error("Tag creation error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/tags/:id", authMiddleware, async (req: any, res) => {
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

  app.delete("/api/tags/:id", authMiddleware, async (req: any, res) => {
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

  app.post("/api/campaign-landing-pages", authMiddleware, async (req: any, res) => {
    try {
      const landingPageData = insertCampaignLandingPageSchema.parse({
        ...req.body,
        userId: req.user.id,
      });
      
      const landingPage = await storage.createCampaignLandingPage(landingPageData);
      res.json(landingPage);
    } catch (error: any) {
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

  // Account Management Endpoints

  // Create new account (admin only)
  app.post("/api/accounts", authMiddleware, async (req: any, res) => {
    try {
      const accountData = insertAccountSchema.parse(req.body);
      
      // Check if user is super_admin
      const userAccounts = await storage.getUserAccountsWithRole(req.user.id);
      const isSuperAdmin = userAccounts.some(ua => ua.role === 'super_admin');
      if (!isSuperAdmin) {
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
      const userAccount = await storage.getUserAccountRelation(req.user.id, accountId);
      if (!userAccount) {
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

  // Get user's accounts
  app.get("/api/user/accounts", authMiddleware, async (req: any, res) => {
    try {
      console.log("Getting accounts for user:", req.user.id);
      const userAccountsWithRole = await storage.getUserAccountsWithRole(req.user.id);
      console.log("Found accounts:", userAccountsWithRole);
      res.json(userAccountsWithRole);
    } catch (error: any) {
      console.error("Error getting user accounts:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Update account settings (admin/super_admin only)
  app.put("/api/accounts/:id", authMiddleware, async (req: any, res) => {
    try {
      const accountId = parseInt(req.params.id);
      const updates = req.body;
      
      // Check if user is admin or super_admin for this account
      const userAccount = await storage.getUserAccountRelation(req.user.id, accountId);
      if (!userAccount || !['admin', 'super_admin'].includes(userAccount.role)) {
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
      const userAccount = await storage.getUserAccountRelation(req.user.id, accountId);
      if (!userAccount || !['admin', 'super_admin'].includes(userAccount.role)) {
        return res.status(403).json({ message: "Only admins can view account users" });
      }
      
      const accountUsers = await storage.getAccountUsers(accountId);
      res.json(accountUsers);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Invite user to account (admin/super_admin only)
  app.post("/api/accounts/:id/invite", authMiddleware, async (req: any, res) => {
    try {
      const accountId = parseInt(req.params.id);
      const { email, role } = req.body;
      
      // Check if user is admin or super_admin for this account
      const userAccount = await storage.getUserAccountRelation(req.user.id, accountId);
      if (!userAccount || !['admin', 'super_admin'].includes(userAccount.role)) {
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
      const userAccount = await storage.getUserAccountRelation(req.user.id, accountId);
      if (!userAccount || userAccount.role !== 'super_admin') {
        return res.status(403).json({ message: "Only super admins can remove users" });
      }
      
      // Don't allow removing the last super_admin
      const accountUsers = await storage.getAccountUsers(accountId);
      const superAdmins = accountUsers.filter(u => u.role === 'super_admin');
      const targetUser = accountUsers.find(u => u.userId === userId);
      
      if (targetUser?.role === 'super_admin' && superAdmins.length === 1) {
        return res.status(400).json({ message: "Cannot remove the last super admin" });
      }
      
      const success = await storage.removeUserFromAccount(userId, accountId);
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
      const userAccount = await storage.getUserAccountRelation(req.user.id, accountId);
      if (!userAccount || userAccount.role !== 'super_admin') {
        return res.status(403).json({ message: "Only super admins can change user roles" });
      }
      
      // Validate role
      const validatedRole = userRoleSchema.parse(role);
      
      const updatedUserAccount = await storage.updateUserRole(userId, accountId, validatedRole);
      res.json(updatedUserAccount);
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
      
      // Get or create user
      let user = await storage.getUserByFirebaseUid(firebaseUid);
      if (!user) {
        user = await storage.createUser({
          email: invitation.email,
          firebaseUid
        });
      }
      
      // Add user to account
      await storage.addUserToAccount({
        userId: user.id,
        accountId: invitation.accountId,
        role: invitation.role,
        invitedBy: invitation.invitedBy
      });
      
      // Mark invitation as accepted
      await storage.updateInvitationStatus(invitation.id, 'accepted');
      
      res.json({ user, account: await storage.getAccount(invitation.accountId) });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
