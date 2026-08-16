import React, { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  Landmark,
  Loader2,
  Map,
  Mic,
  MicOff,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Square,
  Swords,
  Target,
  Trash2,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import ScriptWorkshopDrawer from './ScriptWorkshopDrawer';
import { ScriptWorkshopDraft } from './ScriptWorkshopTypes';
import ToneCorrectionTable from './ToneCorrectionTable';
import { playClick, playGentleWarning, playPageTurn } from '../../../utils/soundEffects';
import {
  controlGameTheorySession,
  generateGameTheoryPersonalReview,
  generateGameTheorySessionSummary,
  listGameTheorySessions,
  getGameTheorySession,
  startGameTheorySession,
  submitGameTheorySessionRound,
  transcribeAudioWithWhisper,
  updateGameTheorySessionRoles,
} from '../../../services/difyAPI';
import {
  GameTheorySessionApiError,
  pickResumableSession,
  type GameTheoryPersonalReview,
  type GameTheoryReviewItem,
  type GameTheoryRoleReply,
  type GameTheorySessionRound,
  type GameTheorySessionState,
  type GameTheorySituationSummary,
  type SessionGameModel,
  type SessionHierarchy,
  type SessionPsychologyMode,
  type SessionRoleDraft,
  type SessionSceneType,
  type SessionSourceType,
} from './GameTheorySessionTypes';

gsap.registerPlugin(useGSAP);

const SCENE_OPTIONS: Array<{ id: SessionSceneType; name: string }> = [
  { id: 'gov_struggle', name: '体制内政治' },
  { id: 'corp_clash', name: '外企权斗局' },
  { id: 'upward_takeover', name: '以下克上战' },
];

const MODEL_OPTIONS: Array<{ id: SessionGameModel; name: string }> = [
  { id: 'prisoner_dilemma', name: '囚徒困境' },
  { id: 'pig_game', name: '智猪博弈' },
  { id: 'info_asymmetry', name: '信息不对称' },
  { id: 'cold_trigger', name: '冷酷触发' },
];

const HIERARCHY_OPTIONS: Array<{ id: SessionHierarchy; name: string }> = [
  { id: 'executive', name: '高层' },
  { id: 'middle', name: '中层' },
  { id: 'peer', name: '平级' },
  { id: 'external', name: '外部' },
];

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  active: '进行中',
  paused: '已暂停',
  completed: '已结束',
  failed: '失败',
};

function asReviewItem(item: string | GameTheoryReviewItem): GameTheoryReviewItem {
  if (typeof item === 'string') return { claim: item };
  return item;
}

function catchSession(err: unknown, setSession: (s: GameTheorySessionState) => void, setError: (s: string) => void) {
  if (err instanceof GameTheorySessionApiError && err.session) {
    setSession(err.session);
  }
  setError(err instanceof Error ? err.message : String(err));
  playGentleWarning();
}

function sessionStepIndex(session: GameTheorySessionState | null): number {
  if (!session || session.status === 'draft') return 0;
  if (session.review || session.phase === 'review_done') return 3;
  if (session.summary || session.phase === 'summary_ready') return 2;
  return 1;
}

function nextStepHint(session: GameTheorySessionState): string {
  if (session.status === 'draft') return '确认己方角色后开始';
  if (session.status === 'active') return '提交本轮发言';
  if (session.review || session.phase === 'review_done') return '本局已完成，可新开';
  if (session.summary || session.phase === 'summary_ready') return '生成个人复盘';
  if (session.limit_hit) return '生成局势全景图';
  return '继续对局，或生成全景图';
}

function SessionPhaseStepper({ session }: { session: GameTheorySessionState | null }) {
  const current = sessionStepIndex(session);
  const steps = ['配置', '对局', '全景', '复盘'];
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="会话阶段">
      {steps.map((label, idx) => (
        <React.Fragment key={label}>
          {idx > 0 && <span className={`hidden sm:block h-px w-5 ${idx <= current ? 'bg-zinc-900' : 'bg-zinc-200'}`} />}
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
            idx === current ? 'bg-zinc-900 text-white' : idx < current ? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-50 text-zinc-400'
          }`}>
            {idx + 1} {label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

function StatusBar({ session, highContrast, onToggleContrast, liveElapsedMs }: {
  session: GameTheorySessionState;
  highContrast: boolean;
  onToggleContrast: () => void;
  liveElapsedMs?: number;
}) {
  const elapsedMinutes = Math.floor((liveElapsedMs ?? session.elapsed_ms ?? session.elapsed_minutes * 60000) / 60000);
  const remainRounds = Math.max(0, session.max_rounds - session.current_round);
  const remainMinutes = Math.max(0, session.max_minutes - elapsedMinutes);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_15px_rgba(0,0,0,0.02)] p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <SessionPhaseStepper session={session} />
        <p className="text-[11px] font-bold text-zinc-800">下一步：{nextStepHint(session)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2 text-[11px] font-bold text-zinc-600">
          <span className="px-2.5 py-1 rounded-full bg-zinc-50 border border-zinc-100">角色 {session.roles?.length || 0}</span>
          <span className="px-2.5 py-1 rounded-full bg-zinc-50 border border-zinc-100">回合 {session.current_round}/{session.max_rounds}</span>
          <span className="px-2.5 py-1 rounded-full bg-zinc-50 border border-zinc-100">已用 {elapsedMinutes} 分钟</span>
          <span className="px-2.5 py-1 rounded-full bg-zinc-50 border border-zinc-100">剩余 {remainRounds} 轮 / {remainMinutes} 分钟</span>
          <span className="px-2.5 py-1 rounded-full bg-zinc-900 text-white">{STATUS_LABEL[session.status] || session.status}</span>
        </div>
        <button
          type="button"
          aria-label="切换高对比回复区"
          onClick={onToggleContrast}
          className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 cursor-pointer"
        >
          {highContrast ? '标准对比' : '高对比'}
        </button>
      </div>
    </div>
  );
}

function Fold({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-zinc-100 bg-zinc-50/60">
      <summary className="cursor-pointer list-none px-4 py-3 text-xs font-bold text-zinc-800 flex items-center justify-between">
        {title}
        <ChevronDown className="w-3.5 h-3.5 text-zinc-400 group-open:rotate-180 transition-transform" />
      </summary>
      <div className="px-4 pb-4 text-xs text-zinc-600 leading-relaxed space-y-2">{children}</div>
    </details>
  );
}

function userRoleOf(roles: SessionRoleDraft[] | undefined): SessionRoleDraft | undefined {
  return (roles || []).find((role) => role.is_user);
}

function isOwnReply(reply: GameTheoryRoleReply, roles: SessionRoleDraft[]): boolean {
  return roles.some((role) => role.is_user && (role.role_id === reply.role_id || role.name === reply.name));
}

function signalTone(text: string): string {
  if (/风险|警告|冲突|决裂|翻脸|危险|红线|威胁/.test(text)) return 'bg-rose-50 text-rose-700 border-rose-100';
  if (/联盟|合作|让步|共识|靠拢/.test(text)) return 'bg-sky-50 text-sky-700 border-sky-100';
  if (/分歧|对立|僵持|检查点|对峙/.test(text)) return 'bg-amber-50 text-amber-800 border-amber-100';
  return 'bg-zinc-50 text-zinc-600 border-zinc-100';
}

function firstActionOf(summary: GameTheorySituationSummary, userName?: string): string {
  const own = userName ? summary.next_actions?.[userName] : undefined;
  if (own?.[0]) return own[0];
  const first = Object.values(summary.next_actions || {}).find((items) => items?.length);
  return first?.[0] || '';
}

function SummaryTopCards({ summary, userName }: { summary: GameTheorySituationSummary; userName?: string }) {
  const risk = summary.risk_inflections?.[0] || '暂无明确风险拐点';
  const chip = summary.power_chips?.[0];
  const action = firstActionOf(summary, userName) || '暂无建议动作';
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="gsap-entrance rounded-2xl bg-amber-50 border border-amber-100 p-4">
        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> 关键风险
        </p>
        <p className="text-xs font-bold text-amber-950 mt-2 leading-relaxed">{risk}</p>
        {(summary.risk_inflections?.length || 0) > 1 && (
          <p className="text-[10px] text-amber-600 mt-2">另有 {summary.risk_inflections.length - 1} 处拐点，见下方详情</p>
        )}
      </div>
      <div className="gsap-entrance rounded-2xl bg-sky-50 border border-sky-100 p-4">
        <p className="text-[10px] font-bold text-sky-700 uppercase tracking-widest flex items-center gap-1.5">
          <Landmark className="w-3.5 h-3.5" /> 关键筹码
        </p>
        <p className="text-xs font-bold text-sky-950 mt-2 leading-relaxed">
          {chip ? `${chip.owner} · ${chip.chip}` : '暂无明确筹码'}
        </p>
        {chip?.impact && <p className="text-[10px] text-sky-600 mt-2">{chip.impact}</p>}
      </div>
      <div className="gsap-entrance rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
        <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5" /> 建议动作
        </p>
        <p className="text-xs font-bold text-emerald-950 mt-2 leading-relaxed">{action}</p>
        {userName && <p className="text-[10px] text-emerald-600 mt-2">面向己方 · {userName}</p>}
      </div>
    </div>
  );
}

function SummaryView({ summary, userName }: { summary: GameTheorySituationSummary; userName?: string }) {
  return (
    <div className="space-y-3">
      <SummaryTopCards summary={summary} userName={userName} />
      <Fold title="立场与关系" defaultOpen>
        {Object.entries(summary.stance || {}).map(([name, text]) => (
          <p key={name}><span className="font-bold text-zinc-800">{name}：</span>{text}</p>
        ))}
      </Fold>
      <Fold title="联盟与多方格局" defaultOpen>
        {(summary.alliances || []).length
          ? (summary.alliances || []).map((item, idx) => (
            <p key={idx}>{(item.parties || []).join(' / ')}：{item.reason}</p>
          ))
          : <p>暂无明确联盟</p>}
      </Fold>
      <Fold title="局势反制" defaultOpen>{(summary.countermeasures || []).map((text) => <p key={text}>{text}</p>)}</Fold>
      <Fold title="阶层">{summary.hierarchy?.join(' → ') || '暂无'}</Fold>
      <Fold title="利益">
        {Object.entries(summary.interests || {}).map(([name, items]) => (
          <p key={name}><span className="font-bold text-zinc-800">{name}：</span>{(items || []).join('；')}</p>
        ))}
      </Fold>
      <Fold title="心理侧写">
        {Object.entries(summary.psyche || {}).map(([name, item]) => (
          <div key={name} className="rounded-lg bg-white border border-zinc-100 p-3">
            <p className="font-bold text-zinc-800">{name} · 置信度 {Math.round((item.confidence || 0) * 100)}% · {item.mode}</p>
            <p className="mt-1">{item.observation}</p>
            <p className="mt-1 text-zinc-400">依据：{(item.clues || []).join('；')}</p>
          </div>
        ))}
      </Fold>
      <Fold title="全部筹码">
        {(summary.power_chips || []).map((item, idx) => (
          <p key={idx}><span className="font-bold text-zinc-800">{item.owner}</span> · {item.chip} → {item.impact}</p>
        ))}
      </Fold>
      <Fold title="全部转折点">{(summary.risk_inflections || []).map((text) => <p key={text}>{text}</p>)}</Fold>
      <Fold title="各方下一步">
        {Object.entries(summary.next_actions || {}).map(([name, items]) => (
          <p key={name}><span className="font-bold text-zinc-800">{name}：</span>{(items || []).join('；')}</p>
        ))}
      </Fold>
    </div>
  );
}

function RoleRoster({ roles }: { roles: SessionRoleDraft[] }) {
  if (!roles.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {roles.map((role, index) => (
        <div
          key={role.role_id || `${role.name}-${index}`}
          className={`rounded-xl border px-3 py-2 min-w-[140px] ${
            role.is_user ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white border-zinc-100 text-zinc-700'
          }`}
        >
          <div className="flex items-center gap-1.5">
            {role.is_user ? <UserCheck className="w-3 h-3" /> : <Swords className="w-3 h-3 opacity-70" />}
            <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">{role.is_user ? '己方' : '对手'}</span>
            <span className="text-[11px] font-bold">{role.name || '未命名'}</span>
          </div>
          <p className={`text-[10px] mt-1 leading-relaxed ${role.is_user ? 'text-zinc-300' : 'text-zinc-400'}`}>
            {role.position || '职务未填'}{role.stance ? ` · ${role.stance}` : ''}
          </p>
        </div>
      ))}
    </div>
  );
}

function LightSignalRow({ signals, checkpoint }: { signals: string[]; checkpoint?: boolean }) {
  if (!signals.length && !checkpoint) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {checkpoint && (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
          <ShieldAlert className="w-3 h-3" /> 关键分歧
        </span>
      )}
      {signals.map((signal) => (
        <span key={signal} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border ${signalTone(signal)}`}>
          <Radio className="w-3 h-3" /> {signal}
        </span>
      ))}
    </div>
  );
}

function RoundCard({
  round,
  roles,
  highContrast,
  isLatest,
}: {
  round: GameTheorySessionRound;
  roles: SessionRoleDraft[];
  highContrast: boolean;
  isLatest: boolean;
}) {
  return (
    <details
      open={isLatest}
      className={`rounded-2xl border ${isLatest ? 'gsap-entrance border-zinc-200 shadow-[0_6px_18px_rgba(0,0,0,0.03)]' : 'border-zinc-100'}`}
    >
      <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-zinc-700 flex flex-wrap items-center gap-2">
        <span>第 {round.round_no} 轮 · {round.input_source === 'voice' ? '语音' : '文本'}</span>
        {round.need_checkpoint && (
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-50 text-rose-700 border border-rose-100">关键分歧</span>
        )}
        {(round.light_signals || []).length > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-50 text-amber-700 border border-amber-100">
            {round.light_signals.length} 条态势
          </span>
        )}
      </summary>
      <div className="px-4 pb-4 space-y-3">
        <div className="rounded-xl bg-zinc-900 text-white p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
            <UserCheck className="w-3 h-3" /> 己方发言
          </p>
          <p className="text-xs mt-1.5 leading-relaxed">{round.user_input}</p>
        </div>
        <LightSignalRow signals={round.light_signals || []} checkpoint={round.need_checkpoint} />
        {round.need_checkpoint && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] text-rose-800 font-medium">
            本轮出现关键分歧，建议先看清多方关系，再决定继续或生成全景图。
          </div>
        )}
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 ${highContrast ? '[&>div]:bg-zinc-950 [&>div]:text-zinc-50 [&>div]:border-zinc-800' : ''}`}>
          {(round.role_replies || []).map((reply) => {
            const own = isOwnReply(reply, roles);
            return (
              <div
                key={`${round.round_no}-${reply.role_id}`}
                className={`rounded-xl border p-3 ${
                  own
                    ? 'border-zinc-900 bg-zinc-50'
                    : 'border-zinc-100 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold flex items-center gap-1.5">
                    {own ? <UserCheck className="w-3 h-3" /> : <Swords className="w-3 h-3 text-zinc-400" />}
                    {reply.name}
                    <span className="font-medium opacity-50">{reply.style}</span>
                  </p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    own ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'
                  }`}>
                    {own ? '己方' : '对手'}
                  </span>
                </div>
                <p className="text-xs mt-1.5 leading-relaxed">{reply.reply}</p>
                {reply.risk_hint && (
                  <p className="text-[10px] mt-2 text-amber-700 font-medium">提示：{reply.risk_hint}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </details>
  );
}

function SessionActionCard({
  session,
  busy,
  hitLimit,
  checkpointPause,
  canContinue,
  canSummary,
  canReview,
  roundText,
  inputSource,
  isRecording,
  onRoundTextChange,
  onSubmitRound,
  onToggleVoice,
  onPause,
  onResume,
  onStop,
  onSummary,
  onReview,
}: {
  session: GameTheorySessionState;
  busy: string;
  hitLimit: boolean;
  checkpointPause: boolean;
  canContinue: boolean;
  canSummary: boolean;
  canReview: boolean;
  roundText: string;
  inputSource: 'text' | 'voice';
  isRecording: boolean;
  onRoundTextChange: (value: string) => void;
  onSubmitRound: () => void;
  onToggleVoice: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSummary: () => void;
  onReview: () => void;
}) {
  if (session.status === 'active') {
    return (
      <div className="gsap-entrance session-action-card rounded-2xl border border-zinc-200 bg-white p-4 space-y-3 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-zinc-800">当前最关键操作：提交本轮发言</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">用文本或语音表明立场、要价与底线，再发送。</p>
          </div>
          <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">进行中</span>
        </div>
        <textarea
          rows={3}
          value={roundText}
          onChange={(e) => onRoundTextChange(e.target.value)}
          aria-label="本轮发言"
          className="w-full bg-zinc-50/50 border border-zinc-200 rounded-xl p-4 text-xs outline-none resize-none"
          placeholder="输入本轮发言，或用语音转入..."
          disabled={isRecording || busy === 'voice'}
        />
        <p className="text-[10px] font-bold text-zinc-400">
          本轮通道：{inputSource === 'voice' ? '语音（转写后发送）' : '文本'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-label={isRecording ? '停止录音' : '语音输入'}
            onClick={onToggleVoice}
            disabled={!!busy && busy !== 'voice'}
            className={`px-4 py-3 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-2 ${
              isRecording ? 'bg-red-50 text-red-600 border border-red-100' : 'border border-zinc-200 text-zinc-700'
            }`}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {isRecording ? '停止录音' : busy === 'voice' ? '转写中...' : '语音'}
          </button>
          <button
            type="button"
            aria-label="发送本轮"
            onClick={onSubmitRound}
            disabled={!!busy || isRecording || !roundText.trim()}
            className="flex-1 py-3 rounded-xl text-xs font-bold bg-zinc-900 text-white cursor-pointer flex items-center justify-center gap-2 disabled:bg-zinc-100 disabled:text-zinc-400"
          >
            {busy === 'round' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} 发送本轮
          </button>
          <button
            type="button"
            aria-label="暂停会话"
            onClick={onPause}
            disabled={!!busy}
            className="px-4 py-3 rounded-xl text-xs font-bold border border-zinc-200 text-zinc-700 cursor-pointer flex items-center gap-2"
          >
            {busy === 'pause' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-3.5 h-3.5" />} 暂停
          </button>
          <button
            type="button"
            aria-label="停止会话"
            onClick={onStop}
            disabled={!!busy}
            className="px-4 py-3 rounded-xl text-xs font-bold border border-zinc-200 text-zinc-700 cursor-pointer flex items-center gap-2"
          >
            <Square className="w-3.5 h-3.5" /> 结束
          </button>
        </div>
      </div>
    );
  }

  if (session.status === 'failed') {
    return (
      <div className="gsap-entrance session-action-card rounded-2xl border border-red-100 bg-red-50 p-4">
        <p className="text-xs font-bold text-red-800">会话失败</p>
        <p className="text-[11px] text-red-600 mt-1">可新开一局，或从上方恢复可继续的会话。</p>
      </div>
    );
  }

  const needSummary = canSummary && !session.summary;
  const needReview = canReview && !session.review;
  let title = '会话已暂停';
  let hint = '选择下一步：继续对局，或先生成局势全景图。';
  let primary: { label: string; onClick: () => void; busyKey: string; icon: 'play' | 'map' | 'sparkles' } | null = null;
  const secondary: Array<{ label: string; onClick: () => void; busyKey: string }> = [];

  if (hitLimit && needSummary) {
    title = '已达上限';
    hint = '轮次或时长已用尽。当前最关键操作：生成局势全景图。';
    primary = { label: '生成局势全景图', onClick: onSummary, busyKey: 'summary', icon: 'map' };
  } else if (checkpointPause && needSummary) {
    title = '出现关键分歧';
    hint = '本轮触发检查点。生成全景图后将进入复盘，不能再继续对局；若还要交锋，请先点「继续对局」。';
    primary = { label: '生成局势全景图', onClick: onSummary, busyKey: 'summary', icon: 'map' };
    if (canContinue) secondary.push({ label: '继续对局', onClick: onResume, busyKey: 'resume' });
  } else if (needSummary) {
    title = '可以收束了';
    hint = '生成全景图后将进入复盘，不能再继续对局。若还要交锋，请先继续。';
    primary = { label: '生成局势全景图', onClick: onSummary, busyKey: 'summary', icon: 'map' };
    if (canContinue) secondary.push({ label: '继续对局', onClick: onResume, busyKey: 'resume' });
  } else if (needReview) {
    title = '全景已就绪';
    hint = '对局已收束。当前最关键操作：针对己方误判与错过时机生成个人复盘。';
    primary = { label: '生成个人复盘', onClick: onReview, busyKey: 'review', icon: 'sparkles' };
  } else if (session.review) {
    title = '本局复盘完成';
    hint = '关键误判与行动建议已生成。可点右上角「新开」开始下一局。';
  } else if (canContinue) {
    primary = { label: '继续对局', onClick: onResume, busyKey: 'resume', icon: 'play' };
    if (canSummary) secondary.push({ label: '生成局势全景图', onClick: onSummary, busyKey: 'summary' });
  }

  if (!primary && !secondary.length && !session.review) return null;

  return (
    <div className="gsap-entrance session-action-card rounded-2xl border border-zinc-200 bg-white p-4 space-y-3 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-zinc-800">{title}</p>
          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{hint}</p>
        </div>
        <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full bg-zinc-100 text-zinc-600">
          {STATUS_LABEL[session.status] || session.status}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {primary && (
          <button
            type="button"
            aria-label={primary.label}
            onClick={primary.onClick}
            disabled={!!busy}
            className="flex-1 min-w-[160px] py-3 rounded-xl text-xs font-bold bg-zinc-900 text-white cursor-pointer flex items-center justify-center gap-2 disabled:bg-zinc-100 disabled:text-zinc-400"
          >
            {busy === primary.busyKey ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              primary.icon === 'map' ? <Map className="w-4 h-4" /> : primary.icon === 'sparkles' ? <Sparkles className="w-4 h-4" /> : <Play className="w-4 h-4" />
            )}
            {primary.label}
          </button>
        )}
        {secondary.map((item) => (
          <button
            key={item.label}
            type="button"
            aria-label={item.label}
            onClick={item.onClick}
            disabled={!!busy}
            className="px-4 py-3 rounded-xl text-xs font-bold border border-zinc-200 text-zinc-700 cursor-pointer flex items-center gap-2"
          >
            {busy === item.busyKey ? <Loader2 className="w-4 h-4 animate-spin" /> : item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReviewView({ review }: { review: GameTheoryPersonalReview }) {
  const firstGuide = review.strategy_guidance?.[0];
  const missed = review.missed_moments?.[0];
  return (
    <div className="space-y-3">
      {(firstGuide || missed) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {firstGuide && (
            <div className="gsap-entrance rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">优先建议</p>
              <p className="text-xs font-bold text-emerald-950 mt-2 leading-relaxed">{firstGuide}</p>
            </div>
          )}
          {missed && (
            <div className="gsap-entrance rounded-2xl bg-amber-50 border border-amber-100 p-4">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">错过的时机</p>
              <p className="text-xs font-bold text-amber-950 mt-2 leading-relaxed">R{missed.round_no} · {missed.issue}</p>
            </div>
          )}
        </div>
      )}
      {(review.tone_corrections?.length ?? 0) > 0 && (
        <ToneCorrectionTable
          items={review.tone_corrections || []}
          repaired={Boolean(review.tone_corrections_repaired)}
        />
      )}
      <Fold title="误判" defaultOpen>
        {(review.missteps || []).map((item, idx) => {
          const row = asReviewItem(item);
          return (
            <div key={idx} className="rounded-lg bg-white border border-zinc-100 p-3">
              <p className="font-bold text-zinc-800">{row.claim}</p>
              {row.evidence && <p className="mt-1 text-zinc-400">依据：{row.evidence}</p>}
              {row.explanation && <p className="mt-1">{row.explanation}</p>}
              {row.confidence != null && <p className="mt-1 text-zinc-400">置信度 {Math.round(row.confidence * 100)}%</p>}
            </div>
          );
        })}
      </Fold>
      <Fold title="打出过效果的动作">
        {(review.strengths || []).map((item, idx) => {
          const row = asReviewItem(item);
          return <p key={idx}>{row.claim}{row.evidence ? `（${row.evidence}）` : ''}</p>;
        })}
      </Fold>
      <Fold title="错过的时机" defaultOpen>
        {(review.missed_moments || []).map((item, idx) => (
          <div key={idx} className="rounded-lg bg-white border border-zinc-100 p-3">
            <p className="font-bold text-zinc-800">R{item.round_no} · {item.issue}</p>
            <p className="mt-1">为何错过：{item.why}</p>
            <p className="mt-1">下次替代：{item.avoid_action}</p>
            {item.evidence && <p className="mt-1 text-zinc-400">依据：{item.evidence}</p>}
          </div>
        ))}
      </Fold>
      <Fold title="行动建议" defaultOpen>
        {(review.strategy_guidance || []).map((text) => <p key={text}>{text}</p>)}
      </Fold>
    </div>
  );
}

export default function GameTheorySessionPanel() {
  const [session, setSession] = useState<GameTheorySessionState | null>(null);
  const [recoverable, setRecoverable] = useState<GameTheorySessionState[]>([]);
  const [title, setTitle] = useState('跨部门预算谈判');
  const [sceneType, setSceneType] = useState<SessionSceneType>('corp_clash');
  const [gameModel, setGameModel] = useState<SessionGameModel>('pig_game');
  const [sourceType, setSourceType] = useState<SessionSourceType>('guided_simulation');
  const [psycheMode, setPsycheMode] = useState<SessionPsychologyMode>('evidence_bound');
  const [scenario, setScenario] = useState('跨部门预算谈判：业务线要求追加项目预算，财务要守住年度红线，法务担心合规口径被绑架。');
  const [roleCount, setRoleCount] = useState(4);
  const [maxRounds, setMaxRounds] = useState(12);
  const [maxMinutes, setMaxMinutes] = useState(30);
  const [roles, setRoles] = useState<SessionRoleDraft[]>([]);
  const [roundText, setRoundText] = useState('');
  const [inputSource, setInputSource] = useState<'text' | 'voice'>('text');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [highContrast, setHighContrast] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [liveElapsedMs, setLiveElapsedMs] = useState(0);
  const [isWorkshopOpen, setIsWorkshopOpen] = useState(false);
  const autoStopRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const playScopeRef = useRef<HTMLDivElement>(null);

  const handleImportDraftToSession = (draft: ScriptWorkshopDraft) => {
    setTitle(draft.sceneTitle.replace(/[《》]/g, ''));
    setScenario(
      `${draft.sceneSummary}\n\n【4阶段博弈标准设定】\n` +
      draft.characters.map(c => `• ${c.name}（${c.roleTitle}）：诉求[${c.surfaceGoal}]；底牌[${c.hiddenMotive}]；红线[${c.redLine}]`).join('\n')
    );
    setRoleCount(draft.characters.length);
    setMaxRounds(16);
    setMaxMinutes(10);
    const newRoles: SessionRoleDraft[] = draft.characters.map((c, i) => ({
      role_id: `role-${i + 1}`,
      name: c.name,
      position: c.roleTitle,
      hierarchy_level: (i === 0 ? 'executive' : 'middle') as SessionHierarchy,
      stance: c.surfaceGoal,
      interest: `${c.hiddenMotive}；红线：${c.redLine}`,
      hidden_motive: c.hiddenMotive,
      is_user: i === 0,
    }));
    setRoles(newRoles);
    playPageTurn();
  };

  const loadRecoverable = useCallback(async () => {
    try {
      const items = await listGameTheorySessions();
      setRecoverable(items);
      return items;
    } catch (_) {
      setRecoverable([]);
      return [];
    }
  }, []);

  const restoreSession = useCallback(async (sessionId: string) => {
    const fresh = await getGameTheorySession(sessionId);
    applySession(fresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const items = await loadRecoverable();
      if (cancelled) return;
      const latest = pickResumableSession(items);
      if (!latest) return;
      try {
        const fresh = await getGameTheorySession(latest.session_id);
        if (cancelled) return;
        applySession(fresh);
      } catch (_) {
        if (!cancelled) applySession(latest);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRecoverable]);

  useEffect(() => {
    if (sourceType === 'real_record') setPsycheMode('evidence_bound');
  }, [sourceType]);

  const applySession = (next: GameTheorySessionState) => {
    setSession(next);
    setRoles(next.roles || []);
    setLiveElapsedMs(next.elapsed_ms ?? next.elapsed_minutes * 60000);
    if (next.limit_hit === 'max_rounds') setError(`已达 ${next.max_rounds} 轮上限，请生成局势全景图`);
    if (next.limit_hit === 'max_minutes') setError(`已达 ${next.max_minutes} 分钟上限，请生成局势全景图`);
  };

  const handleGenerateRoles = async () => {
    if (!scenario.trim()) {
      playGentleWarning();
      setError('请先填写场景描述');
      return;
    }
    setBusy('generate');
    setError('');
    playClick();
    try {
      const next = await startGameTheorySession({
        title: title.trim() || scenario.trim().slice(0, 40),
        scene_type: sceneType,
        game_model: gameModel,
        source_type: sourceType,
        psyche_mode: sourceType === 'real_record' ? 'evidence_bound' : psycheMode,
        channel: 'mixed',
        scenario: scenario.trim(),
        role_count: roleCount,
        max_rounds: maxRounds,
        max_minutes: maxMinutes,
        auto_roles: true,
        activate: false,
      });
      applySession(next);
      playPageTurn();
      await loadRecoverable();
    } catch (err) {
      catchSession(err, applySession, setError);
    } finally {
      setBusy('');
    }
  };

  const handleSaveRoles = async () => {
    if (!session) return;
    setBusy('roles');
    setError('');
    playClick();
    try {
      const sorted = [...roles].sort((a, b) => Number(!!b.is_user) - Number(!!a.is_user));
      const next = await updateGameTheorySessionRoles(session.session_id, sorted);
      applySession(next);
      playPageTurn();
    } catch (err) {
      catchSession(err, applySession, setError);
    } finally {
      setBusy('');
    }
  };

  const handleControl = async (action: 'start' | 'pause' | 'resume' | 'stop', reason?: string) => {
    if (!session) return;
    setBusy(action);
    setError('');
    playClick();
    try {
      if (action === 'start' && session.status === 'draft' && roles.length >= 2) {
        const sorted = [...roles].sort((a, b) => Number(!!b.is_user) - Number(!!a.is_user));
        await updateGameTheorySessionRoles(session.session_id, sorted);
      }
      const next = await controlGameTheorySession(
        session.session_id,
        action,
        action === 'stop' ? (reason || 'user_stop') : undefined
      );
      applySession(next);
      playPageTurn();
    } catch (err) {
      catchSession(err, applySession, setError);
    } finally {
      setBusy('');
    }
  };

  useEffect(() => {
    if (!session || session.status !== 'active') return undefined;
    autoStopRef.current = false;
    const base = Number(session.elapsed_ms ?? session.elapsed_minutes * 60000);
    const origin = Date.now();
    const tick = () => {
      const live = base + (Date.now() - origin);
      setLiveElapsedMs(live);
      if (live >= session.max_minutes * 60 * 1000 && !autoStopRef.current) {
        autoStopRef.current = true;
        void controlGameTheorySession(session.session_id, 'stop', 'max_minutes')
          .then((next) => {
            applySession(next);
            playGentleWarning();
          })
          .catch((err) => catchSession(err, applySession, setError));
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [session?.session_id, session?.status, session?.elapsed_ms, session?.max_minutes]);

  const handleSubmitRound = async () => {
    if (!session || !roundText.trim()) {
      playGentleWarning();
      return;
    }
    setBusy('round');
    setError('');
    playClick();
    try {
      const result = await submitGameTheorySessionRound(session.session_id, {
        text: roundText.trim(),
        source: inputSource,
      });
      applySession(result.session);
      setRoundText('');
      setInputSource('text');
      playPageTurn();
    } catch (err) {
      catchSession(err, applySession, setError);
    } finally {
      setBusy('');
    }
  };

  const stopRecordingTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setIsRecording(false);
  };

  const handleToggleVoice = async () => {
    if (isRecording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stopRecordingTracks();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) {
          setError('没有录到声音，请再试一次');
          playGentleWarning();
          return;
        }
        setBusy('voice');
        try {
          const text = await transcribeAudioWithWhisper(blob);
          if (!text) {
            setError('未识别到有效语音，请再说一遍或改用文本');
            playGentleWarning();
            return;
          }
          setRoundText(text);
          setInputSource('voice');
        } catch (err) {
          setError(err instanceof Error ? err.message : '语音转写失败');
          playGentleWarning();
        } finally {
          setBusy('');
        }
      };
      recorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
      playClick();
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法打开麦克风');
      playGentleWarning();
    }
  };

  const handleSummary = async () => {
    if (!session) return;
    setBusy('summary');
    setError('');
    playClick();
    try {
      const result = await generateGameTheorySessionSummary(session.session_id);
      applySession(result.session);
      playPageTurn();
    } catch (err) {
      catchSession(err, applySession, setError);
    } finally {
      setBusy('');
    }
  };

  const handleReview = async () => {
    if (!session) return;
    setBusy('review');
    setError('');
    playClick();
    try {
      const result = await generateGameTheoryPersonalReview(session.session_id);
      applySession(result.session);
      playPageTurn();
    } catch (err) {
      catchSession(err, applySession, setError);
    } finally {
      setBusy('');
    }
  };

  const lastRound = session?.rounds?.[session.rounds.length - 1];
  const hitLimit = Boolean(session?.limit_hit);
  const checkpointPause = Boolean(session?.status === 'paused' && lastRound?.need_checkpoint && !hitLimit);
  const canContinue = session?.status === 'paused' && (session.phase || 'play') === 'play' && !hitLimit;
  const canSummary = Boolean(session && session.status !== 'draft' && session.status !== 'failed' && (session.phase || 'play') !== 'review_done');
  const canReview = session?.phase === 'summary_ready' || !!session?.summary;
  const userRole = userRoleOf(session?.roles || roles);

  useGSAP(() => {
    const root = playScopeRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll('.gsap-entrance');
    if (!nodes.length) return;
    gsap.fromTo(
      nodes,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.42, stagger: 0.08, ease: 'power2.out', overwrite: 'auto' }
    );
  }, { scope: playScopeRef, dependencies: [session?.status, session?.current_round, session?.phase, !!session?.summary, !!session?.review] });

  return (
    <div className="space-y-6">
      {/* 8-10分钟多人博弈剧本工坊 & 质量校验入口 */}
      <div className="bg-gradient-to-r from-slate-900 via-zinc-800 to-slate-900 rounded-2xl p-4 text-white flex flex-wrap items-center justify-between gap-4 border border-zinc-700 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">8–10 分钟多人高强度博弈剧本生产工坊</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400 text-slate-950 uppercase">
                SOP 创作与 AI 审稿
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              严格把控 2100–2600 字可控时长、四阶段 2:3:4:1 节奏波峰与契诃夫之枪因果闭环
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            playClick();
            setIsWorkshopOpen(true);
          }}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md hover:shadow-lg transition cursor-pointer flex items-center gap-1.5 active:scale-95"
        >
          <Sparkles className="w-4 h-4" />
          打开剧本生产与质量校验工坊
        </button>
      </div>

      <ScriptWorkshopDrawer
        isOpen={isWorkshopOpen}
        onClose={() => setIsWorkshopOpen(false)}
        onImportToSession={handleImportDraftToSession}
      />
      {recoverable.length > 0 && !session && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block">可恢复会话</span>
          {recoverable.slice(0, 3).map((item) => (
            <button
              key={item.session_id}
              type="button"
              aria-label={`恢复会话 ${item.title}`}
              onClick={() => { playClick(); void restoreSession(item.session_id).catch((err) => catchSession(err, applySession, setError)); }}
              className="w-full text-left rounded-xl border border-zinc-100 px-4 py-3 hover:bg-zinc-50 cursor-pointer"
            >
              <p className="text-xs font-bold text-zinc-800">{item.title}</p>
              <p className="text-[10px] text-zinc-400 mt-1">
                {STATUS_LABEL[item.status]} · 第 {item.current_round} 轮 · 已用 {item.elapsed_minutes} 分钟
              </p>
            </button>
          ))}
        </div>
      )}

      {session && (
        <StatusBar
          session={session}
          highContrast={highContrast}
          liveElapsedMs={liveElapsedMs}
          onToggleContrast={() => setHighContrast((v) => !v)}
        />
      )}

      {session?.limit_hit && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          {session.limit_hit === 'max_rounds'
            ? `已达 ${session.max_rounds} 轮上限，会话已暂停。请生成局势全景图。`
            : `已达 ${session.max_minutes} 分钟上限，会话已暂停。请生成局势全景图。`}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p>{error}</p>
            <p className="mt-1 text-red-500">接口失败时可重试；刷新后可从上方恢复进行中的会话。</p>
          </div>
        </div>
      )}

      {(!session || session.status === 'draft') && (
        <div className="grid grid-cols-1 md:grid-cols-10 gap-6 items-start">
          {!session && (
            <div className="md:col-span-10 bg-white rounded-2xl border border-slate-100 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <SessionPhaseStepper session={null} />
              <p className="text-[11px] font-bold text-zinc-800">下一步：填写场景并生成角色</p>
            </div>
          )}
          <div className="md:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_6px_20px_rgba(0,0,0,0.015)] space-y-4">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block">会话配置</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label="会话标题"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                placeholder="会话标题"
              />
              <div className="space-y-1.5">
                {SCENE_OPTIONS.map((env) => (
                  <button
                    key={env.id}
                    type="button"
                    onClick={() => { playClick(); setSceneType(env.id); }}
                    className={`w-full text-left py-2.5 px-4 text-xs font-bold rounded-xl cursor-pointer ${
                      sceneType === env.id ? 'bg-zinc-900 text-white' : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    {env.name}
                  </button>
                ))}
              </div>
              <select
                aria-label="博弈模型"
                value={gameModel}
                onChange={(e) => setGameModel(e.target.value as SessionGameModel)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
              >
                {MODEL_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select
                aria-label="来源类型"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as SessionSourceType)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="guided_simulation">模拟推演</option>
                <option value="real_record">真实记录</option>
              </select>
              <select
                aria-label="心理侧写模式"
                value={psycheMode}
                disabled={sourceType === 'real_record'}
                onChange={(e) => setPsycheMode(e.target.value as SessionPsychologyMode)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold outline-none disabled:text-zinc-400"
              >
                <option value="evidence_bound">证据约束</option>
                <option value="assertive">强结论（仅模拟）</option>
              </select>
              <label className="text-[10px] text-zinc-500 font-bold block">角色数 {roleCount}</label>
              <input type="range" min={2} max={5} value={roleCount} onChange={(e) => setRoleCount(Number(e.target.value))} className="w-full" />
              <label className="text-[10px] text-zinc-500 font-bold block">上限 {maxRounds} 轮 / {maxMinutes} 分钟</label>
              <input type="range" min={1} max={12} value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value))} className="w-full" />
              <input type="range" min={1} max={30} value={maxMinutes} onChange={(e) => setMaxMinutes(Number(e.target.value))} className="w-full" />
            </div>
          </div>

          <div className="md:col-span-7 space-y-4">
            <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-100 shadow-[0_12px_35px_rgba(0,0,0,0.02)] space-y-4">
              <h4 className="font-bold text-sm text-zinc-800 flex items-center gap-2">
                <Users className="w-4 h-4" /> 场景与角色
              </h4>
              <textarea
                rows={4}
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                aria-label="场景描述"
                className="w-full bg-zinc-50/50 border border-zinc-200 rounded-xl p-4 text-xs outline-none resize-none leading-relaxed font-medium"
                placeholder="填写多人博弈场景..."
              />
              <button
                type="button"
                aria-label="生成角色"
                onClick={() => void handleGenerateRoles()}
                disabled={!!busy}
                className="w-full py-3 rounded-xl text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-400 cursor-pointer flex items-center justify-center gap-2"
              >
                {busy === 'generate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {session ? '重新生成角色' : 'AI 生成角色'}
              </button>

              {roles.length > 0 && (
                <div className="space-y-3">
                  {roles.map((role, index) => (
                    <div key={role.role_id || index} className="rounded-2xl border border-zinc-100 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setRoles((prev) => prev.map((item, idx) => ({ ...item, is_user: idx === index })))}
                          className={`text-[10px] font-bold px-2 py-1 rounded-full cursor-pointer ${role.is_user ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'}`}
                        >
                          {role.is_user ? '己方' : '设为己方'}
                        </button>
                        {roles.length > 2 && (
                          <button
                            type="button"
                            aria-label={`删除角色 ${role.name}`}
                            onClick={() => setRoles((prev) => prev.filter((_, idx) => idx !== index))}
                            className="text-zinc-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={role.name} onChange={(e) => setRoles((prev) => prev.map((item, idx) => idx === index ? { ...item, name: e.target.value } : item))} className="bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 text-xs" placeholder="姓名" />
                        <input value={role.position} onChange={(e) => setRoles((prev) => prev.map((item, idx) => idx === index ? { ...item, position: e.target.value } : item))} className="bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 text-xs" placeholder="职务" />
                      </div>
                      <select
                        value={role.hierarchy_level}
                        onChange={(e) => setRoles((prev) => prev.map((item, idx) => idx === index ? { ...item, hierarchy_level: e.target.value as SessionHierarchy } : item))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 text-xs"
                      >
                        {HIERARCHY_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                      <input value={role.stance} onChange={(e) => setRoles((prev) => prev.map((item, idx) => idx === index ? { ...item, stance: e.target.value } : item))} className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 text-xs" placeholder="公开立场" />
                      <input value={role.interest} onChange={(e) => setRoles((prev) => prev.map((item, idx) => idx === index ? { ...item, interest: e.target.value } : item))} className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 text-xs" placeholder="核心利益" />
                      <input value={role.hidden_motive || ''} onChange={(e) => setRoles((prev) => prev.map((item, idx) => idx === index ? { ...item, hidden_motive: e.target.value } : item))} className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 text-xs" placeholder="潜在动机（可改）" />
                    </div>
                  ))}
                  {roles.length < 5 && (
                    <button
                      type="button"
                      onClick={() => setRoles((prev) => [...prev, { name: '', position: '', hierarchy_level: 'peer', stance: '', interest: '', is_user: false }])}
                      className="text-[11px] font-bold text-zinc-500 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> 增加角色
                    </button>
                  )}
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-600">
                    下一步：点角色卡上的「己方」确认你扮演谁，然后点「开始」。
                  </div>
                  <div className="flex gap-2">
                    <button type="button" aria-label="保存角色" onClick={() => void handleSaveRoles()} disabled={!!busy} className="flex-1 py-3 rounded-xl text-xs font-bold border border-zinc-200 text-zinc-700 hover:bg-zinc-50 cursor-pointer">保存角色</button>
                    <button type="button" aria-label="开始会话" onClick={() => void handleControl('start')} disabled={!!busy} className="flex-1 py-3 rounded-xl text-xs font-bold bg-zinc-900 text-white cursor-pointer flex items-center justify-center gap-2">
                      {busy === 'start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} 开始
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {session && session.status !== 'draft' && (
        <div ref={playScopeRef} className="bg-white rounded-3xl p-5 md:p-6 border border-slate-100 shadow-[0_12px_35px_rgba(0,0,0,0.02)] space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-zinc-800">多人群体博弈会话</h4>
            <button type="button" aria-label="新开会话" onClick={() => { playClick(); setSession(null); setError(''); void loadRecoverable(); }} className="text-[10px] font-bold text-zinc-500 flex items-center gap-1 cursor-pointer">
              <RotateCcw className="w-3 h-3" /> 新开
            </button>
          </div>

          <RoleRoster roles={session.roles || roles} />

          {(session.last_round_summary || checkpointPause) && (
            <div className={`gsap-entrance rounded-2xl border px-4 py-3 text-xs ${
              checkpointPause ? 'border-rose-100 bg-rose-50 text-rose-800' : 'border-amber-100 bg-amber-50 text-amber-800'
            }`}>
              <p className="font-bold flex items-center gap-1.5">
                {checkpointPause ? <ShieldAlert className="w-3.5 h-3.5" /> : <Radio className="w-3.5 h-3.5" />}
                {checkpointPause ? '关键分歧检查点' : '最新态势'}
              </p>
              <p className="mt-1 leading-relaxed">{session.last_round_summary || lastRound?.light_signals?.[0] || '本轮出现需要停下来看清关系的分歧。'}</p>
            </div>
          )}

          <div className="sticky bottom-3 z-20 bg-white/95 backdrop-blur-sm rounded-2xl">
            <SessionActionCard
              session={session}
              busy={busy}
              hitLimit={hitLimit}
              checkpointPause={checkpointPause}
              canContinue={canContinue}
              canSummary={canSummary}
              canReview={!!canReview}
              roundText={roundText}
              inputSource={inputSource}
              isRecording={isRecording}
              onRoundTextChange={(value) => {
                setRoundText(value);
                if (inputSource === 'voice') return;
                setInputSource('text');
              }}
              onSubmitRound={() => void handleSubmitRound()}
              onToggleVoice={() => void handleToggleVoice()}
              onPause={() => void handleControl('pause')}
              onResume={() => void handleControl('resume')}
              onStop={() => void handleControl('stop')}
              onSummary={() => void handleSummary()}
              onReview={() => void handleReview()}
            />
          </div>

          {session.summary && (
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                <Map className="w-3.5 h-3.5" /> 局势全景图
              </h5>
              <SummaryView summary={session.summary} userName={userRole?.name} />
            </div>
          )}
          {session.review && (
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-zinc-800">个人复盘</h5>
              <ReviewView review={session.review} />
            </div>
          )}

          <div className="space-y-3">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">回合记录</p>
            {(session.rounds || []).length === 0 && (
              <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-6 text-center text-xs text-zinc-400">
                还没有回合。在上方主操作卡提交第一轮发言，各方会立刻回应。
              </div>
            )}
            {(session.rounds || []).map((round) => (
              <RoundCard
                key={round.round_no}
                round={round}
                roles={session.roles || roles}
                highContrast={highContrast}
                isLatest={round.round_no === lastRound?.round_no}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
