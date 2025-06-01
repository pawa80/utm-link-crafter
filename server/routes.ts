import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertUtmLinkSchema, updateUserSchema } from "@shared/schema";
import { z } from "zod";

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

  // Export user's UTM links as CSV
  app.get("/api/utm-links/export", authMiddleware, async (req: any, res) => {
    try {
      // Get all user's links for export
      const links = await storage.getUserUtmLinks(req.user.id, 1000, 0);
      
      // Create CSV headers
      const csvHeaders = [
        "Campaign Name",
        "Source", 
        "Medium",
        "Content",
        "Term",
        "Category",
        "Target URL",
        "Full UTM Link",
        "Created Date"
      ];
      
      // Convert links to CSV rows
      const csvRows = links.map(link => [
        `"${link.utm_campaign}"`,
        `"${link.utm_source}"`,
        `"${link.utm_medium}"`,
        `"${link.utm_content || ''}"`,
        `"${link.utm_term || ''}"`,
        `"${link.category || ''}"`,
        `"${link.targetUrl}"`,
        `"${link.fullUtmLink}"`,
        `"${link.createdAt ? new Date(link.createdAt).toLocaleDateString() : ''}"`
      ]);
      
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

  const httpServer = createServer(app);
  return httpServer;
}
