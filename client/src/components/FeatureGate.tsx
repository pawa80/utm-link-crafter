import React from 'react';
import { useHasFeature, useFeatures } from '../hooks/useFeatures';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Lock, Zap } from 'lucide-react';

interface FeatureGateProps {
  featureKey: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
}

export function FeatureGate({ featureKey, children, fallback, showUpgrade = true }: FeatureGateProps) {
  const hasFeature = useHasFeature(featureKey);
  const { data: userFeatures } = useFeatures();

  if (hasFeature) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showUpgrade) {
    return (
      <Card className="border-2 border-dashed border-muted-foreground/30 bg-muted/30">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 bg-muted-foreground/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={32} className="text-muted-foreground" />
          </div>
          <CardTitle className="text-xl font-bold text-muted-foreground">
            Feature Locked
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            This feature is not available in your current plan
          </p>
        </CardHeader>
        <CardContent className="text-center">
          <Button variant="outline" size="sm" className="mr-2">
            <Zap className="w-4 h-4 mr-2" />
            Upgrade Plan
          </Button>
          <div className="text-xs text-muted-foreground mt-2">
            Account: {userFeatures?.account?.name || 'Unknown'}
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

export default FeatureGate;