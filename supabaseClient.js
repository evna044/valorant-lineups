// Initialisation de Supabase
const SUPABASE_URL = "TON_URL_SUPABASE_ICI";
const SUPABASE_ANON_KEY = "TA_CLE_ANON_SUPABASE_ICI";

// On l'attache explicitement à window pour qu'il soit accessible globalement
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
