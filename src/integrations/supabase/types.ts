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
      access_requests: {
        Row: {
          confirmed_at: string | null
          consent_text_version: string
          edition_id: string
          email: string
          id: string
          lang: string
          news_optout: boolean
          requested_at: string
        }
        Insert: {
          confirmed_at?: string | null
          consent_text_version: string
          edition_id: string
          email: string
          id?: string
          lang: string
          news_optout?: boolean
          requested_at?: string
        }
        Update: {
          confirmed_at?: string | null
          consent_text_version?: string
          edition_id?: string
          email?: string
          id?: string
          lang?: string
          news_optout?: boolean
          requested_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "book_editions"
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
      book_chapters: {
        Row: {
          book_id: string
          chapter_no: number
          title_he: string | null
        }
        Insert: {
          book_id: string
          chapter_no: number
          title_he?: string | null
        }
        Update: {
          book_id?: string
          chapter_no?: number
          title_he?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_chapters_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_editions: {
        Row: {
          amazon_url: string | null
          blurb: string | null
          book_id: string
          cover_path: string | null
          created_at: string
          excerpt_path: string | null
          glossary_path: string | null
          id: string
          lang: string
          learn_items: string[]
          level_note: string | null
          print_page_count: number | null
          published_at: string | null
          qr_downloaded_at: string | null
          status: string
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          amazon_url?: string | null
          blurb?: string | null
          book_id: string
          cover_path?: string | null
          created_at?: string
          excerpt_path?: string | null
          glossary_path?: string | null
          id?: string
          lang: string
          learn_items?: string[]
          level_note?: string | null
          print_page_count?: number | null
          published_at?: string | null
          qr_downloaded_at?: string | null
          status?: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          amazon_url?: string | null
          blurb?: string | null
          book_id?: string
          cover_path?: string | null
          created_at?: string
          excerpt_path?: string | null
          glossary_path?: string | null
          id?: string
          lang?: string
          learn_items?: string[]
          level_note?: string | null
          print_page_count?: number | null
          published_at?: string | null
          qr_downloaded_at?: string | null
          status?: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_editions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_pages: {
        Row: {
          audio_path: string | null
          book_id: string
          chapter_no: number
          created_at: string
          id: string
          is_published: boolean
          page_no: number
          updated_at: string
        }
        Insert: {
          audio_path?: string | null
          book_id: string
          chapter_no: number
          created_at?: string
          id?: string
          is_published?: boolean
          page_no: number
          updated_at?: string
        }
        Update: {
          audio_path?: string | null
          book_id?: string
          chapter_no?: number
          created_at?: string
          id?: string
          is_published?: boolean
          page_no?: number
          updated_at?: string
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
          chapters_count: number | null
          collection_id: string | null
          created_at: string
          id: string
          slug: string
          slug_locked_at: string | null
          title_he: string | null
          tome_no: number | null
          updated_at: string
          vocab_count: number | null
        }
        Insert: {
          chapters_count?: number | null
          collection_id?: string | null
          created_at?: string
          id?: string
          slug: string
          slug_locked_at?: string | null
          title_he?: string | null
          tome_no?: number | null
          updated_at?: string
          vocab_count?: number | null
        }
        Update: {
          chapters_count?: number | null
          collection_id?: string | null
          created_at?: string
          id?: string
          slug?: string
          slug_locked_at?: string | null
          title_he?: string | null
          tome_no?: number | null
          updated_at?: string
          vocab_count?: number | null
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
      collection_blocks: {
        Row: {
          body: string | null
          collection_id: string
          id: string
          image_path: string | null
          is_visible: boolean
          kind: string
          lang: string
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          collection_id: string
          id?: string
          image_path?: string | null
          is_visible?: boolean
          kind: string
          lang: string
          sort_order: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          collection_id?: string
          id?: string
          image_path?: string | null
          is_visible?: boolean
          kind?: string
          lang?: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_blocks_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_texts: {
        Row: {
          collection_id: string
          description: string | null
          for_whom: string | null
          lang: string
          name: string | null
          tagline: string | null
          updated_at: string
        }
        Insert: {
          collection_id: string
          description?: string | null
          for_whom?: string | null
          lang: string
          name?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          collection_id?: string
          description?: string | null
          for_whom?: string | null
          lang?: string
          name?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_texts_collection_id_fkey"
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
          id: string
          is_visible: boolean
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color_hex?: string
          created_at?: string
          id?: string
          is_visible?: boolean
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color_hex?: string
          created_at?: string
          id?: string
          is_visible?: boolean
          slug?: string
          sort_order?: number
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
      edition_access: {
        Row: {
          edition_id: string
          first_opened_at: string
          last_seen_at: string
          user_id: string
        }
        Insert: {
          edition_id: string
          first_opened_at?: string
          last_seen_at?: string
          user_id: string
        }
        Update: {
          edition_id?: string
          first_opened_at?: string
          last_seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edition_access_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "book_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      edition_chapter_titles: {
        Row: {
          chapter_no: number
          edition_id: string
          title: string | null
        }
        Insert: {
          chapter_no: number
          edition_id: string
          title?: string | null
        }
        Update: {
          chapter_no?: number
          edition_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edition_chapter_titles_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "book_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          edition_id: string | null
          id: string
          type: string
        }
        Insert: {
          created_at?: string
          edition_id?: string | null
          id?: string
          type: string
        }
        Update: {
          created_at?: string
          edition_id?: string | null
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "book_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_waitlist: {
        Row: {
          consent_text_version: string
          created_at: string
          edition_id: string
          email: string
          id: string
          lang: string
          news_optout: boolean
          notified_at: string | null
        }
        Insert: {
          consent_text_version: string
          created_at?: string
          edition_id: string
          email: string
          id?: string
          lang: string
          news_optout?: boolean
          notified_at?: string | null
        }
        Update: {
          consent_text_version?: string
          created_at?: string
          edition_id?: string
          email?: string
          id?: string
          lang?: string
          news_optout?: boolean
          notified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "launch_waitlist_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "book_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      method_steps: {
        Row: {
          image_path: string | null
          lang: string
          step_no: number
          tab_label: string
          updated_at: string
        }
        Insert: {
          image_path?: string | null
          lang: string
          step_no: number
          tab_label: string
          updated_at?: string
        }
        Update: {
          image_path?: string | null
          lang?: string
          step_no?: number
          tab_label?: string
          updated_at?: string
        }
        Relationships: []
      }
      page_paragraphs: {
        Row: {
          he_nikud: string | null
          he_plain: string | null
          id: string
          kind: string
          page_id: string
          sort_order: number
        }
        Insert: {
          he_nikud?: string | null
          he_plain?: string | null
          id?: string
          kind?: string
          page_id: string
          sort_order: number
        }
        Update: {
          he_nikud?: string | null
          he_plain?: string | null
          id?: string
          kind?: string
          page_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "page_paragraphs_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "book_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_answers: {
        Row: {
          answered_at: string
          chosen_index: number
          id: string
          is_correct: boolean
          question_id: string
          user_id: string
        }
        Insert: {
          answered_at?: string
          chosen_index: number
          id?: string
          is_correct: boolean
          question_id: string
          user_id: string
        }
        Update: {
          answered_at?: string
          chosen_index?: number
          id?: string
          is_correct?: boolean
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          answer_index: number
          chapter_no: number
          edition_id: string
          explanation: string | null
          hebrew: string | null
          id: string
          kind: string
          options: Json
          page_no: number | null
          question: string
          sort_order: number
        }
        Insert: {
          answer_index: number
          chapter_no: number
          edition_id: string
          explanation?: string | null
          hebrew?: string | null
          id?: string
          kind: string
          options: Json
          page_no?: number | null
          question: string
          sort_order: number
        }
        Update: {
          answer_index?: number
          chapter_no?: number
          edition_id?: string
          explanation?: string | null
          hebrew?: string | null
          id?: string
          kind?: string
          options?: Json
          page_no?: number | null
          question?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "book_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      reader_progress: {
        Row: {
          edition_id: string
          quiz_answered: number
          quiz_correct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          edition_id: string
          quiz_answered?: number
          quiz_correct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          edition_id?: string
          quiz_answered?: number
          quiz_correct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reader_progress_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "book_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      readers: {
        Row: {
          consent_at: string | null
          consent_text_version: string | null
          created_at: string
          email: string
          lang: string
          last_seen_at: string
          news_changed_at: string | null
          news_status: string
          origin_edition_id: string | null
          unsubscribe_token: string
          user_id: string
        }
        Insert: {
          consent_at?: string | null
          consent_text_version?: string | null
          created_at?: string
          email: string
          lang: string
          last_seen_at?: string
          news_changed_at?: string | null
          news_status: string
          origin_edition_id?: string | null
          unsubscribe_token: string
          user_id: string
        }
        Update: {
          consent_at?: string | null
          consent_text_version?: string | null
          created_at?: string
          email?: string
          lang?: string
          last_seen_at?: string
          news_changed_at?: string | null
          news_status?: string
          origin_edition_id?: string | null
          unsubscribe_token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "readers_origin_edition_id_fkey"
            columns: ["origin_edition_id"]
            isOneToOne: false
            referencedRelation: "book_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      site_blocks: {
        Row: {
          body: string | null
          id: string
          image_path: string | null
          is_visible: boolean
          items: Json
          kind: string
          lang: string
          page_key: string
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          id?: string
          image_path?: string | null
          is_visible?: boolean
          items?: Json
          kind: string
          lang: string
          page_key: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          id?: string
          image_path?: string | null
          is_visible?: boolean
          items?: Json
          kind?: string
          lang?: string
          page_key?: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: []
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
      book_visible: { Args: { _book_id: string }; Returns: boolean }
      collection_visible: { Args: { _collection_id: string }; Returns: boolean }
      edition_visible: { Args: { _edition_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lecteur_a_acces_edition: {
        Args: { _edition_id: string }
        Returns: boolean
      }
      lecteur_a_acces_livre: { Args: { _book_id: string }; Returns: boolean }
      menage_quotidien: { Args: never; Returns: undefined }
      remplacer_quiz_edition: {
        Args: { p_edition_id: string; p_rows: Json }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
    },
  },
} as const
