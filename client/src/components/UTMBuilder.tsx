import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generateUTMLink, validateUrl, getContentSuggestions } from "@/lib/utm";
import { PlusCircle, Plus, Trash2, Lightbulb } from "lucide-react";
import type { User } from "@shared/schema";

interface UTMBuilderProps {
  user: User;
}

interface ContentVariant {
  id: string;
  value: string;
}

export default function UTMBuilder({ user }: UTMBuilderProps) {
  const [targetUrl, setTargetUrl] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [campaignSource, setCampaignSource] = useState("");
  const [campaignMedium, setCampaignMedium] = useState("");
  const [campaignTerm, setCampaignTerm] = useState("");
  const [campaignCategory, setCampaignCategory] = useState("");
  const [internalCampaignId, setInternalCampaignId] = useState("");
  const [contentVariants, setContentVariants] = useState<ContentVariant[]>([
    { id: "1", value: "" }
  ]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createUtmLinkMutation = useMutation({
    mutationFn: async (linkData: any) => {
      const response = await apiRequest("POST", "/api/utm-links", linkData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/utm-links"] });
      toast({
        title: "Success",
        description: "UTM links generated successfully!",
      });
      // Reset form
      setTargetUrl("");
      setCampaignName("");
      setCampaignSource("");
      setCampaignMedium("");
      setCampaignTerm("");
      setCampaignCategory("");
      setInternalCampaignId("");
      setContentVariants([{ id: "1", value: "" }]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addContentVariant = () => {
    const newId = Date.now().toString();
    setContentVariants([...contentVariants, { id: newId, value: "" }]);
  };

  const removeContentVariant = (id: string) => {
    if (contentVariants.length > 1) {
      setContentVariants(contentVariants.filter(variant => variant.id !== id));
    }
  };

  const updateContentVariant = (id: string, value: string) => {
    setContentVariants(contentVariants.map(variant => 
      variant.id === id ? { ...variant, value } : variant
    ));
  };

  const handleSuggestionClick = (suggestion: string) => {
    // Add suggestion to first empty content variant or create new one
    const emptyVariant = contentVariants.find(v => !v.value);
    if (emptyVariant) {
      updateContentVariant(emptyVariant.id, suggestion);
    } else {
      const newId = Date.now().toString();
      setContentVariants([...contentVariants, { id: newId, value: suggestion }]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateUrl(targetUrl)) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid target URL",
        variant: "destructive",
      });
      return;
    }

    // Generate links for each content variant
    const validVariants = contentVariants.filter(variant => variant.value.trim());
    
    if (validVariants.length === 0) {
      // Create one link without content
      const utmLink = generateUTMLink({
        targetUrl,
        utm_campaign: campaignName,
        utm_source: campaignSource,
        utm_medium: campaignMedium,
        utm_term: campaignTerm || undefined,
      });

      createUtmLinkMutation.mutate({
        targetUrl,
        utm_campaign: campaignName,
        utm_source: campaignSource,
        utm_medium: campaignMedium,
        utm_term: campaignTerm || null,
        utm_content: null,
        fullUtmLink: utmLink,
        category: campaignCategory || null,
        internalCampaignId: internalCampaignId || null,
      });
    } else {
      // Create multiple links for each content variant
      for (const variant of validVariants) {
        const utmLink = generateUTMLink({
          targetUrl,
          utm_campaign: campaignName,
          utm_source: campaignSource,
          utm_medium: campaignMedium,
          utm_content: variant.value,
          utm_term: campaignTerm || undefined,
        });

        createUtmLinkMutation.mutate({
          targetUrl,
          utm_campaign: campaignName,
          utm_source: campaignSource,
          utm_medium: campaignMedium,
          utm_term: campaignTerm || null,
          utm_content: variant.value,
          fullUtmLink: utmLink,
          category: campaignCategory || null,
          internalCampaignId: internalCampaignId || null,
        });
      }
    }
  };

  const suggestions = campaignSource && campaignMedium 
    ? getContentSuggestions(campaignSource, campaignMedium)
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <PlusCircle className="text-primary mr-2" size={20} />
          Build UTM Links
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Target URL */}
          <div>
            <Label htmlFor="target-url">
              Target URL <span className="text-red-500">*</span>
            </Label>
            <Input
              id="target-url"
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com/landing-page"
              required
            />
          </div>

          {/* Campaign Name */}
          <div>
            <Label htmlFor="campaign-name">
              Campaign Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="campaign-name"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="spring-sale-2024"
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Campaign Source */}
            <div>
              <Label htmlFor="campaign-source">
                Source <span className="text-red-500">*</span>
              </Label>
              <Select value={campaignSource} onValueChange={setCampaignSource} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select source..." />
                </SelectTrigger>
                <SelectContent>
                  {user.defaultSources?.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Campaign Medium */}
            <div>
              <Label htmlFor="campaign-medium">
                Medium <span className="text-red-500">*</span>
              </Label>
              <Select value={campaignMedium} onValueChange={setCampaignMedium} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select medium..." />
                </SelectTrigger>
                <SelectContent>
                  {user.defaultMediums?.map((medium) => (
                    <SelectItem key={medium} value={medium}>
                      {medium}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Campaign Content Variants */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Campaign Content</Label>
              <Button
                type="button"
                variant="ghost"
                onClick={addContentVariant}
                className="text-primary hover:text-primary/80"
              >
                <Plus className="mr-1" size={16} />
                Add Variant
              </Button>
            </div>
            
            <div className="space-y-3">
              {contentVariants.map((variant) => (
                <div key={variant.id} className="flex items-center space-x-2">
                  <Input
                    value={variant.value}
                    onChange={(e) => updateContentVariant(variant.id, e.target.value)}
                    placeholder="banner-300x250"
                    className="flex-1"
                  />
                  {contentVariants.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeContentVariant(variant.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            
            {/* Smart Suggestions */}
            {suggestions.length > 0 && (
              <div className="mt-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                <p className="text-sm text-blue-800 mb-2 flex items-center">
                  <Lightbulb className="mr-1" size={16} />
                  Suggestions for {campaignSource} + {campaignMedium}:
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <Badge
                      key={suggestion}
                      variant="outline"
                      className="cursor-pointer hover:bg-blue-100 transition-colors"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Campaign Term */}
            <div>
              <Label htmlFor="campaign-term">
                Campaign Term <span className="text-xs text-gray-500">(optional)</span>
              </Label>
              <Input
                id="campaign-term"
                value={campaignTerm}
                onChange={(e) => setCampaignTerm(e.target.value)}
                placeholder="paid keywords"
              />
            </div>

            {/* Internal Campaign ID */}
            <div>
              <Label htmlFor="internal-campaign-id">
                Internal Campaign ID <span className="text-xs text-gray-500">(optional)</span>
              </Label>
              <Input
                id="internal-campaign-id"
                value={internalCampaignId}
                onChange={(e) => setInternalCampaignId(e.target.value)}
                placeholder="CAMP-2024-001"
              />
              <p className="text-xs text-gray-500 mt-1">For internal tracking and organization</p>
            </div>
          </div>

          {/* Category - Full Width */}
          <div>
            <Label htmlFor="campaign-category">
              Category <span className="text-xs text-gray-500">(optional)</span>
            </Label>
            <Select value={campaignCategory} onValueChange={setCampaignCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {user.categories?.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={createUtmLinkMutation.isPending}
          >
            {createUtmLinkMutation.isPending ? "Generating..." : "Generate UTM Link(s)"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
