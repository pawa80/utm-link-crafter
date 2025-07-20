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
import { Plus, Copy, X, ChevronUp, ChevronDown } from "lucide-react";
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
  const [originalCampaignName, setOriginalCampaignName] = useState(""); // Track original name for edit mode
  const [targetUrl, setTargetUrl] = useState(""); // Keep for backward compatibility
  const [landingPages, setLandingPages] = useState<Array<{ id: string; url: string; label: string }>>([]);
  const [sourceStates, setSourceStates] = useState<{ [sourceName: string]: SourceState }>({});
  const [contentVariants, setContentVariants] = useState<{ [key: string]: Array<{ id: string; content: string }> }>({});
  const [customSource, setCustomSource] = useState("");
  const [showAddSource, setShowAddSource] = useState(false);
  const [customMediumInputs, setCustomMediumInputs] = useState<{ [sourceName: string]: { value: string; addToLibrary: boolean; show: boolean } }>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [sortConfig, setSortConfig] = useState<{ [sourceName: string]: { column: string; direction: 'asc' | 'desc' } }>({});
  const [showCustomTagInput, setShowCustomTagInput] = useState(false);
  const [customSourceInput, setCustomSourceInput] = useState("");
  const [showCustomSourceInput, setShowCustomSourceInput] = useState(false);
  const [showCustomMediumInput, setShowCustomMediumInput] = useState<{ [sourceName: string]: boolean }>({});
  const [customMediumInput, setCustomMediumInput] = useState<{ [sourceName: string]: string }>({});
  
  // All sections are now always visible

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // All sections are now always visible - no toggle functionality needed

  // Landing page management functions
  const addLandingPage = () => {
    // If this is the first landing page and we have a single URL, convert it to the first landing page AND add a new empty one
    if (landingPages.length === 0 && targetUrl.trim()) {
      const firstId = `lp-${Date.now()}`;
      const secondId = `lp-${Date.now() + 1}`;
      setLandingPages([
        { id: firstId, url: targetUrl.trim(), label: targetUrl.trim() },
        { id: secondId, url: "", label: "" }
      ]);
      setTargetUrl(""); // Clear the single URL field
    } else {
      // Add a new empty landing page
      const newId = `lp-${Date.now()}`;
      setLandingPages(prev => [...prev, { id: newId, url: "", label: "" }]);
    }
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

  // Section validation removed - now handled at save time only

  // NEXT button functionality removed - all sections always visible

  const { data: sourceTemplates = [] } = useQuery({
    queryKey: ["/api/source-templates"],
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["/api/tags"],
  });

  // Fetch unique URLs for autocomplete
  const { data: uniqueUrls = [] } = useQuery({
    queryKey: ["/api/unique-urls"],
  });

  // Function to fetch UTM content suggestions for source and medium
  const fetchUtmContentSuggestions = async (source: string, medium: string): Promise<string[]> => {
    try {
      const response = await apiRequest(`/api/utm-content/${encodeURIComponent(source)}/${encodeURIComponent(medium)}`, { method: "GET" });
      if (!response.ok) {
        console.error('Error fetching UTM content suggestions:', response.status);
        return [];
      }
      return response.json();
    } catch (error) {
      console.error('Error fetching UTM content suggestions:', error);
      return [];
    }
  };

  // Rest of the existing mutations and functions...
  const createUtmLinkMutation = useMutation({
    mutationFn: async (linkData: any) => {
      const response = await apiRequest("/api/utm-links", { method: "POST", body: JSON.stringify(linkData) });
      return response.json();
    },
  });

  const deleteCampaignLinksMutation = useMutation({
    mutationFn: async (campaignName: string) => {
      const response = await apiRequest(`/api/utm-links/campaign/${encodeURIComponent(campaignName)}`, { method: "DELETE" });
      return response.json();
    },
  });

  const createSourceTemplateMutation = useMutation({
    mutationFn: async (templateData: any) => {
      const response = await apiRequest("/api/source-templates", { method: "POST", body: JSON.stringify(templateData) });
      return response.json();
    },
  });

  const updateSourceTemplateMutation = useMutation({
    mutationFn: async ({ templateId, updates }: { templateId: number; updates: any }) => {
      const response = await apiRequest(`/api/source-templates/${templateId}`, { method: "PATCH", body: JSON.stringify(updates) });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/source-templates"] });
    },
  });

  const createTagMutation = useMutation({
    mutationFn: async (tagData: any) => {
      const response = await apiRequest("/api/tags", { method: "POST", body: JSON.stringify(tagData) });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
    },
  });

  // Add Medium function
  const handleAddMedium = async (sourceName: string, templateId?: number) => {
    const newMedium = customMediumInput[sourceName]?.trim();
    if (!newMedium || !templateId) return;

    try {
      const template = sourceTemplates.find((t: SourceTemplate) => t.id === templateId);
      if (!template) return;

      const updatedMediums = [...(template.mediums || []), newMedium];
      
      await updateSourceTemplateMutation.mutateAsync({
        templateId,
        updates: { mediums: updatedMediums }
      });

      // Clear the input and hide the form
      setCustomMediumInput(prev => ({ ...prev, [sourceName]: '' }));
      setShowCustomMediumInput(prev => ({ ...prev, [sourceName]: false }));

      toast({
        title: "Success",
        description: "Medium added successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add medium",
        variant: "destructive",
      });
    }
  };

  // Helper functions for content variants
  const getVariantKey = (sourceName: string, medium: string) => `${sourceName}-${medium}`;
  
  const getContentVariantsForMedium = (sourceName: string, medium: string) => {
    const key = getVariantKey(sourceName, medium);
    const variants = contentVariants[key] || [{ id: `${key}-0`, content: '' }];
    
    if (editMode) {
      console.log(`getContentVariantsForMedium(${sourceName}, ${medium}): key=${key}, found ${variants.length} variants:`, variants.map(v => v.id));
    }
    
    return variants;
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

  const removeContentVariant = (sourceName: string, medium: string, variantId: string) => {
    const key = getVariantKey(sourceName, medium);
    const variants = contentVariants[key] || [];
    
    // Don't allow removing the last variant - always keep at least one
    if (variants.length <= 1) {
      toast({
        title: "Cannot remove",
        description: "You must have at least one content variant per medium.",
        variant: "destructive"
      });
      return;
    }
    
    // Remove the variant
    const newVariants = variants.filter(v => v.id !== variantId);
    
    // Update content variants
    setContentVariants(prev => ({
      ...prev,
      [key]: newVariants
    }));
    
    // Remove any landing page selection for this variant
    const rowKey = `${sourceName}-${medium}-${variantId}`;
    setSourceStates(prev => ({
      ...prev,
      [sourceName]: {
        ...prev[sourceName],
        landingPageSelections: (() => {
          const { [rowKey]: removedKey, ...rest } = prev[sourceName]?.landingPageSelections || {};
          return rest;
        })()
      }
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
              // Get selected landing page for this specific row using the correct rowKey
              const rowKey = `${sourceName}-${medium}-${variant.id}`;
              const selectedLandingPageId = state.landingPageSelections[rowKey];
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
  const getSortedTableRows = (sourceName: string, state: SourceState) => {
    // Collect all rows with their landing page order for sorting
    const allRows = state.selectedMediums.flatMap((medium: string) => {
      const variants = getContentVariantsForMedium(sourceName, medium);
      return variants.map((variant: any) => {
        // Get selected landing page for this specific row (unique by source-medium-variantId)
        const rowKey = `${sourceName}-${medium}-${variant.id}`;
        let selectedLandingPageId = state.landingPageSelections[rowKey];
        
        // FALLBACK: In edit mode, if we can't find by rowKey, try to find by content match
        if (editMode && !selectedLandingPageId && existingCampaignData) {
          const matchingLink = existingCampaignData.find(link => {
            const sourceTemplate = sourceTemplates.find((template: SourceTemplate) => 
              template.sourceName.toLowerCase() === link.utm_source.toLowerCase()
            );
            const linkSourceName = sourceTemplate ? sourceTemplate.sourceName : link.utm_source;
            return linkSourceName === sourceName && 
                   link.utm_medium === medium && 
                   (link.utm_content || '') === variant.content;
          });
          
          if (matchingLink) {
            // Find landing page that matches this link's target URL
            const normalizeUrl = (url: string) => url.replace(/^https?:\/\/?/i, '').replace(/\/$/, '').toLowerCase();
            const normalizedTargetUrl = normalizeUrl(matchingLink.targetUrl);
            const matchingLandingPage = landingPages.find(lp => 
              normalizeUrl(lp.url) === normalizedTargetUrl
            );
            
            if (matchingLandingPage) {
              selectedLandingPageId = matchingLandingPage.id;
              console.log(`FALLBACK: Found landing page ${matchingLandingPage.id} for content="${variant.content}"`);
            }
          }
        }
        
        // Debug logging
        if (editMode) {
          console.log(`RENDER: Looking for rowKey=${rowKey}, found=${selectedLandingPageId ? 'YES' : 'NO'}`);
          console.log(`Available selections:`, Object.keys(state.landingPageSelections));
          console.log(`Current contentVariants for ${sourceName}-${medium}:`, contentVariants[`${sourceName}-${medium}`]?.map(v => v.id));
        }

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
    
    // Apply column sorting if it exists for this source
    const sortState = sortConfig[sourceName];
    if (sortState) {
      return allRows.sort((a: any, b: any) => {
        let aValue: string, bValue: string;
        
        switch (sortState.column) {
          case 'landingPage':
            aValue = a.selectedLandingPage?.url || '';
            bValue = b.selectedLandingPage?.url || '';
            break;
          case 'medium':
            aValue = a.medium;
            bValue = b.medium;
            break;
          case 'content':
            aValue = a.variant.content;
            bValue = b.variant.content;
            break;
          default:
            aValue = '';
            bValue = '';
        }
        
        const result = aValue.localeCompare(bValue);
        return sortState.direction === 'asc' ? result : -result;
      });
    }
    
    // No default sorting - return rows in their natural order
    // Only sort when user explicitly clicks column headers
    return allRows;
  };

  // Column sorting handlers
  const handleColumnSort = (sourceName: string, column: string) => {
    setSortConfig(prev => {
      const currentSort = prev[sourceName];
      const direction = currentSort?.column === column && currentSort.direction === 'asc' ? 'desc' : 'asc';
      
      return {
        ...prev,
        [sourceName]: { column, direction }
      };
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
      setOriginalCampaignName(firstLink.utm_campaign); // Track original name for proper deletion
      
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
          id: `${key}-${index}`, // Keep simple, consistent indexing
          content: link.utm_content || ''
        }));
        newContentVariants[key] = variants;
        console.log(`Created variants for ${key}:`, variants.map(v => ({ id: v.id, content: v.content })));
      });
      
      // Initialize landing pages if they exist and map selections BEFORE setting source states
      if (existingLandingPages.length > 0) {
        const formattedLandingPages = existingLandingPages.map(lp => ({
          id: lp.id.toString(),
          url: lp.url,
          label: lp.label
        }));
        setLandingPages(formattedLandingPages);
        
        // Map each existing UTM link back to its exact original landing page and content
        existingCampaignData.forEach((link, linkIndex) => {
          const sourceTemplate = sourceTemplates.find((template: SourceTemplate) => 
            template.sourceName.toLowerCase() === link.utm_source.toLowerCase()
          );
          const sourceName = sourceTemplate ? sourceTemplate.sourceName : link.utm_source;
          const medium = link.utm_medium;
          
          // Find the exact matching landing page by URL
          const normalizeUrl = (url: string) => {
            return url.replace(/^https?:\/\/?/i, '').replace(/\/$/, '').toLowerCase();
          };
          
          const normalizedTargetUrl = normalizeUrl(link.targetUrl);
          let matchingLandingPage = formattedLandingPages.find(lp => 
            normalizeUrl(lp.url) === normalizedTargetUrl
          );
          
          // Create a unique row key for this specific link
          // Use the link's content and a unique index to ensure no conflicts
          const key = `${sourceName}-${medium}`;
          
          // Get all links for this source-medium combination, sorted by content then by ID for consistency
          const linksForThisMedium = existingCampaignData
            .filter(l => {
              const lSourceTemplate = sourceTemplates.find((template: SourceTemplate) => 
                template.sourceName.toLowerCase() === l.utm_source.toLowerCase()
              );
              const lSourceName = lSourceTemplate ? lSourceTemplate.sourceName : l.utm_source;
              return lSourceName === sourceName && l.utm_medium === medium;
            })
            .sort((a, b) => {
              // Sort by content first, then by ID for stable ordering
              const aContent = a.utm_content || '';
              const bContent = b.utm_content || '';
              if (aContent !== bContent) {
                return aContent.localeCompare(bContent);
              }
              return a.id - b.id;
            });
          
          const variantIndex = linksForThisMedium.findIndex(l => l.id === link.id);
          const variantId = `${key}-${variantIndex}`;
          const rowKey = `${sourceName}-${medium}-${variantId}`;
          
          // Only set the landing page if we found an exact match
          if (matchingLandingPage && newSourceStates[sourceName]) {
            newSourceStates[sourceName].landingPageSelections[rowKey] = matchingLandingPage.id;
            console.log(`EDIT MODE INIT: rowKey=${rowKey} -> landingPageId=${matchingLandingPage.id} (${matchingLandingPage.url}) for link ${link.id}`);
            console.log(`Available variants for ${key}:`, newContentVariants[key]?.map(v => v.id));
          } else {
            console.log(`NO MATCH: Could not find landing page for ${link.targetUrl} among available pages:`, formattedLandingPages.map(lp => lp.url));
          }
        });
      }
      
      console.log('Final newSourceStates with landing page selections:', newSourceStates);
      console.log('Final newContentVariants:', newContentVariants);
      
      setContentVariants(newContentVariants);
      setSourceStates(newSourceStates); // Set contentVariants first to ensure they're available when sourceStates change triggers renders
      
      // All sections are now always expanded - no state management needed
    }
  }, [editMode, existingCampaignData, existingLandingPages, sourceTemplates]);

  // Simple header component - no collapsing functionality
  const SectionHeader = ({ title }: { title: string }) => (
    <div className="p-4 bg-gray-50 border-b">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
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
        <SectionHeader title="Campaign and Landing Pages" />
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
                <Label className="text-sm font-medium mb-4 block">Landing Page URLs *</Label>
                
                {/* Always show landing pages interface */}
                <div className="space-y-3">
                  {landingPages.length === 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-96 relative">
                        <Input
                          value={targetUrl}
                          onChange={(e) => setTargetUrl(e.target.value)}
                          placeholder="https://example.com/page"
                          list="url-suggestions"
                        />
                        {uniqueUrls.length > 0 && (
                          <datalist id="url-suggestions">
                            {uniqueUrls.map((url: string, index: number) => (
                              <option key={index} value={url} />
                            ))}
                          </datalist>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {landingPages.map((landingPage) => (
                    <div key={landingPage.id} className="flex items-center gap-3">
                      <div className="w-96 relative">
                        <Input
                          value={landingPage.url}
                          onChange={(e) => updateLandingPage(landingPage.id, 'url', e.target.value)}
                          placeholder="https://example.com/page"
                          list={`url-suggestions-${landingPage.id}`}
                        />
                        {uniqueUrls.length > 0 && (
                          <datalist id={`url-suggestions-${landingPage.id}`}>
                            {uniqueUrls.map((url: string, index: number) => (
                              <option key={index} value={url} />
                            ))}
                          </datalist>
                        )}
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
                  
                  {/* Add Landing Page button always at bottom */}
                  <Button
                    type="button"
                    onClick={addLandingPage}
                    variant="outline"
                    size="sm"
                    className="text-primary hover:text-primary/80 w-96"
                  >
                    <Plus className="mr-1" size={16} />
                    Add Landing Page
                  </Button>
                  
                  <p className="text-xs text-gray-500">
                    Add multiple landing pages to choose different URLs for different UTM links in the Campaign Links section.
                  </p>
                </div>
              </div>
            </div>

          </div>
      </Card>

      {/* Section 2: Sources */}
      <Card>
        <SectionHeader title="Sources" />
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
                            selectedMediums: [] // Don't auto-select mediums anymore
                          }
                        }));
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
          </div>
      </Card>

      {/* Section 3: Mediums */}
      {Object.entries(sourceStates).some(([, state]) => state.checked) && (
        <Card>
          <SectionHeader title="Mediums" />
          <div className="p-6">
            <div className="text-sm text-gray-600 mb-4">
              Select mediums for each chosen source.
            </div>
            <div className="space-y-6">
              {Object.entries(sourceStates)
                .filter(([, state]) => state.checked)
                .map(([sourceName, state]) => {
                  const template = sourceTemplates.find((t: SourceTemplate) => t.sourceName === sourceName);
                  return (
                    <div key={sourceName} className="border rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">{sourceName}</h3>
                      <div className="flex flex-wrap gap-2 items-center">
                        {template?.mediums?.map((medium: string) => {
                          const isMediumSelected = state.selectedMediums.includes(medium);
                          return (
                            <Button
                              key={medium}
                              variant={isMediumSelected ? "default" : "outline"}
                              size="sm"
                              className={isMediumSelected ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                              onClick={async () => {
                                const newSelectedMediums = isMediumSelected
                                  ? state.selectedMediums.filter(m => m !== medium)
                                  : [...state.selectedMediums, medium];
                                
                                setSourceStates(prev => ({
                                  ...prev,
                                  [sourceName]: {
                                    ...state,
                                    selectedMediums: newSelectedMediums
                                  }
                                }));

                                // If medium is being selected for the first time, auto-populate content
                                if (!isMediumSelected) {
                                  const contentSuggestions = await fetchUtmContentSuggestions(sourceName.toLowerCase(), medium);
                                  
                                  if (contentSuggestions.length > 0) {
                                    const mediumKey = getVariantKey(sourceName, medium);
                                    const newVariants = contentSuggestions.map((content, index) => ({
                                      id: `${mediumKey}-${index}`,
                                      content: content
                                    }));
                                    
                                    setContentVariants(prev => ({
                                      ...prev,
                                      [mediumKey]: newVariants
                                    }));
                                    
                                    toast({
                                      title: "UTM Content Added",
                                      description: `Auto-populated ${contentSuggestions.length} content suggestions for ${sourceName} ${medium}. Remove unwanted rows if needed.`,
                                    });
                                  } else {
                                    // No suggestions available, create empty content variant
                                    const mediumKey = getVariantKey(sourceName, medium);
                                    setContentVariants(prev => ({
                                      ...prev,
                                      [mediumKey]: [{ id: `${mediumKey}-0`, content: '' }]
                                    }));
                                  }
                                } else {
                                  // Medium is being deselected, remove content variants
                                  const mediumKey = getVariantKey(sourceName, medium);
                                  setContentVariants(prev => {
                                    const updatedVariants = { ...prev };
                                    delete updatedVariants[mediumKey];
                                    return updatedVariants;
                                  });
                                }
                              }}
                            >
                              {medium}
                            </Button>
                          );
                        })}
                        
                        {/* Add Medium Button */}
                        {showCustomMediumInput[sourceName] ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={customMediumInput[sourceName] || ''}
                              onChange={(e) => setCustomMediumInput(prev => ({
                                ...prev,
                                [sourceName]: e.target.value
                              }))}
                              placeholder="Enter medium name"
                              className="px-3 py-1 border rounded text-sm"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddMedium(sourceName, template?.id);
                                }
                              }}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => handleAddMedium(sourceName, template?.id)}
                              disabled={!customMediumInput[sourceName]?.trim()}
                            >
                              Add
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowCustomMediumInput(prev => ({ ...prev, [sourceName]: false }));
                                setCustomMediumInput(prev => ({ ...prev, [sourceName]: '' }));
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCustomMediumInput(prev => ({ ...prev, [sourceName]: true }))}
                          >
                            + Add Medium
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </Card>
      )}

      {/* Section 4: Campaign Links */}
      <Card>
        <SectionHeader title="Campaign Links" />
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
                              <th 
                                className="text-left p-3 text-sm font-medium text-gray-700 w-40 cursor-pointer hover:bg-gray-100 select-none"
                                onClick={() => handleColumnSort(sourceName, 'landingPage')}
                              >
                                <div className="flex items-center">
                                  Landing Page
                                  {sortConfig[sourceName]?.column === 'landingPage' && (
                                    sortConfig[sourceName].direction === 'asc' ? 
                                      <ChevronUp className="w-4 h-4 ml-1" /> : 
                                      <ChevronDown className="w-4 h-4 ml-1" />
                                  )}
                                </div>
                              </th>
                            )}
                            <th 
                              className="text-left p-3 text-sm font-medium text-gray-700 w-24 cursor-pointer hover:bg-gray-100 select-none"
                              onClick={() => handleColumnSort(sourceName, 'medium')}
                            >
                              <div className="flex items-center">
                                Medium
                                {sortConfig[sourceName]?.column === 'medium' && (
                                  sortConfig[sourceName].direction === 'asc' ? 
                                    <ChevronUp className="w-4 h-4 ml-1" /> : 
                                    <ChevronDown className="w-4 h-4 ml-1" />
                                )}
                              </div>
                            </th>
                            <th 
                              className="text-left p-3 text-sm font-medium text-gray-700 w-56 cursor-pointer hover:bg-gray-100 select-none"
                              onClick={() => handleColumnSort(sourceName, 'content')}
                            >
                              <div className="flex items-center">
                                Content
                                {sortConfig[sourceName]?.column === 'content' && (
                                  sortConfig[sourceName].direction === 'asc' ? 
                                    <ChevronUp className="w-4 h-4 ml-1" /> : 
                                    <ChevronDown className="w-4 h-4 ml-1" />
                                )}
                              </div>
                            </th>
                            <th className="text-left p-3 text-sm font-medium text-gray-700 w-60">Link name</th>
                            <th className="text-left p-3 text-sm font-medium text-gray-700">UTM Link</th>
                            <th className="text-center p-3 text-sm font-medium text-gray-700 w-16">Remove</th>
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
                                <span className="text-sm font-medium text-gray-700">{row.medium}</span>
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
                              <td className="p-3 text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    removeContentVariant(sourceName, row.medium, row.variant.id);
                                  }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                      {getSortedTableRows(sourceName, state).map((row) => (
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
                      // In edit mode, first delete existing campaign links using original name
                      if (editMode && existingCampaignData.length > 0) {
                        try {
                          await deleteCampaignLinksMutation.mutateAsync(originalCampaignName);
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
                          // Delete existing landing pages for this campaign using original name
                          await apiRequest("DELETE", `/api/campaign-landing-pages/${editMode ? originalCampaignName : campaignName}`);
                          
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
      </Card>
    </div>
  );
}