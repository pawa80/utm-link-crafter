import { db } from "./db";
import { vendorUsers, pricingPlans } from "@shared/schema";
import { hashPassword } from "./vendorAuth";
import { eq } from "drizzle-orm";

export async function setupVendorSystem() {
  try {
    console.log('Setting up vendor system...');

    // Check if vendor users already exist
    const existingVendorUsers = await db.select().from(vendorUsers).limit(1);
    
    if (existingVendorUsers.length > 0) {
      console.log('Vendor system already set up, skipping initialization');
      return;
    }

    // Create default vendor admin user
    const defaultPassword = 'VendorAdmin2025!';
    const hashedPassword = await hashPassword(defaultPassword);

    await db.insert(vendorUsers).values({
      email: 'admin@utmbuilder.vendor',
      passwordHash: hashedPassword,
      fullName: 'Vendor Administrator',
      role: 'super_admin',
      isActive: true,
      createdAt: new Date()
    });

    console.log('Created default vendor admin user:');
    console.log('Email: admin@utmbuilder.vendor');
    console.log('Password: VendorAdmin2025!');
    console.log('Access URL: /vendor-admin-38291');

    // Create default pricing plans
    const defaultPlans = [
      {
        planCode: 'free',
        planName: 'Free Plan',
        planDescription: 'Basic UTM link building for personal use',
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
        planCode: 'starter',
        planName: 'Starter Plan',
        planDescription: 'Perfect for small teams and growing businesses',
        monthlyPriceCents: 1900, // $19/month
        annualPriceCents: 19000, // $190/year (2 months free)
        maxCampaigns: 100,
        maxUsers: 3,
        maxUtmLinks: 1000,
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
        planCode: 'professional',
        planName: 'Professional Plan',
        planDescription: 'Advanced features for marketing teams',
        monthlyPriceCents: 4900, // $49/month
        annualPriceCents: 49000, // $490/year (2 months free)
        maxCampaigns: 500,
        maxUsers: 10,
        maxUtmLinks: 10000,
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
        planCode: 'enterprise',
        planName: 'Enterprise Plan',
        planDescription: 'Unlimited features for large organizations',
        monthlyPriceCents: 9900, // $99/month
        annualPriceCents: 99000, // $990/year (2 months free)
        maxCampaigns: null, // unlimited
        maxUsers: null, // unlimited
        maxUtmLinks: null, // unlimited
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

    // Check if pricing plans already exist
    const existingPlans = await db.select().from(pricingPlans).limit(1);
    
    if (existingPlans.length === 0) {
      await db.insert(pricingPlans).values(defaultPlans);
      console.log('Created default pricing plans');
    }

    console.log('Vendor system setup complete!');
    console.log('\n=== VENDOR ACCESS INFORMATION ===');
    console.log('URL: /vendor-admin-38291');
    console.log('Email: admin@utmbuilder.vendor');
    console.log('Password: VendorAdmin2025!');
    console.log('====================================\n');

  } catch (error) {
    console.error('Error setting up vendor system:', error);
    throw error;
  }
}

// Migration function to update existing accounts with default pricing plan
export async function assignDefaultPricingPlans() {
  try {
    console.log('Assigning default pricing plans to existing accounts...');
    
    // Get the free plan
    const [freePlan] = await db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.planCode, 'free'));
    
    if (!freePlan) {
      console.log('Free plan not found, skipping pricing plan assignment');
      return;
    }

    // Update accounts that don't have a pricing plan
    const { accounts } = await import("@shared/schema");
    
    const result = await db
      .update(accounts)
      .set({ pricingPlanId: freePlan.id })
      .where(eq(accounts.pricingPlanId, null));
    
    console.log('Assigned free plan to accounts without pricing plans');
    
  } catch (error) {
    console.error('Error assigning default pricing plans:', error);
  }
}