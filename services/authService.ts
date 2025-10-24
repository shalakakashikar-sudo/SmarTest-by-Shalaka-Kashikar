

import { supabase } from './supabase';
import type { Role } from '../types';

export const authService = {
  async register(username: string, password: string, role: Role, fullName: string) {
    const lowercasedUsername = username.toLowerCase();

    if (role === 'admin' && lowercasedUsername !== 'shalakakashikar@gmail.com') {
      throw new Error("Admin registration is restricted to the designated administrator email.");
    }

    // Supabase requires an email for signup. For non-admin roles, we generate one
    // from the username to keep the UI simple.
    // FIX: Sanitize the username to prevent invalid email formats if the user
    // accidentally enters an email address in the username field.
    // e.g., 'teacher@example.com' becomes 'teacher@smartest-app.dev'
    const email = role === 'admin'
      ? lowercasedUsername
      : `${lowercasedUsername.split('@')[0].replace(/\s+/g, '_')}@smartest-app.dev`;
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username,
          full_name: fullName,
          role: role,
        },
      }
    });

    if (signUpError) {
      throw signUpError;
    }
    
    if (!signUpData.user) {
        throw new Error('Registration did not return a user. Email confirmation might be enabled.');
    }
    
    return signUpData.user;
  },

  async login(username: string, password: string, role: Role) {
    const lowercasedUsername = username.toLowerCase();

    // To log in, we derive the email from the username, mirroring the registration logic.
    // FIX: Sanitize the username here as well to ensure login is consistent with registration.
    const email = role === 'admin'
        ? lowercasedUsername
        : `${lowercasedUsername.split('@')[0].replace(/\s+/g, '_')}@smartest-app.dev`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};