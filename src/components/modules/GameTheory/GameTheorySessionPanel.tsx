import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Users,
} from 'lucide-react';
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
  type GameTheorySessionState,
  type GameTheorySituationSummary,
  type SessionGameModel,
  type SessionHierarchy,
  type SessionPsychologyMode,
  type SessionRoleDraft,
  type SessionSceneType,
  type SessionSourceType,
} from './GameTheorySessionTypes';

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
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_15px_rgba(0,0,0,0.02)] p-4 flex flex-wrap items-center gap-3 justify-between">
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

function SummaryView({ summary }: { summary: GameTheorySituationSummary }) {
  return (
    <div className="space-y-2">
      <Fold title="阶层" defaultOpen>{summary.hierarchy?.join(' → ') || '暂无'}</Fold>
      <Fold title="立场" defaultOpen>
        {Object.entries(summary.stance || {}).map(([name, text]) => (
          <p key={name}><span className="font-bold text-zinc-800">{name}：</span>{text}</p>
        ))}
      </Fold>
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
      <Fold title="联盟">
        {(summary.alliances || []).map((item, idx) => (
          <p key={idx}>{(item.parties || []).join(' / ')}：{item.reason}</p>
        ))}
      </Fold>
      <Fold title="筹码">
        {(summary.power_chips || []).map((item, idx) => (
          <p key={idx}><span className="font-bold text-zinc-800">{item.owner}</span> · {item.chip} → {item.impact}</p>
        ))}
      </Fold>
      <Fold title="转折点">{(summary.risk_inflections || []).map((text) => <p key={text}>{text}</p>)}</Fold>
      <Fold title="下一步动作">
        {Object.entries(summary.next_actions || {}).map(([name, items]) => (
          <p key={name}><span className="font-bold text-zinc-800">{name}：</span>{(items || []).join('；')}</p>
        ))}
      </Fold>
      <Fold title="局势反制" defaultOpen>{(summary.countermeasures || []).map((text) => <p key={text}>{text}</p>)}</Fold>
    </div>
  );
}

function ReviewView({ review }: { review: GameTheoryPersonalReview }) {
  return (
    <div className="space-y-2">
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
  const autoStopRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

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
  const canContinue = session?.status === 'paused' && (session.phase || 'play') === 'play' && !hitLimit;
  const canSummary = session && session.status !== 'draft' && session.status !== 'failed' && (session.phase || 'play') !== 'review_done';
  const canReview = session?.phase === 'summary_ready' || !!session?.summary;

  return (
    <div className="space-y-6">
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
        <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-100 shadow-[0_12px_35px_rgba(0,0,0,0.02)] space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-zinc-800">多人群体博弈会话</h4>
            <button type="button" aria-label="新开会话" onClick={() => { playClick(); setSession(null); setError(''); void loadRecoverable(); }} className="text-[10px] font-bold text-zinc-500 flex items-center gap-1 cursor-pointer">
              <RotateCcw className="w-3 h-3" /> 新开
            </button>
          </div>

          <div className="space-y-3">
            {(session.rounds || []).map((round) => (
              <details key={round.round_no} open={round.round_no === lastRound?.round_no} className="rounded-2xl border border-zinc-100">
                <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-zinc-700">第 {round.round_no} 轮 · {round.input_source === 'voice' ? '语音' : '文本'}</summary>
                <div className="px-4 pb-4 space-y-2">
                  <p className="text-xs text-zinc-500">你：{round.user_input}</p>
                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 ${highContrast ? '[&>div]:bg-zinc-950 [&>div]:text-zinc-50' : ''}`}>
                    {(round.role_replies || []).map((reply) => (
                      <div key={`${round.round_no}-${reply.role_id}`} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                        <p className="text-[11px] font-bold">{reply.name}<span className="ml-2 font-medium opacity-60">{reply.style}</span></p>
                        <p className="text-xs mt-1 leading-relaxed">{reply.reply}</p>
                        {reply.risk_hint && <p className="text-[10px] mt-2 opacity-70">提示：{reply.risk_hint}</p>}
                      </div>
                    ))}
                  </div>
                  {(round.light_signals || []).length > 0 && (
                    <p className="text-[11px] text-zinc-500">轻量提示：{round.light_signals.join('；')}</p>
                  )}
                </div>
              </details>
            ))}
          </div>

          {session.status === 'active' && (
            <div className="space-y-3">
              <textarea
                rows={3}
                value={roundText}
                onChange={(e) => {
                  setRoundText(e.target.value);
                  if (inputSource === 'voice') return;
                  setInputSource('text');
                }}
                aria-label="本轮发言"
                className="w-full bg-zinc-50/50 border border-zinc-200 rounded-xl p-4 text-xs outline-none resize-none"
                placeholder="输入本轮发言，或用语音转入..."
                disabled={isRecording || busy === 'voice'}
              />
              <p className="text-[10px] font-bold text-zinc-400">
                本轮通道：{inputSource === 'voice' ? '语音（转写后发送）' : '文本'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" aria-label={isRecording ? '停止录音' : '语音输入'} onClick={() => void handleToggleVoice()} disabled={!!busy && busy !== 'voice'} className={`px-4 py-3 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-2 ${isRecording ? 'bg-red-50 text-red-600 border border-red-100' : 'border border-zinc-200 text-zinc-700'}`}>
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {isRecording ? '停止录音' : busy === 'voice' ? '转写中...' : '语音'}
                </button>
                <button type="button" aria-label="发送本轮" onClick={() => void handleSubmitRound()} disabled={!!busy || isRecording || !roundText.trim()} className="flex-1 py-3 rounded-xl text-xs font-bold bg-zinc-900 text-white cursor-pointer flex items-center justify-center gap-2 disabled:bg-zinc-100 disabled:text-zinc-400">
                  {busy === 'round' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} 发送本轮
                </button>
                <button type="button" aria-label="停止会话" onClick={() => void handleControl('stop')} disabled={!!busy} className="px-4 py-3 rounded-xl text-xs font-bold border border-zinc-200 text-zinc-700 cursor-pointer flex items-center gap-2">
                  <Square className="w-3.5 h-3.5" /> 停止
                </button>
              </div>
            </div>
          )}

          {session.status === 'paused' && (
            <div className="flex flex-wrap gap-2">
              {canContinue && (
                <button type="button" aria-label="继续会话" onClick={() => void handleControl('resume')} disabled={!!busy} className="px-4 py-3 rounded-xl text-xs font-bold border border-zinc-200 text-zinc-700 cursor-pointer flex items-center gap-2">
                  {busy === 'resume' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} 继续
                </button>
              )}
              {canSummary && !session.summary && (
                <button type="button" aria-label="生成局势全景图" onClick={() => void handleSummary()} disabled={!!busy} className="px-4 py-3 rounded-xl text-xs font-bold bg-zinc-900 text-white cursor-pointer flex items-center gap-2">
                  {busy === 'summary' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />} 生成局势全景图
                </button>
              )}
              {canReview && (
                <button type="button" aria-label="生成个人复盘" onClick={() => void handleReview()} disabled={!!busy} className="px-4 py-3 rounded-xl text-xs font-bold bg-zinc-900 text-white cursor-pointer flex items-center gap-2">
                  {busy === 'review' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} 生成个人复盘
                </button>
              )}
            </div>
          )}

          {session.summary && (
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-zinc-800">局势全景图</h5>
              <SummaryView summary={session.summary} />
            </div>
          )}
          {session.review && (
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-zinc-800">个人复盘</h5>
              <ReviewView review={session.review} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
