export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_codes: {
        Row: {
          attempts: number
          book_id: string | null
          code_hash: string
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
        }
        Insert: {
          attempts?: number
          book_id?: string | null
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
        }
        Update: {
          attempts?: number
          book_id?: string | null
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_codes_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_login_attempts: {
        Row: {
          created_at: string
          email_hash: string | null
          id: string
          ip_hash: string | null
        }
        Insert: {
          created_at?: string
          email_hash?: string | null
          id?: string
          ip_hash?: string | null
        }
        Update: {
          created_at?: string
          email_hash?: string | null
          id?: string
          ip_hash?: string | null
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          batch_current: number | null
          batch_total: number | null
          book_step_id: string | null
          cost_usd: number | null
          created_at: string
          created_by: string | null
          duration_ms: number | null
          entity: string | null
          entity_id: string | null
          error: string | null
          error_summary: string | null
          fields: number
          id: string
          idempotency_key: string | null
          input_chars: number
          input_tokens: number | null
          kind: string
          mode: string | null
          model: string | null
          model_used: string | null
          ok: boolean
          output_chars: number
          output_tokens: number | null
          robot_name: string | null
          status: string | null
          truncated: boolean
        }
        Insert: {
          batch_current?: number | null
          batch_total?: number | null
          book_step_id?: string | null
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          entity?: string | null
          entity_id?: string | null
          error?: string | null
          error_summary?: string | null
          fields?: number
          id?: string
          idempotency_key?: string | null
          input_chars?: number
          input_tokens?: number | null
          kind: string
          mode?: string | null
          model?: string | null
          model_used?: string | null
          ok?: boolean
          output_chars?: number
          output_tokens?: number | null
          robot_name?: string | null
          status?: string | null
          truncated?: boolean
        }
        Update: {
          batch_current?: number | null
          batch_total?: number | null
          book_step_id?: string | null
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          entity?: string | null
          entity_id?: string | null
          error?: string | null
          error_summary?: string | null
          fields?: number
          id?: string
          idempotency_key?: string | null
          input_chars?: number
          input_tokens?: number | null
          kind?: string
          mode?: string | null
          model?: string | null
          model_used?: string | null
          ok?: boolean
          output_chars?: number
          output_tokens?: number | null
          robot_name?: string | null
          status?: string | null
          truncated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_book_step_id_fkey"
            columns: ["book_step_id"]
            isOneToOne: false
            referencedRelation: "book_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      artifacts: {
        Row: {
          book_step_id: string
          chapter_no: number | null
          checksum: string | null
          created_at: string
          created_by: string | null
          id: string
          origin: string
          plan_version: number | null
          prompt_version_id: string | null
          robot_run_id: string | null
          size_bytes: number | null
          storage_path: string
          type: string
          version: number
        }
        Insert: {
          book_step_id: string
          chapter_no?: number | null
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          origin: string
          plan_version?: number | null
          prompt_version_id?: string | null
          robot_run_id?: string | null
          size_bytes?: number | null
          storage_path: string
          type: string
          version: number
        }
        Update: {
          book_step_id?: string
          chapter_no?: number | null
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          origin?: string
          plan_version?: number | null
          prompt_version_id?: string | null
          robot_run_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          type?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "artifacts_book_step_id_fkey"
            columns: ["book_step_id"]
            isOneToOne: false
            referencedRelation: "book_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifacts_prompt_version_id_fkey"
            columns: ["prompt_version_id"]
            isOneToOne: false
            referencedRelation: "prompt_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifacts_robot_run_id_fkey"
            columns: ["robot_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_tracks: {
        Row: {
          book_id: string
          chapter_no: number | null
          created_at: string
          duration_s: number | null
          id: string
          label_en: string | null
          label_fr: string | null
          storage_path: string
        }
        Insert: {
          book_id: string
          chapter_no?: number | null
          created_at?: string
          duration_s?: number | null
          id?: string
          label_en?: string | null
          label_fr?: string | null
          storage_path: string
        }
        Update: {
          book_id?: string
          chapter_no?: number | null
          created_at?: string
          duration_s?: number | null
          id?: string
          label_en?: string | null
          label_fr?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_tracks_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_access: {
        Row: {
          book_id: string
          first_opened_at: string
          id: string
          last_seen_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          first_opened_at?: string
          id?: string
          last_seen_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          first_opened_at?: string
          id?: string
          last_seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_access_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_decisions: {
        Row: {
          archived_at: string | null
          archived_from_version: number | null
          book_id: string
          book_step_id: string | null
          contexte: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decision: string | null
          id: string
          question: string
          question_key: string
          sort_order: number
          stale: boolean
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_from_version?: number | null
          book_id: string
          book_step_id?: string | null
          contexte?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decision?: string | null
          id?: string
          question: string
          question_key: string
          sort_order?: number
          stale?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_from_version?: number | null
          book_id?: string
          book_step_id?: string | null
          contexte?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decision?: string | null
          id?: string
          question?: string
          question_key?: string
          sort_order?: number
          stale?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_decisions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_decisions_book_step_id_fkey"
            columns: ["book_step_id"]
            isOneToOne: false
            referencedRelation: "book_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      book_pages: {
        Row: {
          book_id: string
          chapter_no: number | null
          chapter_title_en: string | null
          chapter_title_fr: string | null
          chapter_title_he: string | null
          created_at: string
          folio: number | null
          id: string
          is_published: boolean
          page_no: number
          running_head_en: string | null
          running_head_fr: string | null
          support_kind: string
          updated_at: string
          validated_at: string | null
        }
        Insert: {
          book_id: string
          chapter_no?: number | null
          chapter_title_en?: string | null
          chapter_title_fr?: string | null
          chapter_title_he?: string | null
          created_at?: string
          folio?: number | null
          id?: string
          is_published?: boolean
          page_no: number
          running_head_en?: string | null
          running_head_fr?: string | null
          support_kind: string
          updated_at?: string
          validated_at?: string | null
        }
        Update: {
          book_id?: string
          chapter_no?: number | null
          chapter_title_en?: string | null
          chapter_title_fr?: string | null
          chapter_title_he?: string | null
          created_at?: string
          folio?: number | null
          id?: string
          is_published?: boolean
          page_no?: number
          running_head_en?: string | null
          running_head_fr?: string | null
          support_kind?: string
          updated_at?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_pages_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_steps: {
        Row: {
          awaiting: string | null
          awaiting_since: string | null
          book_id: string
          closed_at: string | null
          created_at: string
          id: string
          label_en: string
          label_fr: string
          lang: string
          note: string | null
          opened_at: string | null
          rank: number
          species: string
          status: string
          step_code: string
          updated_at: string
        }
        Insert: {
          awaiting?: string | null
          awaiting_since?: string | null
          book_id: string
          closed_at?: string | null
          created_at?: string
          id?: string
          label_en: string
          label_fr: string
          lang?: string
          note?: string | null
          opened_at?: string | null
          rank: number
          species: string
          status?: string
          step_code: string
          updated_at?: string
        }
        Update: {
          awaiting?: string | null
          awaiting_since?: string | null
          book_id?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          label_en?: string
          label_fr?: string
          lang?: string
          note?: string | null
          opened_at?: string | null
          rank?: number
          species?: string
          status?: string
          step_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_steps_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          amazon_asin: string | null
          amazon_url_com: string | null
          amazon_url_fr: string | null
          amazon_url_other: string | null
          blurb_en: string | null
          blurb_en_hash: string | null
          blurb_en_source: string | null
          blurb_fr: string | null
          book_constraints_fr: string | null
          chapters_count: number | null
          collection_id: string | null
          cover_url: string | null
          created_at: string
          current_step_code: string | null
          excerpt_he: string | null
          excerpt_translation_en: string | null
          excerpt_translation_fr: string | null
          expected_at: string | null
          figures_verified_at: string | null
          id: string
          intent_note_fr: string | null
          isbn: string | null
          kdp_page_count: number | null
          level_note_en: string | null
          level_note_en_hash: string | null
          level_note_en_source: string | null
          level_note_fr: string | null
          page_count: number | null
          price_eur: number | null
          prompt_id: string | null
          published_at: string | null
          qr_code: string
          qr_reserved_at: string | null
          retired_at: string | null
          sample_pdf_url: string | null
          slug: string
          source_material_fr: string | null
          spine_mm: number | null
          spread_chapter_en: string | null
          spread_chapter_fr: string | null
          spread_folio_left: number | null
          spread_pages: number | null
          spread_running_head_en: string | null
          spread_running_head_fr: string | null
          status: Database["public"]["Enums"]["book_status"]
          subtitle_en: string | null
          subtitle_fr: string | null
          title_en: string | null
          title_fr: string
          title_he: string | null
          tome_no: number | null
          updated_at: string
          what_you_learn_en: Json
          what_you_learn_en_hash: string | null
          what_you_learn_en_source: string | null
          what_you_learn_fr: Json
          words_unique: number | null
          work_summary_fr: string | null
        }
        Insert: {
          amazon_asin?: string | null
          amazon_url_com?: string | null
          amazon_url_fr?: string | null
          amazon_url_other?: string | null
          blurb_en?: string | null
          blurb_en_hash?: string | null
          blurb_en_source?: string | null
          blurb_fr?: string | null
          book_constraints_fr?: string | null
          chapters_count?: number | null
          collection_id?: string | null
          cover_url?: string | null
          created_at?: string
          current_step_code?: string | null
          excerpt_he?: string | null
          excerpt_translation_en?: string | null
          excerpt_translation_fr?: string | null
          expected_at?: string | null
          figures_verified_at?: string | null
          id?: string
          intent_note_fr?: string | null
          isbn?: string | null
          kdp_page_count?: number | null
          level_note_en?: string | null
          level_note_en_hash?: string | null
          level_note_en_source?: string | null
          level_note_fr?: string | null
          page_count?: number | null
          price_eur?: number | null
          prompt_id?: string | null
          published_at?: string | null
          qr_code: string
          qr_reserved_at?: string | null
          retired_at?: string | null
          sample_pdf_url?: string | null
          slug: string
          source_material_fr?: string | null
          spine_mm?: number | null
          spread_chapter_en?: string | null
          spread_chapter_fr?: string | null
          spread_folio_left?: number | null
          spread_pages?: number | null
          spread_running_head_en?: string | null
          spread_running_head_fr?: string | null
          status?: Database["public"]["Enums"]["book_status"]
          subtitle_en?: string | null
          subtitle_fr?: string | null
          title_en?: string | null
          title_fr: string
          title_he?: string | null
          tome_no?: number | null
          updated_at?: string
          what_you_learn_en?: Json
          what_you_learn_en_hash?: string | null
          what_you_learn_en_source?: string | null
          what_you_learn_fr?: Json
          words_unique?: number | null
          work_summary_fr?: string | null
        }
        Update: {
          amazon_asin?: string | null
          amazon_url_com?: string | null
          amazon_url_fr?: string | null
          amazon_url_other?: string | null
          blurb_en?: string | null
          blurb_en_hash?: string | null
          blurb_en_source?: string | null
          blurb_fr?: string | null
          book_constraints_fr?: string | null
          chapters_count?: number | null
          collection_id?: string | null
          cover_url?: string | null
          created_at?: string
          current_step_code?: string | null
          excerpt_he?: string | null
          excerpt_translation_en?: string | null
          excerpt_translation_fr?: string | null
          expected_at?: string | null
          figures_verified_at?: string | null
          id?: string
          intent_note_fr?: string | null
          isbn?: string | null
          kdp_page_count?: number | null
          level_note_en?: string | null
          level_note_en_hash?: string | null
          level_note_en_source?: string | null
          level_note_fr?: string | null
          page_count?: number | null
          price_eur?: number | null
          prompt_id?: string | null
          published_at?: string | null
          qr_code?: string
          qr_reserved_at?: string | null
          retired_at?: string | null
          sample_pdf_url?: string | null
          slug?: string
          source_material_fr?: string | null
          spine_mm?: number | null
          spread_chapter_en?: string | null
          spread_chapter_fr?: string | null
          spread_folio_left?: number | null
          spread_pages?: number | null
          spread_running_head_en?: string | null
          spread_running_head_fr?: string | null
          status?: Database["public"]["Enums"]["book_status"]
          subtitle_en?: string | null
          subtitle_fr?: string | null
          title_en?: string | null
          title_fr?: string
          title_he?: string | null
          tome_no?: number | null
          updated_at?: string
          what_you_learn_en?: Json
          what_you_learn_en_hash?: string | null
          what_you_learn_en_source?: string | null
          what_you_learn_fr?: Json
          words_unique?: number | null
          work_summary_fr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "books_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_measures: {
        Row: {
          agent_run_id: string | null
          artifact_id: string | null
          book_step_id: string
          chapter_no: number
          created_at: string
          expected_pages: number
          first_page: number
          id: string
          ok: boolean
          pages: Json
          problems: Json
        }
        Insert: {
          agent_run_id?: string | null
          artifact_id?: string | null
          book_step_id: string
          chapter_no: number
          created_at?: string
          expected_pages: number
          first_page: number
          id?: string
          ok: boolean
          pages?: Json
          problems?: Json
        }
        Update: {
          agent_run_id?: string | null
          artifact_id?: string | null
          book_step_id?: string
          chapter_no?: number
          created_at?: string
          expected_pages?: number
          first_page?: number
          id?: string
          ok?: boolean
          pages?: Json
          problems?: Json
        }
        Relationships: [
          {
            foreignKeyName: "chapter_measures_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_measures_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_measures_book_step_id_fkey"
            columns: ["book_step_id"]
            isOneToOne: false
            referencedRelation: "book_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          color_hex: string
          created_at: string
          description_en: string | null
          description_en_hash: string | null
          description_en_source: string | null
          description_fr: string | null
          for_whom_en: string | null
          for_whom_en_hash: string | null
          for_whom_en_source: string | null
          for_whom_fr: string | null
          hero_image_url: string | null
          id: string
          is_active: boolean
          name_en: string
          name_fr: string
          slug: string
          sort_order: number
          story_nature_en: string | null
          story_nature_en_hash: string | null
          story_nature_en_source: string | null
          story_nature_fr: string | null
          tagline_en: string | null
          tagline_en_hash: string | null
          tagline_en_source: string | null
          tagline_fr: string | null
          updated_at: string
        }
        Insert: {
          color_hex?: string
          created_at?: string
          description_en?: string | null
          description_en_hash?: string | null
          description_en_source?: string | null
          description_fr?: string | null
          for_whom_en?: string | null
          for_whom_en_hash?: string | null
          for_whom_en_source?: string | null
          for_whom_fr?: string | null
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          name_en: string
          name_fr: string
          slug: string
          sort_order?: number
          story_nature_en?: string | null
          story_nature_en_hash?: string | null
          story_nature_en_source?: string | null
          story_nature_fr?: string | null
          tagline_en?: string | null
          tagline_en_hash?: string | null
          tagline_en_source?: string | null
          tagline_fr?: string | null
          updated_at?: string
        }
        Update: {
          color_hex?: string
          created_at?: string
          description_en?: string | null
          description_en_hash?: string | null
          description_en_source?: string | null
          description_fr?: string | null
          for_whom_en?: string | null
          for_whom_en_hash?: string | null
          for_whom_en_source?: string | null
          for_whom_fr?: string | null
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          name_en?: string
          name_fr?: string
          slug?: string
          sort_order?: number
          story_nature_en?: string | null
          story_nature_en_hash?: string | null
          story_nature_en_source?: string | null
          story_nature_fr?: string | null
          tagline_en?: string | null
          tagline_en_hash?: string | null
          tagline_en_source?: string | null
          tagline_fr?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      content_versions: {
        Row: {
          created_at: string
          created_by: string | null
          entity: string
          entity_id: string
          id: string
          snapshot: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity: string
          entity_id: string
          id?: string
          snapshot: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity?: string
          entity_id?: string
          id?: string
          snapshot?: Json
        }
        Relationships: []
      }
      email_signups: {
        Row: {
          book_id: string | null
          confirmed_at: string | null
          confirmed_ip_hash: string | null
          consent_asked_at: string
          consent_token: string
          created_at: string
          email: string
          id: string
          lang: string
          qr_code: string | null
        }
        Insert: {
          book_id?: string | null
          confirmed_at?: string | null
          confirmed_ip_hash?: string | null
          consent_asked_at?: string
          consent_token: string
          created_at?: string
          email: string
          id?: string
          lang?: string
          qr_code?: string | null
        }
        Update: {
          book_id?: string | null
          confirmed_at?: string | null
          confirmed_ip_hash?: string | null
          consent_asked_at?: string
          consent_token?: string
          created_at?: string
          email?: string
          id?: string
          lang?: string
          qr_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_signups_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          book_id: string | null
          created_at: string
          id: string
          kind: string
          meta: Json
          qr_code: string | null
          user_id: string | null
        }
        Insert: {
          book_id?: string | null
          created_at?: string
          id?: string
          kind: string
          meta?: Json
          qr_code?: string | null
          user_id?: string | null
        }
        Update: {
          book_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          qr_code?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      glossary_entries: {
        Row: {
          book_id: string
          chapter_no: number | null
          created_at: string
          first_page: number | null
          form_he: string | null
          gloss_no: number | null
          he_nikud: string | null
          id: string
          is_showcase: boolean
          lemma_he: string
          note_en: string | null
          note_fr: string | null
          sense_en: string | null
          sense_en_hash: string | null
          sense_en_source: string | null
          sense_fr: string | null
          sort_order: number
          translit: string | null
        }
        Insert: {
          book_id: string
          chapter_no?: number | null
          created_at?: string
          first_page?: number | null
          form_he?: string | null
          gloss_no?: number | null
          he_nikud?: string | null
          id?: string
          is_showcase?: boolean
          lemma_he: string
          note_en?: string | null
          note_fr?: string | null
          sense_en?: string | null
          sense_en_hash?: string | null
          sense_en_source?: string | null
          sense_fr?: string | null
          sort_order?: number
          translit?: string | null
        }
        Update: {
          book_id?: string
          chapter_no?: number | null
          created_at?: string
          first_page?: number | null
          form_he?: string | null
          gloss_no?: number | null
          he_nikud?: string | null
          id?: string
          is_showcase?: boolean
          lemma_he?: string
          note_en?: string | null
          note_fr?: string | null
          sense_en?: string | null
          sense_en_hash?: string | null
          sense_en_source?: string | null
          sense_fr?: string | null
          sort_order?: number
          translit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "glossary_entries_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_log: {
        Row: {
          author: string | null
          id: string
          occurred_at: string
          old_value: Json
          operation: string
          row_id: string | null
          table_name: string
        }
        Insert: {
          author?: string | null
          id?: string
          occurred_at?: string
          old_value: Json
          operation: string
          row_id?: string | null
          table_name: string
        }
        Update: {
          author?: string | null
          id?: string
          occurred_at?: string
          old_value?: Json
          operation?: string
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      page_blocks: {
        Row: {
          block_kind: string
          created_at: string
          he_nikud: string | null
          he_plain: string | null
          id: string
          page_id: string
          sort_order: number
          support_en: string | null
          support_en_hash: string | null
          support_en_source: string | null
          support_fr: string | null
        }
        Insert: {
          block_kind?: string
          created_at?: string
          he_nikud?: string | null
          he_plain?: string | null
          id?: string
          page_id: string
          sort_order?: number
          support_en?: string | null
          support_en_hash?: string | null
          support_en_source?: string | null
          support_fr?: string | null
        }
        Update: {
          block_kind?: string
          created_at?: string
          he_nikud?: string | null
          he_plain?: string | null
          id?: string
          page_id?: string
          sort_order?: number
          support_en?: string | null
          support_en_hash?: string | null
          support_en_source?: string | null
          support_fr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_blocks_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "book_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      page_keys: {
        Row: {
          created_at: string
          gloss_no: number | null
          he_nikud: string
          id: string
          page_id: string
          sense_en: string | null
          sense_fr: string | null
          sort_order: number
          translit: string | null
        }
        Insert: {
          created_at?: string
          gloss_no?: number | null
          he_nikud: string
          id?: string
          page_id: string
          sense_en?: string | null
          sense_fr?: string | null
          sort_order?: number
          translit?: string | null
        }
        Update: {
          created_at?: string
          gloss_no?: number | null
          he_nikud?: string
          id?: string
          page_id?: string
          sense_en?: string | null
          sense_fr?: string | null
          sort_order?: number
          translit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_keys_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "book_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      page_sections: {
        Row: {
          body_en: string | null
          body_en_hash: string | null
          body_en_source: string | null
          body_fr: string | null
          created_at: string
          data: Json
          data_en_hash: string | null
          data_en_source: string | null
          id: string
          is_locked: boolean
          is_visible: boolean
          kind: Database["public"]["Enums"]["section_kind"]
          locales: string[]
          page_id: string
          sort_order: number
          title_en: string | null
          title_en_hash: string | null
          title_en_source: string | null
          title_fr: string | null
          updated_at: string
        }
        Insert: {
          body_en?: string | null
          body_en_hash?: string | null
          body_en_source?: string | null
          body_fr?: string | null
          created_at?: string
          data?: Json
          data_en_hash?: string | null
          data_en_source?: string | null
          id?: string
          is_locked?: boolean
          is_visible?: boolean
          kind: Database["public"]["Enums"]["section_kind"]
          locales?: string[]
          page_id: string
          sort_order?: number
          title_en?: string | null
          title_en_hash?: string | null
          title_en_source?: string | null
          title_fr?: string | null
          updated_at?: string
        }
        Update: {
          body_en?: string | null
          body_en_hash?: string | null
          body_en_source?: string | null
          body_fr?: string | null
          created_at?: string
          data?: Json
          data_en_hash?: string | null
          data_en_source?: string | null
          id?: string
          is_locked?: boolean
          is_visible?: boolean
          kind?: Database["public"]["Enums"]["section_kind"]
          locales?: string[]
          page_id?: string
          sort_order?: number
          title_en?: string | null
          title_en_hash?: string | null
          title_en_source?: string | null
          title_fr?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_sections_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          created_at: string
          id: string
          is_system: boolean
          slug: string
          status: Database["public"]["Enums"]["page_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_system?: boolean
          slug: string
          status?: Database["public"]["Enums"]["page_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_system?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["page_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          consent_at: string | null
          consent_source: string | null
          created_at: string
          display_name: string | null
          email: string | null
          lang: string
          text_size: string
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consent_at?: string | null
          consent_source?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          lang?: string
          text_size?: string
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          consent_at?: string | null
          consent_source?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          lang?: string
          text_size?: string
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prompt_activations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          prompt_id: string
          prompt_version_id: string
          reason: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          prompt_id: string
          prompt_version_id: string
          reason?: string | null
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          prompt_id?: string
          prompt_version_id?: string
          reason?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "prompt_activations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_activations_prompt_version_id_fkey"
            columns: ["prompt_version_id"]
            isOneToOne: false
            referencedRelation: "prompt_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_versions: {
        Row: {
          change_note: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          model: string | null
          prompt_id: string
          version: number
          web_search: boolean
        }
        Insert: {
          change_note?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          prompt_id: string
          version: number
          web_search?: boolean
        }
        Update: {
          change_note?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          prompt_id?: string
          version?: number
          web_search?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          active_version_id: string | null
          code: string
          collection_id: string | null
          created_at: string
          frozen_at: string | null
          id: string
          is_active: boolean
          lang: string
          name: string
          step_code: string
          updated_at: string
        }
        Insert: {
          active_version_id?: string | null
          code: string
          collection_id?: string | null
          created_at?: string
          frozen_at?: string | null
          id?: string
          is_active?: boolean
          lang?: string
          name: string
          step_code: string
          updated_at?: string
        }
        Update: {
          active_version_id?: string | null
          code?: string
          collection_id?: string | null
          created_at?: string
          frozen_at?: string | null
          id?: string
          is_active?: boolean
          lang?: string
          name?: string
          step_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompts_active_version_id_fkey"
            columns: ["active_version_id"]
            isOneToOne: false
            referencedRelation: "prompt_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompts_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_corrections: {
        Row: {
          agent_run_id: string | null
          artifact_id: string | null
          book_step_id: string
          chapter_no: number | null
          created_at: string
          id: string
          message: string | null
          ok: boolean
          packet_chars: number | null
          report_id: string
        }
        Insert: {
          agent_run_id?: string | null
          artifact_id?: string | null
          book_step_id: string
          chapter_no?: number | null
          created_at?: string
          id?: string
          message?: string | null
          ok?: boolean
          packet_chars?: number | null
          report_id: string
        }
        Update: {
          agent_run_id?: string | null
          artifact_id?: string | null
          book_step_id?: string
          chapter_no?: number | null
          created_at?: string
          id?: string
          message?: string | null
          ok?: boolean
          packet_chars?: number | null
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qc_corrections_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_corrections_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_corrections_book_step_id_fkey"
            columns: ["book_step_id"]
            isOneToOne: false
            referencedRelation: "book_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_corrections_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "qc_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_criteria: {
        Row: {
          code: string
          created_at: string
          family: string
          grid_id: string
          id: string
          is_active: boolean
          is_blocking: boolean
          label: string
          mechanic_key: string | null
          question: string
          sort_order: number
          species: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          family: string
          grid_id: string
          id?: string
          is_active?: boolean
          is_blocking?: boolean
          label: string
          mechanic_key?: string | null
          question: string
          sort_order?: number
          species?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          family?: string
          grid_id?: string
          id?: string
          is_active?: boolean
          is_blocking?: boolean
          label?: string
          mechanic_key?: string | null
          question?: string
          sort_order?: number
          species?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qc_criteria_grid_id_fkey"
            columns: ["grid_id"]
            isOneToOne: false
            referencedRelation: "qc_grids"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_grids: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          step_code: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          step_code: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          step_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      qc_reports: {
        Row: {
          agent_run_id: string | null
          blocking_failed: number
          book_step_id: string
          chapter_no: number | null
          created_at: string
          created_by: string | null
          criteria_passed: number
          criteria_total: number
          duration_ms: number | null
          grid_id: string | null
          id: string
          message: string | null
          model_used: string | null
          passed: boolean
          plan_version: number | null
          regles_prompt_version_id: string | null
          regles_version: number | null
          round: number
          score_conformite: number | null
          score_general: number | null
          score_langue: number | null
          score_pedagogie: number | null
          score_structure: number | null
          status: string
          stop_reason: string | null
          target_artifact_id: string | null
        }
        Insert: {
          agent_run_id?: string | null
          blocking_failed?: number
          book_step_id: string
          chapter_no?: number | null
          created_at?: string
          created_by?: string | null
          criteria_passed?: number
          criteria_total?: number
          duration_ms?: number | null
          grid_id?: string | null
          id?: string
          message?: string | null
          model_used?: string | null
          passed?: boolean
          plan_version?: number | null
          regles_prompt_version_id?: string | null
          regles_version?: number | null
          round?: number
          score_conformite?: number | null
          score_general?: number | null
          score_langue?: number | null
          score_pedagogie?: number | null
          score_structure?: number | null
          status?: string
          stop_reason?: string | null
          target_artifact_id?: string | null
        }
        Update: {
          agent_run_id?: string | null
          blocking_failed?: number
          book_step_id?: string
          chapter_no?: number | null
          created_at?: string
          created_by?: string | null
          criteria_passed?: number
          criteria_total?: number
          duration_ms?: number | null
          grid_id?: string | null
          id?: string
          message?: string | null
          model_used?: string | null
          passed?: boolean
          plan_version?: number | null
          regles_prompt_version_id?: string | null
          regles_version?: number | null
          round?: number
          score_conformite?: number | null
          score_general?: number | null
          score_langue?: number | null
          score_pedagogie?: number | null
          score_structure?: number | null
          status?: string
          stop_reason?: string | null
          target_artifact_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qc_reports_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_reports_book_step_id_fkey"
            columns: ["book_step_id"]
            isOneToOne: false
            referencedRelation: "book_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_reports_grid_id_fkey"
            columns: ["grid_id"]
            isOneToOne: false
            referencedRelation: "qc_grids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_reports_regles_prompt_version_id_fkey"
            columns: ["regles_prompt_version_id"]
            isOneToOne: false
            referencedRelation: "prompt_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_reports_target_artifact_id_fkey"
            columns: ["target_artifact_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_settings: {
        Row: {
          enabled: boolean
          id: boolean
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      qc_step_policies: {
        Row: {
          book_step_id: string
          created_at: string
          grid_id: string | null
          id: string
          max_rounds: number
          pass_threshold: number
          strategy: string
          updated_at: string
        }
        Insert: {
          book_step_id: string
          created_at?: string
          grid_id?: string | null
          id?: string
          max_rounds?: number
          pass_threshold?: number
          strategy?: string
          updated_at?: string
        }
        Update: {
          book_step_id?: string
          created_at?: string
          grid_id?: string | null
          id?: string
          max_rounds?: number
          pass_threshold?: number
          strategy?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qc_step_policies_book_step_id_fkey"
            columns: ["book_step_id"]
            isOneToOne: true
            referencedRelation: "book_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_step_policies_grid_id_fkey"
            columns: ["grid_id"]
            isOneToOne: false
            referencedRelation: "qc_grids"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_verdicts: {
        Row: {
          created_at: string
          criterion_code: string
          criterion_id: string | null
          explanation: string | null
          family: string
          id: string
          is_blocking: boolean
          label: string
          location: string | null
          report_id: string
          species: string
          verdict: string
        }
        Insert: {
          created_at?: string
          criterion_code: string
          criterion_id?: string | null
          explanation?: string | null
          family: string
          id?: string
          is_blocking?: boolean
          label: string
          location?: string | null
          report_id: string
          species?: string
          verdict: string
        }
        Update: {
          created_at?: string
          criterion_code?: string
          criterion_id?: string | null
          explanation?: string | null
          family?: string
          id?: string
          is_blocking?: boolean
          label?: string
          location?: string | null
          report_id?: string
          species?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "qc_verdicts_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "qc_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_verdicts_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "qc_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          answer: Json
          book_id: string
          chapter_no: number | null
          created_at: string
          explain_en: string | null
          explain_fr: string | null
          id: string
          kind: Database["public"]["Enums"]["quiz_kind"]
          options: Json
          prompt_en: string | null
          prompt_fr: string | null
          prompt_he: string | null
          sort_order: number
        }
        Insert: {
          answer?: Json
          book_id: string
          chapter_no?: number | null
          created_at?: string
          explain_en?: string | null
          explain_fr?: string | null
          id?: string
          kind: Database["public"]["Enums"]["quiz_kind"]
          options?: Json
          prompt_en?: string | null
          prompt_fr?: string | null
          prompt_he?: string | null
          sort_order?: number
        }
        Update: {
          answer?: Json
          book_id?: string
          chapter_no?: number | null
          created_at?: string
          explain_en?: string | null
          explain_fr?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["quiz_kind"]
          options?: Json
          prompt_en?: string | null
          prompt_fr?: string | null
          prompt_he?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      reader_progress: {
        Row: {
          book_id: string
          id: string
          quiz_answered: number
          quiz_correct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          id?: string
          quiz_answered?: number
          quiz_correct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          id?: string
          quiz_answered?: number
          quiz_correct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reader_progress_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          artifact_id: string | null
          author: string | null
          book_step_id: string
          comment: string | null
          created_at: string
          decision: string
          id: string
        }
        Insert: {
          artifact_id?: string | null
          author?: string | null
          book_step_id: string
          comment?: string | null
          created_at?: string
          decision: string
          id?: string
        }
        Update: {
          artifact_id?: string | null
          author?: string | null
          book_step_id?: string
          comment?: string | null
          created_at?: string
          decision?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_book_step_id_fkey"
            columns: ["book_step_id"]
            isOneToOne: false
            referencedRelation: "book_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      spread_paragraphs: {
        Row: {
          book_id: string
          created_at: string
          he: string
          he_has_nikud: boolean
          id: string
          sort_order: number
          stage_no: number
          support_en: string | null
          support_fr: string | null
          support_he: string | null
          support_kind: string
          updated_at: string
        }
        Insert: {
          book_id: string
          created_at?: string
          he: string
          he_has_nikud?: boolean
          id?: string
          sort_order?: number
          stage_no: number
          support_en?: string | null
          support_fr?: string | null
          support_he?: string | null
          support_kind?: string
          updated_at?: string
        }
        Update: {
          book_id?: string
          created_at?: string
          he?: string
          he_has_nikud?: boolean
          id?: string
          sort_order?: number
          stage_no?: number
          support_en?: string | null
          support_fr?: string | null
          support_he?: string | null
          support_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spread_paragraphs_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      step_templates: {
        Row: {
          code: string
          collection_id: string | null
          created_at: string
          id: string
          is_active: boolean
          label_en: string
          label_fr: string
          langs: string[]
          rank: number
          species: string
          updated_at: string
        }
        Insert: {
          code: string
          collection_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label_en: string
          label_fr: string
          langs?: string[]
          rank: number
          species: string
          updated_at?: string
        }
        Update: {
          code?: string
          collection_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label_en?: string
          label_fr?: string
          langs?: string[]
          rank?: number
          species?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "step_templates_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      instancier_chaine: { Args: { p_book_id: string }; Returns: number }
      supprimer_prompt: { Args: { p_prompt_id: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "editor" | "user"
      book_status:
        | "idea"
        | "writing"
        | "vocalizing"
        | "proofreading"
        | "layout"
        | "bat_ok"
        | "printing"
        | "published"
        | "retired"
      page_status: "draft" | "published"
      quiz_kind: "qcm" | "trou" | "ordre" | "ecoute"
      section_kind:
        | "heading"
        | "richtext"
        | "quote"
        | "steps"
        | "compare"
        | "hebrew_sample"
        | "faq"
        | "cta"
        | "book_spread"
        | "facts"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "editor", "user"],
      book_status: [
        "idea",
        "writing",
        "vocalizing",
        "proofreading",
        "layout",
        "bat_ok",
        "printing",
        "published",
        "retired",
      ],
      page_status: ["draft", "published"],
      quiz_kind: ["qcm", "trou", "ordre", "ecoute"],
      section_kind: [
        "heading",
        "richtext",
        "quote",
        "steps",
        "compare",
        "hebrew_sample",
        "faq",
        "cta",
        "book_spread",
        "facts",
      ],
    },
  },
} as const
