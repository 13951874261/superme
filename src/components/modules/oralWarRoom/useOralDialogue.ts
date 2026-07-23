import { useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { sendOralChatMessage, type ParsedAiResponse, type OralChatContext } from '../../../services/difyAPI';
import { createTrainingAttempt } from '../../../services/trainingAPI';
import { playSendMessage } from '../../../utils/soundEffects';
import { ROLE_SWITCH_INSTRUCTION } from './scenes';
import type { MessageItem, SceneEntry, SessionMemory } from './types';
import {
  parseAiPayload,
  buildMessageFeedback,
  formatSessionMemoryProfile,
} from './utils';

const FLAW_TYPES = [
  'causal_fallacy',
  'overgeneralization',
  'false_equivalence',
  'evasive_argument',
  'shifting_burden',
  'factual_vague',
  'intent_evade',
] as const;

const FLAW_DESCRIPTIONS: Record<(typeof FLAW_TYPES)[number], string> = {
  causal_fallacy: '植入一个因果倒置的论点（例如："因为我们拒绝了涨价，所以产品质量一定下降了"）',
  overgeneralization: '植入一个以偏概全的论点（例如："上次这个供应商出了问题，所以他们全部都不靠谱"）',
  false_equivalence: '植入一个虚假等同的论点（例如："我们的合规成本和他们的报价差异是同等重要的"）',
  evasive_argument: '植入一个避重就轻的回答（例如：用程序正义回避实质问题）',
  shifting_burden: '植入一个偷换举证责任的论点（例如："如果你不能证明我们有问题，那就是我们没问题"）',
  factual_vague: '植入一个事实模糊或数据矛盾的论点（例如："据我所知市场普遍如此"但无法给出具体依据）',
  intent_evade: '植入一个意图回避的论点（例如：用流程合规掩盖实质让步，或转移谈判焦点）',
};

function getDifficultyPrefix(hardcoreMessage: string): string {
  const diff = localStorage.getItem('super_agent_global_diff') || 'standard';
  return diff === 'hardcore' ? hardcoreMessage : '';
}

function buildLoopholeInstruction(isLoopholePlanted: boolean, currentRound: number, culturalContext: string): string {
  if (isLoopholePlanted) {
    return '\n[系统隐性指令：用户已指出上一轮的破绽。请在本轮评估中，检查用户是否用英语准确指出了逻辑漏洞并设计了兼顾商务分寸的提问。如果是，请在返回的 JSON 的 evaluation 字段中包含『【破绽反击成功】』字样。]';
  }
  const flawType = FLAW_TYPES[currentRound % FLAW_TYPES.length];
  return `\n[系统隐性指令：请在本次回复的 dialogue 中，刻意植入一个【${flawType}】类型的逻辑漏洞。具体表现为：${FLAW_DESCRIPTIONS[flawType]}。你必须在返回的 JSON 的 flaw_point 字段中，明确且详细地指出漏洞类型（${flawType}）和具体内容。同时，请在 counter_question_templates 字段中提供 3-5 条推荐的英语反问句式。跨文化语境：${culturalContext}]`;
}

export interface UseOralDialogueOptions {
  userId: string;
  sessionId: string | null;
  sceneTheme: string;
  activeScene: SceneEntry;
  activeSceneId: string;
  messages: MessageItem[];
  setMessages: Dispatch<SetStateAction<MessageItem[]>>;
  isSending: boolean;
  setIsSending: Dispatch<SetStateAction<boolean>>;
  conversationId: string | null;
  setConversationId: Dispatch<SetStateAction<string | null>>;
  isInputLocked: boolean;
  currentTarget: string;
  setCurrentTarget: Dispatch<SetStateAction<string>>;
  isLoopholePlanted: boolean;
  improvActive: boolean;
  setImprovActive: Dispatch<SetStateAction<boolean>>;
  setImprovElapsed: Dispatch<SetStateAction<number>>;
  sessionMemory: SessionMemory;
  setSessionMemory: Dispatch<SetStateAction<SessionMemory>>;
  setLastNotice: Dispatch<SetStateAction<string>>;
  setCurrentDifficulty: Dispatch<SetStateAction<number | null>>;
  setInputText: Dispatch<SetStateAction<string>>;
  inputText: string;
  clearPendingText: () => void;
  processAiResponse: (parsed: ParsedAiResponse | null, content: string, wasLoopholeActive: boolean) => boolean;
  onOralRoundLogged?: () => void;
  bottomRef: RefObject<HTMLDivElement | null>;
}

export function useOralDialogue({
  userId,
  sessionId,
  sceneTheme,
  activeScene,
  activeSceneId,
  messages,
  setMessages,
  isSending,
  setIsSending,
  conversationId,
  setConversationId,
  isInputLocked,
  currentTarget,
  setCurrentTarget,
  isLoopholePlanted,
  improvActive,
  setImprovActive,
  setImprovElapsed,
  sessionMemory,
  setSessionMemory,
  setLastNotice,
  setCurrentDifficulty,
  setInputText,
  inputText,
  clearPendingText,
  processAiResponse,
  onOralRoundLogged,
  bottomRef,
}: UseOralDialogueOptions) {
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [bottomRef]);

  const buildOralContext = useCallback((scene: SceneEntry): OralChatContext => ({
    scene_title: scene.shortTitle,
    scene_type: scene.shortTitle,
    roles: scene.roleList,
    cultural_context: scene.culturalContext,
    conflicts: scene.conflicts.join(' / '),
    role_switch_instruction: ROLE_SWITCH_INSTRUCTION,
    scene_level: scene.level,
    role_judgement: currentTarget || '未指定',
    intent_judgement: 'negotiation',
    user_current_profile: formatSessionMemoryProfile(sessionMemory),
  }), [currentTarget, sessionMemory]);

  const initiateSceneDialogue = useCallback(async (scene: SceneEntry) => {
    if (isSending) return;
    setIsSending(true);
    setLastNotice('对手角色正在开场...');
    const difficultyPrefix = getDifficultyPrefix('【全局指令：极限施压模式】\n');
    const opener = scene.openingLine;
    const apiPayload = `${difficultyPrefix}[系统隐性指令：切换场景「${scene.shortTitle}」。角色：${scene.roleList}。请由非用户角色率先开口（对话启动句），参考风格："${opener}"。用户尚未发言。必须在 JSON 返回 dialogue、current_speaker、role_address、branch_suggestions、difficulty_rating(${scene.level})、cultural_signal 及四维 feedback 字段。${ROLE_SWITCH_INSTRUCTION}]`;

    try {
      const res = await sendOralChatMessage(apiPayload, null, userId, buildOralContext(scene));
      if (res.conversation_id) setConversationId(res.conversation_id);
      const rawText = String(res.answer || res.message || '');
      const parsed = parseAiPayload(rawText);
      const aiMsg: MessageItem = { id: `${Date.now()}-a`, role: 'ai', content: rawText, parsed };
      setMessages([aiMsg]);
      processAiResponse(parsed, '', false);
      scrollToBottom();
    } catch {
      const fallbackMsg: MessageItem = {
        id: `${Date.now()}-a`,
        role: 'ai',
        content: JSON.stringify({
          current_speaker: scene.blockers[0]?.name || 'Opponent',
          dialogue: scene.openingLine,
          hidden_intent: '测试您的第一反应与控场能力',
          flaw_point: '',
          difficulty_rating: scene.level,
          role_address: 'You',
          branch_suggestions: scene.conflicts.join(', '),
          cultural_signal: scene.culturalContext.slice(0, 80),
        }),
        parsed: {
          current_speaker: scene.blockers[0]?.name || 'Opponent',
          dialogue: scene.openingLine,
          hidden_intent: '测试您的第一反应与控场能力',
          flaw_point: '',
          evaluation: '',
          difficulty_rating: scene.level,
          role_address: 'You',
          branch_suggestions: scene.conflicts.join(', '),
          cultural_signal: scene.culturalContext.slice(0, 80),
        },
      };
      setMessages([fallbackMsg]);
      setCurrentDifficulty(scene.level);
      setLastNotice('已加载场景开场（离线模式）');
    } finally {
      setIsSending(false);
    }
  }, [isSending, userId, buildOralContext, processAiResponse, scrollToBottom, setIsSending, setLastNotice, setConversationId, setMessages, setCurrentDifficulty]);

  const handleSendWithText = useCallback(async (forceContent: string) => {
    const rawContent = forceContent.trim();
    if (isInputLocked) {
      setLastNotice('⚠️ 请先完成控制论补救任务后再发言');
      return;
    }
    if (isSending) {
      setLastNotice('⚠️ 上一条消息正在发送，请稍候');
      return;
    }
    if (!rawContent) {
      setLastNotice('⚠️ 未识别到有效内容，请重试或手动输入');
      return;
    }

    const content = currentTarget && !rawContent.startsWith('@')
      ? `@${currentTarget} ${rawContent}`
      : rawContent;

    if (!improvActive) {
      setImprovActive(true);
      setImprovElapsed(0);
    }

    playSendMessage();
    const currentRound = messages.length;

    const difficultyPrefix = getDifficultyPrefix('【全局指令：当前为极限施压模式，请在回复中表现出极强的压迫感、敌意与找破绽倾向，不可轻易让步。】\n');
    const loopholeInstruction = buildLoopholeInstruction(isLoopholePlanted, currentRound, activeScene.culturalContext);
    const culturalInjection = `\n[跨文化语境：${activeScene.culturalContext}]`;

    let apiPayload: string;
    if (currentRound === 0) {
      const sceneNameForAI = activeSceneId === 'dynamic-scene' ? sceneTheme : activeScene.shortTitle;
      apiPayload = `[系统隐性指令：切换场景 ${sceneNameForAI}，角色：${activeScene.roleList}]\n${difficultyPrefix}${culturalInjection}${ROLE_SWITCH_INSTRUCTION}\n用户发言：${content}${loopholeInstruction}`;
    } else {
      apiPayload = `${difficultyPrefix}${culturalInjection}\n用户发言：${content}${loopholeInstruction}`;
    }

    const userMsg: MessageItem = { id: `${Date.now()}-u`, role: 'user', content };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setCurrentTarget('');
    clearPendingText();
    setIsSending(true);
    setLastNotice('华尔街/中东对手正在推演回应...');

    try {
      const res = await sendOralChatMessage(apiPayload, conversationId, userId, buildOralContext(activeScene));
      if (res.conversation_id) setConversationId(res.conversation_id);

      const rawText = String(res.answer || res.message || '');
      const parsed = parseAiPayload(rawText);
      const aiMsg: MessageItem = { id: `${Date.now()}-a`, role: 'ai', content: rawText, parsed };
      setMessages(prev => [...prev, aiMsg]);

      if (sessionId && sceneTheme) {
        void createTrainingAttempt({
          sessionId,
          userId,
          moduleType: 'oral',
          sceneType: sceneTheme,
          caseText: content.slice(0, 800),
          userAnswer: { round: 'user_turn', conversationId: res.conversation_id || null },
          durationSeconds: 0,
          score: null,
        })
          .then(() => onOralRoundLogged?.())
          .catch(() => {});
      }

      const wasLoopholeActive = isLoopholePlanted;
      processAiResponse(parsed, content, wasLoopholeActive);

      if (parsed) {
        const feedback = buildMessageFeedback(parsed);
        setMessages(prev => prev.map((m, idx) => (
          idx === prev.length - 1 && m.role === 'user' ? { ...m, feedback } : m
        )));
        setSessionMemory(prev => ({
          ...prev,
          oralCount: prev.oralCount + 1,
          avgLogicScore: feedback ? (prev.avgLogicScore + feedback.logicScore) / 2 : prev.avgLogicScore,
          avgCulturalScore: feedback ? (prev.avgCulturalScore + feedback.culturalScore) / 2 : prev.avgCulturalScore,
        }));
      }

      scrollToBottom();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '对话失败';
      setLastNotice(`⚠️ ${msg}`);
    } finally {
      setIsSending(false);
    }
  }, [
    isSending,
    isInputLocked,
    currentTarget,
    improvActive,
    messages.length,
    isLoopholePlanted,
    activeScene,
    activeSceneId,
    sceneTheme,
    conversationId,
    userId,
    sessionId,
    buildOralContext,
    processAiResponse,
    onOralRoundLogged,
    clearPendingText,
    scrollToBottom,
    setImprovActive,
    setImprovElapsed,
    setMessages,
    setInputText,
    setCurrentTarget,
    setIsSending,
    setLastNotice,
    setConversationId,
    setSessionMemory,
  ]);

  const handleSend = useCallback(() => handleSendWithText(inputText), [handleSendWithText, inputText]);

  return { buildOralContext, initiateSceneDialogue, handleSendWithText, handleSend };
}
