import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { onAuthStateChange, getUser } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import AuthScreen from "@/components/AuthScreen";
import SetupScreen from "@/components/SetupScreen";
import MainApp from "@/components/MainApp";
import { Skeleton } from "@/components/ui/skeleton";
import type { User as FirebaseUser } from "firebase/auth";
import type { User } from "@shared/schema";

export default function Dashboard() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const { data: user, isLoading: userLoading, refetch } = useQuery<User>({
    queryKey: ["/api/user"],
    enabled: !!firebaseUser,
    retry: false,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (fbUser) => {
      setFirebaseUser(fbUser);
      setAuthLoading(false);
      
      if (fbUser) {
        try {
          await getUser(fbUser);
          refetch();
        } catch (error) {
          console.error("Error creating/getting user:", error);
        }
      }
    });

    // Set auth headers for API requests
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (auth.currentUser && typeof input === 'string' && input.startsWith('/api/')) {
        const headers = {
          ...init?.headers,
          'x-firebase-uid': auth.currentUser.uid,
        };
        
        return originalFetch(input, { ...init, headers });
      }
      
      return originalFetch(input, init);
    };

    return () => {
      unsubscribe();
      window.fetch = originalFetch;
    };
  }, [refetch]);

  if (authLoading || (firebaseUser && userLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-12 w-12 rounded-lg mx-auto" />
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <AuthScreen onAuthSuccess={() => refetch()} />;
  }

  if (user && !user.isSetupComplete) {
    return <SetupScreen user={user} onSetupComplete={() => refetch()} />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-12 w-12 rounded-lg mx-auto" />
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
      </div>
    );
  }

  return <MainApp user={user!} onLogout={() => setFirebaseUser(null)} />;
}
