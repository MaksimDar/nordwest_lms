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
      courses: {
        Row: {
          avatar_url: string | null
          code: string
          created_at: string
          description: string
          id: string
          lecturer_id: string
          name: string
          semester: string
        }
        Insert: {
          avatar_url?: string | null
          code: string
          created_at?: string
          description?: string
          id?: string
          lecturer_id: string
          name: string
          semester?: string
        }
        Update: {
          avatar_url?: string | null
          code?: string
          created_at?: string
          description?: string
          id?: string
          lecturer_id?: string
          name?: string
          semester?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          attempts: number
          course_id: string
          coursework_passed: boolean
          created_at: string
          id: string
          semester_level: number
          student_id: string
        }
        Insert: {
          attempts?: number
          course_id: string
          coursework_passed?: boolean
          created_at?: string
          id?: string
          semester_level?: number
          student_id: string
        }
        Update: {
          attempts?: number
          course_id?: string
          coursework_passed?: boolean
          created_at?: string
          id?: string
          semester_level?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_answers: {
        Row: {
          attempt_id: string
          auto_marked: boolean
          awarded_marks: number | null
          id: string
          question_id: string
          response: string
        }
        Insert: {
          attempt_id: string
          auto_marked?: boolean
          awarded_marks?: number | null
          id?: string
          question_id: string
          response?: string
        }
        Update: {
          attempt_id?: string
          auto_marked?: boolean
          awarded_marks?: number | null
          id?: string
          question_id?: string
          response?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "exam_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          exam_id: string
          feedback: string
          graded: boolean
          id: string
          max_score: number | null
          score: number | null
          student_id: string
          submitted_at: string | null
        }
        Insert: {
          exam_id: string
          feedback?: string
          graded?: boolean
          id?: string
          max_score?: number | null
          score?: number | null
          student_id: string
          submitted_at?: string | null
        }
        Update: {
          exam_id?: string
          feedback?: string
          graded?: boolean
          id?: string
          max_score?: number | null
          score?: number | null
          student_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          correct_answer: string | null
          exam_id: string
          id: string
          kind: string
          marks: number
          options: Json
          position: number
          prompt: string
        }
        Insert: {
          correct_answer?: string | null
          exam_id: string
          id?: string
          kind?: string
          marks?: number
          options?: Json
          position?: number
          prompt: string
        }
        Update: {
          correct_answer?: string | null
          exam_id?: string
          id?: string
          kind?: string
          marks?: number
          options?: Json
          position?: number
          prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          course_id: string
          created_at: string
          id: string
          results_published: boolean
          scheduled_at: string | null
          status: string
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          results_published?: boolean
          scheduled_at?: string | null
          status?: string
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          results_published?: boolean
          scheduled_at?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          course_id: string
          created_at: string
          file_path: string | null
          id: string
          kind: string
          lecture_date: string | null
          notes: string
          title: string
          url: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          file_path?: string | null
          id?: string
          kind?: string
          lecture_date?: string | null
          notes?: string
          title: string
          url?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          file_path?: string | null
          id?: string
          kind?: string
          lecture_date?: string | null
          notes?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read: boolean
          recipient_id: string
          sender_id: string | null
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id: string
          sender_id?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string
          sender_id?: string | null
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          semester_level: number | null
          student_number: string | null
          study_course: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          semester_level?: number | null
          student_number?: string | null
          study_course?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          semester_level?: number | null
          student_number?: string | null
          study_course?: string | null
        }
        Relationships: []
      }
      task_assignments: {
        Row: {
          id: string
          status: string
          student_id: string
          submitted_at: string | null
          task_id: string
        }
        Insert: {
          id?: string
          status?: string
          student_id: string
          submitted_at?: string | null
          task_id: string
        }
        Update: {
          id?: string
          status?: string
          student_id?: string
          submitted_at?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          course_id: string
          created_at: string
          description: string
          due_date: string | null
          id: string
          kind: string
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          kind?: string
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          kind?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_events: {
        Row: {
          course_id: string | null
          created_at: string
          ends_at: string | null
          id: string
          kind: string
          lecturer_id: string
          meeting_url: string | null
          starts_at: string
          title: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          kind?: string
          lecturer_id: string
          meeting_url?: string | null
          starts_at: string
          title: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          kind?: string
          lecturer_id?: string
          meeting_url?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      app_role: "lecturer" | "student" | "admin"
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
      app_role: ["lecturer", "student", "admin"],
    },
  },
} as const
