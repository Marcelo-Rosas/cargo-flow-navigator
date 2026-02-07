import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Ensure the Supabase URL always uses HTTPS.
// OAuth metadata discovery requires HTTPS, so http:// URLs cause
// "only HTTPS is supported for OAuth metadata discovery" errors.
function enforceHttps(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  if (!url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

const SUPABASE_URL = enforceHttps(rawSupabaseUrl);

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});