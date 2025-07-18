import { users, utmLinks, sourceTemplates, tags, campaignLandingPages, utmTemplates, userUtmContent, type User, type InsertUser, type UtmLink, type InsertUtmLink, type SourceTemplate, type InsertSourceTemplate, type UpdateUser, type Tag, type InsertTag, type CampaignLandingPage, type InsertCampaignLandingPage, type UtmTemplate, type InsertUtmTemplate, type UserUtmContent, type InsertUserUtmContent } from "@shared/schema";
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
  updateTag(id: number, userId: number, name: string): Promise<Tag | undefined>;
  deleteTag(id: number, userId: number): Promise<boolean>;
  
  // Campaign Landing Page operations
  createCampaignLandingPage(landingPage: InsertCampaignLandingPage): Promise<CampaignLandingPage>;
  getCampaignLandingPages(userId: number, campaignName: string, includeArchived?: boolean): Promise<CampaignLandingPage[]>;
  getAllCampaignLandingPages(userId: number, includeArchived?: boolean): Promise<CampaignLandingPage[]>;
  deleteCampaignLandingPages(userId: number, campaignName: string): Promise<boolean>;
  
  // UTM Template operations
  getUtmTemplates(): Promise<UtmTemplate[]>;
  getUtmContentsBySourceMedium(utmSource: string, utmMedium: string): Promise<string[]>;
  
  // User UTM Content operations
  createUserUtmContent(userContent: InsertUserUtmContent): Promise<UserUtmContent>;
  getUserUtmContentsBySourceMedium(userId: number, utmSource: string, utmMedium: string, includeArchived?: boolean): Promise<UserUtmContent[]>;
  archiveUserUtmContent(id: number, userId: number): Promise<boolean>;
  unarchiveUserUtmContent(id: number, userId: number): Promise<boolean>;
  deleteUserUtmContent(id: number, userId: number): Promise<boolean>;
  
  // Get all unique URLs that have been used across the account
  getAllUniqueUrls(userId: number): Promise<string[]>;
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

  async updateTag(id: number, userId: number, name: string): Promise<Tag | undefined> {
    // Get the old tag to update UTM links
    const [oldTag] = await db.select().from(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
    if (!oldTag) return undefined;

    // Update the tag name
    const [updatedTag] = await db
      .update(tags)
      .set({ name })
      .where(and(eq(tags.id, id), eq(tags.userId, userId)))
      .returning();

    if (updatedTag) {
      // Update all UTM links that use this tag
      const userUtmLinks = await db.select().from(utmLinks).where(eq(utmLinks.userId, userId));
      
      for (const link of userUtmLinks) {
        if (link.tags && link.tags.includes(oldTag.name)) {
          const updatedTags = link.tags.map(tag => tag === oldTag.name ? name : tag);
          await db.update(utmLinks)
            .set({ tags: updatedTags })
            .where(eq(utmLinks.id, link.id));
        }
      }
    }

    return updatedTag || undefined;
  }

  async deleteTag(id: number, userId: number): Promise<boolean> {
    // First, remove the tag from all UTM links
    const userUtmLinks = await db.select().from(utmLinks).where(eq(utmLinks.userId, userId));
    
    for (const link of userUtmLinks) {
      if (link.tags && link.tags.length > 0) {
        // Get the tag name to remove
        const [tagToDelete] = await db.select().from(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
        if (tagToDelete) {
          const updatedTags = link.tags.filter(tag => tag !== tagToDelete.name);
          await db.update(utmLinks)
            .set({ tags: updatedTags })
            .where(eq(utmLinks.id, link.id));
        }
      }
    }

    // Then delete the tag itself
    const result = await db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
    return (result.rowCount ?? 0) > 0;
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

  async getAllCampaignLandingPages(userId: number, includeArchived = false): Promise<CampaignLandingPage[]> {
    return await db.select().from(campaignLandingPages)
      .where(and(
        eq(campaignLandingPages.userId, userId),
        includeArchived ? undefined : eq(campaignLandingPages.isArchived, false)
      ))
      .orderBy(desc(campaignLandingPages.createdAt));
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

  async createUserUtmContent(insertUserContent: InsertUserUtmContent): Promise<UserUtmContent> {
    const [userContent] = await db
      .insert(userUtmContent)
      .values(insertUserContent)
      .returning();
    return userContent;
  }

  async getUserUtmContentsBySourceMedium(userId: number, utmSource: string, utmMedium: string, includeArchived = false): Promise<UserUtmContent[]> {
    return await db.select().from(userUtmContent)
      .where(and(
        eq(userUtmContent.userId, userId),
        eq(userUtmContent.utmSource, utmSource),
        eq(userUtmContent.utmMedium, utmMedium),
        includeArchived ? undefined : eq(userUtmContent.isArchived, false)
      ));
  }

  async archiveUserUtmContent(id: number, userId: number): Promise<boolean> {
    const result = await db.update(userUtmContent)
      .set({ isArchived: true })
      .where(and(eq(userUtmContent.id, id), eq(userUtmContent.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async unarchiveUserUtmContent(id: number, userId: number): Promise<boolean> {
    const result = await db.update(userUtmContent)
      .set({ isArchived: false })
      .where(and(eq(userUtmContent.id, id), eq(userUtmContent.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteUserUtmContent(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(userUtmContent)
      .where(and(eq(userUtmContent.id, id), eq(userUtmContent.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getAllUniqueUrls(userId: number): Promise<string[]> {
    // Get URLs from campaign landing pages (user's own data)
    const landingPageUrls = await db
      .selectDistinct({ url: campaignLandingPages.url })
      .from(campaignLandingPages)
      .where(eq(campaignLandingPages.userId, userId));

    // Get target URLs from UTM links (user's own data)  
    const utmUrls = await db
      .selectDistinct({ url: utmLinks.targetUrl })
      .from(utmLinks)
      .where(eq(utmLinks.userId, userId));

    // Combine and deduplicate URLs
    const allUrls = new Set<string>();
    
    landingPageUrls.forEach(row => {
      if (row.url && row.url.trim()) {
        allUrls.add(row.url.trim());
      }
    });
    
    utmUrls.forEach(row => {
      if (row.url && row.url.trim()) {
        allUrls.add(row.url.trim());
      }
    });

    // Return as sorted array for consistent ordering
    return Array.from(allUrls).sort();
  }
}

export const storage = new DatabaseStorage();
