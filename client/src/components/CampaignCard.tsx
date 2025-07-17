import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, Edit, Copy, Archive, ArchiveRestore } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { UtmLink, CampaignLandingPage } from "@shared/schema";

interface CampaignCardProps {
  campaignName: string;
  landingPageUrls?: string[];
  sources: Array<{
    sourceName: string;
    links: UtmLink[];
  }>;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isArchived?: boolean;
}

export default function CampaignCard({ 
  campaignName, 
  landingPageUrls = [],
  sources, 
  isCollapsed, 
  onToggleCollapse,
  isArchived = false
}: CampaignCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  
  // Note: Landing page URLs are now passed as props from the parent component

  // Get tags from the most recent link in campaign
  const allLinksInCampaign = sources.flatMap(source => source.links);
  const mostRecentLink = allLinksInCampaign.sort((a, b) => {
    const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bDate - aDate;
  })[0];
  const tags = mostRecentLink?.tags || [];

  // Get all links for this campaign for copying
  const allCampaignLinks = sources.flatMap(source => source.links.map(link => link.fullUtmLink));

  // Archive campaign mutation
  const archiveCampaignMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/campaigns/${encodeURIComponent(campaignName)}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/utm-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-landing-pages"] });
      toast({
        title: "Campaign archived",
        description: `Campaign "${campaignName}" has been successfully archived.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Archive failed",
        description: error.message || "Could not archive campaign",
        variant: "destructive",
      });
    },
  });

  // Unarchive campaign mutation
  const unarchiveCampaignMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/campaigns/${encodeURIComponent(campaignName)}/unarchive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/utm-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-landing-pages"] });
      toast({
        title: "Campaign unarchived",
        description: `Campaign "${campaignName}" has been successfully unarchived.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Unarchive failed",
        description: error.message || "Could not unarchive campaign",
        variant: "destructive",
      });
    },
  });

  const handleArchiveCampaign = () => {
    archiveCampaignMutation.mutate();
    setShowArchiveDialog(false);
  };

  const handleUnarchiveCampaign = () => {
    unarchiveCampaignMutation.mutate();
  };

  const handleCopyAllCampaignLinks = async () => {
    // Group links by source for formatting
    const linksBySource: { [sourceName: string]: UtmLink[] } = {};
    sources.forEach(({ sourceName, links: sourceLinks }) => {
      linksBySource[sourceName] = sourceLinks;
    });

    // New format: Campaign: Campaign Name, then Source: for each source
    let copyText = `Campaign: ${campaignName}\n`;
    
    Object.entries(linksBySource).forEach(([sourceName, sourceLinks], index) => {
      copyText += `Source: ${sourceName}\n\n`;
      sourceLinks.forEach(link => {
        const linkName = `${sourceName} ${link.utm_medium.charAt(0).toUpperCase() + link.utm_medium.slice(1)} ${link.utm_content || ''}`.trim();
        copyText += `${linkName} - ${link.fullUtmLink}\n`;
      });
      
      // Add extra line break between sources, but not after the last one
      if (index < Object.entries(linksBySource).length - 1) {
        copyText += '\n';
      }
    });

    try {
      await navigator.clipboard.writeText(copyText);
      toast({
        title: "Links copied!",
        description: `Copied ${allCampaignLinks.length} links for ${campaignName}`,
      });
    } catch (err) {
      console.error('Failed to copy links:', err);
      toast({
        title: "Copy failed",
        description: "Could not copy links to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Campaign header - desktop layout */}
      <div className="hidden md:flex items-center justify-between border-b border-gray-200 pb-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {campaignName}
          </h2>
          
          {/* Landing Page URLs - one row per URL */}
          {landingPageUrls.map((url, index) => (
            <div key={index} className="text-sm text-gray-600 mt-1">
              {url}
            </div>
          ))}
          
          {/* UTM Links count */}
          <div className="text-sm text-gray-500 mt-2">
            {allLinksInCampaign.length} UTM {allLinksInCampaign.length === 1 ? 'Link' : 'Links'}
          </div>
          
          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.map((tag: string, index: number) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isArchived && (
            <Link to={`/new-campaign?edit=${encodeURIComponent(campaignName)}`}>
              <Button
                variant="outline"
                size="sm"
                className="text-primary hover:text-primary/80"
              >
                <Edit className="mr-2" size={16} />
                Edit
              </Button>
            </Link>
          )}
          <Button
            onClick={onToggleCollapse}
            variant="outline"
            size="sm"
            className="text-primary hover:text-primary/80"
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="mr-2" size={16} />
                Show Links
              </>
            ) : (
              <>
                <ChevronUp className="mr-2" size={16} />
                Hide Links
              </>
            )}
          </Button>
          <Button
            onClick={handleCopyAllCampaignLinks}
            variant="outline"
            size="sm"
            className="text-primary hover:text-primary/80"
          >
            <Copy className="mr-2" size={16} />
            Copy Links
          </Button>
          {isArchived ? (
            <Button
              onClick={handleUnarchiveCampaign}
              variant="outline"
              size="sm"
              className="text-green-600 hover:text-green-700 border-green-300 hover:border-green-400"
              disabled={unarchiveCampaignMutation.isPending}
            >
              <ArchiveRestore className="mr-2" size={16} />
              {unarchiveCampaignMutation.isPending ? "Unarchiving..." : "Unarchive"}
            </Button>
          ) : (
            <Button
              onClick={() => setShowArchiveDialog(true)}
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
            >
              <Archive className="mr-2" size={16} />
              Archive
            </Button>
          )}
        </div>
      </div>

      {/* Campaign header - mobile layout */}
      <div className="md:hidden border-b border-gray-200 pb-3">
        <h2 className="text-xl font-bold text-gray-900">
          {campaignName}
        </h2>
        
        {/* Landing Page URLs - one row per URL */}
        {landingPageUrls.map((url, index) => (
          <div key={index} className="text-sm text-gray-600 mt-1">
            {url}
          </div>
        ))}
        
        {/* UTM Links count */}
        <div className="text-sm text-gray-500 mt-2">
          {allLinksInCampaign.length} UTM {allLinksInCampaign.length === 1 ? 'Link' : 'Links'}
        </div>
        
        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map((tag: string, index: number) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        
        {/* Mobile Action Buttons */}
        <div className="flex flex-col gap-2 mt-3">
          <div className="flex gap-2">
            {!isArchived && (
              <Link to={`/new-campaign?edit=${encodeURIComponent(campaignName)}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-primary hover:text-primary/80 flex-1"
                >
                  <Edit className="mr-2" size={16} />
                  Edit
                </Button>
              </Link>
            )}
            <Button
              onClick={onToggleCollapse}
              variant="outline"
              size="sm"
              className="text-primary hover:text-primary/80 flex-1"
            >
              {isCollapsed ? (
                <>
                  <ChevronDown className="mr-2" size={16} />
                  Show Links
                </>
              ) : (
                <>
                  <ChevronUp className="mr-2" size={16} />
                  Hide Links
                </>
              )}
            </Button>
          </div>
          <Button
            onClick={handleCopyAllCampaignLinks}
            variant="outline"
            size="sm"
            className="text-primary hover:text-primary/80"
          >
            <Copy className="mr-2" size={16} />
            Copy Links
          </Button>
          {isArchived ? (
            <Button
              onClick={handleUnarchiveCampaign}
              variant="outline"
              size="sm"
              className="text-green-600 hover:text-green-700 border-green-300 hover:border-green-400"
              disabled={unarchiveCampaignMutation.isPending}
            >
              <ArchiveRestore className="mr-2" size={16} />
              {unarchiveCampaignMutation.isPending ? "Unarchiving..." : "Unarchive"}
            </Button>
          ) : (
            <Button
              onClick={() => setShowArchiveDialog(true)}
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
            >
              <Archive className="mr-2" size={16} />
              Archive
            </Button>
          )}
        </div>
      </div>

      {/* Archive Campaign Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive the campaign "{campaignName}"? This will hide the campaign from your active campaigns view. You can unarchive it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveCampaign}
              disabled={archiveCampaignMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {archiveCampaignMutation.isPending ? "Archiving..." : "Archive Campaign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}