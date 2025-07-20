import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { generateUTMLink } from "@shared/validation";
import { validateUrl } from "@/lib/utm";
import { MessageCircle, Send, Bot, User as UserIcon, Plus, Check } from "lucide-react";
import type { User, SourceTemplate, Tag } from "@shared/schema";

interface ChatWizardProps {
  user: User;
  onComplete?: () => void;
}

interface ChatMessage {
  id: string;
  type: 'bot' | 'user';
  content: string;
  timestamp: Date;
  options?: Array<{ 
    label: string; 
    value: string; 
    action?: () => void; 
    isPrimary?: boolean; 
    isSelected?: boolean; 
    disabled?: boolean;
  }>;
  showInput?: boolean;
  inputPlaceholder?: string;
  onInput?: (value: string) => void;
  autoFocus?: boolean;
  step?: string;
}

interface CampaignData {
  name: string;
  isExistingCampaign: boolean;
  existingCampaignName?: string;
  landingPages: Array<{ id: string; url: string; label: string }>;
  selectedSources: string[];
  selectedMediums: { [source: string]: string[] };
  contentInputs: { [key: string]: string };
  selectedContent: { [key: string]: string[] }; // key: source-medium, value: array of selected content
  selectedTerm: { [key: string]: string[] }; // key: source-medium, value: array of selected terms
  selectedTags: string[];
}

export default function ChatWizard({ user, onComplete }: ChatWizardProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentStep, setCurrentStep] = useState<'welcome' | 'campaign-type' | 'campaign-name' | 'existing-campaign' | 'landing-pages' | 'sources' | 'mediums' | 'content' | 'terms' | 'tags' | 'review' | 'complete'>('welcome');
  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: '',
    isExistingCampaign: false,
    landingPages: [],
    selectedSources: [],
    selectedMediums: {},
    contentInputs: {},
    selectedContent: {},
    selectedTerm: {},
    selectedTags: []
  });
  const [currentInput, setCurrentInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [currentSourceMedium, setCurrentSourceMedium] = useState<{source: string; medium: string} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch source templates
  const { data: sourceTemplates = [] } = useQuery<SourceTemplate[]>({
    queryKey: ["/api/source-templates"],
  });

  // Fetch tags
  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
  });

  // Fetch unique URLs for autocomplete
  const { data: uniqueUrls = [] } = useQuery<string[]>({
    queryKey: ["/api/unique-urls"],
  });

  // Fetch existing campaigns
  const existingCampaignsQuery = useQuery({
    queryKey: ["/api/utm-links"],
    select: (data: any[]) => {
      // Filter out archived campaigns and get unique campaign names
      const activeLinks = data.filter(link => !link.isArchived);
      const campaignNames = [...new Set(activeLinks.map(link => link.utm_campaign))];
      return campaignNames.slice(0, 10); // Get 10 latest campaigns
    }
  });

  // Function to fetch content suggestions for a source-medium combination
  const fetchContentSuggestions = async (source: string, medium: string): Promise<string[]> => {
    try {
      const response = await apiRequest(`/api/utm-content/${encodeURIComponent(source)}/${encodeURIComponent(medium)}`, { method: "GET" });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error fetching content for ${source}-${medium}:`, response.status, errorText);
        return [];
      }
      const data = await response.json();
      console.log(`Content suggestions for ${source}-${medium}:`, data);
      return data;
    } catch (error) {
      console.error(`Error fetching content for ${source}-${medium}:`, error);
      return [];
    }
  };

  // Function to fetch term template suggestions
  const fetchTermSuggestions = async (category?: string): Promise<Array<{id: number; termValue: string; description?: string; category: string}>> => {
    try {
      const params = category ? `?category=${category}` : '';
      const response = await apiRequest(`/api/term-templates${params}`, { method: "GET" });
      if (!response.ok) {
        console.error('Term templates API error');
        return [];
      }
      const terms = await response.json();
      return Array.isArray(terms) ? terms : [];
    } catch (error) {
      console.error('Error fetching term suggestions:', error);
      return [];
    }
  };

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (tagData: { name: string; userId: number; accountId: number }) => {
      const response = await apiRequest("/api/tags", { method: "POST", body: JSON.stringify(tagData) });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
    },
  });

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: async (data: { utmLinks: any[], landingPages: any[] }) => {
      const results = [];
      
      // Create landing pages first
      for (const landingPage of data.landingPages) {
        try {
          const response = await apiRequest("/api/campaign-landing-pages", { method: "POST", body: JSON.stringify(landingPage) });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Landing page creation failed: ${response.status} - ${errorText}`);
          }
          
          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const errorText = await response.text();
            throw new Error(`Expected JSON response but got: ${contentType}. Response: ${errorText.substring(0, 200)}...`);
          }
          
          const result = await response.json();
          results.push(result);
        } catch (error) {
          console.error("Failed to create landing page:", error);
          throw error; // Re-throw to trigger onError
        }
      }
      
      // Create UTM links
      for (const utmLink of data.utmLinks) {
        try {
          const response = await apiRequest("/api/utm-links", { method: "POST", body: JSON.stringify(utmLink) });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`UTM link creation failed: ${response.status} - ${errorText}`);
          }
          
          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const errorText = await response.text();
            throw new Error(`Expected JSON response but got: ${contentType}. Response: ${errorText.substring(0, 200)}...`);
          }
          
          const result = await response.json();
          results.push(result);
        } catch (error) {
          console.error("Failed to create UTM link:", error);
          throw error; // Re-throw to trigger onError
        }
      }
      
      return results;
    },
    onSuccess: (results) => {
      setIsCreatingCampaign(false);
      queryClient.invalidateQueries({ queryKey: ["/api/utm-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-landing-pages"] });
      setTimeout(() => {
        showFinalOptions();
      }, 500);
    },
    onError: (error: any) => {
      setIsCreatingCampaign(false);
      addBotMessage(`❌ Sorry, there was an error creating your campaign: ${error.message}. Would you like to try again?`, [
        { label: "Try Again", value: "retry", action: () => createCampaign() },
        { label: "Start Over", value: "restart", action: () => restartWizard() }
      ]);
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    
    // Auto-focus input when a message with autoFocus is added
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.autoFocus && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 1200); // Focus after the typing animation completes
    }
  }, [messages]);

  useEffect(() => {
    // Start with welcome message
    if (messages.length === 0) {
      setTimeout(() => {
        addBotMessage(
          "👋 Hi! I'm your UTM Campaign Assistant. Would you like to add links to an existing campaign or create a brand new one?",
          [
            { label: "Existing Campaign", value: "existing", action: () => showExistingCampaigns() },
            { label: "New Campaign", value: "new", action: () => startNewCampaign() }
          ],
          'campaign-type'
        );
      }, 500);
    }
  }, []);

  // Handle existing campaigns query completion
  useEffect(() => {
    const { data: existingCampaigns = [], isLoading: isLoadingCampaigns } = existingCampaignsQuery;
    
    // Check if we're in the loading state and the query has completed
    if (currentStep === 'existing-campaign' && !isLoadingCampaigns && existingCampaigns.length > 0) {
      // Find the loading message and replace it
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.content.includes('Loading your campaigns')) {
        // Remove the loading message and add the campaigns
        setMessages(prev => prev.slice(0, -1));
        
        const campaignOptions = existingCampaigns.map(campaignName => ({
          label: campaignName,
          value: campaignName,
          action: () => selectExistingCampaign(campaignName)
        }));

        addBotMessage(
          "Here are your recent campaigns. Which one would you like to add links to?",
          campaignOptions,
          'existing-campaign'
        );
      }
    }
  }, [existingCampaignsQuery.data, existingCampaignsQuery.isLoading, currentStep, messages]);

  const addBotMessage = (content: string, options: Array<{ label: string; value: string; action?: () => void; isPrimary?: boolean; isSelected?: boolean }> = [], nextStep?: string, showInput = false, inputPlaceholder = "", autoFocus = false, step?: string) => {
    setIsTyping(true);
    setTimeout(() => {
      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        type: 'bot',
        content,
        timestamp: new Date(),
        options,
        showInput,
        inputPlaceholder,
        onInput: showInput ? handleUserInput : undefined,
        autoFocus,
        step,
        isBot: true
      };
      setMessages(prev => [...prev, newMessage]);
      setIsTyping(false);
      if (nextStep) {
        setCurrentStep(nextStep as any);
      }
    }, 1000);
  };

  const addUserMessage = (content: string) => {
    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      type: 'user',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleUserInput = (value: string) => {
    if (!value.trim()) return;

    addUserMessage(value);
    setCurrentInput('');

    switch (currentStep) {
      case 'campaign-name':
        setCampaignData(prev => ({ ...prev, name: value }));
        setTimeout(() => {
          showLandingPageSelection();
        }, 500);
        break;

      case 'landing-pages':
        if (validateUrl(value)) {
          const newLandingPage = {
            id: `lp-${Date.now()}`,
            url: value,
            label: value
          };
          setCampaignData(prev => ({
            ...prev,
            landingPages: [...prev.landingPages, newLandingPage]
          }));
          setTimeout(() => {
            addBotMessage(
              `✅ Added "${value}" to your landing pages! Would you like to add another landing page or continue to sources?`,
              [
                { label: "Add Another Landing Page", value: "add-another", action: () => showLandingPageSelection() },
                { label: "Continue to Sources", value: "continue-sources", action: () => showSourceSelection() }
              ]
            );
          }, 500);
        } else {
          setTimeout(() => {
            addBotMessage(
              "That doesn't look like a valid URL. Please enter a complete URL starting with https:// (like https://example.com)",
              [],
              'landing-pages',
              true,
              "Enter a complete URL starting with https:// (e.g., 'https://example.com')"
            );
          }, 500);
        }
        break;

      case 'content':
        // Handle custom content input for specific source-medium combination
        if (currentSourceMedium) {
          const sanitizedContent = value.trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '');
          if (sanitizedContent) {
            const { source, medium } = currentSourceMedium;
            
            // Add custom content to database (future enhancement)
            // For now, just add to local state
            selectContent(source, medium, sanitizedContent);
            
            setTimeout(() => {
              addBotMessage(
                `✅ Added custom content "${sanitizedContent}" for ${source} → ${medium}! Continue selecting content or proceed to terms.`,
                [
                  { label: "Add Another Content", value: "add-another", action: () => promptForCustomContent(source, medium) },
                  { label: "Continue to Terms", value: "continue-terms", action: () => showContentSelectedAndContinue() }
                ]
              );
            }, 500);
          } else {
            setTimeout(() => {
              addBotMessage(
                "Please enter a valid content variation using only letters, numbers, hyphens, and underscores:",
                [],
                'content',
                true,
                "Enter content variation (letters, numbers, hyphens, underscores)"
              );
            }, 500);
          }
        }
        break;

      case 'terms':
        // Handle custom term input - validate and apply to all source-medium combinations
        const sanitizedTerm = value.trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '');
        if (sanitizedTerm) {
          setCampaignData(prev => {
            const newCampaignData = { ...prev };
            
            // Initialize selectedTerm if it doesn't exist
            if (!newCampaignData.selectedTerm) {
              newCampaignData.selectedTerm = {};
            }

            // Apply the custom term to all source-medium combinations
            for (const source of newCampaignData.selectedSources) {
              const mediums = newCampaignData.selectedMediums[source] || [];
              for (const medium of mediums) {
                const key = `${source}-${medium}`;
                if (!newCampaignData.selectedTerm[key]) {
                  newCampaignData.selectedTerm[key] = [];
                }
                // Add term if not already selected
                if (!newCampaignData.selectedTerm[key].includes(sanitizedTerm)) {
                  newCampaignData.selectedTerm[key].push(sanitizedTerm);
                }
              }
            }
            
            return newCampaignData;
          });
          
          addUserMessage(sanitizedTerm);
          
          setTimeout(() => {
            updateTermSelectionOptions();
          }, 500);
        } else {
          setTimeout(() => {
            addBotMessage(
              "Please enter a valid term using only letters, numbers, hyphens, and underscores:",
              [],
              'terms',
              true,
              "Enter term value (e.g., 'summer-sale', 'mobile-users')"
            );
          }, 500);
        }
        break;

      case 'tags':
        // Handle custom tag input
        if (!tags.find(tag => tag.name.toLowerCase() === value.toLowerCase())) {
          // Create the tag in the database first
          createTagMutation.mutate({
            name: value,
            userId: user.id,
            accountId: user.accountId
          }, {
            onSuccess: () => {
              // Add to local campaign data after successful creation
              setCampaignData(prev => ({
                ...prev,
                selectedTags: [...prev.selectedTags, value]
              }));
              setTimeout(() => {
                addBotMessage(
                  `✅ Custom tag "${value}" added! Ready to review your campaign?`,
                  [
                    { label: "Add Another Tag", value: "add-tag", action: () => showTagSelection() },
                    { label: "Review Campaign", value: "review", action: () => showReview() }
                  ]
                );
              }, 500);
            },
            onError: (error) => {
              console.error('Failed to create tag:', error);
              setTimeout(() => {
                addBotMessage(
                  "Failed to create tag. Please try again.",
                  [],
                  'tags',
                  true,
                  "Enter a new tag name"
                );
              }, 500);
            }
          });
        } else {
          setTimeout(() => {
            addBotMessage(
              "That tag already exists. Please choose a different name or select from the existing tags above.",
              [],
              'tags',
              true,
              "Enter a new tag name"
            );
          }, 500);
        }
        break;
    }
  };

  const showExistingCampaigns = () => {
    setCampaignData(prev => ({ ...prev, isExistingCampaign: true }));
    setCurrentStep('existing-campaign');
    
    const { data: existingCampaigns = [], isLoading: isLoadingCampaigns } = existingCampaignsQuery;
    
    if (isLoadingCampaigns) {
      addBotMessage(
        "Loading your campaigns...",
        [],
        'existing-campaign'
      );
      return;
    }
    
    if (existingCampaigns.length > 0) {
      const campaignOptions = existingCampaigns.map(campaignName => ({
        label: campaignName,
        value: campaignName,
        action: () => selectExistingCampaign(campaignName)
      }));

      addBotMessage(
        "Here are your recent campaigns. Which one would you like to add links to?",
        campaignOptions,
        'existing-campaign'
      );
    } else {
      addBotMessage(
        "You don't have any existing campaigns yet. Let's create your first one!",
        [{ label: "Create New Campaign", value: "new", action: () => startNewCampaign() }],
        'campaign-type'
      );
    }
  };

  const selectExistingCampaign = (campaignName: string) => {
    setCampaignData(prev => ({ ...prev, name: campaignName, existingCampaignName: campaignName, isExistingCampaign: true }));
    addUserMessage(campaignName);
    setTimeout(() => {
      showLandingPageSelection();
    }, 500);
  };

  const startNewCampaign = () => {
    setCampaignData(prev => ({ ...prev, isExistingCampaign: false }));
    addBotMessage(
      "Perfect! Let's create a new campaign. What would you like to name it?",
      [],
      'campaign-name',
      true,
      "Enter campaign name (e.g., 'Summer Sale 2025')",
      true // Auto-focus the input field
    );
  };

  const showLandingPageSelection = () => {
    // Get top 10 most used URLs
    const urlCounts = uniqueUrls.reduce((acc: {[key: string]: number}, url: string) => {
      acc[url] = (acc[url] || 0) + 1;
      return acc;
    }, {});
    
    const topUrls = Object.entries(urlCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([url]) => url)
      .filter(url => !campaignData.landingPages.find(lp => lp.url === url)); // Filter out already selected URLs

    const urlOptions = topUrls.map(url => ({
      label: url,
      value: url,
      action: () => selectLandingPageUrl(url)
    }));

    const currentCount = campaignData.landingPages.length;
    const message = currentCount === 0 
      ? `Great! Now let's add landing pages. You can choose from your most-used URLs or add a new one.

💡 **Tip:** When adding a custom URL, make sure to include the full URL starting with https:// (e.g., https://example.com)`
      : `You currently have ${currentCount} landing page(s): ${campaignData.landingPages.map(lp => lp.url).join(', ')}. Choose more URLs:`;

    const options = [
      ...urlOptions,
      { label: "Add Custom URL", value: "custom", action: () => promptForCustomUrl() }
    ];

    // Only show continue option if we have at least one landing page
    if (currentCount > 0) {
      options.push({ label: "Continue to Sources", value: "continue", action: () => showSourceSelection() });
    }

    addBotMessage(message, options, 'landing-pages');
  };

  const selectLandingPageUrl = (url: string) => {
    // Check if URL is already selected
    if (campaignData.landingPages.find(lp => lp.url === url)) {
      setTimeout(() => {
        addBotMessage(
          "That URL is already selected. Please choose a different one or continue to sources.",
          [],
          undefined,
          false
        );
      }, 500);
      return;
    }

    const newLandingPage = {
      id: `lp-${Date.now()}`,
      url: url,
      label: url
    };
    setCampaignData(prev => ({
      ...prev,
      landingPages: [...prev.landingPages, newLandingPage]
    }));
    addUserMessage(url);
    
    setTimeout(() => {
      addBotMessage(
        `✅ Added "${url}" to your landing pages! Would you like to add another landing page or continue to sources?`,
        [
          { label: "Add Another Landing Page", value: "add-another", action: () => showLandingPageSelection() },
          { label: "Continue to Sources", value: "continue-sources", action: () => showSourceSelection() }
        ]
      );
    }, 500);
  };

  const promptForCustomUrl = () => {
    addBotMessage(
      "Enter the custom landing page URL you'd like to add:",
      [],
      'landing-pages',
      true,
      "Enter landing page URL (e.g., 'https://example.com')"
    );
  };

  const showSourceSelection = () => {
    const availableSources = [...new Set(sourceTemplates.map(template => template.sourceName))];
    const unselectedSources = availableSources.filter(source => !campaignData.selectedSources.includes(source));
    
    const sourceOptions = unselectedSources.map(source => ({
      label: source.charAt(0).toUpperCase() + source.slice(1),
      value: source,
      action: () => selectSource(source)
    }));

    const currentCount = campaignData.selectedSources.length;
    const message = currentCount === 0 
      ? "Perfect! Now let's choose your traffic sources. Select all the platforms you'll be promoting on:"
      : `✅ Selected sources: ${campaignData.selectedSources.join(', ')}. Select additional sources or continue:`;

    const options = [
      ...sourceOptions,
      { label: "Add Custom Source", value: "custom", action: () => promptForCustomSource() }
    ];

    // Always show continue option if we have at least one source
    if (currentCount > 0) {
      options.push({ label: "Continue to Mediums", value: "continue", action: () => {
        // Use the current selected sources to avoid state timing issues
        proceedToMediumsWithSources(campaignData.selectedSources);
      }, isPrimary: true });
    }

    addBotMessage(message, options, 'sources');
  };

  const selectSource = (source: string) => {
    setCampaignData(prev => {
      const newSelectedSources = [...prev.selectedSources, source];
      
      // Update the UI immediately with the new state
      setTimeout(() => {
        const message = `✅ Selected sources: ${newSelectedSources.join(', ')}. Select additional sources or continue:`;
        
        // Get available sources for remaining options
        const availableSources = [...new Set(sourceTemplates.map(template => template.sourceName))];
        const unselectedSources = availableSources.filter(src => !newSelectedSources.includes(src));
        
        const sourceOptions = unselectedSources.map(src => ({
          label: src.charAt(0).toUpperCase() + src.slice(1),
          value: src,
          action: () => selectSource(src),
          isSelected: false
        }));

        const selectedOptions = newSelectedSources.map(src => ({
          label: src.charAt(0).toUpperCase() + src.slice(1),
          value: src,
          action: () => {}, // No action for selected sources
          isSelected: true
        }));

        const options = [
          ...selectedOptions,
          ...sourceOptions,
          { label: "Add Custom Source", value: "custom", action: () => promptForCustomSource() },
          { label: "Continue to Mediums", value: "continue", action: () => {
            // Pass the current selected sources to avoid state timing issues
            proceedToMediumsWithSources(newSelectedSources);
          }, isPrimary: true }
        ];

        // Find and update the last sources message
        setMessages(prevMessages => {
          const lastSourcesIndex = prevMessages.findLastIndex(msg => 
            msg.type === 'bot' && msg.content && (msg.content.includes('traffic sources') || msg.content.includes('Selected sources'))
          );
          
          if (lastSourcesIndex >= 0) {
            const updatedMessages = [...prevMessages];
            updatedMessages[lastSourcesIndex] = {
              ...updatedMessages[lastSourcesIndex],
              content: message,
              options: options
            };
            return updatedMessages;
          }
          return prevMessages;
        });
      }, 100);

      return {
        ...prev,
        selectedSources: newSelectedSources
      };
    });
  };

  const proceedToMediums = () => {
    // Get the current selected sources from the state
    const currentSelectedSources = campaignData.selectedSources;
    
    if (currentSelectedSources.length === 0) {
      addBotMessage(
        "No sources selected. Please go back and select at least one source.",
        [{ label: "Back to Sources", value: "back", action: () => showSourceSelection() }]
      );
      return;
    }

    // Add user message showing selected sources
    addUserMessage(`Selected sources: ${currentSelectedSources.join(', ')}`);
    
    // Proceed to medium selection
    setTimeout(() => {
      showMediumSelectionForFirstSource();
    }, 500);
  };

  const proceedToMediumsWithSources = (selectedSources: string[]) => {
    if (selectedSources.length === 0) {
      addBotMessage(
        "No sources selected. Please go back and select at least one source.",
        [{ label: "Back to Sources", value: "back", action: () => showSourceSelection() }]
      );
      return;
    }

    // Update the campaign data with the selected sources
    setCampaignData(prev => ({
      ...prev,
      selectedSources: selectedSources
    }));

    // Add user message showing selected sources
    addUserMessage(`Selected sources: ${selectedSources.join(', ')}`);
    
    // Proceed to medium selection, passing the sources directly
    setTimeout(() => {
      showMediumSelectionForFirstSource(selectedSources);
    }, 500);
  };

  const showMediumSelectionForFirstSource = (sourcesOverride?: string[]) => {
    // Use the override sources if provided, otherwise use the state
    const sources = sourcesOverride || campaignData.selectedSources;
    const firstSource = sources[0];
    
    if (!firstSource) {
      addBotMessage(
        "No sources selected. Please go back and select at least one source.",
        [{ label: "Back to Sources", value: "back", action: () => showSourceSelection() }]
      );
      return;
    }

    // Use the generic function for the first source
    showMediumSelectionForSource(firstSource);
  };

  const selectMediumForSource = (source: string, medium: string) => {
    setCampaignData(prev => {
      const currentMediums = prev.selectedMediums[source] || [];
      const newMediums = [...currentMediums, medium];
      
      const newCampaignData = {
        ...prev,
        selectedMediums: {
          ...prev.selectedMediums,
          [source]: newMediums
        }
      };

      // Update the UI to show selected mediums
      setTimeout(() => {
        const message = `✅ Selected mediums for ${source}: ${newMediums.join(', ')}. Select additional mediums or continue:`;
        
        // Get available mediums for this source
        const sourceTemplate = sourceTemplates.find(template => template.sourceName === source);
        const sourceMediums = sourceTemplate?.mediums || [];
        
        const unselectedMediums = sourceMediums.filter(m => !newMediums.includes(m));
        
        const mediumOptions = unselectedMediums.map(m => ({
          label: m.charAt(0).toUpperCase() + m.slice(1),
          value: m,
          action: () => selectMediumForSource(source, m),
          isSelected: false
        }));

        const selectedOptions = newMediums.map(m => ({
          label: m.charAt(0).toUpperCase() + m.slice(1),
          value: m,
          action: () => {}, // No action for selected mediums
          isSelected: true
        }));

        const options = [
          ...selectedOptions,
          ...mediumOptions,
          { label: "Add Custom Medium", value: "custom-medium", action: () => promptForCustomMedium(source) },
          { 
            label: "Continue with Selected Mediums", 
            value: "continue", 
            action: () => {
              // Pass the current state directly to avoid timing issues
              proceedToContentForSourceWithState(source, newCampaignData);
            }, 
            isPrimary: true 
          }
        ];

        // Find and update the last mediums message
        setMessages(prevMessages => {
          const lastMediumIndex = prevMessages.findLastIndex(msg => 
            msg.type === 'bot' && msg.content && (msg.content.includes('marketing medium') || msg.content.includes('Selected mediums'))
          );
          
          if (lastMediumIndex >= 0) {
            const updatedMessages = [...prevMessages];
            updatedMessages[lastMediumIndex] = {
              ...updatedMessages[lastMediumIndex],
              content: message,
              options: options
            };
            return updatedMessages;
          }
          return prevMessages;
        });
      }, 100);

      return newCampaignData;
    });
  };

  const proceedToContentForSourceWithState = (source: string, currentCampaignData: any) => {
    const selectedMediums = currentCampaignData.selectedMediums[source];
    
    if (!selectedMediums || selectedMediums.length === 0) {
      addBotMessage(
        "No mediums selected. Please select at least one medium.",
        [{ label: "Back to Mediums", value: "back", action: () => showMediumSelectionForFirstSource() }]
      );
      return;
    }

    // Add user message showing selected mediums
    addUserMessage(`Selected mediums for ${source}: ${selectedMediums.join(', ')}`);
    
    // Check if there are more sources to process
    setTimeout(() => {
      proceedToNextSourceWithState(source, currentCampaignData);
    }, 500);
  };

  const proceedToContentForSource = (source: string) => {
    // Use a timeout to ensure state is updated
    setTimeout(() => {
      const selectedMediums = campaignData.selectedMediums[source];
      
      if (!selectedMediums || selectedMediums.length === 0) {
        addBotMessage(
          "No mediums selected. Please select at least one medium.",
          [{ label: "Back to Mediums", value: "back", action: () => showMediumSelectionForFirstSource() }]
        );
        return;
      }

      // Add user message showing selected mediums
      addUserMessage(`Selected mediums for ${source}: ${selectedMediums.join(', ')}`);
      
      // Check if there are more sources to process
      setTimeout(() => {
        proceedToNextSource(source);
      }, 500);
    }, 200);
  };

  const proceedToNextSourceWithState = (currentSource: string, currentCampaignData: any) => {
    const selectedSources = currentCampaignData.selectedSources;
    const currentIndex = selectedSources.indexOf(currentSource);
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < selectedSources.length) {
      // There's another source to process
      const nextSource = selectedSources[nextIndex];
      showMediumSelectionForSource(nextSource);
    } else {
      // All sources processed, proceed to content selection
      showContentSelectionWithState(currentCampaignData);
    }
  };

  const proceedToNextSource = (currentSource: string) => {
    const selectedSources = campaignData.selectedSources;
    const currentIndex = selectedSources.indexOf(currentSource);
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < selectedSources.length) {
      // There's another source to process
      const nextSource = selectedSources[nextIndex];
      showMediumSelectionForSource(nextSource);
    } else {
      // All sources processed, proceed to content selection
      showContentSelectionWithState(campaignData);
    }
  };

  const showMediumSelectionForSource = (source: string) => {
    // Get all mediums for this source from the mediums array
    const sourceTemplate = sourceTemplates.find(template => template.sourceName === source);
    const sourceMediums = sourceTemplate?.mediums || [];

    if (sourceMediums.length > 0) {
      const mediumOptions = sourceMediums.map(medium => ({
        label: medium.charAt(0).toUpperCase() + medium.slice(1),
        value: medium,
        action: () => selectMediumForSource(source, medium)
      }));

      addBotMessage(
        `Great! For ${source}, select the marketing mediums you'll use:`,
        [
          ...mediumOptions,
          { label: "Add Custom Medium", value: "custom-medium", action: () => promptForCustomMedium(source) }
        ],
        'mediums'
      );
    } else {
      promptForCustomMedium(source);
    }
  };

  const selectMedium = (source: string, medium: string) => {
    setCampaignData(prev => ({
      ...prev,
      selectedMediums: {
        ...prev.selectedMediums,
        [source]: [medium]
      }
    }));
    addUserMessage(medium.charAt(0).toUpperCase() + medium.slice(1));

    setTimeout(() => {
      // Check if there are auto-suggestions for this source-medium combo
      const matchingTemplate = sourceTemplates.find(
        template => template.sourceName === source && template.mediumName === medium
      );

      if (matchingTemplate && matchingTemplate.contentSuggestions && matchingTemplate.contentSuggestions.length > 0) {
        const contentOptions = matchingTemplate.contentSuggestions.map(suggestion => ({
          label: suggestion,
          value: suggestion,
          action: () => selectContent(source, medium, suggestion)
        }));

        addBotMessage(
          `Excellent! For ${source} ${medium}, I have some content suggestions. Pick one or add your own:`,
          [
            ...contentOptions,
            { label: "Add Custom Content", value: "custom-content", action: () => promptForCustomContent(source, medium) }
          ],
          'content'
        );
      } else {
        promptForCustomContent(source, medium);
      }
    }, 500);
  };



  const promptForCustomSource = () => {
    addBotMessage(
      "What's the name of your custom traffic source?",
      [],
      'sources',
      true,
      "Enter custom source name (e.g., 'newsletter')"
    );
  };

  const promptForCustomMedium = (source: string) => {
    addBotMessage(
      `What type of medium will you use for ${source}?`,
      [],
      'mediums',
      true,
      "Enter medium type (e.g., 'email', 'banner', 'post')"
    );
  };



  const showContentSelectionWithState = async (currentCampaignData: CampaignData) => {
    setCurrentStep('content');
    
    // Collect all source-medium combinations from the passed campaign data
    const sourceMediumCombinations = [];
    for (const source of currentCampaignData.selectedSources) {
      const mediums = currentCampaignData.selectedMediums[source] || [];
      for (const medium of mediums) {
        sourceMediumCombinations.push({ source, medium });
      }
    }
    
    if (sourceMediumCombinations.length === 0) {
      addBotMessage("No source-medium combinations found. Please go back and select sources and mediums.");
      return;
    }

    // Fetch content suggestions for first combination only
    const firstCombination = sourceMediumCombinations[0];
    const { source, medium } = firstCombination;
    
    try {
      console.log(`Fetching content suggestions for ${source}-${medium}...`);
      const suggestions = await fetchContentSuggestions(source, medium);
      console.log(`Successfully fetched content for ${source}-${medium}:`, suggestions);
      
      if (suggestions.length > 0) {
        const contentOptions = suggestions.map(content => ({
          label: content,
          value: content,
          action: () => selectContent(source, medium, content)
        }));

        addBotMessage(
          `🎨 Select content variations for ${source} → ${medium} (choose multiple if needed):`,
          [
            ...contentOptions,
            { label: "Add Custom Content", value: "custom-content", action: () => promptForCustomContent(source, medium) },
            { label: "Continue to Terms", value: "continue-terms", action: () => showContentSelectedAndContinue(), isPrimary: true }
          ],
          'content'
        );
      } else {
        // No suggestions, go straight to custom content
        promptForCustomContent(source, medium);
      }
    } catch (error) {
      console.error(`Error fetching content for ${source}-${medium}:`, error);
      // No suggestions available, allow custom content only
      addBotMessage(
        `🎨 No content suggestions found for ${source} → ${medium}. Please add custom content:`,
        [
          { label: "Add Custom Content", value: "custom-content", action: () => promptForCustomContent(source, medium) },
          { label: "Skip Content", value: "skip-content", action: () => showTermSelection() }
        ],
        'content'
      );
    }
  };

  const selectContent = (source: string, medium: string, content: string) => {
    setCampaignData(prev => {
      const key = `${source}-${medium}`;
      const existingContent = prev.selectedContent[key] || [];
      
      // Toggle content selection (add if not selected, remove if already selected)
      let updatedContent;
      if (!existingContent.includes(content)) {
        updatedContent = [...existingContent, content];
      } else {
        // Remove content if already selected
        updatedContent = existingContent.filter(c => c !== content);
      }
      
      const newCampaignData = {
        ...prev,
        selectedContent: {
          ...prev.selectedContent,
          [key]: updatedContent
        }
      };
      
      // Update the content selection display immediately with new state
      setTimeout(() => {
        updateContentSelectionOptionsWithState(source, medium, newCampaignData);
      }, 50);
      
      return newCampaignData;
    });
  };

  const updateContentSelectionOptionsWithState = async (source: string, medium: string, currentState: CampaignData) => {
    const key = `${source}-${medium}`;
    const selectedContent = currentState.selectedContent[key] || [];
    
    // Get content suggestions
    let suggestions = [];
    try {
      suggestions = await fetchContentSuggestions(source, medium);
    } catch (error) {
      console.error(`Error fetching content suggestions:`, error);
    }
    
    // Find and update the last content selection message
    setMessages(prevMessages => {
      const lastContentIndex = prevMessages.findLastIndex(msg => 
        msg.type === 'bot' && msg.content.includes('Select content variations')
      );
      
      if (lastContentIndex >= 0) {
        const updatedMessages = [...prevMessages];
        
        // Create all content options (both selected and unselected)
        const allContentOptions = suggestions.map(content => ({
          label: content,
          value: content,
          action: () => selectContent(source, medium, content),
          isSelected: selectedContent.includes(content)
        }));

        const options = [
          ...allContentOptions,
          { label: "Add Custom Content", value: "custom-content", action: () => promptForCustomContent(source, medium) },
          { label: "Continue to Terms", value: "continue-terms", action: () => showContentSelectedAndContinue(), isPrimary: true }
        ];

        updatedMessages[lastContentIndex] = {
          ...updatedMessages[lastContentIndex],
          options: options
        };
        return updatedMessages;
      }
      return prevMessages;
    });
  };

  const showContentSelectedAndContinue = () => {
    // Get all selected content across all source-medium combinations
    const contentSummary = Object.entries(campaignData.selectedContent)
      .filter(([key, content]) => content.length > 0)
      .map(([key, content]) => {
        const [source, medium] = key.split('-');
        return `${source}-${medium}: ${content.join(', ')}`;
      })
      .join('; ');
    
    if (contentSummary) {
      addUserMessage(`Selected content: ${contentSummary}`);
    }
    
    setTimeout(() => {
      showTermSelection();
    }, 500);
  };

  const promptForCustomContent = (source: string, medium: string) => {
    // Store the current source and medium for later use
    setCurrentSourceMedium({ source, medium });
    addBotMessage(
      `Enter your custom content variation for ${source} → ${medium} (e.g., 'banner-ad', 'text-link', 'cta-button'):`,
      [],
      'content',
      true,
      "Enter content variation (letters, numbers, hyphens, underscores)"
    );
  };

  const showContentSelection = async () => {
    // Fallback for legacy calls, use current campaign data
    showContentSelectionWithState(campaignData);
  };

  const showContentModification = () => {
    // For now, just allow proceeding - future enhancement could add content modification
    addBotMessage(
      "Content modification will be available in a future update. For now, you can continue with the auto-selected content.",
      [
        { label: "Continue with Auto-Selected Content", value: "continue", action: () => showTermSelection(), isPrimary: true }
      ]
    );
  };

  const showTermSelection = async () => {
    setCurrentStep('terms');
    
    try {
      const termSuggestions = await fetchTermSuggestions();
      
      if (termSuggestions.length > 0) {
        // Create clean, direct term options without lengthy explanations
        const termOptions = termSuggestions.slice(0, 10).map(term => ({
          label: term.termValue,
          value: term.termValue,
          action: () => selectTerm(term.termValue)
        }));

        addBotMessage(
          "🎯 Select terms for tracking (choose multiple if needed):",
          [
            ...termOptions,
            { label: "Add Custom Term", value: "custom-term", action: () => promptForCustomTerm() },
            { label: "Skip Terms", value: "skip-terms", action: () => showTagSelection() }
          ],
          'terms'
        );
      } else {
        addBotMessage(
          "Would you like to add terms for tracking?",
          [
            { label: "Add Custom Term", value: "custom-term", action: () => promptForCustomTerm() },
            { label: "Skip Terms", value: "skip-terms", action: () => showTagSelection() }
          ],
          'terms'
        );
      }
    } catch (error) {
      console.error('Error fetching term suggestions:', error);
      addBotMessage(
        "Would you like to add terms for tracking?",
        [
          { label: "Add Custom Term", value: "custom-term", action: () => promptForCustomTerm() },
          { label: "Skip Terms", value: "skip-terms", action: () => showTagSelection() }
        ],
        'terms'
      );
    }
  };

  const selectTerm = (termValue: string) => {
    setCampaignData(prev => {
      const newCampaignData = { ...prev };
      
      // Initialize selectedTerm if it doesn't exist
      if (!newCampaignData.selectedTerm) {
        newCampaignData.selectedTerm = {};
      }

      // Apply the term to all source-medium combinations
      for (const source of newCampaignData.selectedSources) {
        const mediums = newCampaignData.selectedMediums[source] || [];
        for (const medium of mediums) {
          const key = `${source}-${medium}`;
          if (!newCampaignData.selectedTerm[key]) {
            newCampaignData.selectedTerm[key] = [];
          }
          // Add term if not already selected
          if (!newCampaignData.selectedTerm[key].includes(termValue)) {
            newCampaignData.selectedTerm[key].push(termValue);
          }
        }
      }
      
      console.log('ChatWizard - selectTerm:', termValue, 'newSelectedTerm:', newCampaignData.selectedTerm);
      return newCampaignData;
    });
    
    // DON'T add user message here - just update the options
    // Update the term selection display without summary message
    setTimeout(() => {
      updateTermSelectionOptions();
    }, 100);
  };

  const updateTermSelectionOptions = async () => {
    const currentData = campaignData;
    
    // Show selected terms
    const selectedTerms = Object.values(currentData.selectedTerm || {}).flat();
    const uniqueTerms = [...new Set(selectedTerms)];
    
    // Get term suggestions for remaining options
    const termSuggestions = await fetchTermSuggestions();
    
    // Find and update the last term selection message
    setMessages(prevMessages => {
      const lastTermIndex = prevMessages.findLastIndex(msg => 
        msg.type === 'bot' && msg.content.includes('Select terms')
      );
      
      if (lastTermIndex >= 0) {
        const updatedMessages = [...prevMessages];
        
        // Create new options showing selected terms without checkmarks
        const selectedOptions = uniqueTerms.map(term => ({
          label: term,
          value: term,
          action: () => {}, // No action for selected terms
          isSelected: true
        }));

        // Get remaining term options (not selected)
        const remainingTermOptions = termSuggestions
          .filter(term => !uniqueTerms.includes(term.termValue))
          .slice(0, 6)
          .map(term => ({
            label: term.termValue,
            value: term.termValue,
            action: () => selectTerm(term.termValue)
          }));

        const options = [
          ...selectedOptions,
          ...remainingTermOptions,
          { label: "Add Custom Term", value: "custom-term", action: () => promptForCustomTerm() },
          { label: "Continue to Tags", value: "continue-tags", action: () => showTermsSelectedAndContinue(), isPrimary: true }
        ];

        updatedMessages[lastTermIndex] = {
          ...updatedMessages[lastTermIndex],
          options: options
        };
        return updatedMessages;
      }
      return prevMessages;
    });
  };

  const showTermsSelectedAndContinue = () => {
    const selectedTerms = Object.values(campaignData.selectedTerm || {}).flat();
    const uniqueTerms = [...new Set(selectedTerms)];
    
    if (uniqueTerms.length > 0) {
      addUserMessage(`Selected terms: ${uniqueTerms.join(', ')}`);
    }
    
    setTimeout(() => {
      showTagSelection();
    }, 500);
  };

  const promptForCustomTerm = () => {
    addBotMessage(
      "Enter your custom term (e.g., 'summer-sale', 'mobile-users', 'test-a'):",
      [],
      'terms',
      true,
      "Enter term value (letters, numbers, hyphens, underscores)"
    );
  };

  const showTagSelection = () => {
    if (tags.length > 0) {
      const tagOptions = tags.map(tag => ({
        label: tag.name,
        value: tag.name,
        action: () => selectTag(tag.name)
      }));

      addBotMessage(
        "Almost done! Let's add some tags to organize your campaign. Choose from existing tags or create new ones:",
        [
          ...tagOptions,
          { label: "Add Custom Tag", value: "custom-tag", action: () => promptForCustomTag() },
          { 
            label: campaignData.isExistingCampaign ? "Skip Tags & Add Links" : "Skip Tags", 
            value: "skip-tags", 
            action: () => showReview(), 
            disabled: isCreatingCampaign 
          }
        ],
        'tags'
      );
    } else {
      addBotMessage(
        "Would you like to add tags to organize your campaign?",
        [
          { label: "Add Tag", value: "add-tag", action: () => promptForCustomTag() },
          { 
            label: campaignData.isExistingCampaign ? "Skip Tags & Add Links" : "Skip Tags", 
            value: "skip", 
            action: () => showReview(), 
            disabled: isCreatingCampaign 
          }
        ],
        'tags'
      );
    }
  };

  const selectTag = (tagName: string) => {
    setCampaignData(prev => {
      const updatedData = {
        ...prev,
        selectedTags: [...prev.selectedTags, tagName]
      };
      
      // Use setTimeout to ensure state update is completed
      setTimeout(() => {
        const buttonLabel = updatedData.isExistingCampaign ? "Add Links to Campaign" : "Create Campaign";
        
        addBotMessage(
          `✅ Tag "${tagName}" added! Ready to review your campaign?`,
          [
            { label: "Add Another Tag", value: "add-tag", action: () => showTagSelection() },
            { label: "Review Campaign", value: "review", action: () => showReview(), isPrimary: true }
          ]
        );
      }, 500);
      
      return updatedData;
    });
    addUserMessage(tagName);
  };

  const promptForCustomTag = () => {
    addBotMessage(
      "What would you like to name your new tag?",
      [],
      'tags',
      true,
      "Enter tag name (e.g., 'summer-campaign')"
    );
  };

  const showFinalOptions = () => {
    const successMessage = campaignData.isExistingCampaign 
      ? "🎉 Your links have been added to your campaign successfully! What would you like to do next?"
      : "🎉 Your campaign has been created successfully! What would you like to do next?";
      
    addBotMessage(
      successMessage,
      [
        { label: "View Campaign", value: "view", action: () => navigateToCampaignManagement(), isPrimary: true },
        { label: "Copy Campaign Links", value: "copy", action: () => copyCampaignLinks() }
      ],
      'final'
    );
  };

  const navigateToCampaignManagement = () => {
    addUserMessage("View Campaign");
    addBotMessage("Taking you to the Campaign Management page...");
    setTimeout(() => {
      // Pass the campaign name as a URL parameter for auto-expansion
      const encodedCampaignName = encodeURIComponent(campaignData.name);
      window.location.href = `/campaigns?expand=${encodedCampaignName}`;
    }, 1000);
  };

  const copyCampaignLinks = () => {
    addUserMessage("Copy Campaign Links");
    
    // Generate all UTM links organized by source
    const linksBySource: { [sourceName: string]: Array<{ fullUtmLink: string; utm_medium: string; utm_content: string; }> } = {};
    
    for (const source of campaignData.selectedSources) {
      linksBySource[source] = [];
      const mediums = campaignData.selectedMediums[source] || ['cpc'];
      for (const medium of mediums) {
        const contentKey = `${source}-${medium}`;
        const contentOptions = campaignData.selectedContent[contentKey] || ['default'];
        
        // Create UTM links for each content variation
        for (const content of contentOptions) {
          for (const landingPage of campaignData.landingPages) {
            const selectedTermForKey = campaignData.selectedTerm[contentKey] || '';
            
            const fullUtmLink = generateUTMLink(
              landingPage.url,
              source,
              medium, 
              campaignData.name,
              content,
              selectedTermForKey
            );
            linksBySource[source].push({
              fullUtmLink,
              utm_medium: medium,
              utm_content: content
            });
          }
        }
      }
    }

    // Format links to match Campaign Management page format
    let copyText = `Campaign: ${campaignData.name}\n`;
    
    Object.entries(linksBySource).forEach(([sourceName, sourceLinks], index) => {
      copyText += `Source: ${sourceName}\n\n`;
      sourceLinks.forEach(link => {
        const linkName = `${sourceName} ${link.utm_medium.charAt(0).toUpperCase() + link.utm_medium.slice(1)} ${link.utm_content || ''}`.trim();
        copyText += `${linkName} - ${link.fullUtmLink}\n`;
      });
      
      // Add extra line break between sources, but not after the last one
      if (index < Object.entries(linksBySource).length - 1) {
        copyText += '\n';
      }
    });

    // Count total links
    const totalLinks = Object.values(linksBySource).reduce((sum, links) => sum + links.length, 0);
    
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(copyText).then(() => {
        addBotMessage(
          `✅ Copied ${totalLinks} UTM links to clipboard! Taking you back to the home page...`,
          [
            { label: "Back to Home", value: "home", action: () => navigateToHome() }
          ]
        );
      }).catch((err) => {
        console.error('Failed to copy to clipboard:', err);
        addBotMessage(
          `Here are your ${totalLinks} UTM links:\n\n${copyText}`,
          [
            { label: "Back to Home", value: "home", action: () => navigateToHome() }
          ]
        );
      });
    } else {
      // Fallback for non-secure contexts
      addBotMessage(
        `Here are your ${totalLinks} UTM links:\n\n${copyText}`,
        [
          { label: "Back to Home", value: "home", action: () => navigateToHome() }
        ]
      );
    }
  };

  const navigateToHome = () => {
    addUserMessage("Back to Home");
    addBotMessage("Taking you back to the home page...");
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  };

  const showReview = () => {
    // Use functional update to get latest campaignData
    setCampaignData(currentData => {
      const summary = `
📋 **Campaign Summary:**

**Type:** ${currentData.isExistingCampaign ? 'Adding to existing campaign' : 'New campaign'}
**Name:** ${currentData.name}
**Landing Pages:** ${currentData.landingPages.map(lp => lp.url).join(', ')}
**Sources:** ${currentData.selectedSources.join(', ')}
**Tags:** ${currentData.selectedTags.length > 0 ? currentData.selectedTags.join(', ') : 'None'}

This will create ${(() => {
  let totalLinks = 0;
  currentData.selectedSources.forEach(source => {
    const mediums = currentData.selectedMediums[source] || [];
    mediums.forEach(medium => {
      const key = `${source}-${medium}`;
      const contentVariations = currentData.selectedContent[key] || ['default'];
      const termVariations = currentData.selectedTerm?.[key] || [''];  // Include terms in calculation
      
      // Each combination of content × term × landing page creates a separate UTM link
      totalLinks += contentVariations.length * termVariations.length * currentData.landingPages.length;
    });
  });
  return totalLinks;
})()} UTM link(s) for your campaign.
      `;

      const buttonLabel = currentData.isExistingCampaign ? "Add Links to Campaign" : "Create Campaign";

      addBotMessage(
        summary,
        [
          { 
            label: buttonLabel, 
            value: "create", 
            action: () => createCampaign() 
          },
          { label: "Make Changes", value: "edit", action: () => restartWizard() }
        ],
        'review'
      );
      
      return currentData; // Return unchanged data
    });
  };

  const createCampaign = () => {
    if (isCreatingCampaign) {
      return; // Prevent duplicate campaign creation
    }
    
    // Use functional update to get the most current campaign data
    setCampaignData(currentCampaignData => {
      // Validate campaign data before proceeding
      if (!currentCampaignData.name || currentCampaignData.name.trim() === '') {
        addBotMessage("❌ Campaign name is required. Please provide a campaign name first.", [
          { label: "Start Over", value: "restart", action: () => restartWizard() }
        ]);
        return currentCampaignData;
      }
      
      if (currentCampaignData.landingPages.length === 0) {
        addBotMessage("❌ At least one landing page is required. Please add a landing page first.", [
          { label: "Start Over", value: "restart", action: () => restartWizard() }
        ]);
        return currentCampaignData;
      }
      
      if (currentCampaignData.selectedSources.length === 0) {
        addBotMessage("❌ At least one source is required. Please select a source first.", [
          { label: "Start Over", value: "restart", action: () => restartWizard() }
        ]);
        return currentCampaignData;
      }
      
      setIsCreatingCampaign(true);
      const creatingMessage = currentCampaignData.isExistingCampaign ? "Adding links to your campaign... 🚀" : "Creating your campaign... 🚀";
      addBotMessage(creatingMessage);
      
      // Proceed with campaign creation using the current data
      proceedWithCampaignCreation(currentCampaignData);
      
      return currentCampaignData;
    });
  };
  
  const proceedWithCampaignCreation = (currentCampaignData: CampaignData) => {
    console.log('ChatWizard - proceedWithCampaignCreation - currentCampaignData.selectedTerm:', currentCampaignData.selectedTerm);

    // Transform campaign data to match API format
    const utmLinks = [];
    for (const source of currentCampaignData.selectedSources) {
      const mediums = currentCampaignData.selectedMediums[source] || ['cpc'];
      for (const medium of mediums) {
        const contentKey = `${source}-${medium}`;
        const contentOptions = currentCampaignData.selectedContent[contentKey] || ['default'];
        
        // Create UTM links for each content variation
        for (const content of contentOptions) {
          for (const landingPage of currentCampaignData.landingPages) {
            const selectedTermsForKey = currentCampaignData.selectedTerm[contentKey] || [];
            console.log('ChatWizard - selectedTermsForKey for', contentKey, ':', selectedTermsForKey);
            
            // If no terms selected, create one link with empty term
            if (selectedTermsForKey.length === 0) {
              const fullUtmLink = generateUTMLink(
                landingPage.url,
                source,
                medium, 
                currentCampaignData.name,
                content,
                ''
              );
              
              utmLinks.push({
                userId: user.id,
                accountId: user.accountId,
                targetUrl: landingPage.url,
                fullUtmLink,
                utm_campaign: currentCampaignData.name,
                utm_source: source,
                utm_medium: medium,
                utm_content: content,
                utm_term: '',
                tags: currentCampaignData.selectedTags
              });
            } else {
              // Create a separate UTM link for each selected term
              for (const term of selectedTermsForKey) {
                const fullUtmLink = generateUTMLink(
                  landingPage.url,
                  source,
                  medium, 
                  currentCampaignData.name,
                  content,
                  term
                );
                
                utmLinks.push({
                  userId: user.id,
                  accountId: user.accountId,
                  targetUrl: landingPage.url,
                  fullUtmLink,
                  utm_campaign: currentCampaignData.name,
                  utm_source: source,
                  utm_medium: medium,
                  utm_content: content,
                  utm_term: term,
                  tags: currentCampaignData.selectedTags
                });
              }
            }
          }
        }
      }
    }

    // Also create landing pages
    const landingPagesToCreate = currentCampaignData.landingPages.map(lp => ({
      userId: user.id,
      accountId: user.accountId,
      campaignName: currentCampaignData.name,
      url: lp.url,
      label: lp.label
    }));

    createCampaignMutation.mutate({
      utmLinks,
      landingPages: landingPagesToCreate
    });
  };

  const restartWizard = () => {
    setMessages([]);
    setCurrentStep('welcome');
    setIsCreatingCampaign(false);
    setCampaignData({
      name: '',
      isExistingCampaign: false,
      landingPages: [],
      selectedSources: [],
      selectedMediums: {},
      contentInputs: {},
      selectedContent: {},
      selectedTerm: {},
      selectedTags: []
    });
  };

  const handleSendMessage = () => {
    if (currentInput.trim()) {
      handleUserInput(currentInput.trim());
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="flex-shrink-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Campaign Chat Wizard
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 pb-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-2 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.type === 'user' ? 'bg-primary text-white' : 'bg-gray-100'
                  }`}>
                    {message.type === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className="space-y-2">
                    <div className={`p-3 rounded-lg ${
                      message.type === 'user' 
                        ? 'bg-primary text-white' 
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <div 
                        className="text-sm whitespace-pre-line"
                        dangerouslySetInnerHTML={{
                          __html: message.content
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        }}
                      />
                    </div>
                    
                    {message.options && message.options.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {message.options.map((option, index) => (
                          <Button
                            key={index}
                            variant={option.isPrimary ? "default" : option.isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={option.action}
                            className={`text-xs ${
                              option.isPrimary 
                                ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white border-none' 
                                : option.isSelected 
                                  ? 'bg-green-500 hover:bg-green-600 text-white border-none cursor-default' 
                                  : ''
                            }`}
                            disabled={option.disabled}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex gap-2 max-w-[80%]">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-gray-100 text-gray-900 p-3 rounded-lg">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
        {/* Input Area */}
        {currentStep !== 'complete' && (
          <div className="flex-shrink-0 p-4 border-t">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                placeholder="Type your message..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isTyping || createCampaignMutation.isPending}
              />
              <Button 
                onClick={handleSendMessage}
                disabled={!currentInput.trim() || isTyping || createCampaignMutation.isPending}
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}