import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generateUTMLink, validateUrl } from "@/lib/utm";
import { ArrowRight, ArrowLeft, Target, Link as LinkIcon, CheckCircle } from "lucide-react";
import type { User, SourceTemplate } from "@shared/schema";

interface CampaignWizardProps {
  user: User;
}

interface SourceSelection {
  sourceName: string;
  mediums: string[];
}

interface ContentVariant {
  medium: string;
  content: string;
}

export default function CampaignWizard({ user }: CampaignWizardProps) {
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [selectedSources, setSelectedSources] = useState<SourceSelection[]>([]);
  const [contentVariants, setContentVariants] = useState<ContentVariant[]>([]);
  const [generatedLinks, setGeneratedLinks] = useState<any[]>([]);
  const [customSource, setCustomSource] = useState("");
  const [customMedium, setCustomMedium] = useState("");
  const [addingCustomMedium, setAddingCustomMedium] = useState<{[key: string]: boolean}>({});
  const [newMediumInput, setNewMediumInput] = useState<{[key: string]: string}>({});
  const [saveToTemplate, setSaveToTemplate] = useState<{[key: string]: boolean}>({});

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
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to create UTM link",
        variant: "destructive",
      });
    },
  });

  const updateSourceTemplateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<SourceTemplate>) => {
      const response = await apiRequest("PATCH", `/api/source-templates/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/source-templates'] });
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

  const totalSteps = 3;

  const handleSourceToggle = (sourceName: string, checked: boolean) => {
    if (checked) {
      setSelectedSources([...selectedSources, {
        sourceName,
        mediums: []
      }]);
    } else {
      setSelectedSources(selectedSources.filter(s => s.sourceName !== sourceName));
    }
  };

  const addCustomSource = async () => {
    if (customSource.trim() && !getAllAvailableSources().includes(customSource.trim())) {
      const newSourceName = customSource.trim();
      
      // Add the new custom source as selected (with no initial mediums)
      setSelectedSources([...selectedSources, {
        sourceName: newSourceName,
        mediums: []
      }]);
      
      // Automatically create template for the new source
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
        toast({
          title: "Source Added",
          description: `${newSourceName} added to campaign (library save failed)`,
          variant: "destructive",
        });
      }
      
      setCustomSource("");
    }
  };

  const removeCustomSource = (sourceName: string) => {
    setSelectedSources(selectedSources.filter(s => s.sourceName !== sourceName));
  };

  const getAllAvailableSources = () => {
    const templateSources = sourceTemplates.map((t: SourceTemplate) => t.sourceName);
    const userSources = user.defaultSources || [];
    const customSources = selectedSources
      .filter(s => !templateSources.includes(s.sourceName) && !userSources.includes(s.sourceName))
      .map(s => s.sourceName);
    const combinedSources = [...templateSources, ...userSources, ...customSources];
    const uniqueSources = combinedSources.filter((source, index) => 
      combinedSources.indexOf(source) === index
    );
    return uniqueSources;
  };

  const updateSourceMediums = (sourceName: string, mediums: string[]) => {
    setSelectedSources(selectedSources.map(source => 
      source.sourceName === sourceName 
        ? { ...source, mediums }
        : source
    ));
  };

  const addCustomMediumToSource = async (sourceName: string, newMedium: string, saveToTemplate: boolean = false) => {
    // Add medium to current campaign
    setSelectedSources(selectedSources.map(source => 
      source.sourceName === sourceName 
        ? { ...source, mediums: [...source.mediums, newMedium] }
        : source
    ));

    // If user wants to save to template
    if (saveToTemplate) {
      const template = sourceTemplates.find((t: SourceTemplate) => t.sourceName === sourceName);
      try {
        if (template) {
          // Update existing template
          await updateSourceTemplateMutation.mutateAsync({
            id: template.id,
            mediums: [...(template.mediums || []), newMedium]
          });
          toast({
            title: "Success",
            description: `Added "${newMedium}" to ${sourceName} template`,
          });
        } else {
          // Create new template
          await createSourceTemplateMutation.mutateAsync({
            sourceName,
            mediums: [newMedium]
          });
          toast({
            title: "Success",
            description: `Created ${sourceName} template with "${newMedium}"`,
          });
        }
      } catch (error) {
        toast({
          title: "Added to Campaign",
          description: `"${newMedium}" added to current campaign only`,
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Added to Campaign",
        description: `"${newMedium}" added to current campaign`,
      });
    }

    // Clear input states
    setNewMediumInput(prev => ({ ...prev, [sourceName]: '' }));
    setSaveToTemplate(prev => ({ ...prev, [sourceName]: false }));
    setAddingCustomMedium(prev => ({ ...prev, [sourceName]: false }));
  };

  const isStep1Valid = () => {
    return campaignName.trim() !== "" && 
           targetUrl.trim() !== "" && 
           validateUrl(targetUrl) &&
           selectedSources.length > 0 &&
           selectedSources.every(source => source.mediums.length > 0);
  };

  const isStep2Valid = () => {
    return contentVariants.every(variant => variant.content.trim() !== "");
  };

  const nextStep = () => {
    if (step === 1) {
      if (!campaignName.trim() || !targetUrl.trim() || selectedSources.length === 0) {
        toast({
          title: "Missing Information",
          description: "Please fill in campaign name, URL, and select at least one source",
          variant: "destructive",
        });
        return;
      }

      const sourcesWithoutMediums = selectedSources.filter(source => source.mediums.length === 0);
      if (sourcesWithoutMediums.length > 0) {
        toast({
          title: "Mediums Required",
          description: `Please select mediums for: ${sourcesWithoutMediums.map(s => s.sourceName).join(', ')}`,
          variant: "destructive",
        });
        return;
      }
      
      if (!validateUrl(targetUrl)) {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid target URL",
          variant: "destructive",
        });
        return;
      }

      // Initialize content variants for step 2
      const variants: ContentVariant[] = [];
      selectedSources.forEach(source => {
        source.mediums.forEach(medium => {
          variants.push({ medium: `${source.sourceName}-${medium}`, content: '' });
        });
      });
      setContentVariants(variants);
    }
    
    setStep(step + 1);
  };

  const prevStep = () => setStep(step - 1);

  const generateLinks = async () => {
    const links: any[] = [];
    
    for (const variant of contentVariants) {
      const [sourceName, mediumName] = variant.medium.split('-');

      const utmLink = generateUTMLink({
        targetUrl,
        utm_campaign: campaignName,
        utm_source: sourceName,
        utm_medium: mediumName,
        utm_content: variant.content,
      });

      const linkData = {
        targetUrl,
        utm_campaign: campaignName,
        utm_source: sourceName,
        utm_medium: mediumName,
        utm_content: variant.content,
        fullUtmLink: utmLink,
      };

      try {
        const result = await createUtmLinkMutation.mutateAsync(linkData);
        links.push({ ...linkData, ...result, generatedLink: utmLink });
      } catch (error) {
        console.error('Failed to create link:', error);
        toast({
          title: "Error",
          description: `Failed to create link for ${sourceName}-${mediumName}`,
          variant: "destructive",
        });
      }
    }
    
    setGeneratedLinks(links);
    setStep(3);
  };

  const updateContentVariant = (index: number, content: string) => {
    setContentVariants(contentVariants.map((variant, i) => 
      i === index ? { ...variant, content } : variant
    ));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy link to clipboard",
        variant: "destructive",
      });
    }
  };

  const getAvailableMediums = (sourceName: string) => {
    const template = sourceTemplates.find((t: SourceTemplate) => t.sourceName === sourceName);
    return template?.mediums || [];
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8 h-full">
      {/* Input Side */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="text-primary mr-2" size={24} />
              New Campaign
            </CardTitle>
            <Progress value={(step / totalSteps) * 100} className="w-full" />
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Step 1: Campaign Setup */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="campaign-name">
                    Campaign Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="campaign-name"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="Summer Sale 2024"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="target-url">
                    Landing Page URL <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="target-url"
                    type="url"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://yoursite.com/landing-page"
                    required
                  />
                </div>

                <div>
                  <Label className="text-base font-medium mb-4 block">
                    Select Sources <span className="text-red-500">*</span>
                  </Label>
                  
                  {/* Available Sources from Templates and User Settings */}
                  <div className="space-y-4 mb-6">
                    {getAllAvailableSources().map((sourceName) => {
                      const isSelected = selectedSources.some(s => s.sourceName === sourceName);
                      const sourceConfig = selectedSources.find(s => s.sourceName === sourceName);
                      const template = sourceTemplates.find((t: SourceTemplate) => t.sourceName === sourceName);
                      const hasTemplate = !!template;
                      
                      const needsMediums = isSelected && sourceConfig?.mediums.length === 0;
                      
                      return (
                        <div key={sourceName} className={`border rounded-lg p-4 space-y-3 ${needsMediums ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={sourceName}
                              checked={isSelected}
                              onCheckedChange={(checked) => handleSourceToggle(sourceName, checked as boolean)}
                            />
                            <Label htmlFor={sourceName} className="font-medium">
                              {sourceName}
                            </Label>
                            {needsMediums && (
                              <Badge variant="destructive" className="text-xs">
                                select mediums
                              </Badge>
                            )}
                          </div>

                          {isSelected && (
                            <div className="space-y-3 ml-6">
                              {/* Only show "Select Mediums" if there are predefined mediums to select */}
                              {hasTemplate && template.mediums && template.mediums.length > 0 && (
                                <div>
                                  <Label className="text-sm">Select Mediums</Label>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {/* Show template mediums */}
                                    {template.mediums.map((medium: string) => (
                                      <div key={medium} className="flex items-center space-x-1">
                                        <Checkbox
                                          id={`${sourceName}-${medium}`}
                                          checked={sourceConfig?.mediums.includes(medium) || false}
                                          onCheckedChange={(checked) => {
                                            const currentMediums = sourceConfig?.mediums || [];
                                            const newMediums = checked 
                                              ? [...currentMediums, medium]
                                              : currentMediums.filter(m => m !== medium);
                                            updateSourceMediums(sourceName, newMediums);
                                          }}
                                        />
                                        <Label htmlFor={`${sourceName}-${medium}`} className="text-sm">
                                          {medium}
                                        </Label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Show session-added custom mediums if any */}
                              {sourceConfig && sourceConfig.mediums && (() => {
                                const customMediums = sourceConfig.mediums.filter(medium => 
                                  !hasTemplate || !template?.mediums || !template.mediums.includes(medium)
                                );
                                return customMediums.length > 0;
                              })() && (
                                <div>
                                  <Label className="text-sm">Custom Mediums</Label>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {sourceConfig.mediums.filter(medium => 
                                      !hasTemplate || !template?.mediums || !template.mediums.includes(medium)
                                    ).map((medium: string) => (
                                      <div key={medium} className="flex items-center space-x-1">
                                        <Checkbox
                                          id={`${sourceName}-custom-${medium}`}
                                          checked={true}
                                          onCheckedChange={(checked) => {
                                            const currentMediums = sourceConfig?.mediums || [];
                                            const newMediums = checked 
                                              ? [...currentMediums, medium]
                                              : currentMediums.filter(m => m !== medium);
                                            updateSourceMediums(sourceName, newMediums);
                                          }}
                                        />
                                        <Label htmlFor={`${sourceName}-custom-${medium}`} className="text-sm">
                                          {medium} <Badge variant="secondary" className="text-xs ml-1">custom</Badge>
                                        </Label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* For sources with no predefined mediums and no added mediums, hide input field */}

                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <Label className="text-sm">Add Custom Medium</Label>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setAddingCustomMedium(prev => ({ ...prev, [sourceName]: !prev[sourceName] }))}
                                  >
                                    {addingCustomMedium[sourceName] ? 'Cancel' : 'Add Medium'}
                                  </Button>
                                </div>
                                
                                {addingCustomMedium[sourceName] && (
                                  <div className="space-y-3 p-3 bg-gray-50 rounded">
                                    <Input
                                      value={newMediumInput[sourceName] || ''}
                                      onChange={(e) => setNewMediumInput(prev => ({ ...prev, [sourceName]: e.target.value }))}
                                      placeholder="Enter new medium (e.g., stories, reels, organic)"
                                    />
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`${sourceName}-save-template`}
                                        checked={saveToTemplate[sourceName] || false}
                                        onCheckedChange={(checked) => setSaveToTemplate(prev => ({ ...prev, [sourceName]: checked as boolean }))}
                                      />
                                      <Label htmlFor={`${sourceName}-save-template`} className="text-sm">
                                        Save to {sourceName} template for future campaigns
                                      </Label>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => addCustomMediumToSource(sourceName, newMediumInput[sourceName] || '', saveToTemplate[sourceName] || false)}
                                      disabled={!newMediumInput[sourceName]?.trim()}
                                    >
                                      Add Medium
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Custom Source */}
                  <div className="border-t pt-4">
                    <Label className="text-sm font-medium mb-3 block">Add Custom Source</Label>
                    <div className="space-y-3">
                      <Input
                        value={customSource}
                        onChange={(e) => setCustomSource(e.target.value)}
                        placeholder="Source name (e.g., TikTok, Pinterest)"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addCustomSource}
                        disabled={!customSource.trim()}
                        className="w-full"
                      >
                        Add Source
                      </Button>
                    </div>
                  </div>


                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={nextStep}
                    disabled={!isStep1Valid()}
                    className={!isStep1Valid() ? "opacity-50 cursor-not-allowed" : ""}
                  >
                    Next Step
                    <ArrowRight className="ml-2" size={16} />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Content Definition */}
            {step === 2 && (
              <div className="space-y-6">
                {/* Purple gradient header */}
                <div className="bg-gradient-to-r from-purple-600 to-purple-400 text-white p-6 rounded-lg">
                  <div className="flex items-center">
                    <Target className="mr-3" size={24} />
                    <h3 className="text-xl font-semibold">New Campaign</h3>
                  </div>
                  <div className="mt-4">
                    <div className="w-full bg-white/20 rounded-full h-2">
                      <div className="bg-white h-2 rounded-full" style={{ width: '66%' }}></div>
                    </div>
                  </div>
                </div>

                {/* Content section */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="flex items-center mb-6">
                    <Target className="text-gray-600 mr-3" size={24} />
                    <h3 className="text-lg font-medium text-gray-800">Define Content for Each Medium</h3>
                  </div>
                  
                  <div className="space-y-4">
                    {contentVariants.map((variant, index) => {
                      const isEmpty = variant.content.trim() === "";
                      const [sourceName, mediumName] = variant.medium.split('-');
                      
                      // Get source icon/color based on source name
                      const getSourceIcon = (source: string) => {
                        const lowerSource = source.toLowerCase();
                        if (lowerSource.includes('på') || lowerSource.includes('pal')) return '🎯';
                        if (lowerSource.includes('tiktok')) return '📱';
                        if (lowerSource.includes('facebook')) return '📘';
                        if (lowerSource.includes('linkedin')) return '💼';
                        if (lowerSource.includes('google')) return '🔍';
                        return '📊';
                      };

                      const getSourceColor = (source: string) => {
                        const lowerSource = source.toLowerCase();
                        if (lowerSource.includes('på') || lowerSource.includes('pal')) return 'bg-blue-500';
                        if (lowerSource.includes('tiktok')) return 'bg-teal-500';
                        if (lowerSource.includes('facebook')) return 'bg-blue-600';
                        if (lowerSource.includes('linkedin')) return 'bg-blue-700';
                        if (lowerSource.includes('google')) return 'bg-red-500';
                        return 'bg-gray-500';
                      };

                      return (
                        <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                              <div className={`w-8 h-8 ${getSourceColor(sourceName)} rounded flex items-center justify-center text-white text-sm font-medium mr-3`}>
                                {getSourceIcon(sourceName)}
                              </div>
                              <span className="font-medium text-gray-800">{sourceName}-{mediumName}</span>
                            </div>
                            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                              {mediumName}
                            </span>
                          </div>
                          
                          <textarea
                            value={variant.content}
                            onChange={(e) => updateContentVariant(index, e.target.value)}
                            placeholder="Enter content description"
                            className={`w-full h-20 p-3 border rounded-md resize-none ${isEmpty ? 'border-orange-300 bg-orange-50' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                          />
                          
                          {isEmpty && (
                            <div className="flex items-center mt-2 text-red-500">
                              <span className="text-sm">⚠️ Content is required</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={prevStep} className="flex items-center">
                    <ArrowLeft className="mr-2" size={16} />
                    Back
                  </Button>
                  <Button 
                    onClick={generateLinks}
                    disabled={!isStep2Valid()}
                    className={`bg-purple-600 hover:bg-purple-700 text-white flex items-center ${!isStep2Valid() ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    Generate Links
                    <LinkIcon className="ml-2" size={16} />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Confirmation */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center">
                  <CheckCircle className="text-green-500 mx-auto mb-4" size={48} />
                  <h3 className="text-lg font-medium">Campaign Links Generated!</h3>
                  <p className="text-gray-600">
                    Created {generatedLinks.length} UTM links for your campaign.
                  </p>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => {
                    setStep(1);
                    setCampaignName("");
                    setTargetUrl("");
                    setSelectedSources([]);
                    setContentVariants([]);
                    setGeneratedLinks([]);
                  }}>
                    New Campaign
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Output Side */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <LinkIcon className="text-primary mr-2" size={24} />
              Generated Links
            </CardTitle>
          </CardHeader>
          <CardContent>
            {generatedLinks.length === 0 ? (
              <div className="text-center py-8">
                <LinkIcon className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-500">Generated links will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {generatedLinks.map((link, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="space-y-1">
                        <p className="font-medium">{link.utm_source} - {link.utm_medium}</p>
                        <p className="text-sm text-gray-600">{link.utm_content}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(link.generatedLink)}
                      >
                        Copy
                      </Button>
                    </div>
                    <p className="text-sm bg-gray-50 p-2 rounded break-all">
                      {link.generatedLink}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}