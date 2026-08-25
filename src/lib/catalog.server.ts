import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseTokens, type MirrorSegment } from "./segments";

/** Client de lecture publique : les politiques RLS anon s'appliquent. */
export function publicClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

type SegmentRow = Database["public"]["Tables"]["excerpt_segments"]["Row"];

export function toMirrorSegment(row: SegmentRow): MirrorSegment {
  return {
    id: row.id,
    chapter_no: row.chapter_no,
    sort_order: row.sort_order,
    he_nikud: row.he_nikud,
    he_plain: row.he_plain,
    translit: row.translit,
    support_fr: row.support_fr,
    support_en: row.support_en,
    hard_words_fr: row.hard_words_fr,
    hard_words_en: row.hard_words_en,
    tokens: parseTokens(row.tokens),
  };
}
