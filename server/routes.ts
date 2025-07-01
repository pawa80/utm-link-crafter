import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertUtmLinkSchema, insertSourceTemplateSchema, updateUserSchema, insertTagSchema, insertAbTestSuggestionSchema } from "@shared/schema";
import { z } from "zod";

// A/B Testing Suggestion Engine
async function generateAbTestSuggestions(userId: number, campaignName: string, sourceName: string, medium: string, content: string) {
  const suggestions = [];
  
  // Content variation suggestions based on marketing best practices
  const contentSuggestions = generateContentVariations(content, medium, sourceName);
  
  if (contentSuggestions.length > 0) {
    suggestions.push({
      variants: contentSuggestions,
      reason: "Test different messaging approaches to optimize engagement",
      confidence: 4,
      testType: "content"
    });
  }
  
  // CTA variations for paid media
  if (medium.includes('paid') || medium.includes('ppc') || medium.includes('ads')) {
    const ctaVariations = generateCTAVariations(content);
    if (ctaVariations.length > 0) {
      suggestions.push({
        variants: ctaVariations,
        reason: "Test call-to-action variations to improve conversion rates",
        confidence: 5,
        testType: "cta"
      });
    }
  }
  
  // Emotional tone variations for social media
  if (medium.includes('social') || sourceName.toLowerCase().includes('facebook') || sourceName.toLowerCase().includes('instagram')) {
    const emotionalVariations = generateEmotionalVariations(content);
    if (emotionalVariations.length > 0) {
      suggestions.push({
        variants: emotionalVariations,
        reason: "Test emotional tones to maximize social media engagement",
        confidence: 3,
        testType: "messaging"
      });
    }
  }
  
  // Format variations for email campaigns
  if (medium.includes('email')) {
    const formatVariations = generateFormatVariations(content);
    if (formatVariations.length > 0) {
      suggestions.push({
        variants: formatVariations,
        reason: "Test different email content formats for better open rates",
        confidence: 4,
        testType: "format"
      });
    }
  }
  
  return suggestions;
}

function generateContentVariations(content: string, medium: string, sourceName: string): string[] {
  if (!content.trim()) return [];
  
  const variations = [];
  const words = content.toLowerCase().split(' ');
  
  // Length variations
  if (words.length > 3) {
    variations.push(content.split(' ').slice(0, Math.ceil(words.length / 2)).join(' ')); // Shorter version
  }
  
  // Urgency variations
  const urgencyWords = ['now', 'today', 'limited', 'hurry', 'fast', 'quick'];
  if (!urgencyWords.some(word => content.toLowerCase().includes(word))) {
    variations.push(`${content} - Limited Time`);
    variations.push(`Get ${content} Now`);
  }
  
  // Benefit-focused variations
  const benefitPrefixes = ['Save with', 'Discover', 'Get more with', 'Unlock'];
  variations.push(`${benefitPrefixes[Math.floor(Math.random() * benefitPrefixes.length)]} ${content}`);
  
  return variations.slice(0, 3); // Limit to 3 variations
}

function generateCTAVariations(content: string): string[] {
  const variations = [];
  const ctaWords = ['shop', 'buy', 'get', 'download', 'learn', 'discover', 'try', 'start'];
  
  ctaWords.forEach(cta => {
    if (!content.toLowerCase().includes(cta)) {
      variations.push(`${cta}-${content}`);
    }
  });
  
  // Action-oriented variations
  variations.push(`action-${content}`);
  variations.push(`signup-${content}`);
  
  return variations.slice(0, 2);
}

function generateEmotionalVariations(content: string): string[] {
  const variations = [];
  const emotions = ['exciting', 'amazing', 'incredible', 'exclusive', 'premium'];
  
  emotions.forEach(emotion => {
    if (!content.toLowerCase().includes(emotion)) {
      variations.push(`${emotion}-${content}`);
    }
  });
  
  return variations.slice(0, 2);
}

function generateFormatVariations(content: string): string[] {
  const variations = [];
  
  // Question format
  if (!content.includes('?')) {
    variations.push(`${content}?`);
  }
  
  // List format
  variations.push(`${content}-list`);
  
  // How-to format
  if (!content.toLowerCase().includes('how')) {
    variations.push(`how-${content}`);
  }
  
  return variations.slice(0, 2);
}

const authMiddleware = async (req: any, res: any, next: any) => {
  const firebaseUid = req.headers['x-firebase-uid'];
  if (!firebaseUid) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const user = await storage.getUserByFirebaseUid(firebaseUid as string);
  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }
  
  req.user = user;
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Create or get user
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByFirebaseUid(userData.firebaseUid);
      if (existingUser) {
        return res.json(existingUser);
      }
      
      const user = await storage.createUser(userData);
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
      const updatedUser = await storage.updateUser(req.user.id, updates);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
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
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const links = await storage.getUserUtmLinks(req.user.id, limit, offset);
      res.json(links);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delete UTM links by campaign (for editing campaigns)
  app.delete("/api/utm-links/campaign/:campaignName", authMiddleware, async (req: any, res) => {
    try {
      const campaignName = decodeURIComponent(req.params.campaignName);
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

      const template = await storage.updateSourceTemplate(id, updates);
      if (!template) {
        return res.status(404).json({ message: "Source template not found" });
      }

      res.json(template);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/source-templates/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteSourceTemplate(id);
      
      if (!success) {
        return res.status(404).json({ message: "Source template not found" });
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
      const tagData = insertTagSchema.parse(req.body);
      
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
      res.status(400).json({ message: error.message });
    }
  });

  // A/B Test Suggestions API routes
  app.get("/api/ab-test-suggestions", authMiddleware, async (req: any, res) => {
    try {
      const suggestions = await storage.getUserAbTestSuggestions(req.user.id);
      res.json(suggestions);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/ab-test-suggestions/:campaignName", authMiddleware, async (req: any, res) => {
    try {
      const { campaignName } = req.params;
      const suggestions = await storage.getCampaignAbTestSuggestions(req.user.id, campaignName);
      res.json(suggestions);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/ab-test-suggestions", authMiddleware, async (req: any, res) => {
    try {
      const suggestionData = insertAbTestSuggestionSchema.parse({
        ...req.body,
        userId: req.user.id,
      });

      const suggestion = await storage.createAbTestSuggestion(suggestionData);
      res.json(suggestion);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/ab-test-suggestions/:id", authMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const suggestion = await storage.updateAbTestSuggestionStatus(parseInt(id), status);
      if (!suggestion) {
        return res.status(404).json({ message: "Suggestion not found" });
      }
      
      res.json(suggestion);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/ab-test-suggestions/:id", authMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteAbTestSuggestion(parseInt(id));
      
      if (!success) {
        return res.status(404).json({ message: "Suggestion not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Generate A/B test suggestions for a campaign
  app.post("/api/ab-test-suggestions/generate", authMiddleware, async (req: any, res) => {
    try {
      const { campaignName, sourceName, medium, content } = req.body;
      
      // A/B Testing suggestion engine logic
      const suggestions = await generateAbTestSuggestions(req.user.id, campaignName, sourceName, medium, content);
      
      // Save suggestions to database
      const createdSuggestions = [];
      for (const suggestion of suggestions) {
        const created = await storage.createAbTestSuggestion({
          userId: req.user.id,
          campaignName,
          sourceName,
          medium,
          originalContent: content,
          suggestedVariants: suggestion.variants,
          suggestionReason: suggestion.reason,
          confidence: suggestion.confidence,
          testType: suggestion.testType,
          status: "pending"
        });
        createdSuggestions.push(created);
      }
      
      res.json(createdSuggestions);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
