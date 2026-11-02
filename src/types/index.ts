export type ErrorCategory = 'network_timeout' | 'server_error' | 'unclear_image' | 'invalid_json';

export interface MedicineAnalysisResult {
  is_clear: boolean;
  medicine_name_ar?: string;
  medicine_name_en?: string;
  active_ingredient?: string;
  uses?: string[];
  how_and_when?: string[];
  usage_source?: 'printed' | 'common';
  warnings?: string[];
  audio_summary?: string;
  raw_error?: string;
  error_category?: ErrorCategory;
  error_code?: string;
  error_detail?: string;
}

export type ItemConfidence = 'high' | 'medium' | 'low';
export type ConfidenceLevel = ItemConfidence;

export interface PrescriptionItem {
  line_text_as_written: string;
  medicine_name_ar: string;
  medicine_name_en: string;
  active_ingredient: string;
  confidence: ItemConfidence;
  written_instructions: string;
  short_explanation: string;
}

export interface PrescriptionAnalysisResult {
  is_clear: boolean;
  retake_message?: string;
  confidence: 'high' | 'medium' | 'low';
  evidence_text?: string;
  items: PrescriptionItem[];
  audio_summary?: string;
  raw_error?: string;
  error_category?: ErrorCategory;
  error_code?: string;
  error_detail?: string;
}

export type TabKey = 'home' | 'medicines' | 'camera' | 'prescription' | 'history';
export type ActiveTab = 'home' | 'medicines' | 'prescription' | 'history';

export interface NavTabItem {
  key: TabKey;
  label: string;
  icon: string;
}

export interface MedicationHistoryItem extends MedicineAnalysisResult {
  id: string;
  timestamp: number;
}

export type FontSizePreference = 'normal' | 'large' | 'extra-large'; // 'normal' = 16px, 'large' = 19px, 'extra-large' = 23px

export type ThemePreference = 'system' | 'light' | 'dark';

export type AudioState = 'idle' | 'speaking' | 'paused';

