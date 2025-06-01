import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tags, Share, Layers, Plus, X, Eye } from "lucide-react";
import type { User } from "@shared/schema";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

export default function SettingsModal({ isOpen, onClose, user }: SettingsModalProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [mediums, setMediums] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newMedium, setNewMedium] = useState("");
  const [showCampaignTerm, setShowCampaignTerm] = useState(true);
  const [showInternalCampaignId, setShowInternalCampaignId] = useState(true);
  const [showCategory, setShowCategory] = useState(true);
  const [showCustomFields, setShowCustomFields] = useState(false);
  
  // Custom field configurations
  const [customField1Name, setCustomField1Name] = useState("");
  const [customField1InUrl, setCustomField1InUrl] = useState(false);
  const [customField1Options, setCustomField1Options] = useState<string[]>([]);
  const [customField2Name, setCustomField2Name] = useState("");
  const [customField2InUrl, setCustomField2InUrl] = useState(false);
  const [customField2Options, setCustomField2Options] = useState<string[]>([]);
  const [customField3Name, setCustomField3Name] = useState("");
  const [customField3InUrl, setCustomField3InUrl] = useState(false);
  const [customField3Options, setCustomField3Options] = useState<string[]>([]);
  
  // New option inputs
  const [newCustomField1Option, setNewCustomField1Option] = useState("");
  const [newCustomField2Option, setNewCustomField2Option] = useState("");
  const [newCustomField3Option, setNewCustomField3Option] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize state when modal opens or user changes
  useEffect(() => {
    if (user) {
      setCategories(user.categories || []);
      setSources(user.defaultSources || []);
      setMediums(user.defaultMediums || []);
      setShowCampaignTerm(user.showCampaignTerm ?? true);
      setShowInternalCampaignId(user.showInternalCampaignId ?? true);
      setShowCategory(user.showCategory ?? true);
      setShowCustomFields(user.showCustomFields ?? false);
      
      // Initialize custom field settings
      setCustomField1Name(user.customField1Name || "");
      setCustomField1InUrl(user.customField1InUrl ?? false);
      setCustomField1Options(user.customField1Options || []);
      setCustomField2Name(user.customField2Name || "");
      setCustomField2InUrl(user.customField2InUrl ?? false);
      setCustomField2Options(user.customField2Options || []);
      setCustomField3Name(user.customField3Name || "");
      setCustomField3InUrl(user.customField3InUrl ?? false);
      setCustomField3Options(user.customField3Options || []);
    }
  }, [user, isOpen]);

  const updateUserMutation = useMutation({
    mutationFn: async (updates: any) => {
      const response = await apiRequest("PATCH", "/api/user", updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Settings Saved",
        description: "Your preferences have been updated successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Save Error",
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

  const handleSave = () => {
    updateUserMutation.mutate({
      categories,
      defaultSources: sources,
      defaultMediums: mediums,
      showCampaignTerm,
      showInternalCampaignId,
      showCategory,
      showCustomFields,
      customField1Name,
      customField1InUrl,
      customField1Options,
      customField2Name,
      customField2InUrl,
      customField2Options,
      customField3Name,
      customField3InUrl,
      customField3Options,
    });
  };

  // Helper functions for custom field options
  const addCustomFieldOption = (fieldNumber: 1 | 2 | 3) => {
    const inputValues = [newCustomField1Option, newCustomField2Option, newCustomField3Option];
    const setters = [setCustomField1Options, setCustomField2Options, setCustomField3Options];
    const resetters = [setNewCustomField1Option, setNewCustomField2Option, setNewCustomField3Option];
    
    const newOption = inputValues[fieldNumber - 1].trim();
    if (newOption) {
      const currentOptions = [customField1Options, customField2Options, customField3Options][fieldNumber - 1];
      if (!currentOptions.includes(newOption)) {
        setters[fieldNumber - 1]([...currentOptions, newOption]);
      }
      resetters[fieldNumber - 1]("");
    }
  };

  const removeCustomFieldOption = (fieldNumber: 1 | 2 | 3, option: string) => {
    const setters = [setCustomField1Options, setCustomField2Options, setCustomField3Options];
    const currentOptions = [customField1Options, customField2Options, customField3Options][fieldNumber - 1];
    setters[fieldNumber - 1](currentOptions.filter(opt => opt !== option));
  };

  const handleCancel = () => {
    // Reset to original values
    setCategories(user.categories || []);
    setSources(user.defaultSources || []);
    setMediums(user.defaultMediums || []);
    setShowCampaignTerm(user.showCampaignTerm ?? true);
    setShowInternalCampaignId(user.showInternalCampaignId ?? true);
    setShowCategory(user.showCategory ?? true);
    setShowCustomFields(user.showCustomFields ?? false);
    
    // Reset custom field settings
    setCustomField1Name(user.customField1Name || "");
    setCustomField1InUrl(user.customField1InUrl ?? false);
    setCustomField1Options(user.customField1Options || []);
    setCustomField2Name(user.customField2Name || "");
    setCustomField2InUrl(user.customField2InUrl ?? false);
    setCustomField2Options(user.customField2Options || []);
    setCustomField3Name(user.customField3Name || "");
    setCustomField3InUrl(user.customField3InUrl ?? false);
    setCustomField3Options(user.customField3Options || []);
    
    setNewCategory("");
    setNewSource("");
    setNewMedium("");
    setNewCustomField1Option("");
    setNewCustomField2Option("");
    setNewCustomField3Option("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        
        <div className="grid md:grid-cols-3 gap-6 py-4">
          {/* Categories Management */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Tags className="text-primary mr-2" size={20} />
              Categories
            </h3>
            <div className="space-y-3">
              <div className="flex">
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="New category"
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
              <div className="space-y-2 max-h-40 overflow-y-auto">
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
          </div>

          {/* Sources Management */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Share className="text-primary mr-2" size={20} />
              Sources
            </h3>
            <div className="space-y-3">
              <div className="flex">
                <Input
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  placeholder="New source"
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
              <div className="space-y-2 max-h-40 overflow-y-auto">
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
          </div>

          {/* Mediums Management */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Layers className="text-primary mr-2" size={20} />
              Mediums
            </h3>
            <div className="space-y-3">
              <div className="flex">
                <Input
                  value={newMedium}
                  onChange={(e) => setNewMedium(e.target.value)}
                  placeholder="New medium"
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
              <div className="space-y-2 max-h-40 overflow-y-auto">
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
          </div>
        </div>

        {/* Field Visibility Settings */}
        <div className="border-t pt-6">
          <div className="flex items-center mb-4">
            <Eye className="text-primary mr-2" size={20} />
            <h3 className="text-lg font-semibold">Optional Field Settings</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Control which optional fields appear in your UTM builder form
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="show-campaign-term" className="text-sm font-medium">
                  Campaign Term Field
                </Label>
                <p className="text-xs text-gray-500">For paid keywords and search terms</p>
              </div>
              <Switch
                id="show-campaign-term"
                checked={showCampaignTerm}
                onCheckedChange={setShowCampaignTerm}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="show-internal-id" className="text-sm font-medium">
                  Internal Campaign ID Field
                </Label>
                <p className="text-xs text-gray-500">For internal tracking and organization</p>
              </div>
              <Switch
                id="show-internal-id"
                checked={showInternalCampaignId}
                onCheckedChange={setShowInternalCampaignId}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="show-category" className="text-sm font-medium">
                  Category Field
                </Label>
                <p className="text-xs text-gray-500">For organizing campaigns by type</p>
              </div>
              <Switch
                id="show-category"
                checked={showCategory}
                onCheckedChange={setShowCategory}
              />
            </div>
          </div>
        </div>

        {/* Custom Fields Configuration */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Plus className="text-primary mr-2" size={20} />
              <h3 className="text-lg font-semibold">Custom Fields</h3>
            </div>
            <Switch
              checked={showCustomFields}
              onCheckedChange={setShowCustomFields}
            />
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Create up to 3 custom fields for specialized tracking needs
          </p>
          
          {showCustomFields && (
            <div className="space-y-6">
              {[1, 2, 3].map((fieldNum) => {
                const fieldName = [customField1Name, customField2Name, customField3Name][fieldNum - 1];
                const setFieldName = [setCustomField1Name, setCustomField2Name, setCustomField3Name][fieldNum - 1];
                const fieldInUrl = [customField1InUrl, customField2InUrl, customField3InUrl][fieldNum - 1];
                const setFieldInUrl = [setCustomField1InUrl, setCustomField2InUrl, setCustomField3InUrl][fieldNum - 1];
                const fieldOptions = [customField1Options, customField2Options, customField3Options][fieldNum - 1];
                const newOption = [newCustomField1Option, newCustomField2Option, newCustomField3Option][fieldNum - 1];
                const setNewOption = [setNewCustomField1Option, setNewCustomField2Option, setNewCustomField3Option][fieldNum - 1];
                
                return (
                  <div key={fieldNum} className="border rounded-lg p-4 bg-gray-50">
                    <h4 className="font-medium mb-3">Custom Field {fieldNum}</h4>
                    
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label htmlFor={`custom-field-${fieldNum}-name`}>Field Name</Label>
                        <Input
                          id={`custom-field-${fieldNum}-name`}
                          value={fieldName}
                          onChange={(e) => setFieldName(e.target.value)}
                          placeholder="e.g., Ad Format, Audience"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor={`custom-field-${fieldNum}-url`} className="text-sm font-medium">
                            Include in URL
                          </Label>
                          <p className="text-xs text-gray-500">Add as URL parameter (utm_custom{fieldNum})</p>
                        </div>
                        <Switch
                          id={`custom-field-${fieldNum}-url`}
                          checked={fieldInUrl}
                          onCheckedChange={setFieldInUrl}
                        />
                      </div>
                    </div>
                    
                    {fieldName && (
                      <div>
                        <Label>Predefined Options (optional)</Label>
                        <p className="text-xs text-gray-500 mb-2">Create a dropdown with common values</p>
                        
                        <div className="flex items-center space-x-2 mb-3">
                          <Input
                            value={newOption}
                            onChange={(e) => setNewOption(e.target.value)}
                            placeholder="Add option..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addCustomFieldOption(fieldNum as 1 | 2 | 3);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addCustomFieldOption(fieldNum as 1 | 2 | 3)}
                          >
                            <Plus size={16} />
                          </Button>
                        </div>
                        
                        {fieldOptions.length > 0 && (
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {fieldOptions.map((option) => (
                              <div key={option} className="flex items-center justify-between">
                                <Badge variant="secondary" className="flex-1 justify-start">
                                  {option}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeCustomFieldOption(fieldNum as 1 | 2 | 3, option)}
                                  className="ml-2 text-gray-400 hover:text-red-500"
                                >
                                  <X size={14} />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-6 border-t">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateUserMutation.isPending}
          >
            {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
