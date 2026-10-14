
const SUPABASE_URL = "https://rbswywkbjiialvwngybz.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_yvCnmRkj8sAk-ka8JzgduQ_VVgwhH-G";

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
