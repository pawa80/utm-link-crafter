import { pgTable, text, serial, timestamp, boolean, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Vendor User System - Platform Administration
export const vendorUsers = pgTable("vendor_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("vendor_admin"), // vendor_admin, vendor_super_admin
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vendorSessions = pgTable("vendor_sessions", {
  id: serial("id").primaryKey(),
  vendorUserId: integer("vendor_user_id").references(() => vendorUsers.id).notNull(),
  sessionToken: text("session_token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pricing Plans for Dynamic Plan Management
export const pricingPlans = pgTable("pricing_plans", {
  id: serial("id").primaryKey(),
  planCode: text("plan_code").notNull().unique(),
  planName: text("plan_name").notNull(),
  description: text("description"),
  monthlyPriceCents: integer("monthly_price_cents").notNull(),
  annualPriceCents: integer("annual_price_cents"),
  trialDays: integer("trial_days").default(14),
  maxCampaigns: integer("max_campaigns"), // null = unlimited
  maxUsers: integer("max_users"),
  maxUtmLinks: integer("max_utm_links"), // null = unlimited
  features: json("features").notNull().default({}), // Feature flags
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Account management tables for multi-user support
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subscriptionTier: text("subscription_tier").notNull().default("trial"), // trial, basic, pro, enterprise
  pricingPlanId: integer("pricing_plan_id").references(() => pricingPlans.id),
  accountStatus: text("account_status").notNull().default("active"), // active, suspended, cancelled, trial
  statusReason: text("status_reason"),
  statusChangedAt: timestamp("status_changed_at"),
  statusChangedBy: integer("status_changed_by").references(() => vendorUsers.id),
  trialEndDate: timestamp("trial_end_date"),
  featureFlags: json("feature_flags").default({}), // JSON object for feature toggles
  usageLimits: json("usage_limits").default({}), // JSON object for usage limits
  // Profile data from sign-up wizard
  industry: text("industry"), // E-commerce, SaaS/Technology, Marketing Agency, etc.
  teamSize: text("team_size"), // Just me (1), Small team (2-5), etc.
  useCases: text("use_cases").array().default([]), // Multiple use cases: Campaign tracking, A/B testing, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Account Status History for Audit Trail
export const accountStatusHistory = pgTable("account_status_history", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => accounts.id).notNull(),
  oldStatus: text("old_status"),
  newStatus: text("new_status").notNull(),
  reason: text("reason"),
  changedBy: integer("changed_by").references(() => vendorUsers.id).notNull(),
  changedAt: timestamp("changed_at").defaultNow(),
});

// REMOVED: userAccounts table - users now belong to ONE account only

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firebaseUid: text("firebase_uid").notNull().unique(),
  email: text("email").notNull(),
  accountId: integer("account_id").references(() => accounts.id).notNull(), // User belongs to ONE account
  role: text("role").notNull().default("viewer"), // viewer, editor, admin, super_admin
  invitedBy: integer("invited_by").references(() => users.id), // Who invited this user
  categories: text("categories").array().default([]),
  defaultSources: text("default_sources").array().default([]),
  defaultMediums: text("default_mediums").array().default([]),
  defaultCampaignNames: text("default_campaign_names").array().default([]),
  isSetupComplete: boolean("is_setup_complete").default(false),
  showCampaignTerm: boolean("show_campaign_term").default(true),
  showInternalCampaignId: boolean("show_internal_campaign_id").default(true),
  showCategory: boolean("show_category").default(true),
  showCustomFields: boolean("show_custom_fields").default(false),
  customField1Name: text("custom_field_1_name"),
  customField1InUrl: boolean("custom_field_1_in_url").default(false),
  customField1Options: text("custom_field_1_options").array(),
  customField2Name: text("custom_field_2_name"),
  customField2InUrl: boolean("custom_field_2_in_url").default(false),
  customField2Options: text("custom_field_2_options").array(),
  customField3Name: text("custom_field_3_name"),
  customField3InUrl: boolean("custom_field_3_in_url").default(false),
  customField3Options: text("custom_field_3_options").array(),
  joinedAt: timestamp("joined_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => accounts.id).notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("viewer"), // viewer, editor, admin, super_admin
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  status: text("status").notNull().default("pending"), // pending, accepted, expired
  invitedBy: integer("invited_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sourceTemplates = pgTable("source_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  accountId: integer("account_id").references(() => accounts.id), // nullable for backwards compatibility
  sourceName: text("source_name").notNull(),
  mediums: text("mediums").array().default([]),
  formats: text("formats").array().default([]),
  abTestingPreference: integer("ab_testing_preference").default(1), // 1: No, 2: A-B, 3: A-B-C
  isArchived: boolean("is_archived").default(false),
  archivedMediums: text("archived_mediums").array().default([]), // List of archived mediums for this source
  vendorManaged: boolean("vendor_managed").default(false), // true for base templates copied to users
  type: text("type", { enum: ["Base", "Custom"] }).default("Custom"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  accountId: integer("account_id").references(() => accounts.id), // nullable for backwards compatibility
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const campaignLandingPages = pgTable("campaign_landing_pages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  accountId: integer("account_id").references(() => accounts.id), // nullable for backwards compatibility
  campaignName: text("campaign_name").notNull(),
  url: text("url").notNull(),
  label: text("label").notNull(), // User-friendly name for the URL
  isArchived: boolean("is_archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Base templates managed by vendor users
export const baseUtmTemplates = pgTable("base_utm_templates", {
  id: serial("id").primaryKey(),
  utmSource: text("utm_source").notNull(),
  utmMedium: text("utm_medium").notNull(),
  utmContent: text("utm_content").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  vendorManaged: boolean("vendor_managed").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// User-specific template copies (created on account setup)
export const userUtmTemplates = pgTable("user_utm_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  accountId: integer("account_id").references(() => accounts.id), // nullable for backwards compatibility
  utmSource: text("utm_source").notNull(),
  utmMedium: text("utm_medium").notNull(),
  utmContent: text("utm_content").notNull(),
  description: text("description"),
  isArchived: boolean("is_archived").default(false),
  isCustom: boolean("is_custom").default(false), // true if user-added, false if from base template
  type: text("type", { enum: ["Base", "Custom"] }).default("Custom"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Term Templates - Similar to content templates for utm_term parameter
export const baseTermTemplates = pgTable("base_term_templates", {
  id: serial("id").primaryKey(),
  termValue: text("term_value").notNull(),
  description: text("description"), // Optional description for the term
  category: text("category").default("general"), // general, keywords, testing, audience
  vendorManaged: boolean("vendor_managed").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userTermTemplates = pgTable("user_term_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  accountId: integer("account_id").references(() => accounts.id).notNull(),
  termValue: text("term_value").notNull(),
  description: text("description"),
  category: text("category").default("general"),
  isCustom: boolean("is_custom").default(false),
  isArchived: boolean("is_archived").default(false),
  type: text("type", { enum: ["Base", "Custom"] }).default("Custom"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const utmLinks = pgTable("utm_links", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  accountId: integer("account_id").references(() => accounts.id), // nullable for backwards compatibility
  targetUrl: text("target_url").notNull(),
  utm_campaign: text("utm_campaign").notNull(),
  utm_source: text("utm_source").notNull(),
  utm_medium: text("utm_medium").notNull(),
  utm_content: text("utm_content"),
  utm_term: text("utm_term"),
  fullUtmLink: text("full_utm_link").notNull(),
  category: text("category"),
  internalCampaignId: text("internal_campaign_id"),
  customField1Value: text("custom_field_1_value"),
  customField2Value: text("custom_field_2_value"),
  customField3Value: text("custom_field_3_value"),
  tags: text("tags").array().default([]), // Array of tag names associated with this campaign
  isArchived: boolean("is_archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  joinedAt: true,
}).partial({
  accountId: true, // Make accountId optional for initial user creation
  role: true,
  invitedBy: true,
  categories: true,
  defaultSources: true,
  defaultMediums: true,
  defaultCampaignNames: true,
  isSetupComplete: true,
  showCampaignTerm: true,
  showInternalCampaignId: true,
  showCategory: true,
  showCustomFields: true,
  customField1Name: true,
  customField1InUrl: true,
  customField1Options: true,
  customField2Name: true,
  customField2InUrl: true,
  customField2Options: true,
  customField3Name: true,
  customField3InUrl: true,
  customField3Options: true,
}).extend({
  // Additional sign-up fields
  accountName: z.string().optional(),
  pricingPlanId: z.number().optional(),
  industry: z.string().optional(),
  teamSize: z.string().optional(),
  useCases: z.array(z.string()).optional(),
});

export const insertUtmLinkSchema = createInsertSchema(utmLinks).omit({
  id: true,
  createdAt: true,
});

export const updateUserSchema = createInsertSchema(users).omit({
  id: true,
  firebaseUid: true,
  createdAt: true,
}).partial();

export const insertSourceTemplateSchema = createInsertSchema(sourceTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  userId: true,
  accountId: true,
  createdAt: true,
});

export const insertCampaignLandingPageSchema = createInsertSchema(campaignLandingPages).omit({
  id: true,
  createdAt: true,
});

export const insertBaseUtmTemplateSchema = createInsertSchema(baseUtmTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertUserUtmTemplateSchema = createInsertSchema(userUtmTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertBaseTermTemplateSchema = createInsertSchema(baseTermTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertUserTermTemplateSchema = createInsertSchema(userTermTemplates).omit({
  id: true,
  createdAt: true,
});

// New account management schema definitions
export const insertAccountSchema = createInsertSchema(accounts).omit({
  id: true,
  createdAt: true,
});

// REMOVED: insertUserAccountSchema - no longer needed

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
});

// User role enum for validation (updated to match new hierarchy)
export const userRoleSchema = z.enum(["viewer", "editor", "admin", "super_admin"]);
export const subscriptionTierSchema = z.enum(["trial", "basic", "pro", "enterprise"]);
export const invitationStatusSchema = z.enum(["pending", "accepted", "expired"]);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUtmLink = z.infer<typeof insertUtmLinkSchema>;
export type UtmLink = typeof utmLinks.$inferSelect;
export type InsertSourceTemplate = z.infer<typeof insertSourceTemplateSchema>;
export type SourceTemplate = typeof sourceTemplates.$inferSelect;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tags.$inferSelect;
export type InsertCampaignLandingPage = z.infer<typeof insertCampaignLandingPageSchema>;
export type CampaignLandingPage = typeof campaignLandingPages.$inferSelect;
export type InsertBaseUtmTemplate = z.infer<typeof insertBaseUtmTemplateSchema>;
export type BaseUtmTemplate = typeof baseUtmTemplates.$inferSelect;
export type InsertUserUtmTemplate = z.infer<typeof insertUserUtmTemplateSchema>;
export type UserUtmTemplate = typeof userUtmTemplates.$inferSelect;
export type InsertBaseTermTemplate = z.infer<typeof insertBaseTermTemplateSchema>;
export type BaseTermTemplate = typeof baseTermTemplates.$inferSelect;
export type InsertUserTermTemplate = z.infer<typeof insertUserTermTemplateSchema>;
export type UserTermTemplate = typeof userTermTemplates.$inferSelect;

// Vendor System Schema Definitions
export const insertVendorUserSchema = createInsertSchema(vendorUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVendorSessionSchema = createInsertSchema(vendorSessions).omit({
  id: true,
  createdAt: true,
});

export const insertPricingPlanSchema = createInsertSchema(pricingPlans).omit({
  id: true,
  createdAt: true,
});

export const insertAccountStatusHistorySchema = createInsertSchema(accountStatusHistory).omit({
  id: true,
  changedAt: true,
});

// Updated account schema with new fields
export const updateAccountSchema = createInsertSchema(accounts).omit({
  id: true,
  createdAt: true,
}).partial();

// Vendor and Account Status enums for validation
export const vendorRoleSchema = z.enum(["vendor_admin", "vendor_super_admin"]);
export const accountStatusSchema = z.enum(["active", "suspended", "cancelled", "trial"]);

// Vendor System Types
export type InsertVendorUser = z.infer<typeof insertVendorUserSchema>;
export type VendorUser = typeof vendorUsers.$inferSelect;
export type InsertVendorSession = z.infer<typeof insertVendorSessionSchema>;
export type VendorSession = typeof vendorSessions.$inferSelect;
export type InsertPricingPlan = z.infer<typeof insertPricingPlanSchema>;
export type PricingPlan = typeof pricingPlans.$inferSelect;
export type InsertAccountStatusHistory = z.infer<typeof insertAccountStatusHistorySchema>;
export type AccountStatusHistory = typeof accountStatusHistory.$inferSelect;
export type VendorRole = z.infer<typeof vendorRoleSchema>;
export type AccountStatus = z.infer<typeof accountStatusSchema>;
export type UpdateAccount = z.infer<typeof updateAccountSchema>;

// New account management types
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;
// REMOVED: UserAccount types - users now belong to ONE account only
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitations.$inferSelect;
export type UserRole = z.infer<typeof userRoleSchema>;
export type SubscriptionTier = z.infer<typeof subscriptionTierSchema>;
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;
