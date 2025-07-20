import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import GeneratedLinks from "@/components/GeneratedLinks";
import AuthScreen from "@/components/AuthScreen";
import UserHeader from "@/components/UserHeader";
import Logo from "@/components/Logo";
import { Plus, ArrowLeft, Archive } from "lucide-react";
import { Link, useLocation } from "wouter";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createOrGetUser } from "@/lib/auth";
import type { User as AuthUser } from "firebase/auth";
import type { User } from "@shared/schema";

export default function CampaignManagement() {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const [showArchived, setShowArchived] = useState(false);
  
  // Extract expandCampaign parameter from URL
  const expandCampaign = new URLSearchParams(window.location.search).get('expand');

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
            <Link href="/">
              <Button variant="ghost">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
          <UserHeader user={user} onLogout={handleLogout} />
        </div>

        <div className="space-y-6">
          {/* Header with New Campaign button */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {showArchived ? "Archived Campaigns" : "Campaign Management"}
              </h1>
              <p className="text-gray-600">
                {showArchived ? "View and manage archived campaigns" : "View and manage your UTM campaigns"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={showArchived ? "default" : "outline"}
                onClick={() => setShowArchived(!showArchived)}
                className={!showArchived ? "hover:bg-primary hover:text-white" : ""}
              >
                <Archive className="w-4 h-4 mr-2" />
                {showArchived ? "Show Active" : "Show Archived"}
              </Button>
              {!showArchived && (
                <Link href="/new-campaign">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    New Campaign
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Generated Links Section */}
          <GeneratedLinks showArchived={showArchived} expandCampaign={expandCampaign || undefined} />
        </div>
      </div>
    </div>
  );
}