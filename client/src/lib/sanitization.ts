/**
 * Input sanitization utilities for Chat Wizard and form inputs
 */

// HTML/Script tag sanitization
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  // Remove HTML tags, script tags, and potential XSS vectors
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

// Campaign name sanitization
export function sanitizeCampaignName(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  const sanitized = sanitizeHtml(input);
  
  // Limit length and allow only safe characters
  return sanitized
    .slice(0, 100)
    .replace(/[^\w\s\-_()]/g, '')
    .trim();
}

// URL validation with protocol whitelisting
export function validateAndSanitizeUrl(input: string): { isValid: boolean; sanitized: string; error?: string } {
  if (!input || typeof input !== 'string') {
    return { isValid: false, sanitized: '', error: 'URL is required' };
  }

  const sanitized = sanitizeHtml(input.trim());
  
  // Check length
  if (sanitized.length > 2000) {
    return { isValid: false, sanitized, error: 'URL too long (max 2000 characters)' };
  }

  // Check for valid URL format
  try {
    const url = new URL(sanitized);
    
    // Whitelist allowed protocols
    const allowedProtocols = ['http:', 'https:'];
    if (!allowedProtocols.includes(url.protocol)) {
      return { isValid: false, sanitized, error: 'URL must use http or https protocol' };
    }

    // Check for suspicious patterns
    if (url.hostname.includes('localhost') && !url.hostname.startsWith('localhost')) {
      return { isValid: false, sanitized, error: 'Invalid hostname format' };
    }

    return { isValid: true, sanitized: url.toString() };
  } catch (error) {
    return { isValid: false, sanitized, error: 'Invalid URL format' };
  }
}

// General text input sanitization
export function sanitizeTextInput(input: string, maxLength: number = 500): string {
  if (!input || typeof input !== 'string') return '';
  
  return sanitizeHtml(input)
    .slice(0, maxLength)
    .trim();
}

// UTM parameter sanitization
export function sanitizeUtmParameter(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return sanitizeHtml(input)
    .toLowerCase()
    .replace(/[^a-z0-9\-_]/g, '')
    .slice(0, 100)
    .trim();
}