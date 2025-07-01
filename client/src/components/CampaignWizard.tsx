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
}

interface SourceState {
  checked: boolean;
  selectedMediums: string[];
  contentInputs: { [medium: string]: string };
}

export default function CampaignWizard({ user, onSaveSuccess, editMode = false, existingCampaignData = [] }: CampaignWizardProps) {
  const [campaignName, setCampaignName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [sourceStates, setSourceStates] = useState<{ [sourceName: string]: SourceState }>({});
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

  const validateSection = (section: string): boolean => {
    switch (section) {
      case 'campaign':
        return campaignName.trim() !== '' && targetUrl.trim() !== '' && validateUrl(targetUrl);
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
          else if (!targetUrl.trim()) errorMessage = 'Landing page URL is required';
          else if (!validateUrl(targetUrl)) errorMessage = 'Please enter a valid URL';
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

  // Existing helper functions
  const getCheckedSourcesWithContent = () => {
    return Object.entries(sourceStates)
      .filter(([, state]) => state.checked)
      .flatMap(([sourceName, state]) =>
        state.selectedMediums.map(medium => ({
          sourceName,
          medium,
          content: state.contentInputs[medium] || '',
          utmLink: generateUTMLink({
            targetUrl,
            utm_campaign: campaignName,
            utm_source: sourceName.toLowerCase(),
            utm_medium: medium,
            utm_content: state.contentInputs[medium] || ''
          })
        }))
      )
      .filter(link => link.content.trim() !== '');
  };

  // Initialize form with existing campaign data when in edit mode
  useEffect(() => {
    if (editMode && existingCampaignData.length > 0) {
      const firstLink = existingCampaignData[0];
      setCampaignName(firstLink.utm_campaign);
      setTargetUrl(firstLink.targetUrl);
      setSelectedTags(firstLink.tags || []);
      
      // Group existing links by source and medium to populate form
      const newSourceStates: { [sourceName: string]: SourceState } = {};
      
      existingCampaignData.forEach(link => {
        const sourceName = link.utm_source;
        const medium = link.utm_medium;
        const content = link.utm_content || '';
        
        if (!newSourceStates[sourceName]) {
          newSourceStates[sourceName] = {
            checked: true,
            selectedMediums: [],
            contentInputs: {}
          };
        }
        
        if (!newSourceStates[sourceName].selectedMediums.includes(medium)) {
          newSourceStates[sourceName].selectedMediums.push(medium);
        }
        
        newSourceStates[sourceName].contentInputs[medium] = content;
      });
      
      setSourceStates(newSourceStates);
    }
  }, [editMode, existingCampaignData]);

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
            <div className="grid grid-cols-2 gap-6">
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
              <div>
                <Label htmlFor="targetUrl" className="text-sm font-medium">
                  Landing Page URL *
                </Label>
                <Input
                  id="targetUrl"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="Fill in landing page URL..."
                  className="mt-1"
                />
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
                    contentInputs: {}
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
              {/* Content Input Section */}
              <div>
                <Label className="text-lg font-medium mb-4 block">Content for Selected Sources & Mediums</Label>
                <div className="space-y-4">
                  {Object.entries(sourceStates)
                    .filter(([, state]) => state.checked && state.selectedMediums.length > 0)
                    .map(([sourceName, state]) => (
                      <Card key={sourceName}>
                        <CardContent className="p-4">
                          <h4 className="font-medium text-lg mb-3">{sourceName}</h4>
                          <div className="space-y-3">
                            {state.selectedMediums.map((medium: string) => (
                              <div key={medium} className="flex items-center gap-3">
                                <Label className="w-20 text-sm font-medium">{medium}:</Label>
                                <Input
                                  value={state.contentInputs[medium] || ''}
                                  onChange={(e) => {
                                    setSourceStates(prev => ({
                                      ...prev,
                                      [sourceName]: {
                                        ...state,
                                        contentInputs: {
                                          ...state.contentInputs,
                                          [medium]: e.target.value
                                        }
                                      }
                                    }));
                                  }}
                                  placeholder={`Content for ${medium}...`}
                                  className="flex-1"
                                />
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>

              {/* UTM Links Preview Section */}
              {getCheckedSourcesWithContent().length > 0 && (
                <div>
                  <Label className="text-lg font-medium mb-4 block">Generated UTM Links</Label>
                  <div className="space-y-2">
                    {getCheckedSourcesWithContent().map((link, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-700 mb-1">
                            {link.sourceName} • {link.medium} • {link.content}
                          </div>
                          <div className="text-xs font-mono text-gray-600 break-all">
                            {link.utmLink}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(link.utmLink);
                            toast({
                              title: "Copied!",
                              description: "UTM link copied to clipboard",
                            });
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Save Button */}
              {getCheckedSourcesWithContent().length > 0 && (
                <div className="flex justify-end">
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
                        toast({
                          title: "Success",
                          description: editMode 
                            ? `Updated ${successCount} UTM links successfully`
                            : `Generated ${successCount} UTM links successfully`,
                        });
                        // Navigate back to management page after successful save
                        if (onSaveSuccess) {
                          onSaveSuccess();
                        }
                      } else {
                        toast({
                          title: "Error",
                          description: "Failed to generate UTM links. Please check your inputs.",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!campaignName.trim() || !targetUrl.trim() || getCheckedSourcesWithContent().length === 0}
                  >
                    {editMode ? "Update Campaign" : `Save Campaign Links (${getCheckedSourcesWithContent().length})`}
                  </Button>
                </div>
              )}

              {/* Empty State */}
              {getCheckedSourcesWithContent().length === 0 && (
                <div className="text-center py-12">
                  <div className="text-gray-500 mb-2">No UTM links to generate</div>
                  <div className="text-sm text-gray-400">
                    Please select sources, mediums, and add content in the previous sections.
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