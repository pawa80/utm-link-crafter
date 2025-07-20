import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useCharacterCount, useUtmParameterValidation } from "../../hooks/useValidation";

interface TermTemplate {
  id: number;
  termValue: string;
  description?: string;
  category: string;
  isCustom: boolean;
}

interface TermTemplateInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  className?: string;
  label?: string;
  required?: boolean;
}

export function TermTemplateInput({
  value,
  onChange,
  error,
  placeholder = "Enter term or select from templates",
  className,
  label = "UTM Term",
  required = false
}: TermTemplateInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Character count and validation
  const characterInfo = useCharacterCount(value, 100);
  const validation = useUtmParameterValidation(value, 'term');

  // Fetch term templates
  const { data: termTemplates = [], isLoading } = useQuery({
    queryKey: ['/api/term-templates', selectedCategory === 'all' ? undefined : selectedCategory],
    queryFn: async () => {
      const params = selectedCategory !== 'all' ? `?category=${selectedCategory}` : '';
      const response = await fetch(`/api/term-templates${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}`,
          'x-firebase-uid': localStorage.getItem('firebaseUid') || '',
        }
      });
      if (!response.ok) throw new Error('Failed to fetch term templates');
      return response.json() as TermTemplate[];
    }
  });

  // Group templates by category
  const templatesByCategory = termTemplates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, TermTemplate[]>);

  const categories = Object.keys(templatesByCategory).sort();

  const handleTemplateSelect = (template: TermTemplate) => {
    onChange(template.termValue);
    setShowDropdown(false);
  };

  const getTemplateBadgeColor = (template: TermTemplate) => {
    if (template.isCustom) {
      return "bg-blue-100 text-blue-800 border-blue-300";
    }
    return "bg-green-100 text-green-800 border-green-300";
  };

  const getCategoryBadgeColor = (category: string) => {
    const colors = {
      keywords: "bg-purple-100 text-purple-800",
      testing: "bg-orange-100 text-orange-800",
      audience: "bg-cyan-100 text-cyan-800",
      general: "bg-gray-100 text-gray-800"
    };
    return colors[category as keyof typeof colors] || colors.general;
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <div className="flex items-center space-x-2">
          <div className="flex-1">
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className={cn(
                "pr-10",
                error && "border-destructive focus-visible:ring-destructive",
                className
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border rounded-md shadow-lg max-h-80 overflow-y-auto">
            <div className="p-3 border-b">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Term Templates</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDropdown(false)}
                >
                  ✕
                </Button>
              </div>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="keywords">Keywords</SelectItem>
                  <SelectItem value="testing">A/B Testing</SelectItem>
                  <SelectItem value="audience">Audience</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-2">
              {isLoading ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Loading templates...
                </div>
              ) : termTemplates.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No templates found
                </div>
              ) : (
                categories.map(category => (
                  <div key={category} className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getCategoryBadgeColor(category)}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ({templatesByCategory[category].length} templates)
                      </span>
                    </div>
                    
                    <div className="grid gap-1">
                      {templatesByCategory[category].map(template => (
                        <Button
                          key={template.id}
                          type="button"
                          variant="ghost"
                          className="h-auto p-2 justify-start text-left hover:bg-muted"
                          onClick={() => handleTemplateSelect(template)}
                        >
                          <div className="flex items-start justify-between w-full">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{template.termValue}</span>
                                <Badge
                                  variant="outline"
                                  className={cn("text-xs", getTemplateBadgeColor(template))}
                                >
                                  {template.isCustom ? "Custom" : "Base"}
                                </Badge>
                              </div>
                              {template.description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {template.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error message and character count */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}
          {!error && (
            <p className="text-xs text-muted-foreground">
              Optional: Add specific terms, keywords, or testing variants
            </p>
          )}
        </div>
        
        <div className={cn(
          "text-sm transition-colors ml-2 flex-shrink-0",
          characterInfo.isOverLimit ? "text-destructive" : 
          characterInfo.remaining <= 10 ? "text-orange-500" : "text-muted-foreground"
        )}>
          {characterInfo.count}/100
          {characterInfo.isOverLimit && (
            <span className="ml-1 font-medium">
              ({Math.abs(characterInfo.remaining)} over)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}