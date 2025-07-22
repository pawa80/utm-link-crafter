import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVendorAuth } from '@/contexts/VendorAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2, 
  Users, 
  Target, 
  Link, 
  Settings,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowLeft
} from 'lucide-react';

interface Account {
  account: {
    id: number;
    name: string;
    accountStatus: string;
    createdAt: string;
    pricingPlanId?: number;
    industry?: string;
    teamSize?: string;
    useCases?: string[];
  };
  plan?: {
    id: number;
    planName: string;
    planCode: string;
  };
  userCount: number;
  campaignCount: number;
  utmLinkCount: number;
}

interface PricingPlan {
  id: number;
  planCode: string;
  planName: string;
  monthlyPriceCents: number;
  maxCampaigns?: number;
  maxUsers?: number;
  maxUtmLinks?: number;
  features: any;
}

const VendorAccounts: React.FC = () => {
  const { token } = useVendorAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [actionType, setActionType] = useState<'status' | 'plan' | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [newPlanId, setNewPlanId] = useState('');

  const { data: accounts, isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ['/vendor-api/accounts', statusFilter, planFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (planFilter && planFilter !== 'all') params.append('planId', planFilter);
      
      const response = await fetch(`/vendor-api/accounts?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch accounts');
      return response.json();
    },
    enabled: !!token
  });

  const { data: pricingPlans } = useQuery<PricingPlan[]>({
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

  const updateStatusMutation = useMutation({
    mutationFn: async ({ accountId, newStatus, reason }: { accountId: number; newStatus: string; reason: string }) => {
      const response = await fetch(`/vendor-api/accounts/${accountId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newStatus, reason })
      });
      if (!response.ok) throw new Error('Failed to update account status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/vendor-api/accounts'] });
      toast({ title: 'Account status updated successfully' });
      setSelectedAccount(null);
      setActionType(null);
      setNewStatus('');
      setStatusReason('');
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update account status', description: error.message, variant: 'destructive' });
    }
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ accountId, pricingPlanId }: { accountId: number; pricingPlanId: number }) => {
      const response = await fetch(`/vendor-api/accounts/${accountId}/plan`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pricingPlanId })
      });
      if (!response.ok) throw new Error('Failed to update account plan');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/vendor-api/accounts'] });
      toast({ title: 'Account plan updated successfully' });
      setSelectedAccount(null);
      setActionType(null);
      setNewPlanId('');
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update account plan', description: error.message, variant: 'destructive' });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'trial': return 'bg-blue-500';
      case 'suspended': return 'bg-red-500';
      case 'cancelled': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'trial': return <AlertTriangle className="w-4 h-4 text-blue-500" />;
      case 'suspended': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-gray-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const handleStatusUpdate = () => {
    if (!selectedAccount || !newStatus) return;
    updateStatusMutation.mutate({
      accountId: selectedAccount.account.id,
      newStatus,
      reason: statusReason
    });
  };

  const handlePlanUpdate = () => {
    if (!selectedAccount || !newPlanId) return;
    updatePlanMutation.mutate({
      accountId: selectedAccount.account.id,
      pricingPlanId: Number(newPlanId)
    });
  };

  if (accountsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-700">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          Loading accounts...
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
              onClick={() => window.location.replace('/platform-control')}
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Account Management</h1>
              <p className="text-sm text-gray-600">Manage customer accounts and settings</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Filters */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div className="flex-1">
              <Label className="text-gray-700">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-gray-700">Pricing Plan</Label>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="All plans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  {pricingPlans?.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id.toString()}>
                      {plan.planName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => {
                setStatusFilter('all');
                setPlanFilter('all');
              }}
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50 self-end"
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>

        {/* Accounts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {accounts?.map((account) => (
            <Card key={account.account.id} className="bg-white border-gray-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-gray-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    {account.account.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(account.account.accountStatus)}
                    <Badge 
                      variant="outline" 
                      className={`border-gray-300 capitalize ${
                        account.account.accountStatus === 'active' ? 'text-green-600' :
                        account.account.accountStatus === 'trial' ? 'text-blue-600' :
                        account.account.accountStatus === 'suspended' ? 'text-red-600' : 
                        'text-gray-600'
                      }`}
                    >
                      {account.account.accountStatus}
                    </Badge>
                  </div>
                </div>
                <CardDescription className="text-gray-600 space-y-1">
                  <div>
                    <span className="font-semibold">Plan:</span> {account.plan?.planName || 'No Plan'} • 
                    <span className="font-semibold">Created:</span> {new Date(account.account.createdAt).toLocaleDateString()}
                  </div>
                  {(account.account.industry || account.account.teamSize || (account.account.useCases && account.account.useCases.length > 0)) && (
                    <div className="space-y-1 text-sm">
                      {account.account.industry && (
                        <div>
                          <span className="font-semibold text-gray-700">Industry:</span> {account.account.industry}
                        </div>
                      )}
                      {account.account.teamSize && (
                        <div>
                          <span className="font-semibold text-gray-700">Team Size:</span> {account.account.teamSize}
                        </div>
                      )}
                      {account.account.useCases && account.account.useCases.length > 0 && (
                        <div>
                          <span className="font-semibold text-gray-700">Use Cases:</span> {account.account.useCases.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="font-semibold text-gray-900">{account.userCount}</div>
                    <div className="text-xs text-gray-500">Users</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                      <Target className="w-4 h-4" />
                    </div>
                    <div className="font-semibold text-gray-900">{account.campaignCount}</div>
                    <div className="text-xs text-gray-500">Campaigns</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                      <Link className="w-4 h-4" />
                    </div>
                    <div className="font-semibold text-gray-900">{account.utmLinkCount}</div>
                    <div className="text-xs text-gray-500">UTM Links</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        onClick={() => {
                          setSelectedAccount(account);
                          setActionType('status');
                          setNewStatus(account.account.accountStatus);
                        }}
                        variant="outline"
                        size="sm"
                        className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        Change Status
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white border-gray-200 text-gray-900">
                      <DialogHeader>
                        <DialogTitle>Change Account Status</DialogTitle>
                        <DialogDescription className="text-gray-600">
                          Update the status for {selectedAccount?.account.name}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>New Status</Label>
                          <Select value={newStatus} onValueChange={setNewStatus}>
                            <SelectTrigger className="bg-white border-gray-300">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="trial">Trial</SelectItem>
                              <SelectItem value="suspended">Suspended</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Reason (optional)</Label>
                          <Textarea
                            value={statusReason}
                            onChange={(e) => setStatusReason(e.target.value)}
                            placeholder="Reason for status change..."
                            className="bg-white border-gray-300"
                          />
                        </div>
                        <Button
                          onClick={handleStatusUpdate}
                          disabled={updateStatusMutation.isPending}
                          className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                          {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        onClick={() => {
                          setSelectedAccount(account);
                          setActionType('plan');
                          setNewPlanId(account.account.pricingPlanId?.toString() || '');
                        }}
                        variant="outline"
                        size="sm"
                        className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        Change Plan
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white border-gray-200 text-gray-900">
                      <DialogHeader>
                        <DialogTitle>Change Pricing Plan</DialogTitle>
                        <DialogDescription className="text-gray-600">
                          Update the pricing plan for {selectedAccount?.account.name}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>New Plan</Label>
                          <Select value={newPlanId} onValueChange={setNewPlanId}>
                            <SelectTrigger className="bg-white border-gray-300">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {pricingPlans?.map((plan) => (
                                <SelectItem key={plan.id} value={plan.id.toString()}>
                                  {plan.planName} - {formatPrice(plan.monthlyPriceCents)}/month
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={handlePlanUpdate}
                          disabled={updatePlanMutation.isPending}
                          className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                          {updatePlanMutation.isPending ? 'Updating...' : 'Update Plan'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {accounts?.length === 0 && (
          <Card className="bg-white border-gray-200">
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No accounts found</h3>
                <p className="text-gray-600">Try adjusting your filters to see more results</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default VendorAccounts;