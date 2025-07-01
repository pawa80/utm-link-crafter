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
import { Plus, Copy, X } from "lucide-react";
import type { User, SourceTemplate, UtmLink } from "@shared/schema";

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

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sourceTemplates = [] } = useQuery({
    queryKey: ["/api/source-templates"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/source-templates");
      return response.json();
    },
  });

  const createUtmLinkMutation = useMutation({
    mutationFn: async (linkData: any) => {
      const response = await apiRequest("POST", "/api/utm-links", linkData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/utm-links"] });
    },
  });

  const createSourceTemplateMutation = useMutation({
    mutationFn: async (templateData: { sourceName: string; mediums: string[] }) => {
      const response = await apiRequest("POST", "/api/source-templates", templateData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/source-templates'] });
    },
  });

  // Initialize form with existing campaign data when in edit mode
  useEffect(() => {
    if (editMode && existingCampaignData.length > 0) {
      const firstLink = existingCampaignData[0];
      setCampaignName(firstLink.utm_campaign);
      setTargetUrl(firstLink.targetUrl);
      
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

  // Get all available sources (predefined + user templates)
  const getAllSources = () => {
    const templateSources = sourceTemplates.map((t: SourceTemplate) => t.sourceName);
    const predefinedSources = ["Facebook", "LinkedIn", "Twitter", "Google Ads", "Sales Event", "Google", "Pinterest", "TikTok", "Pål Erik"];
    const combined = [...predefinedSources, ...templateSources];
    return combined.filter((source, index) => combined.indexOf(source) === index);
  };

  const getAvailableMediums = (sourceName: string): string[] => {
    const template = sourceTemplates.find((t: SourceTemplate) => t.sourceName === sourceName);
    if (template?.mediums && template.mediums.length > 0) {
      return template.mediums;
    }
    // Default mediums for common sources
    return ["organic", "paid", "email", "social", "referral"];
  };

  const handleSourceToggle = (sourceName: string, checked: boolean) => {
    setSourceStates(prev => ({
      ...prev,
      [sourceName]: {
        checked,
        selectedMediums: checked ? (prev[sourceName]?.selectedMediums || []) : [],
        contentInputs: checked ? (prev[sourceName]?.contentInputs || {}) : {}
      }
    }));
  };

  const handleMediumSelect = (sourceName: string, medium: string) => {
    setSourceStates(prev => {
      const currentState = prev[sourceName] || { checked: true, selectedMediums: [], contentInputs: {} };
      const isAlreadySelected = currentState.selectedMediums.includes(medium);
      
      if (isAlreadySelected) return prev;
      
      return {
        ...prev,
        [sourceName]: {
          ...currentState,
          selectedMediums: [...currentState.selectedMediums, medium],
          contentInputs: { ...currentState.contentInputs, [medium]: "" }
        }
      };
    });
  };

  const removeMedium = (sourceName: string, medium: string) => {
    setSourceStates(prev => {
      const currentState = prev[sourceName];
      if (!currentState) return prev;
      
      const { [medium]: removed, ...remainingInputs } = currentState.contentInputs;
      
      return {
        ...prev,
        [sourceName]: {
          ...currentState,
          selectedMediums: currentState.selectedMediums.filter(m => m !== medium),
          contentInputs: remainingInputs
        }
      };
    });
  };

  const handleContentChange = (sourceName: string, medium: string, content: string) => {
    setSourceStates(prev => ({
      ...prev,
      [sourceName]: {
        ...prev[sourceName],
        contentInputs: {
          ...prev[sourceName]?.contentInputs,
          [medium]: content
        }
      }
    }));
  };

  // Track duplicated rows separately from regular medium selection
  const [duplicatedRows, setDuplicatedRows] = useState<{[sourceName: string]: Array<{id: string, medium: string, insertAfterIndex: number}>}>({});

  const duplicateRow = (sourceName: string, rowKey: string) => {
    const sourceState = sourceStates[sourceName];
    if (!sourceState) return;

    // Determine the actual medium name and find the base medium index
    const actualMedium = rowKey.includes('_') && rowKey.match(/_\d+_/) ? rowKey.split('_')[0] : rowKey;
    const baseMediumIndex = sourceState.selectedMediums.indexOf(actualMedium);
    if (baseMediumIndex === -1) return;

    // Create a unique ID for the duplicate row
    const duplicateId = `${actualMedium}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    setDuplicatedRows(prev => ({
      ...prev,
      [sourceName]: [
        ...(prev[sourceName] || []),
        { id: duplicateId, medium: actualMedium, insertAfterIndex: baseMediumIndex }
      ]
    }));

    // Add content input for the duplicated row
    setSourceStates(prev => ({
      ...prev,
      [sourceName]: {
        ...prev[sourceName],
        contentInputs: {
          ...prev[sourceName]?.contentInputs,
          [duplicateId]: "" // Always blank for new row
        }
      }
    }));
  };

  const addCustomSource = async () => {
    if (!customSource.trim()) return;

    const newSourceName = customSource.trim();
    
    // Initialize the source state
    setSourceStates(prev => ({
      ...prev,
      [newSourceName]: {
        checked: true,
        selectedMediums: [],
        contentInputs: {}
      }
    }));

    // Save to templates
    try {
      await createSourceTemplateMutation.mutateAsync({
        sourceName: newSourceName,
        mediums: []
      });
      toast({
        title: "Source Added",
        description: `${newSourceName} added to your library`,
      });
    } catch (error) {
      console.error("Failed to save template:", error);
    }

    setCustomSource("");
    setShowAddSource(false);
  };

  const showCustomMediumInput = (sourceName: string) => {
    setCustomMediumInputs(prev => ({
      ...prev,
      [sourceName]: { value: "", addToLibrary: false, show: true }
    }));
  };

  const hideCustomMediumInput = (sourceName: string) => {
    setCustomMediumInputs(prev => ({
      ...prev,
      [sourceName]: { value: "", addToLibrary: false, show: false }
    }));
  };

  const updateCustomMediumInput = (sourceName: string, value: string, addToLibrary: boolean) => {
    setCustomMediumInputs(prev => ({
      ...prev,
      [sourceName]: { ...prev[sourceName], value, addToLibrary }
    }));
  };

  const addCustomMedium = async (sourceName: string) => {
    const input = customMediumInputs[sourceName];
    if (!input?.value.trim()) return;

    const customMedium = input.value.trim();
    
    // Add medium to current source
    handleMediumSelect(sourceName, customMedium);

    // Add to library if requested
    if (input.addToLibrary) {
      try {
        const template = sourceTemplates.find((t: SourceTemplate) => t.sourceName === sourceName);
        if (template) {
          const updatedMediums = [...(template.mediums || []), customMedium];
          await createSourceTemplateMutation.mutateAsync({
            sourceName,
            mediums: updatedMediums
          });
        } else {
          await createSourceTemplateMutation.mutateAsync({
            sourceName,
            mediums: [customMedium]
          });
        }
        toast({
          title: "Added to Library",
          description: `${customMedium} added to ${sourceName} template`,
        });
      } catch (error) {
        console.error("Failed to update template:", error);
      }
    }

    // Reset input
    hideCustomMediumInput(sourceName);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const getCheckedSourcesWithContent = () => {
    const results: Array<{
      sourceName: string;
      medium: string;
      content: string;
      utmLink: string;
      linkName: string;
    }> = [];

    // Only proceed if we have required fields
    if (!campaignName.trim() || !targetUrl.trim()) {
      return results;
    }

    Object.entries(sourceStates).forEach(([sourceName, state]) => {
      if (!state.checked) return;
      
      // Create combined list of regular mediums and duplicated rows (same logic as in render)
      const allRows: Array<{key: string, medium: string}> = [];
      
      // Add regular medium rows
      state.selectedMediums.forEach((medium, index) => {
        allRows.push({ key: medium, medium });
        
        // Add any duplicated rows that should appear after this medium
        const duplicates = duplicatedRows[sourceName] || [];
        duplicates
          .filter(dup => dup.insertAfterIndex === index)
          .forEach(dup => {
            allRows.push({ key: dup.id, medium: dup.medium });
          });
      });
      
      // Process all rows (original + duplicated)
      allRows.forEach(({ key, medium }) => {
        const content = state.contentInputs[key] || "";
        if (!content.trim()) return;
        
        const utmLink = generateUTMLink({
          targetUrl,
          utm_campaign: campaignName,
          utm_source: sourceName.toLowerCase(),
          utm_medium: medium,
          utm_content: content
        });

        results.push({
          sourceName,
          medium,
          content,
          utmLink,
          linkName: `${sourceName} ${medium.charAt(0).toUpperCase() + medium.slice(1)} ${content}`
        });
      });
    });

    return results;
  };

  const copyAllLinks = (sourceName: string) => {
    const sourceState = sourceStates[sourceName];
    if (!sourceState || !campaignName.trim() || !targetUrl.trim()) return;
    
    // Create combined list of regular mediums and duplicated rows (same logic as in render)
    const allRows: Array<{key: string, medium: string}> = [];
    
    // Add regular medium rows
    sourceState.selectedMediums.forEach((medium, index) => {
      allRows.push({ key: medium, medium });
      
      // Add any duplicated rows that should appear after this medium
      const duplicates = duplicatedRows[sourceName] || [];
      duplicates
        .filter(dup => dup.insertAfterIndex === index)
        .forEach(dup => {
          allRows.push({ key: dup.id, medium: dup.medium });
        });
    });
    
    const links = allRows
      .map(({ key, medium }) => {
        const content = sourceState.contentInputs[key];
        if (!content || !content.trim()) return null;
        
        const utmLink = generateUTMLink({
          targetUrl,
          utm_campaign: campaignName,
          utm_source: sourceName.toLowerCase(),
          utm_medium: medium,
          utm_content: content
        });

        const linkName = `${sourceName} ${medium.charAt(0).toUpperCase() + medium.slice(1)} ${content}`;
        return `${linkName} - ${utmLink}`;
      })
      .filter(Boolean)
      .join('\n');
    
    if (links) {
      copyToClipboard(links);
    } else {
      toast({
        title: "Missing Information",
        description: "Please fill in Campaign Name and Landing Page URL first",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Campaign Info Section */}
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

      {/* Validation Message */}
      {(!campaignName.trim() || !targetUrl.trim()) && Object.values(sourceStates).some(state => state.checked && state.selectedMediums.length > 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="text-yellow-800">
              <h3 className="text-sm font-medium">Required fields missing</h3>
              <div className="mt-2 text-sm">
                <p>Please fill in the following required fields to generate UTM links:</p>
                <ul className="mt-1 ml-4 list-disc">
                  {!campaignName.trim() && <li>Campaign Name</li>}
                  {!targetUrl.trim() && <li>Landing Page URL</li>}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sources and Mediums Section */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Select Sources and Mediums *</Label>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(() => {
            const allSources = getAllSources();
            const midPoint = Math.ceil(allSources.length / 2);
            const leftColumnSources = allSources.slice(0, midPoint);
            const rightColumnSources = allSources.slice(midPoint);

            return (
              <>
                {/* Left Column */}
                <div className="space-y-3">
                  {leftColumnSources.map((sourceName) => {
                    const state = sourceStates[sourceName] || { checked: false, selectedMediums: [], contentInputs: {} };
                    const availableMediums = getAvailableMediums(sourceName);

                    return (
                      <div key={sourceName} className="flex items-start space-x-4 p-3 border rounded-lg">
                        <div className="w-24 pt-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={state.checked}
                              onCheckedChange={(checked) => handleSourceToggle(sourceName, checked as boolean)}
                            />
                            <span className="text-sm font-medium">{sourceName}</span>
                          </div>
                        </div>
                        
                        <div className="flex-1 space-y-2">
                          {/* Existing selected mediums */}
                          <div className="flex flex-wrap gap-2">
                            {state.selectedMediums.map((medium) => (
                              <div key={medium} className="flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-md">
                                <span className="text-sm">{medium}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeMedium(sourceName, medium)}
                                  className="h-4 w-4 p-0 hover:bg-gray-200"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                          
                          {/* Add new medium dropdown */}
                          {state.checked && (
                            <div className="flex items-center space-x-2">
                              <Select onValueChange={(medium) => handleMediumSelect(sourceName, medium)}>
                                <SelectTrigger className="w-32">
                                  <SelectValue placeholder="Choose..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableMediums
                                    .filter((medium: string) => !state.selectedMediums.includes(medium))
                                    .map((medium: string) => (
                                      <SelectItem key={medium} value={medium}>
                                        {medium}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => showCustomMediumInput(sourceName)}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          )}

                          {/* Custom medium input */}
                          {state.checked && customMediumInputs[sourceName]?.show && (
                            <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-md">
                              <Input
                                value={customMediumInputs[sourceName]?.value || ""}
                                onChange={(e) => updateCustomMediumInput(sourceName, e.target.value, customMediumInputs[sourceName]?.addToLibrary || false)}
                                placeholder="Enter custom medium"
                                className="w-40"
                              />
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  checked={customMediumInputs[sourceName]?.addToLibrary || false}
                                  onCheckedChange={(checked) => updateCustomMediumInput(sourceName, customMediumInputs[sourceName]?.value || "", checked as boolean)}
                                />
                                <span className="text-sm">Add to library</span>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addCustomMedium(sourceName)}
                                disabled={!customMediumInputs[sourceName]?.value?.trim()}
                              >
                                Add
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => hideCustomMediumInput(sourceName)}
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right Column */}
                <div className="space-y-3">
                  {rightColumnSources.map((sourceName) => {
                    const state = sourceStates[sourceName] || { checked: false, selectedMediums: [], contentInputs: {} };
                    const availableMediums = getAvailableMediums(sourceName);

                    return (
                      <div key={sourceName} className="flex items-start space-x-4 p-3 border rounded-lg">
                        <div className="w-24 pt-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={state.checked}
                              onCheckedChange={(checked) => handleSourceToggle(sourceName, checked as boolean)}
                            />
                            <span className="text-sm font-medium">{sourceName}</span>
                          </div>
                        </div>
                        
                        <div className="flex-1 space-y-2">
                          {/* Existing selected mediums */}
                          <div className="flex flex-wrap gap-2">
                            {state.selectedMediums.map((medium) => (
                              <div key={medium} className="flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-md">
                                <span className="text-sm">{medium}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeMedium(sourceName, medium)}
                                  className="h-4 w-4 p-0 hover:bg-gray-200"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                          
                          {/* Add new medium dropdown */}
                          {state.checked && (
                            <div className="flex items-center space-x-2">
                              <Select onValueChange={(medium) => handleMediumSelect(sourceName, medium)}>
                                <SelectTrigger className="w-32">
                                  <SelectValue placeholder="Choose..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableMediums
                                    .filter((medium: string) => !state.selectedMediums.includes(medium))
                                    .map((medium: string) => (
                                      <SelectItem key={medium} value={medium}>
                                        {medium}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => showCustomMediumInput(sourceName)}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          )}

                          {/* Custom medium input */}
                          {state.checked && customMediumInputs[sourceName]?.show && (
                            <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-md">
                              <Input
                                value={customMediumInputs[sourceName]?.value || ""}
                                onChange={(e) => updateCustomMediumInput(sourceName, e.target.value, customMediumInputs[sourceName]?.addToLibrary || false)}
                                placeholder="Enter custom medium"
                                className="w-40"
                              />
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  checked={customMediumInputs[sourceName]?.addToLibrary || false}
                                  onCheckedChange={(checked) => updateCustomMediumInput(sourceName, customMediumInputs[sourceName]?.value || "", checked as boolean)}
                                />
                                <span className="text-sm">Add to library</span>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addCustomMedium(sourceName)}
                                disabled={!customMediumInputs[sourceName]?.value?.trim()}
                              >
                                Add
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => hideCustomMediumInput(sourceName)}
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>

        {/* Add Custom Source */}
        <div className="pt-4 border-t">
          {!showAddSource ? (
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Add Source</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddSource(true)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Input
                value={customSource}
                onChange={(e) => setCustomSource(e.target.value)}
                placeholder="Enter source name"
                className="w-48"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={addCustomSource}
                disabled={!customSource.trim()}
              >
                Add
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddSource(false);
                  setCustomSource("");
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Generated Content Sections */}
      <div className="space-y-6">
        {Object.entries(sourceStates)
          .filter(([_, state]) => state.checked && state.selectedMediums.length > 0)
          .map(([sourceName, state]) => (
            <Card key={sourceName} className="border-l-4 border-l-blue-500">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">{sourceName}</h3>
                
                {/* Desktop: Headers - shown once per source */}
                <div className="hidden md:grid md:grid-cols-4 gap-4 mb-2">
                  <Label className="text-sm font-medium">Medium</Label>
                  <Label className="text-sm font-medium">Content</Label>
                  <Label className="text-sm font-medium">Link name</Label>
                  <Label className="text-sm font-medium">UTM Link</Label>
                </div>
                
                {/* Desktop: Grid rows */}
                <div className="hidden md:block space-y-2">
                  {(() => {
                    // Create combined list of regular mediums and duplicated rows
                    const allRows: Array<{key: string, medium: string, isDuplicated: boolean}> = [];
                    
                    // Add regular medium rows
                    state.selectedMediums.forEach((medium, index) => {
                      allRows.push({ key: medium, medium, isDuplicated: false });
                      
                      // Add any duplicated rows that should appear after this medium
                      const duplicates = duplicatedRows[sourceName] || [];
                      duplicates
                        .filter(dup => dup.insertAfterIndex === index)
                        .forEach(dup => {
                          allRows.push({ key: dup.id, medium: dup.medium, isDuplicated: true });
                        });
                    });
                    
                    return allRows.map(({ key, medium, isDuplicated }) => {
                      const content = state.contentInputs[key] || "";
                      const canGenerateLink = content.trim() && campaignName.trim() && targetUrl.trim();
                      const utmLink = canGenerateLink ? generateUTMLink({
                        targetUrl,
                        utm_campaign: campaignName,
                        utm_source: sourceName.toLowerCase(),
                        utm_medium: medium,
                        utm_content: content
                      }) : "";
                      const linkName = canGenerateLink ? `${sourceName} ${medium.charAt(0).toUpperCase() + medium.slice(1)} ${content}` : "";

                      return (
                        <div key={key} className="grid grid-cols-4 gap-4 items-center">
                          <Input 
                            value={medium} 
                            readOnly 
                            className="bg-gray-50" 
                          />
                          <Input
                            value={content}
                            onChange={(e) => handleContentChange(sourceName, key, e.target.value)}
                            placeholder="fill in content..."
                          />
                          <Input
                            value={linkName}
                            readOnly
                            className="bg-gray-50"
                          />
                          <div className="flex">
                            <Input
                              value={utmLink}
                              readOnly
                              className="flex-1 bg-gray-50 text-xs"
                            />
                            {utmLink && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(`${linkName} - ${utmLink}`)}
                                className="ml-2"
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => duplicateRow(sourceName, key)}
                              className="ml-2"
                              title="Duplicate this row"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Mobile: Stacked layout */}
                <div className="md:hidden space-y-4">
                  {(() => {
                    // Create combined list of regular mediums and duplicated rows
                    const allRows: Array<{key: string, medium: string, isDuplicated: boolean}> = [];
                    
                    // Add regular medium rows
                    state.selectedMediums.forEach((medium, index) => {
                      allRows.push({ key: medium, medium, isDuplicated: false });
                      
                      // Add any duplicated rows that should appear after this medium
                      const duplicates = duplicatedRows[sourceName] || [];
                      duplicates
                        .filter(dup => dup.insertAfterIndex === index)
                        .forEach(dup => {
                          allRows.push({ key: dup.id, medium: dup.medium, isDuplicated: true });
                        });
                    });
                    
                    return allRows.map(({ key, medium, isDuplicated }) => {
                      const content = state.contentInputs[key] || "";
                      const canGenerateLink = content.trim() && campaignName.trim() && targetUrl.trim();
                      const utmLink = canGenerateLink ? generateUTMLink({
                        targetUrl,
                        utm_campaign: campaignName,
                        utm_source: sourceName.toLowerCase(),
                        utm_medium: medium,
                        utm_content: content
                      }) : "";
                      const linkName = canGenerateLink ? `${sourceName} ${medium.charAt(0).toUpperCase() + medium.slice(1)} ${content}` : "";

                      return (
                        <div key={key} className="border rounded-lg p-3 space-y-3">
                          {/* Medium and Content on same line */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-gray-600 mb-1 block">Medium</Label>
                              <Input 
                                value={medium} 
                                readOnly 
                                className="bg-gray-50 text-sm" 
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-600 mb-1 block">Content</Label>
                              <Input
                                value={content}
                                onChange={(e) => handleContentChange(sourceName, key, e.target.value)}
                                placeholder="fill in content..."
                                className="text-sm"
                              />
                            </div>
                          </div>
                          
                          {/* Link name below */}
                          <div>
                            <Label className="text-xs text-gray-600 mb-1 block">Link name</Label>
                            <Input
                              value={linkName}
                              readOnly
                              className="bg-gray-50 text-sm"
                            />
                          </div>
                          
                          {/* UTM Link below - with line breaks if needed */}
                          <div>
                            <Label className="text-xs text-gray-600 mb-1 block">UTM Link</Label>
                            <div className="bg-gray-50 border rounded p-2 min-h-[60px] break-all text-xs leading-relaxed">
                              {utmLink || "Fill in content to generate UTM link"}
                            </div>
                          </div>
                          
                          {/* Buttons below UTM link */}
                          <div className="flex gap-2 pt-2">
                            {utmLink && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(`${linkName} - ${utmLink}`)}
                                className="flex-1"
                              >
                                <Copy className="w-4 h-4 mr-2" />
                                Copy
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => duplicateRow(sourceName, key)}
                              className="flex-1"
                              title="Duplicate this row"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Duplicate
                            </Button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                
                <div className="mt-4">
                  <Button
                    onClick={() => copyAllLinks(sourceName)}
                    className="w-full"
                    disabled={(() => {
                      // Check if any row (original or duplicated) has content
                      const allRows: Array<{key: string}> = [];
                      
                      // Add regular medium rows
                      state.selectedMediums.forEach((medium, index) => {
                        allRows.push({ key: medium });
                        
                        // Add any duplicated rows that should appear after this medium
                        const duplicates = duplicatedRows[sourceName] || [];
                        duplicates
                          .filter(dup => dup.insertAfterIndex === index)
                          .forEach(dup => {
                            allRows.push({ key: dup.id });
                          });
                      });
                      
                      return !allRows.some(row => state.contentInputs[row.key]?.trim());
                    })()}
                  >
                    COPY LINKS
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Generate All Links Button - Only show if we have valid combinations */}
      {getCheckedSourcesWithContent().length > 0 && (
        <div className="pt-8 border-t">
          <Button
            onClick={async () => {
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
                    fullUtmLink: source.utmLink
                  });
                  successCount++;
                } catch (error) {
                  console.error("Failed to save link:", error);
                }
              }
              
              if (successCount > 0) {
                toast({
                  title: "Success",
                  description: `Generated ${successCount} UTM links successfully`,
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
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!campaignName.trim() || !targetUrl.trim() || getCheckedSourcesWithContent().length === 0}
          >
            Save Campaign Links ({getCheckedSourcesWithContent().length})
          </Button>
        </div>
      )}
    </div>
  );
}