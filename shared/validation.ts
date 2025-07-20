import { z } from "zod";

// URL validation function
export function validateUrl(url: string): { isValid: boolean; error?: string; cleanUrl?: string } {
  try {
    // Check if URL starts with http:// or https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { isValid: false, error: "URL must start with http:// or https://" };
    }

    // Validate URL format using URL constructor
    const urlObj = new URL(url);
    
    // Strip existing UTM parameters
    const cleanUrl = stripUtmParameters(url);
    
    // Check maximum length (accounting for future UTM parameters)
    if (cleanUrl.length > 1800) { // Leave room for UTM parameters (~200 chars)
      return { isValid: false, error: "URL too long. Maximum 1800 characters before UTM parameters." };
    }

    return { isValid: true, cleanUrl };
  } catch (error) {
    return { isValid: false, error: "Invalid URL format" };
  }
}

// Strip UTM parameters from URL
export function stripUtmParameters(url: string): string {
  try {
    const urlObj = new URL(url);
    const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    
    utmParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    return urlObj.toString();
  } catch {
    return url; // Return original if parsing fails
  }
}

// UTM parameter sanitization
export function sanitizeUtmParameter(value: string): string {
  return value
    .trim()                           // Remove whitespace
    .toLowerCase()                    // Convert to lowercase
    .replace(/\s+/g, '-')            // Convert spaces to hyphens
    .replace(/[^a-z0-9\-_]/g, '')    // Remove special characters except hyphens and underscores
    .replace(/-+/g, '-')             // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '');        // Remove leading/trailing hyphens
}

// Validation schemas with custom error messages
export const utmSourceSchema = z
  .string()
  .min(1, "Source is required")
  .max(100, "Source must be 100 characters or less")
  .refine(val => /^[a-zA-Z0-9\-_\s]+$/.test(val), {
    message: "Source can only contain letters, numbers, spaces, hyphens, and underscores"
  });

export const utmMediumSchema = z
  .string()
  .min(1, "Medium is required")
  .max(50, "Medium must be 50 characters or less")
  .refine(val => /^[a-zA-Z0-9\-_\s]+$/.test(val), {
    message: "Medium can only contain letters, numbers, spaces, hyphens, and underscores"
  });

export const utmCampaignSchema = z
  .string()
  .min(1, "Campaign name is required")
  .max(100, "Campaign name must be 100 characters or less")
  .refine(val => /^[a-zA-Z0-9\-_\s]+$/.test(val), {
    message: "Campaign name can only contain letters, numbers, spaces, hyphens, and underscores"
  });

export const utmContentSchema = z
  .string()
  .max(100, "Content must be 100 characters or less")
  .refine(val => val === '' || /^[a-zA-Z0-9\-_\s]+$/.test(val), {
    message: "Content can only contain letters, numbers, spaces, hyphens, and underscores"
  })
  .optional()
  .or(z.literal(''));

export const utmTermSchema = z
  .string()
  .max(100, "Term must be 100 characters or less")
  .refine(val => val === '' || /^[a-zA-Z0-9\-_\s]+$/.test(val), {
    message: "Term can only contain letters, numbers, spaces, hyphens, and underscores"
  })
  .optional()
  .or(z.literal(''));

// Landing page URL validation schema
export const landingPageUrlSchema = z
  .string()
  .min(1, "Landing page URL is required")
  .refine(val => validateUrl(val).isValid, {
    message: "Invalid URL format or URL must start with http:// or https://"
  })
  .transform(val => {
    const result = validateUrl(val);
    return result.cleanUrl || val;
  });

// Complete campaign validation schema
export const campaignValidationSchema = z.object({
  campaignName: utmCampaignSchema,
  landingPageUrls: z.array(landingPageUrlSchema).min(1, "At least one landing page URL is required"),
  utmLinks: z.array(z.object({
    source: utmSourceSchema,
    medium: utmMediumSchema,
    content: utmContentSchema,
    term: utmTermSchema,
    linkName: z.string().min(1, "Link name is required").max(100, "Link name must be 100 characters or less")
  })).min(1, "At least one UTM link configuration is required")
});

// UTM link generation function
export function generateUTMLink(
  landingPageUrl: string, 
  source: string, 
  medium: string, 
  campaign: string, 
  content?: string, 
  term?: string
): string {
  try {
    const url = new URL(landingPageUrl);
    
    // Add UTM parameters (sanitized)
    url.searchParams.set('utm_source', sanitizeUtmParameter(source));
    url.searchParams.set('utm_medium', sanitizeUtmParameter(medium));
    url.searchParams.set('utm_campaign', sanitizeUtmParameter(campaign));
    
    if (content && content.trim()) {
      url.searchParams.set('utm_content', sanitizeUtmParameter(content));
    }
    
    if (term && term.trim()) {
      url.searchParams.set('utm_term', sanitizeUtmParameter(term));
    }
    
    const finalUrl = url.toString();
    
    // Validate final URL length
    if (finalUrl.length > 2000) {
      throw new Error("Generated UTM link exceeds 2000 character limit");
    }
    
    return finalUrl;
  } catch (error) {
    throw new Error(`Failed to generate UTM link: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Character count helper for UI
export function getCharacterCount(value: string, maxLength: number): {
  count: number;
  remaining: number;
  isOverLimit: boolean;
} {
  const count = value.length;
  const remaining = maxLength - count;
  return {
    count,
    remaining,
    isOverLimit: remaining < 0
  };
}

// Validation error formatter
export function formatValidationError(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  
  error.errors.forEach(err => {
    const field = err.path.join('.');
    fieldErrors[field] = err.message;
  });
  
  return fieldErrors;
}

// Duplicate campaign validation
export function checkDuplicateCampaign(
  campaignName: string, 
  existingCampaigns: string[], 
  isEditing: boolean = false,
  originalName?: string
): { isDuplicate: boolean; error?: string } {
  const sanitizedName = sanitizeUtmParameter(campaignName);
  const sanitizedExisting = existingCampaigns.map(name => sanitizeUtmParameter(name));
  
  // If editing and name hasn't changed, allow it
  if (isEditing && originalName && sanitizeUtmParameter(originalName) === sanitizedName) {
    return { isDuplicate: false };
  }
  
  if (sanitizedExisting.includes(sanitizedName)) {
    return { 
      isDuplicate: true, 
      error: "A campaign with this name already exists. Please choose a different name." 
    };
  }
  
  return { isDuplicate: false };
}