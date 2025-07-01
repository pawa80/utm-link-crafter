import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, ThumbsUp, ThumbsDown, X, Zap, Target, MessageSquare, Layout } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AbTestSuggestion {
  id: number;
  campaignName: string;
  sourceName: string;
  medium: string;
  originalContent: string;
  suggestedVariants: string[];
  suggestionReason: string;
  confidence: number;
  testType: string;
  status: string;
  createdAt: string;
}

interface ABTestSuggestionsProps {
  campaignName?: string;
  userId: number;
}

const getTestTypeIcon = (testType: string) => {
  switch (testType) {
    case "content": return <MessageSquare className="w-4 h-4" />;
    case "cta": return <Target className="w-4 h-4" />;
    case "messaging": return <Zap className="w-4 h-4" />;
    case "format": return <Layout className="w-4 h-4" />;
    default: return <Lightbulb className="w-4 h-4" />;
  }
};

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 4) return "bg-green-100 text-green-800";
  if (confidence >= 3) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
};

export default function ABTestSuggestions({ campaignName, userId }: ABTestSuggestionsProps) {
  const { toast } = useToast();
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<number>>(new Set());

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: campaignName ? ["/api/ab-test-suggestions", campaignName] : ["/api/ab-test-suggestions"],
    queryFn: async () => {
      const endpoint = campaignName 
        ? `/api/ab-test-suggestions/${encodeURIComponent(campaignName)}`
        : "/api/ab-test-suggestions";
      const response = await apiRequest(endpoint);
      return response.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest(`/api/ab-test-suggestions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ab-test-suggestions"] });
      toast({
        title: "Updated",
        description: "Suggestion status updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update suggestion status",
        variant: "destructive",
      });
    },
  });

  const deleteSuggestionMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/ab-test-suggestions/${id}`, {
        method: "DELETE",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ab-test-suggestions"] });
      toast({
        title: "Deleted",
        description: "Suggestion removed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete suggestion",
        variant: "destructive",
      });
    },
  });

  const generateSuggestionsMutation = useMutation({
    mutationFn: async ({ campaignName, sourceName, medium, content }: {
      campaignName: string;
      sourceName: string;
      medium: string;
      content: string;
    }) => {
      const response = await apiRequest("/api/ab-test-suggestions/generate", {
        method: "POST",
        body: JSON.stringify({ campaignName, sourceName, medium, content }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ab-test-suggestions"] });
      toast({
        title: "Success",
        description: "A/B test suggestions generated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate suggestions",
        variant: "destructive",
      });
    },
  });

  const toggleExpanded = (id: number) => {
    setExpandedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleStatusUpdate = (id: number, status: string) => {
    updateStatusMutation.mutate({ id, status });
  };

  const handleDelete = (id: number) => {
    deleteSuggestionMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const pendingSuggestions = suggestions.filter((s: AbTestSuggestion) => s.status === "pending");
  const acceptedSuggestions = suggestions.filter((s: AbTestSuggestion) => s.status === "accepted");
  const implementedSuggestions = suggestions.filter((s: AbTestSuggestion) => s.status === "implemented");

  return (
    <div className="space-y-6">
      {pendingSuggestions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Pending A/B Test Suggestions ({pendingSuggestions.length})
          </h3>
          <div className="space-y-4">
            {pendingSuggestions.map((suggestion: AbTestSuggestion) => (
              <Card key={suggestion.id} className="border-l-4 border-l-yellow-400">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {getTestTypeIcon(suggestion.testType)}
                      <div>
                        <CardTitle className="text-sm font-medium">
                          {suggestion.sourceName} • {suggestion.medium}
                        </CardTitle>
                        <p className="text-xs text-gray-500 mt-1">
                          Campaign: {suggestion.campaignName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getConfidenceColor(suggestion.confidence)}>
                        Confidence: {suggestion.confidence}/5
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {suggestion.testType}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">{suggestion.suggestionReason}</p>
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-xs text-gray-500 mb-1">Original Content:</p>
                        <p className="text-sm font-mono">{suggestion.originalContent}</p>
                      </div>
                    </div>
                    
                    {expandedSuggestions.has(suggestion.id) && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500">Suggested Variants:</p>
                        {suggestion.suggestedVariants.map((variant, index) => (
                          <div key={index} className="bg-blue-50 p-3 rounded border-l-2 border-blue-200">
                            <p className="text-sm font-mono">{variant}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(suggestion.id)}
                      >
                        {expandedSuggestions.has(suggestion.id) ? "Hide" : "Show"} Variants ({suggestion.suggestedVariants.length})
                      </Button>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusUpdate(suggestion.id, "accepted")}
                          disabled={updateStatusMutation.isPending}
                        >
                          <ThumbsUp className="w-3 h-3 mr-1" />
                          Accept
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusUpdate(suggestion.id, "rejected")}
                          disabled={updateStatusMutation.isPending}
                        >
                          <ThumbsDown className="w-3 h-3 mr-1" />
                          Reject
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(suggestion.id)}
                          disabled={deleteSuggestionMutation.isPending}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {acceptedSuggestions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ThumbsUp className="w-5 h-5 text-green-500" />
            Accepted Suggestions ({acceptedSuggestions.length})
          </h3>
          <div className="space-y-4">
            {acceptedSuggestions.map((suggestion: AbTestSuggestion) => (
              <Card key={suggestion.id} className="border-l-4 border-l-green-400">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{suggestion.sourceName} • {suggestion.medium}</p>
                      <p className="text-xs text-gray-500">{suggestion.suggestionReason}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusUpdate(suggestion.id, "implemented")}
                      disabled={updateStatusMutation.isPending}
                    >
                      Mark Implemented
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {suggestions.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No A/B Test Suggestions</h3>
            <p className="text-gray-500 mb-4">
              Create campaigns with content to get automated A/B testing suggestions.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}