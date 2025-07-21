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
import { ArrowLeft, Plus, ChevronDown, ChevronRight, Database, Tag, Edit2, Trash2 } from 'lucide-react';

interface SourceTemplateGroup {
  source: string;
  mediums: {
    medium: string;
    content: string[];
    templates: BaseTemplate[];
  }[];
}

interface BaseTemplate {
  id: number;
  source: string;
  medium: string;
  content: string;
  isActive: boolean;
  vendorManaged: boolean;
  createdAt: string;
}

interface TermTemplate {
  id: number;
  term: string;
  category: string;
  isActive: boolean;
  vendorManaged: boolean;
  createdAt: string;
}

const VendorTemplatesNew: React.FC = () => {
  const { token } = useVendorAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'utm' | 'term'>('utm');
  const [newTemplate, setNewTemplate] = useState<any>({});
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<{type: 'source'|'medium'|'content', id: string, value: string} | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{type: 'source'|'medium'|'content', item: string, details: string} | null>(null);

  // Fetch UTM templates grouped by source
  const { data: utmTemplateGroups, isLoading: utmLoading, error: utmError } = useQuery<SourceTemplateGroup[]>({
    queryKey: ['/vendor-api/base-templates/utm-grouped'],
    queryFn: async () => {
      const response = await fetch('/vendor-api/base-templates/utm-grouped', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch UTM templates: ${errorText}`);
      }
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

        {/* UTM Templates - Organized by Source */}
        {activeTab === 'utm' && (
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-gray-900">UTM Templates by Source</CardTitle>
                  <CardDescription className="text-gray-600">
                    Templates organized by source, with mediums and content beneath each source
                  </CardDescription>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      Add UTM Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white border-gray-200">
                    <DialogHeader>
                      <DialogTitle className="text-gray-900">Create New UTM Template</DialogTitle>
                      <DialogDescription className="text-gray-600">
                        Add a new base template that will be available to all accounts
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
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
              <div className="space-y-4">
                {utmTemplateGroups?.map((sourceGroup) => (
                  <Card key={sourceGroup.source} className="border border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleSourceExpanded(sourceGroup.source)}
                            className="p-1 h-auto text-gray-600 hover:text-gray-900"
                          >
                            {expandedSources.has(sourceGroup.source) ? 
                              <ChevronDown className="w-4 h-4" /> : 
                              <ChevronRight className="w-4 h-4" />
                            }
                          </Button>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-blue-700 text-xl">{sourceGroup.source}</h3>
                            <button
                              onClick={() => setEditingItem({type: 'source', id: sourceGroup.source, value: sourceGroup.source})}
                              className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                              title="Edit source name"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({
                                type: 'source', 
                                item: sourceGroup.source, 
                                details: `This will delete the entire "${sourceGroup.source}" source with ${sourceGroup.mediums.length} mediums and ${sourceGroup.mediums.reduce((acc, m) => acc + m.content.length, 0)} content variations.`
                              })}
                              className="text-gray-400 hover:text-red-600 transition-colors p-1"
                              title="Delete source"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            <div className="ml-2">
                              <p className="text-sm text-gray-600">{sourceGroup.mediums.length} mediums, {sourceGroup.mediums.reduce((acc, m) => acc + m.content.length, 0)} content variations</p>
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="text-xs">
                          <Plus className="h-3 w-3 mr-1" />
                          Add Medium
                        </Button>
                      </div>
                      
                      {expandedSources.has(sourceGroup.source) && (
                        <div className="mt-6 ml-6 space-y-6">
                          {sourceGroup.mediums.map((medium) => (
                            <div key={medium.medium} className="border-l-4 border-blue-100 pl-6">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-purple-700 text-lg">{medium.medium}</h4>
                                  <button
                                    onClick={() => setEditingItem({type: 'medium', id: `${sourceGroup.source}-${medium.medium}`, value: medium.medium})}
                                    className="text-gray-400 hover:text-purple-600 transition-colors p-1"
                                    title="Edit medium name"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm({
                                      type: 'medium', 
                                      item: medium.medium, 
                                      details: `This will delete the "${medium.medium}" medium from "${sourceGroup.source}" source with ${medium.content.length} content variations.`
                                    })}
                                    className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                    title="Delete medium"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                                <Button variant="outline" size="sm" className="text-xs">
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Content
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {medium.content.map((content, idx) => (
                                  <div key={idx} className="group inline-flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                                    <span className="text-sm text-gray-700 font-medium">{content}</span>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={() => setEditingItem({type: 'content', id: `${sourceGroup.source}-${medium.medium}-${content}`, value: content})}
                                        className="text-gray-400 hover:text-green-600 transition-colors p-0.5"
                                        title="Edit content"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </button>
                                      <button 
                                        onClick={() => setDeleteConfirm({
                                          type: 'content', 
                                          item: content, 
                                          details: `This will delete the "${content}" content variation from "${medium.medium}" medium in "${sourceGroup.source}" source.`
                                        })}
                                        className="text-gray-400 hover:text-red-600 transition-colors p-0.5"
                                        title="Delete content"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {utmTemplateGroups?.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No UTM templates found. Create your first template to get started.
                  </div>
                )}
                {utmError && (
                  <div className="text-center py-8 text-red-500">
                    Error loading templates: {utmError.message}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Term Templates */}
        {activeTab === 'term' && (
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-gray-900">Term Templates</CardTitle>
                  <CardDescription className="text-gray-600">
                    Base term templates for keyword tracking
                  </CardDescription>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Term Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white border-gray-200">
                    <DialogHeader>
                      <DialogTitle className="text-gray-900">Create New Term Template</DialogTitle>
                      <DialogDescription className="text-gray-600">
                        Add a new base template that will be available to all accounts
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
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
                {termTemplates?.map((template) => (
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
                    <div className="space-y-1">
                      <div className="text-sm text-gray-600">Term: <span className="font-medium text-gray-900">{template.term}</span></div>
                      <div className="text-sm text-gray-600">Category: <span className="font-medium text-gray-900">{template.category}</span></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Created: {new Date(template.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
                {termTemplates?.length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    No term templates found. Create your first template to get started.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
          <DialogContent className="bg-white border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-gray-900">Edit {editingItem?.type}</DialogTitle>
              <DialogDescription className="text-gray-600">
                Update the name of this {editingItem?.type}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-700">Name</Label>
                <Input
                  value={editingItem?.value || ''}
                  onChange={(e) => setEditingItem(prev => prev ? {...prev, value: e.target.value} : null)}
                  placeholder={`Enter ${editingItem?.type} name`}
                  className="border-gray-300"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    // TODO: Implement edit functionality
                    toast({ title: 'Edit functionality coming soon' });
                    setEditingItem(null);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Update {editingItem?.type}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditingItem(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <DialogContent className="bg-white border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-red-600">Confirm Deletion</DialogTitle>
              <DialogDescription className="text-gray-600">
                Are you sure you want to delete "{deleteConfirm?.item}"?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">
                  <strong>Warning:</strong> {deleteConfirm?.details}
                </p>
                <p className="text-sm text-red-600 mt-2">
                  This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    // TODO: Implement delete functionality
                    toast({ 
                      title: 'Delete functionality coming soon',
                      description: `Would delete ${deleteConfirm?.type}: ${deleteConfirm?.item}`
                    });
                    setDeleteConfirm(null);
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete {deleteConfirm?.type}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default VendorTemplatesNew;