import { users, utmLinks, type User, type InsertUser, type UtmLink, type InsertUtmLink, type UpdateUser } from "@shared/schema";
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
}

export const storage = new DatabaseStorage();
