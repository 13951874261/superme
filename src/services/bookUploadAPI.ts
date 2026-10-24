export type BookUploadResult = { bookId: string; jobId: string; jobStatus: string; createdAt: number; deduplicated?: boolean };
export type BookJob = { id: string; book_id: string; status: string; currentStage?: string; current_stage?: string; queuePosition?: number | null; totalChapters?: number; completedChapters?: number; failedChapters?: number; errorCode?: string | null; errorMessage?: string | null; error_code?: string | null; error_message?: string | null };

async function body<T>(response: Response): Promise<T> {
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(value.error || `HTTP ${response.status}`), { errorCode: value.errorCode });
  return value;
}
export async function uploadBook(file: File): Promise<BookUploadResult> {
  const form = new FormData(); form.append('file', file);
  return body<BookUploadResult>(await fetch('/api/books', { method: 'POST', credentials: 'include', body: form }));
}
export async function getBookJob(bookId: string, jobId: string): Promise<BookJob> {
  return (await body<{ job: BookJob }>(await fetch(`/api/books/${encodeURIComponent(bookId)}/jobs/${encodeURIComponent(jobId)}`, { credentials: 'include' }))).job;
}
