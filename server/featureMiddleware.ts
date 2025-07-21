import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { accounts, users, pricingPlans } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface FeatureRequest extends Request {
  userFeatures?: Record<string, boolean>;
  userAccount?: any;
}

// Middleware to load user's feature permissions
export async function loadUserFeatures(req: FeatureRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId;
    if (!userId) {
      return next();
    }

    // Get user with account and pricing plan
    const [user] = await db
      .select({
        userId: users.id,
        accountId: users.accountId,
        accountName: accounts.name,
        pricingPlanId: accounts.pricingPlanId,
        features: pricingPlans.features
      })
      .from(users)
      .innerJoin(accounts, eq(users.accountId, accounts.id))
      .leftJoin(pricingPlans, eq(accounts.pricingPlanId, pricingPlans.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (user) {
      req.userFeatures = user.features || {};
      req.userAccount = {
        id: user.accountId,
        name: user.accountName,
        pricingPlanId: user.pricingPlanId
      };
    }

    next();
  } catch (error) {
    console.error('Feature middleware error:', error);
    next();
  }
}

// Feature check function
export function requireFeature(featureKey: string) {
  return (req: FeatureRequest, res: Response, next: NextFunction) => {
    const hasFeature = req.userFeatures?.[featureKey];
    
    if (!hasFeature) {
      return res.status(403).json({
        error: 'Feature not available',
        message: `This feature (${featureKey}) is not included in your current plan.`,
        featureKey,
        upgrade: true
      });
    }

    next();
  };
}

// Helper function to check if user has a feature
export function hasFeature(req: FeatureRequest, featureKey: string): boolean {
  return req.userFeatures?.[featureKey] || false;
}