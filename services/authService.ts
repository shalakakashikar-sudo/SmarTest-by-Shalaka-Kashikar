import { supabase } from './supabase';
import type { Role } from '../types';

export const authService = {
  async register(username: string, password: string, role: Role, fullName: string) {
    const lowercasedUsername = username.toLowerCase();

    if (role === 'admin' && lowercasedUsername !== 'shalakakashikar@gmail.com') {
      throw new Error("Admin registration is restricted to the designated administrator email.");
    }
    
    // NEW: Instead of using supabase.auth.signUp, we invoke a secure edge function
    // that uses the admin role to create a user. This allows us to bypass the
    // email confirmation step, which is the likely cause of login failures in
    // restrictive environments where users cannot access a confirmation email.
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { username, password, role, fullName }
    });

    if (error) {
      // The function might return a user-friendly error message
      throw new Error(error.message || 'Registration failed via function.');
    }
    
    if (!data) {
        throw new Error('Registration did not return a user from the function.');
    }
    
    return data; // The function should return the newly created user object
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