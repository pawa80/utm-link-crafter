import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, AlertCircle, Users, Link } from "lucide-react";

interface InvitationData {
  id: number;
  accountId: number;
  email: string;
  role: string;
  expiresAt: string;
  account: {
    id: number;
    name: string;
  };
  inviter: {
    email: string;
  };
}

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!token) return;

    const fetchInvitation = async () => {
      try {
        const response = await fetch(`/api/invitations/${token}`);
        if (!response.ok) {
          throw new Error("Invitation not found or expired");
        }
        const data = await response.json();
        setInvitation(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  const handleAcceptInvitation = async () => {
    if (!invitation || !token) return;

    setAccepting(true);
    try {
      // For testing purposes, create a mock Firebase user
      // In production, this would use actual Firebase authentication
      const mockFirebaseUid = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Accept the invitation with mock Firebase UID
      await apiRequest(`/api/invitations/${token}/accept`, {
        method: "POST",
        body: JSON.stringify({
          firebaseUid: mockFirebaseUid,
        }),
      });

      setSuccess(true);
      toast({
        title: "Invitation accepted!",
        description: "You've successfully joined the account. Redirecting to your dashboard...",
      });

      // Redirect to account management after 2 seconds
      setTimeout(() => {
        window.location.href = "/account-management";
      }, 2000);
    } catch (error: any) {
      console.error('Invitation acceptance error:', error);
      toast({
        title: "Failed to accept invitation",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-600">Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => window.location.href = "/"} variant="outline">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-green-600">Invitation Accepted!</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              You've successfully joined {invitation?.account.name}. Redirecting to your dashboard...
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
            <Link className="text-white" size={24} />
          </div>
          <CardTitle>You've Been Invited!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-gray-600 mb-2">
              <strong>{invitation?.inviter.email}</strong> has invited you to join:
            </p>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="font-medium">{invitation?.account.name}</span>
              </div>
              <p className="text-sm text-gray-600">
                Role: <span className="font-medium capitalize">{invitation?.role}</span>
              </p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">
              Click below to accept this invitation and join the account:
            </p>
            <Button
              onClick={handleAcceptInvitation}
              disabled={accepting}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {accepting ? "Accepting..." : "Accept Invitation"}
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-400">
              This invitation expires on{" "}
              {invitation?.expiresAt
                ? new Date(invitation.expiresAt).toLocaleDateString()
                : "Unknown"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}