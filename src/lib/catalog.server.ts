import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  BlockKind,
  BookPage,
  GlossaryWord,
  PageBlock,
  PageKey,
  PageSupportKind,
} from "./book-page";
import type { GlossaryItem, SpreadParagraph, SupportKind } from "./spread";


/** Client de lecture publique : les politiques RLS anon s'appliquent. */
export function publicClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

type SpreadRow = Database["public"]["Tables"]["spread_paragraphs"]["Row"];
type GlossaryRow = Database["public"]["Tables"]["glossary_entries"]["Row"];

export function toSpreadParagraph(row: SpreadRow): SpreadParagraph {
  return {
    id: row.id,
    sort_order: row.sort_order,
    stage_no: row.stage_no,
    he: row.he,
    he_has_nikud: row.he_has_nikud,
    support_kind: row.support_kind as SupportKind,
    support_fr: row.support_fr,
    support_en: row.support_en,
    support_he: row.support_he,
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
