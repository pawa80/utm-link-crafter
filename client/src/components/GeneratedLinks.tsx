import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/lib/utm";
import { formatDistanceToNow } from "date-fns";
import { List, Copy, Download, ChevronDown, ChevronUp, Edit, Filter, SortAsc, Archive, ArchiveRestore } from "lucide-react";
import { Link } from "wouter";
import type { UtmLink, CampaignLandingPage } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import CampaignCard from "./CampaignCard";
import { auth } from "@/lib/firebase";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    return {};
  }
  
  try {
    const token = await user.getIdToken();
    const headers: Record<string, string> = {};
    headers['x-firebase-uid'] = user.uid;
    headers['Authorization'] = `Bearer ${token}`;
    return headers;
  } catch (error) {
    console.error("Error getting auth token:", error);
    return {};
  }
}

interface GeneratedLinksProps {
  showArchived?: boolean;
}

export default function GeneratedLinks({ showArchived = false }: GeneratedLinksProps) {
  const { toast } = useToast();
  const [collapsedCampaigns, setCollapsedCampaigns] = useState<Set<string>>(new Set());
  const [initializedCollapse, setInitializedCollapse] = useState(false);
  const [sortBy, setSortBy] = useState<string>("created-newest");
  const [filterByTag, setFilterByTag] = useState<string>("all");



  const toggleCampaignCollapse = (campaignName: string) => {
    if (!initializedCollapse) {
      // First time toggling - initialize with all campaigns except the clicked one as collapsed
      setInitializedCollapse(true);
      // Get all campaign names from links data
      const allCampaignNames = [...new Set(links.map(link => link.utm_campaign))];
      const otherCampaigns = allCampaignNames.filter(name => name !== campaignName);
      setCollapsedCampaigns(new Set(otherCampaigns));
      return;
    }
    
    const newCollapsed = new Set(collapsedCampaigns);
    if (newCollapsed.has(campaignName)) {
      newCollapsed.delete(campaignName);
    } else {
      newCollapsed.add(campaignName);
    }
    setCollapsedCampaigns(newCollapsed);
  };

  const isCampaignCollapsed = (campaignName: string) => {
    // Default to collapsed (true) unless explicitly expanded
    if (!initializedCollapse) {
      return true; // All campaigns start collapsed
    }
    return collapsedCampaigns.has(campaignName);
  };

  const { data: links = [], isLoading } = useQuery<UtmLink[]>({
    queryKey: ["/api/utm-links", showArchived],
    queryFn: async () => {
      const authHeaders = await getAuthHeaders();
      
      const response = await fetch(`/api/utm-links?includeArchived=${showArchived}`, {
        credentials: "include",
        headers: authHeaders,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch UTM links: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      return showArchived ? data.filter((link: UtmLink) => link.isArchived) : data.filter((link: UtmLink) => !link.isArchived);
    },
  });

  // Fetch all campaign landing pages to show URLs per campaign
  const { data: allLandingPages = [] } = useQuery<CampaignLandingPage[]>({
    queryKey: ["/api/campaign-landing-pages"],
    queryFn: async () => {
      const authHeaders = await getAuthHeaders();
      
      const response = await fetch("/api/campaign-landing-pages", {
        credentials: "include",
        headers: authHeaders,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch landing pages: ${response.status} ${errorText}`);
      }
      
      return response.json();
    },
  });
  
  // Debug logging
  console.log("GeneratedLinks - Links data:", links);
  console.log("GeneratedLinks - Links count:", links.length);
  if (links.length > 0) {
    console.log("GeneratedLinks - Sample link:", links[0]);
    console.log("GeneratedLinks - All campaign names:", links.map(l => l.utm_campaign));
    console.log("GeneratedLinks - Unique campaigns:", [...new Set(links.map(l => l.utm_campaign))]);
  }

  const handleCopyToClipboard = async (link: string) => {
    const success = await copyToClipboard(link);
    if (success) {
      toast({
        title: "Copied!",
        description: "UTM link copied to clipboard",
      });
    } else {
      toast({
        title: "Copy Failed",
        description: "Failed to copy link to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch("/api/utm-links/export");
      
      if (!response.ok) {
        throw new Error("Export failed");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `utm-links-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: "UTM links exported to CSV file",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export UTM links",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <List className="text-primary mr-2" size={20} />
            Generated Links
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group links by campaign
  const groupedByCampaign = links.reduce((acc, link) => {
    const campaignName = link.utm_campaign;
    if (!acc[campaignName]) {
      acc[campaignName] = [];
    }
    acc[campaignName].push(link);
    return acc;
  }, {} as Record<string, typeof links>);
  
  console.log("GeneratedLinks - Grouped by campaign:", groupedByCampaign);

  // Get all unique tags for filtering
  const allTags = Array.from(
    new Set(
      links.flatMap(link => link.tags || [])
    )
  ).sort();

  // Group links within each campaign by source and add landing pages info
  let campaignGroups = Object.entries(groupedByCampaign).map(([campaignName, campaignLinks]) => {
    const groupedBySource = campaignLinks.reduce((acc, link) => {
      const sourceName = link.utm_source;
      if (!acc[sourceName]) {
        acc[sourceName] = [];
      }
      acc[sourceName].push(link);
      return acc;
    }, {} as Record<string, typeof campaignLinks>);

    // Get landing pages for this campaign
    const campaignLandingPages = allLandingPages
      .filter(lp => lp.campaignName === campaignName)
      .map(lp => lp.url);

    // Get unique URLs from UTM links as well (fallback)
    const utmUrls = [...new Set(campaignLinks.map(link => link.targetUrl))];
    
    // Combine and deduplicate URLs
    const allUrls = [...new Set([...campaignLandingPages, ...utmUrls])];

    return {
      campaignName,
      landingPageUrls: allUrls,
      sources: Object.entries(groupedBySource).map(([sourceName, sourceLinks]) => ({
        sourceName,
        links: sourceLinks
      }))
    };
  });
  
  console.log("GeneratedLinks - Campaign groups before filtering:", campaignGroups);

  // Apply filtering by tag
  if (filterByTag !== "all") {
    campaignGroups = campaignGroups.filter(({ sources }) => {
      const allLinksInCampaign = sources.flatMap(source => source.links);
      const mostRecentLink = allLinksInCampaign.sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      })[0];
      const tags = mostRecentLink?.tags || [];
      
      if (filterByTag === "untagged") {
        return tags.length === 0;
      }
      return tags.includes(filterByTag);
    });
  }

  // Apply sorting
  campaignGroups = campaignGroups.sort((a, b) => {
    const aAllLinks = a.sources.flatMap(source => source.links);
    const bAllLinks = b.sources.flatMap(source => source.links);
    
    const aMostRecent = aAllLinks.sort((x, y) => {
      const xDate = x.createdAt ? new Date(x.createdAt).getTime() : 0;
      const yDate = y.createdAt ? new Date(y.createdAt).getTime() : 0;
      return yDate - xDate;
    })[0];
    const bMostRecent = bAllLinks.sort((x, y) => {
      const xDate = x.createdAt ? new Date(x.createdAt).getTime() : 0;
      const yDate = y.createdAt ? new Date(y.createdAt).getTime() : 0;
      return yDate - xDate;
    })[0];
    
    const aOldest = aAllLinks.sort((x, y) => {
      const xDate = x.createdAt ? new Date(x.createdAt).getTime() : 0;
      const yDate = y.createdAt ? new Date(y.createdAt).getTime() : 0;
      return xDate - yDate;
    })[0];
    const bOldest = bAllLinks.sort((x, y) => {
      const xDate = x.createdAt ? new Date(x.createdAt).getTime() : 0;
      const yDate = y.createdAt ? new Date(y.createdAt).getTime() : 0;
      return xDate - yDate;
    })[0];

    switch (sortBy) {
      case "created-newest":
        const aOldestDate = aOldest?.createdAt ? new Date(aOldest.createdAt).getTime() : 0;
        const bOldestDate = bOldest?.createdAt ? new Date(bOldest.createdAt).getTime() : 0;
        return bOldestDate - aOldestDate;
      case "created-oldest":
        const aOldestDate2 = aOldest?.createdAt ? new Date(aOldest.createdAt).getTime() : 0;
        const bOldestDate2 = bOldest?.createdAt ? new Date(bOldest.createdAt).getTime() : 0;
        return aOldestDate2 - bOldestDate2;
      case "updated-newest":
        const aMostRecentDate = aMostRecent?.createdAt ? new Date(aMostRecent.createdAt).getTime() : 0;
        const bMostRecentDate = bMostRecent?.createdAt ? new Date(bMostRecent.createdAt).getTime() : 0;
        return bMostRecentDate - aMostRecentDate;
      case "updated-oldest":
        const aMostRecentDate2 = aMostRecent?.createdAt ? new Date(aMostRecent.createdAt).getTime() : 0;
        const bMostRecentDate2 = bMostRecent?.createdAt ? new Date(bMostRecent.createdAt).getTime() : 0;
        return aMostRecentDate2 - bMostRecentDate2;
      case "tag-alphabetical":
        const aTags = aMostRecent?.tags?.[0] || "zzz"; // Put untagged at end
        const bTags = bMostRecent?.tags?.[0] || "zzz";
        return aTags.localeCompare(bTags);
      default:
        return 0;
    }
  });
  
  console.log("GeneratedLinks - Final campaign groups:", campaignGroups);
  console.log("GeneratedLinks - Campaign groups length:", campaignGroups.length);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center">
            <List className="text-primary mr-2" size={20} />
            My Campaigns
          </CardTitle>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <SortAsc className="text-gray-500" size={16} />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created-newest">Created (Newest)</SelectItem>
                  <SelectItem value="created-oldest">Created (Oldest)</SelectItem>
                  <SelectItem value="updated-newest">Updated (Newest)</SelectItem>
                  <SelectItem value="updated-oldest">Updated (Oldest)</SelectItem>
                  <SelectItem value="tag-alphabetical">Tag (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter Dropdown */}
            <div className="flex items-center gap-2">
              <Filter className="text-gray-500" size={16} />
              <Select value={filterByTag} onValueChange={setFilterByTag}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by tag..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns</SelectItem>
                  <SelectItem value="untagged">Untagged</SelectItem>
                  {allTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Active Tags Filter Section */}
        {allTags.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Filter by tag:</span>
              <Badge 
                variant={filterByTag === "all" ? "default" : "outline"}
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => setFilterByTag("all")}
              >
                All
              </Badge>
              {allTags.map(tag => (
                <Badge 
                  key={tag}
                  variant={filterByTag === tag ? "default" : "outline"}
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => setFilterByTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
              <Badge 
                variant={filterByTag === "untagged" ? "default" : "outline"}
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => setFilterByTag("untagged")}
              >
                Untagged
              </Badge>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <List size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No UTM links yet</h3>
            <p className="text-gray-600">Generate your first UTM link to get started</p>
          </div>
        ) : (
          <div className="space-y-8">
            {campaignGroups.map(({ campaignName, landingPageUrls, sources }) => {
              const isCollapsed = isCampaignCollapsed(campaignName);
              
              return (
                <div key={campaignName} className="space-y-6">
                  <CampaignCard
                    campaignName={campaignName}
                    landingPageUrls={landingPageUrls}
                    sources={sources}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={() => toggleCampaignCollapse(campaignName)}
                    isArchived={sources.some(source => source.links.some(link => link.isArchived))}
                  />

                  {/* Sources for this campaign - only show when not collapsed */}
                  {!isCollapsed && sources.map(({ sourceName, links: sourceLinks }) => {
                    const handleCopySourceLinks = async () => {
                      // New format: Campaign: Campaign Name, Source: Source Name, then links
                      let copyText = `Campaign: ${campaignName}\nSource: ${sourceName}\n\n`;
                      sourceLinks.forEach(link => {
                        const linkName = `${sourceName} ${link.utm_medium.charAt(0).toUpperCase() + link.utm_medium.slice(1)} ${link.utm_content || ''}`.trim();
                        copyText += `${linkName} - ${link.fullUtmLink}\n`;
                      });

                      try {
                        await navigator.clipboard.writeText(copyText);
                        toast({
                          title: "Source links copied!",
                          description: `Copied ${sourceLinks.length} links for ${sourceName}`,
                        });
                      } catch (err) {
                        console.error('Failed to copy source links:', err);
                        toast({
                          title: "Copy failed",
                          description: "Could not copy links to clipboard",
                          variant: "destructive",
                        });
                      }
                    };

                    return (
                      <Card key={`${campaignName}-${sourceName}`} className="border-l-4 border-l-blue-500">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{sourceName}</h3>
                            <Button
                              onClick={handleCopySourceLinks}
                              variant="outline"
                              size="sm"
                              className="text-primary hover:text-primary/80"
                            >
                              <Copy className="mr-2" size={14} />
                              Copy Source Links
                            </Button>
                          </div>
                      
                          {/* Desktop: Headers */}
                          <div className="hidden md:grid gap-4 mb-2 px-3" style={{ gridTemplateColumns: '1fr 120px 220px 180px 1fr 80px' }}>
                            <span className="text-sm font-medium">Landing Page</span>
                            <span className="text-sm font-medium">Medium</span>
                            <span className="text-sm font-medium">Content</span>
                            <span className="text-sm font-medium">Link name</span>
                            <span className="text-sm font-medium">UTM Link</span>
                            <span className="text-sm font-medium"></span>
                          </div>
                          
                          {/* Desktop: Grid rows */}
                          <div className="hidden md:block space-y-2">
                            {sourceLinks.map((link) => {
                              const linkName = `${sourceName} ${link.utm_medium.charAt(0).toUpperCase() + link.utm_medium.slice(1)} ${link.utm_content || ''}`.trim();
                              
                              return (
                                <div key={link.id} className="grid gap-4 items-start" style={{ gridTemplateColumns: '1fr 120px 220px 180px 1fr 80px' }}>
                                  <div className="bg-gray-50 border rounded p-3 min-h-[44px] break-all text-xs leading-relaxed w-full">
                                    {link.targetUrl}
                                  </div>
                                  <input 
                                    value={link.utm_medium} 
                                    readOnly 
                                    className="bg-gray-50 border rounded px-3 py-2 text-sm w-full" 
                                  />
                                  <input
                                    value={link.utm_content || ''}
                                    readOnly
                                    className="bg-gray-50 border rounded px-3 py-2 text-sm w-full"
                                  />
                                  <input
                                    value={linkName}
                                    readOnly
                                    className="bg-gray-50 border rounded px-3 py-2 text-sm w-full"
                                  />
                                  <div className="bg-gray-50 border rounded p-3 min-h-[44px] break-all text-xs leading-relaxed w-full">
                                    {link.fullUtmLink}
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCopyToClipboard(link.fullUtmLink)}
                                    className="w-full mt-1"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>

                          {/* Mobile: Stacked layout */}
                          <div className="md:hidden space-y-4">
                            {sourceLinks.map((link) => {
                              const linkName = `${sourceName} ${link.utm_medium.charAt(0).toUpperCase() + link.utm_medium.slice(1)} ${link.utm_content || ''}`.trim();
                              
                              return (
                                <div key={link.id} className="border rounded-lg p-3 space-y-3">
                                  {/* Landing Page full width */}
                                  <div>
                                    <span className="text-xs text-gray-600 mb-1 block">Landing Page</span>
                                    <div className="bg-gray-50 border rounded p-2 min-h-[36px] break-all text-xs leading-relaxed w-full">
                                      {link.targetUrl}
                                    </div>
                                  </div>
                                  
                                  {/* Medium and Content on same line */}
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <span className="text-xs text-gray-600 mb-1 block">Medium</span>
                                      <input 
                                        value={link.utm_medium} 
                                        readOnly 
                                        className="bg-gray-50 border rounded px-2 py-1 text-sm w-full" 
                                      />
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-600 mb-1 block">Content</span>
                                      <input
                                        value={link.utm_content || ''}
                                        readOnly
                                        className="bg-gray-50 border rounded px-2 py-1 text-sm w-full"
                                      />
                                    </div>
                                  </div>
                                  
                                  {/* Link name below */}
                                  <div>
                                    <span className="text-xs text-gray-600 mb-1 block">Link name</span>
                                    <input
                                      value={linkName}
                                      readOnly
                                      className="bg-gray-50 border rounded px-2 py-1 text-sm w-full"
                                    />
                                  </div>
                                  
                                  {/* UTM Link below - with line breaks if needed */}
                                  <div>
                                    <span className="text-xs text-gray-600 mb-1 block">UTM Link</span>
                                    <div className="bg-gray-50 border rounded p-2 min-h-[60px] break-all text-xs leading-relaxed">
                                      {link.fullUtmLink}
                                    </div>
                                  </div>
                                  
                                  {/* Copy button below UTM link */}
                                  <div className="pt-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCopyToClipboard(link.fullUtmLink)}
                                      className="w-full"
                                    >
                                      <Copy className="w-4 h-4 mr-2" />
                                      Copy Link
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
