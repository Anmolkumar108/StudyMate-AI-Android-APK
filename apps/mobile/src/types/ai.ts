export interface AIChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  token_count?: number | null;
  model_identifier?: string | null;
  created_at: string;
}

export interface AIChatSession {
  id: string;
  user_id: string;
  subject_id?: string | null;
  title: string;
  is_socratic: boolean;
  created_at: string;
  updated_at: string;
  messages: AIChatMessage[];
}

export interface AIChatRequest {
  message: string;
  session_id?: string | null;
  subject_id?: string | null;
  is_socratic?: boolean;
}

export interface AIChatResponse {
  session_id: string;
  message_id: string;
  reply: string;
  role: string;
  model_identifier?: string | null;
  created_at: string;
}

export interface AIExplanationRequest {
  topic: string;
  depth?: 'elif' | 'high_school' | 'undergraduate' | 'expert';
  subject_id?: string | null;
}

export interface AIExplanationResponse {
  topic: string;
  depth: string;
  explanation: string;
  key_takeaways: string[];
  self_check_question: string;
}

export interface AINoteGenerationRequest {
  source_text: string;
  title?: string | null;
  format?: 'cornell' | 'executive' | 'study_guide';
  subject_id?: string | null;
}

export interface AINoteGenerationResponse {
  title: string;
  note_type: string;
  content: string;
  key_points: string[];
  summary: string;
}

