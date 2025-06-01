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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <List className="text-primary mr-2" size={20} />
            Generated Links
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
          <div className="space-y-4">
            {links.map((link) => (
              <div 
                key={link.id} 
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">
                      {link.utm_campaign}
                    </span>
                    <span className="text-xs text-gray-500">
                      {link.createdAt && formatDistanceToNow(new Date(link.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge variant="secondary">{link.utm_source}</Badge>
                    <Badge variant="secondary">{link.utm_medium}</Badge>
                    {link.utm_content && (
                      <Badge variant="secondary">{link.utm_content}</Badge>
                    )}
                    {link.category && (
                      <Badge variant="outline">{link.category}</Badge>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded border">
                  <div className="flex items-start justify-between gap-2">
                    <code className="text-xs text-gray-700 break-all flex-1">
                      {link.fullUtmLink}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyToClipboard(link.fullUtmLink)}
                      className="flex-shrink-0 text-primary hover:text-primary/80"
                    >
                      <Copy size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
