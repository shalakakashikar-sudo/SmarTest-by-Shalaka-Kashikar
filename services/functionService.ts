import { supabase } from './supabase';

/**
 * A centralized wrapper for invoking Supabase Edge Functions.
 * This function automatically parses JSON error messages from failed function calls,
 * providing cleaner, more readable error feedback to the user.
 *
 * @param functionName The name of the Supabase Edge Function to invoke.
 * @param body The body of the request to send to the function.
 * @returns The data returned from the function on success.
 * @throws An `Error` with a clean, human-readable message on failure.
 */
export const functionService = {
  async invoke<T = any>(functionName: string, body?: object): Promise<T> {
    // The body is passed in the `options` object for supabase.functions.invoke
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });

    if (error) {
      let errorMessage = 'An unexpected error occurred while contacting the server.';
      
      // Supabase Edge Functions on failure often return a JSON string
      // in the error's `message` property. We try to parse it for a cleaner message.
      if (error.message) {
        try {
          const parsedError = JSON.parse(error.message);
          // Use the specific `error` key from our function's JSON response
          errorMessage = parsedError.error || error.message;
        } catch (e) {
          // If parsing fails, it's not the JSON we expected. Use the raw message.
          errorMessage = error.message;
        }
      }
      
      // Re-throw a standard Error with the cleaned-up message so UI components can catch it.
      throw new Error(errorMessage);
    }

    return data as T;
  },
};
