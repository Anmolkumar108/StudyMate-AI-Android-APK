export type DocStatus = 'upload_pending' | 'processing' | 'ready' | 'failed';

export interface DocumentSummaryConcept {
  concept: string;
  explanation: string;
}

export interface Document {
  id: string;
  user_id: string;
  subject_id?: string | null;
  title: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  page_count?: number | null;
  status: DocStatus;
  error_message?: string | null;
  summary_tldr?: string | null;
  summary_key_concepts?: DocumentSummaryConcept[] | Record<string, unknown> | null;
  extracted_text_snippet?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentListParams {
  subject_id?: string;
  status?: DocStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface DocumentListResponse {
  items: Document[];
  total: number;
}

