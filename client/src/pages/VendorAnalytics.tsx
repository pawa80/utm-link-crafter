import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useVendorAuth } from '@/contexts/VendorAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ArrowLeft, Calendar as CalendarIcon, BarChart3, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface ElementData {
  name: string;
  count: number;
  type: 'base' | 'custom';
  lastUsed: string;
  createdAt: string;
}

interface AnalyticsData {
  sources: ElementData[];
  mediums: ElementData[];
  content: ElementData[];
  terms: ElementData[];
  usage_timeline: Array<{ date: string; count: number }>;
}

interface TimelineData {
  date: string;
  [key: string]: string | number;
}

const VendorAnalytics: React.FC = () => {
  const { token } = useVendorAuth();
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date()
  });

  // Generate dynamic mock data based on date range
  const generateMockData = () => {
    const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
    const dates = [];
    
    // Generate dates for the selected range
    for (let i = 0; i <= daysDiff; i++) {
      const date = new Date(dateRange.from);
      date.setDate(date.getDate() + i);
      dates.push(format(date, 'yyyy-MM-dd'));
    }

    // Generate last used dates within the range
    const getRandomDateInRange = () => {
      const randomTime = dateRange.from.getTime() + Math.random() * (dateRange.to.getTime() - dateRange.from.getTime());
      return format(new Date(randomTime), 'yyyy-MM-dd');
    };

    return {
      sources: [
        { name: 'google', count: 125, type: 'base' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-07-01' },
        { name: 'facebook', count: 98, type: 'base' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-07-01' },
        { name: 'newsletter', count: 67, type: 'custom' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-08-15' },
        { name: 'youtube', count: 45, type: 'base' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-07-01' },
        { name: 'email-signature', count: 32, type: 'custom' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-09-10' }
      ],
      mediums: [
        { name: 'cpc', count: 203, type: 'base' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-07-01' },
        { name: 'social', count: 156, type: 'base' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-07-01' },
        { name: 'email', count: 89, type: 'base' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-07-01' },
        { name: 'newsletter', count: 67, type: 'custom' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-08-20' },
        { name: 'referral', count: 45, type: 'base' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-07-01' }
      ],
      content: [
        { name: 'banner-ad', count: 178, type: 'base' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-07-01' },
        { name: 'text-ad', count: 134, type: 'base' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-07-01' },
        { name: 'video-ad', count: 98, type: 'base' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-07-01' },
        { name: 'cta-button', count: 67, type: 'base' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-07-01' },
        { name: 'promo-2025', count: 43, type: 'custom' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-12-01' }
      ],
      terms: [
        { name: 'brand-keywords', count: 156, type: 'base' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-07-01' },
        { name: 'competitor-keywords', count: 89, type: 'base' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-07-01' },
        { name: 'product-keywords', count: 67, type: 'base' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-07-01' },
        { name: 'variant-a', count: 45, type: 'base' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-07-01' },
        { name: 'retargeting', count: 32, type: 'custom' as const, lastUsed: getRandomDateInRange(), createdAt: '2024-09-15' }
      ],
      usage_timeline: dates.map(date => ({
        date,
        count: Math.floor(Math.random() * 50) + 10
      }))
    };
  };

  const analyticsData = generateMockData();
  const isLoading = false;

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const generateTimelineData = (elements: ElementData[]) => {
    const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
    const dates = [];
    
    // Generate dates for the selected range
    for (let i = 0; i <= daysDiff; i++) {
      const date = new Date(dateRange.from);
      date.setDate(date.getDate() + i);
      dates.push(format(date, 'MMM dd'));
    }

    const top5Elements = elements.slice(0, 5);
    
    return dates.map(date => {
      const dataPoint: TimelineData = { date };
      top5Elements.forEach(element => {
        dataPoint[element.name] = Math.floor(Math.random() * element.count * 0.1) + 1;
      });
      return dataPoint;
    });
  };

  const renderElementTable = (data: ElementData[], title: string, color: string) => {
    const safeData = data || [];
    const timelineData = generateTimelineData(safeData);
    const top5Elements = safeData.slice(0, 5);

    const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>{title}</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Usage Count</TableHead>
                <TableHead>Last Used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safeData.slice(0, 10).map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                      color === 'blue' ? 'bg-blue-100 text-blue-600' :
                      color === 'purple' ? 'bg-purple-100 text-purple-600' :
                      color === 'green' ? 'bg-green-100 text-green-600' :
                      'bg-orange-100 text-orange-600'
                    }`}>
                      {index + 1}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant={item.type === 'base' ? 'default' : 'secondary'} className={item.type === 'base' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                      {item.type === 'base' ? 'Base' : 'Custom'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatNumber(item.count)}</TableCell>
                  <TableCell className="text-gray-600">{new Date(item.lastUsed).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="lg:col-span-1">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-4">Top 5 Usage Timeline</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={10} />
                <YAxis fontSize={12} />
                <Tooltip />
                {top5Elements.map((element, index) => (
                  <Line 
                    key={element.name}
                    type="monotone" 
                    dataKey={element.name} 
                    stroke={colors[index]} 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1">
              {top5Elements.map((element, index) => (
                <div key={element.name} className="flex items-center gap-2 text-xs">
                  <div 
                    className="w-3 h-3 rounded" 
                    style={{ backgroundColor: colors[index] }}
                  />
                  <span className="truncate">{element.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
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
              <h1 className="text-xl font-bold text-gray-900">Platform Analytics Dashboard</h1>
              <p className="text-sm text-gray-600">Comprehensive usage analytics with date filtering</p>
            </div>
          </div>
          
          {/* Date Range Picker */}
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    if (range?.from) {
                      setDateRange({
                        from: range.from,
                        to: range.to || range.from
                      });
                    }
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-8">
        {/* Usage Timeline Overview */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Usage Timeline
            </CardTitle>
            <CardDescription className="text-gray-600">
              Campaign creation activity over the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={analyticsData?.usage_timeline || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sources Analytics */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              UTM Sources Analytics
            </CardTitle>
            <CardDescription className="text-gray-600">
              Most used UTM sources across platform for the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsData?.sources ? renderElementTable(analyticsData.sources, 'Source', 'blue') : (
              <p className="text-center text-gray-500 py-8">No source data available</p>
            )}
          </CardContent>
        </Card>

        {/* Mediums Analytics */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              UTM Mediums Analytics
            </CardTitle>
            <CardDescription className="text-gray-600">
              Most used UTM mediums across platform for the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsData?.mediums ? renderElementTable(analyticsData.mediums, 'Medium', 'purple') : (
              <p className="text-center text-gray-500 py-8">No medium data available</p>
            )}
          </CardContent>
        </Card>

        {/* Content Analytics */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              UTM Content Analytics
            </CardTitle>
            <CardDescription className="text-gray-600">
              Most used UTM content across platform for the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsData?.content ? renderElementTable(analyticsData.content, 'Content', 'green') : (
              <p className="text-center text-gray-500 py-8">No content data available</p>
            )}
          </CardContent>
        </Card>

        {/* Terms Analytics */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              UTM Terms Analytics
            </CardTitle>
            <CardDescription className="text-gray-600">
              Most used UTM terms across platform for the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsData?.terms ? renderElementTable(analyticsData.terms, 'Term', 'orange') : (
              <p className="text-center text-gray-500 py-8">No terms data available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VendorAnalytics;