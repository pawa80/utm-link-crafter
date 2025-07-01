import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import CampaignWizard from "@/components/CampaignWizard";
import AuthScreen from "@/components/AuthScreen";
import { ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createOrGetUser } from "@/lib/auth";
import type { User as AuthUser } from "firebase/auth";
import type { User } from "@shared/schema";

export default function NewCampaign() {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

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

  const handleSaveSuccess = () => {
    setLocation("/campaigns");
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
        {/* Navigation */}
        <div className="mb-6">
          <Link href="/campaigns">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Campaign Management
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Create New Campaign</h1>
            <p className="text-gray-600">Build and save your UTM campaign links</p>
          </div>

          {/* Campaign Wizard */}
          <CampaignWizard user={user} onSaveSuccess={handleSaveSuccess} />
        </div>
      </div>
    </div>
  );
}