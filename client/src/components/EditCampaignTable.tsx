import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { generateUTMLink } from "@/lib/utm";
import { Plus, Copy, X } from "lucide-react";
import type { User, SourceTemplate, UtmLink } from "@shared/schema";

interface EditCampaignTableProps {
  existingCampaignData: UtmLink[];
  existingLandingPages: any[];
  sourceTemplates: SourceTemplate[];
  termTemplates: any[];
  user: User;
  onSave: () => void;
}

export default function EditCampaignTable({ 
  existingCampaignData, 
  existingLandingPages, 
  sourceTemplates, 
  termTemplates, 
  user, 
  onSave 
}: EditCampaignTableProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for editable fields
  const [editableLinks, setEditableLinks] = useState(existingCampaignData);
  const [landingPages, setLandingPages] = useState(existingLandingPages);
  const [campaignName, setCampaignName] = useState(existingCampaignData[0]?.utm_campaign || '');
  const [showAddLandingPage, setShowAddLandingPage] = useState(false);
  const [newLandingPageUrl, setNewLandingPageUrl] = useState('');

  // Get available mediums for each source
  const getAvailableMediums = (sourceName: string) => {
    const sourceTemplate = sourceTemplates.find((template: SourceTemplate) => 
      template.sourceName.toLowerCase() === sourceName.toLowerCase()
    );
    return sourceTemplate?.mediums || [];
  };

  // Update a specific link field
  const updateLinkField = (linkIndex: number, field: string, value: string) => {
    setEditableLinks(prev => prev.map((link, index) => {
      if (index === linkIndex) {
        const updatedLink = { ...link, [field]: value };
        
        // Regenerate UTM link with new parameters
        const newUtmLink = generateUTMLink({
          targetUrl: updatedLink.targetUrl,
          utm_source: updatedLink.utm_source,
          utm_medium: updatedLink.utm_medium,
          utm_campaign: campaignName,
          utm_content: updatedLink.utm_content,
          utm_term: updatedLink.utm_term
        });
        
        return {
          ...updatedLink,
          utm_campaign: campaignName,
          fullUtmLink: newUtmLink
        };
      }
      return link;
    }));
  };

  // Add new landing page
  const addLandingPage = () => {
    if (!newLandingPageUrl.trim()) return;
    
    const newPage = {
      id: Date.now(),
      url: newLandingPageUrl,
      label: newLandingPageUrl
    };
    
    setLandingPages(prev => [...prev, newPage]);
    setNewLandingPageUrl('');
    setShowAddLandingPage(false);
    
    toast({
      title: "Landing page added",
      description: "New landing page URL has been added"
    });
  };

  // Duplicate a link row
  const duplicateLink = (linkIndex: number) => {
    const linkToDuplicate = editableLinks[linkIndex];
    const duplicatedLink = {
      ...linkToDuplicate,
      id: Date.now(), // New ID for duplicate
    };
    
    setEditableLinks(prev => [...prev, duplicatedLink]);
    
    toast({
      title: "Row duplicated",
      description: "UTM link row has been duplicated"
    });
  };

  // Delete a link row
  const deleteLink = (linkIndex: number) => {
    setEditableLinks(prev => prev.filter((_, index) => index !== linkIndex));
    
    toast({
      title: "Row deleted",
      description: "UTM link row has been removed"
    });
  };

  // Save changes mutation
  const saveChangesMutation = useMutation({
    mutationFn: async () => {
      const token = await user.getIdToken();
      
      // Delete existing campaign links
      await fetch(`/api/utm-links/campaign/${encodeURIComponent(existingCampaignData[0].utm_campaign)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-firebase-uid': user.uid,
        }
      });

      // Delete existing landing pages
      await fetch(`/api/campaign-landing-pages/campaign/${encodeURIComponent(existingCampaignData[0].utm_campaign)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-firebase-uid': user.uid,
        }
      });

      // Create new landing pages
      for (const page of landingPages) {
        await fetch('/api/campaign-landing-pages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-firebase-uid': user.uid,
          },
          body: JSON.stringify({
            userId: user.id,
            accountId: user.accountId,
            campaignName,
            url: page.url,
            label: page.label
          })
        });
      }

      // Create new UTM links
      for (const link of editableLinks) {
        await fetch('/api/utm-links', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-firebase-uid': user.uid,
          },
          body: JSON.stringify({
            userId: user.id,
            accountId: user.accountId,
            targetUrl: link.targetUrl,
            fullUtmLink: link.fullUtmLink,
            utm_campaign: campaignName,
            utm_source: link.utm_source,
            utm_medium: link.utm_medium,
            utm_content: link.utm_content,
            utm_term: link.utm_term || '',
            tags: link.tags || []
          })
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/utm-links'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaign-landing-pages'] });
      
      toast({
        title: "Campaign updated",
        description: "Your campaign has been successfully updated"
      });
      
      onSave();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update campaign",
        variant: "destructive"
      });
    }
  });

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Campaign</h1>
          <p className="text-sm text-gray-600 mt-1">Modify your campaign details and UTM links</p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/campaigns')}
        >
          Back to Campaign Management
        </Button>
      </div>

      {/* Campaign Name Section */}
      <Card>
        <div className="p-6">
          <Label className="text-sm font-medium">Campaign Name</Label>
          <Input
            value={campaignName}
            onChange={(e) => {
              setCampaignName(e.target.value);
              // Update campaign name in all links
              setEditableLinks(prev => prev.map(link => ({
                ...link,
                utm_campaign: e.target.value,
                fullUtmLink: generateUTMLink({
                  targetUrl: link.targetUrl,
                  utm_source: link.utm_source,
                  utm_medium: link.utm_medium,
                  utm_campaign: e.target.value,
                  utm_content: link.utm_content,
                  utm_term: link.utm_term
                })
              })));
            }}
            className="mt-1"
          />
          <p className="text-xs text-orange-600 mt-1">
            ⚠️ Edit with caution. Campaign name should NOT be changed after campaign has gone live.
          </p>
        </div>
      </Card>

      {/* Landing Pages Section */}
      <Card>
        <div className="p-6">
          <Label className="text-sm font-medium mb-4 block">Landing Page URLs</Label>
          <div className="space-y-2">
            {landingPages.map((page, index) => (
              <div key={page.id} className="flex items-center gap-2">
                <Select
                  value={page.url}
                  onValueChange={(value) => {
                    setLandingPages(prev => prev.map((p, i) => 
                      i === index ? { ...p, url: value, label: value } : p
                    ));
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {landingPages.map(lp => (
                      <SelectItem key={lp.id} value={lp.url}>{lp.url}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLandingPages(prev => prev.filter((_, i) => i !== index));
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            
            {/* Add Landing Page Row */}
            {showAddLandingPage ? (
              <div className="flex items-center gap-2">
                <Input
                  value={newLandingPageUrl}
                  onChange={(e) => setNewLandingPageUrl(e.target.value)}
                  placeholder="Enter landing page URL..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addLandingPage();
                    }
                  }}
                  autoFocus
                />
                <Button size="sm" onClick={addLandingPage} disabled={!newLandingPageUrl.trim()}>
                  Add
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddLandingPage(false);
                    setNewLandingPageUrl('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddLandingPage(true)}
                className="w-full border-dashed"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Landing Page URL
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* UTM Links Table - Grouped by Source */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">UTM Links</h3>
            <span className="text-sm text-gray-600">{editableLinks.length} links</span>
          </div>

          {/* Group links by source */}
          {Object.entries(
            editableLinks.reduce((acc: Record<string, any[]>, link, index) => {
              const source = link.utm_source;
              if (!acc[source]) {
                acc[source] = [];
              }
              acc[source].push({ ...link, originalIndex: index });
              return acc;
            }, {})
          ).map(([sourceName, sourceLinks]) => (
            <div key={sourceName} className="mb-6 border rounded-lg overflow-hidden">
              {/* Source Header */}
              <div className="bg-blue-50 p-3 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 capitalize">{sourceName}</h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const sourceLinksText = sourceLinks.map(link => link.fullUtmLink).join('\n');
                      navigator.clipboard.writeText(sourceLinksText);
                      toast({
                        title: "Source links copied!",
                        description: `Copied ${sourceLinks.length} ${sourceName} links to clipboard`,
                      });
                    }}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy Source Links
                  </Button>
                </div>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-medium text-sm">Landing Page</th>
                      <th className="text-left p-3 font-medium text-sm">Medium</th>
                      <th className="text-left p-3 font-medium text-sm">Content</th>
                      <th className="text-left p-3 font-medium text-sm">Term</th>
                      <th className="text-left p-3 font-medium text-sm">UTM Link</th>
                      <th className="text-left p-3 font-medium text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceLinks.map((link) => (
                      <tr key={link.originalIndex} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <Select
                            value={link.targetUrl}
                            onValueChange={(value) => updateLinkField(link.originalIndex, 'targetUrl', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {landingPages.map(page => (
                                <SelectItem key={page.id} value={page.url}>{page.url}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <Select
                            value={link.utm_medium}
                            onValueChange={(value) => updateLinkField(link.originalIndex, 'utm_medium', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableMediums(link.utm_source).map(medium => (
                                <SelectItem key={medium} value={medium}>{medium}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <Input
                            value={link.utm_content || ''}
                            onChange={(e) => updateLinkField(link.originalIndex, 'utm_content', e.target.value)}
                            placeholder="Content"
                            className="w-full"
                          />
                        </td>
                        <td className="p-3">
                          <Select
                            value={link.utm_term || ''}
                            onValueChange={(value) => updateLinkField(link.originalIndex, 'utm_term', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select term" />
                            </SelectTrigger>
                            <SelectContent>
                              {termTemplates.map((term: any) => (
                                <SelectItem key={term.id} value={term.termValue}>{term.termValue}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <div className="font-mono text-xs text-blue-600 break-all max-w-xs">
                            {link.fullUtmLink}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => duplicateLink(link.originalIndex)}
                              className="w-8 h-8 p-0"
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteLink(link.originalIndex)}
                              className="w-8 h-8 p-0 text-red-600 hover:text-red-700"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4 p-4">
                {sourceLinks.map((link) => (
                  <div key={link.originalIndex} className="border rounded-lg p-4">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs font-medium">Landing Page</Label>
                        <Select
                          value={link.targetUrl}
                          onValueChange={(value) => updateLinkField(link.originalIndex, 'targetUrl', value)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {landingPages.map(page => (
                              <SelectItem key={page.id} value={page.url}>{page.url}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-medium">Medium</Label>
                          <Select
                            value={link.utm_medium}
                            onValueChange={(value) => updateLinkField(link.originalIndex, 'utm_medium', value)}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableMediums(link.utm_source).map(medium => (
                                <SelectItem key={medium} value={medium}>{medium}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label className="text-xs font-medium">Term</Label>
                          <Select
                            value={link.utm_term || ''}
                            onValueChange={(value) => updateLinkField(link.originalIndex, 'utm_term', value)}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select term" />
                            </SelectTrigger>
                            <SelectContent>
                              {termTemplates.map((term: any) => (
                                <SelectItem key={term.id} value={term.termValue}>{term.termValue}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-xs font-medium">Content</Label>
                        <Input
                          value={link.utm_content || ''}
                          onChange={(e) => updateLinkField(link.originalIndex, 'utm_content', e.target.value)}
                          placeholder="Content"
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-xs font-medium">UTM Link</Label>
                        <div className="mt-1 p-2 bg-gray-50 rounded border font-mono text-xs text-blue-600 break-all">
                          {link.fullUtmLink}
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center pt-2">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => duplicateLink(link.originalIndex)}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Duplicate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteLink(link.originalIndex)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(link.fullUtmLink);
                            toast({ title: "Link copied to clipboard" });
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => saveChangesMutation.mutate()}
          disabled={saveChangesMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6"
        >
          {saveChangesMutation.isPending ? "Saving..." : "Save Campaign Changes"}
        </Button>
      </div>
    </div>
  );
}