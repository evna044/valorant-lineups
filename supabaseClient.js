const { createClient } = supabase;

const SUPABASE_URL =
    "https://bgpvsqaiodvwzlelgcwe.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_BnJAUwUxEsdZiwXBgJ0ldg_RqMcS2S0";

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

window.supabaseClient = createClient(
    "https://bgpvsqaiodvwzlelgcwe.supabase.co",
    "sb_publishable_BnJAUwUxEsdZiwXBgJ0ldg_RqMcS2S0"
);