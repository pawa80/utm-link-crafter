import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Archive, ArrowLeft, Tag, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import AuthScreen from "@/components/AuthScreen";
import UserHeader from "@/components/UserHeader";
import Logo from "@/components/Logo";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createOrGetUser } from "@/lib/auth";
import { useHasFeature } from "@/hooks/useFeatures";
import FeatureGate from "@/components/FeatureGate";
import type { User as AuthUser } from "firebase/auth";
import type { User } from "@shared/schema";

export default function Settings() {
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

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setLocation("/");
    } catch (error) {
      console.error("Error signing out:", error);
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
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
            <p className="text-gray-600">
              Manage your account settings and preferences
            </p>
          </div>

          {/* Settings Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            
            {/* Template Management Card */}
            <FeatureGate featureKey="customTemplates" fallback={
              <Card className="hover:shadow-lg transition-shadow duration-200 border-2 hover:border-gray-200 opacity-50">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Archive size={32} className="text-gray-400" />
                  </div>
                  <CardTitle className="text-xl text-gray-500">Template Management</CardTitle>
                  <CardDescription>
                    Available in premium plans
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full h-14 text-base leading-tight px-4" disabled>
                    Upgrade Required
                  </Button>
                </CardContent>
              </Card>
            }>
              <Card className="hover:shadow-lg transition-shadow duration-200 border-2 hover:border-primary/20">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Archive size={32} className="text-primary" />
                  </div>
                  <CardTitle className="text-xl">Template Management</CardTitle>
                  <CardDescription>
                    Manage your UTM templates for sources, mediums, and content
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/template-management">
                    <Button variant="outline" className="w-full h-14 text-base leading-tight px-4">
                      Manage Templates
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </FeatureGate>

            {/* Tag Management Card */}
            <FeatureGate featureKey="tagManagement" fallback={
              <Card className="hover:shadow-lg transition-shadow duration-200 border-2 hover:border-gray-200 opacity-50">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Tag size={32} className="text-gray-400" />
                  </div>
                  <CardTitle className="text-xl text-gray-500">Tag Management</CardTitle>
                  <CardDescription>
                    Available in premium plans
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full h-14 text-base leading-tight px-4" disabled>
                    Upgrade Required
                  </Button>
                </CardContent>
              </Card>
            }>
              <Card className="hover:shadow-lg transition-shadow duration-200 border-2 hover:border-primary/20">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Tag size={32} className="text-primary" />
                  </div>
                  <CardTitle className="text-xl">Tag Management</CardTitle>
                  <CardDescription>
                    Organize and manage your campaign tags with usage statistics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/tags">
                    <Button variant="outline" className="w-full h-14 text-base leading-tight px-4">
                      Manage Tags
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </FeatureGate>

            {/* Account Management Card */}
            <FeatureGate featureKey="multiUser" fallback={
              <Card className="hover:shadow-lg transition-shadow duration-200 border-2 hover:border-gray-200 opacity-50">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users size={32} className="text-gray-400" />
                  </div>
                  <CardTitle className="text-xl text-gray-500">Account Management</CardTitle>
                  <CardDescription>
                    Available in premium plans
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full h-14 text-base leading-tight px-4" disabled>
                    Upgrade Required
                  </Button>
                </CardContent>
              </Card>
            }>
              <Card className="hover:shadow-lg transition-shadow duration-200 border-2 hover:border-primary/20">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users size={32} className="text-primary" />
                  </div>
                  <CardTitle className="text-xl">Account Management</CardTitle>
                  <CardDescription>
                    Manage users, roles, and multi-account access settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/account-management">
                    <Button variant="outline" className="w-full h-14 text-base leading-tight px-4">
                      Manage Accounts
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </FeatureGate>

            {/* Placeholder for future settings */}
            <Card className="hover:shadow-lg transition-shadow duration-200 border-2 hover:border-gray-200 opacity-50">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl text-gray-400">⚙️</span>
                </div>
                <CardTitle className="text-xl text-gray-500">Profile Settings</CardTitle>
                <CardDescription>
                  Manage your personal preferences and profile
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full h-14 text-base leading-tight px-4" disabled>
                  Coming Soon
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-200 border-2 hover:border-gray-200 opacity-50">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl text-gray-400">🔔</span>
                </div>
                <CardTitle className="text-xl text-gray-500">Notifications</CardTitle>
                <CardDescription>
                  Configure your notification preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full h-14 text-base leading-tight px-4" disabled>
                  Coming Soon
                </Button>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}