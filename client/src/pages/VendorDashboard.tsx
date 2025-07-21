import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useVendorAuth } from '@/contexts/VendorAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Building2, 
  Link, 
  Target, 
  TrendingUp, 
  AlertCircle,
  LogOut,
  Settings,
  Database,
  BarChart3
} from 'lucide-react';

interface DashboardData {
  totals: {
    accounts: number;
    users: number;
    campaigns: number;
    utmLinks: number;
  };
  accountStatusBreakdown: Array<{ status: string; count: number }>;
  planBreakdown: Array<{ planName: string; count: number }>;
  recentAccounts: Array<{
    id: number;
    name: string;
    accountStatus: string;
    createdAt: string;
    userCount: number;
  }>;
}

const VendorDashboard: React.FC = () => {
  const { vendorUser, logout, token } = useVendorAuth();

  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ['/vendor-api/analytics/dashboard'],
    queryFn: async () => {
      const response = await fetch('/vendor-api/analytics/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    },
    enabled: !!token
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

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-700">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          Loading platform data...
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
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Platform Control</h1>
              <p className="text-sm text-gray-600">UTM Builder Administration</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{vendorUser?.fullName}</p>
              <p className="text-xs text-gray-600 capitalize">{vendorUser?.role.replace('_', ' ')}</p>
            </div>
            <Button
              onClick={logout}
              variant="outline"
              size="sm"
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Accounts</CardTitle>
              <Building2 className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(dashboardData?.totals.accounts || 0)}</div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
              <Users className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(dashboardData?.totals.users || 0)}</div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Campaigns</CardTitle>
              <Target className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(dashboardData?.totals.campaigns || 0)}</div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total UTM Links</CardTitle>
              <Link className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(dashboardData?.totals.utmLinks || 0)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Account Status and Plan Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Account Status Breakdown</CardTitle>
              <CardDescription className="text-gray-600">Distribution of account statuses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboardData?.accountStatusBreakdown.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(item.status)}`} />
                    <span className="text-gray-700 capitalize">{item.status}</span>
                  </div>
                  <Badge variant="outline" className="border-gray-300 text-gray-700">
                    {formatNumber(item.count)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Pricing Plan Distribution</CardTitle>
              <CardDescription className="text-gray-600">Accounts by pricing plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboardData?.planBreakdown.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-gray-700">{item.planName || 'No Plan'}</span>
                  <Badge variant="outline" className="border-gray-300 text-gray-700">
                    {formatNumber(item.count)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={() => window.location.href = '/platform-control/accounts'}
            className="h-16 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
          >
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5" />
              <div className="text-left">
                <div className="font-semibold">Manage Accounts</div>
                <div className="text-xs opacity-90">Status, Plans & Users</div>
              </div>
            </div>
          </Button>

          <Button
            onClick={() => window.location.href = '/platform-control/templates'}
            className="h-16 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white"
          >
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5" />
              <div className="text-left">
                <div className="font-semibold">Base Templates</div>
                <div className="text-xs opacity-90">UTM & Term Templates</div>
              </div>
            </div>
          </Button>

          <Button
            onClick={() => window.location.href = '/platform-control/analytics'}
            className="h-16 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5" />
              <div className="text-left">
                <div className="font-semibold">Platform Analytics</div>
                <div className="text-xs opacity-90">Custom Elements & Stats</div>
              </div>
            </div>
          </Button>
        </div>

        {/* Recent Accounts */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Recent Accounts</CardTitle>
            <CardDescription className="text-gray-600">Latest account registrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData?.recentAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(account.accountStatus)}`} />
                    <div>
                      <p className="font-medium text-gray-900">{account.name}</p>
                      <p className="text-sm text-gray-600">
                        {account.userCount} user{account.userCount !== 1 ? 's' : ''} • 
                        {new Date(account.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`border-gray-300 capitalize ${
                      account.accountStatus === 'active' ? 'text-green-600' :
                      account.accountStatus === 'trial' ? 'text-blue-600' :
                      account.accountStatus === 'suspended' ? 'text-red-600' : 
                      'text-gray-600'
                    }`}
                  >
                    {account.accountStatus}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VendorDashboard;