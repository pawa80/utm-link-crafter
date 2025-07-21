import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVendorAuth } from '@/contexts/VendorAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  DollarSign, 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  Target, 
  Link,
  Calendar,
  Settings,
  ArrowLeft
} from 'lucide-react';
import { useLocation } from 'wouter';

interface PricingPlan {
  id: number;
  planCode: string;
  planName: string;
  description: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  trialDays: number;
  maxCampaigns: number | null;
  maxUsers: number | null;
  maxUtmLinks: number | null;
  features: Record<string, any>;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  accountCount?: number;
}

interface PlanFormData {
  planCode: string;
  planName: string;
  description: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  trialDays: number;
  maxCampaigns: number | null;
  maxUsers: number | null;
  maxUtmLinks: number | null;
  features: Record<string, any>;
  isActive: boolean;
  sortOrder: number;
}

const VendorPricingPlans: React.FC = () => {
  const { token } = useVendorAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [formData, setFormData] = useState<PlanFormData>({
    planCode: '',
    planName: '',
    description: '',
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    trialDays: 14,
    maxCampaigns: null,
    maxUsers: null,
    maxUtmLinks: null,
    features: {},
    isActive: true,
    sortOrder: 0
  });

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
      return response.json();
    },
    enabled: !!token
  });

  const createPlanMutation = useMutation({
    mutationFn: async (planData: PlanFormData) => {
      const response = await fetch('/vendor-api/pricing-plans', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(planData)
      });
      if (!response.ok) throw new Error('Failed to create pricing plan');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/vendor-api/pricing-plans'] });
      setIsDialogOpen(false);
      resetForm();
    }
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, planData }: { id: number; planData: PlanFormData }) => {
      const response = await fetch(`/vendor-api/pricing-plans/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(planData)
      });
      if (!response.ok) throw new Error('Failed to update pricing plan');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/vendor-api/pricing-plans'] });
      setIsDialogOpen(false);
      setEditingPlan(null);
      resetForm();
    }
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/vendor-api/pricing-plans/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to delete pricing plan');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/vendor-api/pricing-plans'] });
    }
  });

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  const resetForm = () => {
    setFormData({
      planCode: '',
      planName: '',
      description: '',
      monthlyPriceCents: 0,
      annualPriceCents: 0,
      trialDays: 14,
      maxCampaigns: null,
      maxUsers: null,
      maxUtmLinks: null,
      features: {},
      isActive: true,
      sortOrder: 0
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingPlan(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (plan: PricingPlan) => {
    setFormData({
      planCode: plan.planCode,
      planName: plan.planName,
      description: plan.description,
      monthlyPriceCents: plan.monthlyPriceCents,
      annualPriceCents: plan.annualPriceCents,
      trialDays: plan.trialDays,
      maxCampaigns: plan.maxCampaigns,
      maxUsers: plan.maxUsers,
      maxUtmLinks: plan.maxUtmLinks,
      features: plan.features,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder
    });
    setEditingPlan(plan);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, planData: formData });
    } else {
      createPlanMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this pricing plan? This action cannot be undone.')) {
      deletePlanMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-700">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          Loading pricing plans...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/platform-control')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-700 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Pricing Plans Management</h1>
              <p className="text-sm text-gray-600">Configure subscription plans and pricing</p>
            </div>
          </div>
          <Button onClick={openCreateDialog} className="btn-gradient-primary">
            <Plus className="w-4 h-4 mr-2" />
            Create Plan
          </Button>
        </div>
      </header>

      <div className="p-6">
        {/* Plans Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="bg-white border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Plans</CardTitle>
              <Settings className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{pricingPlans?.length || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active Plans</CardTitle>
              <Target className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {pricingPlans?.filter(p => p.isActive).length || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Accounts</CardTitle>
              <Users className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {pricingPlans?.reduce((sum, plan) => sum + (plan.accountCount || 0), 0) || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Avg Monthly Price</CardTitle>
              <DollarSign className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                ${pricingPlans && pricingPlans.length > 0 
                  ? (pricingPlans.reduce((sum, plan) => sum + plan.monthlyPriceCents, 0) / pricingPlans.length / 100).toFixed(2)
                  : '0.00'
                }
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plans Table */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Pricing Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan Details</TableHead>
                  <TableHead>Pricing</TableHead>
                  <TableHead>Limits</TableHead>
                  <TableHead>Trial</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Accounts</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pricingPlans?.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900">{plan.planName}</div>
                        <div className="text-sm text-gray-600">{plan.planCode}</div>
                        {plan.description && (
                          <div className="text-xs text-gray-500 mt-1">{plan.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          <span className="font-medium">${formatPrice(plan.monthlyPriceCents)}</span>
                          <span className="text-gray-500">/month</span>
                        </div>
                        {plan.annualPriceCents > 0 && (
                          <div className="text-xs text-gray-500">
                            ${formatPrice(plan.annualPriceCents)}/year
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-xs">
                        <div>Campaigns: {plan.maxCampaigns || '∞'}</div>
                        <div>Users: {plan.maxUsers || '∞'}</div>
                        <div>Links: {plan.maxUtmLinks || '∞'}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {plan.trialDays} days
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={plan.isActive ? 'default' : 'secondary'}
                        className={plan.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}
                      >
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{plan.accountCount || 0}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(plan)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(plan.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Plan Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? 'Edit Pricing Plan' : 'Create New Pricing Plan'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="planCode">Plan Code</Label>
                <Input
                  id="planCode"
                  value={formData.planCode}
                  onChange={(e) => setFormData({ ...formData, planCode: e.target.value })}
                  placeholder="e.g. basic, pro, enterprise"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planName">Plan Name</Label>
                <Input
                  id="planName"
                  value={formData.planName}
                  onChange={(e) => setFormData({ ...formData, planName: e.target.value })}
                  placeholder="e.g. Basic Plan, Pro Plan"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Plan description..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyPrice">Monthly Price ($)</Label>
                <Input
                  id="monthlyPrice"
                  type="number"
                  step="0.01"
                  value={formData.monthlyPriceCents / 100}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    monthlyPriceCents: Math.round(parseFloat(e.target.value || '0') * 100)
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="annualPrice">Annual Price ($)</Label>
                <Input
                  id="annualPrice"
                  type="number"
                  step="0.01"
                  value={formData.annualPriceCents / 100}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    annualPriceCents: Math.round(parseFloat(e.target.value || '0') * 100)
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trialDays">Trial Days</Label>
                <Input
                  id="trialDays"
                  type="number"
                  value={formData.trialDays}
                  onChange={(e) => setFormData({ ...formData, trialDays: parseInt(e.target.value || '0') })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxCampaigns">Max Campaigns</Label>
                <Input
                  id="maxCampaigns"
                  type="number"
                  value={formData.maxCampaigns || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    maxCampaigns: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  placeholder="Unlimited"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxUsers">Max Users</Label>
                <Input
                  id="maxUsers"
                  type="number"
                  value={formData.maxUsers || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    maxUsers: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  placeholder="Unlimited"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxUtmLinks">Max UTM Links</Label>
                <Input
                  id="maxUtmLinks"
                  type="number"
                  value={formData.maxUtmLinks || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    maxUtmLinks: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  placeholder="Unlimited"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Plan is active</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value || '0') })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
              className="btn-gradient-primary"
            >
              {createPlanMutation.isPending || updatePlanMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : null}
              {editingPlan ? 'Update Plan' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorPricingPlans;