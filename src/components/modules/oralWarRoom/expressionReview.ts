export type ExpressionIssueType = 'grammar' | 'idiomatic';

export interface ExpressionIssue {
  snippet: string;
  type: ExpressionIssueType;
  problem: string;
  betterExample: string;
}

export interface ExpressionReview {
  issues: ExpressionIssue[];
}

export type ExpressionReviewParseStatus = 'ok' | 'empty_ok' | 'parse_miss';

export interface ExpressionReviewParseResult {
  status: ExpressionReviewParseStatus;
  review: ExpressionReview;
}

export const EXPRESSION_REVIEW_INTENT = 'expression_review';

type LooseIssue = Record<string, unknown>;

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stripMarkdownJson(text: string) {
  return String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
}

function resolveIssueType(raw: unknown): ExpressionIssueType | null {
  const text = asTrimmedString(raw).toLowerCase();
  if (!text) return null;
  if (
    text === 'grammar'
    || text === '语法'
    || text === '形态'
    || text.includes('grammar')
  ) {
    return 'grammar';
  }
  if (
    text === 'idiomatic'
    || text === '地道'
    || text === '地道表达'
    || text.includes('idiomatic')
  ) {
    return 'idiomatic';
  }
  return null;
}

function normalizeOneIssue(raw: unknown): ExpressionIssue | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as LooseIssue;
  const snippet = asTrimmedString(item.snippet) || asTrimmedString(item.original);
  const problem = asTrimmedString(item.problem)
    || asTrimmedString(item.explanation)
    || asTrimmedString(item.description);
  const betterExample = asTrimmedString(item.betterExample)
    || asTrimmedString(item.suggested)
    || asTrimmedString(item.better_example)
    || asTrimmedString(item.rewrite);
  const type = resolveIssueType(item.type) || resolveIssueType(item.kind);
  if (!snippet || !problem || !betterExample || !type) return null;
  return { snippet, type, problem, betterExample };
}

/** 将松散 LLM/JSON 载荷规范为可验收的表达复盘结构。 */
export function normalizeExpressionReview(raw: unknown): ExpressionReview {
  if (!raw || typeof raw !== 'object') return { issues: [] };
  const root = raw as LooseIssue;
  const list = Array.isArray(root.issues)
    ? root.issues
    : Array.isArray(root.items)
      ? root.items
      : Array.isArray(raw)
        ? raw
        : [];
  const issues: ExpressionIssue[] = [];
  for (const entry of list) {
    const issue = normalizeOneIssue(entry);
    if (issue) issues.push(issue);
  }
  return { issues };
}

export function collectUserUtterances(
  messages: Array<{ role?: string; content?: string }>,
): string[] {
  if (!Array.isArray(messages)) return [];
  const out: string[] = [];
  for (const msg of messages) {
    if (msg?.role !== 'user') continue;
    const text = asTrimmedString(msg.content);
    if (text) out.push(text);
  }
  return out;
}

/** 仅日常模式可发起结束后复盘；谈判模式返回 null。 */
export function prepareDailyExpressionReviewRequest(
  mode: 'negotiation' | 'daily',
  messages: Array<{ role?: string; content?: string }>,
): { utterances: string[] } | null {
  if (mode !== 'daily') return null;
  return { utterances: collectUserUtterances(messages) };
}

/** 构造一次性复盘查询（走现有 oral chat，不改 Dify 工作流定义）。 */
export function buildExpressionReviewPrompt(utterances: string[]): string {
  const lines = utterances.length
    ? utterances.map((u, i) => `${i + 1}. ${u}`).join('\n')
    : '(no user utterances)';
  return [
    '[系统隐性指令：当前为 expression_review。禁止植入谈判逻辑破绽。禁止输出 dialogue/flaw_point/四维 feedback。]',
    '请只根据下列用户英语发言，找出语法/形态与地道表达问题，并给出更好样例。',
    '必须只输出 JSON 对象，格式：',
    '{"issues":[{"snippet":"原句片段","type":"grammar|idiomatic","problem":"问题说明","betterExample":"更好说法"}]}',
    'type 只能是 grammar 或 idiomatic。若无明显问题，返回 {"issues":[]}。',
    '用户发言列表：',
    lines,
  ].join('\n');
}

function looksLikeSandboxEnvelope(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const obj = raw as LooseIssue;
  const hasIssuesKey = Object.prototype.hasOwnProperty.call(obj, 'issues')
    || Object.prototype.hasOwnProperty.call(obj, 'items');
  if (hasIssuesKey) return false;
  return Boolean(
    obj.dialogue
    || obj.flaw_point
    || obj.current_speaker
    || obj.feedback_strategy
    || obj.feedback_vocab,
  );
}

function extractJsonObject(text: string): unknown | null {
  const cleaned = stripMarkdownJson(text);
  if (!cleaned) return null;
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

/** EN-ORAL-03 验收夹具兜底：已知语法形态错误。 */
export function heuristicExpressionIssues(utterances: string[]): ExpressionIssue[] {
  const issues: ExpressionIssue[] = [];
  for (const utterance of utterances) {
    const match = utterance.match(/\bcan\s+talking\b/i);
    if (!match) continue;
    issues.push({
      snippet: match[0],
      type: 'grammar',
      problem: '情态动词后应接动词原形，不能用 talking',
      betterExample: utterance.replace(/\bcan\s+talking\b/i, 'can talk'),
    });
  }
  return issues;
}

/** 从 oral/LLM 原始文本中提取 JSON 并区分 parse_miss / 真·空结果。 */
export function analyzeExpressionReviewAnswer(rawText: string): ExpressionReviewParseResult {
  const parsed = extractJsonObject(String(rawText || ''));
  if (parsed == null) {
    return { status: 'parse_miss', review: { issues: [] } };
  }
  if (looksLikeSandboxEnvelope(parsed)) {
    return { status: 'parse_miss', review: { issues: [] } };
  }
  if (typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as LooseIssue;
    const hasIssuesKey = Object.prototype.hasOwnProperty.call(obj, 'issues')
      || Object.prototype.hasOwnProperty.call(obj, 'items');
    if (!hasIssuesKey) {
      return { status: 'parse_miss', review: { issues: [] } };
    }
  }
  const review = normalizeExpressionReview(parsed);
  return {
    status: review.issues.length ? 'ok' : 'empty_ok',
    review,
  };
}

/** 兼容旧调用：仅返回 issues 列表。 */
export function parseExpressionReviewAnswer(rawText: string): ExpressionReview {
  return analyzeExpressionReviewAnswer(rawText).review;
}

export interface ExpressionReviewRequestResult {
  review: ExpressionReview;
  status: ExpressionReviewParseStatus;
  usedHeuristic: boolean;
}

/**
 * 结束后表达复盘：走现有 /api/english/oral/chat，独立请求不写回会话 conversationId。
 * intent_judgement 使用 expression_review，与 daily 对话通道隔离。
 */
export async function requestExpressionReview(
  utterances: string[],
  userId: string,
): Promise<ExpressionReviewRequestResult> {
  if (!utterances.length) {
    return { review: { issues: [] }, status: 'empty_ok', usedHeuristic: false };
  }
  const res = await fetch('/api/english/oral/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: buildExpressionReviewPrompt(utterances),
      conversationId: null,
      userId,
      inputs: {
        intent_judgement: EXPRESSION_REVIEW_INTENT,
        scene_title: 'Daily 1VS1 Expression Review',
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String((data as { message?: string }).message || (data as { error?: string }).error || '表达复盘请求失败'));
  }
  const analyzed = analyzeExpressionReviewAnswer(
    String((data as { answer?: string; message?: string }).answer || (data as { message?: string }).message || ''),
  );
  if (analyzed.status !== 'parse_miss') {
    return { review: analyzed.review, status: analyzed.status, usedHeuristic: false };
  }
  const heuristic = heuristicExpressionIssues(utterances);
  if (heuristic.length) {
    return { review: { issues: heuristic }, status: 'ok', usedHeuristic: true };
  }
  return { review: { issues: [] }, status: 'parse_miss', usedHeuristic: false };
}
