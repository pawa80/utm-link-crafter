import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generateUTMLink, validateUrl } from "@/lib/utm";
import { ArrowRight, ArrowLeft, Target, Settings, Link as LinkIcon, CheckCircle } from "lucide-react";
import type { User, SourceTemplate } from "@shared/schema";

interface CampaignWizardProps {
  user: User;
}

interface SourceSelection {
  sourceName: string;
  mediums: string[];
  enableABTesting: boolean;
  abTestMediums: string[];
}

interface ContentVariant {
  medium: string;
  variant: 'A' | 'B';
  content: string;
}

export default function CampaignWizard({ user }: CampaignWizardProps) {
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [selectedSources, setSelectedSources] = useState<SourceSelection[]>([]);
  const [contentVariants, setContentVariants] = useState<ContentVariant[]>([]);
  const [generatedLinks, setGeneratedLinks] = useState<any[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch source templates
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

  const totalSteps = 3;

  const handleSourceToggle = (sourceName: string, checked: boolean) => {
    if (checked) {
      const template = sourceTemplates.find((t: SourceTemplate) => t.sourceName === sourceName);
      setSelectedSources([...selectedSources, {
        sourceName,
        mediums: [],
        enableABTesting: false,
        abTestMediums: []
      }]);
    } else {
      setSelectedSources(selectedSources.filter(s => s.sourceName !== sourceName));
    }
  };

  const updateSourceMediums = (sourceName: string, mediums: string[]) => {
    setSelectedSources(selectedSources.map(source => 
      source.sourceName === sourceName 
        ? { ...source, mediums }
        : source
    ));
  };

  const updateABTesting = (sourceName: string, enabled: boolean) => {
    setSelectedSources(selectedSources.map(source => 
      source.sourceName === sourceName 
        ? { ...source, enableABTesting: enabled, abTestMediums: enabled ? [] : [] }
        : source
    ));
  };

  const updateABTestMediums = (sourceName: string, mediums: string[]) => {
    setSelectedSources(selectedSources.map(source => 
      source.sourceName === sourceName 
        ? { ...source, abTestMediums: mediums }
        : source
    ));
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
          if (source.enableABTesting && source.abTestMediums.includes(medium)) {
            variants.push({ medium: `${source.sourceName}-${medium}`, variant: 'A', content: '' });
            variants.push({ medium: `${source.sourceName}-${medium}`, variant: 'B', content: '' });
          } else {
            variants.push({ medium: `${source.sourceName}-${medium}`, variant: 'A', content: '' });
          }
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
      
      // Generate custom fields based on user settings
      const customParams: any = {};
      if (user.customField1InUrl && user.customField1Name) {
        customParams.utm_custom1 = variant.variant === 'B' ? 'variant-b' : 'variant-a';
      }

      const utmLink = generateUTMLink({
        targetUrl,
        utm_campaign: campaignName,
        utm_source: sourceName,
        utm_medium: mediumName,
        utm_content: variant.content || `${variant.variant.toLowerCase()}-variant`,
        ...customParams,
      });

      const linkData = {
        targetUrl,
        utm_campaign: campaignName,
        utm_source: sourceName,
        utm_medium: mediumName,
        utm_term: null,
        utm_content: variant.content || `${variant.variant.toLowerCase()}-variant`,
        internalCampaignId: null,
        customField1Value: variant.variant === 'B' ? 'variant-b' : 'variant-a',
        customField2Value: null,
        customField3Value: null,
        generatedLink: utmLink,
      };

      try {
        const result = await createUtmLinkMutation.mutateAsync(linkData);
        links.push({ ...linkData, ...result, generatedLink: utmLink });
      } catch (error) {
        console.error('Failed to create link:', error);
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
                  <div className="space-y-4">
                    {sourceTemplates.map((template: SourceTemplate) => {
                      const isSelected = selectedSources.some(s => s.sourceName === template.sourceName);
                      const sourceConfig = selectedSources.find(s => s.sourceName === template.sourceName);
                      
                      return (
                        <div key={template.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={template.sourceName}
                              checked={isSelected}
                              onCheckedChange={(checked) => handleSourceToggle(template.sourceName, checked as boolean)}
                            />
                            <Label htmlFor={template.sourceName} className="font-medium">
                              {template.sourceName}
                            </Label>
                            <Badge variant="secondary" className="text-xs">
                              {template.mediums?.length || 0} mediums
                            </Badge>
                          </div>

                          {isSelected && (
                            <div className="space-y-3 ml-6">
                              <div>
                                <Label className="text-sm">Select Mediums</Label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {template.mediums?.map((medium) => (
                                    <div key={medium} className="flex items-center space-x-1">
                                      <Checkbox
                                        id={`${template.sourceName}-${medium}`}
                                        checked={sourceConfig?.mediums.includes(medium) || false}
                                        onCheckedChange={(checked) => {
                                          const currentMediums = sourceConfig?.mediums || [];
                                          const newMediums = checked 
                                            ? [...currentMediums, medium]
                                            : currentMediums.filter(m => m !== medium);
                                          updateSourceMediums(template.sourceName, newMediums);
                                        }}
                                      />
                                      <Label htmlFor={`${template.sourceName}-${medium}`} className="text-sm">
                                        {medium}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`${template.sourceName}-ab-test`}
                                  checked={sourceConfig?.enableABTesting || false}
                                  onCheckedChange={(checked) => updateABTesting(template.sourceName, checked as boolean)}
                                />
                                <Label htmlFor={`${template.sourceName}-ab-test`} className="text-sm">
                                  Enable A/B Testing
                                </Label>
                              </div>

                              {sourceConfig?.enableABTesting && (
                                <div>
                                  <Label className="text-sm">A/B Test Mediums</Label>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {sourceConfig.mediums.map((medium) => (
                                      <div key={medium} className="flex items-center space-x-1">
                                        <Checkbox
                                          id={`${template.sourceName}-ab-${medium}`}
                                          checked={sourceConfig.abTestMediums.includes(medium)}
                                          onCheckedChange={(checked) => {
                                            const newAbTestMediums = checked 
                                              ? [...sourceConfig.abTestMediums, medium]
                                              : sourceConfig.abTestMediums.filter(m => m !== medium);
                                            updateABTestMediums(template.sourceName, newAbTestMediums);
                                          }}
                                        />
                                        <Label htmlFor={`${template.sourceName}-ab-${medium}`} className="text-sm text-blue-600">
                                          {medium}
                                        </Label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={nextStep}>
                    Next Step
                    <ArrowRight className="ml-2" size={16} />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Content Definition */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Define Content for Each Medium</h3>
                  <div className="space-y-4">
                    {contentVariants.map((variant, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <Label className="text-sm font-medium mb-2 block">
                          {variant.medium} - Variant {variant.variant}
                        </Label>
                        <Input
                          value={variant.content}
                          onChange={(e) => updateContentVariant(index, e.target.value)}
                          placeholder="Enter content description"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={prevStep}>
                    <ArrowLeft className="mr-2" size={16} />
                    Back
                  </Button>
                  <Button onClick={generateLinks}>
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
            {generatedLinks.length > 0 ? (
              <div className="space-y-4">
                {generatedLinks.map((link, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">
                        {link.utm_source} - {link.utm_medium}
                      </Badge>
                      {link.utm_content && (
                        <Badge variant="secondary" className="text-xs">
                          {link.utm_content}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 break-all">
                      {link.generatedLink}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(link.generatedLink)}
                      className="w-full"
                    >
                      Copy Link
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <LinkIcon size={48} className="mx-auto mb-4 opacity-50" />
                <p>Generated links will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}