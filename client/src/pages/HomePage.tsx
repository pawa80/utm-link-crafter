import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AuthScreen from "@/components/AuthScreen";
import UserHeader from "@/components/UserHeader";
import Logo from "@/components/Logo";
import { Plus, Settings, Archive } from "lucide-react";
import { Link, useLocation } from "wouter";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createOrGetUser } from "@/lib/auth";
import type { User as AuthUser } from "firebase/auth";
import type { User } from "@shared/schema";

export default function HomePage() {
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
      <div className="max-w-4xl mx-auto">
        {/* Top Navigation with Logo and User */}
        <div className="flex justify-between items-center mb-8 pt-4">
          <Logo />
          <UserHeader user={user} onLogout={handleLogout} />
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            UTM Link Builder
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Create, manage, and track your marketing campaign links with ease. 
            Build professional UTM links for better campaign analytics.
          </p>
        </div>

        {/* Main Action Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* New Campaign Card */}
          <Card className="hover:shadow-lg transition-shadow duration-200 border-2 hover:border-primary/20">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus size={32} className="text-primary" />
              </div>
              <CardTitle className="text-xl">New Campaign</CardTitle>
              <CardDescription>
                Create a new UTM campaign with multiple sources and tracking parameters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/new-campaign">
                <Button className="w-full h-12 text-lg">
                  Start New Campaign
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Manage Campaigns Card */}
          <Card className="hover:shadow-lg transition-shadow duration-200 border-2 hover:border-primary/20">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Settings size={32} className="text-primary" />
              </div>
              <CardTitle className="text-xl">Manage Campaigns</CardTitle>
              <CardDescription>
                View, edit, and organize your existing UTM campaigns and links
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/campaigns">
                <Button variant="outline" className="w-full h-12 text-lg">
                  Manage Campaigns
                </Button>
              </Link>
            </CardContent>
          </Card>


        </div>

        {/* Features Section */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-8">
            Why Use Our UTM Builder?
          </h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="p-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">Track Performance</h3>
              <p className="text-sm text-gray-600">
                Monitor campaign effectiveness with detailed analytics
              </p>
            </div>
            <div className="p-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">Quick Setup</h3>
              <p className="text-sm text-gray-600">
                Create professional UTM links in minutes, not hours
              </p>
            </div>
            <div className="p-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">Organized</h3>
              <p className="text-sm text-gray-600">
                Keep all your campaigns and sources neatly organized
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}