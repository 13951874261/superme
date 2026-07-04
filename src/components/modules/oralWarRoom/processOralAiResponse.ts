import type { Dispatch, SetStateAction } from 'react';
import type { ParsedAiResponse } from '../../../services/difyAPI';
import { playSuccess, playError } from '../../../utils/soundEffects';
import type { WeaknessLogEntry } from './types';
import { appendErrorLedgerEntries } from '../../../utils/errorLedgerHelper';
import { safeText, parseTemplateList, extractFlawType } from './utils';

export interface ProcessOralAiResponseCtx {
  activeSceneTitle: string;
  flawTemplates: string[];
  appendWeaknessToMemory: (flaw: string) => void;
  setCurrentDifficulty: (v: number) => void;
  setLatestFeedback: (v: ParsedAiResponse | null) => void;
  setFeedbackExpanded: (v: boolean) => void;
  setCombatPoints: Dispatch<SetStateAction<number>>;
  setWeaknessLog: Dispatch<SetStateAction<WeaknessLogEntry[]>>;
  setShowGoldGlow: (v: boolean) => void;
  setShowConfetti: (v: boolean) => void;
  setLastNotice: (v: string) => void;
  setFlawTemplates: (v: string[]) => void;
  setCurrentFlawType: (v: string) => void;
  setCurrentFlawClaim: (v: string) => void;
  setShowControlCard: (v: boolean) => void;
  setIsInputLocked: (v: boolean) => void;
  setIsLoopholePlanted: (v: boolean) => void;
}

function logWeakness(sceneTitle: string, flawText: string, setWeaknessLog: ProcessOralAiResponseCtx['setWeaknessLog']) {
  const existingWeaknesses = JSON.parse(localStorage.getItem('user_weakness_log') || '[]');
  existingWeaknesses.push({ scene: sceneTitle, flaw: flawText, timestamp: Date.now() });
  localStorage.setItem('user_weakness_log', JSON.stringify(existingWeaknesses));
  setWeaknessLog(existingWeaknesses);
  window.dispatchEvent(new Event('weakness-updated'));
  void appendErrorLedgerEntries('oral', [{ scene: sceneTitle, flaw: flawText }]);
}

export function processOralAiResponse(
  ctx: ProcessOralAiResponseCtx,
  parsed: ParsedAiResponse | null,
  content: string,
  wasLoopholeActive: boolean,
): boolean {
  if (parsed?.difficulty_rating) {
    const lvl = Number(safeText(parsed.difficulty_rating).replace(/\D/g, ''));
    if (lvl >= 1 && lvl <= 5) ctx.setCurrentDifficulty(lvl);
  }
  if (parsed) {
    ctx.setLatestFeedback(parsed);
    if (parsed.feedback_pronunciation || parsed.feedback_vocab || parsed.feedback_role_switch || parsed.feedback_strategy) {
      ctx.setFeedbackExpanded(false);
    }
  }

  let evaluatedSuccess = false;

  if (wasLoopholeActive) {
    const evalText = safeText(parsed?.evaluation || parsed?.feedback_strategy || '');
    const templates = ctx.flawTemplates.length ? ctx.flawTemplates : parseTemplateList(parsed?.counter_question_templates);
    const successFromAI = evalText.includes('【破绽反击成功】') || evalText.includes('反击成功') || evalText.includes('指出破绽');
    const successFromUserKeywords = /fallacy|flaw|contradict|loophole|concept-switching|causal|reversal|clarify the contradiction|what evidence|conflating correlation|post hoc|evasive|vague/i.test(content);
    const successFromTemplates = templates.some(t => {
      const snippet = t.slice(0, 30).toLowerCase();
      return snippet.length > 10 && content.toLowerCase().includes(snippet.slice(0, 15));
    });

    if (successFromAI || successFromUserKeywords || successFromTemplates) {
      ctx.setCombatPoints(prev => prev + 50);
      if (parsed?.flaw_point) {
        try {
          const flawText = safeText(parsed.flaw_point);
          ctx.appendWeaknessToMemory(flawText);
          logWeakness(ctx.activeSceneTitle, flawText, ctx.setWeaknessLog);
        } catch { /* ignore */ }
      }
      ctx.setShowGoldGlow(true);
      ctx.setShowConfetti(true);
      playSuccess();
      setTimeout(() => ctx.setShowGoldGlow(false), 3000);
      ctx.setLastNotice('破绽反击成功！获得 +50 XP!');
      evaluatedSuccess = true;
      ctx.setFlawTemplates([]);
      ctx.setCurrentFlawType('');
      ctx.setCurrentFlawClaim('');
      ctx.setShowControlCard(false);
      ctx.setIsInputLocked(false);
    } else {
      playError();
      ctx.setLastNotice('未成功指出破绽，控制论补救任务已触发。');
      ctx.setShowControlCard(true);
      ctx.setIsInputLocked(true);
    }
    ctx.setIsLoopholePlanted(false);
  }

  if (parsed?.flaw_point) {
    const flawText = safeText(parsed.flaw_point);
    if (!flawText || flawText === '未识别到破绽') {
      if (!wasLoopholeActive) ctx.setLastNotice('已收到回应，继续追问。');
      return evaluatedSuccess;
    }
    try {
      const existingWeaknesses = JSON.parse(localStorage.getItem('user_weakness_log') || '[]');
      const alreadyLogged = existingWeaknesses.some((w: { flaw: string }) => w.flaw === flawText);
      if (!alreadyLogged) {
        ctx.appendWeaknessToMemory(flawText);
        logWeakness(ctx.activeSceneTitle, flawText, ctx.setWeaknessLog);
      }
    } catch { /* ignore */ }
    ctx.setIsLoopholePlanted(true);
    ctx.setCurrentFlawType(extractFlawType(flawText));
    ctx.setCurrentFlawClaim(flawText);
    const templates = parseTemplateList(parsed.counter_question_templates);
    if (templates.length) ctx.setFlawTemplates(templates);
    else ctx.setFlawTemplates([
      'Could you clarify the contradiction between...?',
      'That seems like a post hoc fallacy. What evidence supports that link?',
      'Are you conflating correlation with causation here?',
    ]);
    if (wasLoopholeActive && !evaluatedSuccess) {
      ctx.setLastNotice('上轮未成功指出破绽。侦测到对手新发言存在逻辑漏洞！请重新进行针对性反击。');
    } else if (!wasLoopholeActive) {
      ctx.setLastNotice('侦测到对手发言存在逻辑漏洞！请进行针对性反击。');
    }
  } else if (!wasLoopholeActive) {
    ctx.setLastNotice('已收到回应，继续追问。');
  }

  return evaluatedSuccess;
}
