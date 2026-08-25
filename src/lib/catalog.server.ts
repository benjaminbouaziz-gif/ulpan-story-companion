import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ExcerptParagraph, GlossaryItem } from "./excerpt";

/** Client de lecture publique : les politiques RLS anon s'appliquent. */
export function publicClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

type ParagraphRow = Database["public"]["Tables"]["excerpt_paragraphs"]["Row"];
type GlossaryRow = Database["public"]["Tables"]["glossary_entries"]["Row"];

export function toParagraph(row: ParagraphRow): ExcerptParagraph {
  return {
    id: row.id,
    sort_order: row.sort_order,
    stage_no: row.stage_no,
    stage_label_fr: row.stage_label_fr,
    stage_label_en: row.stage_label_en,
    he: row.he,
    has_nikud: row.has_nikud,
    support_fr: row.support_fr,
    support_en: row.support_en,
    audio_path: row.audio_path,
  };
}

export function toGlossaryItem(row: GlossaryRow): GlossaryItem {
  return {
    id: row.id,
    sort_order: row.sort_order,
    lemma_he: row.lemma_he,
    sense_fr: row.sense_fr,
    sense_en: row.sense_en,
  };
}
