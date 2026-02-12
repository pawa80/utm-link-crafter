import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check, Building2, Users, Target, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface SignUpWizardProps {
  userEmail: string;
  onComplete: (accountData: {
    accountName: string;
    pricingPlanId: number;
    industry?: string;
    teamSize?: string;
    useCases?: string[];
  }) => void;
  onBack: () => void;
}

interface PricingPlan {
  id: number;
  planCode: string;
  planName: string;
  description: string;
  monthlyPriceCents: number;
  annualPriceCents: number | null;
  maxCampaigns: number | null;
  maxUsers: number | null;
  maxUtmLinks: number | null;
  features: Record<string, boolean>;
}

const INDUSTRIES = [
  "E-commerce", "SaaS/Technology", "Marketing Agency", "Media/Publishing",
  "Education", "Healthcare", "Financial Services", "Non-profit",
  "Consulting", "Real Estate", "Travel/Hospitality", "Other"
];

const TEAM_SIZES = [
  "Just me (1)", "Small team (2-5)", "Medium team (6-20)", 
  "Large team (21-50)", "Enterprise (50+)"
];

const USE_CASES = [
  "Campaign tracking", "A/B testing", "Social media marketing",
  "Email marketing", "Affiliate tracking", "Multi-channel attribution",
  "Agency client management", "Other"
];

export default function SignUpWizard({ userEmail, onComplete, onBack }: SignUpWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [accountName, setAccountName] = useState("");
  const [industry, setIndustry] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
  const [customUseCase, setCustomUseCase] = useState("");
  const { toast } = useToast();

  // Get available pricing plans - auto-select free plan
  const { data: pricingPlans = [] } = useQuery({
    queryKey: ['/api/pricing-plans'],
    enabled: true
  });

  // Auto-select free plan (or first available plan)
  const freePlan = Array.isArray(pricingPlans)
    ? pricingPlans.find((p: PricingPlan) => p.planCode === 'free') || pricingPlans[0]
    : null;
  const selectedPlanId = freePlan?.id ?? null;

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  const handleNext = () => {
    if (currentStep === 1 && !accountName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter your account name.",
        variant: "destructive",
      });
      return;
    }
    
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete signup - handle multiple use cases including custom
      let finalUseCases = [...selectedUseCases];
      if (selectedUseCases.includes("Other") && customUseCase.trim()) {
        finalUseCases = finalUseCases.filter(uc => uc !== "Other");
        finalUseCases.push(customUseCase.trim());
      }
      
      onComplete({
        accountName: accountName.trim(),
        pricingPlanId: selectedPlanId!,
        industry: industry || undefined,
        teamSize: teamSize || undefined,
        useCases: finalUseCases.length > 0 ? finalUseCases : undefined
      });
    }
  };

  const toggleUseCase = (useCase: string) => {
    setSelectedUseCases(prev => 
      prev.includes(useCase) 
        ? prev.filter(uc => uc !== useCase)
        : [...prev, useCase]
    );
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      onBack();
    }
  };

  const recommendedPlan = (planCode: string) => {
    if (industry?.includes("Agency") || teamSize?.includes("Enterprise")) return planCode === "enterprise";
    if (teamSize?.includes("Large") || teamSize?.includes("Medium")) return planCode === "professional";
    if (teamSize?.includes("Small")) return planCode === "starter";
    return planCode === "free";
  };

  const steps = [
    { number: 1, title: "Account & Plan", icon: Building2 },
    { number: 2, title: "About You", icon: Users },
    { number: 3, title: "Your Goals", icon: Target }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Progress Steps */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.number;
          const isCompleted = currentStep > step.number;
          
          return (
            <div key={step.number} className="flex items-center">
              <div className={`flex items-center space-x-3 ${
                isActive ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'
              }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                  isActive ? 'border-primary bg-primary/10' : 
                  isCompleted ? 'border-green-600 bg-green-600 text-white' : 
                  'border-muted-foreground/30'
                }`}>
                  {isCompleted ? <Check size={20} /> : <Icon size={20} />}
                </div>
                <div>
                  <p className="font-medium">{step.title}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-16 h-0.5 mx-4 ${
                  isCompleted ? 'bg-green-600' : 'bg-muted-foreground/30'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      <Card className="card-modern shadow-2xl">
        <CardContent className="p-8">
          {/* Step 1: Account & Plan */}
          {currentStep === 1 && (
            <div className="space-y-8">
              <CardHeader className="px-0 pb-6">
                <CardTitle className="text-2xl">Set Up Your Account</CardTitle>
                <p className="text-muted-foreground">Choose a name for your account to get started.</p>
              </CardHeader>

              <div className="space-y-6">
                <div>
                  <Label htmlFor="accountName" className="text-base font-medium">Account Name *</Label>
                  <p className="text-sm text-muted-foreground mb-2">This could be your company name, project name, or any name you prefer</p>
                  <Input
                    id="accountName"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="My Company, Inc."
                    className="text-lg py-3"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: About You */}
          {currentStep === 2 && (
            <div className="space-y-8">
              <CardHeader className="px-0 pb-6">
                <CardTitle className="text-2xl">Tell Us About You</CardTitle>
                <p className="text-muted-foreground">This helps us customize your experience (optional)</p>
              </CardHeader>

              <div className="space-y-6">
                <div>
                  <Label className="text-base font-medium">What industry are you in?</Label>
                  <RadioGroup value={industry} onValueChange={setIndustry} className="mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      {INDUSTRIES.map((ind) => (
                        <div key={ind} className="flex items-center space-x-2">
                          <RadioGroupItem value={ind} id={ind} />
                          <Label htmlFor={ind} className="font-normal">{ind}</Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-base font-medium">What's your team size?</Label>
                  <RadioGroup value={teamSize} onValueChange={setTeamSize} className="mt-3">
                    <div className="space-y-2">
                      {TEAM_SIZES.map((size) => (
                        <div key={size} className="flex items-center space-x-2">
                          <RadioGroupItem value={size} id={size} />
                          <Label htmlFor={size} className="font-normal">{size}</Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Your Goals */}
          {currentStep === 3 && (
            <div className="space-y-8">
              <CardHeader className="px-0 pb-6">
                <CardTitle className="text-2xl">What Are Your Goals?</CardTitle>
                <p className="text-muted-foreground">This helps us recommend the best features for you (optional)</p>
              </CardHeader>

              <div className="space-y-6">
                <div>
                  <Label className="text-base font-medium">What will you use UTM Builder for? (select all that apply)</Label>
                  <div className="mt-3 grid gap-3">
                    {USE_CASES.map((uc) => (
                      <div key={uc} className="flex items-center space-x-2">
                        <Checkbox 
                          id={uc}
                          checked={selectedUseCases.includes(uc)}
                          onCheckedChange={() => toggleUseCase(uc)}
                        />
                        <Label htmlFor={uc} className="font-normal cursor-pointer">{uc}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedUseCases.includes("Other") && (
                  <div>
                    <Label htmlFor="customUseCase" className="text-base font-medium">Please describe your use case</Label>
                    <Textarea
                      id="customUseCase"
                      value={customUseCase}
                      onChange={(e) => setCustomUseCase(e.target.value)}
                      placeholder="Tell us how you plan to use UTM Builder..."
                      className="mt-2"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-8 border-t">
            <Button variant="outline" onClick={handlePrevious}>
              <ArrowLeft size={16} className="mr-2" />
              {currentStep === 1 ? 'Back to Sign In' : 'Previous'}
            </Button>
            
            <Button onClick={handleNext} className="btn-gradient-primary">
              {currentStep === 3 ? (
                <>
                  Complete Setup
                  <Check size={16} className="ml-2" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight size={16} className="ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}