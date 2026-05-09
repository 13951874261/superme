export interface ListenWorkflowInput {
  scene_type: string;
  case_text: string;
  role_judgement: string;
  ability_judgement: string;
  intent_judgement: string;
  fallacy_choice: string;
  counter_question: string;
}

export interface DifyWorkflowResponse {
  task_id?: string;
  workflow_run_id?: string;
  data?: {
    id?: string;
    status?: string;
    outputs?: Record<string, unknown>;
    error?: string;
  };
  answer?: string;
  message?: string;
  error?: string;
}

const DIFY_API_BASE_URL = import.meta.env.VITE_DIFY_API_BASE_URL || 'http://dify.234124123.xyz/v1';
const DIFY_APP_ID = import.meta.env.VITE_DIFY_APP_ID || '56a4d2c1-006c-4c46-95cc-7b6bedafbcff';

function getDifyApiKey() {
  const key = import.meta.env.VITE_DIFY_API_KEY;
  if (!key) {
    throw new Error('Missing VITE_DIFY_API_KEY');
  }
  return key;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${DIFY_API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${getDifyApiKey()}`,
      'Content-Type': 'application/json',
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Dify HTTP ${res.status}`);
  }
  return data as T;
}

export async function runListenWorkflow(inputs: ListenWorkflowInput, userId = 'default-user') {
  return request<DifyWorkflowResponse>(`/workflows/run`, {
    method: 'POST',
    body: JSON.stringify({
      inputs,
      response_mode: 'blocking',
      user: userId,
    }),
  });
}

export function getDifyAppId() {
  return DIFY_APP_ID;
}
