import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useVendorAuth } from '@/contexts/VendorAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, TrendingUp, Database, Users, Target } from 'lucide-react';

interface CustomElementsData {
  customMediums: Array<{ medium: string; count: number }>;
  customContent: Array<{ content: string; count: number }>;
  customTerms: Array<{ term: string; count: number }>;
  customSources: Array<{ source: string; count: number }>;
}

const VendorAnalytics: React.FC = () => {
  const { token } = useVendorAuth();

  const { data: customElements, isLoading } = useQuery<CustomElementsData>({
    queryKey: ['/vendor-api/analytics/custom-elements'],
    queryFn: async () => {
      const response = await fetch('/vendor-api/analytics/custom-elements', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch custom elements');
      return response.json();
    },
    enabled: !!token
  });

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-700">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          Loading analytics...
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
              <h1 className="text-xl font-bold text-gray-900">Platform Analytics</h1>
              <p className="text-sm text-gray-600">Cross-account usage statistics and custom elements</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Overview */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Custom Elements Analytics
            </CardTitle>
            <CardDescription className="text-gray-600">
              Most frequently used custom UTM parameters across all accounts
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Custom Elements Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Custom Sources */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Top Custom Sources</CardTitle>
              <CardDescription className="text-gray-600">Most used UTM sources across platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {customElements?.customSources.slice(0, 10).map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-600">#{index + 1}</span>
                      </div>
                      <span className="text-gray-900 font-medium">{item.source}</span>
                    </div>
                    <Badge variant="outline" className="border-gray-300 text-gray-700">
                      {formatNumber(item.count)} uses
                    </Badge>
                  </div>
                ))}
                {customElements?.customSources.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No custom sources found</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Custom Mediums */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Top Custom Mediums</CardTitle>
              <CardDescription className="text-gray-600">Most used UTM mediums across platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {customElements?.customMediums.slice(0, 10).map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-purple-600">#{index + 1}</span>
                      </div>
                      <span className="text-gray-900 font-medium">{item.medium}</span>
                    </div>
                    <Badge variant="outline" className="border-gray-300 text-gray-700">
                      {formatNumber(item.count)} uses
                    </Badge>
                  </div>
                ))}
                {customElements?.customMediums.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No custom mediums found</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Custom Content */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Top Custom Content</CardTitle>
              <CardDescription className="text-gray-600">Most used UTM content across platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {customElements?.customContent.slice(0, 10).map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-green-600">#{index + 1}</span>
                      </div>
                      <span className="text-gray-900 font-medium">{item.content}</span>
                    </div>
                    <Badge variant="outline" className="border-gray-300 text-gray-700">
                      {formatNumber(item.count)} uses
                    </Badge>
                  </div>
                ))}
                {customElements?.customContent.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No custom content found</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Custom Terms */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Top Custom Terms</CardTitle>
              <CardDescription className="text-gray-600">Most used UTM terms across platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {customElements?.customTerms.slice(0, 10).map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-orange-600">#{index + 1}</span>
                      </div>
                      <span className="text-gray-900 font-medium">{item.term}</span>
                    </div>
                    <Badge variant="outline" className="border-gray-300 text-gray-700">
                      {formatNumber(item.count)} uses
                    </Badge>
                  </div>
                ))}
                {customElements?.customTerms.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No custom terms found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Insights */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Platform Insights</CardTitle>
            <CardDescription className="text-gray-600">Key observations from usage data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">Template Effectiveness</h3>
                </div>
                <p className="text-sm text-blue-700">
                  Monitor which base templates are most frequently customized to identify popular patterns
                </p>
              </div>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-green-900">Usage Patterns</h3>
                </div>
                <p className="text-sm text-green-700">
                  Track how users customize templates to improve the base template library
                </p>
              </div>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-purple-900">Optimization</h3>
                </div>
                <p className="text-sm text-purple-700">
                  Use this data to create new base templates that match common custom patterns
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VendorAnalytics;