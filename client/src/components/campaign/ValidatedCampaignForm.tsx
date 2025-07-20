import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ValidatedInput } from "@/components/ui/character-counter";
import { TermTemplateInput } from "@/components/ui/term-template-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, Plus, AlertCircle, CheckCircle2 } from "lucide-react";
import { useCharacterCount, useUrlValidation, useUtmParameterValidation, useCampaignDuplicateValidation } from "../../hooks/useValidation";
import { validateUrl, sanitizeUtmParameter, generateUTMLink } from "@shared/validation";

interface CampaignFormData {
  campaignName: string;
  landingPageUrls: string[];
  utmLinks: Array<{
    source: string;
    medium: string;
    content: string;
    term: string;
    linkName: string;
  }>;
  tags: string[];
}

interface ValidatedCampaignFormProps {
  initialData?: Partial<CampaignFormData>;
  isEditing?: boolean;
  originalCampaignName?: string;
  existingCampaigns?: string[];
  onSubmit: (data: CampaignFormData) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitError?: string;
}

export function ValidatedCampaignForm({
  initialData = {},
  isEditing = false,
  originalCampaignName,
  existingCampaigns = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError
}: ValidatedCampaignFormProps) {
  const [formData, setFormData] = useState<CampaignFormData>({
    campaignName: initialData.campaignName || '',
    landingPageUrls: initialData.landingPageUrls || [''],
    utmLinks: initialData.utmLinks || [{ source: '', medium: '', content: '', term: '', linkName: '' }],
    tags: initialData.tags || []
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isFormValid, setIsFormValid] = useState(false);

  // Character counts
  const campaignNameCount = useCharacterCount(formData.campaignName, 100);
  
  // Campaign name validation
  const campaignNameValidation = useUtmParameterValidation(formData.campaignName, 'campaign');
  const duplicateValidation = useCampaignDuplicateValidation(
    formData.campaignName,
    existingCampaigns,
    isEditing,
    originalCampaignName
  );

  // URL validations
  const urlValidations = formData.landingPageUrls.map(url => useUrlValidation(url));

  // UTM parameter validations
  const utmValidations = formData.utmLinks.map(link => ({
    source: useUtmParameterValidation(link.source, 'source'),
    medium: useUtmParameterValidation(link.medium, 'medium'),
    content: useUtmParameterValidation(link.content, 'content'),
    term: useUtmParameterValidation(link.term, 'term'),
    linkName: {
      isValid: link.linkName.trim().length > 0 && link.linkName.length <= 100,
      error: !link.linkName.trim() ? 'Link name is required' : 
             link.linkName.length > 100 ? 'Link name must be 100 characters or less' : ''
    }
  }));

  // Form validation effect
  useEffect(() => {
    const errors: Record<string, string> = {};

    // Campaign name errors
    if (!campaignNameValidation.isValid) {
      errors.campaignName = campaignNameValidation.error;
    } else if (duplicateValidation.isDuplicate) {
      errors.campaignName = duplicateValidation.error;
    }

    // URL errors
    urlValidations.forEach((validation, index) => {
      if (!validation.isValid) {
        errors[`landingPageUrl_${index}`] = validation.error;
      }
    });

    // UTM link errors
    utmValidations.forEach((validation, index) => {
      if (!validation.source.isValid) {
        errors[`utmLink_${index}_source`] = validation.source.error;
      }
      if (!validation.medium.isValid) {
        errors[`utmLink_${index}_medium`] = validation.medium.error;
      }
      if (!validation.content.isValid) {
        errors[`utmLink_${index}_content`] = validation.content.error;
      }
      if (!validation.term.isValid) {
        errors[`utmLink_${index}_term`] = validation.term.error;
      }
      if (!validation.linkName.isValid) {
        errors[`utmLink_${index}_linkName`] = validation.linkName.error;
      }
    });

    setFieldErrors(errors);
    setIsFormValid(
      Object.keys(errors).length === 0 &&
      formData.campaignName.trim().length > 0 &&
      formData.landingPageUrls.some(url => url.trim().length > 0) &&
      formData.utmLinks.some(link => link.source.trim().length > 0 && link.medium.trim().length > 0)
    );
  }, [formData, campaignNameValidation, duplicateValidation, urlValidations, utmValidations]);

  const handleCampaignNameChange = (value: string) => {
    setFormData(prev => ({ ...prev, campaignName: value }));
  };

  const handleLandingPageUrlChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      landingPageUrls: prev.landingPageUrls.map((url, i) => i === index ? value : url)
    }));
  };

  const handleAddLandingPageUrl = () => {
    setFormData(prev => ({
      ...prev,
      landingPageUrls: [...prev.landingPageUrls, '']
    }));
  };

  const handleRemoveLandingPageUrl = (index: number) => {
    if (formData.landingPageUrls.length > 1) {
      setFormData(prev => ({
        ...prev,
        landingPageUrls: prev.landingPageUrls.filter((_, i) => i !== index)
      }));
    }
  };

  const handleUtmLinkChange = (index: number, field: keyof typeof formData.utmLinks[0], value: string) => {
    setFormData(prev => ({
      ...prev,
      utmLinks: prev.utmLinks.map((link, i) => 
        i === index ? { ...link, [field]: value } : link
      )
    }));
  };

  const handleAddUtmLink = () => {
    setFormData(prev => ({
      ...prev,
      utmLinks: [...prev.utmLinks, { source: '', medium: '', content: '', term: '', linkName: '' }]
    }));
  };

  const handleRemoveUtmLink = (index: number) => {
    if (formData.utmLinks.length > 1) {
      setFormData(prev => ({
        ...prev,
        utmLinks: prev.utmLinks.filter((_, i) => i !== index)
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid && !isSubmitting) {
      onSubmit(formData);
    }
  };

  const previewUtmLinks = () => {
    const previews: Array<{ landingPage: string; utmLink: string; linkName: string }> = [];
    
    formData.landingPageUrls.forEach(url => {
      if (url.trim()) {
        const urlValidation = validateUrl(url);
        if (urlValidation.isValid && urlValidation.cleanUrl) {
          formData.utmLinks.forEach(link => {
            if (link.source.trim() && link.medium.trim() && link.linkName.trim()) {
              try {
                const utmLink = generateUTMLink(
                  urlValidation.cleanUrl || url,
                  link.source,
                  link.medium,
                  formData.campaignName,
                  link.content,
                  link.term
                );
                previews.push({
                  landingPage: url,
                  utmLink,
                  linkName: link.linkName
                });
              } catch (error) {
                // Ignore invalid combinations
              }
            }
          });
        }
      }
    });

    return previews;
  };

  const previews = previewUtmLinks();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {/* Campaign Name Section */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ValidatedInput
            label="Campaign Name"
            value={formData.campaignName}
            onChange={(e) => handleCampaignNameChange(e.target.value)}
            error={fieldErrors.campaignName}
            maxLength={100}
            showCounter
            required
            placeholder="e.g., summer-sale-2024"
            helperText="Use only letters, numbers, spaces, hyphens, and underscores. Spaces will be converted to hyphens."
          />
        </CardContent>
      </Card>

      {/* Landing Page URLs Section */}
      <Card>
        <CardHeader>
          <CardTitle>Landing Page URLs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.landingPageUrls.map((url, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="flex-1">
                <ValidatedInput
                  label={`Landing Page URL ${index + 1}`}
                  value={url}
                  onChange={(e) => handleLandingPageUrlChange(index, e.target.value)}
                  error={fieldErrors[`landingPageUrl_${index}`]}
                  maxLength={1800}
                  showCounter
                  required={index === 0}
                  placeholder="https://example.com/landing-page"
                  helperText="Must start with http:// or https://. Existing UTM parameters will be removed."
                />
              </div>
              {formData.landingPageUrls.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveLandingPageUrl(index)}
                  className="mt-6"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={handleAddLandingPageUrl}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Landing Page URL
          </Button>
        </CardContent>
      </Card>

      {/* UTM Links Section */}
      <Card>
        <CardHeader>
          <CardTitle>UTM Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {formData.utmLinks.map((link, index) => (
            <div key={index} className="p-4 border rounded-lg space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">UTM Link {index + 1}</h4>
                {formData.utmLinks.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveUtmLink(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ValidatedInput
                  label="Source"
                  value={link.source}
                  onChange={(e) => handleUtmLinkChange(index, 'source', e.target.value)}
                  error={fieldErrors[`utmLink_${index}_source`]}
                  maxLength={100}
                  showCounter
                  required
                  placeholder="e.g., google, facebook, newsletter"
                />

                <ValidatedInput
                  label="Medium"
                  value={link.medium}
                  onChange={(e) => handleUtmLinkChange(index, 'medium', e.target.value)}
                  error={fieldErrors[`utmLink_${index}_medium`]}
                  maxLength={50}
                  showCounter
                  required
                  placeholder="e.g., cpc, social, email"
                />

                <ValidatedInput
                  label="Content"
                  value={link.content}
                  onChange={(e) => handleUtmLinkChange(index, 'content', e.target.value)}
                  error={fieldErrors[`utmLink_${index}_content`]}
                  maxLength={100}
                  showCounter
                  placeholder="e.g., header-banner, sidebar-ad"
                />

                <TermTemplateInput
                  label="Term"
                  value={link.term || ''}
                  onChange={(value) => handleUtmLinkChange(index, 'term', value)}
                  error={fieldErrors[`utmLink_${index}_term`]}
                  placeholder="e.g., running-shoes, summer-sale"
                />

                <ValidatedInput
                  label="Link Name"
                  value={link.linkName}
                  onChange={(e) => handleUtmLinkChange(index, 'linkName', e.target.value)}
                  error={fieldErrors[`utmLink_${index}_linkName`]}
                  maxLength={100}
                  showCounter
                  required
                  placeholder="e.g., Google Ads Summer Campaign"
                  className="md:col-span-2"
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={handleAddUtmLink}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add UTM Link Configuration
          </Button>
        </CardContent>
      </Card>

      {/* Preview Section */}
      {previews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              UTM Link Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {previews.map((preview, index) => (
                <div key={index} className="p-3 bg-muted rounded-lg">
                  <div className="font-medium text-sm mb-1">{preview.linkName}</div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Landing Page: {preview.landingPage}
                  </div>
                  <div className="text-xs font-mono bg-background p-2 rounded border break-all">
                    {preview.utmLink}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className="min-w-32"
        >
          {isSubmitting ? 'Processing...' : isEditing ? 'Update Campaign' : 'Create Campaign'}
        </Button>
      </div>
    </form>
  );
}