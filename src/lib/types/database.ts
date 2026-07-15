export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      patients: {
        Row: Patient;
        Insert: Omit<Patient, "created_at">;
        Update: Partial<Patient>;
        Relationships: [];
      };
      health_insurances: {
        Row: HealthInsurance;
        Insert: Omit<HealthInsurance, "created_at">;
        Update: Partial<HealthInsurance>;
        Relationships: [];
      };
      services: {
        Row: Service;
        Insert: Omit<Service, "created_at">;
        Update: Partial<Service>;
        Relationships: [];
      };
      session_packages: {
        Row: SessionPackage;
        Insert: Omit<SessionPackage, "created_at">;
        Update: Partial<SessionPackage>;
        Relationships: [];
      };
      appointments: {
        Row: Appointment;
        Insert: Omit<Appointment, "created_at">;
        Update: Partial<Appointment>;
        Relationships: [];
      };
      clinical_anamneses: {
        Row: ClinicalAnamnesis;
        Insert: Omit<ClinicalAnamnesis, "created_at" | "updated_at">;
        Update: Partial<ClinicalAnamnesis>;
        Relationships: [];
      };
      clinical_evolutions: {
        Row: ClinicalEvolution;
        Insert: Omit<ClinicalEvolution, "created_at">;
        Update: Partial<ClinicalEvolution>;
        Relationships: [];
      };
      femic_generated_documents: {
        Row: GeneratedDocument;
        Insert: Omit<GeneratedDocument, "created_at" | "updated_at">;
        Update: Partial<GeneratedDocument>;
        Relationships: [];
      };
      session_movements: {
        Row: SessionMovement;
        Insert: Omit<SessionMovement, "created_at">;
        Update: Partial<SessionMovement>;
        Relationships: [];
      };
      clinic_rules: {
        Row: ClinicRule;
        Insert: Omit<ClinicRule, "created_at" | "updated_at">;
        Update: Partial<ClinicRule>;
        Relationships: [];
      };
      assistant_tasks: {
        Row: AssistantTask;
        Insert: Omit<AssistantTask, "created_at" | "updated_at">;
        Update: Partial<AssistantTask>;
        Relationships: [];
      };
      schedule_settings: {
        Row: ScheduleSettings;
        Insert: Omit<ScheduleSettings, "created_at">;
        Update: Partial<ScheduleSettings>;
        Relationships: [];
      };
      patient_form_responses: {
        Row: PatientFormResponse;
        Insert: Omit<PatientFormResponse, "id" | "submitted_at">;
        Update: Partial<PatientFormResponse>;
        Relationships: [];
      };
      whatsapp_inbox: {
        Row: WhatsappInbox;
        Insert: Omit<WhatsappInbox, "id" | "received_at">;
        Update: Partial<WhatsappInbox>;
        Relationships: [];
      };
      bot_mutes: {
        Row: BotMute;
        Insert: Omit<BotMute, "id">;
        Update: Partial<BotMute>;
        Relationships: [];
      };
      whatsapp_service_status: {
        Row: WhatsappServiceStatus;
        Insert: Omit<WhatsappServiceStatus, "id" | "updated_at">;
        Update: Partial<WhatsappServiceStatus>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

export interface Patient {
  id: string;
  name: string;
  pathology: string | null;
  whatsapp: string | null;
  birth_date: string | null;
  referral_source: string | null;
  feedback_sent: boolean;
  feedback_sent_at: string | null;
  archived: boolean;
  archived_at: string | null;
  created_at: string;
}

export interface HealthInsurance {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  type: string | null;
  price: number | null;
  duration_minutes: number | null;
  appointment_mode: string | null;
  max_patients: number | null;
  health_insurance_id: string | null;
  active: boolean;
  created_at: string;
}

export interface SessionPackage {
  id: string;
  patient_id: string;
  service_id: string | null;
  total_sessions: number | null;
  remaining_sessions: number | null;
  active: boolean;
  created_at: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  service_id: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number | null;
  status: string;
  package_consumed: boolean;
  session_package_id: string | null;
  service_price_at_time: number | null;
  notes: string | null;
  appointment_reminder_sent: boolean;
  appointment_reminder_sent_at: string | null;
  form_reminder_sent: boolean;
  form_reminder_sent_at: string | null;
  reminder_sent: boolean;
  reminder_sent_at: string | null;
  created_at: string;
}

export interface ClinicalAnamnesis {
  id: string;
  patient_id: string;
  chief_complaint: string | null;
  history: string | null;
  diagnosis: string | null;
  limitations: string | null;
  goals: string | null;
  obs: string | null;
  occupation_routine: string | null;
  physical_activity_context: string | null;
  red_flags: string | null;
  previous_treatments: string | null;
  psychosocial_factors: string | null;
  fear_avoidance: string | null;
  clinical_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicalEvolution {
  id: string;
  patient_id: string;
  date: string;
  conduct: string | null;
  guidance: string | null;
  created_at: string;
}

export interface GeneratedDocument {
  id: string;
  patient_id: string | null;
  patient_name: string | null;
  document_type: string | null;
  document_title: string | null;
  document_body: string | null;
  document_date: string | null;
  rendered_html: string | null;
  metadata: Json;
  status: string;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionMovement {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  session_package_id: string | null;
  type: string | null;
  quantity: number | null;
  created_at: string;
}

export interface ClinicRule {
  id: string;
  rule_key: string;
  rule_category: string | null;
  title: string;
  description: string | null;
  rule_value_json: Json;
  active: boolean;
  priority: number | null;
  created_at: string;
  updated_at: string;
}

export interface AssistantTask {
  id: string;
  patient_id: string | null;
  patient_name: string | null;
  phone: string | null;
  service_name: string | null;
  service_id: string | null;
  status: string;
  notes: string | null;
  suggested_slots: string | null;
  origin: string | null;
  needs_review: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduleSettings {
  id: string;
  start_time: string | null;
  end_time: string | null;
  working_days: string | null;
  working_periods: string | null;
  max_patients_per_slot: number | null;
  slot_interval_minutes: number | null;
  created_at: string;
}

export interface PatientFormResponse {
  id: string;
  submitted_at: string;
  response_date: string;
  patient_name: string;
  patient_whatsapp: string;
  patient_pathology: string | null;
  pain: number | null;
  functionality: number | null;
  satisfaction: number | null;
  symptoms: string[] | null;
  obs: string | null;
  source: string | null;
  imported: boolean;
  linked_patient_id: string | null;
  imported_at: string | null;
}

export interface WhatsappInbox {
  id: string;
  phone: string | null;
  jid: string | null;
  sender_name: string | null;
  message_text: string | null;
  category: string | null;
  confidence: number | null;
  status: string | null;
  received_at: string;
}

export interface BotMute {
  id: string;
  jid: string;
  expires_at: string | null;
  active: boolean;
}

export interface WhatsappServiceStatus {
  id: string;
  service_name: string;
  provider: string | null;
  connection_status: string | null;
  last_seen_at: string | null;
  last_connected_at: string | null;
  last_error: string | null;
  updated_at: string;
}
