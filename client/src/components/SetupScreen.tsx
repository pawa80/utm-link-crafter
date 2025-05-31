import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tags, Share, Layers, Plus, X } from "lucide-react";
import type { User } from "@shared/schema";

interface SetupScreenProps {
  user: User;
  onSetupComplete: () => void;
}

export default function SetupScreen({ user, onSetupComplete }: SetupScreenProps) {
  const [categories, setCategories] = useState<string[]>(user?.categories || []);
  const [sources, setSources] = useState<string[]>(user?.defaultSources || []);
  const [mediums, setMediums] = useState<string[]>(user?.defaultMediums || []);
  const [newCategory, setNewCategory] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newMedium, setNewMedium] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateUserMutation = useMutation({
    mutationFn: async (updates: any) => {
      const response = await apiRequest("PATCH", "/api/user", updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Setup Complete",
        description: "Your workspace has been configured successfully!",
      });
      onSetupComplete();
    },
    onError: (error: any) => {
      toast({
        title: "Setup Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addItem = (type: "category" | "source" | "medium") => {
    const setters = {
      category: { value: newCategory, setter: setNewCategory, list: categories, setList: setCategories },
      source: { value: newSource, setter: setNewSource, list: sources, setList: setSources },
      medium: { value: newMedium, setter: setNewMedium, list: mediums, setList: setMediums },
    };

    const { value, setter, list, setList } = setters[type];
    
    if (value.trim() && !list.includes(value.trim())) {
      setList([...list, value.trim()]);
      setter("");
    }
  };

  const removeItem = (type: "category" | "source" | "medium", item: string) => {
    const setters = {
      category: setCategories,
      source: setSources,
      medium: setMediums,
    };

    const lists = {
      category: categories,
      source: sources,
      medium: mediums,
    };

    setters[type](lists[type].filter(i => i !== item));
  };

  const handleCompleteSetup = () => {
    updateUserMutation.mutate({
      categories,
      defaultSources: sources,
      defaultMediums: mediums,
      isSetupComplete: true,
    });
  };

  return (
    <div className="min-h-screen py-8 px-4 bg-background">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome! Let's set up your workspace</h1>
          <p className="text-gray-600">Configure your preferences to streamline UTM link creation</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Categories Setup */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Tags className="text-primary mr-2" size={20} />
                Categories
              </h3>
              <p className="text-sm text-gray-600 mb-4">Organize your campaigns by category</p>
              <div className="space-y-3">
                <div className="flex">
                  <Input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="e.g., Spring Campaign"
                    className="rounded-r-none"
                    onKeyPress={(e) => e.key === 'Enter' && addItem('category')}
                  />
                  <Button 
                    onClick={() => addItem('category')}
                    className="rounded-l-none"
                    size="icon"
                  >
                    <Plus size={16} />
                  </Button>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {categories.map((category) => (
                    <div key={category} className="flex items-center justify-between">
                      <Badge variant="secondary" className="flex-1 justify-start">
                        {category}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem('category', category)}
                        className="ml-2 text-gray-400 hover:text-red-500"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sources Setup */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Share className="text-primary mr-2" size={20} />
                Sources
              </h3>
              <p className="text-sm text-gray-600 mb-4">Common traffic sources you use</p>
              <div className="space-y-3">
                <div className="flex">
                  <Input
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    placeholder="e.g., google, facebook"
                    className="rounded-r-none"
                    onKeyPress={(e) => e.key === 'Enter' && addItem('source')}
                  />
                  <Button 
                    onClick={() => addItem('source')}
                    className="rounded-l-none"
                    size="icon"
                  >
                    <Plus size={16} />
                  </Button>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {sources.map((source) => (
                    <div key={source} className="flex items-center justify-between">
                      <Badge variant="secondary" className="flex-1 justify-start">
                        {source}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem('source', source)}
                        className="ml-2 text-gray-400 hover:text-red-500"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mediums Setup */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Layers className="text-primary mr-2" size={20} />
                Mediums
              </h3>
              <p className="text-sm text-gray-600 mb-4">Campaign mediums you typically use</p>
              <div className="space-y-3">
                <div className="flex">
                  <Input
                    value={newMedium}
                    onChange={(e) => setNewMedium(e.target.value)}
                    placeholder="e.g., cpc, social, email"
                    className="rounded-r-none"
                    onKeyPress={(e) => e.key === 'Enter' && addItem('medium')}
                  />
                  <Button 
                    onClick={() => addItem('medium')}
                    className="rounded-l-none"
                    size="icon"
                  >
                    <Plus size={16} />
                  </Button>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {mediums.map((medium) => (
                    <div key={medium} className="flex items-center justify-between">
                      <Badge variant="secondary" className="flex-1 justify-start">
                        {medium}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem('medium', medium)}
                        className="ml-2 text-gray-400 hover:text-red-500"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8">
          <Button 
            onClick={handleCompleteSetup}
            size="lg"
            disabled={updateUserMutation.isPending}
          >
            {updateUserMutation.isPending ? "Setting up..." : "Complete Setup & Start Building Links"}
          </Button>
        </div>
      </div>
    </div>
  );
}
