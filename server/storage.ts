import { users, utmLinks, type User, type InsertUser, type UtmLink, type InsertUtmLink, type UpdateUser } from "@shared/schema";

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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private utmLinks: Map<number, UtmLink>;
  private currentUserId: number;
  private currentUtmLinkId: number;

  constructor() {
    this.users = new Map();
    this.utmLinks = new Map();
    this.currentUserId = 1;
    this.currentUtmLinkId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.firebaseUid === firebaseUid,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...insertUser, 
      id,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: UpdateUser): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async createUtmLink(insertUtmLink: InsertUtmLink): Promise<UtmLink> {
    const id = this.currentUtmLinkId++;
    const utmLink: UtmLink = {
      ...insertUtmLink,
      id,
      createdAt: new Date(),
    };
    this.utmLinks.set(id, utmLink);
    return utmLink;
  }

  async getUserUtmLinks(userId: number, limit = 20, offset = 0): Promise<UtmLink[]> {
    const userLinks = Array.from(this.utmLinks.values())
      .filter(link => link.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(offset, offset + limit);
    
    return userLinks;
  }

  async getUtmLink(id: number): Promise<UtmLink | undefined> {
    return this.utmLinks.get(id);
  }
}

export const storage = new MemStorage();
