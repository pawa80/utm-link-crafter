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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUtmLink = z.infer<typeof insertUtmLinkSchema>;
export type UtmLink = typeof utmLinks.$inferSelect;
export type UpdateUser = z.infer<typeof updateUserSchema>;
