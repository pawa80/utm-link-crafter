import { db } from "./db";
import { utmTemplates } from "@shared/schema";

const defaultUtmTemplates = [
  { utmSource: "google", utmMedium: "cpc", utmContent: "text-ad", description: "Google Ads - Tekstannonse" },
  { utmSource: "google", utmMedium: "cpc", utmContent: "responsive-ad", description: "Google Ads - Responsiv søkeannonse" },
  { utmSource: "google", utmMedium: "cpc", utmContent: "shopping-ad", description: "Google Ads - Shopping annonse" },
  { utmSource: "google", utmMedium: "paidsearch", utmContent: "text-ad", description: "Google Ads - Tekstannonse søk" },
  { utmSource: "google", utmMedium: "paidsearch", utmContent: "responsive-ad", description: "Google Ads - Responsiv søkeannonse" },
  { utmSource: "google", utmMedium: "organic", utmContent: "serp-result", description: "Google - Organisk søkeresultat" },
  { utmSource: "facebook", utmMedium: "social", utmContent: "post-image", description: "Facebook - Organisk bilde-innlegg" },
  { utmSource: "facebook", utmMedium: "social", utmContent: "post-video", description: "Facebook - Organisk video-innlegg" },
  { utmSource: "facebook", utmMedium: "social", utmContent: "post-carousel", description: "Facebook - Organisk karusell-innlegg" },
  { utmSource: "facebook", utmMedium: "cpc", utmContent: "single-image", description: "Facebook - Enkelt bilde annonse" },
  { utmSource: "facebook", utmMedium: "cpc", utmContent: "video-ad", description: "Facebook - Video annonse" },
  { utmSource: "facebook", utmMedium: "cpc", utmContent: "carousel-ad", description: "Facebook - Karusell annonse" },
  { utmSource: "facebook", utmMedium: "paid-social", utmContent: "feed-ad", description: "Facebook - Feed annonse" },
  { utmSource: "facebook", utmMedium: "paid-social", utmContent: "story-ad", description: "Facebook - Stories annonse" },
  { utmSource: "facebook", utmMedium: "paid-social", utmContent: "reel-ad", description: "Facebook - Reels annonse" },
  { utmSource: "instagram", utmMedium: "social", utmContent: "post-image", description: "Instagram - Organisk bilde-innlegg" },
  { utmSource: "instagram", utmMedium: "social", utmContent: "post-video", description: "Instagram - Organisk video-innlegg" },
  { utmSource: "instagram", utmMedium: "social", utmContent: "story-post", description: "Instagram - Organisk story" },
  { utmSource: "instagram", utmMedium: "cpc", utmContent: "feed-ad", description: "Instagram - Feed annonse" },
  { utmSource: "instagram", utmMedium: "cpc", utmContent: "story-ad", description: "Instagram - Stories annonse" },
  { utmSource: "instagram", utmMedium: "cpc", utmContent: "reel-ad", description: "Instagram - Reels annonse" },
  { utmSource: "instagram", utmMedium: "paid-social", utmContent: "carousel-ad", description: "Instagram - Karusell annonse" },
  { utmSource: "instagram", utmMedium: "paid-social", utmContent: "collection-ad", description: "Instagram - Samling annonse" },
  { utmSource: "x", utmMedium: "social", utmContent: "tweet-text", description: "X - Organisk tekst tweet" },
  { utmSource: "x", utmMedium: "social", utmContent: "tweet-image", description: "X - Organisk bilde tweet" },
  { utmSource: "x", utmMedium: "social", utmContent: "tweet-video", description: "X - Organisk video tweet" },
  { utmSource: "x", utmMedium: "cpc", utmContent: "promoted-tweet", description: "X - Promoted tweet" },
  { utmSource: "x", utmMedium: "cpc", utmContent: "video-ad", description: "X - Video annonse" },
  { utmSource: "x", utmMedium: "paid-social", utmContent: "carousel-ad", description: "X - Karusell annonse" },
  { utmSource: "linkedin", utmMedium: "social", utmContent: "post-text", description: "LinkedIn - Organisk tekst-innlegg" },
  { utmSource: "linkedin", utmMedium: "social", utmContent: "post-image", description: "LinkedIn - Organisk bilde-innlegg" },
  { utmSource: "linkedin", utmMedium: "social", utmContent: "post-video", description: "LinkedIn - Organisk video-innlegg" },
  { utmSource: "linkedin", utmMedium: "cpc", utmContent: "sponsored-content", description: "LinkedIn - Sponsored content" },
  { utmSource: "linkedin", utmMedium: "cpc", utmContent: "text-ad", description: "LinkedIn - Tekstannonse" },
  { utmSource: "linkedin", utmMedium: "cpc", utmContent: "video-ad", description: "LinkedIn - Video annonse" },
  { utmSource: "linkedin", utmMedium: "paid-social", utmContent: "carousel-ad", description: "LinkedIn - Karusell annonse" },
  { utmSource: "linkedin", utmMedium: "paid-social", utmContent: "single-image", description: "LinkedIn - Enkelt bilde annonse" },
  { utmSource: "youtube", utmMedium: "social", utmContent: "video-organic", description: "YouTube - Organisk video" },
  { utmSource: "youtube", utmMedium: "social", utmContent: "short-video", description: "YouTube - YouTube Shorts" },
  { utmSource: "youtube", utmMedium: "cpc", utmContent: "video-ad", description: "YouTube - Video annonse" },
  { utmSource: "youtube", utmMedium: "cpc", utmContent: "bumper-ad", description: "YouTube - Bumper annonse (6 sek)" },
  { utmSource: "youtube", utmMedium: "video", utmContent: "pre-roll", description: "YouTube - Pre-roll annonse" },
  { utmSource: "youtube", utmMedium: "video", utmContent: "mid-roll", description: "YouTube - Mid-roll annonse" },
  { utmSource: "newsletter", utmMedium: "email", utmContent: "header-cta", description: "Nyhetsbrev - Header call-to-action" },
  { utmSource: "newsletter", utmMedium: "email", utmContent: "footer-cta", description: "Nyhetsbrev - Footer call-to-action" },
  { utmSource: "newsletter", utmMedium: "email", utmContent: "inline-link", description: "Nyhetsbrev - Inline tekst-lenke" },
  { utmSource: "newsletter", utmMedium: "email", utmContent: "banner-image", description: "Nyhetsbrev - Banner bilde" },
  { utmSource: "mailchimp", utmMedium: "email", utmContent: "button-primary", description: "Mailchimp - Primær knapp" },
  { utmSource: "mailchimp", utmMedium: "email", utmContent: "button-secondary", description: "Mailchimp - Sekundær knapp" },
  { utmSource: "mailchimp", utmMedium: "email", utmContent: "text-link", description: "Mailchimp - Tekst-lenke" },
  { utmSource: "mailchimp", utmMedium: "email", utmContent: "hero-image", description: "Mailchimp - Hero bilde" },
  { utmSource: "activecampaign", utmMedium: "email", utmContent: "cta-button", description: "ActiveCampaign - CTA knapp" },
  { utmSource: "activecampaign", utmMedium: "email", utmContent: "product-image", description: "ActiveCampaign - Produktbilde" },
  { utmSource: "activecampaign", utmMedium: "email", utmContent: "personalized-link", description: "ActiveCampaign - Personalisert lenke" },
  { utmSource: "email-signature", utmMedium: "email", utmContent: "logo-link", description: "E-post signatur - Logo lenke" },
  { utmSource: "email-signature", utmMedium: "email", utmContent: "social-icon", description: "E-post signatur - Sosial media ikon" },
  { utmSource: "email-signature", utmMedium: "email", utmContent: "cta-banner", description: "E-post signatur - CTA banner" },
  { utmSource: "microsoft", utmMedium: "cpc", utmContent: "text-ad", description: "Microsoft Ads - Tekstannonse" },
  { utmSource: "microsoft", utmMedium: "cpc", utmContent: "shopping-ad", description: "Microsoft Ads - Shopping annonse" },
  { utmSource: "microsoft", utmMedium: "paidsearch", utmContent: "expanded-text", description: "Microsoft Ads - Utvidet tekstannonse" },
  { utmSource: "display", utmMedium: "banner", utmContent: "leaderboard-728x90", description: "Display - Leaderboard banner" },
  { utmSource: "display", utmMedium: "banner", utmContent: "rectangle-300x250", description: "Display - Medium rectangle banner" },
  { utmSource: "display", utmMedium: "banner", utmContent: "skyscraper-160x600", description: "Display - Skyscraper banner" },
  { utmSource: "display", utmMedium: "display", utmContent: "responsive-banner", description: "Display - Responsiv banner" },
  { utmSource: "display", utmMedium: "display", utmContent: "video-banner", description: "Display - Video banner" },
  { utmSource: "affiliate", utmMedium: "affiliate", utmContent: "text-link", description: "Affiliate - Tekst-lenke" },
  { utmSource: "affiliate", utmMedium: "affiliate", utmContent: "banner-ad", description: "Affiliate - Banner annonse" },
  { utmSource: "affiliate", utmMedium: "affiliate", utmContent: "product-review", description: "Affiliate - Produktanmeldelse" },
  { utmSource: "affiliate", utmMedium: "referral", utmContent: "coupon-code", description: "Affiliate - Kupongkode" },
  { utmSource: "partners", utmMedium: "referral", utmContent: "partner-link", description: "Partner - Partner lenke" },
  { utmSource: "partners", utmMedium: "referral", utmContent: "co-branded", description: "Partner - Co-branded innhold" },
  { utmSource: "partners", utmMedium: "affiliate", utmContent: "recommendation", description: "Partner - Anbefaling" }
];

export async function seedUtmTemplates() {
  try {
    // Check if templates already exist
    const existingTemplates = await db.select().from(utmTemplates).limit(1);
    
    if (existingTemplates.length === 0) {
      console.log('Seeding UTM templates...');
      await db.insert(utmTemplates).values(defaultUtmTemplates);
      console.log(`Seeded ${defaultUtmTemplates.length} UTM templates successfully`);
    } else {
      console.log('UTM templates already exist, skipping seed');
    }
  } catch (error) {
    console.error('Error seeding UTM templates:', error);
  }
}

// Helper function to get unique sources and mediums for source templates
export function getUniqueSourcesAndMediums() {
  const sourceMap = new Map<string, Set<string>>();
  
  defaultUtmTemplates.forEach(template => {
    if (!sourceMap.has(template.utmSource)) {
      sourceMap.set(template.utmSource, new Set());
    }
    sourceMap.get(template.utmSource)!.add(template.utmMedium);
  });

  return Array.from(sourceMap.entries()).map(([sourceName, mediums]) => ({
    sourceName,
    mediums: Array.from(mediums),
    formats: [], // Empty formats for now
    abTestingPreference: 1,
    isArchived: false
  }));
}