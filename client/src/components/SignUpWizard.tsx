import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
    useCase?: string;
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
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [industry, setIndustry] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [useCase, setUseCase] = useState("");
  const [customUseCase, setCustomUseCase] = useState("");
  const { toast } = useToast();

  // Get available pricing plans
  const { data: pricingPlans, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['/api/pricing-plans'],
    enabled: true
  });

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  const handleNext = () => {
    if (currentStep === 1 && (!accountName.trim() || !selectedPlanId)) {
      toast({
        title: "Missing Information",
        description: "Please enter your account name and select a pricing plan.",
        variant: "destructive",
      });
      return;
    }
    
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete signup
      onComplete({
        accountName: accountName.trim(),
        pricingPlanId: selectedPlanId!,
        industry: industry || undefined,
        teamSize: teamSize || undefined,
        useCase: useCase === "Other" ? customUseCase : useCase || undefined
      });
    }
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
                <p className="text-muted-foreground">Choose your account name and select the perfect plan for your needs.</p>
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

                <div>
                  <Label className="text-base font-medium">Choose Your Plan *</Label>
                  <p className="text-sm text-muted-foreground mb-4">You can upgrade or downgrade anytime</p>
                  
                  {isLoadingPlans ? (
                    <div className="text-center py-8">Loading pricing plans...</div>
                  ) : (
                    <RadioGroup value={selectedPlanId?.toString()} onValueChange={(value) => setSelectedPlanId(parseInt(value))}>
                      <div className="grid gap-4">
                        {pricingPlans?.map((plan: PricingPlan) => (
                          <div key={plan.id} className="relative">
                            <RadioGroupItem value={plan.id.toString()} id={plan.id.toString()} className="sr-only" />
                            <Label
                              htmlFor={plan.id.toString()}
                              className={`block p-6 border-2 rounded-lg cursor-pointer transition-all hover:border-primary/50 ${
                                selectedPlanId === plan.id ? 'border-primary bg-primary/5' : 'border-border'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-2">
                                    <h3 className="font-semibold text-lg">{plan.planName}</h3>
                                    {recommendedPlan(plan.planCode) && (
                                      <Badge className="bg-gradient-to-r from-secondary to-accent text-white">
                                        <Zap size={12} className="mr-1" />
                                        Recommended
                                      </Badge>
                                    )}
                                  </div>
                                  {plan.description && (
                                    <p className="text-muted-foreground mb-3">{plan.description}</p>
                                  )}
                                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                                    {plan.maxCampaigns && <span>• {plan.maxCampaigns} campaigns</span>}
                                    {plan.maxUsers && <span>• {plan.maxUsers} users</span>}
                                    {plan.maxUtmLinks && <span>• {plan.maxUtmLinks} UTM links</span>}
                                    {!plan.maxCampaigns && !plan.maxUsers && !plan.maxUtmLinks && <span>• Unlimited</span>}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold">
                                    {plan.monthlyPriceCents === 0 ? 'Free' : formatPrice(plan.monthlyPriceCents)}
                                  </div>
                                  {plan.monthlyPriceCents > 0 && (
                                    <div className="text-sm text-muted-foreground">/month</div>
                                  )}
                                </div>
                              </div>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  )}
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
                <CardTitle className="text-2xl">What's Your Main Use Case?</CardTitle>
                <p className="text-muted-foreground">This helps us recommend the best features for you (optional)</p>
              </CardHeader>

              <div className="space-y-6">
                <div>
                  <Label className="text-base font-medium">Primary use case</Label>
                  <RadioGroup value={useCase} onValueChange={setUseCase} className="mt-3">
                    <div className="grid gap-3">
                      {USE_CASES.map((uc) => (
                        <div key={uc} className="flex items-center space-x-2">
                          <RadioGroupItem value={uc} id={uc} />
                          <Label htmlFor={uc} className="font-normal">{uc}</Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                </div>

                {useCase === "Other" && (
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