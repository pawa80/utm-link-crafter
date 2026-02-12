// API endpoint for getting pricing plans for public signup
import { Router } from "express";
import { db } from "../db.js";
import { pricingPlans } from "@shared/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

// Get active pricing plans for signup
router.get("/pricing-plans", async (req, res) => {
  try {
    const plans = await db
      .select({
        id: pricingPlans.id,
        planCode: pricingPlans.planCode,
        planName: pricingPlans.planName,
        description: pricingPlans.description,
        monthlyPriceCents: pricingPlans.monthlyPriceCents,
        annualPriceCents: pricingPlans.annualPriceCents,
        maxCampaigns: pricingPlans.maxCampaigns,
        maxUsers: pricingPlans.maxUsers,
        maxUtmLinks: pricingPlans.maxUtmLinks,
        features: pricingPlans.features
      })
      .from(pricingPlans)
      .where(eq(pricingPlans.isActive, true))
      .orderBy(pricingPlans.sortOrder);
    
    res.json(plans);
  } catch (error: any) {
    console.error('Error fetching pricing plans:', error);
    res.status(500).json({ message: "Failed to fetch pricing plans" });
  }
});

export default router;