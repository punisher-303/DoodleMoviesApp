import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vkooejynmmgpfkutdvpw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrb29lanlubW1ncGZrdXRkdnB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MDU0MjQsImV4cCI6MjA5MTM4MTQyNH0.aLEx4pD88W1DWf6LDeNmCAkUhkV-CmaYuPWYKC9sj-E';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
