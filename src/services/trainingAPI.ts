export interface SessionUpsertResponse {
  success: boolean;
  sessionId: string;
  status: 'created' | 'updated';
}

export interface TrainingSessionDetail {
  session: any;
  attempts: any[];
  review: any | null;
}

export interface MaterialIngestJob {
  id: string;
  user_id: string;
  source_type: string;
  source_name: string;
  source_text: string;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  topic: string;
  kb_dataset_id: string;
  dify_document_id: string;
  dify_batch_id: string;
  dify_document_status: string;
  dify_display_status: string;
  dify_segment_count: number;
  dify_word_count: number;
  dify_doc_language: string;
  dify_download_url: string;
  summary_record_id: string;
  summary_json: Record<string, unknown>;
  error_message: string;
  created_at: number;
  updated_at: number;
}

export interface KnowledgeNode {
  id: string;
  user_id: string;
  module_name: string;
  topic: string;
  node_name: string;
  mastery_level: number;
  review_due_at: number | null;
  last_practiced_at: number | null;
  source_material_id: string;
  extra_json: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }
  return data as T;
}

export async function upsertTrainingSession(params: {
  userId?: string;
  trainingDate: string;
  totalMinutes?: number;
  listenMinutes?: number;
  logicMinutes?: number;
  /** 浅合并进 training_sessions.extra_json（含 englishFoundation 子对象合并） */
  extraJson?: Record<string, unknown>;
}): Promise<SessionUpsertResponse> {
  return request<SessionUpsertResponse>('/api/training/session/upsert', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function createTrainingAttempt(params: Record<string, unknown>): Promise<{ success: boolean; attemptId: string }> {
  return request('/api/training/attempt', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export interface ThemeMasteryCheck {
  success: boolean;
  theme: string;
  userId?: string;
  oralCount: number;
  maxWriteScore: number;
  isMastered: boolean;
}

export async function checkThemeMastery(theme: string, userId = 'default-user'): Promise<ThemeMasteryCheck> {
  const q = new URLSearchParams({ theme, userId });
  return request<ThemeMasteryCheck>(`/api/theme/check-mastery?${q.toString()}`);
}

export async function setThemeFocus(params: {
  theme: string;
  difficulty?: string;
  userId?: string;
}): Promise<{ success: boolean; theme: string; difficulty: string }> {
  return request('/api/theme/focus', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function submitTrainingFeedback(params: Record<string, unknown>): Promise<{ success: boolean; feedbackId: string; status: string }> {
  return request('/api/training/feedback', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function upsertDailyReview(params: Record<string, unknown>): Promise<{ success: boolean; reviewId: string; status: string }> {
  return request('/api/review/daily/upsert', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getTrainingSessionDetail(sessionId: string): Promise<TrainingSessionDetail> {
  return request(`/api/training/session/${sessionId}`);
}

export async function getTrainingSessionByDate(params: {
  trainingDate: string;
  userId?: string;
}): Promise<TrainingSessionDetail> {
  const query = new URLSearchParams({
    trainingDate: params.trainingDate,
    userId: params.userId || 'default-user',
  });
  return request(`/api/training/session-by-date?${query.toString()}`);
}

export async function createMaterialIngestJob(params: {
  userId?: string;
  sourceType?: string;
  sourceName?: string;
  sourceText?: string;
  topic?: string;
  kbDatasetId?: string;
  summaryJson?: Record<string, unknown>;
}) {
  return request<{ success: boolean; materialId: string; status: string }>('/api/material/ingest', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function uploadMaterialDocument(params: {
  userId?: string;
  sourceName: string;
  topic?: string;
  fileName: string;
  mimeType?: string;
  base64Content: string;
}) {
  return request<{ success: boolean; materialId: string; status: string }>('/api/material/upload', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function generateMaterialSummary(materialId: string) {
  return request<{ success: boolean; materialId: string; summaryJson?: Record<string, unknown>; workflowRun?: unknown }>(`/api/material/${materialId}/generate-summary`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function completeMaterialIngestJob(materialId: string, params: {
  summaryJson?: Record<string, unknown>;
  summaryRecordId?: string;
  kbDatasetId?: string;
  errorMessage?: string;
}) {
  return request<{ success: boolean }>(`/api/material/ingest/${materialId}/complete`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function syncMaterialDifyStatus(materialId: string) {
  return request<{ success: boolean; materialId: string; status: string; dify: { document: Record<string, unknown>; downloadUrl?: string } }>(`/api/material/${materialId}/sync-dify-status`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function updateMaterialDocument(materialId: string, params: {
  mode: 'file' | 'text';
  sourceName?: string;
  topic?: string;
  sourceText?: string;
  fileName?: string;
  mimeType?: string;
  base64Content?: string;
}) {
  return request<{ success: boolean; materialId: string; status?: string; dify?: { document: Record<string, unknown>; batch?: string } }>(`/api/material/${materialId}/update`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function deleteMaterialDocument(materialId: string) {
  return request<{ success: boolean; materialId: string }>(`/api/material/${materialId}`, {
    method: 'DELETE',
    body: JSON.stringify({}),
  });
}

export async function listMaterialIngestJobs(userId = 'default-user') {
  return request<MaterialIngestJob[]>(`/api/material/list?userId=${encodeURIComponent(userId)}`);
}

export async function upsertKnowledgeNode(params: {
  userId?: string;
  moduleName?: string;
  topic?: string;
  nodeName?: string;
  masteryLevel?: number;
  reviewDueAt?: number | null;
  lastPracticedAt?: number | null;
  sourceMaterialId?: string;
  extraJson?: Record<string, unknown>;
}) {
  return request<{ success: boolean; nodeId: string; status: string }>('/api/knowledge-node/upsert', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function listKnowledgeNodes(userId = 'default-user', sourceMaterialId = '') {
  const query = new URLSearchParams({ userId: encodeURIComponent(userId) });
  if (sourceMaterialId) query.set('sourceMaterialId', sourceMaterialId);
  return request<KnowledgeNode[]>(`/api/knowledge-node/list?${query.toString()}`);
}
