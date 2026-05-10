/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DIFY_API_BASE_URL?: string;
  readonly VITE_DIFY_APP_ID?: string;
  readonly VITE_DIFY_API_KEY?: string;
  readonly VITE_DIFY_VOCAB_API_KEY?: string;
  readonly GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
