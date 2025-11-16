
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { UserProfile } from '../types';

interface AuthContextType {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: true,
});

export const AuthProvider: React.FC<{ session: Session | null; children: React.ReactNode }> = ({ session, children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (session?.user) {
      const { user_metadata, id } = session.user;
      
      // Construct the profile from the user object's metadata.
      // This avoids a separate database call and removes the dependency
      // on the 'profiles' table.
      if (user_metadata.role && user_metadata.username) {
        setProfile({
          id: id,
          username: user_metadata.username,
          full_name: user_metadata.full_name || user_metadata.username,
          role: user_metadata.role,
        });
      } else {
        // This case might happen for users created before metadata was added.
        setProfile(null);
      }
    } else {
      setProfile(null);
    }
    setLoading(false);
  }, [session]);

  const value = {
    session,
    profile,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};