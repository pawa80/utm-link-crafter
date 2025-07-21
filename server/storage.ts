import { users, utmLinks, sourceTemplates, tags, campaignLandingPages, baseUtmTemplates, userUtmTemplates, baseTermTemplates, userTermTemplates, accounts, invitations, pricingPlans, type User, type InsertUser, type UtmLink, type InsertUtmLink, type SourceTemplate, type InsertSourceTemplate, type UpdateUser, type Tag, type InsertTag, type CampaignLandingPage, type InsertCampaignLandingPage, type BaseUtmTemplate, type InsertBaseUtmTemplate, type UserUtmTemplate, type InsertUserUtmTemplate, type BaseTermTemplate, type InsertBaseTermTemplate, type UserTermTemplate, type InsertUserTermTemplate, type Account, type InsertAccount, type Invitation, type InsertInvitation } from "@shared/schema";
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
  
  // Base UTM Template operations (admin/developer managed)
  getBaseUtmTemplates(): Promise<BaseUtmTemplate[]>;
  getBaseUtmContentByCombination(source: string, medium: string): Promise<BaseUtmTemplate[]>;
  
  // User UTM Template operations (user-specific copies)
  createUserUtmTemplate(template: InsertUserUtmTemplate): Promise<UserUtmTemplate>;
  getUserUtmTemplates(userId: number): Promise<UserUtmTemplate[]>;
  getUserUtmContentByCombination(userId: number, source: string, medium: string): Promise<UserUtmTemplate[]>;
  deleteUserUtmTemplate(id: number, userId: number): Promise<boolean>;
  archiveUserUtmTemplate(id: number, userId: number): Promise<boolean>;
  unarchiveUserUtmTemplate(id: number, userId: number): Promise<boolean>;
  
  // Base Term Template operations (admin/developer managed)
  getBaseTermTemplates(): Promise<BaseTermTemplate[]>;
  getBaseTermTemplatesByCategory(category?: string): Promise<BaseTermTemplate[]>;
  
  // User Term Template operations (user-specific copies)
  createUserTermTemplate(template: InsertUserTermTemplate): Promise<UserTermTemplate>;
  getUserTermTemplates(userId: number): Promise<UserTermTemplate[]>;
  getUserTermTemplatesByCategory(userId: number, category?: string): Promise<UserTermTemplate[]>;
  deleteUserTermTemplate(id: number, userId: number): Promise<boolean>;
  archiveUserTermTemplate(id: number, userId: number): Promise<boolean>;
  unarchiveUserTermTemplate(id: number, userId: number): Promise<boolean>;
  
  // User account setup
  createUserTemplatesFromBase(userId: number, accountId?: number): Promise<boolean>;
  createUserTermTemplatesFromBase(userId: number, accountId: number): Promise<boolean>;
  
  // Get all unique URLs that have been used across the account
  getAllUniqueUrls(userId: number): Promise<string[]>;
  
  // Account management operations
  createAccount(account: InsertAccount): Promise<Account>;
  getAccount(id: number): Promise<Account | undefined>;
  updateAccount(id: number, updates: Partial<InsertAccount>): Promise<Account | undefined>;
  createUserWithAccount(insertUser: Omit<InsertUser, 'accountId'>, accountName: string): Promise<{ user: User; account: Account }>;
  
  // User management operations within account
  getAccountUsers(accountId: number): Promise<User[]>;
  updateUserRole(userId: number, newRole: string): Promise<User | undefined>;
  
  // Invitation operations
  createInvitation(invitation: InsertInvitation): Promise<Invitation>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  getAccountInvitations(accountId: number): Promise<Invitation[]>;
  updateInvitationStatus(id: number, status: string): Promise<Invitation | undefined>;
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

  async getUserWithAccountAndPlan(userId: number): Promise<any> {
    const [result] = await db
      .select()
      .from(users)
      .innerJoin(accounts, eq(users.accountId, accounts.id))
      .leftJoin(pricingPlans, eq(accounts.pricingPlanId, pricingPlans.id))
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!result) return undefined;
    
    // Restructure the result to match expected format
    return {
      id: result.users.id,
      firebaseUid: result.users.firebaseUid,
      displayName: result.users.displayName,
      email: result.users.email,
      accountId: result.users.accountId,
      role: result.users.role,
      account: {
        id: result.accounts.id,
        name: result.accounts.name,
        pricingPlanId: result.accounts.pricing_plan_id,
        pricingPlan: result.pricing_plans ? {
          id: result.pricing_plans.id,
          planName: result.pricing_plans.plan_name,
          features: result.pricing_plans.features
        } : null
      }
    };
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createUserWithAccount(insertUser: Omit<InsertUser, 'accountId'>, accountName: string): Promise<{ user: User; account: Account }> {
    // Create account first
    const account = await this.createAccount({
      name: accountName,
      subscriptionTier: "trial",
      trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
    });

    // Create user with the account
    const user = await this.createUser({
      ...insertUser,
      accountId: account.id,
      role: "super_admin" // First user in account is super_admin
    });

    return { user, account };
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

  // Base UTM Template operations
  async getBaseUtmTemplates(): Promise<BaseUtmTemplate[]> {
    return await db.select().from(baseUtmTemplates).where(eq(baseUtmTemplates.isActive, true));
  }

  async getBaseUtmContentByCombination(source: string, medium: string): Promise<BaseUtmTemplate[]> {
    return await db.select().from(baseUtmTemplates)
      .where(and(
        eq(baseUtmTemplates.utmSource, source),
        eq(baseUtmTemplates.utmMedium, medium),
        eq(baseUtmTemplates.isActive, true)
      ));
  }

  // User UTM Template operations  
  async createUserUtmTemplate(template: InsertUserUtmTemplate): Promise<UserUtmTemplate> {
    const [userTemplate] = await db
      .insert(userUtmTemplates)
      .values(template)
      .returning();
    return userTemplate;
  }

  async getUserUtmTemplates(userId: number): Promise<UserUtmTemplate[]> {
    return await db.select().from(userUtmTemplates)
      .where(and(
        eq(userUtmTemplates.userId, userId),
        eq(userUtmTemplates.isArchived, false)
      ));
  }

  async getUserUtmContentByCombination(userId: number, source: string, medium: string): Promise<UserUtmTemplate[]> {
    return await db.select().from(userUtmTemplates)
      .where(and(
        eq(userUtmTemplates.userId, userId),
        eq(userUtmTemplates.utmSource, source),
        eq(userUtmTemplates.utmMedium, medium),
        eq(userUtmTemplates.isArchived, false)
      ));
  }

  async deleteUserUtmTemplate(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(userUtmTemplates)
      .where(and(eq(userUtmTemplates.id, id), eq(userUtmTemplates.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async archiveUserUtmTemplate(id: number, userId: number): Promise<boolean> {
    const result = await db.update(userUtmTemplates)
      .set({ isArchived: true })
      .where(and(eq(userUtmTemplates.id, id), eq(userUtmTemplates.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async unarchiveUserUtmTemplate(id: number, userId: number): Promise<boolean> {
    const result = await db.update(userUtmTemplates)
      .set({ isArchived: false })
      .where(and(eq(userUtmTemplates.id, id), eq(userUtmTemplates.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Base Term Template operations
  async getBaseTermTemplates(): Promise<BaseTermTemplate[]> {
    return await db.select().from(baseTermTemplates);
  }

  async getBaseTermTemplatesByCategory(category?: string): Promise<BaseTermTemplate[]> {
    if (category) {
      return await db.select().from(baseTermTemplates)
        .where(eq(baseTermTemplates.category, category));
    }
    return await this.getBaseTermTemplates();
  }

  // User Term Template operations
  async createUserTermTemplate(template: InsertUserTermTemplate): Promise<UserTermTemplate> {
    const [userTermTemplate] = await db
      .insert(userTermTemplates)
      .values(template)
      .returning();
    return userTermTemplate;
  }

  async getUserTermTemplates(userId: number): Promise<UserTermTemplate[]> {
    return await db.select().from(userTermTemplates)
      .where(and(
        eq(userTermTemplates.userId, userId),
        eq(userTermTemplates.isArchived, false)
      ));
  }

  async getUserTermTemplatesByCategory(userId: number, category?: string): Promise<UserTermTemplate[]> {
    const conditions = [
      eq(userTermTemplates.userId, userId),
      eq(userTermTemplates.isArchived, false)
    ];
    
    if (category) {
      conditions.push(eq(userTermTemplates.category, category));
    }
    
    return await db.select().from(userTermTemplates)
      .where(and(...conditions));
  }

  async deleteUserTermTemplate(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(userTermTemplates)
      .where(and(eq(userTermTemplates.id, id), eq(userTermTemplates.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async archiveUserTermTemplate(id: number, userId: number): Promise<boolean> {
    const result = await db.update(userTermTemplates)
      .set({ isArchived: true })
      .where(and(eq(userTermTemplates.id, id), eq(userTermTemplates.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async unarchiveUserTermTemplate(id: number, userId: number): Promise<boolean> {
    const result = await db.update(userTermTemplates)
      .set({ isArchived: false })
      .where(and(eq(userTermTemplates.id, id), eq(userTermTemplates.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  // User account setup - creates user template copies from base templates
  async createUserTemplatesFromBase(userId: number, accountId?: number): Promise<boolean> {
    try {
      // Get default account if not provided
      if (!accountId) {
        const defaultAccount = await this.getDefaultAccountForUser(userId);
        if (!defaultAccount) {
          console.error('No default account found for user');
          return false;
        }
        accountId = defaultAccount.id;
      }
      
      // Get all active base templates
      const baseTemplates = await this.getBaseUtmTemplates();
      
      // Create user template copies
      const userTemplateInserts = baseTemplates.map(base => ({
        userId,
        accountId: accountId!, // ensure it's not undefined
        utmSource: base.utmSource,
        utmMedium: base.utmMedium,
        utmContent: base.utmContent,
        description: base.description,
        isArchived: false,
        isCustom: false // false because it's from base template
      }));

      if (userTemplateInserts.length > 0) {
        await db.insert(userUtmTemplates).values(userTemplateInserts);
      }

      return true;
    } catch (error) {
      console.error('Error creating user templates from base:', error);
      return false;
    }
  }

  // Creates user term template copies from base term templates
  async createUserTermTemplatesFromBase(userId: number, accountId: number): Promise<boolean> {
    try {
      // Get all base term templates
      const baseTermTemplates = await this.getBaseTermTemplates();
      
      // Create user term template copies
      const userTermTemplateInserts = baseTermTemplates.map(base => ({
        userId,
        accountId,
        termValue: base.termValue,
        description: base.description,
        category: base.category,
        isArchived: false,
        isCustom: false // false because it's from base template
      }));

      if (userTermTemplateInserts.length > 0) {
        await db.insert(userTermTemplates).values(userTermTemplateInserts);
      }

      return true;
    } catch (error) {
      console.error('Error creating user term templates from base:', error);
      return false;
    }
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

  // Account management operations
  async createAccount(account: InsertAccount): Promise<Account> {
    const [newAccount] = await db
      .insert(accounts)
      .values(account)
      .returning();
    return newAccount;
  }

  async getAccount(id: number): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    return account || undefined;
  }

  async updateAccount(id: number, updates: Partial<InsertAccount>): Promise<Account | undefined> {
    const [updatedAccount] = await db
      .update(accounts)
      .set(updates)
      .where(eq(accounts.id, id))
      .returning();
    return updatedAccount || undefined;
  }

  async getUserAccount(userId: number): Promise<Account | undefined> {
    // User belongs to ONE account only - get it directly from user table
    const [user] = await db
      .select({ 
        account: accounts 
      })
      .from(users)
      .innerJoin(accounts, eq(users.accountId, accounts.id))
      .where(eq(users.id, userId));
    
    return user?.account;
  }

  // User account operations (simplified - users belong to ONE account only)
  async getAccountUsers(accountId: number): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.accountId, accountId));
  }

  async updateUserRole(userId: number, role: string): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser || undefined;
  }

  async removeUserFromAccount(userId: number): Promise<boolean> {
    // In this model, removing a user from account means deleting the user
    // Or we could set accountId to null if we want to keep user data
    const result = await db
      .delete(users)
      .where(eq(users.id, userId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Invitation operations
  async createInvitation(invitation: InsertInvitation): Promise<Invitation> {
    const [newInvitation] = await db
      .insert(invitations)
      .values(invitation)
      .returning();
    return newInvitation;
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token));
    return invitation || undefined;
  }

  async getAccountInvitations(accountId: number): Promise<Invitation[]> {
    return await db
      .select()
      .from(invitations)
      .where(eq(invitations.accountId, accountId))
      .orderBy(desc(invitations.createdAt));
  }

  async updateInvitationStatus(id: number, status: string): Promise<Invitation | undefined> {
    const [updatedInvitation] = await db
      .update(invitations)
      .set({ status })
      .where(eq(invitations.id, id))
      .returning();
    return updatedInvitation || undefined;
  }

  // User context operations (simplified for single account model)
  async getUserWithAccount(userId: number): Promise<(User & { account: Account }) | undefined> {
    const [userData] = await db
      .select({
        id: users.id,
        firebaseUid: users.firebaseUid,
        email: users.email,
        accountId: users.accountId,
        role: users.role,
        invitedBy: users.invitedBy,
        joinedAt: users.joinedAt,
        createdAt: users.createdAt,
        categories: users.categories,
        defaultSources: users.defaultSources,
        defaultMediums: users.defaultMediums,
        defaultCampaignNames: users.defaultCampaignNames,
        isSetupComplete: users.isSetupComplete,
        showCampaignTerm: users.showCampaignTerm,
        showInternalCampaignId: users.showInternalCampaignId,
        showCategory: users.showCategory,
        showCustomFields: users.showCustomFields,
        customField1Name: users.customField1Name,
        customField1InUrl: users.customField1InUrl,
        customField1Options: users.customField1Options,
        customField2Name: users.customField2Name,
        customField2InUrl: users.customField2InUrl,
        customField2Options: users.customField2Options,
        customField3Name: users.customField3Name,
        customField3InUrl: users.customField3InUrl,
        customField3Options: users.customField3Options,
        account: accounts
      })
      .from(users)
      .innerJoin(accounts, eq(users.accountId, accounts.id))
      .where(eq(users.id, userId));
    
    return userData || undefined;
  }

  async getDefaultAccountForUser(userId: number): Promise<Account | undefined> {
    // In single account model, just get the user's account
    return this.getUserAccount(userId);
  }
}

export const storage = new DatabaseStorage();
