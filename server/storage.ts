import { users, utmLinks, sourceTemplates, tags, campaignLandingPages, type User, type InsertUser, type UtmLink, type InsertUtmLink, type SourceTemplate, type InsertSourceTemplate, type UpdateUser, type Tag, type InsertTag, type CampaignLandingPage, type InsertCampaignLandingPage } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: UpdateUser): Promise<User | undefined>;
  
  // UTM Link operations
  createUtmLink(utmLink: InsertUtmLink): Promise<UtmLink>;
  getUserUtmLinks(userId: number, limit?: number, offset?: number): Promise<UtmLink[]>;
  getUtmLink(id: number): Promise<UtmLink | undefined>;
  deleteUtmLinksByCampaign(userId: number, campaignName: string): Promise<boolean>;
  
  // Source Template operations
  createSourceTemplate(sourceTemplate: InsertSourceTemplate): Promise<SourceTemplate>;
  getUserSourceTemplates(userId: number): Promise<SourceTemplate[]>;
  updateSourceTemplate(id: number, updates: Partial<InsertSourceTemplate>): Promise<SourceTemplate | undefined>;
  deleteSourceTemplate(id: number): Promise<boolean>;
  
  // Tag operations
  createTag(tag: InsertTag): Promise<Tag>;
  getUserTags(userId: number): Promise<Tag[]>;
  getTagByName(userId: number, name: string): Promise<Tag | undefined>;
  
  // Campaign Landing Page operations
  createCampaignLandingPage(landingPage: InsertCampaignLandingPage): Promise<CampaignLandingPage>;
  getCampaignLandingPages(userId: number, campaignName: string): Promise<CampaignLandingPage[]>;
  deleteCampaignLandingPages(userId: number, campaignName: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: number, updates: UpdateUser): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async createUtmLink(insertUtmLink: InsertUtmLink): Promise<UtmLink> {
    const [utmLink] = await db
      .insert(utmLinks)
      .values(insertUtmLink)
      .returning();
    return utmLink;
  }

  async getUserUtmLinks(userId: number, limit = 1000, offset = 0): Promise<UtmLink[]> {
    const userLinks = await db
      .select()
      .from(utmLinks)
      .where(eq(utmLinks.userId, userId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(utmLinks.id)); // Order by ID descending to show newest first
    
    return userLinks;
  }

  async getUtmLink(id: number): Promise<UtmLink | undefined> {
    const [utmLink] = await db.select().from(utmLinks).where(eq(utmLinks.id, id));
    return utmLink || undefined;
  }

  async deleteUtmLinksByCampaign(userId: number, campaignName: string): Promise<boolean> {
    try {
      await db
        .delete(utmLinks)
        .where(
          and(
            eq(utmLinks.userId, userId),
            eq(utmLinks.utm_campaign, campaignName)
          )
        );
      return true;
    } catch (error) {
      console.error('Error deleting UTM links by campaign:', error);
      return false;
    }
  }

  async createSourceTemplate(insertSourceTemplate: InsertSourceTemplate): Promise<SourceTemplate> {
    const [sourceTemplate] = await db
      .insert(sourceTemplates)
      .values({
        ...insertSourceTemplate,
        abTestingPreference: insertSourceTemplate.abTestingPreference || 1
      })
      .returning();
    return sourceTemplate;
  }

  async getUserSourceTemplates(userId: number): Promise<SourceTemplate[]> {
    return await db.select().from(sourceTemplates).where(eq(sourceTemplates.userId, userId));
  }

  async updateSourceTemplate(id: number, updates: Partial<InsertSourceTemplate>): Promise<SourceTemplate | undefined> {
    const [sourceTemplate] = await db
      .update(sourceTemplates)
      .set(updates)
      .where(eq(sourceTemplates.id, id))
      .returning();
    return sourceTemplate || undefined;
  }

  async deleteSourceTemplate(id: number): Promise<boolean> {
    const result = await db.delete(sourceTemplates).where(eq(sourceTemplates.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async createTag(insertTag: InsertTag): Promise<Tag> {
    const [tag] = await db
      .insert(tags)
      .values(insertTag)
      .returning();
    return tag;
  }

  async getUserTags(userId: number): Promise<Tag[]> {
    return await db.select().from(tags).where(eq(tags.userId, userId));
  }

  async getTagByName(userId: number, name: string): Promise<Tag | undefined> {
    const [tag] = await db.select().from(tags).where(and(eq(tags.userId, userId), eq(tags.name, name)));
    return tag || undefined;
  }

  async createCampaignLandingPage(insertLandingPage: InsertCampaignLandingPage): Promise<CampaignLandingPage> {
    const [landingPage] = await db
      .insert(campaignLandingPages)
      .values(insertLandingPage)
      .returning();
    return landingPage;
  }

  async getCampaignLandingPages(userId: number, campaignName: string): Promise<CampaignLandingPage[]> {
    return await db.select().from(campaignLandingPages)
      .where(and(eq(campaignLandingPages.userId, userId), eq(campaignLandingPages.campaignName, campaignName)));
  }

  async deleteCampaignLandingPages(userId: number, campaignName: string): Promise<boolean> {
    const result = await db.delete(campaignLandingPages)
      .where(and(eq(campaignLandingPages.userId, userId), eq(campaignLandingPages.campaignName, campaignName)));
    return (result.rowCount ?? 0) > 0;
  }
}

export const storage = new DatabaseStorage();
