"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

interface UserProfileProviderProps {
  children: ReactNode;
}

export const UserProfileProvider = ({ children }: UserProfileProviderProps) => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Ref-based guards — avoid stale closures over `profile` state
  const inFlightUserIdRef = useRef<string | null>(null);
  const loadedUserIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | undefined>(undefined);
  userIdRef.current = user?.id;

  const loadProfile = useCallback(async (userId: string | null) => {
    if (!userId) {
      setProfile(null);
      loadedUserIdRef.current = null;
      setIsLoading(false);
      return;
    }

    // Skip if we already have the profile for this user (ref read, not state closure)
    if (loadedUserIdRef.current === userId) {
      setIsLoading(false);
      return;
    }

    // Avoid duplicate in-flight requests (React 18 Strict Mode double-invoke)
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
      loadedUserIdRef.current = userProfile?.userId ?? userId;
    } catch {
      setProfile(null);
      loadedUserIdRef.current = null;
    } finally {
      inFlightUserIdRef.current = null;
      setIsLoading(false);
    }
  }, []); // stable — all guards use refs, no state in closure

  useEffect(() => {
    if (!authLoading) {
      loadProfile(user?.id ?? null);
    }
  }, [user?.id, authLoading, loadProfile]);

  const refreshProfile = useCallback(async () => {
    const uid = userIdRef.current;
    if (uid) {
      loadedUserIdRef.current = null; // clear guard so loadProfile re-fetches
      setProfile(null);
      await loadProfile(uid);
    }
  }, [loadProfile]);

  const isAdmin = profile?.role === "admin";

  const value = useMemo(
    () => ({ profile, isLoading: isLoading || authLoading, isAdmin, refreshProfile }),
    [profile, isLoading, authLoading, isAdmin, refreshProfile],
  );

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
};

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error("useUserProfile must be used within a UserProfileProvider");
  }
  return context;
};
