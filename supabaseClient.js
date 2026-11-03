const { createClient } = supabase;

const SUPABASE_URL = "https://bgpvsqaiodvwzlelgcwe.supabase.co";

const SUPABASE_KEY = "sb_publishable_BnJAUwUxEsdZiwXBgJ0ldg_RqMcS2S0";

window.supabaseClient = createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);
