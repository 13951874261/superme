import React from 'react';
import { Star } from 'lucide-react';
import type { ParsedAiResponse } from '../../../services/difyAPI';
import type { SceneEntry, SessionMemory } from './types';

export const SPEAKER_STYLE_CLASS: Record<string, string> = {
  ally: 'bg-emerald-600 text-white',
  blocker: 'bg-red-600 text-white',
  neutral: 'bg-gray-600 text-white',
  joint: 'bg-gradient-to-r from-red-600 to-emerald-600 text-white',
};

export function getVocabZoneFromScene(sceneTitle: string): 'business' | 'general' {
  const businessKeywords = [
    '谈判', '并购', '银团', '董事会', '合规', '审计', '尽调',
    '贷款', '利率', '抵押', '股权', 'IPO', '融资', '授信',
    '监管', '估值', 'IRR', 'ROE', 'ESG', '担保', '提款',
    '参团行', '牵头行', 'CFO', 'CEO', '总监', '负责人', '基础设施',
  ];
  return businessKeywords.some(kw => sceneTitle.includes(kw)) ? 'business' : 'general';
}

export function getSpeakerStyle(speaker: string, scene: SceneEntry): 'ally' | 'blocker' | 'neutral' | 'joint' {
  const s = speaker.toLowerCase();
  const allyHit = scene.allies.some(r => s.includes(r.name.toLowerCase()));
  const blockerHit = scene.blockers.some(r => s.includes(r.name.toLowerCase()));
  if (allyHit && blockerHit) return 'joint';
  if (allyHit) return 'ally';
  if (blockerHit) return 'blocker';
  return 'neutral';
}

export function safeText(value: unknown) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function parseBranchList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  const text = safeText(raw);
  if (!text) return [];
  return text.split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
}

export function parseTemplateList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  const text = safeText(raw);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch { /* ignore */ }
  return text.split(/\n|;/).map(s => s.trim().replace(/^[\d.)\-]+\s*/, '')).filter(s => s.length > 10);
}

export function extractFlawType(flawText: string): string {
  const types: Record<string, string> = {
    causal_fallacy: '因果倒置',
    overgeneralization: '以偏概全',
    false_equivalence: '虚假等同',
    evasive_argument: '避重就轻',
    shifting_burden: '偷换举证责任',
    logical_fallacy: '逻辑谬误',
    factual_vague: '事实模糊',
    intent_evade: '意图回避',
  };
  for (const [key, label] of Object.entries(types)) {
    if (flawText.toLowerCase().includes(key)) return label;
  }
  if (/因果|causal|post hoc/i.test(flawText)) return '因果倒置';
  if (/以偏概全|overgeneral/i.test(flawText)) return '以偏概全';
  if (/等同|equivalence/i.test(flawText)) return '虚假等同';
  if (/避重|evad/i.test(flawText)) return '避重就轻';
  return '逻辑漏洞';
}

export function renderStars(level: number) {
  return Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className={`w-3 h-3 ${i < level ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
  ));
}

export function getScenePartyCount(scene: SceneEntry) {
  return 1 + scene.allies.length + scene.blockers.length + scene.neutrals.length;
}

export function roleNameMatches(speaker: string, roleName: string) {
  return speaker.toLowerCase().includes(roleName.toLowerCase()) || roleName.toLowerCase().includes(speaker.toLowerCase());
}

function stripMarkdownJson(text: string) {
  return String(text || '').replace(/```json/g, '').replace(/```/g, '').trim();
}

export function parseAiPayload(raw: string): ParsedAiResponse | null {
  try {
    return JSON.parse(stripMarkdownJson(raw));
  } catch {
    return null;
  }
}

function extractScoreFromFeedback(feedback: unknown): number {
  const text = safeText(feedback);
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:\/10|分|%)?/);
  if (m) return Math.min(10, Math.max(0, Number(m[1])));
  if (text.length >= 80) return 8.5;
  if (text.length >= 40) return 8;
  if (text.length >= 15) return 7;
  return 6.5;
}

export function buildMessageFeedback(parsed: ParsedAiResponse | null) {
  if (!parsed) return undefined;
  return {
    logicScore: Number(parsed.logicScore) || extractScoreFromFeedback(parsed.feedback_strategy),
    culturalScore: Number(parsed.culturalScore) || extractScoreFromFeedback(parsed.feedback_role_switch),
    fluencyScore: Number(parsed.fluencyScore) || extractScoreFromFeedback(parsed.feedback_vocab),
    overall: safeText(parsed.evaluation) || safeText(parsed.feedback_strategy),
  };
}

export interface WriteContextPayload {
  sceneId: string;
  sceneTitle: string;
  theme: string;
  conflicts: string[];
  culturalContext: string;
}

export function saveWriteContext(payload: WriteContextPayload) {
  localStorage.setItem('superme_write_context', JSON.stringify(payload));
}

export function peekWriteContext(): WriteContextPayload | null {
  try {
    const raw = localStorage.getItem('superme_write_context');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function formatSessionMemoryProfile(memory: SessionMemory): string {
  const parts: string[] = [...memory.weaknesses.slice(-10)];
  if (memory.oralCount > 0) {
    parts.push(`口语轮次${memory.oralCount}`);
  }
  if (memory.avgLogicScore > 0) {
    parts.push(`逻辑均分${memory.avgLogicScore.toFixed(1)}`);
  }
  if (memory.avgCulturalScore > 0) {
    parts.push(`文化均分${memory.avgCulturalScore.toFixed(1)}`);
  }
  return parts.join('; ');
}

export function consumeWriteContext(): WriteContextPayload | null {
  const ctx = peekWriteContext();
  if (ctx) localStorage.removeItem('superme_write_context');
  return ctx;
}
