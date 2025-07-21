import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVendorAuth } from '@/contexts/VendorAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Database, Tag } from 'lucide-react';

interface BaseTemplate {
  id: number;
  source?: string;
  medium?: string;
  content?: string;
  term?: string;
  category?: string;
  isActive: boolean;
  vendorManaged: boolean;
  createdAt: string;
}

interface SourceTemplateGroup {
  source: string;
  mediums: {
    medium: string;
    content: string[];
    templates: BaseTemplate[];
  }[];
}

interface TermTemplate {
  id: number;
  term: string;
  category: string;
  isActive: boolean;
  vendorManaged: boolean;
  createdAt: string;
}

const VendorTemplates: React.FC = () => {
  const { token } = useVendorAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'utm' | 'term'>('utm');
  const [newTemplate, setNewTemplate] = useState<any>({});
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  // Fetch UTM templates grouped by source
  const { data: utmTemplateGroups, isLoading: utmLoading } = useQuery<SourceTemplateGroup[]>({
    queryKey: ['/vendor-api/base-templates/utm-grouped'],
    queryFn: async () => {
      const response = await fetch('/vendor-api/base-templates/utm-grouped', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch UTM templates');
      return response.json();
    },
    enabled: !!token && activeTab === 'utm'
  });

  // Fetch term templates
  const { data: termTemplates, isLoading: termLoading } = useQuery<TermTemplate[]>({
    queryKey: ['/vendor-api/base-templates/term'],
    queryFn: async () => {
      const response = await fetch('/vendor-api/base-templates/term', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch term templates');
      return response.json();
    },
    enabled: !!token && activeTab === 'term'
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: any) => {
      const endpoint = activeTab === 'utm' ? '/vendor-api/base-templates/utm' : '/vendor-api/base-templates/term';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
      });
      if (!response.ok) throw new Error('Failed to create template');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/vendor-api/base-templates'] });
      toast({ title: 'Template created successfully' });
      setIsCreateDialogOpen(false);
      setNewTemplate({});
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create template', description: error.message, variant: 'destructive' });
    }
  });

  const handleCreateTemplate = () => {
    if (activeTab === 'utm') {
      if (!newTemplate.source || !newTemplate.medium || !newTemplate.content) {
        toast({ title: 'Please fill all required fields', variant: 'destructive' });
        return;
      }
    } else if (activeTab === 'term') {
      if (!newTemplate.term || !newTemplate.category) {
        toast({ title: 'Please fill all required fields', variant: 'destructive' });
        return;
      }
    }
    
    createTemplateMutation.mutate(newTemplate);
  };

  const toggleSourceExpanded = (source: string) => {
    const newExpanded = new Set(expandedSources);
    if (newExpanded.has(source)) {
      newExpanded.delete(source);
    } else {
      newExpanded.add(source);
    }
    setExpandedSources(newExpanded);
  };

  const isLoading = activeTab === 'utm' ? utmLoading : termLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-700">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          Loading templates...
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
              <h1 className="text-xl font-bold text-gray-900">Base Template Management</h1>
              <p className="text-sm text-gray-600">Manage UTM and term templates across all accounts</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Template Type Selector */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Template Type</CardTitle>
            <CardDescription className="text-gray-600">Choose which type of templates to manage</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button
              onClick={() => setActiveTab('utm')}
              variant={activeTab === 'utm' ? 'default' : 'outline'}
              className={activeTab === 'utm' ? 'bg-blue-600 hover:bg-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}
            >
              <Database className="w-4 h-4 mr-2" />
              UTM Templates
            </Button>
            <Button
              onClick={() => setActiveTab('term')}
              variant={activeTab === 'term' ? 'default' : 'outline'}
              className={activeTab === 'term' ? 'bg-blue-600 hover:bg-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}
            >
              <Tag className="w-4 h-4 mr-2" />
              Term Templates
            </Button>
          </CardContent>
        </Card>

        {/* Create New Template */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-gray-900">
                  {activeTab === 'utm' ? 'UTM Templates' : 'Term Templates'}
                </CardTitle>
                <CardDescription className="text-gray-600">
                  {activeTab === 'utm' 
                    ? 'Base UTM source, medium, and content combinations' 
                    : 'Base term templates for keyword tracking'
                  }
                </CardDescription>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Template
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white border-gray-200">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900">
                      Create New {activeTab === 'utm' ? 'UTM' : 'Term'} Template
                    </DialogTitle>
                    <DialogDescription className="text-gray-600">
                      Add a new base template that will be available to all accounts
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {activeTab === 'utm' ? (
                      <>
                        <div>
                          <Label className="text-gray-700">Source</Label>
                          <Input
                            value={newTemplate.source || ''}
                            onChange={(e) => setNewTemplate({...newTemplate, source: e.target.value})}
                            placeholder="e.g., google, facebook, email"
                            className="border-gray-300"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-700">Medium</Label>
                          <Input
                            value={newTemplate.medium || ''}
                            onChange={(e) => setNewTemplate({...newTemplate, medium: e.target.value})}
                            placeholder="e.g., cpc, social, email"
                            className="border-gray-300"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-700">Content</Label>
                          <Input
                            value={newTemplate.content || ''}
                            onChange={(e) => setNewTemplate({...newTemplate, content: e.target.value})}
                            placeholder="e.g., banner-ad, text-ad, video-ad"
                            className="border-gray-300"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <Label className="text-gray-700">Term</Label>
                          <Input
                            value={newTemplate.term || ''}
                            onChange={(e) => setNewTemplate({...newTemplate, term: e.target.value})}
                            placeholder="e.g., brand-keywords, competitor-terms"
                            className="border-gray-300"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-700">Category</Label>
                          <Select value={newTemplate.category || ''} onValueChange={(value) => setNewTemplate({...newTemplate, category: value})}>
                            <SelectTrigger className="border-gray-300">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="keywords">Keywords</SelectItem>
                              <SelectItem value="testing">Testing</SelectItem>
                              <SelectItem value="audience">Audience</SelectItem>
                              <SelectItem value="general">General</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                    <Button
                      onClick={handleCreateTemplate}
                      disabled={createTemplateMutation.isPending}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {createTemplateMutation.isPending ? 'Creating...' : 'Create Template'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(activeTab === 'utm' ? utmTemplateGroups?.flatMap(group => group.mediums.flatMap(medium => medium.templates)) : termTemplates)?.map((template) => (
                <div key={template.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <Badge 
                      variant={template.vendorManaged ? 'default' : 'secondary'}
                      className={template.vendorManaged ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}
                    >
                      {template.vendorManaged ? 'Vendor Managed' : 'System Default'}
                    </Badge>
                    <Badge 
                      variant={template.isActive ? 'default' : 'secondary'}
                      className={template.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                    >
                      {template.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {activeTab === 'utm' ? (
                    <div className="space-y-1">
                      <div className="text-sm text-gray-600">Source: <span className="font-medium text-gray-900">{template.source}</span></div>
                      <div className="text-sm text-gray-600">Medium: <span className="font-medium text-gray-900">{template.medium}</span></div>
                      <div className="text-sm text-gray-600">Content: <span className="font-medium text-gray-900">{template.content}</span></div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-sm text-gray-600">Term: <span className="font-medium text-gray-900">{template.term}</span></div>
                      <div className="text-sm text-gray-600">Category: <span className="font-medium text-gray-900">{template.category}</span></div>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-2">
                    Created: {new Date(template.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
            
            {templates?.length === 0 && (
              <div className="text-center py-12">
                <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates found</h3>
                <p className="text-gray-600">Create your first base template to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VendorTemplates;