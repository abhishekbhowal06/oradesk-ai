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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_calls: {
        Row: {
          ai_reasoning: string | null
          appointment_id: string | null
          call_ended_at: string | null
          call_started_at: string | null
          call_type: string
          clinic_id: string
          confidence_score: number | null
          created_at: string
          duration_seconds: number | null
          escalation_reason: string | null
          escalation_required: boolean
          external_call_id: string | null
          id: string
          model_version: string | null
          outcome: Database["public"]["Enums"]["call_outcome"] | null
          patient_id: string
          phone_number: string
          processing_time_ms: number | null
          recording_url: string | null
          revenue_impact: number | null
          status: Database["public"]["Enums"]["call_status"]
          transcript: Json | null
          updated_at: string
        }
        Insert: {
          ai_reasoning?: string | null
          appointment_id?: string | null
          call_ended_at?: string | null
          call_started_at?: string | null
          call_type?: string
          clinic_id: string
          confidence_score?: number | null
          created_at?: string
          duration_seconds?: number | null
          escalation_reason?: string | null
          escalation_required?: boolean
          external_call_id?: string | null
          id?: string
          model_version?: string | null
          outcome?: Database["public"]["Enums"]["call_outcome"] | null
          patient_id: string
          phone_number: string
          processing_time_ms?: number | null
          recording_url?: string | null
          revenue_impact?: number | null
          status?: Database["public"]["Enums"]["call_status"]
          transcript?: Json | null
          updated_at?: string
        }
        Update: {
          ai_reasoning?: string | null
          appointment_id?: string | null
          call_ended_at?: string | null
          call_started_at?: string | null
          call_type?: string
          clinic_id?: string
          confidence_score?: number | null
          created_at?: string
          duration_seconds?: number | null
          escalation_reason?: string | null
          escalation_required?: boolean
          external_call_id?: string | null
          id?: string
          model_version?: string | null
          outcome?: Database["public"]["Enums"]["call_outcome"] | null
          patient_id?: string
          phone_number?: string
          processing_time_ms?: number | null
          recording_url?: string | null
          revenue_impact?: number | null
          status?: Database["public"]["Enums"]["call_status"]
          transcript?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_calls_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_calls_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_calls_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          ai_call_id: string | null
          appointment_id: string | null
          clinic_id: string | null
          created_at: string
          event_data: Json | null
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          patient_id: string | null
          revenue_impact: number | null
          user_id: string | null
        }
        Insert: {
          ai_call_id?: string | null
          appointment_id?: string | null
          clinic_id?: string | null
          created_at?: string
          event_data?: Json | null
          event_type: Database["public"]["Enums"]["event_type"]
          id?: string
          patient_id?: string | null
          revenue_impact?: number | null
          user_id?: string | null
        }
        Update: {
          ai_call_id?: string | null
          appointment_id?: string | null
          clinic_id?: string | null
          created_at?: string
          event_data?: Json | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          patient_id?: string | null
          revenue_impact?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_ai_call_id_fkey"
            columns: ["ai_call_id"]
            isOneToOne: false
            referencedRelation: "ai_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          ai_managed: boolean
          clinic_id: string
          confirmed_at: string | null
          conflict_warning: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number
          id: string
          notes: string | null
          patient_id: string
          procedure_name: string
          rescheduled_from: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ai_managed?: boolean
          clinic_id: string
          confirmed_at?: string | null
          conflict_warning?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          patient_id: string
          procedure_name: string
          rescheduled_from?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ai_managed?: boolean
          clinic_id?: string
          confirmed_at?: string | null
          conflict_warning?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          patient_id?: string
          procedure_name?: string
          rescheduled_from?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          ai_settings: Json
          created_at: string
          email: string | null
          id: string
          name: string
          notification_settings: Json
          onboarding_completed: boolean
          phone: string | null
          timezone: string
          twilio_phone_number: string | null
          updated_at: string
          working_hours: Json
        }
        Insert: {
          address?: string | null
          ai_settings?: Json
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notification_settings?: Json
          onboarding_completed?: boolean
          phone?: string | null
          timezone?: string
          twilio_phone_number?: string | null
          updated_at?: string
          working_hours?: Json
        }
        Update: {
          address?: string | null
          ai_settings?: Json
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notification_settings?: Json
          onboarding_completed?: boolean
          phone?: string | null
          timezone?: string
          twilio_phone_number?: string | null
          updated_at?: string
          working_hours?: Json
        }
        Relationships: []
      }
      follow_up_schedules: {
        Row: {
          appointment_id: string
          attempt_number: number
          clinic_id: string
          completed_at: string | null
          created_at: string
          delay_hours: number
          failure_reason: string | null
          id: string
          last_attempt_at: string | null
          max_attempts: number
          next_attempt_at: string | null
          patient_id: string
          related_call_id: string | null
          scheduled_for: string
          status: Database["public"]["Enums"]["followup_status"]
          updated_at: string
        }
        Insert: {
          appointment_id: string
          attempt_number?: number
          clinic_id: string
          completed_at?: string | null
          created_at?: string
          delay_hours?: number
          failure_reason?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number
          next_attempt_at?: string | null
          patient_id: string
          related_call_id?: string | null
          scheduled_for: string
          status?: Database["public"]["Enums"]["followup_status"]
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          attempt_number?: number
          clinic_id?: string
          completed_at?: string | null
          created_at?: string
          delay_hours?: number
          failure_reason?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number
          next_attempt_at?: string | null
          patient_id?: string
          related_call_id?: string | null
          scheduled_for?: string
          status?: Database["public"]["Enums"]["followup_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_schedules_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_schedules_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_schedules_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_schedules_related_call_id_fkey"
            columns: ["related_call_id"]
            isOneToOne: false
            referencedRelation: "ai_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          clinic_id: string
          created_at: string
          date_of_birth: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          last_visit: string | null
          notes: string | null
          phone: string
          status: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          last_visit?: string | null
          notes?: string | null
          phone: string
          status?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          last_visit?: string | null
          notes?: string | null
          phone?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      staff_memberships: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          invited_by: string | null
          is_active: boolean
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_memberships_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_tasks: {
        Row: {
          ai_call_id: string | null
          ai_generated: boolean
          appointment_id: string | null
          assigned_to: string | null
          clinic_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          patient_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          ai_call_id?: string | null
          ai_generated?: boolean
          appointment_id?: string | null
          assigned_to?: string | null
          clinic_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          patient_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          ai_call_id?: string | null
          ai_generated?: boolean
          appointment_id?: string | null
          assigned_to?: string | null
          clinic_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          patient_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_tasks_ai_call_id_fkey"
            columns: ["ai_call_id"]
            isOneToOne: false
            referencedRelation: "ai_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_tasks_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_tasks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_clinic_with_admin: {
        Args: { clinic_name: string }
        Returns: string
      }
      get_user_clinic_ids: { Args: never; Returns: string[] }
      is_authenticated: { Args: never; Returns: boolean }
      is_clinic_admin: { Args: { clinic_id_param: string }; Returns: boolean }
      is_clinic_member: { Args: { clinic_id_param: string }; Returns: boolean }
    }
    Enums: {
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "rescheduled"
        | "completed"
        | "missed"
        | "cancelled"
      call_outcome:
        | "confirmed"
        | "rescheduled"
        | "cancelled"
        | "action_needed"
        | "unreachable"
      call_status:
        | "queued"
        | "calling"
        | "answered"
        | "voicemail"
        | "no_answer"
        | "failed"
        | "completed"
      event_type:
        | "call_initiated"
        | "call_completed"
        | "appointment_confirmed"
        | "appointment_rescheduled"
        | "appointment_cancelled"
        | "appointment_missed"
        | "escalation_created"
        | "task_created"
        | "task_completed"
        | "revenue_saved"
        | "patient_created"
        | "staff_action"
      followup_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "exhausted"
        | "cancelled"
      staff_role: "admin" | "receptionist"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "pending" | "in_progress" | "completed" | "cancelled"
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
      appointment_status: [
        "scheduled",
        "confirmed",
        "rescheduled",
        "completed",
        "missed",
        "cancelled",
      ],
      call_outcome: [
        "confirmed",
        "rescheduled",
        "cancelled",
        "action_needed",
        "unreachable",
      ],
      call_status: [
        "queued",
        "calling",
        "answered",
        "voicemail",
        "no_answer",
        "failed",
        "completed",
      ],
      event_type: [
        "call_initiated",
        "call_completed",
        "appointment_confirmed",
        "appointment_rescheduled",
        "appointment_cancelled",
        "appointment_missed",
        "escalation_created",
        "task_created",
        "task_completed",
        "revenue_saved",
        "patient_created",
        "staff_action",
      ],
      followup_status: [
        "pending",
        "in_progress",
        "completed",
        "exhausted",
        "cancelled",
      ],
      staff_role: ["admin", "receptionist"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["pending", "in_progress", "completed", "cancelled"],
    },
  },
} as const
