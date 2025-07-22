import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import CampaignWizard from "@/components/CampaignWizard";
import AuthScreen from "@/components/AuthScreen";
import UserHeader from "@/components/UserHeader";
import Logo from "@/components/Logo";
import { ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUser } from "@/lib/auth";
import type { User as AuthUser } from "firebase/auth";
import type { User, UtmLink } from "@shared/schema";

export default function NewCampaign() {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  
  // Parse URL parameters to check for edit mode
  const urlParams = new URLSearchParams(window.location.search);
  const editCampaignName = urlParams.get('edit');
  const isEditMode = !!editCampaignName;
  
  // Fetch campaign data for editing
  const { data: campaignLinks = [] } = useQuery<UtmLink[]>({
    queryKey: ["/api/utm-links"],
    enabled: isEditMode && !!user, // Only fetch when in edit mode and user is loaded
  });
  
  // Fetch campaign landing pages for editing
  const { data: campaignLandingPages = [] } = useQuery<any[]>({
    queryKey: [`/api/campaign-landing-pages/${editCampaignName}`],
    enabled: isEditMode && !!user && !!editCampaignName, // Only fetch when in edit mode
  });
  
  // Filter links for the campaign being edited
  const editingCampaignLinks = isEditMode && editCampaignName 
    ? campaignLinks.filter(link => link.utm_campaign === editCampaignName)
    : [];

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

  const handleSaveSuccess = () => {
    setLocation("/campaigns");
  };

  const handleLogout = () => {
    setLocation("/");
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
            <Link href="/campaigns">
              <Button variant="ghost">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Campaign Management
              </Button>
            </Link>
          </div>
          <UserHeader user={user} onLogout={handleLogout} />
        </div>

        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditMode ? `Edit Campaign: ${editCampaignName}` : "Create New Campaign"}
            </h1>
            <p className="text-gray-600">
              {isEditMode ? "Modify and save your UTM campaign links" : "Build and save your UTM campaign links"}
            </p>
          </div>

          {/* Campaign Wizard */}
          <CampaignWizard 
            user={user} 
            onSaveSuccess={handleSaveSuccess}
            editMode={isEditMode}
            existingCampaignData={editingCampaignLinks}
            existingLandingPages={campaignLandingPages as any[]}
          />
        </div>
      </div>
    </div>
  );
}