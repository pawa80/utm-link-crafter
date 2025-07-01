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
import { ArrowLeft, Plus, Archive, ArchiveRestore, Trash2, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createOrGetUser } from "@/lib/auth";
import type { User as AuthUser } from "firebase/auth";
import type { User, SourceTemplate, UtmLink } from "@shared/schema";

export default function SourceManagement() {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const [showArchived, setShowArchived] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newMediums, setNewMediums] = useState<{ [sourceId: number]: string }>({});

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

  const filteredTemplates = showArchived 
    ? sourceTemplates 
    : sourceTemplates.filter(template => !template.isArchived);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Top Navigation */}
        <div className="flex justify-between items-center mb-6 pt-4">
          <Link href="/campaigns">
            <Button variant="ghost">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Campaign Management
            </Button>
          </Link>
          <UserHeader user={user} onLogout={handleLogout} />
        </div>

        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Source & Medium Management</h1>
            <p className="text-gray-600">Manage your campaign sources and their mediums</p>
          </div>

          {/* Controls */}
          <div className="flex justify-between items-center">
            <Button
              onClick={() => setShowArchived(!showArchived)}
              variant="outline"
              className="text-primary hover:text-primary/80"
            >
              {showArchived ? (
                <>
                  <ArchiveRestore className="mr-2" size={16} />
                  Show Active Only
                </>
              ) : (
                <>
                  <Archive className="mr-2" size={16} />
                  Show Archived ({sourceTemplates.filter(t => t.isArchived).length})
                </>
              )}
            </Button>

            {/* Add New Source */}
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
                    {/* Mediums */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Mediums:</Label>
                      <div className="flex flex-wrap gap-2">
                        {mediumsToShow.map((medium) => {
                          const isArchived = archivedMediums.includes(medium);
                          const inUse = isMediumInUse(template.sourceName, medium);
                          
                          return (
                            <div key={medium} className="flex items-center gap-2">
                              <Badge 
                                variant={isArchived ? "secondary" : "default"}
                                className={`${isArchived ? 'text-gray-500 bg-gray-200' : ''}`}
                              >
                                {medium}
                                {inUse && <span className="ml-1 text-xs">•</span>}
                              </Badge>
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
                          );
                        })}
                      </div>

                      {/* Add new medium */}
                      {!template.isArchived && (
                        <div className="flex items-center gap-2 pt-2">
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
                      )}
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