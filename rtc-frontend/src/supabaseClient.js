import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// This client handles frontend actions (login, signup) and respects RLS policies
export const supabase = createClient(supabaseUrl, supabaseAnonKey);