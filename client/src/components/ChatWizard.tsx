import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { generateUTMLink, validateUrl } from "@/lib/utm";
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
  options?: Array<{ label: string; value: string; action?: () => void }>;
  showInput?: boolean;
  inputPlaceholder?: string;
  onInput?: (value: string) => void;
}

interface CampaignData {
  name: string;
  isExistingCampaign: boolean;
  existingCampaignName?: string;
  landingPages: Array<{ id: string; url: string; label: string }>;
  selectedSources: string[];
  selectedMediums: { [source: string]: string[] };
  contentInputs: { [key: string]: string };
  selectedTags: string[];
}

export default function ChatWizard({ user, onComplete }: ChatWizardProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentStep, setCurrentStep] = useState<'welcome' | 'campaign-type' | 'campaign-name' | 'existing-campaign' | 'landing-pages' | 'sources' | 'mediums' | 'content' | 'tags' | 'review' | 'complete'>('welcome');
  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: '',
    isExistingCampaign: false,
    landingPages: [],
    selectedSources: [],
    selectedMediums: {},
    contentInputs: {},
    selectedTags: []
  });
  const [currentInput, setCurrentInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
  const { data: existingCampaigns = [] } = useQuery({
    queryKey: ["/api/utm-links"],
    select: (data: any[]) => {
      const campaignNames = [...new Set(data.map(link => link.utm_campaign))];
      return campaignNames.slice(0, 10); // Get 10 latest campaigns
    }
  });

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: async (campaignData: any) => {
      const response = await apiRequest("POST", "/api/utm-links", campaignData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/utm-links"] });
      addBotMessage("🎉 Your campaign has been created successfully! You can view and manage it from the Campaign Management page.", [], 'complete');
      if (onComplete) {
        setTimeout(onComplete, 2000);
      }
    },
    onError: (error: any) => {
      addBotMessage(`❌ Sorry, there was an error creating your campaign: ${error.message}. Would you like to try again?`, [
        { label: "Try Again", value: "retry", action: () => setCurrentStep('review') },
        { label: "Start Over", value: "restart", action: () => restartWizard() }
      ]);
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
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

  const addBotMessage = (content: string, options: Array<{ label: string; value: string; action?: () => void; isPrimary?: boolean }> = [], nextStep?: string, showInput = false, inputPlaceholder = "", step?: string) => {
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
              "That doesn't look like a valid URL. Please enter a complete URL starting with http:// or https://",
              [],
              'landing-pages',
              true,
              "Enter a valid URL (e.g., 'https://example.com')"
            );
          }, 500);
        }
        break;

      case 'content':
        // Handle content input for specific source-medium combination
        const contentKey = `${campaignData.selectedSources[0]}-${campaignData.selectedMediums[campaignData.selectedSources[0]]?.[0]}`;
        setCampaignData(prev => ({
          ...prev,
          contentInputs: { ...prev.contentInputs, [contentKey]: value }
        }));
        setTimeout(() => {
          showTagSelection();
        }, 500);
        break;

      case 'tags':
        // Handle custom tag input
        if (!tags.find(tag => tag.name.toLowerCase() === value.toLowerCase())) {
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
    setCampaignData(prev => ({ ...prev, name: campaignName, existingCampaignName: campaignName }));
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
      "Enter campaign name (e.g., 'Summer Sale 2025')"
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
      ? "Great! Now let's add landing pages. You can choose from your most-used URLs or add a new one:"
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
      options.push({ label: "Continue to Mediums", value: "continue", action: () => showMediumSelectionForFirstSource(), isPrimary: true });
    }

    addBotMessage(message, options, 'sources');
  };

  const selectSource = (source: string) => {
    setCampaignData(prev => ({
      ...prev,
      selectedSources: [...prev.selectedSources, source]
    }));
    addUserMessage(source.charAt(0).toUpperCase() + source.slice(1));

    // Add a new message showing the selected sources and continue button
    setTimeout(() => {
      const updatedSources = [...campaignData.selectedSources, source];
      const message = `✅ Selected sources: ${updatedSources.join(', ')}. Select additional sources or continue:`;
      
      // Get available sources for remaining options
      const availableSources = [...new Set(sourceTemplates.map(template => template.sourceName))];
      const unselectedSources = availableSources.filter(src => !updatedSources.includes(src));
      
      const sourceOptions = unselectedSources.map(src => ({
        label: src.charAt(0).toUpperCase() + src.slice(1),
        value: src,
        action: () => selectSource(src)
      }));

      const options = [
        ...sourceOptions,
        { label: "Add Custom Source", value: "custom", action: () => promptForCustomSource() },
        { label: "Continue to Mediums", value: "continue", action: () => showMediumSelectionForFirstSource(), isPrimary: true }
      ];

      // Simply add a new message with the continue button
      addBotMessage(message, options, 'sources');
    }, 500);
  };

  const showMediumSelectionForFirstSource = () => {
    const firstSource = campaignData.selectedSources[0];
    
    if (!firstSource) {
      addBotMessage(
        "No sources selected. Please go back and select at least one source.",
        [{ label: "Back to Sources", value: "back", action: () => showSourceSelection() }]
      );
      return;
    }

    const sourceMediums = sourceTemplates
      .filter(template => template.sourceName === firstSource)
      .map(template => template.mediumName)
      .filter(medium => medium && medium.trim()); // Filter out undefined/null/empty values

    if (sourceMediums.length > 0) {
      const mediumOptions = sourceMediums.map(medium => ({
        label: medium.charAt(0).toUpperCase() + medium.slice(1),
        value: medium,
        action: () => selectMedium(firstSource, medium)
      }));

      addBotMessage(
        `Great! For ${firstSource}, which type of marketing medium will you use?`,
        [
          ...mediumOptions,
          { label: "Add Custom Medium", value: "custom-medium", action: () => promptForCustomMedium(firstSource) }
        ],
        'mediums'
      );
    } else {
      promptForCustomMedium(firstSource);
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

  const selectContent = (source: string, medium: string, content: string) => {
    const contentKey = `${source}-${medium}`;
    setCampaignData(prev => ({
      ...prev,
      contentInputs: { ...prev.contentInputs, [contentKey]: content }
    }));
    addUserMessage(content);

    setTimeout(() => {
      showTagSelection();
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

  const promptForCustomContent = (source: string, medium: string) => {
    addBotMessage(
      `What content description would you like for your ${source} ${medium} campaign?`,
      [],
      'content',
      true,
      "Enter content description (e.g., 'summer-sale-banner')"
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
          { label: "Skip Tags", value: "skip-tags", action: () => showReview() }
        ],
        'tags'
      );
    } else {
      addBotMessage(
        "Would you like to add tags to organize your campaign?",
        [
          { label: "Add Tag", value: "add-tag", action: () => promptForCustomTag() },
          { label: "Skip Tags", value: "skip", action: () => showReview() }
        ],
        'tags'
      );
    }
  };

  const selectTag = (tagName: string) => {
    setCampaignData(prev => ({
      ...prev,
      selectedTags: [...prev.selectedTags, tagName]
    }));
    addUserMessage(tagName);

    setTimeout(() => {
      addBotMessage(
        `✅ Tag "${tagName}" added! Ready to review your campaign?`,
        [
          { label: "Add Another Tag", value: "add-tag", action: () => showTagSelection() },
          { label: "Review Campaign", value: "review", action: () => showReview() }
        ]
      );
    }, 500);
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

  const showReview = () => {
    const summary = `
📋 **Campaign Summary:**

**Type:** ${campaignData.isExistingCampaign ? 'Adding to existing campaign' : 'New campaign'}
**Name:** ${campaignData.name}
**Landing Pages:** ${campaignData.landingPages.map(lp => lp.url).join(', ')}
**Sources:** ${campaignData.selectedSources.join(', ')}
**Tags:** ${campaignData.selectedTags.length > 0 ? campaignData.selectedTags.join(', ') : 'None'}

This will create ${campaignData.selectedSources.length * campaignData.landingPages.length} UTM link(s) for your campaign.
    `;

    addBotMessage(
      summary,
      [
        { label: "Create Campaign", value: "create", action: () => createCampaign() },
        { label: "Make Changes", value: "edit", action: () => restartWizard() }
      ],
      'review'
    );
  };

  const createCampaign = () => {
    addBotMessage("Creating your campaign... 🚀");

    // Transform campaign data to match API format
    const utmLinks = [];
    for (const source of campaignData.selectedSources) {
      const mediums = campaignData.selectedMediums[source] || ['cpc'];
      for (const medium of mediums) {
        const contentKey = `${source}-${medium}`;
        const content = campaignData.contentInputs[contentKey] || 'default';
        
        for (const landingPage of campaignData.landingPages) {
          const utmParams = {
            utm_campaign: campaignData.name,
            utm_source: source,
            utm_medium: medium,
            utm_content: content,
            utm_term: null
          };

          const fullUtmLink = generateUTMLink(landingPage.url, utmParams);
          
          utmLinks.push({
            targetUrl: landingPage.url,
            fullUtmLink,
            utm_campaign: campaignData.name,
            utm_source: source,
            utm_medium: medium,
            utm_content: content,
            utm_term: null,
            tags: campaignData.selectedTags
          });
        }
      }
    }

    // Also create landing pages
    const landingPagesToCreate = campaignData.landingPages.map(lp => ({
      campaignName: campaignData.name,
      url: lp.url,
      urlLabel: lp.label
    }));

    createCampaignMutation.mutate({
      utmLinks,
      landingPages: landingPagesToCreate
    });
  };

  const restartWizard = () => {
    setMessages([]);
    setCurrentStep('welcome');
    setCampaignData({
      name: '',
      isExistingCampaign: false,
      landingPages: [],
      selectedSources: [],
      selectedMediums: {},
      contentInputs: {},
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
                      <div className="text-sm whitespace-pre-line">{message.content}</div>
                    </div>
                    
                    {message.options && message.options.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {message.options.map((option, index) => (
                          <Button
                            key={index}
                            variant={option.isPrimary ? "default" : "outline"}
                            size="sm"
                            onClick={option.action}
                            className={`text-xs ${option.isPrimary ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white border-none' : ''}`}
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