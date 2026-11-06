import type { AccessType, TrailerProvider, VerificationStatus } from "./viewing";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/**
 * Types for the Stage 4–7 schema in supabase/migrations. Hand-written to match
 * the SQL; regenerate with `supabase gen types typescript` once the CLI is set up.
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          username: string | null;
          avatar_url: string | null;
          role: "viewer" | "filmmaker" | "company" | "admin";
          suspended_at: string | null;
          suspension_reason: string | null;
          preferred_languages: string[];
          favourite_genres: string[];
          include_watched: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: { id: string; display_name: string };
        Update: {
          display_name?: string;
          username?: string | null;
          avatar_url?: string | null;
          preferred_languages?: string[];
          favourite_genres?: string[];
          include_watched?: boolean;
        };
        Relationships: [];
      };
      watchlist: {
        Row: { id: string; user_id: string; film_id: string; added_at: string };
        Insert: { film_id: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      watched_films: {
        Row: { id: string; user_id: string; film_id: string; watched_at: string };
        Insert: { film_id: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          user_id: string;
          film_id: string;
          rating: number;
          body: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { film_id: string; rating: number; body: string | null };
        Update: { rating?: number; body?: string | null };
        Relationships: [];
      };
      industry_applications: {
        Row: { id: string; user_id: string; account_type: "filmmaker" | "company"; professional_name: string; professional_role: string; company_name: string | null; biography: string; country: string | null; city: string | null; portfolio_links: string[]; status: string; reviewer_feedback: string | null; submitted_at: string | null; reviewed_at: string | null; reviewed_by: string | null; created_at: string; updated_at: string };
        Insert: { account_type?: "filmmaker" | "company"; company_name?: string | null; biography?: string; country?: string | null; city?: string | null; portfolio_links?: string[]; status?: string; professional_name: string; professional_role: string };
        Update: { account_type?: "filmmaker" | "company"; professional_name?: string; professional_role?: string; company_name?: string | null; biography?: string; country?: string | null; city?: string | null; portfolio_links?: string[]; status?: string };
        Relationships: [];
      };
      filmmaker_profiles: {
        Row: { id: string; user_id: string; slug: string; professional_name: string; professional_role: string; expertise: string[]; biography: string; avatar_url: string | null; city: string | null; country: string | null; languages: string[]; website_url: string | null; portfolio_links: string[]; social_links: string[]; filmography: Json; visibility: string; verification_status: string; verification_feedback: string | null; verified_at: string | null; created_at: string; updated_at: string };
        Insert: { slug: string; professional_name: string; professional_role: string; expertise?: string[]; biography?: string; avatar_url?: string | null; city?: string | null; country?: string | null; languages?: string[]; website_url?: string | null; portfolio_links?: string[]; social_links?: string[]; filmography?: Json; visibility?: string; verification_status?: string };
        Update: { slug?: string; professional_name?: string; professional_role?: string; expertise?: string[]; biography?: string; avatar_url?: string | null; city?: string | null; country?: string | null; languages?: string[]; website_url?: string | null; portfolio_links?: string[]; social_links?: string[]; filmography?: Json; visibility?: string; verification_status?: string };
        Relationships: [];
      };
      production_companies: {
        Row: { id: string; owner_id: string; slug: string; name: string; logo_url: string | null; description: string; country: string | null; city: string | null; website_url: string | null; public_email: string | null; public_phone: string | null; social_links: string[]; visibility: string; review_status: string; reviewer_feedback: string | null; verification_status: string; submitted_at: string | null; reviewed_at: string | null; reviewed_by: string | null; created_at: string; updated_at: string };
        Insert: { slug: string; name: string; logo_url?: string | null; description?: string; country?: string | null; city?: string | null; website_url?: string | null; public_email?: string | null; public_phone?: string | null; social_links?: string[]; visibility?: string; review_status?: string };
        Update: { name?: string; logo_url?: string | null; description?: string; country?: string | null; city?: string | null; website_url?: string | null; public_email?: string | null; public_phone?: string | null; social_links?: string[]; visibility?: string; review_status?: string; verification_status?: string };
        Relationships: [];
      };
      company_members: {
        Row: { id: string; company_id: string; user_id: string; member_role: "owner" | "manager" | "member"; status: "invited" | "active"; invited_by: string | null; created_at: string; updated_at: string };
        Insert: { company_id: string; user_id: string };
        Update: { member_role?: "manager" | "member"; status?: "active" };
        Relationships: [];
      };
      published_films: {
        Row: { id: string; slug: string; submission_id: string | null; title: string; original_title: string | null; synopsis: string; release_year: number; runtime_minutes: number; genres: string[]; language: string; country: string; director: string; producers: string[]; cast_names: string[]; trailer_url: string | null; poster_url: string | null; website_url: string | null; company_id: string | null; is_active: boolean; published_at: string; updated_at: string };
        Insert: { id: string };
        Update: { is_active?: boolean };
        Relationships: [];
      };
      film_submissions: {
        Row: { id: string; submitter_id: string; company_id: string | null; title: string; original_title: string | null; synopsis: string; release_year: number | null; runtime_minutes: number | null; genres: string[]; language: string | null; country: string | null; director: string | null; producers: string[]; cast_names: string[]; trailer_url: string | null; poster_url: string | null; website_url: string | null; viewing_links: Json; rights_confirmed: boolean; rights_statement: string | null; notes_for_admins: string | null; status: string; reviewer_feedback: string | null; submitted_at: string | null; reviewed_at: string | null; reviewed_by: string | null; published_film_id: string | null; created_at: string; updated_at: string };
        Insert: { title: string; company_id?: string | null; original_title?: string | null; synopsis?: string; release_year?: number | null; runtime_minutes?: number | null; genres?: string[]; language?: string | null; country?: string | null; director?: string | null; producers?: string[]; cast_names?: string[]; trailer_url?: string | null; poster_url?: string | null; website_url?: string | null; viewing_links?: Json; rights_confirmed?: boolean; rights_statement?: string | null; notes_for_admins?: string | null; status?: string };
        Update: { company_id?: string | null; title?: string; original_title?: string | null; synopsis?: string; release_year?: number | null; runtime_minutes?: number | null; genres?: string[]; language?: string | null; country?: string | null; director?: string | null; producers?: string[]; cast_names?: string[]; trailer_url?: string | null; poster_url?: string | null; website_url?: string | null; viewing_links?: Json; rights_confirmed?: boolean; rights_statement?: string | null; notes_for_admins?: string | null; status?: string };
        Relationships: [];
      };
      submission_events: {
        Row: { id: string; submission_id: string; actor_id: string | null; from_status: string | null; to_status: string; note: string | null; created_at: string };
        Insert: { submission_id: string; to_status: string };
        Update: { note?: string | null };
        Relationships: [];
      };
      promotion_requests: {
        Row: { id: string; requester_id: string; film_id: string; placement: string; genre: string | null; starts_on: string; ends_on: string; placement_kind: string; message: string | null; status: string; reviewer_feedback: string | null; reviewed_at: string | null; reviewed_by: string | null; created_at: string; updated_at: string };
        Insert: { film_id: string; placement: string; genre?: string | null; starts_on: string; ends_on: string; message?: string | null };
        Update: { status?: "cancelled" };
        Relationships: [];
      };
      moderation_notes: {
        Row: { id: string; subject_type: string; subject_id: string; author_id: string | null; note: string; created_at: string };
        Insert: { subject_type: string; subject_id: string; note: string };
        Update: { note?: string };
        Relationships: [];
      };
      notifications: {
        Row: { id: string; user_id: string; kind: string; title: string; body: string | null; link: string | null; read_at: string | null; email_status: string; created_at: string };
        Insert: { user_id: string; kind: string; title: string };
        Update: { read_at?: string | null };
        Relationships: [];
      };
      recommendation_feedback: {
        Row: { id: string; user_id: string; film_id: string; kind: "dismissed" | "not_interested"; created_at: string; updated_at: string };
        Insert: { film_id: string; kind: "dismissed" | "not_interested" };
        Update: { kind?: "dismissed" | "not_interested" };
        Relationships: [];
      };
      viewing_providers: {
        Row: {
          id: string;
          name: string;
          slug: string;
          website_url: string;
          logo_url: string | null;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          slug: string;
          website_url: string;
          logo_url?: string | null;
          description?: string | null;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          slug?: string;
          website_url?: string;
          logo_url?: string | null;
          description?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      film_viewing_options: {
        Row: {
          id: string;
          film_id: string;
          provider_id: string;
          destination_url: string;
          access_type: AccessType;
          countries: string[];
          audio_languages: string[];
          subtitle_languages: string[];
          availability_notes: string | null;
          verification_status: VerificationStatus;
          verified_at: string | null;
          last_checked_at: string | null;
          created_by: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          film_id: string;
          provider_id: string;
          destination_url: string;
          access_type: AccessType;
          countries: string[];
          audio_languages?: string[];
          subtitle_languages?: string[];
          availability_notes?: string | null;
          is_active?: boolean;
        };
        Update: {
          provider_id?: string;
          destination_url?: string;
          access_type?: AccessType;
          countries?: string[];
          audio_languages?: string[];
          subtitle_languages?: string[];
          availability_notes?: string | null;
          verification_status?: VerificationStatus;
          is_active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "film_viewing_options_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "viewing_providers";
            referencedColumns: ["id"];
          },
        ];
      };
      film_trailers: {
        Row: {
          id: string;
          film_id: string;
          title: string;
          video_provider: TrailerProvider;
          video_id: string;
          video_url: string;
          embeddable: boolean;
          thumbnail_url: string | null;
          published_on: string | null;
          verification_status: VerificationStatus;
          verified_at: string | null;
          last_checked_at: string | null;
          created_by: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          film_id: string;
          title: string;
          video_provider: TrailerProvider;
          video_id: string;
          video_url: string;
          embeddable?: boolean;
          thumbnail_url?: string | null;
          published_on?: string | null;
          is_active?: boolean;
        };
        Update: {
          title?: string;
          embeddable?: boolean;
          thumbnail_url?: string | null;
          published_on?: string | null;
          verification_status?: VerificationStatus;
          is_active?: boolean;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      get_public_filmmakers: {
        Args: { p_role?: string | null; p_country?: string | null; p_city?: string | null; p_language?: string | null; p_company_slug?: string | null; p_slug?: string | null };
        Returns: {
          slug: string; professional_name: string; professional_role: string; expertise: string[]; biography: string; avatar_url: string | null;
          city: string | null; country: string | null; languages: string[]; website_url: string | null; portfolio_links: string[];
          social_links: string[]; filmography: Json; verified: boolean;
        }[];
      };
      get_public_companies: {
        Args: { p_country?: string | null; p_city?: string | null; p_slug?: string | null };
        Returns: {
          id: string; slug: string; name: string; logo_url: string | null; description: string; country: string | null; city: string | null;
          website_url: string | null; public_email: string | null; public_phone: string | null; social_links: string[]; verified: boolean;
        }[];
      };
      get_public_company_members: { Args: { p_company_slug: string }; Returns: { slug: string; professional_name: string; professional_role: string; member_role: string }[] };
      get_public_filmmaker_companies: { Args: { p_filmmaker_slug: string }; Returns: { slug: string; name: string }[] };
      get_company_roster: {
        Args: { p_company_id: string };
        Returns: { member_id: string; is_self: boolean; member_role: string; status: string; display_name: string; profile_slug: string | null; profile_name: string | null }[];
      };
      get_public_company_for_film: { Args: { p_film_id: string }; Returns: { slug: string; name: string }[] };
      get_active_promotions: { Args: Record<string, never>; Returns: { film_id: string; placement: string; genre: string | null; starts_on: string; ends_on: string }[] };
      invite_company_member: { Args: { p_company_id: string; p_filmmaker_slug: string; p_member_role?: string }; Returns: string };
      moderate_application: { Args: { p_id: string; p_decision: string; p_feedback?: string | null }; Returns: undefined };
      moderate_profile_verification: { Args: { p_profile_id: string; p_decision: string; p_feedback?: string | null }; Returns: undefined };
      moderate_company: { Args: { p_id: string; p_decision: string; p_feedback?: string | null }; Returns: undefined };
      moderate_submission: { Args: { p_id: string; p_decision: string; p_feedback?: string | null; p_slug?: string | null }; Returns: string | null };
      set_published_film_active: { Args: { p_film_id: string; p_active: boolean }; Returns: undefined };
      moderate_promotion: { Args: { p_id: string; p_decision: string; p_feedback?: string | null }; Returns: undefined };
      set_account_suspension: { Args: { p_user_id: string; p_suspend: boolean; p_reason?: string | null }; Returns: undefined };
      admin_list_industry_accounts: {
        Args: Record<string, never>;
        Returns: { user_id: string; display_name: string; role: string; suspended_at: string | null; suspension_reason: string | null; profile_slug: string | null }[];
      };
      is_industry_member: { Args: Record<string, never>; Returns: boolean };
      get_popular_films: { Args: { p_limit?: number }; Returns: { film_id: string; member_count: number }[] };
      get_film_reviews: {
        Args: { p_film_id: string };
        Returns: {
          id: string;
          rating: number;
          body: string | null;
          created_at: string;
          updated_at: string;
          author_name: string;
          is_own: boolean;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
