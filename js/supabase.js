import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://hibmqpoxpgvzpjqegjgw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_IwddFBOY6469aN7-l85OJg_LRL1-BsD";

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
