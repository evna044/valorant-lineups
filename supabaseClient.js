// Initialisation de Supabase
const SUPABASE_URL = "https://bgpvsqaiodvwzlelgcwe.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BnJAUwUxEsdZiwXBgJ0ldg_RqMcS2S0";

// On l'attache explicitement à window pour qu'il soit accessible globalement
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
