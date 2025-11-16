// supabase/functions/create-test/index.ts
// This function is deprecated and has been consolidated into `save-test`.
// The `save-test` function now handles both creation and updates of tests
// by calling a transactional database function `create_or_update_test`.
// The client-side dataService has been updated to use `save-test` for creating new tests.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const errorPayload = {
    error: "This function is deprecated. The 'save-test' function is now used for both creating and updating tests."
  };

  return new Response(JSON.stringify(errorPayload), {
      status: 410, // 410 Gone
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
});
