import { users, utmLinks, sourceTemplates, type User, type InsertUser, type UtmLink, type InsertUtmLink, type SourceTemplate, type InsertSourceTemplate, type UpdateUser } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

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
  
  // Source Template operations
  createSourceTemplate(sourceTemplate: InsertSourceTemplate): Promise<SourceTemplate>;
  getUserSourceTemplates(userId: number): Promise<SourceTemplate[]>;
  updateSourceTemplate(id: number, updates: Partial<InsertSourceTemplate>): Promise<SourceTemplate | undefined>;
  deleteSourceTemplate(id: number): Promise<boolean>;
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

  async getUserUtmLinks(userId: number, limit = 20, offset = 0): Promise<UtmLink[]> {
    const userLinks = await db
      .select()
      .from(utmLinks)
      .where(eq(utmLinks.userId, userId))
      .limit(limit)
      .offset(offset)
      .orderBy(utmLinks.createdAt);
    
    return userLinks;
  }

  async getUtmLink(id: number): Promise<UtmLink | undefined> {
    const [utmLink] = await db.select().from(utmLinks).where(eq(utmLinks.id, id));
    return utmLink || undefined;
  }

  async createSourceTemplate(insertSourceTemplate: InsertSourceTemplate): Promise<SourceTemplate> {
    const [sourceTemplate] = await db
      .insert(sourceTemplates)
      .values(insertSourceTemplate)
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
    return result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();
