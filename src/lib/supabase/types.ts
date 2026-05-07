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
      }
      user_logs: {
        Row: {
          id: number
          user_id: string
          session_id: string
          question_id: number
          is_correct: boolean
          confidence_flag: string | null
          answered_at: string
        }
        Insert: {
          id?: number
          user_id: string
          session_id: string
          question_id: number
          is_correct: boolean
          confidence_flag?: string | null
          answered_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          session_id?: string
          question_id?: number
          is_correct?: boolean
          confidence_flag?: string | null
          answered_at?: string
        }
      }
    }
  }
}
