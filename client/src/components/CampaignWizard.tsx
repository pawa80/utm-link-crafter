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
  landingPageSelections: { [rowKey: string]: string }; // rowKey (source-medium-variantId) -> landing page ID
  rows?: Array<{ id: string; medium: string; content: string; landingPageId: string }>;
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
  const [customSourceInput, setCustomSourceInput] = useState("");
  const [showCustomSourceInput, setShowCustomSourceInput] = useState(false);
  
  // Section collapse states
  const [expandedSections, setExpandedSections] = useState({
    campaign: true,
    tags: editMode,
    sources: editMode,
    mediums: editMode,
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
    setLandingPages(prev => [...prev, { id: newId, url: "", label: "" }]); // Keep label for backward compatibility
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
    setLandingPages(prev => {
      const updated = prev.map(lp => 
        lp.id === id ? { ...lp, [field]: value } : lp
      );
      
      // Check for duplicate URLs when updating URL field
      if (field === 'url' && value.trim()) {
        const duplicateCount = updated.filter(lp => lp.url.trim().toLowerCase() === value.trim().toLowerCase()).length;
        if (duplicateCount > 1) {
          toast({
            title: "Duplicate URL",
            description: "This URL is already used by another landing page. Please use a unique URL for each landing page.",
            variant: "destructive",
          });
        }
      }
      
      return updated;
    });
  };

  const validateSection = (section: string): boolean => {
    switch (section) {
      case 'campaign':
        // Either old single URL or new multiple landing pages should be valid
        const hasValidSingleUrl = targetUrl.trim() !== '' && validateUrl(targetUrl);
        const hasValidLandingPages = landingPages.length > 0 && 
          landingPages.every(lp => lp.url.trim() !== '' && lp.label.trim() !== '' && validateUrl(lp.url));
        
        // Check for duplicate URLs in landing pages
        const urls = landingPages.map(lp => lp.url.trim().toLowerCase()).filter(url => url);
        const hasDuplicateUrls = urls.length !== new Set(urls).size;
        
        return campaignName.trim() !== '' && (hasValidSingleUrl || hasValidLandingPages) && !hasDuplicateUrls;
      case 'sources':
        // Only check if sources are selected
        return Object.entries(sourceStates)
          .some(([, state]) => state.checked);
      case 'mediums':
        // Check if sources have mediums selected
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
            if (invalidPage) {
              errorMessage = 'All landing pages must have valid URLs and labels';
            } else {
              // Check for duplicate URLs
              const urls = landingPages.map(lp => lp.url.trim().toLowerCase()).filter(url => url);
              const hasDuplicateUrls = urls.length !== new Set(urls).size;
              if (hasDuplicateUrls) {
                errorMessage = 'Each landing page must have a unique URL';
              }
            }
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

  // Helper function to generate sorted table rows
  const getSortedTableRows = (sourceName: string, state: any) => {
    // Collect all rows with their landing page order for sorting
    const allRows = state.selectedMediums.flatMap((medium: string) => {
      const variants = getContentVariantsForMedium(sourceName, medium);
      return variants.map((variant: any) => {
        // Get selected landing page for this specific row (unique by source-medium-variantId)
        const rowKey = `${sourceName}-${medium}-${variant.id}`;
        const selectedLandingPageId = state.landingPageSelections[rowKey];
        console.log(`Looking for landing page selection with key: ${rowKey}, found: ${selectedLandingPageId}`);
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
        
        // Get landing page order for sorting (999 for no selection to sort last)
        const landingPageOrder = selectedLandingPage ? 
          landingPages.findIndex(lp => lp.id === selectedLandingPage.id) : 999;
        
        return {
          key: `${variant.id}-${medium}`,
          medium,
          variant,
          selectedLandingPageId,
          selectedLandingPage,
          urlToUse,
          linkName,
          utmLink,
          landingPageOrder
        };
      });
    });
    
    // Sort by landing page order, then by medium, then by variant content
    return allRows.sort((a: any, b: any) => {
      if (a.landingPageOrder !== b.landingPageOrder) {
        return a.landingPageOrder - b.landingPageOrder;
      }
      if (a.medium !== b.medium) {
        return a.medium.localeCompare(b.medium);
      }
      return a.variant.content.localeCompare(b.variant.content);
    });
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

  const handleAddCustomSource = () => {
    const sourceName = customSourceInput.trim();
    if (!sourceName) return;
    
    // Check if source already exists
    const existingSource = sourceTemplates.find((template: SourceTemplate) => 
      template.sourceName.toLowerCase() === sourceName.toLowerCase()
    );
    
    if (existingSource) {
      toast({
        title: "Source already exists",
        description: `A source named "${sourceName}" already exists.`,
        variant: "destructive"
      });
      return;
    }
    
    // Create new source template
    createSourceTemplateMutation.mutate({
      userId: user.id,
      sourceName,
      mediums: ["organic", "paid"],
      isArchived: false
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/source-templates"] });
        setCustomSourceInput('');
        setShowCustomSourceInput(false);
        toast({
          title: "Source added",
          description: `Source "${sourceName}" has been added to your templates.`
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to add new source.",
          variant: "destructive"
        });
      }
    });
  };

  // Initialize form with existing campaign data when in edit mode
  useEffect(() => {
    if (editMode && existingCampaignData.length > 0 && sourceTemplates.length > 0) {
      console.log('Initializing edit mode with data:', existingCampaignData);
      console.log('Existing landing pages:', existingLandingPages);
      console.log('Source templates:', sourceTemplates);
      
      const firstLink = existingCampaignData[0];
      setCampaignName(firstLink.utm_campaign);
      
      // Check if campaign uses single URL or multiple landing pages
      const hasSingleUrl = firstLink.targetUrl && firstLink.targetUrl.trim() !== '';
      if (hasSingleUrl) {
        setTargetUrl(firstLink.targetUrl);
      } else {
        // Campaign likely uses multiple landing pages, but if no landing pages are found,
        // we'll try to reconstruct the base URL from the UTM link
        if (firstLink.fullUtmLink) {
          try {
            const url = new URL(firstLink.fullUtmLink);
            // Remove all UTM parameters to get the base URL
            const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
            setTargetUrl(baseUrl);
          } catch (error) {
            console.warn('Could not parse UTM link:', firstLink.fullUtmLink);
            setTargetUrl('');
          }
        } else {
          setTargetUrl('');
        }
      }
      
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
      
      // Initialize landing pages if they exist and map selections BEFORE setting source states
      if (existingLandingPages.length > 0) {
        const formattedLandingPages = existingLandingPages.map(lp => ({
          id: lp.id.toString(),
          url: lp.url,
          label: lp.label
        }));
        setLandingPages(formattedLandingPages);
        
        // Map landing page selections based on existing UTM link target URLs
        // We need to match each individual link to its landing page, not just by medium
        existingCampaignData.forEach((link, linkIndex) => {
          const sourceTemplate = sourceTemplates.find((template: SourceTemplate) => 
            template.sourceName.toLowerCase() === link.utm_source.toLowerCase()
          );
          const sourceName = sourceTemplate ? sourceTemplate.sourceName : link.utm_source;
          const medium = link.utm_medium;
          
          // Find the matching landing page by URL with robust matching
          const normalizeUrl = (url: string) => {
            // Remove protocol inconsistencies and normalize
            return url.replace(/^https?:\/\/?/i, '').replace(/\/$/, '').toLowerCase();
          };
          
          const normalizedTargetUrl = normalizeUrl(link.targetUrl);
          const matchingLandingPage = formattedLandingPages.find(lp => 
            normalizeUrl(lp.url) === normalizedTargetUrl
          );
          
          if (matchingLandingPage && newSourceStates[sourceName]) {
            // Create unique row key using source-medium and variant ID for consistency with getSortedTableRows
            const key = `${sourceName}-${medium}`;
            const linksForThisMedium = existingCampaignData.filter(l => {
              const lSourceTemplate = sourceTemplates.find((template: SourceTemplate) => 
                template.sourceName.toLowerCase() === l.utm_source.toLowerCase()
              );
              const lSourceName = lSourceTemplate ? lSourceTemplate.sourceName : l.utm_source;
              return lSourceName === sourceName && l.utm_medium === medium;
            });
            const variantIndex = linksForThisMedium.findIndex(l => l.id === link.id);
            const variantId = `${key}-${variantIndex}`;
            const rowKey = `${sourceName}-${medium}-${variantId}`;
            
            newSourceStates[sourceName].landingPageSelections[rowKey] = matchingLandingPage.id;
            console.log(`SET: rowKey=${rowKey} -> landingPageId=${matchingLandingPage.id} for ${sourceName}-${medium}`);
            console.log(`  Target URL: ${link.targetUrl} -> ${normalizedTargetUrl}`);
            console.log(`  Landing URL: ${matchingLandingPage.url} -> ${normalizeUrl(matchingLandingPage.url)}`);
          } else {
            console.log(`No matching landing page found for ${sourceName}-${medium}`);
            console.log(`  Target URL: ${link.targetUrl} -> ${normalizedTargetUrl}`);
            console.log(`  Available landing pages:`, formattedLandingPages.map(lp => 
              `${lp.label}: ${lp.url} -> ${normalizeUrl(lp.url)}`
            ));
          }
        });
      }
      
      console.log('Final newSourceStates with landing page selections:', newSourceStates);
      
      setSourceStates(newSourceStates);
      setContentVariants(newContentVariants);
      
      // Expand all sections when in edit mode
      setExpandedSections({
        campaign: true,
        tags: true,
        sources: true,
        mediums: true,
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
              {/* Campaign Name and Tags - Desktop: same row, Mobile: stacked */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
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
                  <Label className="text-sm font-medium">Tags</Label>
                  <div className="mt-1 space-y-3">
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
                </div>
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
                      You can use a single URL here, or add multiple URLs below for more control.
                    </p>
                  </div>
                )}
                
                {/* Multiple landing pages interface */}
                {landingPages.length > 0 && (
                  <div className="space-y-3">
                    {landingPages.map((landingPage) => (
                      <div key={landingPage.id} className="flex items-center gap-3">
                        <div className="flex-1">
                          <Input
                            value={landingPage.url}
                            onChange={(e) => updateLandingPage(landingPage.id, 'url', e.target.value)}
                            placeholder="https://example.com/page"
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={() => removeLandingPage(landingPage.id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X size={16} />
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
                  onClick={() => handleNext('campaign', 'sources')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Section 2: Sources */}
      <Card>
        <SectionHeader 
          title="Sources" 
          sectionKey="sources"
        />
        {expandedSections.sources && (
          <div className="p-6">
            <div className="text-sm text-gray-600 mb-4">
              Select sources for your campaign.
            </div>
            <div className="flex flex-wrap gap-2">
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
                    <Button
                      key={template.id}
                      variant={state.checked ? "default" : "outline"}
                      size="sm"
                      className={state.checked ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
                      onClick={() => {
                        const newChecked = !state.checked;
                        setSourceStates(prev => ({
                          ...prev,
                          [template.sourceName]: {
                            ...state,
                            checked: newChecked,
                            selectedMediums: newChecked ? [""] : [] // Start with one empty medium slot
                          }
                        }));
                        
                        // Initialize content variant for the empty medium
                        if (newChecked) {
                          const variantKey = getVariantKey(template.sourceName, "");
                          setContentVariants(prev => ({
                            ...prev,
                            [variantKey]: [{ id: `${variantKey}-0`, content: '' }]
                          }));
                        }
                      }}
                    >
                      {template.sourceName}
                    </Button>
                  );
                })}
              
              {/* Add Source Button */}
              {showCustomSourceInput ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={customSourceInput}
                    onChange={(e) => setCustomSourceInput(e.target.value)}
                    placeholder="New source name..."
                    className="w-32"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddCustomSource();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleAddCustomSource}
                  >
                    Add
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowCustomSourceInput(false);
                      setCustomSourceInput('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCustomSourceInput(true)}
                >
                  + Add Source
                </Button>
              )}
            </div>
            
            {/* Next Button */}
            {!editMode && (
              <div className="flex justify-end pt-4 border-t mt-6">
                <Button
                  onClick={() => handleNext('sources', 'output')}
                  disabled={!validateSection('sources')}
                  className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300"
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
                            {landingPages.length > 0 && (
                              <th className="text-left p-3 text-sm font-medium text-gray-700 w-40">Landing Page</th>
                            )}
                            <th className="text-left p-3 text-sm font-medium text-gray-700 w-24">Medium</th>
                            <th className="text-left p-3 text-sm font-medium text-gray-700 w-40">Content</th>
                            <th className="text-left p-3 text-sm font-medium text-gray-700 w-60">Link name</th>
                            <th className="text-left p-3 text-sm font-medium text-gray-700">UTM Link</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getSortedTableRows(sourceName, state).map((row) => (
                            <tr key={row.key} className="border-b last:border-b-0 hover:bg-gray-50">
                              {landingPages.length > 0 && (
                                <td className="p-3">
                                  <Select
                                    value={row.selectedLandingPageId || ""}
                                    onValueChange={(value) => {
                                      const rowKey = `${sourceName}-${row.medium}-${row.variant.id}`;
                                      setSourceStates(prev => ({
                                        ...prev,
                                        [sourceName]: {
                                          ...prev[sourceName],
                                          landingPageSelections: {
                                            ...prev[sourceName].landingPageSelections,
                                            [rowKey]: value
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
                                          {lp.url}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                              )}
                              <td className="p-3">
                                <Select
                                  value={row.medium}
                                  onValueChange={(value) => {
                                    // Simply update the medium in the selectedMediums array at the correct index
                                    const currentMediums = sourceStates[sourceName].selectedMediums;
                                    const mediumIndex = currentMediums.findIndex(m => m === row.medium);
                                    
                                    if (mediumIndex !== -1) {
                                      const newMediums = [...currentMediums];
                                      newMediums[mediumIndex] = value;
                                      
                                      setSourceStates(prev => ({
                                        ...prev,
                                        [sourceName]: {
                                          ...prev[sourceName],
                                          selectedMediums: newMediums
                                        }
                                      }));
                                      
                                      // Update content variant with new medium
                                      const oldKey = getVariantKey(sourceName, row.medium);
                                      const newKey = getVariantKey(sourceName, value);
                                      
                                      setContentVariants(prev => {
                                        const currentVariant = prev[oldKey]?.find(v => v.id === row.variant.id);
                                        if (currentVariant) {
                                          // Keep existing variants for the new medium key
                                          const existingVariants = prev[newKey] || [];
                                          const newVariantId = `${newKey}-${existingVariants.length}`;
                                          const newVariant = { ...currentVariant, id: newVariantId };
                                          
                                          // Remove the old variant
                                          const updatedOldVariants = prev[oldKey]?.filter(v => v.id !== row.variant.id) || [];
                                          
                                          return {
                                            ...prev,
                                            [oldKey]: updatedOldVariants,
                                            [newKey]: [...existingVariants, newVariant]
                                          };
                                        }
                                        return prev;
                                      });
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-full h-8 text-xs">
                                    <SelectValue placeholder="Choose medium" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {sourceTemplates
                                      .find((template: SourceTemplate) => template.sourceName === sourceName)
                                      ?.mediums?.map((medium: string) => (
                                        <SelectItem key={medium} value={medium}>
                                          {medium}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={row.variant.content}
                                    onChange={(e) => updateContentVariant(sourceName, row.medium, row.variant.id, e.target.value)}
                                    placeholder="Content..."
                                    className="text-sm flex-1"
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addContentVariant(sourceName, row.medium, row.variant.id)}
                                    className="flex-shrink-0"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="text-sm text-gray-600">{row.linkName}</div>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div className="text-xs font-mono text-gray-500 break-all flex-1">
                                    {row.utmLink}
                                  </div>
                                  {row.utmLink && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(row.utmLink);
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
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                      {getSortedTableRows(sourceName, state).map((row: any) => (
                        <div key={row.key} className="bg-white border rounded-lg p-4 space-y-3">
                          {landingPages.length > 0 && (
                            <div>
                              <Label className="text-xs text-gray-600 mb-1 block">Landing Page</Label>
                              <Select
                                value={row.selectedLandingPageId || ""}
                                onValueChange={(value) => {
                                  const rowKey = `${sourceName}-${row.medium}-${row.variant.id}`;
                                  setSourceStates(prev => ({
                                    ...prev,
                                    [sourceName]: {
                                      ...prev[sourceName],
                                      landingPageSelections: {
                                        ...prev[sourceName].landingPageSelections,
                                        [rowKey]: value
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
                                      {lp.url}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          
                          <div>
                            <Label className="text-xs text-gray-600 mb-1 block">Medium</Label>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded">
                                {row.medium}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addContentVariant(sourceName, row.medium, row.variant.id)}
                                className="flex-shrink-0"
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          
                          <div>
                            <Label className="text-xs text-gray-600 mb-1 block">Content</Label>
                            <Input
                              value={row.variant.content}
                              onChange={(e) => updateContentVariant(sourceName, row.medium, row.variant.id, e.target.value)}
                              placeholder="Content..."
                              className="text-sm"
                            />
                          </div>
                          
                          <div>
                            <Label className="text-xs text-gray-600 mb-1 block">Link Name</Label>
                            <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                              {row.linkName}
                            </div>
                          </div>
                          
                          {row.utmLink && (
                            <div>
                              <Label className="text-xs text-gray-600 mb-1 block">UTM Link</Label>
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-mono text-gray-500 bg-gray-50 p-2 rounded flex-1 break-all">
                                  {row.utmLink}
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(row.utmLink);
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
                      ))}
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
                      
                      // First, save landing pages if any exist
                      if (landingPages.length > 0) {
                        try {
                          // Delete existing landing pages for this campaign
                          await apiRequest("DELETE", `/api/campaign-landing-pages/${campaignName}`);
                          
                          // Save new landing pages
                          for (const landingPage of landingPages) {
                            if (landingPage.url.trim()) {
                              await apiRequest("POST", "/api/campaign-landing-pages", {
                                campaignName,
                                url: landingPage.url,
                                label: landingPage.url // Use URL as label for simplicity
                              });
                            }
                          }
                        } catch (error) {
                          console.error("Failed to save landing pages:", error);
                        }
                      }
                      
                      // Save all valid combinations to database
                      const validSources = getCheckedSourcesWithContent();
                      
                      let successCount = 0;
                      
                      for (const source of validSources) {
                        try {
                          // Get the actual target URL used for this specific link
                          const actualTargetUrl = source.utmLink ? 
                            (() => {
                              try {
                                const url = new URL(source.utmLink);
                                return url.origin + url.pathname;
                              } catch {
                                return targetUrl || '';
                              }
                            })() : 
                            (targetUrl || '');
                          
                          await createUtmLinkMutation.mutateAsync({
                            userId: user.id,
                            targetUrl: actualTargetUrl,
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
                        // Invalidate specific cache to refresh campaign data
                        await queryClient.invalidateQueries({ queryKey: ["/api/utm-links"] });
                        
                        toast({
                          title: "Success",
                          description: editMode 
                            ? `Updated ${successCount} UTM links successfully`
                            : `Generated ${successCount} UTM links successfully`,
                        });
                        
                        // Navigate after cache invalidation
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