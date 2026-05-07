export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Tables: {
      subjects: {
        Row: {
          code: string
          name: string
        }
        Insert: {
          code: string
          name: string
        }
        Update: {
          code?: string
          name?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          id: number
          subject_code: string
          year: number
          question_number: number
          points: number
          question_text: string
          options: Json
          correct_answer: string
          explanation: string | null
          created_at: string
        }
        Insert: {
          id?: number
          subject_code: string
          year: number
          question_number: number
          points?: number
          question_text: string
          options: Json
          correct_answer: string
          explanation?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          subject_code?: string
          year?: number
          question_number?: number
          points?: number
          question_text?: string
          options?: Json
          correct_answer?: string
          explanation?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'questions_subject_code_fkey'
            columns: ['subject_code']
            referencedRelation: 'subjects'
            referencedColumns: ['code']
          }
        ]
      }
      tags: {
        Row: {
          id: number
          subject_code: string | null
          name: string
        }
        Insert: {
          id?: number
          subject_code?: string | null
          name: string
        }
        Update: {
          id?: number
          subject_code?: string | null
          name?: string
        }
        Relationships: []
      }
      question_tags: {
        Row: {
          question_id: number
          tag_id: number
        }
        Insert: {
          question_id: number
          tag_id: number
        }
        Update: {
          question_id?: number
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'question_tags_question_id_fkey'
            columns: ['question_id']
            referencedRelation: 'questions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'question_tags_tag_id_fkey'
            columns: ['tag_id']
            referencedRelation: 'tags'
            referencedColumns: ['id']
          }
        ]
      }
      question_images: {
        Row: {
          id: number
          question_id: number
          storage_path: string
          display_order: number
          uploaded_at: string
        }
        Insert: {
          id?: number
          question_id: number
          storage_path: string
          display_order?: number
          uploaded_at?: string
        }
        Update: {
          id?: number
          question_id?: number
          storage_path?: string
          display_order?: number
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'question_images_question_id_fkey'
            columns: ['question_id']
            referencedRelation: 'questions'
            referencedColumns: ['id']
          }
        ]
      }
      user_logs: {
        Row: {
          id: number
          user_id: string
          session_id: string
          question_id: number
          is_correct: boolean
          confidence_flag: 'confident' | 'guess' | null
          answered_at: string
        }
        Insert: {
          id?: number
          user_id: string
          session_id: string
          question_id: number
          is_correct: boolean
          confidence_flag?: 'confident' | 'guess' | null
          answered_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          session_id?: string
          question_id?: number
          is_correct?: boolean
          confidence_flag?: 'confident' | 'guess' | null
          answered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_logs_question_id_fkey'
            columns: ['question_id']
            referencedRelation: 'questions'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
