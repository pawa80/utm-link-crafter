import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiRequest } from "@/lib/queryClient";
import AuthScreen from "@/components/AuthScreen";
import UserHeader from "@/components/UserHeader";
import ChatWizardSecure from "@/components/ChatWizardSecure";
import ErrorBoundary from "@/components/ErrorBoundary";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, ExternalLink, RotateCcw } from "lucide-react";
import { Link } from "wouter";
import type { User } from "@shared/schema";

export default function ChatWizardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setAuthUser(firebaseUser);
        try {
          const token = await firebaseUser.getIdToken();
          const response = await fetch("/api/users", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-firebase-uid": firebaseUser.uid,
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
              firebaseUid: firebaseUser.uid,
              email: firebaseUser.email,
              categories: [],
              defaultSources: [],
              defaultMediums: [],
              defaultCampaignNames: [],
              isSetupComplete: false,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to create or get user");
          }

          const userData = await response.json();
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

  const handleComplete = () => {
    setLocation("/campaigns");
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
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-accent/5 p-4">
      <div className="max-w-5xl mx-auto">
        {/* Top Navigation with Logo and User */}
        <div className="flex justify-between items-center mb-8 pt-4">
          <div className="flex items-center space-x-4">
            <Logo />
            <Link href="/">
              <Button variant="ghost" className="hover:bg-primary/10 hover:text-primary transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
          <UserHeader user={user} onLogout={handleLogout} />
        </div>

        <div className="space-y-8">
          {/* Header */}
          <div className="text-center animate-fade-in">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent mb-4">
              Chat Wizard
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Let our AI assistant guide you through creating your UTM campaign step by step with intelligent suggestions
            </p>
          </div>

          {/* Chat Wizard Component with Error Boundary */}
          <div className="max-w-3xl mx-auto">
            <div className="card-modern shadow-2xl animate-fade-in">
              <ErrorBoundary
                onError={(error, errorInfo) => {
                  console.error('Chat Wizard Error:', error, errorInfo);
                }}
                fallback={
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle size={32} className="text-destructive" />
                    </div>
                    <h3 className="text-xl font-bold text-destructive mb-2">Chat Wizard Unavailable</h3>
                    <p className="text-muted-foreground mb-6">
                      The Chat Wizard encountered an error. You can still create campaigns manually.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button 
                        onClick={() => window.location.href = '/new-campaign'} 
                        className="btn-gradient-primary"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Manual Campaign Creation
                      </Button>
                      <Button 
                        onClick={() => window.location.reload()} 
                        variant="outline"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Retry Chat Wizard
                      </Button>
                    </div>
                  </div>
                }
              >
                <ChatWizardSecure 
                  user={user} 
                  onComplete={handleComplete}
                />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}