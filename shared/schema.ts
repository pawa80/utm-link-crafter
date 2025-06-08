import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  sourceName: text("source_name").notNull(),
  mediums: text("mediums").array().default([]),
  formats: text("formats").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const utmLinks = pgTable("utm_links", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id).notNull(),
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUtmLink = z.infer<typeof insertUtmLinkSchema>;
export type UtmLink = typeof utmLinks.$inferSelect;
export type InsertSourceTemplate = z.infer<typeof insertSourceTemplateSchema>;
export type SourceTemplate = typeof sourceTemplates.$inferSelect;
export type UpdateUser = z.infer<typeof updateUserSchema>;
