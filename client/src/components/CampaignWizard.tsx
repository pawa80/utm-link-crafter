import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generateUTMLink, validateUrl } from "@/lib/utm";
import { Plus, Copy, X, ChevronDown, ChevronUp } from "lucide-react";
import type { User, SourceTemplate, UtmLink, Tag } from "@shared/schema";

interface CampaignWizardProps {
  user: User;
  onSaveSuccess?: () => void;
  editMode?: boolean;
  existingCampaignData?: UtmLink[];
  existingLandingPages?: any[];
}

interface SourceState {
  checked: boolean;
  selectedMediums: string[];
  contentInputs: { [medium: string]: string };
  landingPageSelections: { [medium: string]: string }; // medium -> landing page ID
}

interface ContentVariant {
  id: string;
  content: string;
}

export default function CampaignWizard({ user, onSaveSuccess, editMode = false, existingCampaignData = [], existingLandingPages = [] }: CampaignWizardProps) {
  const [campaignName, setCampaignName] = useState("");
  const [targetUrl, setTargetUrl] = useState(""); // Keep for backward compatibility
  const [landingPages, setLandingPages] = useState<Array<{ id: string; url: string; label: string }>>([]);
  const [sourceStates, setSourceStates] = useState<{ [sourceName: string]: SourceState }>({});
  const [contentVariants, setContentVariants] = useState<{ [key: string]: Array<{ id: string; content: string }> }>({});
  const [customSource, setCustomSource] = useState("");
  const [showAddSource, setShowAddSource] = useState(false);
  const [customMediumInputs, setCustomMediumInputs] = useState<{ [sourceName: string]: { value: string; addToLibrary: boolean; show: boolean } }>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [showCustomTagInput, setShowCustomTagInput] = useState(false);
  
  // Section collapse states
  const [expandedSections, setExpandedSections] = useState({
    campaign: true,
    tags: editMode,
    sources: editMode,
    output: editMode
  });
  const [manuallyExpanded, setManuallyExpanded] = useState<Set<string>>(new Set());

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Section management functions
  const toggleSection = (section: string) => {
    setManuallyExpanded(prev => new Set([...prev, section]));
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section as keyof typeof prev]
    }));
  };

  // Landing page management functions
  const addLandingPage = () => {
    const newId = `lp-${Date.now()}`;
    setLandingPages(prev => [...prev, { id: newId, url: "", label: "" }]);
  };

  const removeLandingPage = (id: string) => {
    setLandingPages(prev => prev.filter(lp => lp.id !== id));
    // Also remove any selections that referenced this landing page
    setSourceStates(prev => {
      const newSourceStates = { ...prev };
      Object.keys(newSourceStates).forEach(sourceName => {
        const landingPageSelections = { ...newSourceStates[sourceName].landingPageSelections };
        Object.keys(landingPageSelections).forEach(medium => {
          if (landingPageSelections[medium] === id) {
            delete landingPageSelections[medium];
          }
        });
        newSourceStates[sourceName] = {
          ...newSourceStates[sourceName],
          landingPageSelections
        };
      });
      return newSourceStates;
    });
  };

  const updateLandingPage = (id: string, field: 'url' | 'label', value: string) => {
    setLandingPages(prev => prev.map(lp => 
      lp.id === id ? { ...lp, [field]: value } : lp
    ));
  };

  const validateSection = (section: string): boolean => {
    switch (section) {
      case 'campaign':
        // Either old single URL or new multiple landing pages should be valid
        const hasValidSingleUrl = targetUrl.trim() !== '' && validateUrl(targetUrl);
        const hasValidLandingPages = landingPages.length > 0 && 
          landingPages.every(lp => lp.url.trim() !== '' && lp.label.trim() !== '' && validateUrl(lp.url));
        return campaignName.trim() !== '' && (hasValidSingleUrl || hasValidLandingPages);
      case 'tags':
        return true; // Tags are optional
      case 'sources':
        // Only check if sources and mediums are selected, not content
        return Object.entries(sourceStates)
          .filter(([, state]) => state.checked)
          .some(([, state]) => state.selectedMediums.length > 0);
      default:
        return true;
    }
  };

  const handleNext = (currentSection: string, nextSection: string) => {
    if (!validateSection(currentSection)) {
      let errorMessage = '';
      switch (currentSection) {
        case 'campaign':
          if (!campaignName.trim()) errorMessage = 'Campaign name is required';
          else if (!targetUrl.trim() && landingPages.length === 0) errorMessage = 'At least one landing page URL is required';
          else if (targetUrl.trim() && !validateUrl(targetUrl)) errorMessage = 'Please enter a valid URL';
          else if (landingPages.length > 0) {
            const invalidPage = landingPages.find(lp => !lp.url.trim() || !lp.label.trim() || !validateUrl(lp.url));
            if (invalidPage) errorMessage = 'All landing pages must have valid URLs and labels';
          }
          break;
        case 'sources':
          errorMessage = 'Please select at least one source and medium';
          break;
      }
      
      toast({
        title: "Validation Error",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }

    // Only auto-collapse/expand if sections weren't manually expanded
    if (!manuallyExpanded.has(currentSection) && !manuallyExpanded.has(nextSection)) {
      setExpandedSections(prev => ({
        ...prev,
        [currentSection]: false,
        [nextSection]: true
      }));
    }
  };

  const { data: sourceTemplates = [] } = useQuery({
    queryKey: ["/api/source-templates"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/source-templates");
      return response.json();
    },
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["/api/tags"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/tags");
      return response.json();
    },
  });

  // Rest of the existing mutations and functions...
  const createUtmLinkMutation = useMutation({
    mutationFn: async (linkData: any) => {
      const response = await apiRequest("POST", "/api/utm-links", linkData);
      return response.json();
    },
  });

  const deleteCampaignLinksMutation = useMutation({
    mutationFn: async (campaignName: string) => {
      const response = await apiRequest("DELETE", `/api/utm-links/campaign/${encodeURIComponent(campaignName)}`);
      return response.json();
    },
  });

  const createSourceTemplateMutation = useMutation({
    mutationFn: async (templateData: any) => {
      const response = await apiRequest("POST", "/api/source-templates", templateData);
      return response.json();
    },
  });

  const updateSourceTemplateMutation = useMutation({
    mutationFn: async ({ templateId, updates }: { templateId: number; updates: any }) => {
      const response = await apiRequest("PATCH", `/api/source-templates/${templateId}`, updates);
      return response.json();
    },
  });

  const createTagMutation = useMutation({
    mutationFn: async (tagData: any) => {
      const response = await apiRequest("POST", "/api/tags", tagData);
      return response.json();
    },
  });

  // Helper functions for content variants
  const getVariantKey = (sourceName: string, medium: string) => `${sourceName}-${medium}`;
  
  const getContentVariantsForMedium = (sourceName: string, medium: string) => {
    const key = getVariantKey(sourceName, medium);
    return contentVariants[key] || [{ id: `${key}-0`, content: '' }];
  };
  
  const updateContentVariant = (sourceName: string, medium: string, variantId: string, content: string) => {
    const key = getVariantKey(sourceName, medium);
    setContentVariants(prev => ({
      ...prev,
      [key]: (prev[key] || [{ id: `${key}-0`, content: '' }]).map(variant =>
        variant.id === variantId ? { ...variant, content } : variant
      )
    }));
  };
  
  const addContentVariant = (sourceName: string, medium: string, afterVariantId: string) => {
    const key = getVariantKey(sourceName, medium);
    const variants = contentVariants[key] || [{ id: `${key}-0`, content: '' }];
    const insertIndex = variants.findIndex(v => v.id === afterVariantId) + 1;
    const newVariantId = `${key}-${Date.now()}`;
    const newVariants = [
      ...variants.slice(0, insertIndex),
      { id: newVariantId, content: '' },
      ...variants.slice(insertIndex)
    ];
    
    setContentVariants(prev => ({
      ...prev,
      [key]: newVariants
    }));
  };
  
  // Check if we have at least one valid URL (either targetUrl or landing pages with URLs)
  const hasValidUrl = () => {
    if (targetUrl.trim()) {
      return true;
    }
    
    if (landingPages.length > 0) {
      return landingPages.some(lp => lp.url.trim() !== '');
    }
    
    return false;
  };
  
  const getCheckedSourcesWithContent = () => {
    return Object.entries(sourceStates)
      .filter(([, state]) => state.checked)
      .flatMap(([sourceName, state]) =>
        state.selectedMediums.flatMap(medium => {
          const variants = getContentVariantsForMedium(sourceName, medium);
          return variants
            .filter(variant => variant.content.trim() !== '')
            .map(variant => {
              // Get selected landing page for this medium
              const selectedLandingPageId = state.landingPageSelections[medium];
              const selectedLandingPage = landingPages.find(lp => lp.id === selectedLandingPageId);
              // Use selected landing page URL, fall back to default targetUrl, or first landing page if available
              const urlToUse = selectedLandingPage?.url || targetUrl || (landingPages.length > 0 ? landingPages[0].url : '');
              
              return {
                sourceName,
                medium,
                content: variant.content,
                utmLink: generateUTMLink({
                  targetUrl: urlToUse,
                  utm_campaign: campaignName,
                  utm_source: sourceName.toLowerCase(),
                  utm_medium: medium,
                  utm_content: variant.content
                })
              };
            });
        })
      );
  };

  const copyAllCampaignLinks = () => {
    const allLinks = getCheckedSourcesWithContent();
    if (allLinks.length === 0) return;

    // Group links by source
    const linksBySource = allLinks.reduce((acc, link) => {
      if (!acc[link.sourceName]) {
        acc[link.sourceName] = [];
      }
      acc[link.sourceName].push(link);
      return acc;
    }, {} as { [sourceName: string]: typeof allLinks });

    // New format: Campaign: Campaign Name, then Source: for each source
    let copyText = `Campaign: ${campaignName}\n`;
    
    Object.entries(linksBySource).forEach(([sourceName, links], index) => {
      copyText += `Source: ${sourceName}\n\n`;
      links.forEach(link => {
        const linkName = `${sourceName} ${link.medium.charAt(0).toUpperCase() + link.medium.slice(1)} ${link.content}`.trim();
        copyText += `${linkName} - ${link.utmLink}\n`;
      });
      
      // Add extra line break between sources, but not after the last one
      if (index < Object.entries(linksBySource).length - 1) {
        copyText += '\n';
      }
    });

    navigator.clipboard.writeText(copyText);
    toast({
      title: "Copied!",
      description: "All campaign links copied to clipboard",
    });
  };

  const copySourceLinks = (sourceName: string) => {
    const sourceLinks = getCheckedSourcesWithContent().filter(link => link.sourceName === sourceName);
    if (sourceLinks.length === 0) return;

    // New format: Campaign: Campaign Name, Source: Source Name, then links
    let copyText = `Campaign: ${campaignName}\nSource: ${sourceName}\n\n`;
    sourceLinks.forEach(link => {
      const linkName = `${sourceName} ${link.medium.charAt(0).toUpperCase() + link.medium.slice(1)} ${link.content}`.trim();
      copyText += `${linkName} - ${link.utmLink}\n`;
    });

    navigator.clipboard.writeText(copyText);
    toast({
      title: "Copied!",
      description: `${sourceName} links copied to clipboard`,
    });
  };

  // Initialize form with existing campaign data when in edit mode
  useEffect(() => {
    if (editMode && existingCampaignData.length > 0 && sourceTemplates.length > 0) {
      console.log('Initializing edit mode with data:', existingCampaignData);
      
      const firstLink = existingCampaignData[0];
      setCampaignName(firstLink.utm_campaign);
      setTargetUrl(firstLink.targetUrl);
      setSelectedTags(firstLink.tags || []);
      
      // Group existing links by source and medium to populate form
      const newSourceStates: { [sourceName: string]: SourceState } = {};
      const newContentVariants: { [key: string]: ContentVariant[] } = {};
      
      // Group links by source and medium
      const linksBySourceMedium: { [key: string]: typeof existingCampaignData } = {};
      
      existingCampaignData.forEach(link => {
        // Find matching source template (case-insensitive)
        const sourceTemplate = sourceTemplates.find((template: SourceTemplate) => 
          template.sourceName.toLowerCase() === link.utm_source.toLowerCase()
        );
        
        const sourceName = sourceTemplate ? sourceTemplate.sourceName : link.utm_source;
        const medium = link.utm_medium;
        const key = `${sourceName}-${medium}`;
        
        if (!linksBySourceMedium[key]) {
          linksBySourceMedium[key] = [];
        }
        linksBySourceMedium[key].push(link);
        
        if (!newSourceStates[sourceName]) {
          newSourceStates[sourceName] = {
            checked: true,
            selectedMediums: [],
            contentInputs: {},
            landingPageSelections: {}
          };
        }
        
        if (!newSourceStates[sourceName].selectedMediums.includes(medium)) {
          newSourceStates[sourceName].selectedMediums.push(medium);
        }
      });
      
      // Create content variants for each source-medium combination
      Object.entries(linksBySourceMedium).forEach(([key, links]) => {
        const variants = links.map((link, index) => ({
          id: `${key}-${index}`,
          content: link.utm_content || ''
        }));
        newContentVariants[key] = variants;
      });
      
      setSourceStates(newSourceStates);
      setContentVariants(newContentVariants);
      
      // Initialize landing pages if they exist
      if (existingLandingPages.length > 0) {
        const formattedLandingPages = existingLandingPages.map(lp => ({
          id: lp.id.toString(),
          url: lp.url,
          label: lp.label
        }));
        setLandingPages(formattedLandingPages);
      }
      
      // Expand all sections when in edit mode
      setExpandedSections({
        campaign: true,
        tags: true,
        sources: true,
        output: true
      });
    }
  }, [editMode, existingCampaignData, existingLandingPages, sourceTemplates]);

  // Helper component for section headers
  const SectionHeader = ({ 
    title, 
    sectionKey
  }: { 
    title: string; 
    sectionKey: string;
  }) => (
    <div className="flex items-center justify-between p-4 bg-gray-50 border-b cursor-pointer" 
         onClick={() => toggleSection(sectionKey)}>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <div className="flex items-center gap-3">
        {expandedSections[sectionKey as keyof typeof expandedSections] ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </div>
    </div>
  );

  // Tag handling functions
  const handleTagSelect = (tagName: string) => {
    if (!selectedTags.includes(tagName)) {
      setSelectedTags([...selectedTags, tagName]);
    }
  };

  const removeTag = (tagName: string) => {
    setSelectedTags(selectedTags.filter(tag => tag !== tagName));
  };

  const handleCustomTagSubmit = async () => {
    if (!customTagInput.trim()) return;
    
    try {
      await createTagMutation.mutateAsync({
        userId: user.id,
        name: customTagInput.trim()
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      handleTagSelect(customTagInput.trim());
      setCustomTagInput("");
      setShowCustomTagInput(false);
      
      toast({
        title: "Success",
        description: "Tag created and added to campaign",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create tag",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Section 1: Campaign and Landing Pages */}
      <Card>
        <SectionHeader 
          title="Campaign and Landing Pages" 
          sectionKey="campaign"
        />
        {expandedSections.campaign && (
          <div className="p-6">
            <div className="space-y-6">
              <div>
                <Label htmlFor="campaignName" className="text-sm font-medium">
                  Campaign Name *
                </Label>
                <Input
                  id="campaignName"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Fill in campaign name..."
                  className="mt-1"
                />
              </div>
              
              {/* Landing Pages Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-sm font-medium">Landing Page URLs *</Label>
                  <Button
                    type="button"
                    onClick={addLandingPage}
                    variant="outline"
                    size="sm"
                    className="text-primary hover:text-primary/80"
                  >
                    <Plus className="mr-1" size={16} />
                    Add Landing Page
                  </Button>
                </div>
                
                {/* Show legacy single URL field if no landing pages */}
                {landingPages.length === 0 && (
                  <div className="space-y-2">
                    <Input
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      placeholder="Enter landing page URL or click 'Add Landing Page' for multiple URLs..."
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">
                      You can use a single URL here, or add multiple labeled URLs below for more control.
                    </p>
                  </div>
                )}
                
                {/* Multiple landing pages interface */}
                {landingPages.length > 0 && (
                  <div className="space-y-3">
                    {landingPages.map((landingPage) => (
                      <div key={landingPage.id} className="flex flex-col sm:flex-row gap-3 sm:items-end">
                        <div className="flex-1">
                          <Label className="text-xs text-gray-600">Label</Label>
                          <Input
                            value={landingPage.label}
                            onChange={(e) => updateLandingPage(landingPage.id, 'label', e.target.value)}
                            placeholder="e.g., Homepage, Product Page"
                            className="mt-1"
                          />
                        </div>
                        <div className="flex-[2]">
                          <Label className="text-xs text-gray-600">URL</Label>
                          <Input
                            value={landingPage.url}
                            onChange={(e) => updateLandingPage(landingPage.id, 'url', e.target.value)}
                            placeholder="https://example.com/page"
                            className="mt-1"
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={() => removeLandingPage(landingPage.id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 sm:flex-shrink-0"
                        >
                          <X size={16} />
                          <span className="ml-1 sm:hidden">Remove</span>
                        </Button>
                      </div>
                    ))}
                    <p className="text-xs text-gray-500">
                      Add multiple landing pages to choose different URLs for different UTM links in Section 4.
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Next Button at bottom of section */}
            {!editMode && (
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={() => handleNext('campaign', 'tags')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Section 2: Tags */}
      <Card>
        <SectionHeader 
          title="Tags" 
          sectionKey="tags"
        />
        {expandedSections.tags && (
          <div className="p-6">
            <div className="space-y-3">
              {/* Selected Tags */}
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map((tag) => (
                    <div
                      key={tag}
                      className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm"
                    >
                      <span>{tag}</span>
                      <button
                        onClick={() => removeTag(tag)}
                        className="hover:bg-blue-200 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Tag Selection */}
              <div className="flex flex-wrap gap-2">
                {/* Available Tags */}
                {tags
                  .filter((tag: Tag) => !selectedTags.includes(tag.name))
                  .map((tag: Tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleTagSelect(tag.name)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      {tag.name}
                    </button>
                  ))}

                {/* Add New Tag */}
                {!showCustomTagInput && (
                  <button
                    onClick={() => setShowCustomTagInput(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-dashed border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-gray-600"
                  >
                    <Plus className="w-4 h-4" />
                    Add Tag
                  </button>
                )}
              </div>

              {/* Custom Tag Input */}
              {showCustomTagInput && (
                <div className="flex items-center gap-2">
                  <Input
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    placeholder="Enter new tag name..."
                    className="w-48"
                    onKeyPress={(e) => e.key === 'Enter' && handleCustomTagSubmit()}
                  />
                  <Button
                    onClick={handleCustomTagSubmit}
                    disabled={!customTagInput.trim() || createTagMutation.isPending}
                    size="sm"
                  >
                    Add
                  </Button>
                  <Button
                    onClick={() => {
                      setShowCustomTagInput(false);
                      setCustomTagInput("");
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
            
            {/* Next Button at bottom of section */}
            {!editMode && (
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={() => handleNext('tags', 'sources')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Section 3: Sources and Mediums */}
      <Card>
        <SectionHeader 
          title="Sources and Mediums" 
          sectionKey="sources"
        />
        {expandedSections.sources && (
          <div className="p-6">
            <div className="text-sm text-gray-600 mb-4">
              Select sources and mediums for your campaign. Content is required for each selected medium.
            </div>
            <div className="space-y-6">
              {sourceTemplates
                .filter((template: SourceTemplate) => editMode ? true : !template.isArchived)
                .map((template: SourceTemplate) => {
                  const state = sourceStates[template.sourceName] || {
                    checked: false,
                    selectedMediums: [],
                    contentInputs: {},
                    landingPageSelections: {}
                  };

                  return (
                    <Card key={template.id}>
                      <CardContent className="p-6">
                        <div className="flex items-center space-x-2 mb-4">
                          <Checkbox
                            id={`source-${template.sourceName}`}
                            checked={state.checked}
                            onCheckedChange={(checked) => {
                              setSourceStates(prev => ({
                                ...prev,
                                [template.sourceName]: {
                                  ...state,
                                  checked: !!checked
                                }
                              }));
                            }}
                          />
                          <Label htmlFor={`source-${template.sourceName}`} className="text-lg font-medium">
                            {template.sourceName}
                          </Label>
                        </div>

                        {state.checked && (
                          <div className="ml-6 space-y-4">
                            <div>
                              <Label className="text-sm font-medium mb-2 block">Select Mediums</Label>
                              <div className="flex flex-wrap gap-2">
                                {(template.mediums || []).map((medium: string) => (
                                  <Button
                                    key={medium}
                                    variant={state.selectedMediums.includes(medium) ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                      const newMediums = state.selectedMediums.includes(medium)
                                        ? state.selectedMediums.filter(m => m !== medium)
                                        : [...state.selectedMediums, medium];
                                      
                                      setSourceStates(prev => ({
                                        ...prev,
                                        [template.sourceName]: {
                                          ...state,
                                          selectedMediums: newMediums
                                        }
                                      }));
                                    }}
                                  >
                                    {medium}
                                  </Button>
                                ))}
                                
                                {/* Add Medium Button */}
                                {customMediumInputs[template.sourceName]?.show ? (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={customMediumInputs[template.sourceName]?.value || ''}
                                      onChange={(e) => {
                                        setCustomMediumInputs(prev => ({
                                          ...prev,
                                          [template.sourceName]: {
                                            ...prev[template.sourceName],
                                            value: e.target.value
                                          }
                                        }));
                                      }}
                                      placeholder="New medium name..."
                                      className="w-32"
                                      onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                          const mediumValue = customMediumInputs[template.sourceName]?.value?.trim();
                                          if (mediumValue && !template.mediums?.includes(mediumValue)) {
                                            const shouldAddToLibrary = customMediumInputs[template.sourceName]?.addToLibrary || false;
                                            
                                            if (shouldAddToLibrary) {
                                              // Add to template in database
                                              updateSourceTemplateMutation.mutate({
                                                templateId: template.id,
                                                updates: {
                                                  mediums: [...(template.mediums || []), mediumValue]
                                                }
                                              }, {
                                                onSuccess: () => {
                                                  // Invalidate source templates cache to refresh the UI
                                                  queryClient.invalidateQueries({ queryKey: ["/api/source-templates"] });
                                                }
                                              });
                                            }
                                            
                                            // Add to current selection
                                            setSourceStates(prev => ({
                                              ...prev,
                                              [template.sourceName]: {
                                                ...state,
                                                selectedMediums: [...state.selectedMediums, mediumValue]
                                              }
                                            }));
                                            
                                            // Reset input
                                            setCustomMediumInputs(prev => ({
                                              ...prev,
                                              [template.sourceName]: {
                                                value: '',
                                                addToLibrary: false,
                                                show: false
                                              }
                                            }));
                                          }
                                        }
                                      }}
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        const mediumValue = customMediumInputs[template.sourceName]?.value?.trim();
                                        if (mediumValue && !template.mediums?.includes(mediumValue)) {
                                          const shouldAddToLibrary = customMediumInputs[template.sourceName]?.addToLibrary || false;
                                          
                                          if (shouldAddToLibrary) {
                                            // Add to template in database
                                            updateSourceTemplateMutation.mutate({
                                              templateId: template.id,
                                              updates: {
                                                mediums: [...(template.mediums || []), mediumValue]
                                              }
                                            }, {
                                              onSuccess: () => {
                                                // Invalidate source templates cache to refresh the UI
                                                queryClient.invalidateQueries({ queryKey: ["/api/source-templates"] });
                                              }
                                            });
                                          }
                                          
                                          // Add to current selection
                                          setSourceStates(prev => ({
                                            ...prev,
                                            [template.sourceName]: {
                                              ...state,
                                              selectedMediums: [...state.selectedMediums, mediumValue]
                                            }
                                          }));
                                          
                                          // Reset input
                                          setCustomMediumInputs(prev => ({
                                            ...prev,
                                            [template.sourceName]: {
                                              value: '',
                                              addToLibrary: false,
                                              show: false
                                            }
                                          }));
                                        }
                                      }}
                                    >
                                      Add
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setCustomMediumInputs(prev => ({
                                          ...prev,
                                          [template.sourceName]: {
                                            value: '',
                                            addToLibrary: false,
                                            show: false
                                          }
                                        }));
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setCustomMediumInputs(prev => ({
                                        ...prev,
                                        [template.sourceName]: {
                                          value: '',
                                          addToLibrary: false,
                                          show: true
                                        }
                                      }));
                                    }}
                                  >
                                    <Plus className="w-4 h-4 mr-1" />
                                    Add Medium
                                  </Button>
                                )}
                              </div>
                              
                              {/* Checkbox for adding to library */}
                              {customMediumInputs[template.sourceName]?.show && (
                                <div className="flex items-center space-x-2 mt-2">
                                  <Checkbox
                                    id={`add-to-library-${template.sourceName}`}
                                    checked={customMediumInputs[template.sourceName]?.addToLibrary || false}
                                    onCheckedChange={(checked) => {
                                      setCustomMediumInputs(prev => ({
                                        ...prev,
                                        [template.sourceName]: {
                                          ...prev[template.sourceName],
                                          addToLibrary: !!checked
                                        }
                                      }));
                                    }}
                                  />
                                  <Label htmlFor={`add-to-library-${template.sourceName}`} className="text-sm">
                                    Add to source library
                                  </Label>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
            
            {/* Next Button at bottom of section */}
            {!editMode && (
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={() => handleNext('sources', 'output')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Section 4: Campaign Links */}
      <Card>
        <SectionHeader 
          title="Campaign Links" 
          sectionKey="output"
        />
        {expandedSections.output && (
          <div className="p-6">
            <div className="space-y-6">
              {/* Copy Campaign Links Button */}
              {getCheckedSourcesWithContent().length > 0 && (
                <div className="flex justify-end">
                  <Button 
                    variant="outline" 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      copyAllCampaignLinks();
                    }}
                    className="mb-4"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Campaign Links
                  </Button>
                </div>
              )}
              
              {Object.entries(sourceStates)
                .filter(([, state]) => state.checked && state.selectedMediums.length > 0)
                .map(([sourceName, state]) => (
                  <div key={sourceName} className="border rounded-lg overflow-hidden">
                    <div className="bg-blue-50 p-3 border-b">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">{sourceName}</h3>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            copySourceLinks(sourceName);
                          }}
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          Copy Source Links
                        </Button>
                      </div>
                    </div>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b">
                            <th className="text-left p-3 text-sm font-medium text-gray-700 w-24">Medium</th>
                            <th className="text-left p-3 text-sm font-medium text-gray-700 w-40">Content</th>
                            {landingPages.length > 0 && (
                              <th className="text-left p-3 text-sm font-medium text-gray-700 w-40">Landing Page</th>
                            )}
                            <th className="text-left p-3 text-sm font-medium text-gray-700 w-60">Link name</th>
                            <th className="text-left p-3 text-sm font-medium text-gray-700">UTM Link</th>
                          </tr>
                        </thead>
                        <tbody>
                          {state.selectedMediums.flatMap((medium: string) => {
                            const variants = getContentVariantsForMedium(sourceName, medium);
                            return variants.map((variant, variantIndex) => {
                              // Get selected landing page for this medium
                              const selectedLandingPageId = state.landingPageSelections[medium];
                              const selectedLandingPage = landingPages.find(lp => lp.id === selectedLandingPageId);
                              // Use selected landing page URL, fall back to default targetUrl, or first landing page if available
                              const urlToUse = selectedLandingPage?.url || targetUrl || (landingPages.length > 0 ? landingPages[0].url : '');
                              
                              const linkName = `${sourceName} ${medium.charAt(0).toUpperCase() + medium.slice(1)} ${variant.content || ''}`.trim();
                              const utmLink = variant.content.trim() && urlToUse ? generateUTMLink({
                                targetUrl: urlToUse,
                                utm_campaign: campaignName,
                                utm_source: sourceName.toLowerCase(),
                                utm_medium: medium,
                                utm_content: variant.content.trim()
                              }) : '';
                              
                              return (
                                <tr key={variant.id} className="border-b last:border-b-0 hover:bg-gray-50">
                                  <td className="p-3">
                                    <div className="text-sm font-medium text-gray-900">{medium}</div>
                                  </td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <Input
                                        value={variant.content}
                                        onChange={(e) => updateContentVariant(sourceName, medium, variant.id, e.target.value)}
                                        placeholder="Content..."
                                        className="text-sm flex-1"
                                      />
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => addContentVariant(sourceName, medium, variant.id)}
                                        className="flex-shrink-0"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </td>
                                  {landingPages.length > 0 && (
                                    <td className="p-3">
                                      <Select
                                        value={selectedLandingPageId || ""}
                                        onValueChange={(value) => {
                                          setSourceStates(prev => ({
                                            ...prev,
                                            [sourceName]: {
                                              ...prev[sourceName],
                                              landingPageSelections: {
                                                ...prev[sourceName].landingPageSelections,
                                                [medium]: value
                                              }
                                            }
                                          }));
                                        }}
                                      >
                                        <SelectTrigger className="w-full h-8 text-xs">
                                          <SelectValue placeholder="Choose page" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {landingPages.map((lp) => (
                                            <SelectItem key={lp.id} value={lp.id}>
                                              {lp.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </td>
                                  )}
                                  <td className="p-3">
                                    <div className="text-sm text-gray-600">{linkName}</div>
                                  </td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <div className="text-xs font-mono text-gray-500 break-all flex-1">
                                        {utmLink}
                                      </div>
                                      {utmLink && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(utmLink);
                                            toast({
                                              title: "Copied!",
                                              description: "UTM link copied to clipboard",
                                            });
                                          }}
                                          className="flex-shrink-0"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            });
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                      {state.selectedMediums.flatMap((medium: string) => {
                        const variants = getContentVariantsForMedium(sourceName, medium);
                        return variants.map((variant, variantIndex) => {
                          // Get selected landing page for this medium
                          const selectedLandingPageId = state.landingPageSelections[medium];
                          const selectedLandingPage = landingPages.find(lp => lp.id === selectedLandingPageId);
                          // Use selected landing page URL, fall back to default targetUrl, or first landing page if available
                          const urlToUse = selectedLandingPage?.url || targetUrl || (landingPages.length > 0 ? landingPages[0].url : '');
                          
                          const linkName = `${sourceName} ${medium.charAt(0).toUpperCase() + medium.slice(1)} ${variant.content || ''}`.trim();
                          const utmLink = variant.content.trim() && urlToUse ? generateUTMLink({
                            targetUrl: urlToUse,
                            utm_campaign: campaignName,
                            utm_source: sourceName.toLowerCase(),
                            utm_medium: medium,
                            utm_content: variant.content.trim()
                          }) : '';
                          
                          return (
                            <div key={variant.id} className="bg-white border rounded-lg p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded">
                                  {medium}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addContentVariant(sourceName, medium, variant.id)}
                                  className="flex-shrink-0"
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                              
                              <div>
                                <Label className="text-xs text-gray-600 mb-1 block">Content</Label>
                                <Input
                                  value={variant.content}
                                  onChange={(e) => updateContentVariant(sourceName, medium, variant.id, e.target.value)}
                                  placeholder="Content..."
                                  className="text-sm"
                                />
                              </div>
                              
                              {landingPages.length > 0 && (
                                <div>
                                  <Label className="text-xs text-gray-600 mb-1 block">Landing Page</Label>
                                  <Select
                                    value={selectedLandingPageId || ""}
                                    onValueChange={(value) => {
                                      setSourceStates(prev => ({
                                        ...prev,
                                        [sourceName]: {
                                          ...prev[sourceName],
                                          landingPageSelections: {
                                            ...prev[sourceName].landingPageSelections,
                                            [medium]: value
                                          }
                                        }
                                      }));
                                    }}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Choose page" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {landingPages.map((lp) => (
                                        <SelectItem key={lp.id} value={lp.id}>
                                          {lp.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              
                              <div>
                                <Label className="text-xs text-gray-600 mb-1 block">Link Name</Label>
                                <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                                  {linkName}
                                </div>
                              </div>
                              
                              {utmLink && (
                                <div>
                                  <Label className="text-xs text-gray-600 mb-1 block">UTM Link</Label>
                                  <div className="flex items-center gap-2">
                                    <div className="text-xs font-mono text-gray-500 bg-gray-50 p-2 rounded flex-1 break-all">
                                      {utmLink}
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(utmLink);
                                        toast({
                                          title: "Copied!",
                                          description: "UTM link copied to clipboard",
                                        });
                                      }}
                                      className="flex-shrink-0"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        });
                      })}
                    </div>
                  </div>
                ))}

              {/* Save Button */}
              {getCheckedSourcesWithContent().length > 0 && (
                <div className="flex justify-end pt-6 border-t">
                  <Button
                    onClick={async () => {
                      // In edit mode, first delete existing campaign links
                      if (editMode && existingCampaignData.length > 0) {
                        try {
                          await deleteCampaignLinksMutation.mutateAsync(campaignName);
                        } catch (error) {
                          console.error("Failed to delete existing campaign links:", error);
                          toast({
                            title: "Error",
                            description: "Failed to update campaign. Please try again.",
                            variant: "destructive",
                          });
                          return;
                        }
                      }
                      
                      // Save all valid combinations to database
                      const validSources = getCheckedSourcesWithContent();
                      
                      let successCount = 0;
                      
                      for (const source of validSources) {
                        try {
                          await createUtmLinkMutation.mutateAsync({
                            userId: user.id,
                            targetUrl,
                            utm_campaign: campaignName,
                            utm_source: source.sourceName.toLowerCase(),
                            utm_medium: source.medium,
                            utm_content: source.content,
                            fullUtmLink: source.utmLink,
                            tags: selectedTags
                          });
                          successCount++;
                        } catch (error) {
                          console.error("Failed to save link:", error);
                        }
                      }
                      
                      if (successCount > 0) {
                        // Invalidate the utm-links cache to refresh campaign management page
                        await queryClient.invalidateQueries({ queryKey: ["/api/utm-links"] });
                        // Clear all cached data and force refetch
                        await queryClient.removeQueries({ queryKey: ["/api/utm-links"] });
                        await queryClient.refetchQueries({ queryKey: ["/api/utm-links"] });
                        
                        toast({
                          title: "Success",
                          description: editMode 
                            ? `Updated ${successCount} UTM links successfully`
                            : `Generated ${successCount} UTM links successfully`,
                        });
                        
                        // Add a small delay to ensure cache is cleared before navigation
                        setTimeout(() => {
                          if (onSaveSuccess) {
                            onSaveSuccess();
                          }
                        }, 100);
                      } else {
                        toast({
                          title: "Error",
                          description: "Failed to generate UTM links. Please check your inputs.",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!campaignName.trim() || !hasValidUrl() || getCheckedSourcesWithContent().length === 0}
                  >
                    {editMode ? "Update Campaign" : `Save Campaign Links (${getCheckedSourcesWithContent().length})`}
                  </Button>
                </div>
              )}

              {/* Empty State */}
              {Object.entries(sourceStates).filter(([, state]) => state.checked && state.selectedMediums.length > 0).length === 0 && (
                <div className="text-center py-12">
                  <div className="text-gray-500 mb-2">No sources and mediums selected</div>
                  <div className="text-sm text-gray-400">
                    Please select sources and mediums in the previous section.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}