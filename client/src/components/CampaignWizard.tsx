import { useState } from "react";
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
import { Plus, Copy } from "lucide-react";
import type { User, SourceTemplate } from "@shared/schema";

interface CampaignWizardProps {
  user: User;
}

interface SourceState {
  checked: boolean;
  selectedMedium: string;
  contentInput: string;
}

export default function CampaignWizard({ user }: CampaignWizardProps) {
  const [campaignName, setCampaignName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [sourceStates, setSourceStates] = useState<{ [sourceName: string]: SourceState }>({});
  const [customSource, setCustomSource] = useState("");

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

  // Get all available sources (predefined + user templates)
  const getAllSources = () => {
    const templateSources = sourceTemplates.map((t: SourceTemplate) => t.sourceName);
    const predefinedSources = ["Facebook", "LinkedIn", "Twitter", "Google Ads", "Sales Event", "Google", "Pinterest", "TikTok", "Pål Erik"];
    const combined = [...predefinedSources, ...templateSources];
    return combined.filter((source, index) => combined.indexOf(source) === index);
  };

  const getAvailableMediums = (sourceName: string) => {
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
        selectedMedium: checked ? (prev[sourceName]?.selectedMedium || "") : "",
        contentInput: checked ? (prev[sourceName]?.contentInput || "") : ""
      }
    }));
  };

  const handleMediumSelect = (sourceName: string, medium: string) => {
    setSourceStates(prev => ({
      ...prev,
      [sourceName]: {
        ...prev[sourceName],
        selectedMedium: medium,
        contentInput: prev[sourceName]?.contentInput || ""
      }
    }));
  };

  const handleContentChange = (sourceName: string, content: string) => {
    setSourceStates(prev => ({
      ...prev,
      [sourceName]: {
        ...prev[sourceName],
        contentInput: content
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
        selectedMedium: "",
        contentInput: ""
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

  const getCheckedSources = () => {
    return Object.entries(sourceStates)
      .filter(([_, state]) => state.checked && state.selectedMedium && state.contentInput.trim())
      .map(([sourceName, state]) => ({
        sourceName,
        medium: state.selectedMedium,
        content: state.contentInput,
        utmLink: generateUTMLink({
          targetUrl,
          utm_campaign: campaignName,
          utm_source: sourceName.toLowerCase(),
          utm_medium: state.selectedMedium,
          utm_content: state.contentInput
        }),
        linkName: `${sourceName} ${state.selectedMedium.charAt(0).toUpperCase() + state.selectedMedium.slice(1)} ${state.contentInput}`
      }));
  };

  const copyAllLinks = (sourceName: string) => {
    const sourceData = sourceStates[sourceName];
    if (sourceData && sourceData.contentInput.trim()) {
      const utmLink = generateUTMLink({
        targetUrl,
        utm_campaign: campaignName,
        utm_source: sourceName.toLowerCase(),
        utm_medium: sourceData.selectedMedium,
        utm_content: sourceData.contentInput
      });
      copyToClipboard(utmLink);
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
            placeholder="Summertime 2025"
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
            placeholder="https://playmops.io/lp1"
            className="mt-1"
          />
        </div>
      </div>

      {/* Sources and Mediums Section */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Select Sources and Mediums *</Label>
        <div className="space-y-3">
          {getAllSources().map((sourceName) => {
            const state = sourceStates[sourceName] || { checked: false, selectedMedium: "", contentInput: "" };
            const availableMediums = getAvailableMediums(sourceName);

            return (
              <div key={sourceName} className="flex items-center space-x-4 p-3 border rounded-lg">
                <div className="w-24">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={state.checked}
                      onCheckedChange={(checked) => handleSourceToggle(sourceName, checked as boolean)}
                    />
                    <span className="text-sm font-medium">{sourceName}</span>
                  </div>
                </div>
                
                <div className="w-32">
                  <Select 
                    value={state.selectedMedium}
                    onValueChange={(medium) => handleMediumSelect(sourceName, medium)}
                    disabled={!state.checked}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMediums.map((medium: string) => (
                        <SelectItem key={medium} value={medium}>
                          {medium}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-20">
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    {state.selectedMedium || "Paid"}
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={!state.checked}
                  onClick={() => {
                    // Add custom medium functionality
                    const newMedium = prompt("Enter custom medium:");
                    if (newMedium) {
                      handleMediumSelect(sourceName, newMedium);
                    }
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>

        {/* Add Custom Source */}
        <div className="flex items-center space-x-2 pt-4 border-t">
          <span className="text-sm font-medium">Add Source</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newSource = prompt("Enter source name:");
              if (newSource) {
                setCustomSource(newSource);
                addCustomSource();
              }
            }}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Generated Content Sections */}
      <div className="space-y-6">
        {getCheckedSources().map(({ sourceName, medium, content, utmLink, linkName }) => {
          const state = sourceStates[sourceName];
          
          return (
            <Card key={`${sourceName}-${medium}`} className="border-l-4 border-l-blue-500">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">{sourceName}</h3>
                <div className="grid grid-cols-4 gap-4 items-end">
                  <div>
                    <Label className="text-sm font-medium">Medium</Label>
                    <Input 
                      value={medium} 
                      readOnly 
                      className="mt-1 bg-gray-50" 
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Content</Label>
                    <Input
                      value={content}
                      onChange={(e) => handleContentChange(sourceName, e.target.value)}
                      placeholder="summertime"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Link name</Label>
                    <Input
                      value={linkName}
                      readOnly
                      className="mt-1 bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">UTM Link</Label>
                    <div className="flex mt-1">
                      <Input
                        value={utmLink}
                        readOnly
                        className="flex-1 bg-gray-50 text-xs"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <Button
                    onClick={() => copyAllLinks(sourceName)}
                    className="w-full"
                    disabled={!content.trim()}
                  >
                    COPY LINKS
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Generate All Links Button - Only show if we have valid combinations */}
      {getCheckedSources().length > 0 && (
        <div className="pt-8 border-t">
          <Button
            onClick={async () => {
              // Save all valid combinations to database
              const validSources = getCheckedSources();
              
              for (const source of validSources) {
                try {
                  await createUtmLinkMutation.mutateAsync({
                    targetUrl,
                    campaignName,
                    source: source.sourceName,
                    medium: source.medium,
                    content: source.content,
                    utmLink: source.utmLink,
                    linkName: source.linkName
                  });
                } catch (error) {
                  console.error("Failed to save link:", error);
                }
              }
              
              toast({
                title: "Success",
                description: `Generated ${validSources.length} UTM links`,
              });
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!campaignName.trim() || !targetUrl.trim() || getCheckedSources().length === 0}
          >
            Generate All Links ({getCheckedSources().length})
          </Button>
        </div>
      )}
    </div>
  );
}