import { useState, useEffect } from 'react';
import { validateUrl, sanitizeUtmParameter, getCharacterCount, checkDuplicateCampaign } from '@shared/validation';

// Character count hook for form inputs
export function useCharacterCount(value: string, maxLength: number) {
  const [characterInfo, setCharacterInfo] = useState({
    count: 0,
    remaining: maxLength,
    isOverLimit: false
  });

  useEffect(() => {
    const info = getCharacterCount(value, maxLength);
    setCharacterInfo(info);
  }, [value, maxLength]);

  return characterInfo;
}

// URL validation hook
export function useUrlValidation(url: string) {
  const [validation, setValidation] = useState({
    isValid: true,
    error: '',
    cleanUrl: url
  });

  useEffect(() => {
    if (!url || url.trim().length === 0) {
      setValidation({
        isValid: false,
        error: 'URL is required',
        cleanUrl: url
      });
      return;
    }

    const result = validateUrl(url);
    setValidation({
      isValid: result.isValid,
      error: result.error || '',
      cleanUrl: result.cleanUrl || url
    });
  }, [url]);

  return validation;
}

// UTM parameter validation hook
export function useUtmParameterValidation(
  value: string, 
  parameterType: 'source' | 'medium' | 'campaign' | 'content' | 'term'
) {
  const [validation, setValidation] = useState({
    isValid: true,
    error: '',
    sanitizedValue: value
  });

  useEffect(() => {
    const sanitized = sanitizeUtmParameter(value);
    let error = '';
    let isValid = true;

    // Length validation based on parameter type
    const maxLengths = {
      source: 100,
      medium: 50,
      campaign: 100,
      content: 100,
      term: 100
    };

    const requiredParams = ['source', 'medium', 'campaign'];
    
    if (requiredParams.includes(parameterType)) {
      if (!value || value.trim().length === 0) {
        error = `${parameterType.charAt(0).toUpperCase() + parameterType.slice(1)} is required`;
        isValid = false;
      } else if (!sanitized || sanitized.length === 0) {
        error = `${parameterType.charAt(0).toUpperCase() + parameterType.slice(1)} cannot be empty after removing invalid characters`;
        isValid = false;
      }
    }

    if (sanitized && sanitized.length > maxLengths[parameterType]) {
      error = `${parameterType.charAt(0).toUpperCase() + parameterType.slice(1)} must be ${maxLengths[parameterType]} characters or less`;
      isValid = false;
    }

    // Character validation
    if (value && !/^[a-zA-Z0-9\-_\s]*$/.test(value)) {
      error = `${parameterType.charAt(0).toUpperCase() + parameterType.slice(1)} can only contain letters, numbers, spaces, hyphens, and underscores`;
      isValid = false;
    }

    setValidation({
      isValid,
      error,
      sanitizedValue: sanitized
    });
  }, [value, parameterType]);

  return validation;
}

// Campaign duplicate validation hook
export function useCampaignDuplicateValidation(
  campaignName: string,
  existingCampaigns: string[],
  isEditing: boolean = false,
  originalName?: string
) {
  const [validation, setValidation] = useState({
    isDuplicate: false,
    error: ''
  });

  useEffect(() => {
    if (!campaignName || campaignName.trim().length === 0) {
      setValidation({ isDuplicate: false, error: '' });
      return;
    }

    const result = checkDuplicateCampaign(campaignName, existingCampaigns, isEditing, originalName);
    setValidation({
      isDuplicate: result.isDuplicate,
      error: result.error || ''
    });
  }, [campaignName, existingCampaigns, isEditing, originalName]);

  return validation;
}

// Complete form validation hook
export function useFormValidation(
  formData: {
    campaignName: string;
    landingPageUrls: string[];
    utmLinks: Array<{
      source: string;
      medium: string;
      content: string;
      term: string;
      linkName: string;
    }>;
  },
  existingCampaigns: string[] = [],
  isEditing: boolean = false,
  originalCampaignName?: string
) {
  const [formValidation, setFormValidation] = useState({
    isValid: true,
    errors: {} as Record<string, string>
  });

  useEffect(() => {
    const errors: Record<string, string> = {};

    // Validate campaign name
    const campaignValidation = useUtmParameterValidation(formData.campaignName, 'campaign');
    if (!campaignValidation.isValid) {
      errors.campaignName = campaignValidation.error;
    }

    // Check for duplicate campaign name
    const duplicateValidation = useCampaignDuplicateValidation(
      formData.campaignName,
      existingCampaigns,
      isEditing,
      originalCampaignName
    );
    if (duplicateValidation.isDuplicate) {
      errors.campaignName = duplicateValidation.error;
    }

    // Validate landing page URLs
    formData.landingPageUrls.forEach((url, index) => {
      const urlValidation = useUrlValidation(url);
      if (!urlValidation.isValid) {
        errors[`landingPageUrl_${index}`] = urlValidation.error;
      }
    });

    // Validate UTM links
    formData.utmLinks.forEach((link, index) => {
      const sourceValidation = useUtmParameterValidation(link.source, 'source');
      if (!sourceValidation.isValid) {
        errors[`utmLink_${index}_source`] = sourceValidation.error;
      }

      const mediumValidation = useUtmParameterValidation(link.medium, 'medium');
      if (!mediumValidation.isValid) {
        errors[`utmLink_${index}_medium`] = mediumValidation.error;
      }

      const contentValidation = useUtmParameterValidation(link.content, 'content');
      if (!contentValidation.isValid) {
        errors[`utmLink_${index}_content`] = contentValidation.error;
      }

      const termValidation = useUtmParameterValidation(link.term, 'term');
      if (!termValidation.isValid) {
        errors[`utmLink_${index}_term`] = termValidation.error;
      }

      if (!link.linkName || link.linkName.trim().length === 0) {
        errors[`utmLink_${index}_linkName`] = 'Link name is required';
      } else if (link.linkName.length > 100) {
        errors[`utmLink_${index}_linkName`] = 'Link name must be 100 characters or less';
      }
    });

    setFormValidation({
      isValid: Object.keys(errors).length === 0,
      errors
    });
  }, [formData, existingCampaigns, isEditing, originalCampaignName]);

  return formValidation;
}