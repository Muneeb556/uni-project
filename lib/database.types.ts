export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: { id: string; name: string; code: string; status: string; created_at: string };
        Insert: { id?: string; name: string; code: string; status?: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['departments']['Insert']>;
        Relationships: [],
      };
      courses: {
        Row: {
          id: string;
          department_id: string | null;
          title: string;
          code: string;
          credit_hours: number;
          classification: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          department_id?: string | null;
          title: string;
          code: string;
          credit_hours?: number;
          classification?: string;
          status?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['courses']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'courses_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'departments';
            referencedColumns: ['id'];
          },
        ],
      };
      semesters: {
        Row: {
          id: string;
          name: string;
          start_date: string;
          end_date: string;
          attendance_open: string;
          attendance_close: string;
          billing_open: string;
          billing_deadline: string;
          deadline_time: string;
          timezone: string;
          extension_date: string | null;
          extension_remarks: string | null;
          extension_authorized_by: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          start_date: string;
          end_date: string;
          attendance_open: string;
          attendance_close: string;
          billing_open: string;
          billing_deadline: string;
          deadline_time?: string;
          timezone?: string;
          extension_date?: string | null;
          extension_remarks?: string | null;
          extension_authorized_by?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['semesters']['Insert']>;
        Relationships: [],
      };
      faculty_profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          phone: string | null;
          cnic: string | null;
          designation: string | null;
          grade: string | null;
          qualification: string | null;
          department_id: string | null;
          bank_account_number: string | null;
          bank_name: string | null;
          university_branch: string | null;
          application_status: string;
          status: string;
          remarks: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          full_name: string;
          phone?: string | null;
          cnic?: string | null;
          designation?: string | null;
          grade?: string | null;
          qualification?: string | null;
          department_id?: string | null;
          bank_account_number?: string | null;
          bank_name?: string | null;
          university_branch?: string | null;
          application_status?: string;
          status?: string;
          remarks?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['faculty_profiles']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'faculty_profiles_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'departments';
            referencedColumns: ['id'];
          },
        ],
      };
      user_roles: {
        Row: { user_id: string; role: string; department_id: string | null; created_at: string };
        Insert: { user_id: string; role: string; department_id?: string | null; created_at?: string };
        Update: Partial<Database['public']['Tables']['user_roles']['Insert']>;
        Relationships: [],
      };
      faculty_documents: {
        Row: {
          id: string;
          faculty_id: string;
          doc_type: string;
          file_name: string;
          storage_path: string;
          mime_type: string | null;
          file_size: number | null;
          status: string;
          remarks: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          faculty_id: string;
          doc_type: string;
          file_name: string;
          storage_path: string;
          mime_type?: string | null;
          file_size?: number | null;
          status?: string;
          remarks?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['faculty_documents']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'faculty_documents_faculty_id_fkey';
            columns: ['faculty_id'];
            isOneToOne: false;
            referencedRelation: 'faculty_profiles';
            referencedColumns: ['id'];
          },
        ],
      };
      document_reviews: {
        Row: {
          id: string;
          document_id: string;
          reviewer_id: string | null;
          action: string;
          remarks: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          reviewer_id?: string | null;
          action: string;
          remarks?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['document_reviews']['Insert']>;
        Relationships: [],
      };
      faculty_assignments: {
        Row: {
          id: string;
          faculty_id: string;
          department_id: string | null;
          semester_id: string;
          course_id: string;
          number_of_students: number;
          classification: string;
          teaching_days: string[];
          start_time: string | null;
          end_time: string | null;
          number_of_periods: number;
          compensation_method: string;
          theory_rate: number;
          practical_rate: number;
          conveyance: number;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          faculty_id: string;
          department_id?: string | null;
          semester_id: string;
          course_id: string;
          number_of_students?: number;
          classification?: string;
          teaching_days?: string[];
          start_time?: string | null;
          end_time?: string | null;
          number_of_periods?: number;
          compensation_method?: string;
          theory_rate?: number;
          practical_rate?: number;
          conveyance?: number;
          status?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['faculty_assignments']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'faculty_assignments_course_id_fkey';
            columns: ['course_id'];
            isOneToOne: false;
            referencedRelation: 'courses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'faculty_assignments_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'departments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'faculty_assignments_faculty_id_fkey';
            columns: ['faculty_id'];
            isOneToOne: false;
            referencedRelation: 'faculty_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'faculty_assignments_semester_id_fkey';
            columns: ['semester_id'];
            isOneToOne: false;
            referencedRelation: 'semesters';
            referencedColumns: ['id'];
          },
        ],
      };
      schedules: {
        Row: {
          id: string;
          assignment_id: string;
          day_of_week: number;
          start_date: string;
          end_date: string;
          start_time: string;
          end_time: string;
          classroom: string | null;
          number_of_periods: number;
          status: string;
          changed_by: string | null;
          change_reason: string | null;
          effective_from: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          day_of_week: number;
          start_date: string;
          end_date: string;
          start_time: string;
          end_time: string;
          classroom?: string | null;
          number_of_periods?: number;
          status?: string;
          changed_by?: string | null;
          change_reason?: string | null;
          effective_from?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['schedules']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'schedules_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'faculty_assignments';
            referencedColumns: ['id'];
          },
        ],
      };
      schedule_revisions: {
        Row: {
          id: string;
          schedule_id: string;
          previous_values: Json;
          new_values: Json;
          reason: string | null;
          changed_by: string | null;
          effective_from: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          schedule_id: string;
          previous_values: Json;
          new_values: Json;
          reason?: string | null;
          changed_by?: string | null;
          effective_from?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['schedule_revisions']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'schedule_revisions_schedule_id_fkey';
            columns: ['schedule_id'];
            isOneToOne: false;
            referencedRelation: 'schedules';
            referencedColumns: ['id'];
          },
        ],
      };
      holidays: {
        Row: { id: string; semester_id: string | null; holiday_date: string; title: string; created_at: string };
        Insert: { id?: string; semester_id?: string | null; holiday_date: string; title: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['holidays']['Insert']>;
        Relationships: [],
      };
      attendance_records: {
        Row: {
          id: string;
          faculty_id: string;
          assignment_id: string;
          schedule_id: string | null;
          semester_id: string;
          scheduled_date: string;
          actual_date: string | null;
          start_time: string | null;
          end_time: string | null;
          number_of_periods: number | null;
          number_of_students: number | null;
          status: string;
          remarks: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          faculty_id: string;
          assignment_id: string;
          schedule_id?: string | null;
          semester_id: string;
          scheduled_date: string;
          actual_date?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          number_of_periods?: number | null;
          number_of_students?: number | null;
          status?: string;
          remarks?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['attendance_records']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'attendance_records_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'faculty_assignments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_records_faculty_id_fkey';
            columns: ['faculty_id'];
            isOneToOne: false;
            referencedRelation: 'faculty_profiles';
            referencedColumns: ['id'];
          },
        ],
      };
      attendance_correction_requests: {
        Row: {
          id: string;
          attendance_id: string;
          faculty_id: string;
          requested_changes: Json;
          reason: string;
          status: string;
          reviewed_by: string | null;
          review_remarks: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          attendance_id: string;
          faculty_id: string;
          requested_changes: Json;
          reason: string;
          status?: string;
          reviewed_by?: string | null;
          review_remarks?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['attendance_correction_requests']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'attendance_correction_requests_attendance_id_fkey';
            columns: ['attendance_id'];
            isOneToOne: false;
            referencedRelation: 'attendance_records';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_correction_requests_faculty_id_fkey';
            columns: ['faculty_id'];
            isOneToOne: false;
            referencedRelation: 'faculty_profiles';
            referencedColumns: ['id'];
          },
        ],
      };
      semester_attendance_closures: {
        Row: {
          id: string;
          faculty_id: string;
          semester_id: string;
          submitted_by: string | null;
          total_periods: number;
          total_hours: number;
          statement_status: string;
          locked_at: string | null;
          verified_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          faculty_id: string;
          semester_id: string;
          submitted_by?: string | null;
          total_periods?: number;
          total_hours?: number;
          statement_status?: string;
          locked_at?: string | null;
          verified_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['semester_attendance_closures']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'semester_attendance_closures_faculty_id_fkey';
            columns: ['faculty_id'];
            isOneToOne: false;
            referencedRelation: 'faculty_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'semester_attendance_closures_semester_id_fkey';
            columns: ['semester_id'];
            isOneToOne: false;
            referencedRelation: 'semesters';
            referencedColumns: ['id'];
          },
        ],
      };
      compensation_rules: {
        Row: {
          id: string;
          department_id: string | null;
          designation: string | null;
          method: string;
          theory_rate: number;
          practical_rate: number;
          conveyance: number;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          department_id?: string | null;
          designation?: string | null;
          method?: string;
          theory_rate?: number;
          practical_rate?: number;
          conveyance?: number;
          status?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['compensation_rules']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'compensation_rules_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'departments';
            referencedColumns: ['id'];
          },
        ],
      };
      semester_bills: {
        Row: {
          id: string;
          faculty_id: string;
          semester_id: string;
          bill_number: string | null;
          status: string;
          theory_periods: number;
          theory_rate: number;
          theory_amount: number;
          practical_periods: number;
          practical_rate: number;
          practical_amount: number;
          conveyance: number;
          deductions: number;
          total_amount: number;
          grand_total: number;
          is_revision: boolean;
          revised_from: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          faculty_id: string;
          semester_id: string;
          bill_number?: string | null;
          status?: string;
          theory_periods?: number;
          theory_rate?: number;
          theory_amount?: number;
          practical_periods?: number;
          practical_rate?: number;
          practical_amount?: number;
          conveyance?: number;
          deductions?: number;
          total_amount?: number;
          grand_total?: number;
          is_revision?: boolean;
          revised_from?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['semester_bills']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'semester_bills_faculty_id_fkey';
            columns: ['faculty_id'];
            isOneToOne: false;
            referencedRelation: 'faculty_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'semester_bills_semester_id_fkey';
            columns: ['semester_id'];
            isOneToOne: false;
            referencedRelation: 'semesters';
            referencedColumns: ['id'];
          },
        ],
      };
      bill_items: {
        Row: {
          id: string;
          bill_id: string;
          item_type: string;
          course_number: string | null;
          course_title: string | null;
          number_of_students: number | null;
          serial_number: number | null;
          entry_date: string | null;
          timings: string | null;
          number_of_periods: number;
          rate: number;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          bill_id: string;
          item_type: string;
          course_number?: string | null;
          course_title?: string | null;
          number_of_students?: number | null;
          serial_number?: number | null;
          entry_date?: string | null;
          timings?: string | null;
          number_of_periods?: number;
          rate?: number;
          amount?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['bill_items']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'bill_items_bill_id_fkey';
            columns: ['bill_id'];
            isOneToOne: false;
            referencedRelation: 'semester_bills';
            referencedColumns: ['id'];
          },
        ],
      };
      bill_submissions: {
        Row: {
          id: string;
          bill_id: string;
          submitted_by: string | null;
          submitted_at: string;
          on_time: boolean;
          deadline_at: string | null;
          remarks: string | null;
        };
        Insert: {
          id?: string;
          bill_id: string;
          submitted_by?: string | null;
          submitted_at?: string;
          on_time?: boolean;
          deadline_at?: string | null;
          remarks?: string | null;
        };
        Update: Partial<Database['public']['Tables']['bill_submissions']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'bill_submissions_bill_id_fkey';
            columns: ['bill_id'];
            isOneToOne: false;
            referencedRelation: 'semester_bills';
            referencedColumns: ['id'];
          },
        ],
      };
      bill_approvals: {
        Row: {
          id: string;
          bill_id: string;
          actor_id: string | null;
          actor_role: string;
          action: string;
          from_status: string | null;
          to_status: string;
          remarks: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          bill_id: string;
          actor_id?: string | null;
          actor_role: string;
          action: string;
          from_status?: string | null;
          to_status: string;
          remarks?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['bill_approvals']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'bill_approvals_bill_id_fkey';
            columns: ['bill_id'];
            isOneToOne: false;
            referencedRelation: 'semester_bills';
            referencedColumns: ['id'];
          },
        ],
      };
      physical_bill_receipts: {
        Row: {
          id: string;
          bill_id: string;
          receipt_number: string;
          dispatch_number: string | null;
          received_by: string | null;
          received_at: string;
          remarks: string | null;
        };
        Insert: {
          id?: string;
          bill_id: string;
          receipt_number: string;
          dispatch_number?: string | null;
          received_by?: string | null;
          received_at?: string;
          remarks?: string | null;
        };
        Update: Partial<Database['public']['Tables']['physical_bill_receipts']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'physical_bill_receipts_bill_id_fkey';
            columns: ['bill_id'];
            isOneToOne: false;
            referencedRelation: 'semester_bills';
            referencedColumns: ['id'];
          },
        ],
      };
      bill_attachments: {
        Row: {
          id: string;
          bill_id: string;
          file_name: string;
          storage_path: string;
          mime_type: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          bill_id: string;
          file_name: string;
          storage_path: string;
          mime_type?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['bill_attachments']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'bill_attachments_bill_id_fkey';
            columns: ['bill_id'];
            isOneToOne: false;
            referencedRelation: 'semester_bills';
            referencedColumns: ['id'];
          },
        ],
      };
      payments: {
        Row: {
          id: string;
          bill_id: string;
          faculty_id: string;
          approved_amount: number;
          paid_amount: number;
          payment_date: string;
          payment_method: string;
          reference_number: string | null;
          remarks: string | null;
          status: string;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          bill_id: string;
          faculty_id: string;
          approved_amount: number;
          paid_amount: number;
          payment_date: string;
          payment_method?: string;
          reference_number?: string | null;
          remarks?: string | null;
          status?: string;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'payments_bill_id_fkey';
            columns: ['bill_id'];
            isOneToOne: false;
            referencedRelation: 'semester_bills';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_faculty_id_fkey';
            columns: ['faculty_id'];
            isOneToOne: false;
            referencedRelation: 'faculty_profiles';
            referencedColumns: ['id'];
          },
        ],
      };
      payment_transactions: {
        Row: {
          id: string;
          payment_id: string;
          bill_id: string;
          transaction_type: string;
          amount: number;
          reference_number: string | null;
          remarks: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          bill_id: string;
          transaction_type: string;
          amount: number;
          reference_number?: string | null;
          remarks?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['payment_transactions']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'payment_transactions_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
        ],
      };
      notifications: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          body: string | null;
          category: string;
          link: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          body?: string | null;
          category?: string;
          link?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
        Relationships: [],
      };
      conversations: {
        Row: {
          id: string;
          faculty_id: string | null;
          bill_id: string | null;
          subject: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          faculty_id?: string | null;
          bill_id?: string | null;
          subject: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>;
        Relationships: [],
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string | null;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id?: string | null;
          body: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
        Relationships: [],
      };
      support_tickets: {
        Row: {
          id: string;
          faculty_id: string;
          subject: string;
          body: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          faculty_id: string;
          subject: string;
          body?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['support_tickets']['Insert']>;
        Relationships: [],
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_role: string | null;
          action_type: string;
          entity: string;
          entity_id: string | null;
          previous_value: Json | null;
          new_value: Json | null;
          remarks: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          actor_role?: string | null;
          action_type: string;
          entity: string;
          entity_id?: string | null;
          previous_value?: Json | null;
          new_value?: Json | null;
          remarks?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
        Relationships: [],
      };
      system_settings: {
        Row: { key: string; value: Json; updated_by: string | null; updated_at: string };
        Insert: { key: string; value: Json; updated_by?: string | null; updated_at?: string };
        Update: Partial<Database['public']['Tables']['system_settings']['Insert']>;
        Relationships: [],
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
