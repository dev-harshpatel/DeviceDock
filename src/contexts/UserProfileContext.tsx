"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/lib/auth/context";
import { UserProfile } from "@/types/user";
import { getUserProfile, upsertUserProfile } from "@/lib/supabase/utils";

interface UserProfileContextType {
  profile: UserProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(
  undefined,
);

interface UserProfileProviderProps {
  children: ReactNode;
}

export const UserProfileProvider = ({ children }: UserProfileProviderProps) => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inFlightUserIdRef = useRef<string | null>(null);

  const loadProfile = async (userId: string | null) => {
    if (!userId) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    // Skip if we already have the profile for this auth user
    if (profile?.userId === userId) {
      setIsLoading(false);
      return;
    }

    // Avoid duplicate requests (dev StrictMode can trigger effects twice)
    if (inFlightUserIdRef.current === userId) {
      return;
    }

    try {
      inFlightUserIdRef.current = userId;
      setIsLoading(true);
      let userProfile = await getUserProfile(userId);

      // If profile doesn't exist, create one with default 'user' role
      if (!userProfile) {
        userProfile = await upsertUserProfile(userId, "user");
      }

      setProfile(userProfile);
    } catch {
      setProfile(null);
    } finally {
      inFlightUserIdRef.current = null;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadProfile(user?.id ?? null);
    }
    // Use user?.id to avoid re-fetching when user object reference changes but ID is the same
  }, [user?.id, authLoading]);

  const refreshProfile = async () => {
    if (user?.id) {
      // Force refresh by clearing profile first
      setProfile(null);
      await loadProfile(user.id);
    }
  };

  const isAdmin = profile?.role === "admin";

  return (
    <UserProfileContext.Provider
      value={{
        profile,
        isLoading: isLoading || authLoading,
        isAdmin,
        refreshProfile,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error("useUserProfile must be used within a UserProfileProvider");
  }
  return context;
};
