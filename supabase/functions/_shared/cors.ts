// supabase/functions/_shared/cors.ts

/**
 * CORS headers to allow requests from any origin.
 * This is necessary for the browser's preflight OPTIONS request and for the actual
 * function invocation from your frontend application.
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
