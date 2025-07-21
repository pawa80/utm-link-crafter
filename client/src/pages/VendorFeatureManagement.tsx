import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVendorAuth } from '../contexts/VendorAuthContext';
import { useLocation } from 'wouter';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Check, X, Save } from 'lucide-react';
import { Switch } from '../components/ui/switch';
import { useToast } from '../hooks/use-toast';

interface PricingPlan {
  id: number;
  planName: string;
  features: Record<string, boolean>;
}

// Comprehensive feature list based on current plans
const ALL_FEATURES = [
  { key: 'basicUtmBuilder', name: 'Basic UTM Builder', category: 'Core Features' },
  { key: 'campaignManagement', name: 'Campaign Management', category: 'Core Features' },
  { key: 'analytics', name: 'Analytics Dashboard', category: 'Analytics' },
  { key: 'customTemplates', name: 'Custom Templates', category: 'Templates' },
  { key: 'chatWizard', name: 'Chat Wizard', category: 'AI Features' },
  { key: 'apiAccess', name: 'API Access', category: 'Integration' },
  { key: 'multiUser', name: 'Multi-User Accounts', category: 'Collaboration' },
  { key: 'whiteLabel', name: 'White Label', category: 'Branding' },
  { key: 'prioritySupport', name: 'Priority Support', category: 'Support' },
  { key: 'dedicatedSupport', name: 'Dedicated Support', category: 'Support' },
  { key: 'customIntegrations', name: 'Custom Integrations', category: 'Integration' },
  { key: 'advancedAnalytics', name: 'Advanced Analytics', category: 'Analytics' },
  { key: 'bulkOperations', name: 'Bulk Operations', category: 'Productivity' },
  { key: 'exportData', name: 'Data Export', category: 'Data Management' },
  { key: 'scheduledReports', name: 'Scheduled Reports', category: 'Reporting' },
  { key: 'teamCollaboration', name: 'Team Collaboration', category: 'Collaboration' },
  { key: 'customDomains', name: 'Custom Domains', category: 'Branding' },
  { key: 'ssoIntegration', name: 'SSO Integration', category: 'Security' },
  { key: 'auditLogs', name: 'Audit Logs', category: 'Security' },
  { key: 'advancedPermissions', name: 'Advanced Permissions', category: 'Security' }
];

const CATEGORIES = Array.from(new Set(ALL_FEATURES.map(f => f.category)));

const VendorFeatureManagement: React.FC = () => {
  const { token } = useVendorAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [features, setFeatures] = useState<Record<number, Record<string, boolean>>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: pricingPlans, isLoading } = useQuery<PricingPlan[]>({
    queryKey: ['/vendor-api/pricing-plans'],
    queryFn: async () => {
      const response = await fetch('/vendor-api/pricing-plans', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch pricing plans');
      const data = await response.json();
      
      // Initialize features state
      const initialFeatures: Record<number, Record<string, boolean>> = {};
      data.forEach((plan: PricingPlan) => {
        initialFeatures[plan.id] = { ...plan.features };
        // Ensure all features exist with default false
        ALL_FEATURES.forEach(feature => {
          if (!(feature.key in initialFeatures[plan.id])) {
            initialFeatures[plan.id][feature.key] = false;
          }
        });
      });
      setFeatures(initialFeatures);
      
      return data;
    },
    enabled: !!token
  });

  const saveFeaturesMutation = useMutation({
    mutationFn: async () => {
      const updatePromises = Object.entries(features).map(([planId, planFeatures]) => 
        fetch(`/vendor-api/pricing-plans/${planId}/features`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ features: planFeatures })
        })
      );
      
      await Promise.all(updatePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/vendor-api/pricing-plans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user-features'] }); // Clear user feature cache
      setHasChanges(false);
      toast({
        title: "Success",
        description: "Feature settings updated successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update feature settings",
        variant: "destructive"
      });
    }
  });

  const toggleFeature = (planId: number, featureKey: string) => {
    setFeatures(prev => ({
      ...prev,
      [planId]: {
        ...prev[planId],
        [featureKey]: !prev[planId]?.[featureKey]
      }
    }));
    setHasChanges(true);
  };

  const getFeatureIcon = (planId: number, featureKey: string) => {
    const isEnabled = features[planId]?.[featureKey];
    return isEnabled ? (
      <Check className="h-4 w-4 text-green-600" />
    ) : (
      <X className="h-4 w-4 text-gray-400" />
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/platform-control')}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Feature Management</h1>
            <p className="text-gray-600">Configure features across pricing plans</p>
          </div>
        </div>
        
        {hasChanges && (
          <Button
            onClick={() => saveFeaturesMutation.mutate()}
            disabled={saveFeaturesMutation.isPending}
            className="btn-gradient-primary"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ALL_FEATURES.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{CATEGORIES.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pricing Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pricingPlans?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hasChanges ? (
                <Badge variant="secondary">Unsaved</Badge>
              ) : (
                <Badge variant="default">Saved</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Matrix</CardTitle>
          <p className="text-sm text-gray-600">
            Toggle features for each pricing plan. Changes are highlighted and must be saved.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Feature</th>
                  <th className="text-left py-3 px-4 font-medium">Category</th>
                  {pricingPlans?.map(plan => (
                    <th key={plan.id} className="text-center py-3 px-4 font-medium min-w-[120px]">
                      {plan.planName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map(category => (
                  <React.Fragment key={category}>
                    <tr>
                      <td colSpan={2 + (pricingPlans?.length || 0)} className="py-2">
                        <Badge variant="outline" className="text-xs">
                          {category}
                        </Badge>
                      </td>
                    </tr>
                    {ALL_FEATURES.filter(f => f.category === category).map(feature => (
                      <tr key={feature.key} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{feature.name}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{feature.category}</td>
                        {pricingPlans?.map(plan => (
                          <td key={plan.id} className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              {getFeatureIcon(plan.id, feature.key)}
                              <Switch
                                checked={features[plan.id]?.[feature.key] || false}
                                onCheckedChange={() => toggleFeature(plan.id, feature.key)}
                              />
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorFeatureManagement;