import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import AuthScreen from "@/components/AuthScreen";
import UserHeader from "@/components/UserHeader";
import Logo from "@/components/Logo";
import { ArrowLeft, Plus, Trash2, Tag, Edit2, Check, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUser } from "@/lib/auth";
import type { User as AuthUser } from "firebase/auth";
import type { User, Tag as TagType, UtmLink } from "@shared/schema";

interface TagWithStats {
  id: number;
  name: string;
  campaignCount: number;
  utmLinkCount: number;
}

export default function TagManagement() {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const [newTagName, setNewTagName] = useState("");
  const [editingTag, setEditingTag] = useState<{ id: number; name: string } | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setAuthUser(firebaseUser);
        try {
          const userData = await getUser(firebaseUser);
          setUser(userData);
        } catch (error) {
          console.error("Error creating/getting user:", error);
        }
      } else {
        setAuthUser(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAuthSuccess = async () => {
    // Auth state change will be handled by the useEffect
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setLocation("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Fetch tags
  const { data: tags = [] } = useQuery<TagType[]>({
    queryKey: ["/api/tags"],
    enabled: !!user,
  });

  // Fetch UTM links to calculate tag usage
  const { data: utmLinks = [] } = useQuery<UtmLink[]>({
    queryKey: ["/api/utm-links"],
    enabled: !!user,
  });

  // Calculate tag statistics
  const tagsWithStats: TagWithStats[] = tags.map(tag => {
    // Count unique campaigns that use this tag
    const campaignsWithTag = new Set(
      utmLinks
        .filter(link => link.tags && link.tags.includes(tag.name))
        .map(link => link.utm_campaign)
    );
    
    // Count UTM links that use this tag
    const utmLinksWithTag = utmLinks.filter(link => 
      link.tags && link.tags.includes(tag.name)
    );

    return {
      id: tag.id,
      name: tag.name,
      campaignCount: campaignsWithTag.size,
      utmLinkCount: utmLinksWithTag.length,
    };
  });

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (tagName: string) => {
      const response = await apiRequest("POST", "/api/tags", { name: tagName });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setNewTagName("");
      toast({
        title: "Tag created",
        description: "Your new tag has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Creation failed",
        description: error.message || "Could not create tag",
        variant: "destructive",
      });
    },
  });

  // Update tag mutation
  const updateTagMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const response = await apiRequest("PUT", `/api/tags/${id}`, { name });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/utm-links"] });
      setEditingTag(null);
      toast({
        title: "Tag updated",
        description: "Tag has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Could not update tag",
        variant: "destructive",
      });
    },
  });

  // Delete tag mutation
  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      await apiRequest("DELETE", `/api/tags/${tagId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/utm-links"] });
      toast({
        title: "Tag deleted",
        description: "Tag has been deleted and removed from all campaigns.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Deletion failed",
        description: error.message || "Could not delete tag",
        variant: "destructive",
      });
    },
  });

  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagName.trim()) {
      createTagMutation.mutate(newTagName.trim());
    }
  };

  const handleEditTag = (tag: TagType) => {
    setEditingTag({ id: tag.id, name: tag.name });
  };

  const handleSaveEdit = () => {
    if (editingTag && editingTag.name.trim()) {
      updateTagMutation.mutate({ id: editingTag.id, name: editingTag.name.trim() });
    }
  };

  const handleCancelEdit = () => {
    setEditingTag(null);
  };

  const handleDeleteTag = (tagId: number, tagName: string) => {
    if (confirm(`Are you sure you want to delete the tag "${tagName}"? This will remove it from all campaigns and UTM links. Campaigns without any remaining tags will be marked as "Untagged".`)) {
      deleteTagMutation.mutate(tagId);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authUser || !user) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Top Navigation with Logo and User */}
        <div className="flex justify-between items-center mb-6 pt-4">
          <div className="flex items-center space-x-4">
            <Logo />
            <Link href="/settings">
              <Button variant="ghost">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Settings
              </Button>
            </Link>
          </div>
          <UserHeader user={user} onLogout={handleLogout} />
        </div>

        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Tag Management</h1>
            <p className="text-gray-600">
              Organize and manage your campaign tags with usage statistics
            </p>
          </div>

          {/* Create New Tag */}
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Plus className="mr-2" size={20} />
                Create New Tag
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTag} className="space-y-4">
                <div>
                  <Label htmlFor="tagName">Tag Name</Label>
                  <Input
                    id="tagName"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Enter tag name..."
                    disabled={createTagMutation.isPending}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={createTagMutation.isPending || !newTagName.trim()}
                >
                  {createTagMutation.isPending ? "Creating..." : "Create Tag"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Existing Tags */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 text-center">
              Existing Tags ({tagsWithStats.length})
            </h2>
            
            {tagsWithStats.length === 0 ? (
              <Card className="max-w-md mx-auto">
                <CardContent className="text-center py-8">
                  <Tag className="mx-auto mb-4 text-gray-400" size={48} />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No tags yet</h3>
                  <p className="text-gray-600">Create your first tag to organize your campaigns</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
                {tagsWithStats.map((tagWithStats) => {
                  const tag = tags.find(t => t.id === tagWithStats.id);
                  const isEditing = editingTag?.id === tagWithStats.id;
                  
                  return (
                    <Card key={tagWithStats.id} className="hover:shadow-lg transition-shadow duration-200">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          {isEditing ? (
                            <div className="flex items-center space-x-2 flex-1">
                              <Input
                                value={editingTag.name}
                                onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                                className="text-sm"
                                disabled={updateTagMutation.isPending}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit();
                                  if (e.key === 'Escape') handleCancelEdit();
                                }}
                                autoFocus
                              />
                            </div>
                          ) : (
                            <Badge variant="secondary" className="text-sm">
                              {tagWithStats.name}
                            </Badge>
                          )}
                          <div className="flex space-x-1">
                            {isEditing ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleSaveEdit}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  disabled={updateTagMutation.isPending || !editingTag.name.trim()}
                                >
                                  <Check size={16} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleCancelEdit}
                                  className="text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                                  disabled={updateTagMutation.isPending}
                                >
                                  <X size={16} />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditTag(tag!)}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  disabled={deleteTagMutation.isPending || updateTagMutation.isPending}
                                >
                                  <Edit2 size={16} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteTag(tagWithStats.id, tagWithStats.name)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  disabled={deleteTagMutation.isPending || updateTagMutation.isPending}
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex justify-between items-center">
                            <span>Campaigns:</span>
                            <Badge variant="outline" className="text-xs">
                              {tagWithStats.campaignCount}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>UTM Links:</span>
                            <Badge variant="outline" className="text-xs">
                              {tagWithStats.utmLinkCount}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}