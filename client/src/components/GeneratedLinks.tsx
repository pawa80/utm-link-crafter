import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/lib/utm";
import { formatDistanceToNow } from "date-fns";
import { List, Copy, Download } from "lucide-react";
import type { UtmLink } from "@shared/schema";

export default function GeneratedLinks() {
  const { toast } = useToast();

  const { data: links = [], isLoading } = useQuery<UtmLink[]>({
    queryKey: ["/api/utm-links"],
  });

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

  // Group links within each campaign by source
  const campaignGroups = Object.entries(groupedByCampaign).map(([campaignName, campaignLinks]) => {
    const groupedBySource = campaignLinks.reduce((acc, link) => {
      const sourceName = link.utm_source;
      if (!acc[sourceName]) {
        acc[sourceName] = [];
      }
      acc[sourceName].push(link);
      return acc;
    }, {} as Record<string, typeof campaignLinks>);

    return {
      campaignName,
      sources: Object.entries(groupedBySource).map(([sourceName, sourceLinks]) => ({
        sourceName,
        links: sourceLinks
      }))
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <List className="text-primary mr-2" size={20} />
            My Campaigns
          </div>
          {links.length > 0 && (
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              className="text-primary hover:text-primary/80"
            >
              <Download className="mr-2" size={16} />
              Export CSV
            </Button>
          )}
        </CardTitle>
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
            {campaignGroups.map(({ campaignName, sources }) => (
              <div key={campaignName} className="space-y-6">
                {/* Campaign header - only shown once per campaign */}
                <h2 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-2">
                  {campaignName}
                </h2>
                
                {/* Sources for this campaign */}
                {sources.map(({ sourceName, links: sourceLinks }) => (
                  <Card key={`${campaignName}-${sourceName}`} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold mb-4">{sourceName}</h3>
                      
                      {/* Desktop: Headers */}
                      <div className="hidden md:grid md:grid-cols-4 gap-4 mb-2">
                        <span className="text-sm font-medium">Medium</span>
                        <span className="text-sm font-medium">Content</span>
                        <span className="text-sm font-medium">Link name</span>
                        <span className="text-sm font-medium">UTM Link</span>
                      </div>
                      
                      {/* Desktop: Grid rows */}
                      <div className="hidden md:block space-y-2">
                        {sourceLinks.map((link) => {
                          const linkName = `${sourceName} ${link.utm_medium.charAt(0).toUpperCase() + link.utm_medium.slice(1)} ${link.utm_content || ''}`.trim();
                          
                          return (
                            <div key={link.id} className="grid grid-cols-4 gap-4 items-center">
                              <input 
                                value={link.utm_medium} 
                                readOnly 
                                className="bg-gray-50 border rounded px-3 py-2 text-sm" 
                              />
                              <input
                                value={link.utm_content || ''}
                                readOnly
                                className="bg-gray-50 border rounded px-3 py-2 text-sm"
                              />
                              <input
                                value={linkName}
                                readOnly
                                className="bg-gray-50 border rounded px-3 py-2 text-sm"
                              />
                              <div className="flex">
                                <input
                                  value={link.fullUtmLink}
                                  readOnly
                                  className="flex-1 bg-gray-50 border rounded px-3 py-2 text-xs"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopyToClipboard(link.fullUtmLink)}
                                  className="ml-2"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
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
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
