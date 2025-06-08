import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, ArrowRight, ArrowLeft, CheckCircle, Plus, X } from "lucide-react";
import type { User } from "@shared/schema";

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

interface PredefinedSource {
  name: string;
  mediums: string[];
  formats: string[];
}

interface SelectedSource {
  sourceName: string;
  mediums: string[];
  formats: string[];
  abTestingPreference: number;
}

const PREDEFINED_SOURCES: PredefinedSource[] = [
  {
    name: "Facebook",
    mediums: ["social", "cpc", "cpm"],
    formats: ["video", "carousel", "single-image", "story"]
  },
  {
    name: "Google Ads",
    mediums: ["cpc", "display", "search"],
    formats: ["300x250", "728x90", "160x600", "text-ad"]
  },
  {
    name: "LinkedIn",
    mediums: ["social", "cpc", "sponsored"],
    formats: ["single-image", "carousel", "video", "text-ad"]
  },
  {
    name: "Instagram",
    mediums: ["social", "story", "reel"],
    formats: ["square", "story", "reel", "carousel"]
  },
  {
    name: "Twitter",
    mediums: ["social", "promoted"],
    formats: ["single-image", "video", "carousel", "text"]
  },
  {
    name: "Amazon",
    mediums: ["cpc", "display", "sponsored"],
    formats: ["product", "brand", "video", "display"]
  },
  {
    name: "Email Marketing",
    mediums: ["email", "newsletter"],
    formats: ["html", "text", "automated", "campaign"]
  },
  {
    name: "Content Marketing",
    mediums: ["organic", "blog", "content"],
    formats: ["article", "whitepaper", "ebook", "infographic"]
  }
];

export default function OnboardingWizard({ isOpen, onClose, user }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [customSource, setCustomSource] = useState("");
  const [customSources, setCustomSources] = useState<string[]>([]);
  const [sourceConfigs, setSourceConfigs] = useState<Record<string, SelectedSource>>({});
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const totalSteps = 4;
  const allSources = [...selectedSources, ...customSources];

  const createSourceTemplatesMutation = useMutation({
    mutationFn: async (templates: any[]) => {
      const promises = templates.map(template => 
        apiRequest("POST", "/api/source-templates", template)
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/source-templates"] });
      toast({
        title: "Setup Complete!",
        description: "Your source templates have been created successfully",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create source templates",
        variant: "destructive",
      });
    },
  });

  const handleSourceSelection = (sourceName: string, checked: boolean) => {
    if (checked) {
      setSelectedSources([...selectedSources, sourceName]);
    } else {
      setSelectedSources(selectedSources.filter(s => s !== sourceName));
      delete sourceConfigs[sourceName];
    }
  };

  const addCustomSource = () => {
    if (customSource.trim() && !customSources.includes(customSource.trim())) {
      setCustomSources([...customSources, customSource.trim()]);
      setCustomSource("");
    }
  };

  const removeCustomSource = (sourceName: string) => {
    setCustomSources(customSources.filter(s => s !== sourceName));
    delete sourceConfigs[sourceName];
  };

  const handleAbTestingPreference = (sourceName: string, preference: string) => {
    const predefinedSource = PREDEFINED_SOURCES.find(s => s.name === sourceName);
    const config: SelectedSource = {
      sourceName: sourceName,
      mediums: predefinedSource?.mediums || [],
      formats: predefinedSource?.formats || [],
      abTestingPreference: parseInt(preference)
    };
    setSourceConfigs({
      ...sourceConfigs,
      [sourceName]: config
    });
  };

  const handleSkipSetup = () => {
    // Create basic defaults
    const basicTemplates = [
      {
        sourceName: "Google",
        mediums: ["cpc", "display"],
        formats: ["text", "banner"],
        abTestingPreference: 1
      },
      {
        sourceName: "Social Media",
        mediums: ["social", "organic"],
        formats: ["post", "story"],
        abTestingPreference: 1
      }
    ];

    createSourceTemplatesMutation.mutate(basicTemplates);
  };

  const handleComplete = () => {
    const templates = allSources.map(sourceName => {
      const config = sourceConfigs[sourceName];
      if (config) {
        return config;
      }
      
      // Handle custom sources without predefined config
      return {
        sourceName,
        mediums: [],
        formats: [],
        abTestingPreference: 1
      };
    });

    createSourceTemplatesMutation.mutate(templates);
  };

  const nextStep = () => {
    if (step === 2 && allSources.length === 0) {
      toast({
        title: "No Sources Selected",
        description: "Please select at least one source or skip setup",
        variant: "destructive",
      });
      return;
    }
    setStep(step + 1);
  };

  const prevStep = () => setStep(step - 1);

  const getCurrentSource = () => allSources[currentSourceIndex];
  const isLastSource = currentSourceIndex === allSources.length - 1;

  const nextSource = () => {
    const currentSource = getCurrentSource();
    if (!sourceConfigs[currentSource]) {
      toast({
        title: "Please Select A/B Testing Preference",
        description: "Choose how you plan to test this source",
        variant: "destructive",
      });
      return;
    }
    
    if (isLastSource) {
      setStep(4);
    } else {
      setCurrentSourceIndex(currentSourceIndex + 1);
    }
  };

  const prevSource = () => {
    if (currentSourceIndex === 0) {
      setStep(2);
      setCurrentSourceIndex(0);
    } else {
      setCurrentSourceIndex(currentSourceIndex - 1);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Sparkles className="text-primary mr-2" size={24} />
            Welcome to UTM Builder
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Progress value={(step / totalSteps) * 100} className="w-full" />

          {/* Step 1: Welcome */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Let's set up your common sources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-600">
                  We'll help you create templates for the marketing sources you use most often. 
                  This will make creating UTM links much faster.
                </p>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={handleSkipSetup}>
                    Skip Setup
                  </Button>
                  <Button onClick={nextStep}>
                    Get Started
                    <ArrowRight className="ml-2" size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Source Selection */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Select your marketing sources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {PREDEFINED_SOURCES.map((source) => (
                    <div key={source.name} className="flex items-center space-x-2">
                      <Checkbox
                        id={source.name}
                        checked={selectedSources.includes(source.name)}
                        onCheckedChange={(checked) => 
                          handleSourceSelection(source.name, checked as boolean)
                        }
                      />
                      <Label htmlFor={source.name} className="font-medium">
                        {source.name}
                      </Label>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4">
                  <Label className="text-sm font-medium mb-2 block">
                    Add custom source
                  </Label>
                  <div className="flex space-x-2">
                    <Input
                      value={customSource}
                      onChange={(e) => setCustomSource(e.target.value)}
                      placeholder="Enter custom source name"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomSource();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addCustomSource}
                      disabled={!customSource.trim()}
                    >
                      <Plus size={16} />
                    </Button>
                  </div>
                  
                  {customSources.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {customSources.map((source) => (
                        <div key={source} className="flex items-center justify-between">
                          <Badge variant="outline">{source}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCustomSource(source)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X size={14} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={prevStep}>
                    <ArrowLeft className="mr-2" size={16} />
                    Back
                  </Button>
                  <Button onClick={nextStep}>
                    Continue
                    <ArrowRight className="ml-2" size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: A/B Testing Preferences */}
          {step === 3 && allSources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  A/B Testing for {getCurrentSource()}
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Source {currentSourceIndex + 1} of {allSources.length}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-600">
                  Do you A/B test campaigns on {getCurrentSource()}?
                </p>

                <RadioGroup
                  value={sourceConfigs[getCurrentSource()]?.abTestingPreference?.toString() || ""}
                  onValueChange={(value) => handleAbTestingPreference(getCurrentSource(), value)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1" id="no-testing" />
                    <Label htmlFor="no-testing">No - I don't A/B test</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="2" id="ab-testing" />
                    <Label htmlFor="ab-testing">A/B - I test 2 variations</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="3" id="abc-testing" />
                    <Label htmlFor="abc-testing">A/B/C - I test 3+ variations</Label>
                  </div>
                </RadioGroup>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={prevSource}>
                    <ArrowLeft className="mr-2" size={16} />
                    {currentSourceIndex === 0 ? "Back" : "Previous Source"}
                  </Button>
                  <Button onClick={nextSource}>
                    {isLastSource ? "Review" : "Next Source"}
                    <ArrowRight className="ml-2" size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Review and Complete */}
          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="text-green-500 mr-2" size={24} />
                  Ready to create your templates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-600">
                  We'll create templates for these sources:
                </p>
                
                <div className="space-y-2">
                  {allSources.map((sourceName) => {
                    const config = sourceConfigs[sourceName];
                    const abTestingLabels = { 1: "No testing", 2: "A/B testing", 3: "A/B/C testing" };
                    
                    return (
                      <div key={sourceName} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <div>
                          <span className="font-medium">{sourceName}</span>
                          {config && (
                            <span className="text-sm text-gray-600 ml-2">
                              • {abTestingLabels[config.abTestingPreference as keyof typeof abTestingLabels]}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(3)}>
                    <ArrowLeft className="mr-2" size={16} />
                    Back
                  </Button>
                  <Button 
                    onClick={handleComplete}
                    disabled={createSourceTemplatesMutation.isPending}
                  >
                    {createSourceTemplatesMutation.isPending ? "Creating..." : "Complete Setup"}
                    <CheckCircle className="ml-2" size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}