import React from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Globe,
  Mic,
  MicOff,
  PenTool,
  Send,
  ShieldAlert,
  Star,
  Target,
  Trophy,
} from 'lucide-react';
import SpeakButton from '../SpeakButton';
import OralWarRoomImprovTimer from './OralWarRoomImprovTimer';
import OralWarRoomThemeProgress from './OralWarRoomThemeProgress';
import OralWarRoomControlCard from './OralWarRoomControlCard';
import OralWarRoomRoleSwitcher from './OralWarRoomRoleSwitcher';
import type { ParsedAiResponse } from '../../services/difyAPI';
import { playReveal } from '../../utils/soundEffects';
import type { ExpressionReview } from './oralWarRoom/expressionReview';
import {
  safeText,
  parseBranchList,
  getSpeakerStyle,
  SPEAKER_STYLE_CLASS,
  renderStars,
  roleNameMatches,
} from './oralWarRoom/utils';
import type {
  SceneEntry,
  MessageItem,
  LatestExchange,
  RoleSwitcherRole,
  WeaknessLogEntry,
} from './oralWarRoom/types';

export interface OralWarRoomChatProps {
  isContextPanelOpen: boolean;
  setIsContextPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  improvElapsed: number;
  improvActive: boolean;
  setImprovElapsed: React.Dispatch<React.SetStateAction<number>>;
  setImprovActive: React.Dispatch<React.SetStateAction<boolean>>;
  setShowConfetti: React.Dispatch<React.SetStateAction<boolean>>;
  onNavigateWrite?: () => void;
  isSending: boolean;
  messages: MessageItem[];
  briefCollapsed: boolean;
  setBriefCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  showIntelDetails: boolean;
  setShowIntelDetails: React.Dispatch<React.SetStateAction<boolean>>;
  showGoldGlow: boolean;
  combatPoints: number;
  writeCompleted: boolean;
  activeScene: SceneEntry;
  currentDifficulty: number | null;
  latestExchange: LatestExchange;
  handleDialogueMouseUp: () => void;
  weaknessLog: WeaknessLogEntry[];
  bottomRef: React.RefObject<HTMLDivElement | null>;
  latestFeedback: ParsedAiResponse | null;
  feedbackExpanded: boolean;
  setFeedbackExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  lastNotice: string;
  isLoopholePlanted: boolean;
  currentFlawType: string;
  currentFlawClaim: string;
  flawTemplates: string[];
  showControlCard: boolean;
  setShowControlCard: React.Dispatch<React.SetStateAction<boolean>>;
  setIsInputLocked: React.Dispatch<React.SetStateAction<boolean>>;
  sceneRoleSwitcherItems: RoleSwitcherRole[];
  currentTarget: string;
  handleTargetChange: (roleName: string) => void;
  isRecording: boolean;
  recordingTime: number;
  inputText: string;
  handleSend: () => void;
  isInputLocked: boolean;
  speechSupported: boolean;
  speechChecked: boolean;
  micError: string | null;
  startRecording: () => void;
  stopRecordingAndSend: () => void;
  showNegotiationControls?: boolean;
  showDailyExpressionDebrief?: boolean;
  onEndDailyExpressionReview?: () => void;
  expressionReview?: ExpressionReview | null;
  expressionReviewStatus?: 'idle' | 'loading' | 'ready' | 'error';
  expressionReviewError?: string | null;
}

interface ChatMessageBubbleProps {
  msg: any;
  isFirstAiOpening: boolean;
  activeScene: any;
  showIntelDetails: boolean;
  setInputText: (text: string) => void;
  handleDialogueMouseUp?: () => void;
}

const ChatMessageBubble = React.memo(function ChatMessageBubble({
  msg,
  isFirstAiOpening,
  activeScene,
  showIntelDetails,
  setInputText,
  handleDialogueMouseUp
}: ChatMessageBubbleProps) {
  const branches = msg.parsed ? parseBranchList(msg.parsed.branch_suggestions) : [];
  const roleAddr = msg.parsed ? safeText(msg.parsed.role_address) : '';
  const jointP = msg.parsed ? safeText(msg.parsed.joint_pressure) : '';

  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} transform-gpu`}>
      {msg.role === 'user' ? (
        <div className="max-w-[88%]">
          <div className="rounded-2xl rounded-tr-sm bg-[var(--color-brand)] text-white px-3 py-2 shadow-[var(--shadow-sm)]">
            <p className="text-sm leading-relaxed">{msg.content}</p>
          </div>
          {msg.feedback && (
            <div className="mt-1.5 mr-1 flex items-center gap-3 justify-end">
              {[
                { label: '逻辑', score: msg.feedback.logicScore, color: 'text-blue-500' },
                { label: '文化', score: msg.feedback.culturalScore, color: 'text-purple-500' },
                { label: '流畅', score: msg.feedback.fluencyScore, color: 'text-emerald-500' },
              ].map(({ label, score, color }) => (
                <div key={label} className="flex items-center gap-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-[var(--color-ink-muted)]">{label}</span>
                  <span className={`text-[9px] font-black ${color}`}>{score}/10</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          data-message-id={msg.id}
          data-ai-message="true"
          className={`w-full max-w-[92%] rounded-2xl rounded-tl-sm bg-white border px-3 py-2 shadow-[var(--shadow-sm)] ${
          isFirstAiOpening ? 'border-[var(--color-accent)]/40 ring-1 ring-[var(--color-accent)]/20' : 'border-[var(--color-border)]'
        }`}>
          {msg.parsed ? (
            <>
              {isFirstAiOpening && (
                <span className="inline-block mb-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-[#FF5722]/10 text-[#FF5722]">
                  对话启动句
                </span>
              )}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {(() => {
                  const speaker = safeText(msg.parsed.current_speaker);
                  const style = getSpeakerStyle(speaker, activeScene);
                  return (
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${SPEAKER_STYLE_CLASS[style]}`}>
                      {speaker}
                    </span>
                  );
                })()}
                {roleAddr && (
                  <span className="text-[9px] font-bold text-violet-600">→ {roleAddr}</span>
                )}
                {jointP && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-bold">
                    联合施压
                  </span>
                )}
                <SpeakButton text={safeText(msg.parsed.dialogue)} title="播放" />
              </div>
              <p
                className={`text-sm leading-relaxed italic select-text cursor-text ${
                  isFirstAiOpening ? 'text-[#FF5722] border-l-2 border-[#FF5722]/50 pl-2' : 'text-[#202124]'
                }`}
                onMouseUp={handleDialogueMouseUp}
                data-dialogue-select
              >
                &ldquo;{safeText(msg.parsed.dialogue)}&rdquo;
              </p>
              {branches.length > 0 && (
                <div className="mt-2 pt-2 border-t border-violet-100">
                  <span className="text-[8px] font-black uppercase tracking-widest text-violet-500">后续分支</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {branches.map((b, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setInputText(b)}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-violet-50 border border-violet-200 text-violet-700 hover:border-violet-400 hover:bg-violet-100 cursor-pointer transition-colors"
                      >
                        → {b}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {showIntelDetails && (
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-2 text-xs">
                  <p className="text-blue-800"><span className="font-black text-blue-600">意图 </span>{safeText(msg.parsed.hidden_intent)}</p>
                  {safeText(msg.parsed.flaw_point) && safeText(msg.parsed.flaw_point) !== '未识别到破绽' && (
                    <p className="text-red-800"><span className="font-black text-red-600">破绽 </span>{safeText(msg.parsed.flaw_point)}</p>
                  )}
                  {safeText(msg.parsed.cultural_signal) && (
                    <p className="text-purple-800"><span className="font-black text-purple-600">文化信号 </span>{safeText(msg.parsed.cultural_signal)}</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.content}</p>
          )}
        </div>
      )}
    </div>
  );
});

function OralWarRoomChatComponent({

  isContextPanelOpen,
  setIsContextPanelOpen,
  improvElapsed,
  improvActive,
  setImprovElapsed,
  setImprovActive,
  setShowConfetti,
  onNavigateWrite,
  isSending,
  messages,
  briefCollapsed,
  setBriefCollapsed,
  showIntelDetails,
  setShowIntelDetails,
  showGoldGlow,
  combatPoints,
  writeCompleted,
  activeScene,
  currentDifficulty,
  latestExchange,
  handleDialogueMouseUp,
  weaknessLog,
  bottomRef,
  latestFeedback,
  feedbackExpanded,
  setFeedbackExpanded,
  setInputText,
  lastNotice,
  isLoopholePlanted,
  currentFlawType,
  currentFlawClaim,
  flawTemplates,
  showControlCard,
  setShowControlCard,
  setIsInputLocked,
  sceneRoleSwitcherItems,
  currentTarget,
  handleTargetChange,
  isRecording,
  recordingTime,
  inputText,
  handleSend,
  isInputLocked,
  speechSupported,
  speechChecked,
  micError,
  startRecording,
  stopRecordingAndSend,
  showNegotiationControls = true,
  showDailyExpressionDebrief = false,
  onEndDailyExpressionReview,
  expressionReview = null,
  expressionReviewStatus = 'idle',
  expressionReviewError = null,
}: OralWarRoomChatProps) {
  return (
    <section className={`flex flex-col bg-white rounded-[1.5rem] xl:rounded-[2rem] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden min-h-[520px] h-[min(820px,calc(100dvh-7rem))] 2xl:h-[min(860px,calc(100dvh-6rem))] relative ${
      isContextPanelOpen ? '2xl:col-span-6' : '2xl:col-span-9'
    }`}>
      {isSending && messages.length === 0 && (
        <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-[2px] flex items-center justify-center pointer-events-none animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#202124] text-white text-[10px] font-black uppercase tracking-widest shadow-lg">
            <div className="w-2 h-2 rounded-full bg-[#FF5722] animate-pulse" />
            场景切换中
          </div>
        </div>
      )}
      <div className="shrink-0 px-4 py-3 border-b border-gray-100 bg-[#f8f9fa] flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <OralWarRoomImprovTimer
              elapsed={improvElapsed}
              isActive={improvActive}
              onElapsedChange={setImprovElapsed}
              onActiveChange={setImprovActive}
              onMilestone={() => setShowConfetti(true)}
            />
            <div className="min-w-0 pt-0.5">
              <div className="text-[10px] font-black uppercase tracking-widest text-[#FF5722] mb-0.5">对抗通信通道</div>
              <h4 className="text-base font-black text-[#202124]">对话主线 · 实时掌控</h4>
            </div>
          </div>
          <div className="flex items-center gap-1.5 self-end sm:self-start flex-wrap justify-end shrink-0">
            <button
              type="button"
              onClick={() => setBriefCollapsed(v => !v)}
              className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-[#FF5722] cursor-pointer whitespace-nowrap"
            >
              {briefCollapsed ? '战术简报' : '收起简报'}
            </button>
            <button
              type="button"
              onClick={() => setShowIntelDetails(v => !v)}
              className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg border cursor-pointer whitespace-nowrap ${
                showIntelDetails ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-gray-200 bg-white text-gray-600 hover:border-violet-300'
              }`}
            >
              {showIntelDetails ? '收起分析' : '展开分析'}
            </button>
            {showDailyExpressionDebrief && (
              <button
                type="button"
                onClick={() => onEndDailyExpressionReview?.()}
                disabled={expressionReviewStatus === 'loading' || isSending}
                className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-500 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                title="结束本场日常对话并生成表达疏漏与更好样例"
              >
                {expressionReviewStatus === 'loading' ? '复盘中…' : '结束并复盘'}
              </button>
            )}            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-white font-black text-[10px] tracking-widest shadow-md transition-all whitespace-nowrap ${
                showGoldGlow
                  ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 ring-2 ring-yellow-300 scale-105'
                  : 'bg-slate-900 border border-slate-800'
              }`}
            >
              <Trophy className="w-3 h-3 shrink-0" />
              <span>{combatPoints} XP</span>
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 bg-white rounded-full px-2.5 py-1.5 border border-gray-200 whitespace-nowrap">
              {isSending ? '推演中' : '待命'}
            </div>
            {onNavigateWrite && (
              <button
                type="button"
                onClick={() => onNavigateWrite?.()}
                className="flex items-center gap-1 px-2.5 h-8 rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] text-[9px] font-black uppercase tracking-widest cursor-pointer whitespace-nowrap"
                title="撰写信函（书面闭环）"
              >
                <PenTool className="w-3.5 h-3.5 shrink-0" />
                信函
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                playReveal();
                setIsContextPanelOpen(v => !v);
              }}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer border shrink-0
                ${isContextPanelOpen
                  ? 'bg-[var(--color-accent)] text-white border-transparent shadow-[var(--shadow-sm)]'
                  : 'bg-white border-[var(--color-border)] text-[var(--color-ink-muted)] hover:border-[var(--color-border)]'
                }`}
              title="切换上下文面板"
            >
              <Globe className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <OralWarRoomThemeProgress
        improvElapsed={improvElapsed}
        messages={messages}
        writeCompleted={writeCompleted}
        onNavigateWrite={onNavigateWrite}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
      {messages.length === 0 && (
      <div className="bg-gradient-to-r from-[#202124] via-slate-800 to-[#202124] text-white px-4 py-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF5722]/20 border border-[#FF5722]/40">
              <Globe className="w-3.5 h-3.5 text-[#FF5722]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[#FF5722]">{activeScene.tier}</span>
            </div>
            <h4 className="text-sm font-black text-white">{activeScene.shortTitle}</h4>
            <div className="flex items-center gap-0.5">{renderStars(activeScene.level)}</div>
            <span className="text-[9px] font-bold text-gray-400">
              Level {currentDifficulty ?? activeScene.level}/5
              {currentDifficulty != null && currentDifficulty !== activeScene.level && (
                <span className="ml-1 text-amber-400">· AI 动态 {currentDifficulty}</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">第 {Math.max(1, Math.ceil(latestExchange.turnCount / 2))} 轮</span>
            <div className={`w-2 h-2 rounded-full ${isSending ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
          </div>
        </div>

        <div className="mb-2 text-[10px] text-gray-300 leading-relaxed">
          <span className="font-black text-gray-400 mr-1">背景</span>{activeScene.desc}
        </div>
        <div className="mb-3 text-[10px] text-gray-300">
          <span className="font-black text-gray-400 mr-1">角色</span>{activeScene.roleList}
        </div>

        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 shrink-0">当前发言:</span>
          {[
            ...activeScene.allies.map(r => ({ ...r, type: 'ally' as const })),
            ...activeScene.blockers.map(r => ({ ...r, type: 'blocker' as const })),
            ...activeScene.neutrals.map(r => ({ ...r, type: 'neutral' as const })),
          ].map((r) => {
            const isCurrentSpeaker = roleNameMatches(latestExchange.aiSpeaker, r.name);
            const isTargetAddress = roleNameMatches(latestExchange.roleAddress, r.name);
            return (
              <div
                key={`${r.name}-${r.type}`}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold transition-all
                  ${r.type === 'ally' ? (isCurrentSpeaker ? 'bg-emerald-500 text-white ring-2 ring-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40') : ''}
                  ${r.type === 'blocker' ? (isCurrentSpeaker ? 'bg-red-500 text-white ring-2 ring-red-300' : 'bg-red-500/20 text-red-300 border border-red-500/40') : ''}
                  ${r.type === 'neutral' ? (isCurrentSpeaker ? 'bg-gray-500 text-white ring-2 ring-gray-300' : 'bg-gray-500/20 text-gray-300 border border-gray-500/40') : ''}
                `}
              >
                {isCurrentSpeaker && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                {r.name}
                {isTargetAddress && !isCurrentSpeaker && <span className="text-[8px] opacity-70">→</span>}
              </div>
            );
          })}
        </div>

        {latestExchange.jointPressure && (
          <div className="mb-2 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-red-500/15 border border-red-400/30">
            <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
            <span className="text-[9px] text-red-200"><span className="font-black text-red-300">联合施压 · </span>{latestExchange.jointPressure}</span>
          </div>
        )}

        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 shrink-0">核心冲突:</span>
          <div className="flex flex-wrap gap-1.5">
            {activeScene.conflicts.map(c => (
              <span key={c} className="px-2 py-0.5 rounded-full bg-[#FF5722]/15 border border-[#FF5722]/30 text-[9px] font-bold text-[#FF5722]">
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[9px]">
          {activeScene.allies.length > 0 && (
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-emerald-400 font-black shrink-0">盟:</span>
              <span className="text-emerald-300 font-medium truncate">{activeScene.allies.map(r => r.name).join(', ')}</span>
            </div>
          )}
          {activeScene.blockers.length > 0 && (
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <span className="text-red-400 font-black shrink-0">敌:</span>
              <span className="text-red-300 font-medium truncate">{activeScene.blockers.map(r => r.name).join(', ')}</span>
            </div>
          )}
        </div>
        {latestExchange.culturalSignal && (
          <div className="mt-2 flex items-start gap-2 px-2 py-1.5 rounded-lg bg-purple-500/10 border border-purple-400/20">
            <Globe className="w-3 h-3 text-purple-300 shrink-0 mt-0.5" />
            <span className="text-[9px] text-purple-200 leading-relaxed">{latestExchange.culturalSignal}</span>
          </div>
        )}
      </div>
      )}

      {messages.length > 0 && (
        <div className="px-4 py-2 bg-slate-800 text-white text-[10px] border-b border-white/10 flex items-center justify-between gap-2">
          <span className="font-black truncate">{activeScene.shortTitle}</span>
          <span className="text-gray-400 shrink-0 whitespace-nowrap">
            第 {Math.max(1, Math.ceil(latestExchange.turnCount / 2))} 轮 · Level {currentDifficulty ?? activeScene.level}/5
          </span>
        </div>
      )}

      {/* 固定对话主线 */}
      <div
        data-message-id="live-dialogue"
        data-ai-message="true"
        className="border-b border-gray-200 bg-gradient-to-br from-[#202124] via-slate-900 to-[#2a2a2e] text-white px-4 py-4"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-[#FF5722]">
            对话主线 LIVE · 第 {Math.max(1, Math.ceil(latestExchange.turnCount / 2))} 轮
          </span>
          {latestExchange.aiDialogue && (
            <SpeakButton text={latestExchange.aiDialogue} title="播放当前 AI 发言" />
          )}
        </div>
        {latestExchange.aiDialogue ? (
          <div className="space-y-1">
            {latestExchange.isOpeningTurn && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FF5722]/20 border border-[#FF5722]/40 text-[9px] font-black uppercase tracking-widest text-[#FF5722] mb-1">
                对话启动句 · AI 开场
              </span>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {latestExchange.aiSpeaker && (
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${SPEAKER_STYLE_CLASS[latestExchange.speakerStyle] || 'bg-white/10 text-emerald-300'}`}>
                  {latestExchange.aiSpeaker}
                </span>
              )}
              {latestExchange.roleAddress && (
                <span className="text-[10px] font-bold text-violet-300">→ {latestExchange.roleAddress}</span>
              )}
              {latestExchange.isAllyAssist && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-500/30 text-violet-200 font-bold">暗中协助</span>
              )}
            </div>
            <p
              className={`text-base sm:text-lg font-medium italic leading-relaxed select-text cursor-text ${
                latestExchange.isOpeningTurn ? 'text-[#FF5722] border-l-4 border-[#FF5722] pl-3' : 'text-white/95'
              }`}
              onMouseUp={handleDialogueMouseUp}
              data-dialogue-select
            >
              &ldquo;{latestExchange.aiDialogue}&rdquo;
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FF5722]/20 border border-[#FF5722]/40 text-[9px] font-black uppercase tracking-widest text-[#FF5722]">
              对话启动句 · 预设开场
            </span>
            <p className="text-sm text-[#FF5722]/90 italic border-l-4 border-[#FF5722]/50 pl-3 leading-relaxed">
              &ldquo;{activeScene.openingLine}&rdquo;
            </p>
            <p className="text-xs text-gray-500">
              {isSending ? '对手角色正在开场...' : '等待 AI 率先开口...'}
            </p>
          </div>
        )}
        {latestExchange.userText && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">你的上一句</span>
            <p className="text-sm text-gray-300 leading-relaxed mt-1">{latestExchange.userText}</p>
          </div>
        )}
      </div>

      {/* 战术简报 — 折叠时不占空间 */}
      {!briefCollapsed && (
        <div className="shrink-0 max-h-[180px] overflow-y-auto border-b border-gray-100 bg-white px-4 py-3 text-xs space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="font-black text-gray-400">场景 </span><span className="font-bold">{activeScene.shortTitle}</span></div>
            <div><span className="font-black text-gray-400">难度 </span>
              <span className="font-bold">Level {currentDifficulty ?? activeScene.level}/5</span>
              {currentDifficulty != null && currentDifficulty !== activeScene.level && (
                <span className="text-amber-600 ml-1">(AI 动态 {currentDifficulty})</span>
              )}
            </div>
          </div>
          <div><span className="font-black text-gray-400">背景 </span><span className="text-gray-700">{activeScene.desc}</span></div>
          <div><span className="font-black text-gray-400">角色 </span>{activeScene.roleList}</div>
          <div className="flex flex-wrap gap-1 items-center">
            <span className="font-black text-gray-400">冲突 </span>
            {activeScene.conflicts.map(c => (
              <span key={c} className="px-1.5 py-0.5 rounded-full bg-[#FF5722]/10 text-[#FF5722] text-[9px] font-black">{c}</span>
            ))}
          </div>
          {latestExchange.jointPressure && (
            <div className="p-2 rounded-lg bg-red-50 border border-red-100">
              <span className="font-black text-red-500">联合施压 </span>{latestExchange.jointPressure}
            </div>
          )}
          {latestExchange.branchSuggestions.length > 0 && (
            <div>
              <span className="font-black text-gray-400">后续分支 </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {latestExchange.branchSuggestions.map((b, i) => (
                  <button key={i} type="button" onClick={() => setInputText(b)} className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-50 border border-violet-200 text-violet-700 hover:border-violet-400 cursor-pointer">
                    → {b}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 对话历史 */}
      <div className="p-3 space-y-2 bg-gradient-to-b from-white to-[#f8f9fa]">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-4">历史记录将显示于此</p>
        ) : (() => {
          const firstAiIdx = messages.findIndex(m => m.role === 'ai');
          return messages.map((msg, msgIdx) => (
            <ChatMessageBubble
              key={msg.id}
              msg={msg}
              isFirstAiOpening={msg.role === 'ai' && msgIdx === firstAiIdx}
              activeScene={activeScene}
              showIntelDetails={showIntelDetails}
              setInputText={setInputText}
              handleDialogueMouseUp={handleDialogueMouseUp}
            />
          ));
        })()}

        {showIntelDetails && weaknessLog.length > 0 && (
          <details className="mt-4 rounded-xl border border-amber-200 bg-amber-50/30 p-3">
            <summary className="text-[10px] font-black uppercase tracking-widest text-amber-700 cursor-pointer">CORNELL 复盘 ({weaknessLog.length})</summary>
            <div className="mt-2 space-y-2 max-h-[120px] overflow-y-auto">
              {weaknessLog.slice(-3).map((entry, idx) => (
                <p key={idx} className="text-xs text-gray-700">{entry.flaw}</p>
              ))}
            </div>
          </details>
        )}
        {latestFeedback && (latestFeedback.feedback_pronunciation || latestFeedback.feedback_vocab || latestFeedback.feedback_role_switch || latestFeedback.feedback_strategy) && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setFeedbackExpanded(v => !v)}
              className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white p-1.5 rounded-lg">
                  <Star className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-black text-gray-700">AI 四维反馈</span>
              </div>
              {feedbackExpanded
                ? <ChevronUp className="w-4 h-4 text-gray-400" />
                : <ChevronDown className="w-4 h-4 text-gray-400" />
              }
            </button>
            {feedbackExpanded && (
              <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-2">
                {[
                  { key: 'feedback_pronunciation', label: '发音准确度', hint: '注意单词重音和连读' },
                  { key: 'feedback_vocab', label: '用语准确性', hint: '商务表达是否地道' },
                  { key: 'feedback_role_switch', label: '角色切换自然度', hint: '是否准确识别发言对象' },
                  { key: 'feedback_strategy', label: '谈判策略合理性', hint: '反击时机和策略选择' },
                ].map(({ key, label, hint }) => {
                  const val = safeText((latestFeedback as unknown as Record<string, unknown>)[key]);
                  return val ? (
                    <div key={key} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-gray-600">{label}</span>
                        <span className="text-[9px] text-gray-400">{hint}</span>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed">{val}</p>
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>
        )}
        {showDailyExpressionDebrief && (expressionReviewStatus === 'ready' || expressionReviewStatus === 'error') && (
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/60">
              <Star className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-xs font-black text-emerald-900">表达复盘 · 疏漏与更好样例</span>
            </div>
            <div className="px-4 py-3 space-y-2">
              {expressionReviewStatus === 'error' && (
                <p className="text-xs text-red-600">{expressionReviewError || '复盘失败，请重试'}</p>
              )}
              {expressionReviewStatus === 'ready' && (!expressionReview?.issues?.length) && (
                <p className="text-xs text-gray-600">本场未检出明显语法或地道表达疏漏。</p>
              )}
              {expressionReview?.issues?.map((issue, idx) => (
                <div key={`${issue.snippet}-${idx}`} className="bg-emerald-50/40 rounded-xl p-3 border border-emerald-100">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">
                      {issue.type === 'grammar' ? '语法' : '地道'}
                    </span>
                    <span className="text-[11px] font-mono text-gray-800">{issue.snippet}</span>
                  </div>
                  <p className="text-xs text-gray-700 mb-1">{issue.problem}</p>
                  <p className="text-xs text-emerald-900">
                    <span className="font-black">更好样例：</span>
                    {issue.betterExample}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        {latestExchange.branchSuggestions.length > 0 && (
          <div className="p-3 rounded-xl bg-violet-50 border border-violet-200">
            <div className="text-[9px] font-black uppercase tracking-widest text-violet-600 mb-2">后续分支建议</div>
            <div className="flex flex-wrap gap-1.5">
              {latestExchange.branchSuggestions.map((b, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInputText(b)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-violet-200 text-[10px] font-bold text-violet-700 hover:border-violet-400 hover:bg-violet-100 cursor-pointer transition-colors"
                >
                  → {b}
                </button>
              ))}
            </div>
          </div>
        )}
        {isLoopholePlanted && (
          <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-400 rounded-2xl shadow-[0_4px_24px_rgba(245,158,11,0.15)] ring-1 ring-amber-200/50">
            <div className="px-4 py-3 flex items-start gap-3">
              <div className="bg-amber-500 text-white p-2 rounded-xl shrink-0 shadow-lg">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-black text-amber-900">侦测到逻辑破绽</span>
                  {currentFlawType && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold">
                      {currentFlawType}
                    </span>
                  )}
                </div>
                <p className="text-xs text-amber-800/80 leading-relaxed mb-2">{currentFlawClaim}</p>
                <div className="bg-white/60 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">反击句式推荐</span>
                  </div>
                  <div className="space-y-2">
                    {flawTemplates.map((t, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-700 italic flex-1">{t}</span>
                        <button
                          type="button"
                          onClick={() => setInputText(t)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[10px] font-black hover:bg-amber-600 transition-colors cursor-pointer shrink-0"
                        >
                          使用
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {showNegotiationControls && showControlCard && (
          <OralWarRoomControlCard
            flawClaim={currentFlawClaim}
            flawType={currentFlawType}
            templates={flawTemplates}
            onUseTemplate={(text) => {
              setInputText(text);
              setShowControlCard(false);
              setIsInputLocked(false);
            }}
            onDismiss={() => {
              setShowControlCard(false);
              setIsInputLocked(false);
            }}
          />
        )}
        <div ref={bottomRef} />
      </div>
      </div>

      <div className="shrink-0 border-t border-gray-100 p-4 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.06)] z-10">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className={`text-sm font-bold truncate ${lastNotice.startsWith('⚠️') ? 'text-red-600' : 'text-[#202124]'}`}>{lastNotice}</div>
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 truncate max-w-[40%]">
            {activeScene.conflicts.join(' / ')}
          </div>
        </div>
        {showNegotiationControls && (
        <OralWarRoomRoleSwitcher
          roles={sceneRoleSwitcherItems}
          currentTarget={currentTarget}
          onTargetChange={handleTargetChange}
        />
        )}
        <div className="relative flex flex-col mt-2">
          {/* 高压 10 秒倒计时 */}
          {isRecording && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-10
                           bg-red-500 text-white px-5 py-2 rounded-full text-xs font-black
                           tracking-widest uppercase flex items-center gap-2
                           shadow-[0_4px_20px_rgba(239,68,68,0.55)] animate-pulse whitespace-nowrap">
              <Clock className="w-3.5 h-3.5" /> 剩余 {recordingTime} 秒脱口而出
            </div>
          )}
          <textarea
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            className={`w-full rounded-3xl border-2 px-5 py-4 pr-48 text-sm text-[#202124]
                       outline-none resize-none transition-colors
                       ${ isRecording
                           ? 'border-red-400 bg-red-50/40 placeholder-red-300'
                           : 'border-gray-200 bg-[#f8f9fa] focus:border-[#FF5722]' }`}
            placeholder={isInputLocked ? '请先完成控制论补救任务…' : isRecording ? '正在倾听您的反击...' : 'AI 已开场，请用语音或文字回应...'}
            disabled={isSending || isInputLocked}
          />
          <div className="absolute right-3 bottom-3 flex flex-col items-end gap-1">
            {(micError || (speechChecked && !speechSupported)) && (
              <span className={`text-[10px] max-w-[220px] text-right leading-snug ${micError ? 'text-red-500' : 'text-amber-500'}`}>
                {micError ?? '浏览器不支持语音，请使用手动输入'}
              </span>
            )}
            <div className="flex items-center gap-2">
            {/* 麦克风长按按钮 */}
            {speechSupported ? (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    /* 部分环境不支持 capture，仍走全局 pointerup */
                  }
                  if (!isRecording) startRecording();
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  try {
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    }
                  } catch {
                    /* ignore */
                  }
                  stopRecordingAndSend();
                }}
                onPointerCancel={(e) => {
                  try {
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    }
                  } catch {
                    /* ignore */
                  }
                  stopRecordingAndSend();
                }}
                disabled={isSending || isInputLocked}
                className={`rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest
                           transition-all select-none flex items-center gap-2
                           ${ isRecording
                               ? 'bg-red-500 text-white shadow-[0_0_18px_rgba(239,68,68,0.6)] scale-105'
                               : 'bg-gray-100 text-gray-600 hover:bg-gray-200' }`}
              >
                {isRecording
                  ? <><MicOff className="w-4 h-4 animate-bounce" /> 松开发送</>
                  : <><Mic className="w-4 h-4" /> 长按说话</>}
              </button>
            ) : null}
            <button
              onClick={handleSend}
              disabled={isSending || !inputText.trim() || isRecording || isInputLocked}
              className="rounded-2xl bg-[#202124] text-white px-4 py-3 text-xs font-black
                         uppercase tracking-widest hover:bg-[#FF5722] transition-colors
                         disabled:opacity-50 flex items-center gap-2"
            >
              <Send className="w-4 h-4" /> 发送
            </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const OralWarRoomChat = React.memo(OralWarRoomChatComponent);
export default OralWarRoomChat;

