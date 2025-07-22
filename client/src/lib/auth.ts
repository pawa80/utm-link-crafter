import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { apiRequest } from "@/lib/queryClient";

export const signInWithEmail = async (email: string, password: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  
  // Create/get user in our database
  const idToken = await userCredential.user.getIdToken();
  
  await apiRequest('/api/users', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'x-firebase-uid': userCredential.user.uid,
    },
    body: JSON.stringify({
      firebaseUid: userCredential.user.uid,
      email: userCredential.user.email,
    }),
  });

  return userCredential;
};

export const signUpWithEmail = async (email: string, password: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  return userCredential;
};

export const createUserAccount = async (accountData: {
  email: string;
  accountName: string;
  pricingPlanId: number;
  industry?: string;
  teamSize?: string;
  useCases?: string[];
}) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("No authenticated user found");
  }

  const idToken = await currentUser.getIdToken();
  
  const response = await apiRequest('/api/users', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'x-firebase-uid': currentUser.uid,
    },
    body: JSON.stringify({
      firebaseUid: currentUser.uid,
      email: accountData.email,
      accountName: accountData.accountName,
      pricingPlanId: accountData.pricingPlanId,
      industry: accountData.industry,
      teamSize: accountData.teamSize,
      useCases: accountData.useCases,
    }),
  });

  return response;
};

export const logout = async () => {
  await signOut(auth);
};

export const createOrGetUser = async (firebaseUser: FirebaseUser) => {
  const idToken = await firebaseUser.getIdToken();
  
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
      'x-firebase-uid': firebaseUser.uid,
    },
    body: JSON.stringify({
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create/get user: ${response.statusText}`);
  }

  const userData = await response.json();
  return userData;
};

export const onAuthStateChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};