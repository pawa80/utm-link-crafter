var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  accountStatusHistory: () => accountStatusHistory,
  accountStatusSchema: () => accountStatusSchema,
  accounts: () => accounts,
  baseTermTemplates: () => baseTermTemplates,
  baseUtmTemplates: () => baseUtmTemplates,
  campaignLandingPages: () => campaignLandingPages,
  insertAccountSchema: () => insertAccountSchema,
  insertAccountStatusHistorySchema: () => insertAccountStatusHistorySchema,
  insertBaseTermTemplateSchema: () => insertBaseTermTemplateSchema,
  insertBaseUtmTemplateSchema: () => insertBaseUtmTemplateSchema,
  insertCampaignLandingPageSchema: () => insertCampaignLandingPageSchema,
  insertInvitationSchema: () => insertInvitationSchema,
  insertPricingPlanSchema: () => insertPricingPlanSchema,
  insertSourceTemplateSchema: () => insertSourceTemplateSchema,
  insertTagSchema: () => insertTagSchema,
  insertUserSchema: () => insertUserSchema,
  insertUserTermTemplateSchema: () => insertUserTermTemplateSchema,
  insertUserUtmTemplateSchema: () => insertUserUtmTemplateSchema,
  insertUtmLinkSchema: () => insertUtmLinkSchema,
  insertVendorSessionSchema: () => insertVendorSessionSchema,
  insertVendorUserSchema: () => insertVendorUserSchema,
  invitationStatusSchema: () => invitationStatusSchema,
  invitations: () => invitations,
  pricingPlans: () => pricingPlans,
  sourceTemplates: () => sourceTemplates,
  subscriptionTierSchema: () => subscriptionTierSchema,
  tags: () => tags,
  updateAccountSchema: () => updateAccountSchema,
  updateUserSchema: () => updateUserSchema,
  userRoleSchema: () => userRoleSchema,
  userTermTemplates: () => userTermTemplates,
  userUtmTemplates: () => userUtmTemplates,
  users: () => users,
  utmLinks: () => utmLinks,
  vendorRoleSchema: () => vendorRoleSchema,
  vendorSessions: () => vendorSessions,
  vendorUsers: () => vendorUsers
});
import { pgTable, text, serial, timestamp, boolean, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var vendorUsers, vendorSessions, pricingPlans, accounts, accountStatusHistory, users, invitations, sourceTemplates, tags, campaignLandingPages, baseUtmTemplates, userUtmTemplates, baseTermTemplates, userTermTemplates, utmLinks, insertUserSchema, insertUtmLinkSchema, updateUserSchema, insertSourceTemplateSchema, insertTagSchema, insertCampaignLandingPageSchema, insertBaseUtmTemplateSchema, insertUserUtmTemplateSchema, insertBaseTermTemplateSchema, insertUserTermTemplateSchema, insertAccountSchema, insertInvitationSchema, userRoleSchema, subscriptionTierSchema, invitationStatusSchema, insertVendorUserSchema, insertVendorSessionSchema, insertPricingPlanSchema, insertAccountStatusHistorySchema, updateAccountSchema, vendorRoleSchema, accountStatusSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    vendorUsers = pgTable("vendor_users", {
      id: serial("id").primaryKey(),
      email: text("email").notNull().unique(),
      passwordHash: text("password_hash").notNull(),
      fullName: text("full_name").notNull(),
      role: text("role").notNull().default("vendor_admin"),
      // vendor_admin, vendor_super_admin
      isActive: boolean("is_active").default(true),
      lastLogin: timestamp("last_login"),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    vendorSessions = pgTable("vendor_sessions", {
      id: serial("id").primaryKey(),
      vendorUserId: integer("vendor_user_id").references(() => vendorUsers.id).notNull(),
      sessionToken: text("session_token").notNull().unique(),
      expiresAt: timestamp("expires_at").notNull(),
      ipAddress: text("ip_address"),
      userAgent: text("user_agent"),
      createdAt: timestamp("created_at").defaultNow()
    });
    pricingPlans = pgTable("pricing_plans", {
      id: serial("id").primaryKey(),
      planCode: text("plan_code").notNull().unique(),
      planName: text("plan_name").notNull(),
      description: text("description"),
      monthlyPriceCents: integer("monthly_price_cents").notNull(),
      annualPriceCents: integer("annual_price_cents"),
      trialDays: integer("trial_days").default(14),
      maxCampaigns: integer("max_campaigns"),
      // null = unlimited
      maxUsers: integer("max_users"),
      maxUtmLinks: integer("max_utm_links"),
      // null = unlimited
      features: json("features").notNull().default({}),
      // Feature flags
      isActive: boolean("is_active").default(true),
      sortOrder: integer("sort_order").default(0),
      createdAt: timestamp("created_at").defaultNow()
    });
    accounts = pgTable("accounts", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      subscriptionTier: text("subscription_tier").notNull().default("trial"),
      // trial, basic, pro, enterprise
      pricingPlanId: integer("pricing_plan_id").references(() => pricingPlans.id),
      accountStatus: text("account_status").notNull().default("active"),
      // active, suspended, cancelled, trial
      statusReason: text("status_reason"),
      statusChangedAt: timestamp("status_changed_at"),
      statusChangedBy: integer("status_changed_by").references(() => vendorUsers.id),
      trialEndDate: timestamp("trial_end_date"),
      featureFlags: json("feature_flags").default({}),
      // JSON object for feature toggles
      usageLimits: json("usage_limits").default({}),
      // JSON object for usage limits
      // Profile data from sign-up wizard
      industry: text("industry"),
      // E-commerce, SaaS/Technology, Marketing Agency, etc.
      teamSize: text("team_size"),
      // Just me (1), Small team (2-5), etc.
      useCases: text("use_cases").array().default([]),
      // Multiple use cases: Campaign tracking, A/B testing, etc.
      createdAt: timestamp("created_at").defaultNow()
    });
    accountStatusHistory = pgTable("account_status_history", {
      id: serial("id").primaryKey(),
      accountId: integer("account_id").references(() => accounts.id).notNull(),
      oldStatus: text("old_status"),
      newStatus: text("new_status").notNull(),
      reason: text("reason"),
      changedBy: integer("changed_by").references(() => vendorUsers.id).notNull(),
      changedAt: timestamp("changed_at").defaultNow()
    });
    users = pgTable("users", {
      id: serial("id").primaryKey(),
      firebaseUid: text("firebase_uid").notNull().unique(),
      email: text("email").notNull(),
      accountId: integer("account_id").references(() => accounts.id).notNull(),
      // User belongs to ONE account
      role: text("role").notNull().default("viewer"),
      // viewer, editor, admin, super_admin
      invitedBy: integer("invited_by").references(() => users.id),
      // Who invited this user
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
      createdAt: timestamp("created_at").defaultNow()
    });
    invitations = pgTable("invitations", {
      id: serial("id").primaryKey(),
      accountId: integer("account_id").references(() => accounts.id).notNull(),
      email: text("email").notNull(),
      role: text("role").notNull().default("viewer"),
      // viewer, editor, admin, super_admin
      token: text("token").notNull().unique(),
      expiresAt: timestamp("expires_at").notNull(),
      status: text("status").notNull().default("pending"),
      // pending, accepted, expired
      invitedBy: integer("invited_by").references(() => users.id).notNull(),
      createdAt: timestamp("created_at").defaultNow()
    });
    sourceTemplates = pgTable("source_templates", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").references(() => users.id).notNull(),
      accountId: integer("account_id").references(() => accounts.id),
      // nullable for backwards compatibility
      sourceName: text("source_name").notNull(),
      mediums: text("mediums").array().default([]),
      formats: text("formats").array().default([]),
      abTestingPreference: integer("ab_testing_preference").default(1),
      // 1: No, 2: A-B, 3: A-B-C
      isArchived: boolean("is_archived").default(false),
      archivedMediums: text("archived_mediums").array().default([]),
      // List of archived mediums for this source
      vendorManaged: boolean("vendor_managed").default(false),
      // true for base templates copied to users
      type: text("type", { enum: ["Base", "Custom"] }).default("Custom"),
      createdAt: timestamp("created_at").defaultNow()
    });
    tags = pgTable("tags", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").references(() => users.id).notNull(),
      accountId: integer("account_id").references(() => accounts.id),
      // nullable for backwards compatibility
      name: text("name").notNull(),
      createdAt: timestamp("created_at").defaultNow()
    });
    campaignLandingPages = pgTable("campaign_landing_pages", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").references(() => users.id).notNull(),
      accountId: integer("account_id").references(() => accounts.id),
      // nullable for backwards compatibility
      campaignName: text("campaign_name").notNull(),
      url: text("url").notNull(),
      label: text("label").notNull(),
      // User-friendly name for the URL
      isArchived: boolean("is_archived").default(false),
      createdAt: timestamp("created_at").defaultNow()
    });
    baseUtmTemplates = pgTable("base_utm_templates", {
      id: serial("id").primaryKey(),
      utmSource: text("utm_source").notNull(),
      utmMedium: text("utm_medium").notNull(),
      utmContent: text("utm_content").notNull(),
      description: text("description"),
      isActive: boolean("is_active").default(true),
      vendorManaged: boolean("vendor_managed").default(true),
      createdAt: timestamp("created_at").defaultNow()
    });
    userUtmTemplates = pgTable("user_utm_templates", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").references(() => users.id).notNull(),
      accountId: integer("account_id").references(() => accounts.id),
      // nullable for backwards compatibility
      utmSource: text("utm_source").notNull(),
      utmMedium: text("utm_medium").notNull(),
      utmContent: text("utm_content").notNull(),
      description: text("description"),
      isArchived: boolean("is_archived").default(false),
      isCustom: boolean("is_custom").default(false),
      // true if user-added, false if from base template
      type: text("type", { enum: ["Base", "Custom"] }).default("Custom"),
      createdAt: timestamp("created_at").defaultNow()
    });
    baseTermTemplates = pgTable("base_term_templates", {
      id: serial("id").primaryKey(),
      termValue: text("term_value").notNull(),
      description: text("description"),
      // Optional description for the term
      category: text("category").default("general"),
      // general, keywords, testing, audience
      vendorManaged: boolean("vendor_managed").default(true),
      createdAt: timestamp("created_at").defaultNow()
    });
    userTermTemplates = pgTable("user_term_templates", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").references(() => users.id).notNull(),
      accountId: integer("account_id").references(() => accounts.id).notNull(),
      termValue: text("term_value").notNull(),
      description: text("description"),
      category: text("category").default("general"),
      isCustom: boolean("is_custom").default(false),
      isArchived: boolean("is_archived").default(false),
      type: text("type", { enum: ["Base", "Custom"] }).default("Custom"),
      createdAt: timestamp("created_at").defaultNow()
    });
    utmLinks = pgTable("utm_links", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").references(() => users.id).notNull(),
      accountId: integer("account_id").references(() => accounts.id),
      // nullable for backwards compatibility
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
      tags: text("tags").array().default([]),
      // Array of tag names associated with this campaign
      isArchived: boolean("is_archived").default(false),
      createdAt: timestamp("created_at").defaultNow()
    });
    insertUserSchema = createInsertSchema(users).omit({
      id: true,
      createdAt: true,
      joinedAt: true
    }).partial({
      accountId: true,
      // Make accountId optional for initial user creation
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
      customField3Options: true
    }).extend({
      // Additional sign-up fields
      accountName: z.string().optional(),
      pricingPlanId: z.number().optional(),
      industry: z.string().optional(),
      teamSize: z.string().optional(),
      useCases: z.array(z.string()).optional()
    });
    insertUtmLinkSchema = createInsertSchema(utmLinks).omit({
      id: true,
      createdAt: true
    });
    updateUserSchema = createInsertSchema(users).omit({
      id: true,
      firebaseUid: true,
      createdAt: true
    }).partial();
    insertSourceTemplateSchema = createInsertSchema(sourceTemplates).omit({
      id: true,
      createdAt: true
    });
    insertTagSchema = createInsertSchema(tags).omit({
      id: true,
      userId: true,
      accountId: true,
      createdAt: true
    });
    insertCampaignLandingPageSchema = createInsertSchema(campaignLandingPages).omit({
      id: true,
      createdAt: true
    });
    insertBaseUtmTemplateSchema = createInsertSchema(baseUtmTemplates).omit({
      id: true,
      createdAt: true
    });
    insertUserUtmTemplateSchema = createInsertSchema(userUtmTemplates).omit({
      id: true,
      createdAt: true
    });
    insertBaseTermTemplateSchema = createInsertSchema(baseTermTemplates).omit({
      id: true,
      createdAt: true
    });
    insertUserTermTemplateSchema = createInsertSchema(userTermTemplates).omit({
      id: true,
      createdAt: true
    });
    insertAccountSchema = createInsertSchema(accounts).omit({
      id: true,
      createdAt: true
    });
    insertInvitationSchema = createInsertSchema(invitations).omit({
      id: true,
      createdAt: true
    });
    userRoleSchema = z.enum(["viewer", "editor", "admin", "super_admin"]);
    subscriptionTierSchema = z.enum(["trial", "basic", "pro", "enterprise"]);
    invitationStatusSchema = z.enum(["pending", "accepted", "expired"]);
    insertVendorUserSchema = createInsertSchema(vendorUsers).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertVendorSessionSchema = createInsertSchema(vendorSessions).omit({
      id: true,
      createdAt: true
    });
    insertPricingPlanSchema = createInsertSchema(pricingPlans).omit({
      id: true,
      createdAt: true
    });
    insertAccountStatusHistorySchema = createInsertSchema(accountStatusHistory).omit({
      id: true,
      changedAt: true
    });
    updateAccountSchema = createInsertSchema(accounts).omit({
      id: true,
      createdAt: true
    }).partial();
    vendorRoleSchema = z.enum(["vendor_admin", "vendor_super_admin"]);
    accountStatusSchema = z.enum(["active", "suspended", "cancelled", "trial"]);
  }
});

// server/vercel-app.ts
import express from "express";

// server/routes.js
import { createServer } from "http";

// server/storage.js
init_schema();

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

// shared/schema.js
var schema_exports2 = {};
__export(schema_exports2, {
  accountStatusHistory: () => accountStatusHistory2,
  accountStatusSchema: () => accountStatusSchema2,
  accounts: () => accounts2,
  baseTermTemplates: () => baseTermTemplates2,
  baseUtmTemplates: () => baseUtmTemplates2,
  campaignLandingPages: () => campaignLandingPages2,
  insertAccountSchema: () => insertAccountSchema2,
  insertAccountStatusHistorySchema: () => insertAccountStatusHistorySchema2,
  insertBaseTermTemplateSchema: () => insertBaseTermTemplateSchema2,
  insertBaseUtmTemplateSchema: () => insertBaseUtmTemplateSchema2,
  insertCampaignLandingPageSchema: () => insertCampaignLandingPageSchema2,
  insertInvitationSchema: () => insertInvitationSchema2,
  insertPricingPlanSchema: () => insertPricingPlanSchema2,
  insertSourceTemplateSchema: () => insertSourceTemplateSchema2,
  insertTagSchema: () => insertTagSchema2,
  insertUserSchema: () => insertUserSchema2,
  insertUserTermTemplateSchema: () => insertUserTermTemplateSchema2,
  insertUserUtmTemplateSchema: () => insertUserUtmTemplateSchema2,
  insertUtmLinkSchema: () => insertUtmLinkSchema2,
  insertVendorSessionSchema: () => insertVendorSessionSchema2,
  insertVendorUserSchema: () => insertVendorUserSchema2,
  invitationStatusSchema: () => invitationStatusSchema2,
  invitations: () => invitations2,
  pricingPlans: () => pricingPlans2,
  sourceTemplates: () => sourceTemplates2,
  subscriptionTierSchema: () => subscriptionTierSchema2,
  tags: () => tags2,
  updateAccountSchema: () => updateAccountSchema2,
  updateUserSchema: () => updateUserSchema2,
  userRoleSchema: () => userRoleSchema2,
  userTermTemplates: () => userTermTemplates2,
  userUtmTemplates: () => userUtmTemplates2,
  users: () => users2,
  utmLinks: () => utmLinks2,
  vendorRoleSchema: () => vendorRoleSchema2,
  vendorSessions: () => vendorSessions2,
  vendorUsers: () => vendorUsers2
});
import { pgTable as pgTable2, text as text2, serial as serial2, timestamp as timestamp2, boolean as boolean2, integer as integer2, json as json2 } from "drizzle-orm/pg-core";
import { createInsertSchema as createInsertSchema2 } from "drizzle-zod";
import { z as z2 } from "zod";
var vendorUsers2 = pgTable2("vendor_users", {
  id: serial2("id").primaryKey(),
  email: text2("email").notNull().unique(),
  passwordHash: text2("password_hash").notNull(),
  fullName: text2("full_name").notNull(),
  role: text2("role").notNull().default("vendor_admin"),
  // vendor_admin, vendor_super_admin
  isActive: boolean2("is_active").default(true),
  lastLogin: timestamp2("last_login"),
  createdAt: timestamp2("created_at").defaultNow(),
  updatedAt: timestamp2("updated_at").defaultNow()
});
var vendorSessions2 = pgTable2("vendor_sessions", {
  id: serial2("id").primaryKey(),
  vendorUserId: integer2("vendor_user_id").references(() => vendorUsers2.id).notNull(),
  sessionToken: text2("session_token").notNull().unique(),
  expiresAt: timestamp2("expires_at").notNull(),
  ipAddress: text2("ip_address"),
  userAgent: text2("user_agent"),
  createdAt: timestamp2("created_at").defaultNow()
});
var pricingPlans2 = pgTable2("pricing_plans", {
  id: serial2("id").primaryKey(),
  planCode: text2("plan_code").notNull().unique(),
  planName: text2("plan_name").notNull(),
  description: text2("description"),
  monthlyPriceCents: integer2("monthly_price_cents").notNull(),
  annualPriceCents: integer2("annual_price_cents"),
  trialDays: integer2("trial_days").default(14),
  maxCampaigns: integer2("max_campaigns"),
  // null = unlimited
  maxUsers: integer2("max_users"),
  maxUtmLinks: integer2("max_utm_links"),
  // null = unlimited
  features: json2("features").notNull().default({}),
  // Feature flags
  isActive: boolean2("is_active").default(true),
  sortOrder: integer2("sort_order").default(0),
  createdAt: timestamp2("created_at").defaultNow()
});
var accounts2 = pgTable2("accounts", {
  id: serial2("id").primaryKey(),
  name: text2("name").notNull(),
  subscriptionTier: text2("subscription_tier").notNull().default("trial"),
  // trial, basic, pro, enterprise
  pricingPlanId: integer2("pricing_plan_id").references(() => pricingPlans2.id),
  accountStatus: text2("account_status").notNull().default("active"),
  // active, suspended, cancelled, trial
  statusReason: text2("status_reason"),
  statusChangedAt: timestamp2("status_changed_at"),
  statusChangedBy: integer2("status_changed_by").references(() => vendorUsers2.id),
  trialEndDate: timestamp2("trial_end_date"),
  featureFlags: json2("feature_flags").default({}),
  // JSON object for feature toggles
  usageLimits: json2("usage_limits").default({}),
  // JSON object for usage limits
  // Profile data from sign-up wizard
  industry: text2("industry"),
  // E-commerce, SaaS/Technology, Marketing Agency, etc.
  teamSize: text2("team_size"),
  // Just me (1), Small team (2-5), etc.
  useCases: text2("use_cases").array().default([]),
  // Multiple use cases: Campaign tracking, A/B testing, etc.
  createdAt: timestamp2("created_at").defaultNow()
});
var accountStatusHistory2 = pgTable2("account_status_history", {
  id: serial2("id").primaryKey(),
  accountId: integer2("account_id").references(() => accounts2.id).notNull(),
  oldStatus: text2("old_status"),
  newStatus: text2("new_status").notNull(),
  reason: text2("reason"),
  changedBy: integer2("changed_by").references(() => vendorUsers2.id).notNull(),
  changedAt: timestamp2("changed_at").defaultNow()
});
var users2 = pgTable2("users", {
  id: serial2("id").primaryKey(),
  firebaseUid: text2("firebase_uid").notNull().unique(),
  email: text2("email").notNull(),
  accountId: integer2("account_id").references(() => accounts2.id).notNull(),
  // User belongs to ONE account
  role: text2("role").notNull().default("viewer"),
  // viewer, editor, admin, super_admin
  invitedBy: integer2("invited_by").references(() => users2.id),
  // Who invited this user
  categories: text2("categories").array().default([]),
  defaultSources: text2("default_sources").array().default([]),
  defaultMediums: text2("default_mediums").array().default([]),
  defaultCampaignNames: text2("default_campaign_names").array().default([]),
  isSetupComplete: boolean2("is_setup_complete").default(false),
  showCampaignTerm: boolean2("show_campaign_term").default(true),
  showInternalCampaignId: boolean2("show_internal_campaign_id").default(true),
  showCategory: boolean2("show_category").default(true),
  showCustomFields: boolean2("show_custom_fields").default(false),
  customField1Name: text2("custom_field_1_name"),
  customField1InUrl: boolean2("custom_field_1_in_url").default(false),
  customField1Options: text2("custom_field_1_options").array(),
  customField2Name: text2("custom_field_2_name"),
  customField2InUrl: boolean2("custom_field_2_in_url").default(false),
  customField2Options: text2("custom_field_2_options").array(),
  customField3Name: text2("custom_field_3_name"),
  customField3InUrl: boolean2("custom_field_3_in_url").default(false),
  customField3Options: text2("custom_field_3_options").array(),
  joinedAt: timestamp2("joined_at").defaultNow(),
  createdAt: timestamp2("created_at").defaultNow()
});
var invitations2 = pgTable2("invitations", {
  id: serial2("id").primaryKey(),
  accountId: integer2("account_id").references(() => accounts2.id).notNull(),
  email: text2("email").notNull(),
  role: text2("role").notNull().default("viewer"),
  // viewer, editor, admin, super_admin
  token: text2("token").notNull().unique(),
  expiresAt: timestamp2("expires_at").notNull(),
  status: text2("status").notNull().default("pending"),
  // pending, accepted, expired
  invitedBy: integer2("invited_by").references(() => users2.id).notNull(),
  createdAt: timestamp2("created_at").defaultNow()
});
var sourceTemplates2 = pgTable2("source_templates", {
  id: serial2("id").primaryKey(),
  userId: integer2("user_id").references(() => users2.id).notNull(),
  accountId: integer2("account_id").references(() => accounts2.id),
  // nullable for backwards compatibility
  sourceName: text2("source_name").notNull(),
  mediums: text2("mediums").array().default([]),
  formats: text2("formats").array().default([]),
  abTestingPreference: integer2("ab_testing_preference").default(1),
  // 1: No, 2: A-B, 3: A-B-C
  isArchived: boolean2("is_archived").default(false),
  archivedMediums: text2("archived_mediums").array().default([]),
  // List of archived mediums for this source
  vendorManaged: boolean2("vendor_managed").default(false),
  // true for base templates copied to users
  type: text2("type", { enum: ["Base", "Custom"] }).default("Custom"),
  createdAt: timestamp2("created_at").defaultNow()
});
var tags2 = pgTable2("tags", {
  id: serial2("id").primaryKey(),
  userId: integer2("user_id").references(() => users2.id).notNull(),
  accountId: integer2("account_id").references(() => accounts2.id),
  // nullable for backwards compatibility
  name: text2("name").notNull(),
  createdAt: timestamp2("created_at").defaultNow()
});
var campaignLandingPages2 = pgTable2("campaign_landing_pages", {
  id: serial2("id").primaryKey(),
  userId: integer2("user_id").references(() => users2.id).notNull(),
  accountId: integer2("account_id").references(() => accounts2.id),
  // nullable for backwards compatibility
  campaignName: text2("campaign_name").notNull(),
  url: text2("url").notNull(),
  label: text2("label").notNull(),
  // User-friendly name for the URL
  isArchived: boolean2("is_archived").default(false),
  createdAt: timestamp2("created_at").defaultNow()
});
var baseUtmTemplates2 = pgTable2("base_utm_templates", {
  id: serial2("id").primaryKey(),
  utmSource: text2("utm_source").notNull(),
  utmMedium: text2("utm_medium").notNull(),
  utmContent: text2("utm_content").notNull(),
  description: text2("description"),
  isActive: boolean2("is_active").default(true),
  vendorManaged: boolean2("vendor_managed").default(true),
  createdAt: timestamp2("created_at").defaultNow()
});
var userUtmTemplates2 = pgTable2("user_utm_templates", {
  id: serial2("id").primaryKey(),
  userId: integer2("user_id").references(() => users2.id).notNull(),
  accountId: integer2("account_id").references(() => accounts2.id),
  // nullable for backwards compatibility
  utmSource: text2("utm_source").notNull(),
  utmMedium: text2("utm_medium").notNull(),
  utmContent: text2("utm_content").notNull(),
  description: text2("description"),
  isArchived: boolean2("is_archived").default(false),
  isCustom: boolean2("is_custom").default(false),
  // true if user-added, false if from base template
  type: text2("type", { enum: ["Base", "Custom"] }).default("Custom"),
  createdAt: timestamp2("created_at").defaultNow()
});
var baseTermTemplates2 = pgTable2("base_term_templates", {
  id: serial2("id").primaryKey(),
  termValue: text2("term_value").notNull(),
  description: text2("description"),
  // Optional description for the term
  category: text2("category").default("general"),
  // general, keywords, testing, audience
  vendorManaged: boolean2("vendor_managed").default(true),
  createdAt: timestamp2("created_at").defaultNow()
});
var userTermTemplates2 = pgTable2("user_term_templates", {
  id: serial2("id").primaryKey(),
  userId: integer2("user_id").references(() => users2.id).notNull(),
  accountId: integer2("account_id").references(() => accounts2.id).notNull(),
  termValue: text2("term_value").notNull(),
  description: text2("description"),
  category: text2("category").default("general"),
  isCustom: boolean2("is_custom").default(false),
  isArchived: boolean2("is_archived").default(false),
  type: text2("type", { enum: ["Base", "Custom"] }).default("Custom"),
  createdAt: timestamp2("created_at").defaultNow()
});
var utmLinks2 = pgTable2("utm_links", {
  id: serial2("id").primaryKey(),
  userId: integer2("user_id").references(() => users2.id).notNull(),
  accountId: integer2("account_id").references(() => accounts2.id),
  // nullable for backwards compatibility
  targetUrl: text2("target_url").notNull(),
  utm_campaign: text2("utm_campaign").notNull(),
  utm_source: text2("utm_source").notNull(),
  utm_medium: text2("utm_medium").notNull(),
  utm_content: text2("utm_content"),
  utm_term: text2("utm_term"),
  fullUtmLink: text2("full_utm_link").notNull(),
  category: text2("category"),
  internalCampaignId: text2("internal_campaign_id"),
  customField1Value: text2("custom_field_1_value"),
  customField2Value: text2("custom_field_2_value"),
  customField3Value: text2("custom_field_3_value"),
  tags: text2("tags").array().default([]),
  // Array of tag names associated with this campaign
  isArchived: boolean2("is_archived").default(false),
  createdAt: timestamp2("created_at").defaultNow()
});
var insertUserSchema2 = createInsertSchema2(users2).omit({
  id: true,
  createdAt: true,
  joinedAt: true
}).partial({
  accountId: true,
  // Make accountId optional for initial user creation
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
  customField3Options: true
}).extend({
  // Additional sign-up fields
  accountName: z2.string().optional(),
  pricingPlanId: z2.number().optional(),
  industry: z2.string().optional(),
  teamSize: z2.string().optional(),
  useCases: z2.array(z2.string()).optional()
});
var insertUtmLinkSchema2 = createInsertSchema2(utmLinks2).omit({
  id: true,
  createdAt: true
});
var updateUserSchema2 = createInsertSchema2(users2).omit({
  id: true,
  firebaseUid: true,
  createdAt: true
}).partial();
var insertSourceTemplateSchema2 = createInsertSchema2(sourceTemplates2).omit({
  id: true,
  createdAt: true
});
var insertTagSchema2 = createInsertSchema2(tags2).omit({
  id: true,
  userId: true,
  accountId: true,
  createdAt: true
});
var insertCampaignLandingPageSchema2 = createInsertSchema2(campaignLandingPages2).omit({
  id: true,
  createdAt: true
});
var insertBaseUtmTemplateSchema2 = createInsertSchema2(baseUtmTemplates2).omit({
  id: true,
  createdAt: true
});
var insertUserUtmTemplateSchema2 = createInsertSchema2(userUtmTemplates2).omit({
  id: true,
  createdAt: true
});
var insertBaseTermTemplateSchema2 = createInsertSchema2(baseTermTemplates2).omit({
  id: true,
  createdAt: true
});
var insertUserTermTemplateSchema2 = createInsertSchema2(userTermTemplates2).omit({
  id: true,
  createdAt: true
});
var insertAccountSchema2 = createInsertSchema2(accounts2).omit({
  id: true,
  createdAt: true
});
var insertInvitationSchema2 = createInsertSchema2(invitations2).omit({
  id: true,
  createdAt: true
});
var userRoleSchema2 = z2.enum(["viewer", "editor", "admin", "super_admin"]);
var subscriptionTierSchema2 = z2.enum(["trial", "basic", "pro", "enterprise"]);
var invitationStatusSchema2 = z2.enum(["pending", "accepted", "expired"]);
var insertVendorUserSchema2 = createInsertSchema2(vendorUsers2).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertVendorSessionSchema2 = createInsertSchema2(vendorSessions2).omit({
  id: true,
  createdAt: true
});
var insertPricingPlanSchema2 = createInsertSchema2(pricingPlans2).omit({
  id: true,
  createdAt: true
});
var insertAccountStatusHistorySchema2 = createInsertSchema2(accountStatusHistory2).omit({
  id: true,
  changedAt: true
});
var updateAccountSchema2 = createInsertSchema2(accounts2).omit({
  id: true,
  createdAt: true
}).partial();
var vendorRoleSchema2 = z2.enum(["vendor_admin", "vendor_super_admin"]);
var accountStatusSchema2 = z2.enum(["active", "suspended", "cancelled", "trial"]);

// server/db.ts
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports2 });

// server/storage.js
import { eq, and, desc } from "drizzle-orm";
var DatabaseStorage = class {
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || void 0;
  }
  async getUserByFirebaseUid(firebaseUid) {
    const [user] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid));
    return user || void 0;
  }
  async getUserWithAccountAndPlan(userId) {
    const [result] = await db.select().from(users).innerJoin(accounts, eq(users.accountId, accounts.id)).leftJoin(pricingPlans, eq(accounts.pricingPlanId, pricingPlans.id)).where(eq(users.id, userId)).limit(1);
    if (!result)
      return void 0;
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
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async createUserWithAccount(insertUser, accountName, pricingPlanId) {
    let finalPlanId = pricingPlanId;
    if (!finalPlanId) {
      const [freePlan] = await db.select().from(pricingPlans).where(eq(pricingPlans.planCode, "free")).limit(1);
      finalPlanId = freePlan?.id;
    }
    const account = await this.createAccount({
      name: accountName,
      subscriptionTier: "active",
      // Set as active instead of trial
      pricingPlanId: finalPlanId,
      trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3),
      // 30 days trial for all plans
      industry: insertUser.industry,
      teamSize: insertUser.teamSize,
      useCases: insertUser.useCases || []
    });
    const user = await this.createUser({
      ...insertUser,
      accountId: account.id,
      role: "super_admin"
      // First user in account is super_admin
    });
    return { user, account };
  }
  async updateUser(id, updates) {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user || void 0;
  }
  async createUtmLink(insertUtmLink) {
    const [utmLink] = await db.insert(utmLinks).values(insertUtmLink).returning();
    return utmLink;
  }
  async getUserUtmLinks(userId, limit = 100, offset = 0, includeArchived = false) {
    const userLinks = await db.select().from(utmLinks).where(and(eq(utmLinks.userId, userId), includeArchived ? void 0 : eq(utmLinks.isArchived, false))).limit(limit).offset(offset).orderBy(desc(utmLinks.id));
    return userLinks;
  }
  async getUtmLink(id, userId) {
    const conditions = userId ? and(eq(utmLinks.id, id), eq(utmLinks.userId, userId)) : eq(utmLinks.id, id);
    const [utmLink] = await db.select().from(utmLinks).where(conditions);
    return utmLink || void 0;
  }
  async deleteUtmLinksByCampaign(userId, campaignName) {
    try {
      await db.delete(utmLinks).where(and(eq(utmLinks.userId, userId), eq(utmLinks.utm_campaign, campaignName)));
      return true;
    } catch (error) {
      console.error("Error deleting UTM links by campaign:", error);
      return false;
    }
  }
  async archiveCampaign(userId, campaignName) {
    try {
      await db.update(utmLinks).set({ isArchived: true }).where(and(eq(utmLinks.userId, userId), eq(utmLinks.utm_campaign, campaignName)));
      await db.update(campaignLandingPages).set({ isArchived: true }).where(and(eq(campaignLandingPages.userId, userId), eq(campaignLandingPages.campaignName, campaignName)));
      return true;
    } catch (error) {
      console.error("Error archiving campaign:", error);
      return false;
    }
  }
  async unarchiveCampaign(userId, campaignName) {
    try {
      await db.update(utmLinks).set({ isArchived: false }).where(and(eq(utmLinks.userId, userId), eq(utmLinks.utm_campaign, campaignName)));
      await db.update(campaignLandingPages).set({ isArchived: false }).where(and(eq(campaignLandingPages.userId, userId), eq(campaignLandingPages.campaignName, campaignName)));
      return true;
    } catch (error) {
      console.error("Error unarchiving campaign:", error);
      return false;
    }
  }
  async createSourceTemplate(insertSourceTemplate) {
    const [sourceTemplate] = await db.insert(sourceTemplates).values({
      ...insertSourceTemplate,
      abTestingPreference: insertSourceTemplate.abTestingPreference || 1
    }).returning();
    return sourceTemplate;
  }
  async getUserSourceTemplates(userId) {
    return await db.select().from(sourceTemplates).where(eq(sourceTemplates.userId, userId));
  }
  async updateSourceTemplate(id, userId, updates) {
    const [sourceTemplate] = await db.update(sourceTemplates).set(updates).where(and(eq(sourceTemplates.id, id), eq(sourceTemplates.userId, userId))).returning();
    return sourceTemplate || void 0;
  }
  async deleteSourceTemplate(id, userId) {
    const result = await db.delete(sourceTemplates).where(and(eq(sourceTemplates.id, id), eq(sourceTemplates.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }
  async createTag(insertTag) {
    const [tag] = await db.insert(tags).values(insertTag).returning();
    return tag;
  }
  async getUserTags(userId) {
    return await db.select().from(tags).where(eq(tags.userId, userId));
  }
  async getTagByName(userId, name) {
    const [tag] = await db.select().from(tags).where(and(eq(tags.userId, userId), eq(tags.name, name)));
    return tag || void 0;
  }
  async updateTag(id, userId, name) {
    const [oldTag] = await db.select().from(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
    if (!oldTag)
      return void 0;
    const [updatedTag] = await db.update(tags).set({ name }).where(and(eq(tags.id, id), eq(tags.userId, userId))).returning();
    if (updatedTag) {
      const userUtmLinks = await db.select().from(utmLinks).where(eq(utmLinks.userId, userId));
      for (const link of userUtmLinks) {
        if (link.tags && link.tags.includes(oldTag.name)) {
          const updatedTags = link.tags.map((tag) => tag === oldTag.name ? name : tag);
          await db.update(utmLinks).set({ tags: updatedTags }).where(eq(utmLinks.id, link.id));
        }
      }
    }
    return updatedTag || void 0;
  }
  async deleteTag(id, userId) {
    const userUtmLinks = await db.select().from(utmLinks).where(eq(utmLinks.userId, userId));
    for (const link of userUtmLinks) {
      if (link.tags && link.tags.length > 0) {
        const [tagToDelete] = await db.select().from(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
        if (tagToDelete) {
          const updatedTags = link.tags.filter((tag) => tag !== tagToDelete.name);
          await db.update(utmLinks).set({ tags: updatedTags }).where(eq(utmLinks.id, link.id));
        }
      }
    }
    const result = await db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }
  async createCampaignLandingPage(insertLandingPage) {
    const [landingPage] = await db.insert(campaignLandingPages).values(insertLandingPage).returning();
    return landingPage;
  }
  async getCampaignLandingPages(userId, campaignName, includeArchived = false) {
    return await db.select().from(campaignLandingPages).where(and(eq(campaignLandingPages.userId, userId), eq(campaignLandingPages.campaignName, campaignName), includeArchived ? void 0 : eq(campaignLandingPages.isArchived, false)));
  }
  async getAllCampaignLandingPages(userId, includeArchived = false) {
    return await db.select().from(campaignLandingPages).where(and(eq(campaignLandingPages.userId, userId), includeArchived ? void 0 : eq(campaignLandingPages.isArchived, false))).orderBy(desc(campaignLandingPages.createdAt));
  }
  async deleteCampaignLandingPages(userId, campaignName) {
    const result = await db.delete(campaignLandingPages).where(and(eq(campaignLandingPages.userId, userId), eq(campaignLandingPages.campaignName, campaignName)));
    return (result.rowCount ?? 0) > 0;
  }
  // Base UTM Template operations
  async getBaseUtmTemplates() {
    return await db.select().from(baseUtmTemplates).where(eq(baseUtmTemplates.isActive, true));
  }
  async getBaseUtmContentByCombination(source, medium) {
    return await db.select().from(baseUtmTemplates).where(and(eq(baseUtmTemplates.utmSource, source), eq(baseUtmTemplates.utmMedium, medium), eq(baseUtmTemplates.isActive, true)));
  }
  // User UTM Template operations  
  async createUserUtmTemplate(template) {
    const [userTemplate] = await db.insert(userUtmTemplates).values(template).returning();
    return userTemplate;
  }
  async getUserUtmTemplates(userId) {
    return await db.select().from(userUtmTemplates).where(and(eq(userUtmTemplates.userId, userId), eq(userUtmTemplates.isArchived, false)));
  }
  async getUserUtmContentByCombination(userId, source, medium) {
    return await db.select().from(userUtmTemplates).where(and(eq(userUtmTemplates.userId, userId), eq(userUtmTemplates.utmSource, source), eq(userUtmTemplates.utmMedium, medium), eq(userUtmTemplates.isArchived, false)));
  }
  async deleteUserUtmTemplate(id, userId) {
    const result = await db.delete(userUtmTemplates).where(and(eq(userUtmTemplates.id, id), eq(userUtmTemplates.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }
  async archiveUserUtmTemplate(id, userId) {
    const result = await db.update(userUtmTemplates).set({ isArchived: true }).where(and(eq(userUtmTemplates.id, id), eq(userUtmTemplates.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }
  async unarchiveUserUtmTemplate(id, userId) {
    const result = await db.update(userUtmTemplates).set({ isArchived: false }).where(and(eq(userUtmTemplates.id, id), eq(userUtmTemplates.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }
  // Base Term Template operations
  async getBaseTermTemplates() {
    return await db.select().from(baseTermTemplates);
  }
  async getBaseTermTemplatesByCategory(category) {
    if (category) {
      return await db.select().from(baseTermTemplates).where(eq(baseTermTemplates.category, category));
    }
    return await this.getBaseTermTemplates();
  }
  // User Term Template operations
  async createUserTermTemplate(template) {
    const [userTermTemplate] = await db.insert(userTermTemplates).values(template).returning();
    return userTermTemplate;
  }
  async getUserTermTemplates(userId) {
    return await db.select().from(userTermTemplates).where(and(eq(userTermTemplates.userId, userId), eq(userTermTemplates.isArchived, false)));
  }
  async getUserTermTemplatesByCategory(userId, category) {
    const conditions = [
      eq(userTermTemplates.userId, userId),
      eq(userTermTemplates.isArchived, false)
    ];
    if (category) {
      conditions.push(eq(userTermTemplates.category, category));
    }
    return await db.select().from(userTermTemplates).where(and(...conditions));
  }
  async deleteUserTermTemplate(id, userId) {
    const result = await db.delete(userTermTemplates).where(and(eq(userTermTemplates.id, id), eq(userTermTemplates.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }
  async archiveUserTermTemplate(id, userId) {
    const result = await db.update(userTermTemplates).set({ isArchived: true }).where(and(eq(userTermTemplates.id, id), eq(userTermTemplates.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }
  async unarchiveUserTermTemplate(id, userId) {
    const result = await db.update(userTermTemplates).set({ isArchived: false }).where(and(eq(userTermTemplates.id, id), eq(userTermTemplates.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }
  // User account setup - creates user template copies from base templates
  async createUserTemplatesFromBase(userId, accountId) {
    try {
      const baseTemplates = await this.getBaseUtmTemplates();
      const userTemplateInserts = baseTemplates.map((base) => ({
        userId,
        accountId,
        utmSource: base.utmSource,
        utmMedium: base.utmMedium,
        utmContent: base.utmContent,
        description: base.description,
        isArchived: false,
        isCustom: false,
        // false because it's from base template
        type: "Base"
        // Mark as Base type for proper classification
      }));
      if (userTemplateInserts.length > 0) {
        await db.insert(userUtmTemplates).values(userTemplateInserts);
      }
      return true;
    } catch (error) {
      console.error("Error creating user templates from base:", error);
      return false;
    }
  }
  // Creates user term template copies from base term templates
  async createUserTermTemplatesFromBase(userId, accountId) {
    try {
      const baseTermTemplates3 = await this.getBaseTermTemplates();
      const userTermTemplateInserts = baseTermTemplates3.map((base) => ({
        userId,
        accountId,
        termValue: base.termValue,
        description: base.description,
        category: base.category,
        isArchived: false,
        isCustom: false,
        // false because it's from base template
        type: "Base"
        // Mark as Base type for proper classification
      }));
      if (userTermTemplateInserts.length > 0) {
        await db.insert(userTermTemplates).values(userTermTemplateInserts);
      }
      return true;
    } catch (error) {
      console.error("Error creating user term templates from base:", error);
      return false;
    }
  }
  async getAllUniqueUrls(userId) {
    const landingPageUrls = await db.selectDistinct({ url: campaignLandingPages.url }).from(campaignLandingPages).where(eq(campaignLandingPages.userId, userId));
    const utmUrls = await db.selectDistinct({ url: utmLinks.targetUrl }).from(utmLinks).where(eq(utmLinks.userId, userId));
    const allUrls = /* @__PURE__ */ new Set();
    landingPageUrls.forEach((row) => {
      if (row.url && row.url.trim()) {
        allUrls.add(row.url.trim());
      }
    });
    utmUrls.forEach((row) => {
      if (row.url && row.url.trim()) {
        allUrls.add(row.url.trim());
      }
    });
    return Array.from(allUrls).sort();
  }
  // Account management operations
  async createAccount(account) {
    const [newAccount] = await db.insert(accounts).values(account).returning();
    return newAccount;
  }
  async getAccount(id) {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    return account || void 0;
  }
  async updateAccount(id, updates) {
    const [updatedAccount] = await db.update(accounts).set(updates).where(eq(accounts.id, id)).returning();
    return updatedAccount || void 0;
  }
  async getUserAccount(userId) {
    const [user] = await db.select({
      account: accounts
    }).from(users).innerJoin(accounts, eq(users.accountId, accounts.id)).where(eq(users.id, userId));
    return user?.account;
  }
  // User account operations (simplified - users belong to ONE account only)
  async getAccountUsers(accountId) {
    return await db.select().from(users).where(eq(users.accountId, accountId));
  }
  async updateUserRole(userId, role) {
    const [updatedUser] = await db.update(users).set({ role }).where(eq(users.id, userId)).returning();
    return updatedUser || void 0;
  }
  async removeUserFromAccount(userId) {
    const result = await db.delete(users).where(eq(users.id, userId));
    return result.rowCount !== null && result.rowCount > 0;
  }
  // Invitation operations
  async createInvitation(invitation) {
    const [newInvitation] = await db.insert(invitations).values(invitation).returning();
    return newInvitation;
  }
  async getInvitationByToken(token) {
    const [invitation] = await db.select().from(invitations).where(eq(invitations.token, token));
    return invitation || void 0;
  }
  async getAccountInvitations(accountId) {
    return await db.select().from(invitations).where(eq(invitations.accountId, accountId)).orderBy(desc(invitations.createdAt));
  }
  async updateInvitationStatus(id, status) {
    const [updatedInvitation] = await db.update(invitations).set({ status }).where(eq(invitations.id, id)).returning();
    return updatedInvitation || void 0;
  }
  // User context operations (simplified for single account model)
  async getUserWithAccount(userId) {
    const [userData2] = await db.select({
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
    }).from(users).innerJoin(accounts, eq(users.accountId, accounts.id)).where(eq(users.id, userId));
    return userData2 || void 0;
  }
  async getDefaultAccountForUser(userId) {
    return this.getUserAccount(userId);
  }
};
var storage = new DatabaseStorage();

// server/routes.js
init_schema();

// server/permissions.js
var ROLE_PERMISSIONS = {
  viewer: [
    "read_campaigns",
    "copy_utm_links"
  ],
  editor: [
    "read_campaigns",
    "create_campaigns",
    "edit_campaigns",
    // Can edit their own campaigns only
    "copy_utm_links",
    "manage_templates",
    // Limited to their own templates
    "manage_tags"
  ],
  admin: [
    "read_campaigns",
    "create_campaigns",
    "edit_campaigns",
    // Can edit all campaigns
    "delete_campaigns",
    // Can delete all campaigns
    "copy_utm_links",
    "manage_templates",
    "manage_tags",
    "invite_users",
    "manage_users",
    // Cannot change Super Admin
    "change_user_roles"
    // Cannot change Super Admin
  ],
  super_admin: [
    "read_campaigns",
    "create_campaigns",
    "edit_campaigns",
    "delete_campaigns",
    "copy_utm_links",
    "manage_templates",
    "manage_tags",
    "invite_users",
    "manage_users",
    "change_user_roles",
    "delete_users",
    "manage_account_settings",
    "manage_billing",
    "view_account_analytics"
  ]
};
function hasPermission(user, permission) {
  const userPermissions = ROLE_PERMISSIONS[user.role] || [];
  return userPermissions.includes(permission);
}
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({
        message: `Insufficient permissions. Required: ${permission}`,
        userRole: req.user.role,
        requiredPermission: permission
      });
    }
    next();
  };
}

// shared/validation.ts
import { z as z3 } from "zod";
function validateUrl(url) {
  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return { isValid: false, error: "URL must start with http:// or https://" };
    }
    const urlObj = new URL(url);
    const cleanUrl = stripUtmParameters(url);
    if (cleanUrl.length > 1800) {
      return { isValid: false, error: "URL too long. Maximum 1800 characters before UTM parameters." };
    }
    return { isValid: true, cleanUrl };
  } catch (error) {
    return { isValid: false, error: "Invalid URL format" };
  }
}
function stripUtmParameters(url) {
  try {
    const urlObj = new URL(url);
    const utmParams = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    utmParams.forEach((param) => {
      urlObj.searchParams.delete(param);
    });
    return urlObj.toString();
  } catch {
    return url;
  }
}
function sanitizeUtmParameter(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-_]/g, "").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}
var utmSourceSchema = z3.string().min(1, "Source is required").max(100, "Source must be 100 characters or less").refine((val) => /^[a-zA-Z0-9\-_\s]+$/.test(val), {
  message: "Source can only contain letters, numbers, spaces, hyphens, and underscores"
});
var utmMediumSchema = z3.string().min(1, "Medium is required").max(50, "Medium must be 50 characters or less").refine((val) => /^[a-zA-Z0-9\-_\s]+$/.test(val), {
  message: "Medium can only contain letters, numbers, spaces, hyphens, and underscores"
});
var utmCampaignSchema = z3.string().min(1, "Campaign name is required").max(100, "Campaign name must be 100 characters or less").refine((val) => /^[a-zA-Z0-9\-_\s]+$/.test(val), {
  message: "Campaign name can only contain letters, numbers, spaces, hyphens, and underscores"
});
var utmContentSchema = z3.string().max(100, "Content must be 100 characters or less").refine((val) => val === "" || /^[a-zA-Z0-9\-_\s]+$/.test(val), {
  message: "Content can only contain letters, numbers, spaces, hyphens, and underscores"
}).optional().or(z3.literal(""));
var utmTermSchema = z3.string().max(100, "Term must be 100 characters or less").refine((val) => val === "" || /^[a-zA-Z0-9\-_\s]+$/.test(val), {
  message: "Term can only contain letters, numbers, spaces, hyphens, and underscores"
}).optional().or(z3.literal(""));
var termTemplateSchema = z3.object({
  termValue: z3.string().min(1, "Term value is required").max(100, "Term value must be 100 characters or less").refine((val) => /^[a-zA-Z0-9\-_\s]+$/.test(val), {
    message: "Term value can only contain letters, numbers, spaces, hyphens, and underscores"
  }),
  description: z3.string().max(255, "Description must be 255 characters or less").optional(),
  category: z3.enum(["general", "keywords", "testing", "audience"]).default("general")
});
var landingPageUrlSchema = z3.string().min(1, "Landing page URL is required").refine((val) => validateUrl(val).isValid, {
  message: "Invalid URL format or URL must start with http:// or https://"
}).transform((val) => {
  const result = validateUrl(val);
  return result.cleanUrl || val;
});
var campaignValidationSchema = z3.object({
  campaignName: utmCampaignSchema,
  landingPageUrls: z3.array(landingPageUrlSchema).min(1, "At least one landing page URL is required"),
  utmLinks: z3.array(z3.object({
    source: utmSourceSchema,
    medium: utmMediumSchema,
    content: utmContentSchema,
    term: utmTermSchema,
    linkName: z3.string().min(1, "Link name is required").max(100, "Link name must be 100 characters or less")
  })).min(1, "At least one UTM link configuration is required")
});
function generateUTMLink(landingPageUrl, source, medium, campaign, content, term) {
  try {
    const url = new URL(landingPageUrl);
    url.searchParams.set("utm_source", sanitizeUtmParameter(source));
    url.searchParams.set("utm_medium", sanitizeUtmParameter(medium));
    url.searchParams.set("utm_campaign", sanitizeUtmParameter(campaign));
    if (content && content.trim()) {
      url.searchParams.set("utm_content", sanitizeUtmParameter(content));
    }
    if (term && term.trim()) {
      url.searchParams.set("utm_term", sanitizeUtmParameter(term));
    }
    const finalUrl = url.toString();
    if (finalUrl.length > 2e3) {
      throw new Error("Generated UTM link exceeds 2000 character limit");
    }
    return finalUrl;
  } catch (error) {
    throw new Error(`Failed to generate UTM link: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
function formatValidationError(error) {
  const fieldErrors = {};
  error.errors.forEach((err) => {
    const field = err.path.join(".");
    fieldErrors[field] = err.message;
  });
  return fieldErrors;
}

// server/seedUtmTemplates.js
init_schema();
var defaultUtmTemplates = [
  { utmSource: "google", utmMedium: "cpc", utmContent: "text-ad", description: "Google Ads - Tekstannonse" },
  { utmSource: "google", utmMedium: "cpc", utmContent: "responsive-ad", description: "Google Ads - Responsiv s\xF8keannonse" },
  { utmSource: "google", utmMedium: "cpc", utmContent: "shopping-ad", description: "Google Ads - Shopping annonse" },
  { utmSource: "google", utmMedium: "paidsearch", utmContent: "text-ad", description: "Google Ads - Tekstannonse s\xF8k" },
  { utmSource: "google", utmMedium: "paidsearch", utmContent: "responsive-ad", description: "Google Ads - Responsiv s\xF8keannonse" },
  { utmSource: "google", utmMedium: "organic", utmContent: "serp-result", description: "Google - Organisk s\xF8keresultat" },
  { utmSource: "facebook", utmMedium: "social", utmContent: "post-image", description: "Facebook - Organisk bilde-innlegg" },
  { utmSource: "facebook", utmMedium: "social", utmContent: "post-video", description: "Facebook - Organisk video-innlegg" },
  { utmSource: "facebook", utmMedium: "social", utmContent: "post-carousel", description: "Facebook - Organisk karusell-innlegg" },
  { utmSource: "facebook", utmMedium: "cpc", utmContent: "single-image", description: "Facebook - Enkelt bilde annonse" },
  { utmSource: "facebook", utmMedium: "cpc", utmContent: "video-ad", description: "Facebook - Video annonse" },
  { utmSource: "facebook", utmMedium: "cpc", utmContent: "carousel-ad", description: "Facebook - Karusell annonse" },
  { utmSource: "facebook", utmMedium: "paid-social", utmContent: "feed-ad", description: "Facebook - Feed annonse" },
  { utmSource: "facebook", utmMedium: "paid-social", utmContent: "story-ad", description: "Facebook - Stories annonse" },
  { utmSource: "facebook", utmMedium: "paid-social", utmContent: "reel-ad", description: "Facebook - Reels annonse" },
  { utmSource: "instagram", utmMedium: "social", utmContent: "post-image", description: "Instagram - Organisk bilde-innlegg" },
  { utmSource: "instagram", utmMedium: "social", utmContent: "post-video", description: "Instagram - Organisk video-innlegg" },
  { utmSource: "instagram", utmMedium: "social", utmContent: "story-post", description: "Instagram - Organisk story" },
  { utmSource: "instagram", utmMedium: "cpc", utmContent: "feed-ad", description: "Instagram - Feed annonse" },
  { utmSource: "instagram", utmMedium: "cpc", utmContent: "story-ad", description: "Instagram - Stories annonse" },
  { utmSource: "instagram", utmMedium: "cpc", utmContent: "reel-ad", description: "Instagram - Reels annonse" },
  { utmSource: "instagram", utmMedium: "paid-social", utmContent: "carousel-ad", description: "Instagram - Karusell annonse" },
  { utmSource: "instagram", utmMedium: "paid-social", utmContent: "collection-ad", description: "Instagram - Samling annonse" },
  { utmSource: "x", utmMedium: "social", utmContent: "tweet-text", description: "X - Organisk tekst tweet" },
  { utmSource: "x", utmMedium: "social", utmContent: "tweet-image", description: "X - Organisk bilde tweet" },
  { utmSource: "x", utmMedium: "social", utmContent: "tweet-video", description: "X - Organisk video tweet" },
  { utmSource: "x", utmMedium: "cpc", utmContent: "promoted-tweet", description: "X - Promoted tweet" },
  { utmSource: "x", utmMedium: "cpc", utmContent: "video-ad", description: "X - Video annonse" },
  { utmSource: "x", utmMedium: "paid-social", utmContent: "carousel-ad", description: "X - Karusell annonse" },
  { utmSource: "linkedin", utmMedium: "social", utmContent: "post-text", description: "LinkedIn - Organisk tekst-innlegg" },
  { utmSource: "linkedin", utmMedium: "social", utmContent: "post-image", description: "LinkedIn - Organisk bilde-innlegg" },
  { utmSource: "linkedin", utmMedium: "social", utmContent: "post-video", description: "LinkedIn - Organisk video-innlegg" },
  { utmSource: "linkedin", utmMedium: "cpc", utmContent: "sponsored-content", description: "LinkedIn - Sponsored content" },
  { utmSource: "linkedin", utmMedium: "cpc", utmContent: "text-ad", description: "LinkedIn - Tekstannonse" },
  { utmSource: "linkedin", utmMedium: "cpc", utmContent: "video-ad", description: "LinkedIn - Video annonse" },
  { utmSource: "linkedin", utmMedium: "paid-social", utmContent: "carousel-ad", description: "LinkedIn - Karusell annonse" },
  { utmSource: "linkedin", utmMedium: "paid-social", utmContent: "single-image", description: "LinkedIn - Enkelt bilde annonse" },
  { utmSource: "youtube", utmMedium: "social", utmContent: "video-organic", description: "YouTube - Organisk video" },
  { utmSource: "youtube", utmMedium: "social", utmContent: "short-video", description: "YouTube - YouTube Shorts" },
  { utmSource: "youtube", utmMedium: "cpc", utmContent: "video-ad", description: "YouTube - Video annonse" },
  { utmSource: "youtube", utmMedium: "cpc", utmContent: "bumper-ad", description: "YouTube - Bumper annonse (6 sek)" },
  { utmSource: "youtube", utmMedium: "video", utmContent: "pre-roll", description: "YouTube - Pre-roll annonse" },
  { utmSource: "youtube", utmMedium: "video", utmContent: "mid-roll", description: "YouTube - Mid-roll annonse" },
  { utmSource: "newsletter", utmMedium: "email", utmContent: "header-cta", description: "Nyhetsbrev - Header call-to-action" },
  { utmSource: "newsletter", utmMedium: "email", utmContent: "footer-cta", description: "Nyhetsbrev - Footer call-to-action" },
  { utmSource: "newsletter", utmMedium: "email", utmContent: "inline-link", description: "Nyhetsbrev - Inline tekst-lenke" },
  { utmSource: "newsletter", utmMedium: "email", utmContent: "banner-image", description: "Nyhetsbrev - Banner bilde" },
  { utmSource: "mailchimp", utmMedium: "email", utmContent: "button-primary", description: "Mailchimp - Prim\xE6r knapp" },
  { utmSource: "mailchimp", utmMedium: "email", utmContent: "button-secondary", description: "Mailchimp - Sekund\xE6r knapp" },
  { utmSource: "mailchimp", utmMedium: "email", utmContent: "text-link", description: "Mailchimp - Tekst-lenke" },
  { utmSource: "mailchimp", utmMedium: "email", utmContent: "hero-image", description: "Mailchimp - Hero bilde" },
  { utmSource: "activecampaign", utmMedium: "email", utmContent: "cta-button", description: "ActiveCampaign - CTA knapp" },
  { utmSource: "activecampaign", utmMedium: "email", utmContent: "product-image", description: "ActiveCampaign - Produktbilde" },
  { utmSource: "activecampaign", utmMedium: "email", utmContent: "personalized-link", description: "ActiveCampaign - Personalisert lenke" },
  { utmSource: "email-signature", utmMedium: "email", utmContent: "logo-link", description: "E-post signatur - Logo lenke" },
  { utmSource: "email-signature", utmMedium: "email", utmContent: "social-icon", description: "E-post signatur - Sosial media ikon" },
  { utmSource: "email-signature", utmMedium: "email", utmContent: "cta-banner", description: "E-post signatur - CTA banner" },
  { utmSource: "microsoft", utmMedium: "cpc", utmContent: "text-ad", description: "Microsoft Ads - Tekstannonse" },
  { utmSource: "microsoft", utmMedium: "cpc", utmContent: "shopping-ad", description: "Microsoft Ads - Shopping annonse" },
  { utmSource: "microsoft", utmMedium: "paidsearch", utmContent: "expanded-text", description: "Microsoft Ads - Utvidet tekstannonse" },
  { utmSource: "display", utmMedium: "banner", utmContent: "leaderboard-728x90", description: "Display - Leaderboard banner" },
  { utmSource: "display", utmMedium: "banner", utmContent: "rectangle-300x250", description: "Display - Medium rectangle banner" },
  { utmSource: "display", utmMedium: "banner", utmContent: "skyscraper-160x600", description: "Display - Skyscraper banner" },
  { utmSource: "display", utmMedium: "display", utmContent: "responsive-banner", description: "Display - Responsiv banner" },
  { utmSource: "display", utmMedium: "display", utmContent: "video-banner", description: "Display - Video banner" },
  { utmSource: "affiliate", utmMedium: "affiliate", utmContent: "text-link", description: "Affiliate - Tekst-lenke" },
  { utmSource: "affiliate", utmMedium: "affiliate", utmContent: "banner-ad", description: "Affiliate - Banner annonse" },
  { utmSource: "affiliate", utmMedium: "affiliate", utmContent: "product-review", description: "Affiliate - Produktanmeldelse" },
  { utmSource: "affiliate", utmMedium: "referral", utmContent: "coupon-code", description: "Affiliate - Kupongkode" },
  { utmSource: "partners", utmMedium: "referral", utmContent: "partner-link", description: "Partner - Partner lenke" },
  { utmSource: "partners", utmMedium: "referral", utmContent: "co-branded", description: "Partner - Co-branded innhold" },
  { utmSource: "partners", utmMedium: "affiliate", utmContent: "recommendation", description: "Partner - Anbefaling" }
];
async function seedUtmTemplates() {
  try {
    const existingTemplates = await db.select().from(baseUtmTemplates).limit(1);
    if (existingTemplates.length === 0) {
      console.log("Seeding base UTM templates...");
      await db.insert(baseUtmTemplates).values(defaultUtmTemplates);
      console.log(`Seeded ${defaultUtmTemplates.length} base UTM templates successfully`);
    } else {
      console.log("Base UTM templates already exist, skipping seed");
    }
  } catch (error) {
    console.error("Error seeding UTM templates:", error);
  }
}
function getUniqueSourcesAndMediums() {
  const sourceMap = /* @__PURE__ */ new Map();
  defaultUtmTemplates.forEach((template) => {
    if (!sourceMap.has(template.utmSource)) {
      sourceMap.set(template.utmSource, /* @__PURE__ */ new Set());
    }
    sourceMap.get(template.utmSource).add(template.utmMedium);
  });
  return Array.from(sourceMap.entries()).map(([sourceName, mediums]) => ({
    sourceName,
    mediums: Array.from(mediums),
    formats: [],
    // Empty formats for now
    abTestingPreference: 1,
    isArchived: false
  }));
}

// server/setupVendorSystem.js
init_schema();

// server/vendorAuth.ts
import { eq as eq2, and as and2, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
var hashPassword = async (password) => {
  return bcrypt.hash(password, 10);
};

// server/setupVendorSystem.js
import { eq as eq3 } from "drizzle-orm";
async function setupVendorSystem() {
  try {
    console.log("Setting up vendor system...");
    const existingVendorUsers = await db.select().from(vendorUsers).limit(1);
    if (existingVendorUsers.length > 0) {
      console.log("Vendor system already set up, skipping initialization");
      return;
    }
    const defaultPassword = "VendorAdmin2025!";
    const hashedPassword = await hashPassword(defaultPassword);
    await db.insert(vendorUsers).values({
      email: "admin@utmbuilder.vendor",
      passwordHash: hashedPassword,
      fullName: "Vendor Administrator",
      role: "super_admin",
      isActive: true,
      createdAt: /* @__PURE__ */ new Date()
    });
    console.log("Created default vendor admin user:");
    console.log("Email: admin@utmbuilder.vendor");
    console.log("Password: VendorAdmin2025!");
    console.log("Access URL: /vendor-admin-38291");
    const defaultPlans = [
      {
        planCode: "free",
        planName: "Free Plan",
        planDescription: "Basic UTM link building for personal use",
        monthlyPriceCents: 0,
        annualPriceCents: 0,
        maxCampaigns: 10,
        maxUsers: 1,
        maxUtmLinks: 100,
        features: {
          basicUtmBuilder: true,
          campaignManagement: true,
          chatWizard: false,
          customTemplates: false,
          multiUser: false,
          analytics: false,
          apiAccess: false,
          prioritySupport: false
        },
        isActive: true,
        sortOrder: 1
      },
      {
        planCode: "starter",
        planName: "Starter Plan",
        planDescription: "Perfect for small teams and growing businesses",
        monthlyPriceCents: 1900,
        // $19/month
        annualPriceCents: 19e3,
        // $190/year (2 months free)
        maxCampaigns: 100,
        maxUsers: 3,
        maxUtmLinks: 1e3,
        features: {
          basicUtmBuilder: true,
          campaignManagement: true,
          chatWizard: true,
          customTemplates: true,
          multiUser: true,
          analytics: true,
          apiAccess: false,
          prioritySupport: false
        },
        isActive: true,
        sortOrder: 2
      },
      {
        planCode: "professional",
        planName: "Professional Plan",
        planDescription: "Advanced features for marketing teams",
        monthlyPriceCents: 4900,
        // $49/month
        annualPriceCents: 49e3,
        // $490/year (2 months free)
        maxCampaigns: 500,
        maxUsers: 10,
        maxUtmLinks: 1e4,
        features: {
          basicUtmBuilder: true,
          campaignManagement: true,
          chatWizard: true,
          customTemplates: true,
          multiUser: true,
          analytics: true,
          apiAccess: true,
          prioritySupport: true
        },
        isActive: true,
        sortOrder: 3
      },
      {
        planCode: "enterprise",
        planName: "Enterprise Plan",
        planDescription: "Unlimited features for large organizations",
        monthlyPriceCents: 9900,
        // $99/month
        annualPriceCents: 99e3,
        // $990/year (2 months free)
        maxCampaigns: null,
        // unlimited
        maxUsers: null,
        // unlimited
        maxUtmLinks: null,
        // unlimited
        features: {
          basicUtmBuilder: true,
          campaignManagement: true,
          chatWizard: true,
          customTemplates: true,
          multiUser: true,
          analytics: true,
          apiAccess: true,
          prioritySupport: true,
          whiteLabel: true,
          customIntegrations: true,
          dedicatedSupport: true
        },
        isActive: true,
        sortOrder: 4
      }
    ];
    const existingPlans = await db.select().from(pricingPlans).limit(1);
    if (existingPlans.length === 0) {
      await db.insert(pricingPlans).values(defaultPlans);
      console.log("Created default pricing plans");
    }
    console.log("Vendor system setup complete!");
    console.log("\n=== VENDOR ACCESS INFORMATION ===");
    console.log("URL: /vendor-admin-38291");
    console.log("Email: admin@utmbuilder.vendor");
    console.log("Password: VendorAdmin2025!");
    console.log("====================================\n");
  } catch (error) {
    console.error("Error setting up vendor system:", error);
    throw error;
  }
}
async function assignDefaultPricingPlans() {
  try {
    console.log("Assigning default pricing plans to existing accounts...");
    const [freePlan] = await db.select().from(pricingPlans).where(eq3(pricingPlans.planCode, "free"));
    if (!freePlan) {
      console.log("Free plan not found, skipping pricing plan assignment");
      return;
    }
    const { accounts: accounts3 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const result = await db.update(accounts3).set({ pricingPlanId: freePlan.id }).where(eq3(accounts3.pricingPlanId, null));
    console.log("Assigned free plan to accounts without pricing plans");
  } catch (error) {
    console.error("Error assigning default pricing plans:", error);
  }
}

// server/routes.js
var authMiddleware = async (req, res, next) => {
  const firebaseUid = req.headers["x-firebase-uid"];
  const authHeader = req.headers["authorization"];
  if (!firebaseUid || !authHeader) {
    return res.status(401).json({ message: "Unauthorized - Missing authentication headers" });
  }
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized - Invalid token format" });
  }
  const user = await storage.getUserByFirebaseUid(firebaseUid);
  if (!user) {
    console.log(`User not found for Firebase UID: ${firebaseUid}`);
    return res.status(401).json({ message: "User not found" });
  }
  req.user = user;
  req.userId = user.id;
  req.accountId = user.accountId;
  next();
};
var loadFeatures = async (req, res, next) => {
  try {
    if (!req.userId) {
      return next();
    }
    const user = await storage.getUserWithAccountAndPlan(req.userId);
    if (user?.account?.pricingPlan?.features) {
      req.userFeatures = user.account.pricingPlan.features;
      req.userAccount = {
        id: user.accountId,
        name: user.account.name,
        pricingPlanId: user.account.pricingPlanId
      };
    }
    next();
  } catch (error) {
    console.error("Feature middleware error:", error);
    next();
  }
};
async function registerRoutes(app2) {
  await seedUtmTemplates();
  await setupVendorSystem();
  await assignDefaultPricingPlans();
  app2.post("/api/users", async (req, res) => {
    try {
      const userData2 = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByFirebaseUid(userData2.firebaseUid);
      if (existingUser) {
        return res.json(existingUser);
      }
      const { user, account } = await storage.createUserWithAccount({
        firebaseUid: userData2.firebaseUid,
        email: userData2.email || "",
        role: "super_admin",
        categories: [],
        defaultSources: [],
        defaultMediums: [],
        defaultCampaignNames: [],
        isSetupComplete: false,
        showCampaignTerm: true,
        showInternalCampaignId: true,
        showCategory: true,
        showCustomFields: false,
        customField1Name: void 0,
        customField1InUrl: false,
        customField1Options: void 0,
        customField2Name: void 0,
        customField2InUrl: false,
        customField2Options: void 0,
        customField3Name: void 0,
        customField3InUrl: false,
        customField3Options: void 0,
        // Include profile data in user object for account creation
        industry: userData2.industry,
        teamSize: userData2.teamSize,
        useCases: userData2.useCases || []
      }, userData2.accountName || `${(userData2.email || "").split("@")[0]}'s Company`, userData2.pricingPlanId);
      await storage.createUserTemplatesFromBase(user.id, account.id);
      await storage.createUserTermTemplatesFromBase(user.id, account.id);
      const defaultSources = getUniqueSourcesAndMediums();
      for (const sourceData of defaultSources) {
        await storage.createSourceTemplate({
          ...sourceData,
          userId: user.id,
          accountId: account.id
        });
      }
      res.json(user);
    } catch (error) {
      if (error.message && error.message.includes("duplicate key value violates unique constraint")) {
        try {
          const existingUser = await storage.getUserByFirebaseUid(userData.firebaseUid);
          if (existingUser) {
            return res.json(existingUser);
          }
        } catch (getError) {
        }
      }
      res.status(400).json({ message: error.message });
    }
  });
  app2.get("/api/users/:uid", async (req, res) => {
    try {
      const { uid } = req.params;
      const user = await storage.getUserByFirebaseUid(uid);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/user", authMiddleware, async (req, res) => {
    res.json(req.user);
  });
  app2.get("/api/user-features", authMiddleware, loadFeatures, async (req, res) => {
    try {
      res.json({
        features: req.userFeatures || {},
        account: req.userAccount || null
      });
    } catch (error) {
      console.error("Get user features error:", error);
      res.status(500).json({ error: "Failed to get user features" });
    }
  });
  app2.get("/api/user/account", authMiddleware, async (req, res) => {
    try {
      const account = await storage.getUserAccount(req.user.id);
      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }
      res.json({ ...req.user, account });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/user", authMiddleware, async (req, res) => {
    try {
      const updates = updateUserSchema.parse(req.body);
      const updatedUser = await storage.updateUser(req.user.id, updates);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found or access denied" });
      }
      res.json(updatedUser);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  app2.post("/api/utm-links", authMiddleware, requirePermission("create_campaigns"), async (req, res) => {
    try {
      const { targetUrl, utm_source, utm_medium, utm_campaign, utm_content, utm_term } = req.body;
      const urlValidation = validateUrl(targetUrl);
      if (!urlValidation.isValid) {
        return res.status(400).json({
          message: "Invalid landing page URL",
          details: urlValidation.error
        });
      }
      const sanitizedSource = sanitizeUtmParameter(utm_source);
      const sanitizedMedium = sanitizeUtmParameter(utm_medium);
      const sanitizedCampaign = sanitizeUtmParameter(utm_campaign);
      const sanitizedContent = utm_content ? sanitizeUtmParameter(utm_content) : void 0;
      const sanitizedTerm = utm_term ? sanitizeUtmParameter(utm_term) : void 0;
      if (!sanitizedSource || sanitizedSource.length === 0) {
        return res.status(400).json({ message: "Source is required and cannot be empty after sanitization" });
      }
      if (!sanitizedMedium || sanitizedMedium.length === 0) {
        return res.status(400).json({ message: "Medium is required and cannot be empty after sanitization" });
      }
      if (!sanitizedCampaign || sanitizedCampaign.length === 0) {
        return res.status(400).json({ message: "Campaign is required and cannot be empty after sanitization" });
      }
      if (sanitizedSource.length > 100) {
        return res.status(400).json({ message: "Source must be 100 characters or less" });
      }
      if (sanitizedMedium.length > 50) {
        return res.status(400).json({ message: "Medium must be 50 characters or less" });
      }
      if (sanitizedCampaign.length > 100) {
        return res.status(400).json({ message: "Campaign must be 100 characters or less" });
      }
      if (sanitizedContent && sanitizedContent.length > 100) {
        return res.status(400).json({ message: "Content must be 100 characters or less" });
      }
      if (sanitizedTerm && sanitizedTerm.length > 100) {
        return res.status(400).json({ message: "Term must be 100 characters or less" });
      }
      const finalUtmLink = generateUTMLink(urlValidation.cleanUrl, sanitizedSource, sanitizedMedium, sanitizedCampaign, sanitizedContent, sanitizedTerm);
      const utmLinkData = insertUtmLinkSchema.parse({
        ...req.body,
        userId: req.user.id,
        accountId: req.user.accountId,
        targetUrl: urlValidation.cleanUrl,
        // Store clean URL
        utm_source: sanitizedSource,
        utm_medium: sanitizedMedium,
        utm_campaign: sanitizedCampaign,
        utm_content: sanitizedContent || "",
        utm_term: sanitizedTerm || "",
        generatedUrl: finalUtmLink
      });
      const utmLink = await storage.createUtmLink(utmLinkData);
      res.json(utmLink);
    } catch (error) {
      if (error.name === "ZodError") {
        const fieldErrors = formatValidationError(error);
        return res.status(400).json({
          message: "Validation failed",
          errors: fieldErrors
        });
      }
      res.status(400).json({ message: error.message });
    }
  });
  app2.get("/api/utm-links", authMiddleware, requirePermission("read_campaigns"), async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 100, 1e3);
      const offset = Math.max(parseInt(req.query.offset) || 0, 0);
      const includeArchived = req.query.includeArchived === "true";
      const links = await storage.getUserUtmLinks(req.user.id, limit, offset, includeArchived);
      res.json(links);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  app2.delete("/api/utm-links/campaign/:campaignName", authMiddleware, requirePermission("edit_campaigns"), async (req, res) => {
    try {
      const campaignName = decodeURIComponent(req.params.campaignName);
      if (!campaignName || campaignName.length > 255) {
        return res.status(400).json({ message: "Invalid campaign name" });
      }
      const success = await storage.deleteUtmLinksByCampaign(req.user.id, campaignName);
      if (success) {
        res.json({ message: "Campaign links deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete campaign links" });
      }
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vercel-app.ts
var app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With, x-firebase-uid");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
var setupError = null;
var setupPromise = registerRoutes(app).then(() => {
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });
}).catch((err) => {
  console.error("Setup failed:", err);
  setupError = err;
});
var handler = async (req, res) => {
  await setupPromise;
  if (setupError) {
    return res.status(500).json({
      error: "Server setup failed",
      message: setupError.message,
      stack: setupError.stack
    });
  }
  return app(req, res);
};
var vercel_app_default = handler;
export {
  vercel_app_default as default
};
