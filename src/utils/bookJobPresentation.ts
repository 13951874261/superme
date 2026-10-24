import type { BookJob } from '../services/bookUploadAPI';

const terminalStatuses = new Set(['completed', 'failed', 'cancelled']);

export function bookJobStage(job: Pick<BookJob, 'currentStage' | 'current_stage'>) {
  return job.currentStage || job.current_stage || 'queued';
}

export function shouldPollBookJob(job: Pick<BookJob, 'status' | 'currentStage' | 'current_stage'>) {
  return !terminalStatuses.has(job.status) && bookJobStage(job) !== 'awaiting_chapter_confirmation';
}

export function describeBookJob(job: Pick<BookJob, 'status' | 'currentStage' | 'current_stage' | 'errorCode' | 'errorMessage' | 'error_code' | 'error_message'>): { label: string; action?: string; errorCode?: string; errorMessage?: string } {
  const stage = bookJobStage(job);
  if (stage === 'awaiting_chapter_confirmation') return { label: '章节解析完成，等待确认章节', action: '前往确认章节' };
  if (job.status === 'completed') return { label: stage === 'framework_draft_ready' ? '理论框架草稿已生成' : '任务已完成' };
  if (job.status === 'failed') {
    const errorCode = job.errorCode || job.error_code || undefined;
    return { label: '任务失败', ...(errorCode ? { errorCode } : {}), errorMessage: errorCode === 'WORKFLOW_HTTP_400' ? '工作流输入格式错误，请重试或联系管理员' : '书籍处理失败，请重试或联系管理员' };
  }
  if (job.status === 'cancelled') return { label: '任务已取消' };
  if (job.status === 'pending' || job.status === 'retrying') return { label: '任务排队中' };
  return { label: '书籍解析中' };
}
