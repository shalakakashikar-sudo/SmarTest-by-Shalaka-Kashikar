// supabase/functions/admin-delete-user/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to get env vars and throw a clear error if they are missing.
function getRequiredEnv(key: string): string {
  const value = (Deno as any).env.get(key);
  if (!value) {
    throw new Error(`Function failed: Missing required environment variable "${key}". Please set this in your Supabase project's Function Secrets.`);
  }
  return value;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Explicitly check for required secrets at the beginning.
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const supabaseAnonKey = getRequiredEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

    // 1. Create a Supabase client with the user's auth token to verify their role.
    const userSupabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } },
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
      }
    );

    // 2. Fetch the user profile and check if they are an admin.
    const { data: { user } } = await userSupabaseClient.auth.getUser();
    if (user?.user_metadata?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Permission denied: Not an administrator.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Robustly parse the request body to get the userId.
    let userId: string;
    try {
        const body = await req.json();
        userId = body.userId;
        if (!userId) {
            throw new Error("'userId' not found in request body.");
        }
    } catch (e) {
        return new Response(JSON.stringify({ error: `Invalid request body: ${e.message}` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    
    if (user.id === userId) {
      return new Response(JSON.stringify({ error: 'Admins cannot delete their own account.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Create a Supabase admin client to perform the deletion.
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    // --- NEW: Clean up user's associated data before deleting their auth record ---
    // Get the role of the user being deleted to determine cleanup actions.
    const { data: userToDeleteData, error: getUserError } = await adminClient.auth.admin.getUserById(userId);
    if (getUserError) throw new Error(`Could not fetch user to delete: ${getUserError.message}`);
    if (!userToDeleteData.user) throw new Error(`User with ID ${userId} not found.`);
    
    const userRole = userToDeleteData.user.user_metadata?.role;

    if (userRole === 'student') {
        // If the user is a student, delete all their test submissions.
        const { error: deleteResultsError } = await adminClient
            .from('test_results')
            .delete()
            .eq('student_id', userId);
        if (deleteResultsError) {
            throw new Error(`Failed to delete student's test results: ${deleteResultsError.message}`);
        }
    } else if (userRole === 'teacher' || userRole === 'admin') {
        // If the user is a teacher/admin, delete all tests they created and associated data.
        const { data: tests, error: findTestsError } = await adminClient
            .from('tests')
            .select('id')
            .eq('created_by', userId);

        if (findTestsError) {
            throw new Error(`Failed to find tests created by user: ${findTestsError.message}`);
        }

        if (tests && tests.length > 0) {
            const testIds = tests.map(t => t.id);
            // Delete all results and questions for the tests created by this user.
            await adminClient.from('test_results').delete().in('test_id', testIds);
            await adminClient.from('questions').delete().in('test_id', testIds);
            // Delete the tests themselves.
            const { error: deleteTestsError } = await adminClient.from('tests').delete().in('id', testIds);
            if (deleteTestsError) {
                throw new Error(`Failed to delete tests created by user: ${deleteTestsError.message}`);
            }
        }
    }
    
    // 5. Now, delete the user from the auth system.
    const { error: deleteAuthUserError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteAuthUserError) throw deleteAuthUserError;

    // 6. Return a success response.
    return new Response(JSON.stringify({ message: 'User deleted successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    // The catch block will now receive more specific errors.
    console.error('Error in admin-delete-user function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
