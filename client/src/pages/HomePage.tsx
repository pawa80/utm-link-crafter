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
import FeatureGate from "@/components/FeatureGate";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setAuthUser(firebaseUser);
          const userData = await createOrGetUser(firebaseUser);
          setUser(userData as User);
        } else {
          setAuthUser(null);
          setUser(null);
        }
      } catch (error) {
        console.error("Error creating/getting user:", error);
        setAuthUser(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
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

  return <AuthenticatedHomePage user={user} onLogout={handleLogout} />;
}

function AuthenticatedHomePage({ user, onLogout }: { user: User; onLogout: () => void }) {
  const hasChatWizard = useHasFeature('chatWizard');

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-cyan/5 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Top Navigation with Logo and User */}
        <div className="flex justify-between items-center mb-8 pt-4">
          <Logo />
          <UserHeader user={user} onLogout={onLogout} />
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
        </div>

        {/* Secondary Action Card */}
        <div className="flex justify-center mb-8">
          <Card className="card-modern group hover:shadow-2xl transition-all duration-300 animate-fade-in w-full max-w-md">
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

        {/* Chat Wizard Disabled Card - Show only if disabled */}
        {!hasChatWizard && (
          <div className="flex justify-center">
            <Card className="card-modern border-2 border-muted bg-muted/10 max-w-md mx-auto">
              <CardHeader className="text-center pb-6">
                <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <MessageCircle size={40} className="text-muted-foreground" />
                </div>
                <CardTitle className="text-2xl font-bold text-muted-foreground">Chat Wizard</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  AI-powered campaign creation assistant
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full h-14 text-lg font-semibold" variant="outline" disabled>
                  Upgrade Required
                </Button>
                <p className="text-sm text-muted-foreground mt-3 text-center">
                  Available on Professional and higher plans
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}