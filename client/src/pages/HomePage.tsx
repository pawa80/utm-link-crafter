import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useHasFeature } from '../hooks/useFeatures';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AuthScreen from "@/components/AuthScreen";
import UserHeader from "@/components/UserHeader";
import Logo from "@/components/Logo";
import { Plus, Settings, Archive, MessageCircle } from "lucide-react";
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
  const hasChatWizard = useHasFeature('chatWizard');

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
      <div className="min-h-screen bg-gradient-to-br from-muted via-background to-accent/5 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary/20 border-t-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authUser || !user) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-cyan/5 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Top Navigation with Logo and User */}
        <div className="flex justify-between items-center mb-8 pt-4">
          <Logo />
          <UserHeader user={user} onLogout={handleLogout} />
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-foreground via-primary to-cyan bg-clip-text text-transparent mb-6">
            UTM Builder
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Create, manage, and track your marketing campaign links with ease. 
            Build professional UTM links for better campaign analytics and insights.
          </p>
        </div>

        {/* Main Action Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-8">
          {/* Chat Wizard Card - First if enabled, otherwise show disabled version at bottom */}
          {hasChatWizard && (
            <Card className="card-modern group hover:shadow-2xl transition-all duration-300 animate-fade-in">
              <CardHeader className="text-center pb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-secondary via-cyan to-primary rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <MessageCircle size={40} className="text-white" />
                </div>
                <CardTitle className="text-2xl font-bold">Chat Wizard</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Let our AI assistant guide you through creating a campaign step by step with intelligent suggestions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/chat-wizard">
                  <Button className="w-full h-14 text-lg font-semibold btn-gradient-secondary">
                    Start Chat Wizard
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* New Campaign Card */}
          <Card className="card-modern group hover:shadow-2xl transition-all duration-300 animate-fade-in">
            <CardHeader className="text-center pb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-primary via-cyan to-secondary rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Plus size={40} className="text-white" />
              </div>
              <CardTitle className="text-2xl font-bold">New Campaign</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                Create a new UTM campaign with multiple sources and tracking parameters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/new-campaign">
                <Button className="w-full h-14 text-lg font-semibold btn-gradient-primary">
                  Start New Campaign
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Manage Campaigns Card */}
          <Card className="card-modern group hover:shadow-2xl transition-all duration-300 animate-fade-in">
            <CardHeader className="text-center pb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-cyan via-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Settings size={40} className="text-white" />
              </div>
              <CardTitle className="text-2xl font-bold">Manage Campaigns</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                View, edit, and organize your existing UTM campaigns and links
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/campaigns">
                <Button className="w-full h-14 text-lg font-semibold btn-gradient-primary">
                  Manage Campaigns
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Disabled Chat Wizard - Show at bottom only when disabled */}
        {!hasChatWizard && (
          <div className="mb-12 max-w-3xl mx-auto animate-fade-in">
            <Card className="card-modern border-dashed border-2 border-muted-foreground/30 bg-muted/10">
              <CardHeader className="text-center pb-6">
                <div className="w-20 h-20 bg-muted-foreground/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <MessageCircle size={40} className="text-muted-foreground/50" />
                </div>
                <CardTitle className="text-2xl font-bold text-muted-foreground">Chat Wizard</CardTitle>
                <CardDescription className="text-base leading-relaxed text-muted-foreground">
                  AI-guided campaign creation - Available in premium plans
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button disabled className="h-14 text-lg font-semibold px-12" variant="outline">
                  Upgrade to Access
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Features Section */}
        <div className="mt-20 text-center animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-cyan bg-clip-text text-transparent mb-12">
            Why Choose UTM Builder?
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/5 to-cyan/5 hover:from-primary/10 hover:to-cyan/10 transition-all duration-300 group">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <span className="text-3xl">📊</span>
              </div>
              <h3 className="text-xl font-bold mb-3">Track Performance</h3>
              <p className="text-muted-foreground leading-relaxed">
                Monitor campaign effectiveness with detailed analytics and insights
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-gradient-to-br from-success/5 to-secondary/5 hover:from-success/10 hover:to-secondary/10 transition-all duration-300 group">
              <div className="w-16 h-16 bg-gradient-to-br from-success to-success/80 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <span className="text-3xl">⚡</span>
              </div>
              <h3 className="text-xl font-bold mb-3">Quick Setup</h3>
              <p className="text-muted-foreground leading-relaxed">
                Create professional UTM links in minutes with AI-powered assistance
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-gradient-to-br from-secondary/5 to-cyan/5 hover:from-secondary/10 hover:to-cyan/10 transition-all duration-300 group">
              <div className="w-16 h-16 bg-gradient-to-br from-secondary to-secondary/80 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <span className="text-3xl">🎯</span>
              </div>
              <h3 className="text-xl font-bold mb-3">Organized</h3>
              <p className="text-muted-foreground leading-relaxed">
                Keep all your campaigns and sources neatly organized and accessible
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}