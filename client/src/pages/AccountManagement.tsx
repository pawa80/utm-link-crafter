import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Zap, Users, Plus, Settings, Mail, Trash2, UserPlus, Shield, User, Crown } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createOrGetUser } from "@/lib/auth";
import AuthScreen from "@/components/AuthScreen";
import UserHeader from "@/components/UserHeader";
import type { User as FirebaseUser } from "firebase/auth";
import type { User as DatabaseUser } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Account {
  id: number;
  name: string;
  subscriptionTier: string;
  trialEndDate: string;
  featureFlags: Record<string, any>;
  usageLimits: {
    maxCampaigns: number;
    maxLinksPerCampaign: number;
    maxTemplates: number;
  };
  createdAt: string;
}

interface UserAccount {
  id: number;
  userId: number;
  accountId: number;
  role: "user" | "developer" | "admin" | "super_admin";
  invitedBy: number | null;
  joinedAt: string;
  account?: Account;
}

interface AccountUser {
  id: number;
  userId: number;
  accountId: number;
  role: "user" | "developer" | "admin" | "super_admin";
  invitedBy: number | null;
  joinedAt: string;
}

interface Invitation {
  id: number;
  accountId: number;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  status: "pending" | "accepted" | "expired";
  invitedBy: number;
  createdAt: string;
}

function UTMBuilderLogo() {
  return (
    <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
      <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
        <Zap className="w-5 h-5 text-white" />
      </div>
      <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
        UTM Builder
      </span>
    </Link>
  );
}

function RoleIcon({ role }: { role: string }) {
  switch (role) {
    case "super_admin":
      return <Crown className="w-4 h-4 text-yellow-600" />;
    case "admin":
      return <Shield className="w-4 h-4 text-blue-600" />;
    case "developer":
      return <Settings className="w-4 h-4 text-green-600" />;
    default:
      return <User className="w-4 h-4 text-gray-600" />;
  }
}

function RoleBadge({ role }: { role: string }) {
  const colors = {
    super_admin: "bg-yellow-100 text-yellow-800 border-yellow-300",
    admin: "bg-blue-100 text-blue-800 border-blue-300",
    developer: "bg-green-100 text-green-800 border-green-300",
    user: "bg-gray-100 text-gray-800 border-gray-300"
  };

  return (
    <Badge variant="outline" className={colors[role] || colors.user}>
      <RoleIcon role={role} />
      <span className="ml-1 capitalize">{role.replace('_', ' ')}</span>
    </Badge>
  );
}

export default function AccountManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("user");
  const [user, setUser] = useState<DatabaseUser | null>(null);
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
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

  // Get user's account (single account)
  const { data: userAccount, isLoading: accountsLoading } = useQuery<UserAccount>({
    queryKey: ["/api/user/account"],
  });

  // Get account users for user's account
  const { data: accountUsers, isLoading: usersLoading } = useQuery<AccountUser[]>({
    queryKey: ["/api/accounts", userAccount?.accountId, "users"],
    enabled: !!userAccount?.accountId,
  });

  // Role permissions
  const isAdmin = userAccount?.role === "admin" || userAccount?.role === "super_admin";
  const isSuperAdmin = userAccount?.role === "super_admin";

  // Invite user mutation
  const inviteUserMutation = useMutation({
    mutationFn: async ({ accountId, email, role }: { accountId: number; email: string; role: string }) => {
      return apiRequest(`/api/accounts/${accountId}/invite`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", userAccount?.accountId, "users"] });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("user");
      toast({
        title: "Invitation sent",
        description: "The user will receive an email invitation to join the account.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send invitation",
        description: error.message || "An error occurred while sending the invitation.",
        variant: "destructive",
      });
    },
  });

  // Remove user mutation
  const removeUserMutation = useMutation({
    mutationFn: async ({ accountId, userId }: { accountId: number; userId: number }) => {
      return apiRequest(`/api/accounts/${accountId}/users/${userId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", userAccount?.accountId, "users"] });
      toast({
        title: "User removed",
        description: "The user has been removed from the account.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove user",
        description: error.message || "An error occurred while removing the user.",
        variant: "destructive",
      });
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ accountId, userId, role }: { accountId: number; userId: number; role: string }) => {
      return apiRequest(`/api/accounts/${accountId}/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", userAccount?.accountId, "users"] });
      toast({
        title: "Role updated",
        description: "The user's role has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update role",
        description: error.message || "An error occurred while updating the role.",
        variant: "destructive",
      });
    },
  });

  const handleInviteUser = () => {
    if (!userAccount?.accountId || !inviteEmail.trim()) return;
    
    inviteUserMutation.mutate({
      accountId: userAccount.accountId,
      email: inviteEmail.trim(),
      role: inviteRole,
    });
  };

  const handleRemoveUser = (userId: number) => {
    if (!userAccount?.accountId) return;
    
    removeUserMutation.mutate({
      accountId: userAccount.accountId,
      userId,
    });
  };

  const handleUpdateRole = (userId: number, newRole: string) => {
    if (!userAccount?.accountId) return;
    
    updateRoleMutation.mutate({
      accountId: userAccount.accountId,
      userId,
      role: newRole,
    });
  };

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authUser || !user) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  if (accountsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <UTMBuilderLogo />
          </div>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading account information...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <UTMBuilderLogo />
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Account Management</h1>
              <p className="text-gray-600 mt-2">Manage users, roles, and account settings</p>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/settings">
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Back to Settings
                </Button>
              </Link>
              <UserHeader user={user} onLogout={handleLogout} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Account Selection */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Your Company Account
                </CardTitle>
                <CardDescription>
                  Your company account information and subscription
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {userAccount && (
                  <div className="p-3 rounded-lg border border-blue-500 bg-blue-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 truncate">
                          {userAccount.account?.name}
                        </p>
                        <p className="text-sm text-gray-500 capitalize">
                          {userAccount.account?.subscriptionTier} plan
                        </p>
                      </div>
                      <RoleBadge role={userAccount.role} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Account Users Management */}
          <div className="lg:col-span-2">
            {userAccount?.accountId ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center">
                        <UserPlus className="w-5 h-5 mr-2" />
                        Account Users
                      </CardTitle>
                      <CardDescription>
                        Manage users and their roles for {userAccount?.account?.name}
                      </CardDescription>
                    </div>
                    {isAdmin && (
                      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Invite User
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Invite User to Account</DialogTitle>
                            <DialogDescription>
                              Send an invitation to a new user to join this account
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="email">Email Address</Label>
                              <Input
                                id="email"
                                type="email"
                                placeholder="user@example.com"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="role">Role</Label>
                              <Select value={inviteRole} onValueChange={setInviteRole}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="developer">Developer</SelectItem>
                                  {isSuperAdmin && <SelectItem value="admin">Admin</SelectItem>}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setInviteDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleInviteUser}
                              disabled={!inviteEmail.trim() || inviteUserMutation.isPending}
                            >
                              {inviteUserMutation.isPending ? "Sending..." : "Send Invitation"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {accountUsers?.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-gray-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">User {user.userId}</p>
                              <p className="text-sm text-gray-500">
                                Joined {new Date(user.joinedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            {isSuperAdmin && user.role !== "super_admin" ? (
                              <Select
                                value={user.role}
                                onValueChange={(newRole) => handleUpdateRole(user.userId, newRole)}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="developer">Developer</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <RoleBadge role={user.role} />
                            )}
                            {isSuperAdmin && user.role !== "super_admin" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove this user from the account?
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleRemoveUser(user.userId)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Remove User
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </div>
                      ))}
                      {(!accountUsers || accountUsers.length === 0) && (
                        <div className="text-center py-8 text-gray-500">
                          No users found in this account.
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Account Selected</h3>
                    <p className="text-gray-500">
                      Select an account from the left to manage its users and settings.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}