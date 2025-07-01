export interface UTMParams {
  targetUrl: string;
  utm_campaign: string;
  utm_source: string;
  utm_medium: string;
  utm_content?: string;
  utm_term?: string;
  utm_custom1?: string;
  utm_custom2?: string;
  utm_custom3?: string;
}

export const generateUTMLink = (params: UTMParams): string => {
  // Validate the target URL first
  if (!params.targetUrl || !params.targetUrl.trim()) {
    return '';
  }
  
  try {
    let targetUrl = params.targetUrl.trim();
    
    // Add https:// if no protocol is specified
    if (!targetUrl.match(/^https?:\/\//)) {
      targetUrl = `https://${targetUrl}`;
    }
    
    const url = new URL(targetUrl);
    
    url.searchParams.set('utm_campaign', params.utm_campaign);
    url.searchParams.set('utm_source', params.utm_source);
    url.searchParams.set('utm_medium', params.utm_medium);
    
    if (params.utm_content) {
      url.searchParams.set('utm_content', params.utm_content);
    }
    
    if (params.utm_term) {
      url.searchParams.set('utm_term', params.utm_term);
    }
    
    if (params.utm_custom1) {
      url.searchParams.set('utm_custom1', params.utm_custom1);
    }
    
    if (params.utm_custom2) {
      url.searchParams.set('utm_custom2', params.utm_custom2);
    }
    
    if (params.utm_custom3) {
      url.searchParams.set('utm_custom3', params.utm_custom3);
    }
    
    return url.toString();
  } catch (error) {
    console.warn('Invalid URL provided to generateUTMLink:', params.targetUrl);
    return '';
  }
};

export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const getContentSuggestions = (source: string, medium: string): string[] => {
  const suggestions: Record<string, Record<string, string[]>> = {
    google: {
      display: ['300x250_banner', '728x90_leaderboard', '160x600_skyscraper', '970x250_billboard'],
      cpc: ['text_ad', 'search_ad', 'keyword_target'],
    },
    facebook: {
      social: ['post_ad', 'story_ad', 'video_ad', 'carousel_ad'],
      cpc: ['sponsored_post', 'boosted_post'],
    },
    linkedin: {
      social: ['sponsored_content', 'message_ad', 'text_ad'],
      cpc: ['sponsored_inmail', 'display_ad'],
    },
  };

  return suggestions[source]?.[medium] || [];
};
