import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import AuthScreen from "@/components/AuthScreen";
import UserHeader from "@/components/UserHeader";
import { ArrowLeft, Plus, Archive, ArchiveRestore, Trash2, Settings, ArrowUpDown } from "lucide-react";
import { Link, useLocation } from "wouter";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createOrGetUser } from "@/lib/auth";
import type { User as AuthUser } from "firebase/auth";
import type { User, SourceTemplate, UtmLink, UserUtmTemplate } from "@shared/schema";

// Component to display content for a specific medium
function MediumContentDisplay({ 
  source, 
  medium, 
  useUtmContent,
  user
}: { 
  source: string; 
  medium: string; 
  useUtmContent: (source: string, medium: string) => any;
  user: User;
}) {
  const [showAddContent, setShowAddContent] = useState(false);
  const [newContentText, setNewContentText] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: contentOptions = [], isLoading, error } = useUtmContent(source, medium);
  
  // Fetch user templates for this source-medium combination
  const { data: userTemplates = [] } = useQuery<UserUtmTemplate[]>({
    queryKey: ["/api/user-utm-templates", source, medium],
    enabled: !!user,
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      const firebaseUid = auth.currentUser?.uid;
      const response = await fetch(`/api/user-utm-templates`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-firebase-uid': firebaseUid || '',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch user templates');
      const allTemplates = await response.json();
      return allTemplates.filter((t: UserUtmTemplate) => t.utmSource === source && t.utmMedium === medium);
    }
  });

  // Create mutation for adding new content
  const addContentMutation = useMutation({
    mutationFn: async (contentText: string) => {
      const response = await apiRequest("POST", "/api/user-utm-templates", {
        utmSource: source,
        utmMedium: medium,
        utmContent: contentText,
        description: `Custom content for ${source}/${medium}`,
        isCustom: true
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/utm-content", source, medium] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-utm-templates", source, medium] });
      setNewContentText("");
      setShowAddContent(false);
      toast({
        title: "Success",
        description: "Content added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add content",
        variant: "destructive",
      });
    }
  });

  // Archive content mutation
  const archiveContentMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const response = await apiRequest("PATCH", `/api/user-utm-templates/${templateId}/archive`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/utm-content", source, medium] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-utm-templates", source, medium] });
      toast({
        title: "Success",
        description: "Content archived successfully",
      });
    }
  });

  const handleAddContent = () => {
    if (!newContentText.trim()) return;
    addContentMutation.mutate(newContentText.trim());
  };

  const getUserTemplateItem = (content: string) => {
    return userTemplates.find(ut => ut.utmContent === content);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="animate-pulse bg-gray-200 h-6 w-20 rounded"></div>
          <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs text-red-600">
            Error loading content
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {contentOptions.length > 0 ? (
          contentOptions.map((content: string) => {
            const userTemplateItem = getUserTemplateItem(content);
            const isCustomContent = userTemplateItem?.isCustom || false;
            
            return (
              <div key={content} className="flex items-center gap-1">
                <Badge 
                  variant="outline" 
                  className={`text-xs ${isCustomContent ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}
                >
                  {content}
                  {isCustomContent && <span className="ml-1 text-blue-600">*</span>}
                </Badge>
                {isCustomContent && userTemplateItem && (
                  <Button
                    onClick={() => archiveContentMutation.mutate(userTemplateItem.id)}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-red-500 p-0 h-4 w-4"
                    disabled={archiveContentMutation.isPending}
                  >
                    <Trash2 size={10} />
                  </Button>
                )}
              </div>
            );
          })
        ) : (
          <Badge variant="outline" className="text-xs text-gray-500">
            No content available
          </Badge>
        )}
        
        {/* Add Content Button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAddContent(true)}
          className="h-6 text-xs"
        >
          <Plus size={12} className="mr-1" />
          Add Content
        </Button>
      </div>
      
      {/* Add content input */}
      {showAddContent && (
        <div className="flex items-center space-x-2 mt-2">
          <Input
            value={newContentText}
            onChange={(e) => setNewContentText(e.target.value)}
            placeholder="Add content (e.g., text-ad, banner, video)"
            className="flex-1 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddContent();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddContent}
            disabled={!newContentText.trim() || addContentMutation.isPending}
          >
            Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowAddContent(false);
              setNewContentText("");
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

export default function TemplateManagement() {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const [showArchived, setShowArchived] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newMediums, setNewMediums] = useState<{ [sourceId: number]: string }>({});
  const [sortBy, setSortBy] = useState<"updated" | "alphabetic-az" | "alphabetic-za">("updated");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setAuthUser(firebaseUser);
        try {
          const userData = await createOrGetUser(firebaseUser);
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

  // Fetch source templates
  const { data: sourceTemplates = [] } = useQuery<SourceTemplate[]>({
    queryKey: ["/api/source-templates"],
    enabled: !!user,
  });

  // Fetch UTM links to check usage
  const { data: utmLinks = [] } = useQuery<UtmLink[]>({
    queryKey: ["/api/utm-links"],
    enabled: !!user,
  });

  // Function to fetch content for a specific source-medium combination
  const useUtmContent = (source: string, medium: string) => {
    return useQuery<string[]>({
      queryKey: ["/api/utm-content", source, medium],
      enabled: !!source && !!medium && !!user,
      queryFn: async () => {
        const token = await auth.currentUser?.getIdToken();
        const firebaseUid = auth.currentUser?.uid;
        const response = await fetch(`/api/utm-content/${encodeURIComponent(source)}/${encodeURIComponent(medium)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-firebase-uid': firebaseUid || '',
          },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch content');
        }
        return response.json();
      }
    });
  };

  // Create source template
  const createSourceMutation = useMutation({
    mutationFn: async (sourceData: { sourceName: string; mediums: string[] }) => {
      const response = await apiRequest("POST", "/api/source-templates", sourceData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/source-templates"] });
      setNewSourceName("");
      toast({
        title: "Success",
        description: "Source created successfully",
      });
    },
  });

  // Update source template
  const updateSourceMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<SourceTemplate> }) => {
      const response = await apiRequest("PATCH", `/api/source-templates/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/source-templates"] });
    },
  });

  // Check if a source is in use
  const isSourceInUse = (sourceName: string) => {
    return utmLinks.some(link => link.utm_source === sourceName.toLowerCase());
  };

  // Check if a medium is in use
  const isMediumInUse = (sourceName: string, medium: string) => {
    return utmLinks.some(link => 
      link.utm_source === sourceName.toLowerCase() && link.utm_medium === medium
    );
  };

  // Archive/unarchive source
  const toggleSourceArchive = async (template: SourceTemplate) => {
    if (!template.isArchived && isSourceInUse(template.sourceName)) {
      toast({
        title: "Cannot Archive",
        description: "This source is currently used in campaigns and cannot be archived.",
        variant: "destructive",
      });
      return;
    }

    await updateSourceMutation.mutateAsync({
      id: template.id,
      updates: { isArchived: !template.isArchived }
    });

    toast({
      title: "Success",
      description: `Source ${template.isArchived ? 'unarchived' : 'archived'} successfully`,
    });
  };

  // Archive/unarchive medium
  const toggleMediumArchive = async (template: SourceTemplate, medium: string) => {
    const archivedMediums = template.archivedMediums || [];
    const isCurrentlyArchived = archivedMediums.includes(medium);
    
    if (!isCurrentlyArchived && isMediumInUse(template.sourceName, medium)) {
      toast({
        title: "Cannot Archive",
        description: "This medium is currently used in campaigns and cannot be archived.",
        variant: "destructive",
      });
      return;
    }

    const newArchivedMediums = isCurrentlyArchived
      ? archivedMediums.filter(m => m !== medium)
      : [...archivedMediums, medium];

    await updateSourceMutation.mutateAsync({
      id: template.id,
      updates: { archivedMediums: newArchivedMediums }
    });

    toast({
      title: "Success",
      description: `Medium ${isCurrentlyArchived ? 'unarchived' : 'archived'} successfully`,
    });
  };

  // Add new medium to source
  const addMediumToSource = async (template: SourceTemplate) => {
    const newMedium = newMediums[template.id]?.trim();
    if (!newMedium) return;

    const updatedMediums = [...(template.mediums || []), newMedium];
    
    await updateSourceMutation.mutateAsync({
      id: template.id,
      updates: { mediums: updatedMediums }
    });

    setNewMediums(prev => ({ ...prev, [template.id]: "" }));
    toast({
      title: "Success",
      description: "Medium added successfully",
    });
  };



  // Create new source
  const handleCreateSource = async () => {
    if (!newSourceName.trim()) return;

    await createSourceMutation.mutateAsync({
      sourceName: newSourceName.trim(),
      mediums: []
    });
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

  // Sort sources based on selected criteria
  const sortSources = (sources: SourceTemplate[]) => {
    return [...sources].sort((a, b) => {
      switch (sortBy) {
        case "updated":
          // Newest first based on createdAt
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        case "alphabetic-az":
          return a.sourceName.localeCompare(b.sourceName);
        case "alphabetic-za":
          return b.sourceName.localeCompare(a.sourceName);
        default:
          return 0;
      }
    });
  };

  const filteredTemplates = showArchived 
    ? sortSources(sourceTemplates)
    : sortSources(sourceTemplates.filter(template => !template.isArchived));

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Top Navigation */}
        <div className="flex justify-between items-center mb-6 pt-4">
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <UserHeader user={user} onLogout={handleLogout} />
        </div>

        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Template Management</h1>
            <p className="text-gray-600">Manage your campaign sources and their mediums</p>
          </div>

          {/* Add New Source */}
          <div className="flex justify-center">
            <div className="flex items-center gap-2">
              <Input
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                placeholder="New source name"
                className="w-48"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateSource()}
              />
              <Button
                onClick={handleCreateSource}
                disabled={!newSourceName.trim() || createSourceMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="mr-2" size={16} />
                Add Source
              </Button>
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4" />
                <Label>Sort by:</Label>
                <Select value={sortBy} onValueChange={(value: "updated" | "alphabetic-az" | "alphabetic-za") => setSortBy(value)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated">Updated Date/Time (newest first)</SelectItem>
                    <SelectItem value="alphabetic-az">Alphabetic (A-Z)</SelectItem>
                    <SelectItem value="alphabetic-za">Alphabetic (Z-A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button
              variant={showArchived ? "default" : "outline"}
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2"
            >
              <Archive className="w-4 h-4" />
              {showArchived ? "Hide Archived" : "Show Archived"}
            </Button>
          </div>

          {/* Sources List */}
          <div className="grid gap-4">
            {filteredTemplates.map((template) => {
              const archivedMediums = template.archivedMediums || [];
              const activeMediums = (template.mediums || []).filter(m => !archivedMediums.includes(m));
              const mediumsToShow = showArchived ? template.mediums || [] : activeMediums;

              return (
                <Card key={template.id} className={`${template.isArchived ? 'bg-gray-100 border-gray-300' : ''}`}>
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <CardTitle className={`${template.isArchived ? 'text-gray-500' : ''}`}>
                          {template.sourceName}
                        </CardTitle>
                        {template.isArchived && (
                          <Badge variant="secondary" className="text-gray-500">
                            <Archive size={12} className="mr-1" />
                            Archived
                          </Badge>
                        )}
                        {isSourceInUse(template.sourceName) && (
                          <Badge variant="outline" className="text-blue-600">
                            In Use
                          </Badge>
                        )}
                      </div>
                      <Button
                        onClick={() => toggleSourceArchive(template)}
                        variant="outline"
                        size="sm"
                        className={template.isArchived ? "text-green-600 hover:text-green-700" : "text-orange-600 hover:text-orange-700"}
                      >
                        {template.isArchived ? (
                          <>
                            <ArchiveRestore size={16} className="mr-2" />
                            Unarchive
                          </>
                        ) : (
                          <>
                            <Archive size={16} className="mr-2" />
                            Archive
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Add Medium Section */}
                      {!template.isArchived && (
                        <div>
                          <Label className="text-sm font-medium mb-2 block">Add Medium</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              value={newMediums[template.id] || ""}
                              onChange={(e) => setNewMediums(prev => ({ ...prev, [template.id]: e.target.value }))}
                              placeholder="Add new medium"
                              className="w-48"
                              onKeyPress={(e) => e.key === 'Enter' && addMediumToSource(template)}
                            />
                            <Button
                              onClick={() => addMediumToSource(template)}
                              disabled={!newMediums[template.id]?.trim() || updateSourceMutation.isPending}
                              variant="outline"
                              size="sm"
                            >
                              <Plus size={16} className="mr-1" />
                              Add
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Mediums and Content Section */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Mediums & Content</Label>
                        {mediumsToShow.map((medium) => {
                          const isArchived = archivedMediums.includes(medium);
                          const inUse = isMediumInUse(template.sourceName, medium);
                          
                          return (
                            <div key={medium} className="border rounded-lg p-3 bg-gray-50">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Badge 
                                    variant={isArchived ? "secondary" : "default"}
                                    className={`text-sm font-medium ${isArchived ? 'text-gray-500 bg-gray-200' : ''}`}
                                  >
                                    {medium}
                                    {inUse && <span className="ml-1 text-xs">•</span>}
                                  </Badge>
                                  {isArchived && (
                                    <Badge variant="secondary" className="text-xs">
                                      Archived
                                    </Badge>
                                  )}
                                  {inUse && (
                                    <Badge variant="outline" className="text-xs text-blue-600">
                                      In Use
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  onClick={() => toggleMediumArchive(template, medium)}
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  {isArchived ? (
                                    <ArchiveRestore size={12} className="text-green-600" />
                                  ) : (
                                    <Archive size={12} className="text-orange-600" />
                                  )}
                                </Button>
                              </div>
                              
                              {/* Content items for this medium */}
                              <MediumContentDisplay 
                                source={template.sourceName} 
                                medium={medium}
                                useUtmContent={useUtmContent}
                                user={user}
                              />
                            </div>
                          );
                        })}
                        
                        {mediumsToShow.length === 0 && (
                          <p className="text-sm text-gray-500 italic">No mediums added yet. Add a medium above to get started.</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-12">
              <Settings size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {showArchived ? "No archived sources" : "No sources yet"}
              </h3>
              <p className="text-gray-600">
                {showArchived 
                  ? "You haven't archived any sources yet." 
                  : "Create your first source to get started."
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}