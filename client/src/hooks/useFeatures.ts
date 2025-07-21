import { useQuery } from '@tanstack/react-query';

interface UserFeatures {
  features: Record<string, boolean>;
  account: {
    id: number;
    name: string;
    pricingPlanId: number | null;
  } | null;
}

export function useFeatures() {
  return useQuery<UserFeatures>({
    queryKey: ['/api/user-features'],
    staleTime: 30 * 1000, // 30 seconds for faster feature updates
    retry: 3,
    retryDelay: 1000,
  });
}

export function useHasFeature(featureKey: string): boolean {
  const { data: userFeatures } = useFeatures();
  return userFeatures?.features[featureKey] || false;
}

export function useFeatureGuard(featureKey: string) {
  const hasFeature = useHasFeature(featureKey);
  const { data: userFeatures } = useFeatures();
  
  return {
    hasFeature,
    account: userFeatures?.account,
    requiresUpgrade: !hasFeature
  };
}