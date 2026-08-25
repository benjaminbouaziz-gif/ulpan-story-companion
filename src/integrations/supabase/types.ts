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
    PostgrestVersion: "14.15"
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
      agent_runs: {
        Row: {
          cost_usd: number | null
          created_at: string
          created_by: string | null
          entity: string | null
          entity_id: string | null
          error: string | null
          fields: number
          id: string
          input_chars: number
          kind: string
          model: string | null
          ok: boolean
          output_chars: number
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          entity?: string | null
          entity_id?: string | null
          error?: string | null
          fields?: number
          id?: string
          input_chars?: number
          kind: string
          model?: string | null
          ok?: boolean
          output_chars?: number
        }
        Update: {
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          entity?: string | null
          entity_id?: string | null
          error?: string | null
          fields?: number
          id?: string
          input_chars?: number
          kind?: string
          model?: string | null
          ok?: boolean
          output_chars?: number
        }
        Relationships: []
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
          chapters_count: number | null
          collection_id: string | null
          cover_url: string | null
          created_at: string
          excerpt_he: string | null
          excerpt_translation_en: string | null
          excerpt_translation_fr: string | null
          expected_at: string | null
          figures_verified_at: string | null
          id: string
          isbn: string | null
          kdp_page_count: number | null
          level_note_en: string | null
          level_note_en_hash: string | null
          level_note_en_source: string | null
          level_note_fr: string | null
          page_count: number | null
          price_eur: number | null
          published_at: string | null
          qr_code: string
          qr_reserved_at: string | null
          retired_at: string | null
          sample_pdf_url: string | null
          slug: string
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
          chapters_count?: number | null
          collection_id?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt_he?: string | null
          excerpt_translation_en?: string | null
          excerpt_translation_fr?: string | null
          expected_at?: string | null
          figures_verified_at?: string | null
          id?: string
          isbn?: string | null
          kdp_page_count?: number | null
          level_note_en?: string | null
          level_note_en_hash?: string | null
          level_note_en_source?: string | null
          level_note_fr?: string | null
          page_count?: number | null
          price_eur?: number | null
          published_at?: string | null
          qr_code: string
          qr_reserved_at?: string | null
          retired_at?: string | null
          sample_pdf_url?: string | null
          slug: string
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
          chapters_count?: number | null
          collection_id?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt_he?: string | null
          excerpt_translation_en?: string | null
          excerpt_translation_fr?: string | null
          expected_at?: string | null
          figures_verified_at?: string | null
          id?: string
          isbn?: string | null
          kdp_page_count?: number | null
          level_note_en?: string | null
          level_note_en_hash?: string | null
          level_note_en_source?: string | null
          level_note_fr?: string | null
          page_count?: number | null
          price_eur?: number | null
          published_at?: string | null
          qr_code?: string
          qr_reserved_at?: string | null
          retired_at?: string | null
          sample_pdf_url?: string | null
          slug?: string
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
        }
        Relationships: [
          {
            foreignKeyName: "books_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
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
