export type SessionStatus = 'draft' | 'active' | 'paused' | 'completed' | 'failed';
export type SessionPhase = 'play' | 'summary_ready' | 'review_done';
export type SessionPsychologyMode = 'evidence_bound' | 'assertive';
export type SessionSourceType = 'guided_simulation' | 'real_record';
export type SessionChannel = 'text' | 'voice' | 'mixed';
export type SessionInputSource = 'text' | 'voice';
export type SessionSceneType = 'gov_struggle' | 'corp_clash' | 'upward_takeover';
export type SessionGameModel = 'prisoner_dilemma' | 'pig_game' | 'info_asymmetry' | 'cold_trigger';
export type SessionHierarchy = 'executive' | 'middle' | 'peer' | 'external';

export interface SessionRoleDraft {
  role_id?: string;
  name: string;
  position: string;
  hierarchy_level: SessionHierarchy;
  stance: string;
  interest: string;
  hidden_motive?: string;
  is_user?: boolean;
}

export interface GameTheorySessionConfig {
  title: string;
  scene_type: SessionSceneType;
  game_model: SessionGameModel;
  scenario: string;
  channel: SessionChannel;
  source_type: SessionSourceType;
  psyche_mode: SessionPsychologyMode;
  max_rounds: number;
  max_minutes: number;
  role_count: number;
  auto_roles?: boolean;
  activate?: boolean;
  roles?: SessionRoleDraft[];
}

export interface GameTheorySessionRoundInput {
  text: string;
  source: SessionInputSource;
}

export interface GameTheoryRoleReply {
  role_id: string;
  name: string;
  reply: string;
  style: string;
  risk_hint?: string;
}

export interface GameTheorySessionRound {
  round_no: number;
  user_input: string;
  input_source: SessionInputSource | string;
  role_replies: GameTheoryRoleReply[];
  light_signals: string[];
  need_checkpoint: boolean;
  created_at: number;
}

export interface GameTheoryRoundResult {
  round_no: number;
  role_replies: GameTheoryRoleReply[];
  light_signals?: string[];
  need_checkpoint: boolean;
  session: GameTheorySessionState;
}

export interface GameTheoryPsycheItem {
  observation: string;
  clues: string[];
  confidence: number;
  mode: string;
}

export interface GameTheorySituationSummary {
  hierarchy: string[];
  stance: Record<string, string>;
  interests: Record<string, string[]>;
  psyche: Record<string, GameTheoryPsycheItem>;
  alliances: Array<{ parties: string[]; reason: string }>;
  power_chips: Array<{ owner: string; chip: string; impact: string }>;
  risk_inflections: string[];
  next_actions: Record<string, string[]>;
  countermeasures: string[];
}

export interface GameTheoryReviewItem {
  claim?: string;
  evidence?: string;
  explanation?: string;
  confidence?: number;
}

export interface GameTheoryMissedMoment {
  round_no: number;
  issue: string;
  why: string;
  avoid_action: string;
  evidence?: string;
  explanation?: string;
  confidence?: number;
}

export interface GameTheoryPersonalReview {
  missteps: Array<string | GameTheoryReviewItem>;
  strengths: Array<string | GameTheoryReviewItem>;
  missed_moments: GameTheoryMissedMoment[];
  strategy_guidance: string[];
}

export interface GameTheorySessionState {
  session_id: string;
  user_id?: string;
  title: string;
  scene_type: SessionSceneType | string;
  game_model: SessionGameModel | string;
  source_type: SessionSourceType | string;
  scenario: string;
  psyche_mode: SessionPsychologyMode | string;
  channel?: SessionChannel | string;
  status: SessionStatus;
  current_round: number;
  max_rounds: number;
  max_minutes: number;
  elapsed_minutes: number;
  elapsed_ms?: number;
  started_at?: number | null;
  ended_at?: number | null;
  created_at?: number;
  updated_at?: number;
  phase?: SessionPhase | string;
  stop_reason?: string;
  last_round_summary?: string;
  roles: SessionRoleDraft[];
  rounds?: GameTheorySessionRound[];
  summary?: GameTheorySituationSummary | null;
  review?: GameTheoryPersonalReview | null;
  limit_hit?: 'max_rounds' | 'max_minutes' | string | null;
}

export class GameTheorySessionApiError extends Error {
  session?: GameTheorySessionState;

  constructor(message: string, session?: GameTheorySessionState) {
    super(message);
    this.name = 'GameTheorySessionApiError';
    this.session = session;
  }
}

export function pickResumableSession(items: GameTheorySessionState[]): GameTheorySessionState | null {
  if (!Array.isArray(items) || !items.length) return null;
  return items.find((item) => item.status === 'active')
    || items.find((item) => item.status === 'paused')
    || null;
}
