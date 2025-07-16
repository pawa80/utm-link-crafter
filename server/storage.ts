import { users, utmLinks, sourceTemplates, tags, campaignLandingPages, utmTemplates, type User, type InsertUser, type UtmLink, type InsertUtmLink, type SourceTemplate, type InsertSourceTemplate, type UpdateUser, type Tag, type InsertTag, type CampaignLandingPage, type InsertCampaignLandingPage, type UtmTemplate, type InsertUtmTemplate } from "@shared/schema";
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
  getUserUtmLinks(userId: number, limit?: number, offset?: number, includeArchived?: boolean): Promise<UtmLink[]>;
  getUtmLink(id: number, userId?: number): Promise<UtmLink | undefined>;
  deleteUtmLinksByCampaign(userId: number, campaignName: string): Promise<boolean>;
  archiveCampaign(userId: number, campaignName: string): Promise<boolean>;
  unarchiveCampaign(userId: number, campaignName: string): Promise<boolean>;
  
  // Source Template operations
  createSourceTemplate(sourceTemplate: InsertSourceTemplate): Promise<SourceTemplate>;
  getUserSourceTemplates(userId: number): Promise<SourceTemplate[]>;
  updateSourceTemplate(id: number, userId: number, updates: Partial<InsertSourceTemplate>): Promise<SourceTemplate | undefined>;
  deleteSourceTemplate(id: number, userId: number): Promise<boolean>;
  
  // Tag operations
  createTag(tag: InsertTag): Promise<Tag>;
  getUserTags(userId: number): Promise<Tag[]>;
  getTagByName(userId: number, name: string): Promise<Tag | undefined>;
  
  // Campaign Landing Page operations
  createCampaignLandingPage(landingPage: InsertCampaignLandingPage): Promise<CampaignLandingPage>;
  getCampaignLandingPages(userId: number, campaignName: string, includeArchived?: boolean): Promise<CampaignLandingPage[]>;
  deleteCampaignLandingPages(userId: number, campaignName: string): Promise<boolean>;
  
  // UTM Template operations
  getUtmTemplates(): Promise<UtmTemplate[]>;
  getUtmContentsBySourceMedium(utmSource: string, utmMedium: string): Promise<string[]>;
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

  async getUserUtmLinks(userId: number, limit = 100, offset = 0, includeArchived = false): Promise<UtmLink[]> {
    const userLinks = await db
      .select()
      .from(utmLinks)
      .where(
        and(
          eq(utmLinks.userId, userId),
          includeArchived ? undefined : eq(utmLinks.isArchived, false)
        )
      )
      .limit(limit)
      .offset(offset)
      .orderBy(desc(utmLinks.id)); // Order by ID descending to show newest first
    
    return userLinks;
  }

  async getUtmLink(id: number, userId?: number): Promise<UtmLink | undefined> {
    const conditions = userId 
      ? and(eq(utmLinks.id, id), eq(utmLinks.userId, userId))
      : eq(utmLinks.id, id);
    
    const [utmLink] = await db.select().from(utmLinks).where(conditions);
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

  async archiveCampaign(userId: number, campaignName: string): Promise<boolean> {
    try {
      // Archive UTM links
      await db
        .update(utmLinks)
        .set({ isArchived: true })
        .where(
          and(
            eq(utmLinks.userId, userId),
            eq(utmLinks.utm_campaign, campaignName)
          )
        );
      
      // Archive landing pages
      await db
        .update(campaignLandingPages)
        .set({ isArchived: true })
        .where(
          and(
            eq(campaignLandingPages.userId, userId),
            eq(campaignLandingPages.campaignName, campaignName)
          )
        );
      
      return true;
    } catch (error) {
      console.error('Error archiving campaign:', error);
      return false;
    }
  }

  async unarchiveCampaign(userId: number, campaignName: string): Promise<boolean> {
    try {
      // Unarchive UTM links
      await db
        .update(utmLinks)
        .set({ isArchived: false })
        .where(
          and(
            eq(utmLinks.userId, userId),
            eq(utmLinks.utm_campaign, campaignName)
          )
        );
      
      // Unarchive landing pages
      await db
        .update(campaignLandingPages)
        .set({ isArchived: false })
        .where(
          and(
            eq(campaignLandingPages.userId, userId),
            eq(campaignLandingPages.campaignName, campaignName)
          )
        );
      
      return true;
    } catch (error) {
      console.error('Error unarchiving campaign:', error);
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

  async updateSourceTemplate(id: number, userId: number, updates: Partial<InsertSourceTemplate>): Promise<SourceTemplate | undefined> {
    const [sourceTemplate] = await db
      .update(sourceTemplates)
      .set(updates)
      .where(and(eq(sourceTemplates.id, id), eq(sourceTemplates.userId, userId)))
      .returning();
    return sourceTemplate || undefined;
  }

  async deleteSourceTemplate(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(sourceTemplates).where(and(eq(sourceTemplates.id, id), eq(sourceTemplates.userId, userId)));
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

  async getCampaignLandingPages(userId: number, campaignName: string, includeArchived = false): Promise<CampaignLandingPage[]> {
    return await db.select().from(campaignLandingPages)
      .where(and(
        eq(campaignLandingPages.userId, userId), 
        eq(campaignLandingPages.campaignName, campaignName),
        includeArchived ? undefined : eq(campaignLandingPages.isArchived, false)
      ));
  }

  async deleteCampaignLandingPages(userId: number, campaignName: string): Promise<boolean> {
    const result = await db.delete(campaignLandingPages)
      .where(and(eq(campaignLandingPages.userId, userId), eq(campaignLandingPages.campaignName, campaignName)));
    return (result.rowCount ?? 0) > 0;
  }

  async getUtmTemplates(): Promise<UtmTemplate[]> {
    return await db.select().from(utmTemplates);
  }

  async getUtmContentsBySourceMedium(utmSource: string, utmMedium: string): Promise<string[]> {
    const templates = await db
      .select({ utmContent: utmTemplates.utmContent })
      .from(utmTemplates)
      .where(
        and(
          eq(utmTemplates.utmSource, utmSource),
          eq(utmTemplates.utmMedium, utmMedium)
        )
      );
    
    return templates.map(t => t.utmContent);
  }
}

export const storage = new DatabaseStorage();
