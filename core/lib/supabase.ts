import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mgiqicasllvisiwvbiuu.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_kMLYlz99ua29hWOBwlbGxQ_TJ0uZeDt";

if (!supabaseAnonKey && typeof window !== "undefined") {
  console.warn(
    "[LexAgent] NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. " +
    "Get it from Supabase Dashboard → Project Settings → API → anon key, " +
    "then add it to apps/web/.env.local"
  );
}

/** Whether Supabase is reachable — resolves within 4s, false on timeout/error */
export const supabaseReachable: Promise<boolean> =
  typeof window !== "undefined"
    ? fetch(`${supabaseUrl}/auth/v1/health`, { method: "HEAD", signal: AbortSignal.timeout(4000) })
        .then(() => true)
        .catch(() => false)
    : Promise.resolve(true);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
