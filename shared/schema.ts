import { pgTable, text, serial, timestamp, boolean, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Account management tables for multi-user support
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subscriptionTier: text("subscription_tier").notNull().default("trial"), // trial, basic, pro, enterprise
  trialEndDate: timestamp("trial_end_date"),
  featureFlags: json("feature_flags").default({}), // JSON object for feature toggles
  usageLimits: json("usage_limits").default({}), // JSON object for usage limits
  createdAt: timestamp("created_at").defaultNow(),
});

export const userAccounts = pgTable("user_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  accountId: integer("account_id").references(() => accounts.id).notNull(),
  role: text("role").notNull().default("user"), // user, developer, admin, super_admin
  invitedBy: integer("invited_by").references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => accounts.id).notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("user"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  status: text("status").notNull().default("pending"), // pending, accepted, expired
  invitedBy: integer("invited_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firebaseUid: text("firebase_uid").notNull().unique(),
  email: text("email").notNull(),
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const sourceTemplates = pgTable("source_templates", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id).notNull(),
  accountId: integer("account_id").references(() => accounts.id), // nullable for backwards compatibility
  sourceName: text("source_name").notNull(),
  mediums: text("mediums").array().default([]),
  formats: text("formats").array().default([]),
  abTestingPreference: integer("ab_testing_preference").default(1), // 1: No, 2: A-B, 3: A-B-C
  isArchived: boolean("is_archived").default(false),
  archivedMediums: text("archived_mediums").array().default([]), // List of archived mediums for this source
  createdAt: timestamp("created_at").defaultNow(),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id).notNull(),
  accountId: integer("account_id").references(() => accounts.id), // nullable for backwards compatibility
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const campaignLandingPages = pgTable("campaign_landing_pages", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id).notNull(),
  accountId: integer("account_id").references(() => accounts.id), // nullable for backwards compatibility
  campaignName: text("campaign_name").notNull(),
  url: text("url").notNull(),
  label: text("label").notNull(), // User-friendly name for the URL
  isArchived: boolean("is_archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Base templates managed by developers/admins
export const baseUtmTemplates = pgTable("base_utm_templates", {
  id: serial("id").primaryKey(),
  utmSource: text("utm_source").notNull(),
  utmMedium: text("utm_medium").notNull(),
  utmContent: text("utm_content").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// User-specific template copies (created on account setup)
export const userUtmTemplates = pgTable("user_utm_templates", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id).notNull(),
  accountId: integer("account_id").references(() => accounts.id), // nullable for backwards compatibility
  utmSource: text("utm_source").notNull(),
  utmMedium: text("utm_medium").notNull(),
  utmContent: text("utm_content").notNull(),
  description: text("description"),
  isArchived: boolean("is_archived").default(false),
  isCustom: boolean("is_custom").default(false), // true if user-added, false if from base template
  createdAt: timestamp("created_at").defaultNow(),
});

export const utmLinks = pgTable("utm_links", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id).notNull(),
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

// New account management schema definitions
export const insertAccountSchema = createInsertSchema(accounts).omit({
  id: true,
  createdAt: true,
});

export const insertUserAccountSchema = createInsertSchema(userAccounts).omit({
  id: true,
  joinedAt: true,
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
});

// User role enum for validation
export const userRoleSchema = z.enum(["user", "developer", "admin", "super_admin"]);
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

// New account management types
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;
export type InsertUserAccount = z.infer<typeof insertUserAccountSchema>;
export type UserAccount = typeof userAccounts.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitations.$inferSelect;
export type UserRole = z.infer<typeof userRoleSchema>;
export type SubscriptionTier = z.infer<typeof subscriptionTierSchema>;
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;
