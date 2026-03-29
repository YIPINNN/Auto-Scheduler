import { createClient } from '@supabase/supabase-js'

// Replace these with your actual values from the Supabase Dashboard
// Settings > API > Project URL & anon public key
const supabaseUrl = 'https://iqfhgjrzkyscaixddkbj.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxZmhnanJ6a3lzY2FpeGRka2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzUzNjksImV4cCI6MjA4Nzk1MTM2OX0.glV_j1rlhHym8GuEBFdS30hEBiS-8eD9exlddyi53CM'

const supabase = createClient(supabaseUrl, supabaseAnonKey, { 
    auth: {
        persistSession: true, // Ensure sessions are persisted
        autoRefreshToken: true, // Automatically refresh expired tokens
    },
}
);

export default supabase;
