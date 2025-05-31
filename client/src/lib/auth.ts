import { auth } from "./firebase";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  type User
} from "firebase/auth";
import { apiRequest } from "./queryClient";

export interface AuthUser {
  uid: string;
  email: string | null;
}

export const signUpWithEmail = async (email: string, password: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

export const signInWithEmail = async (email: string, password: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

export const logout = async () => {
  await signOut(auth);
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const createOrGetUser = async (firebaseUser: User) => {
  const token = await firebaseUser.getIdToken();
  
  const response = await fetch("/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-firebase-uid": firebaseUser.uid,
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

  return response.json();
};
