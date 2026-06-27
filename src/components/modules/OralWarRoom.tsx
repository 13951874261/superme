import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BookPlus, ChevronDown, ChevronUp, Clock, Copy, Globe, Mic, MicOff, Send, ShieldAlert, Star, Target, Users, Trophy } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import SpeakButton from '../SpeakButton';
import { sendOralChatMessage, type ParsedAiResponse, type OralChatContext } from '../../services/difyAPI';
import { createTrainingAttempt } from '../../services/trainingAPI';
import { addWord } from '../../services/vocabAPI';
import Confetti from '../Confetti';
import { playSuccess, playError } from '../../utils/soundEffects';

interface SceneRole {
  name: string;
  label: string;
  desc: string;
}

interface SceneEntry {
  id: string;
  title: string;
  shortTitle: string;
  tier: '初阶' | '高阶' | '跨文化' | '定制';
  level: 4 | 5;
  desc: string;
  roleList: string;
  allies: SceneRole[];
  blockers: SceneRole[];
  neutrals: SceneRole[];
  conflicts: string[];
  culturalContext: string;
  openingLine: string;
}

// === 多角色沙盘场景库（12+ 场景） ===
const SCENE_DATABASE: SceneEntry[] = [
  // ── 初阶多角色（三方博弈） ──
  {
    id: 'scene-begin-1',
    title: '初阶：项目延期说明会',
    shortTitle: '项目延期说明会',
    tier: '初阶',
    level: 4,
    desc: '客户要求赔偿，上级要求保关系；需在两方之间平衡语气并提出折中方案。',
    roleList: '我(项目负责人) + 外籍总监 + 客户代表',
    allies: [{ name: '外籍总监', label: '盟友', desc: '倾向保关系，暗示可内部消化' }],
    blockers: [{ name: '客户代表', label: '阻力', desc: '要求书面赔偿与 SLA 惩罚条款' }],
    neutrals: [{ name: '项目监理', label: '中立', desc: '只陈述客观延期原因' }],
    conflicts: ['赔偿条款', '关系维护'],
    culturalContext: 'Direct communication expected from client side. 对上级用委婉汇报，对客户需明确底线。',
    openingLine: "We've been waiting forty minutes. Before we discuss recovery plans, I need clarity on who bears the penalty clause.",
  },
  {
    id: 'scene-begin-2',
    title: '初阶：跨部门资源争夺',
    shortTitle: '跨部门资源争夺',
    tier: '初阶',
    level: 4,
    desc: '财务控成本，风控收紧额度；识别盟友并用数据说服。',
    roleList: '我(信贷部) + 财务总监 + 风控总监',
    allies: [{ name: '业务副总', label: '盟友', desc: '支持适度放量以保 KPI' }],
    blockers: [{ name: '财务总监', label: '阻力', desc: '严控成本，要求砍 30% 预算' }, { name: '风控总监', label: '阻力', desc: '收紧授信额度与担保要求' }],
    neutrals: [],
    conflicts: ['预算削减', '授信额度'],
    culturalContext: 'Hierarchy 明显，需先尊重职能边界再提出数据论证。',
    openingLine: 'Finance and Risk have conflicting numbers on this portfolio. Walk us through why your team deserves the headroom.',
  },
  {
    id: 'scene-begin-3',
    title: '初阶：新政策宣贯答疑',
    shortTitle: '新政策宣贯答疑',
    tier: '初阶',
    level: 4,
    desc: '两位下属分别担心执行难与考核变；回应不同顾虑并保持政策一致性。',
    roleList: '我(宣讲人) + 业务线A下属 + 业务线B下属',
    allies: [{ name: '业务线A', label: '盟友', desc: '愿意试点，需资源支持' }],
    blockers: [{ name: '业务线B', label: '阻力', desc: '担心考核指标突变影响团队士气' }],
    neutrals: [],
    conflicts: ['执行难度', '考核调整'],
    culturalContext: '下属期待 Direct 回答但需保留 Hierarchy 分寸，避免公开否定政策。',
    openingLine: "The new KPI framework sounds ambitious on paper, but my team can't see how we hit it without extra headcount.",
  },
  // ── 高阶多角色（四方及以上） ──
  {
    id: 'scene-1',
    title: '高阶：国际银团贷款谈判',
    shortTitle: '国际银团贷款谈判',
    tier: '高阶',
    level: 4,
    desc: '核心争议：利率上浮 0.5% 与抵押物权属争议。借款方资金缺口倒逼 72 小时谈判时限。',
    roleList: '我(牵头行) + 参团行A + 参团行B + 借款企业CFO',
    allies: [{ name: 'CEO', label: '盟友', desc: '极力推动落地，愿让步换时间' }],
    blockers: [{ name: 'CFO', label: '阻力', desc: '严控 IRR 红线，要求重跑估值' }],
    neutrals: [{ name: '监管方', label: '中立', desc: '只关注合规证据与权属文件' }],
    conflicts: ['利率上浮 0.5%', '抵押物权属'],
    culturalContext: '美系主导（Action-oriented, Direct）。切忌过分谦逊，直面利益冲突并明确亮出 Bottom Line。',
    openingLine: "Gentlemen, let's address the rate adjustment first. Our IRR model doesn't absorb another fifty basis points without collateral restructuring.",
  },
  {
    id: 'scene-adv-2',
    title: '高阶：Overseas Project Kick-off',
    shortTitle: '海外项目启动会',
    tier: '高阶',
    level: 5,
    desc: '合规、进度与本地化冲突；跨文化沟通并维护中方利益。',
    roleList: '我(中方负责人) + 当地官员 + 本地伙伴 + 外方工程师',
    allies: [{ name: '本地伙伴', label: '盟友', desc: '熟悉当地流程，可斡旋' }],
    blockers: [{ name: '外方工程师', label: '阻力', desc: '坚持原设计标准，拒绝本地化调整' }],
    neutrals: [{ name: '当地官员', label: '中立', desc: '关注合规许可与社区关系' }],
    conflicts: ['合规许可', '本地化标准'],
    culturalContext: 'Direct vs 委婉并存：官员表述间接，工程师 Direct。需分别调整语气。',
    openingLine: 'Before we sign off the timeline, the local regulator expects explicit ESG commitments in the contract appendix.',
  },
  {
    id: 'scene-adv-3',
    title: '高阶：内部晋升评审会',
    shortTitle: '内部晋升评审会',
    tier: '高阶',
    level: 5,
    desc: '评委关注点各异（能力/业绩/成本）；依次回答且不得罪人。',
    roleList: '我(候选人) + 外籍HR总监 + 业务负责人 + 财务代表',
    allies: [{ name: '业务负责人', label: '盟友', desc: '认可业绩，愿背书' }],
    blockers: [{ name: '财务代表', label: '阻力', desc: '质疑成本管控与 ROI 贡献' }],
    neutrals: [{ name: '外籍HR总监', label: '中立', desc: '关注领导力与文化 fit' }],
    conflicts: ['业绩证明', '成本管控'],
    culturalContext: '欧美 HR Direct 提问，亚洲业务方更委婉。需切换 register。',
    openingLine: "Let's start with your P&L ownership. Finance flagged a 12% overspend in Q3—how do you reconcile that with a promotion case?",
  },
  {
    id: 'scene-2',
    title: '高阶：危机公关媒体发布会',
    shortTitle: '危机公关媒体会',
    tier: '高阶',
    level: 5,
    desc: '面对尖锐、陷阱与情绪化提问，用英语冷静应对并转向正面。',
    roleList: '我(发言人) + 记者A + 记者B + 在线观众',
    allies: [{ name: '公关总监', label: '盟友', desc: '试图用技术性误差推锅给第三方' }],
    blockers: [{ name: '记者A', label: '阻力', desc: '掌握邮件截图，紧逼决策链' }, { name: '记者B', label: '阻力', desc: '情绪化追问高管责任' }],
    neutrals: [{ name: '法务官', label: '中立', desc: '警告承认将触发天价罚款' }],
    conflicts: ['数据造假责任', '披露边界'],
    culturalContext: '欧系合规文化（Regulation-first）。强调程序正义与透明度。',
    openingLine: 'We have evidence your subsidiary manipulated environmental data. Did the board know before the IPO prospectus went out?',
  },
  // ── 跨文化专项 ──
  {
    id: 'scene-culture-1',
    title: '跨文化：中日韩三方会议',
    shortTitle: '中日韩三方会议',
    tier: '跨文化',
    level: 4,
    desc: '日方委婉、韩方直接；识别不同文化表达习惯，不做错误假设。',
    roleList: '我(中国方) + 日本客户 + 韩国供应商',
    allies: [{ name: '韩国供应商', label: '盟友', desc: 'Direct 支持交期，愿共担成本' }],
    blockers: [{ name: '日本客户', label: '阻力', desc: '委婉表达对质量顾虑，不直接说 NO' }],
    neutrals: [],
    conflicts: ['质量标准', '交期承诺'],
    culturalContext: '日方 High-context 委婉；韩方 Low-context Direct。勿将沉默当同意。',
    openingLine: 'It might be... somewhat challenging to accept the current spec as-is. We would need to consider alternatives carefully.',
  },
  {
    id: 'scene-culture-2',
    title: '跨文化：欧美非视频会',
    shortTitle: '欧美非视频会',
    tier: '跨文化',
    level: 4,
    desc: '克服时差与沟通效率问题，用简单英语确保理解并确认共识。',
    roleList: '我(亚洲总部) + 美国团队 + 非洲当地经理',
    allies: [{ name: '非洲经理', label: '盟友', desc: '熟悉本地运营，需清晰指令' }],
    blockers: [{ name: '美国团队', label: '阻力', desc: '质疑远程决策效率' }],
    neutrals: [],
    conflicts: ['时差协调', '决策效率'],
    culturalContext: '美国 Direct、非洲关系导向。用简单句确认共识，避免 idioms。',
    openingLine: "We're three hours into this call and still don't have a decision owner. Can we lock action items before everyone drops?",
  },
  {
    id: 'scene-3',
    title: '跨文化：中东商务晚宴',
    shortTitle: '中东商务晚宴',
    tier: '跨文化',
    level: 4,
    desc: '宗教礼仪、等级观念与非正式谈判；运用高阶英语社交话术。',
    roleList: '我 + 当地亲王 + 欧美顾问',
    allies: [{ name: '投资总监', label: '盟友', desc: '用家族荣誉包装强制回购条款' }],
    blockers: [{ name: '战略负责人', label: '阻力', desc: '担心 ESG 违规，私下施压' }],
    neutrals: [{ name: '王室合伙人', label: '中立', desc: '暗示宗教禁忌与政商潜规则' }],
    conflicts: ['对赌回购条款', 'ESG 披露'],
    culturalContext: '中东政商文化（Relationship & Hierarchy）。重视关系与家族荣誉，避免当众逼迫对方妥协。',
    openingLine: 'Over coffee, my colleague mentioned the buyback clause might touch on sensitive ownership structures. Perhaps we explore a softer formulation?',
  },
  // ── 高级定制追加 ──
  {
    id: 'scene-custom-1',
    title: '定制：政策性银行三方融资会',
    shortTitle: '三方基础设施融资',
    tier: '定制',
    level: 5,
    desc: '政策性银行 + 外资金融机构 + 地方政府三方基础设施融资会议。',
    roleList: '我(牵头) + 政策性银行 + 外资金融机构 + 地方政府',
    allies: [{ name: '政策性银行', label: '盟友', desc: '愿提供低成本长期资金' }],
    blockers: [{ name: '外资金融机构', label: '阻力', desc: '要求商业条款与政府隐性担保' }],
    neutrals: [{ name: '地方政府', label: '中立', desc: '关注就业与合规审批' }],
    conflicts: ['担保结构', '提款条件'],
    culturalContext: '政府 Hierarchy 高；外资 Direct 要求 transparency；需双语 register 切换。',
    openingLine: 'The offshore lender wants explicit sovereign comfort language. Policy bank needs to stay within regulatory guidance—where is the middle ground?',
  },
  {
    id: 'scene-custom-2',
    title: '定制：海外并购整合会',
    shortTitle: '海外并购整合会',
    tier: '定制',
    level: 5,
    desc: '买方代表 + 被收购方原CEO + 外籍法律顾问 + 员工代表四方博弈。',
    roleList: '我(买方) + 原CEO + 外籍法律顾问 + 员工代表',
    allies: [{ name: '投行 FA', label: '中立', desc: '找价差空间，靠佣金驱动防破裂' }],
    blockers: [{ name: '原CEO', label: '阻力', desc: '以协同溢价模糊财务缺口' }],
    neutrals: [{ name: '员工代表', label: '中立', desc: '关注裁员与文化冲突' }],
    conflicts: ['4700万诉讼', '人员整合'],
    culturalContext: '英系保守主义（Risk-averse）。极端注重细节与免责声明。',
    openingLine: 'Employee council submitted questions on retention packages. Legal wants indemnities signed before we discuss synergy targets.',
  },
  {
    id: 'scene-custom-3',
    title: '定制：跨境合规检查',
    shortTitle: '跨境合规检查',
    tier: '定制',
    level: 5,
    desc: '监管官员 + 我 + 外籍审计师三方合规对话。',
    roleList: '我 + 监管官员 + 外籍审计师',
    allies: [{ name: '内审总监', label: '盟友', desc: '已准备整改路线图' }],
    blockers: [{ name: '监管官员', label: '阻力', desc: '质疑数据跨境传输合规' }],
    neutrals: [{ name: '外籍审计师', label: '中立', desc: '按 IFRS 标准客观陈述' }],
    conflicts: ['数据跨境', '审计意见'],
    culturalContext: 'Regulation-first，官员表述正式；审计师 Direct 引用条文。',
    openingLine: 'Our inspection note cites gaps in cross-border data mapping. Please walk us through your Article 28 equivalent safeguards.',
  },
  {
    id: 'scene-custom-4',
    title: '定制：国际行业峰会 Q&A',
    shortTitle: '国际行业峰会',
    tier: '定制',
    level: 5,
    desc: '作为演讲者面对台下多角色切换提问。',
    roleList: '我(演讲者) + 投资者 + 竞争对手 + 媒体记者',
    allies: [{ name: '行业分析师', label: '盟友', desc: '抛出友好问题帮铺垫' }],
    blockers: [{ name: '竞争对手', label: '阻力', desc: '尖锐质疑技术路线' }, { name: '媒体记者', label: '阻力', desc: '陷阱式提问' }],
    neutrals: [{ name: '投资者', label: '中立', desc: '关注 ROI 与 risk' }],
    conflicts: ['技术路线', '估值预期'],
    culturalContext: '欧美峰会 Direct Q&A；需快速切换对象并保持风度。',
    openingLine: 'Your slide showed 40% cost reduction, but our due diligence suggests the baseline was inflated. How do you respond?',
  },
  {
    id: 'scene-custom-5',
    title: '定制：远程团队管理',
    shortTitle: '远程团队管理',
    tier: '定制',
    level: 4,
    desc: '东南亚下属 + 东欧技术主管 + 美国产品经理跨时区协调。',
    roleList: '我 + 东南亚下属 + 东欧技术主管 + 美国产品经理',
    allies: [{ name: '东南亚下属', label: '盟友', desc: '执行力强，需清晰 deadline' }],
    blockers: [{ name: '美国产品经理', label: '阻力', desc: '频繁变更需求' }],
    neutrals: [{ name: '东欧技术主管', label: '中立', desc: '关注架构稳定与文档' }],
    conflicts: ['需求变更', '交付节奏'],
    culturalContext: '美国 Direct feedback；东南亚 High-context；东欧注重流程与文档。',
    openingLine: "Product pushed another scope change at midnight our time. Engineering in Warsaw wasn't consulted—this can't be the norm.",
  },
  // ── 保留经典场景 ──
  {
    id: 'scene-4',
    title: '高阶：跨国并购尽调对话',
    shortTitle: '跨国并购尽调',
    tier: '高阶',
    level: 5,
    desc: '发现标的方隐瞒 4700 万美元专利诉讼，高压博弈估值调整。',
    roleList: '我(买方) + 投行FA + 标的CEO + 买方CFO',
    allies: [{ name: '投行 FA', label: '中立', desc: '找价差空间，靠佣金驱动防破裂' }],
    blockers: [{ name: '标的 CEO', label: '阻力', desc: '以协同溢价模糊财务缺口' }],
    neutrals: [{ name: '买方 CFO', label: '对立', desc: '要求拆分财务，隔离争议资产' }],
    conflicts: ['4700万诉讼', '估值下调'],
    culturalContext: '英系保守主义（Risk-averse）。极端注重细节与免责声明。',
    openingLine: 'We found an undisclosed patent suit worth forty-seven million. Your synergy deck assumes zero litigation reserve—that needs revisiting.',
  },
  {
    id: 'scene-5',
    title: '高阶：董事会战略否决博弈',
    shortTitle: '董事会战略否决',
    tier: '高阶',
    level: 5,
    desc: 'CEO 提案 6 亿美元出海战略，遭大股东联合否决，独立董事成关键票。',
    roleList: '我(CEO团队) + 创始人CEO + 大股东 + 独立董事',
    allies: [{ name: '创始人 CEO', label: '盟友', desc: '诉诸竞争威胁，争情感逻辑双支持' }],
    blockers: [{ name: '大股东', label: '阻力', desc: '死守 ROE 红线，欲换血管理层' }],
    neutrals: [{ name: '独立董事', label: '关键', desc: '只看程序合规与受托责任边界' }],
    conflicts: ['6亿预算', '管理权争夺'],
    culturalContext: '多边复合博弈（Consensus-building）。需识别中、美、欧不同利益方诉求。',
    openingLine: 'Major shareholders reject the six-billion overseas plan unless ROE targets are guaranteed. Independent directors want a fiduciary memo first.',
  },
];

const ROLE_SWITCH_INSTRUCTION = `你必须同时跟踪多个角色立场：识别盟友与阻力；每轮明确 role_address（当前面向谁说话）；可表现联合施压(joint_pressure)或暗中协助；管理会议节奏（引导、打断、总结、推进）。返回 JSON 须含 role_address、branch_suggestions、difficulty_rating、cultural_signal 及四维 feedback_* 字段。`;

function getVocabZoneFromScene(sceneTitle: string): 'business' | 'general' {
  const businessKeywords = [
    '谈判', '并购', '银团', '董事会', '合规', '审计', '尽调',
    '贷款', '利率', '抵押', '股权', 'IPO', '融资', '授信',
    '监管', '估值', 'IRR', 'ROE', 'ESG', '担保', '提款',
    '参团行', '牵头行', 'CFO', 'CEO', '总监', '负责人', '基础设施',
  ];
  return businessKeywords.some(kw => sceneTitle.includes(kw)) ? 'business' : 'general';
}

function getSpeakerStyle(speaker: string, scene: SceneEntry): 'ally' | 'blocker' | 'neutral' | 'joint' {
  const s = speaker.toLowerCase();
  const allyHit = scene.allies.some(r => s.includes(r.name.toLowerCase()));
  const blockerHit = scene.blockers.some(r => s.includes(r.name.toLowerCase()));
  if (allyHit && blockerHit) return 'joint';
  if (allyHit) return 'ally';
  if (blockerHit) return 'blocker';
  return 'neutral';
}

const SPEAKER_STYLE_CLASS: Record<string, string> = {
  ally: 'bg-emerald-600 text-white',
  blocker: 'bg-red-600 text-white',
  neutral: 'bg-gray-600 text-white',
  joint: 'bg-gradient-to-r from-red-600 to-emerald-600 text-white',
};

function safeText(value: unknown) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseBranchList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  const text = safeText(raw);
  if (!text) return [];
  return text.split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
}

function parseTemplateList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  const text = safeText(raw);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch { /* ignore */ }
  return text.split(/\n|;/).map(s => s.trim().replace(/^[\d.)\-]+\s*/, '')).filter(s => s.length > 10);
}

function extractFlawType(flawText: string): string {
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
  return '逻辑破绽';
}

function renderStars(level: number) {
  return Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className={`w-3 h-3 ${i < level ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
  ));
}

interface MessageItem {
  id: string;
  role: 'user' | 'ai';
  content: string;
  parsed?: ParsedAiResponse | null;
}

function stripMarkdownJson(text: string) {
  return String(text || '').replace(/```json/g, '').replace(/```/g, '').trim();
}

function parseAiPayload(raw: string): ParsedAiResponse | null {
  try {
    return JSON.parse(stripMarkdownJson(raw));
  } catch {
    return null;
  }
}

interface OralWarRoomProps {
  embedded?: boolean;
  /** 与 training_attempts.scene_type 对齐，用于主题通关统计 */
  sceneTheme?: string;
  sessionId?: string | null;
  userId?: string;
  onOralRoundLogged?: () => void;
}

export default function OralWarRoom({
  embedded = false,
  sceneTheme = '',
  sessionId = null,
  userId = 'default-user',
  onOralRoundLogged,
}: OralWarRoomProps) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [lastNotice, setLastNotice] = useState('沙盘已就绪，AI 角色即将开场。');
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── 积分与漏洞植入状态 ────────────────────────────────────
  const [combatPoints, setCombatPoints] = useState(() => Number(localStorage.getItem('oral_combat_points') || '0'));
  const [showGoldGlow, setShowGoldGlow] = useState(false);
  const [isLoopholePlanted, setIsLoopholePlanted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [briefCollapsed, setBriefCollapsed] = useState(true);
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);
  const [showIntelDetails, setShowIntelDetails] = useState(false);
  const [latestFeedback, setLatestFeedback] = useState<ParsedAiResponse | null>(null);
  const [flawTemplates, setFlawTemplates] = useState<string[]>([]);
  const [currentFlawType, setCurrentFlawType] = useState('');
  const [currentFlawClaim, setCurrentFlawClaim] = useState('');
  const [currentDifficulty, setCurrentDifficulty] = useState<number | null>(null);
  const sceneInitRef = useRef<string | null>(null);

  useEffect(() => {
    localStorage.setItem('oral_combat_points', String(combatPoints));
  }, [combatPoints]);

  // ── 弱点日志与 XP 联动状态 ────────────────────────────────────
  const [weaknessLog, setWeaknessLog] = useState<Array<{ scene: string; flaw: string; timestamp: number }>>(() => {
    try {
      const logs = localStorage.getItem('user_weakness_log');
      return logs ? JSON.parse(logs) : [];
    } catch {
      return [];
    }
  });

  // 监听来自其他标签页的 XP 更新事件
  useEffect(() => {
    const handleXpUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.xp === 'number') {
        setCombatPoints(customEvent.detail.xp);
      }
    };
    window.addEventListener('xp-updated', handleXpUpdated);
    return () => window.removeEventListener('xp-updated', handleXpUpdated);
  }, []);

  // 监听弱点日志更新事件
  useEffect(() => {
    const handleWeaknessUpdated = () => {
      try {
        const logs = localStorage.getItem('user_weakness_log');
        if (logs) {
          setWeaknessLog(JSON.parse(logs));
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('weakness-updated', handleWeaknessUpdated);
    return () => window.removeEventListener('weakness-updated', handleWeaknessUpdated);
  }, []);

  // ── 划线取词入库 state ────────────────────────────────────
  const [highlightedWord, setHighlightedWord] = useState('');
  const [highlightPos, setHighlightPos] = useState<{ x: number; y: number } | null>(null);
  const [isAddingWord, setIsAddingWord] = useState(false);
  const [addWordResult, setAddWordResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const sceneThemeRef = useRef(sceneTheme);
  useEffect(() => { sceneThemeRef.current = sceneTheme; }, [sceneTheme]);

  const handleDialogueMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (text.length >= 2 && text.length <= 60 && /^[a-zA-Z\s\-',.]+$/.test(text) && text.split(/\s+/).length <= 5) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setHighlightedWord(text);
      setHighlightPos({ x: rect.left + rect.width / 2, y: rect.top - 52 });
      setAddWordResult(null);
    }
  };

  const handleAddHighlightedWord = async () => {
    if (!highlightedWord || isAddingWord) return;
    setIsAddingWord(true);
    try {
      const zone = getVocabZoneFromScene(activeScene.title);
      await addWord({
        word: highlightedWord,
        dictType: 'oral-highlight',
        category: zone,
        payload: {
          source: 'oral_warroom',
          theme: sceneThemeRef.current,
          scene_id: activeSceneId,
          scene_title: activeScene.title,
          auto_zone: zone,
        },
      });
      window.dispatchEvent(new Event('vocab-updated'));
      setAddWordResult({ ok: true, msg: `"${highlightedWord}" 已入库[${zone === 'business' ? '政商务区' : '全场景区'}]` });
      setTimeout(() => { setHighlightedWord(''); setHighlightPos(null); setAddWordResult(null); }, 2500);
    } catch {
      setAddWordResult({ ok: false, msg: '入库失败，请重试' });
      setTimeout(() => { setAddWordResult(null); }, 2000);
    } finally {
      setIsAddingWord(false);
    }
  };
  // ─────────────────────────────────────────────────────────

  // ── 语音引擎 & 高压倒计时 ─────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(10);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingTextRef = useRef('');

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSpeechSupported(true);
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      pendingTextRef.current = transcript;
      setInputText(transcript);
    };
    rec.onerror = () => stopRecording();
    recognitionRef.current = rec;
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsRecording(false);
    recognitionRef.current?.stop();
  }, []);

  const startRecording = useCallback(() => {
    if (!recognitionRef.current || isSending) return;
    pendingTextRef.current = '';
    setInputText('');
    setRecordingTime(10);
    setIsRecording(true);
    try { recognitionRef.current.start(); } catch { return; }
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev <= 1) {
          stopRecording();
          // 倒计时耗尽：自动截断并发送
          setTimeout(() => {
            const text = pendingTextRef.current.trim();
            if (text) {
              setInputText(text);
              handleSendWithText(text);
            }
          }, 550);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [isSending, stopRecording]);

  // 松手即发送：直接传文本给 handleSend，不依赖异步 state
  const stopRecordingAndSend = useCallback(() => {
    stopRecording();
    setTimeout(() => {
      const text = pendingTextRef.current.trim();
      if (text) {
        setInputText(text);
        // 直接传入文本，不等待 inputText state 更新
        handleSendWithText(text);
      }
    }, 550);
  }, [stopRecording]);
  // ─────────────────────────────────────────────────────────

  // 场景引擎 State
  // 新增：全局 theme 到场景 ID 的映射
  const themeToSceneMap: Record<string, string> = {
    '商务谈判：让步与施压': 'scene-1',
    '危机公关：外媒答疑': 'scene-2',
    '项目汇报：跨国董事会': 'scene-5',
  };

  const [activeSceneId, setActiveSceneId] = useState(() => {
    if (embedded && sceneTheme) {
      return themeToSceneMap[sceneTheme] || 'dynamic-scene';
    }
    return 'scene-1';
  });

  useEffect(() => {
    if (embedded && sceneTheme) {
      const nextId = themeToSceneMap[sceneTheme] || 'dynamic-scene';
      if (nextId !== activeSceneId) {
        setActiveSceneId(nextId);
        setMessages([]);
        setConversationId(null);
        setIsLoopholePlanted(false);
        setLastNotice(`已根据全局指令切换战局。进入：${sceneTheme}`);
      }
    }
  }, [embedded, sceneTheme, activeSceneId]);

  const activeScene = useMemo((): SceneEntry => {
    if (activeSceneId === 'dynamic-scene') {
      return {
        id: 'dynamic-scene',
        title: `当前阵地：${sceneTheme}`,
        shortTitle: sceneTheme.split('：')[1] || sceneTheme,
        tier: '高阶',
        level: 4,
        desc: `围绕核心阵地【${sceneTheme}】展开的高压口语对抗。`,
        roleList: `我 + 业务助攻 + 施压方 + 关键决策人`,
        allies: [{ name: '业务助攻', label: '盟友', desc: '尝试推进流程' }],
        blockers: [{ name: '施压方', label: '阻力', desc: '抛出尖锐问题' }],
        neutrals: [{ name: '关键决策人', label: '中立', desc: '观察您的表现' }],
        conflicts: [sceneTheme.split('：')[0] || sceneTheme],
        culturalContext: '根据当前跨文化主题，精准把握商务分寸与情感张力。',
        openingLine: 'We need to address the core issue before this meeting runs over time. What is your position?',
      };
    }
    return SCENE_DATABASE.find(s => s.id === activeSceneId)!;
  }, [activeSceneId, sceneTheme]);

  const buildOralContext = useCallback((scene: SceneEntry): OralChatContext => ({
    scene_title: scene.shortTitle,
    roles: scene.roleList,
    cultural_context: scene.culturalContext,
    conflicts: scene.conflicts.join(' / '),
    role_switch_instruction: ROLE_SWITCH_INSTRUCTION,
    scene_level: scene.level,
  }), []);

  const processAiResponse = useCallback((parsed: ParsedAiResponse | null, content: string, wasLoopholeActive: boolean) => {
    if (parsed?.difficulty_rating) {
      const lvl = Number(safeText(parsed.difficulty_rating).replace(/\D/g, ''));
      if (lvl >= 1 && lvl <= 5) setCurrentDifficulty(lvl);
    }
    if (parsed) setLatestFeedback(parsed);

    let evaluatedSuccess = false;

    if (wasLoopholeActive) {
      const evalText = safeText(parsed?.evaluation || parsed?.feedback_strategy || '');
      const templates = flawTemplates.length ? flawTemplates : parseTemplateList(parsed?.counter_question_templates);
      const successFromAI = evalText.includes('【破绽反击成功】') || evalText.includes('反击成功') || evalText.includes('指出破绽');
      const successFromUserKeywords = /fallacy|flaw|contradict|loophole|concept-switching|causal|reversal|clarify the contradiction|what evidence|conflating correlation|post hoc|evasive|vague/i.test(content);
      const successFromTemplates = templates.some(t => {
        const snippet = t.slice(0, 30).toLowerCase();
        return snippet.length > 10 && content.toLowerCase().includes(snippet.slice(0, 15));
      });

      if (successFromAI || successFromUserKeywords || successFromTemplates) {
        setCombatPoints(prev => prev + 50);
        if (parsed?.flaw_point) {
          try {
            const existingWeaknesses = JSON.parse(localStorage.getItem('user_weakness_log') || '[]');
            existingWeaknesses.push({ scene: activeScene.title, flaw: safeText(parsed.flaw_point), timestamp: Date.now() });
            localStorage.setItem('user_weakness_log', JSON.stringify(existingWeaknesses));
            setWeaknessLog(existingWeaknesses);
            window.dispatchEvent(new Event('weakness-updated'));
          } catch { /* ignore */ }
        }
        setShowGoldGlow(true);
        setShowConfetti(true);
        playSuccess();
        setTimeout(() => setShowGoldGlow(false), 3000);
        setLastNotice('破绽反击成功！获得 +50 XP!');
        evaluatedSuccess = true;
        setFlawTemplates([]);
        setCurrentFlawType('');
        setCurrentFlawClaim('');
      } else {
        playError();
        setLastNotice('未成功指出破绽，继续加油！');
      }
      setIsLoopholePlanted(false);
    }

    if (parsed?.flaw_point) {
      const flawText = safeText(parsed.flaw_point);
      if (!flawText || flawText === '未识别到破绽') {
        if (!wasLoopholeActive) setLastNotice('已收到回应，继续追问。');
        return evaluatedSuccess;
      }
      try {
        const existingWeaknesses = JSON.parse(localStorage.getItem('user_weakness_log') || '[]');
        const alreadyLogged = existingWeaknesses.some((w: { flaw: string }) => w.flaw === flawText);
        if (!alreadyLogged) {
          existingWeaknesses.push({ scene: activeScene.title, flaw: flawText, timestamp: Date.now() });
          localStorage.setItem('user_weakness_log', JSON.stringify(existingWeaknesses));
          setWeaknessLog(existingWeaknesses);
          window.dispatchEvent(new Event('weakness-updated'));
        }
      } catch { /* ignore */ }
      setIsLoopholePlanted(true);
      setCurrentFlawType(extractFlawType(flawText));
      setCurrentFlawClaim(flawText);
      const templates = parseTemplateList(parsed.counter_question_templates);
      if (templates.length) setFlawTemplates(templates);
      else setFlawTemplates([
        'Could you clarify the contradiction between...?',
        'That seems like a post hoc fallacy. What evidence supports that link?',
        'Are you conflating correlation with causation here?',
      ]);
      if (wasLoopholeActive && !evaluatedSuccess) {
        setLastNotice('上轮未成功指出破绽。侦测到对手新发言存在逻辑漏洞！请重新进行针对性反击。');
      } else if (!wasLoopholeActive) {
        setLastNotice('侦测到对手发言存在逻辑漏洞！请进行针对性反击。');
      }
    } else if (!wasLoopholeActive) {
      setLastNotice('已收到回应，继续追问。');
    }

    return evaluatedSuccess;
  }, [activeScene.title, flawTemplates]);

  const initiateSceneDialogue = useCallback(async (scene: SceneEntry) => {
    if (isSending) return;
    setIsSending(true);
    setLastNotice('对手角色正在开场...');
    const diff = localStorage.getItem('super_agent_global_diff') || 'standard';
    const difficultyPrefix = diff === 'hardcore' ? '【全局指令：极限施压模式】\n' : '';
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
    } catch (error) {
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
  }, [isSending, userId, buildOralContext, processAiResponse]);

  const handleSceneSelect = (sceneId: string) => {
    const scene = SCENE_DATABASE.find(s => s.id === sceneId);
    if (!scene) return;
    setActiveSceneId(sceneId);
    setMessages([]);
    setConversationId(null);
    setIsLoopholePlanted(false);
    setFlawTemplates([]);
    setCurrentFlawType('');
    setCurrentFlawClaim('');
    setLatestFeedback(null);
    sceneInitRef.current = sceneId;
    setLastNotice(`已重置战局。进入：${scene.shortTitle}`);
    void initiateSceneDialogue(scene);
  };

  useEffect(() => {
    if (embedded) return;
    if (sceneInitRef.current === activeSceneId) return;
    sceneInitRef.current = activeSceneId;
    void initiateSceneDialogue(activeScene);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };
  // 核心发送逻辑（接受显式文本，不依赖 inputText state 异步更新）
  const handleSendWithText = async (forceContent: string) => {
    const content = forceContent.trim();
    if (!content || isSending) return;

    const currentRound = messages.length;

    // === 核心机制：如果是第一句话，强制注入场景切换指令 ===
    let apiPayload = content;
    const diff = localStorage.getItem('super_agent_global_diff') || 'standard';
    const difficultyPrefix = diff === 'hardcore' ? '【全局指令：当前为极限施压模式，请在回复中表现出极强的压迫感、敌意与找破绽倾向，不可轻易让步。】\n' : '';

    let loopholeInstruction = '';
    if (isLoopholePlanted) {
      loopholeInstruction = `\n[系统隐性指令：用户已指出上一轮的破绽。请在本轮评估中，检查用户是否用英语准确指出了逻辑漏洞并设计了兼顾商务分寸的提问。如果是，请在返回的 JSON 的 evaluation 字段中包含『【破绽反击成功】』字样。]`;
    } else {
      const flawTypes = ['causal_fallacy', 'overgeneralization', 'false_equivalence', 'evasive_argument', 'shifting_burden'];
      const flawType = flawTypes[currentRound % flawTypes.length];
      const flawDescriptions: Record<string, string> = {
        causal_fallacy: '植入一个因果倒置的论点（例如："因为我们拒绝了涨价，所以产品质量一定下降了"）',
        overgeneralization: '植入一个以偏概全的论点（例如："上次这个供应商出了问题，所以他们全部都不靠谱"）',
        false_equivalence: '植入一个虚假等同的论点（例如："我们的合规成本和他们的报价差异是同等重要的"）',
        evasive_argument: '植入一个避重就轻的回答（例如：用程序正义回避实质问题）',
        shifting_burden: '植入一个偷换举证责任的论点（例如："如果你不能证明我们有问题，那就是我们没问题"）',
      };
      loopholeInstruction = `\n[系统隐性指令：请在本次回复的 dialogue 中，刻意植入一个【${flawType}】类型的逻辑漏洞。具体表现为：${flawDescriptions[flawType]}。你必须在返回的 JSON 的 flaw_point 字段中，明确且详细地指出漏洞类型（${flawType}）和具体内容。同时，请在 counter_question_templates 字段中提供 3-5 条推荐的英语反问句式。跨文化语境：${activeScene.culturalContext}]`;
    }

    const culturalInjection = `\n[跨文化语境：${activeScene.culturalContext}]`;
    if (currentRound === 0) {
       const sceneNameForAI = activeSceneId === 'dynamic-scene' ? sceneTheme : activeScene.shortTitle;
       apiPayload = `[系统隐性指令：切换场景 ${sceneNameForAI}，角色：${activeScene.roleList}]\n${difficultyPrefix}${culturalInjection}${ROLE_SWITCH_INSTRUCTION}\n用户发言：${content}${loopholeInstruction}`;
    } else {
       apiPayload = `${difficultyPrefix}${culturalInjection}\n用户发言：${content}${loopholeInstruction}`;
    }

    const userMsg: MessageItem = { id: `${Date.now()}-u`, role: 'user', content };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    pendingTextRef.current = '';
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
      scrollToBottom();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '对话失败';
      setLastNotice(msg);
    } finally {
      setIsSending(false);
    }
  };


  // 键盘发送：读取当前 inputText state
  const handleSend = () => handleSendWithText(inputText);

  const latestExchange = useMemo(() => {
    const aiMessages = messages.filter(m => m.role === 'ai');
    const userMessages = messages.filter(m => m.role === 'user');
    const lastAi = aiMessages[aiMessages.length - 1];
    const lastUser = userMessages[userMessages.length - 1];
    return {
      aiDialogue: lastAi?.parsed ? safeText(lastAi.parsed.dialogue) : '',
      aiSpeaker: lastAi?.parsed ? safeText(lastAi.parsed.current_speaker) : '',
      roleAddress: lastAi?.parsed ? safeText(lastAi.parsed.role_address) : '',
      userText: lastUser?.content || '',
      turnCount: messages.length,
    };
  }, [messages]);

  const content = (
    <div className="bg-[#f8f9fa] rounded-[2rem] xl:rounded-[2.5rem] p-3 sm:p-4 md:p-6 border border-gray-100 shadow-sm relative">
      {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
      
      {/* 战术使用指南 SOP */}
      <div className="bg-indigo-50/30 border-l-4 border-indigo-500 rounded-r-2xl p-5 flex items-start gap-4 shrink-0 shadow-sm mb-4">
        <div className="bg-indigo-600 text-white p-2.5 rounded-xl shrink-0 mt-0.5 shadow-md">
           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
        </div>
        <div className="flex-1">
          <h5 className="text-[11px] font-black uppercase tracking-widest text-indigo-900 mb-1">战术使用指南 // Tactical SOP</h5>
          <p className="text-xs text-indigo-800/80 font-medium">请遵循以下战术指南，以最大化利用本模块的高阶商业实战材料与AI提纯引擎。</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-left">
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-all duration-300 transform hover:-translate-y-0.5">
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">操作说明：</span>长按下方麦克风语音反击，或打字回复。沙盘会根据当前 Theme 自动锁定剧本。倒计时 10 秒内必须给出回应。</p>
            </div>
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-all duration-300 transform translate-y-1 hover:translate-y-0.5">
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">功能亮点：</span>多方势力动态对抗。AI 同步扮演发难者与盟友，对您进行跨文化和权力的双重极限施压。</p>
            </div>
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-all duration-300 transform -translate-y-0.5 hover:translate-y-[-4px]">
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">生态定位：</span>【肌肉记忆】消化所有前置弹药。强迫您在毫秒级的高压对抗中，建立直觉性的、不打草稿的商务谈判反击能力。</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* 场景库卡片网格 */}
      {!embedded && (
        <div className="mb-4 bg-white px-5 py-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-black text-[#FF5722] tracking-widest uppercase mb-3">
            <Globe className="w-4 h-4" /> 场景库 SCENE LIBRARY
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 max-h-[200px] overflow-y-auto pr-1">
            {SCENE_DATABASE.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSceneSelect(s.id)}
                className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  activeSceneId === s.id
                    ? 'border-[#FF5722] bg-[#FF5722]/5 ring-2 ring-[#FF5722]/30'
                    : 'border-gray-200 bg-[#f8f9fa] hover:border-[#FF5722]/50'
                }`}
              >
                <div className="text-[10px] font-black text-[#202124] leading-tight mb-1 line-clamp-2">{s.shortTitle}</div>
                <div className="flex items-center gap-0.5 mb-1">{renderStars(s.level)}</div>
                <span className="text-[8px] font-bold uppercase tracking-wider text-gray-400">{s.tier}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 2xl:grid-cols-12 gap-4 xl:gap-6 h-auto 2xl:h-[760px]">
        {/* 左翼：局势面板 (动态读取 activeScene) */}
        <aside className="2xl:col-span-4 flex flex-col gap-4 h-full">
          <div className="bg-[#202124] text-white rounded-[1.5rem] xl:rounded-[2rem] p-5 xl:p-6 shadow-lg relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-36 h-36 bg-[#FF5722]/15 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-[#FF5722]" /> 当前局势 (Situation)
              </div>
              <h3 className="text-xl font-black leading-tight mb-2">{activeScene.shortTitle}</h3>
              <div className="flex items-center gap-2 mb-2">{renderStars(activeScene.level)}</div>
              <p className="text-xs text-gray-300 leading-relaxed">{activeScene.desc}</p>
            </div>
          </div>

          <div className="bg-white rounded-[1.5rem] xl:rounded-[2rem] p-5 xl:p-6 border border-gray-100 shadow-sm flex-1 overflow-y-auto">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#202124] flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-[#FF5722]" /> 核心参局者 (Stakeholders)
            </div>
            <div className="space-y-3">
              {activeScene.allies.map(r => (
                <div key={r.name} className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 relative">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-black text-emerald-900">{r.name}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">{r.label}</span>
                  </div>
                  <p className="text-[11px] text-emerald-700">{r.desc}</p>
                </div>
              ))}
              {activeScene.blockers.map(r => (
                <div key={r.name} className="rounded-xl border border-red-100 bg-red-50 p-3 relative">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-black text-red-900">{r.name}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-200 text-red-800">{r.label}</span>
                  </div>
                  <p className="text-[11px] text-red-700">{r.desc}</p>
                </div>
              ))}
              {activeScene.neutrals.map(r => (
                <div key={r.name} className="rounded-xl border border-gray-200 bg-gray-50 p-3 relative">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-black text-gray-700">{r.name}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">{r.label}</span>
                  </div>
                  <p className="text-[11px] text-gray-500">{r.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 跨文化语境预警 */}
          {activeScene.culturalContext && (
            <div className="bg-purple-50 rounded-3xl p-6 border border-purple-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
              <h3 className="text-sm font-black text-purple-900 uppercase tracking-widest mb-4 flex items-center">
                <Globe className="w-4 h-4 mr-2" /> 跨文化预警 (Cultural Context)
              </h3>
              <p className="text-sm text-purple-800 leading-relaxed font-medium">{activeScene.culturalContext}</p>
            </div>
          )}

          {/* 跨文化雷达 */}
          <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-3xl p-5 border border-gray-200 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-600 mb-3 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> 跨文化雷达
            </h3>
            <div className="space-y-2">
              {[
                { label: '直接 vs 委婉', value: activeScene.culturalContext?.includes('Direct') ? 80 : activeScene.culturalContext?.includes('委婉') ? 20 : 50, color: 'bg-blue-500' },
                { label: '权力距离', value: activeScene.culturalContext?.includes('Hierarchy') || activeScene.culturalContext?.includes('等级') ? 85 : 50, color: 'bg-amber-500' },
                { label: '不确定性规避', value: activeScene.culturalContext?.includes('合规') || activeScene.culturalContext?.includes('Regulation') ? 80 : 50, color: 'bg-emerald-500' },
              ].map((dim, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-500 w-24 shrink-0">{dim.label}</span>
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full ${dim.color} rounded-full transition-all duration-500`} style={{ width: `${dim.value}%` }} />
                  </div>
                  <span className="text-[10px] font-black text-gray-600 w-8 text-right">{dim.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* 战场动态情报 */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">冲突点</div>
            <div className="flex flex-wrap gap-2">
              {activeScene.conflicts.map(c => (
                <span key={c} className="px-3 py-1 rounded-full bg-[#FF5722]/10 text-[#FF5722] text-[11px] font-black uppercase tracking-widest">{c}</span>
              ))}
            </div>
          </div>
        </aside>

        <section className="2xl:col-span-8 flex flex-col bg-white rounded-[1.5rem] xl:rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden min-h-[520px] h-[min(820px,calc(100dvh-7rem))] 2xl:h-[min(860px,calc(100dvh-6rem))]">
          <div className="shrink-0 px-4 py-3 border-b border-gray-100 bg-[#f8f9fa] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[#FF5722] mb-0.5">对抗通信通道</div>
              <h4 className="text-base font-black text-[#202124]">对话主线 · 实时掌控</h4>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap justify-end">
              <button
                type="button"
                onClick={() => setBriefCollapsed(v => !v)}
                className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-[#FF5722] cursor-pointer"
              >
                {briefCollapsed ? '战术简报' : '收起简报'}
              </button>
              <button
                type="button"
                onClick={() => setShowIntelDetails(v => !v)}
                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border cursor-pointer ${
                  showIntelDetails ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-gray-200 bg-white text-gray-600 hover:border-violet-300'
                }`}
              >
                {showIntelDetails ? '收起分析' : '展开分析'}
              </button>
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white font-black text-[10px] tracking-widest shadow-md transition-all ${
                  showGoldGlow
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 ring-2 ring-yellow-300 scale-105'
                    : 'bg-slate-900 border border-slate-800'
                }`}
              >
                <Trophy className="w-3 h-3" />
                <span>{combatPoints} XP</span>
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 bg-white rounded-full px-2.5 py-1.5 border border-gray-200">
                {isSending ? '推演中' : '待命'}
              </div>
            </div>
          </div>

          {/* 固定对话主线 — 始终可见，无需滚动 */}
          <div className="shrink-0 border-b border-gray-200 bg-gradient-to-br from-[#202124] via-slate-900 to-[#2a2a2e] text-white px-4 py-4">
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
                <div className="flex flex-wrap items-center gap-2">
                  {latestExchange.aiSpeaker && (
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/10 text-emerald-300">
                      {latestExchange.aiSpeaker}
                    </span>
                  )}
                  {latestExchange.roleAddress && (
                    <span className="text-[10px] font-bold text-violet-300">→ {latestExchange.roleAddress}</span>
                  )}
                </div>
                <p
                  className="text-base sm:text-lg font-medium italic leading-relaxed text-white/95 select-text cursor-text"
                  onMouseUp={handleDialogueMouseUp}
                >
                  &ldquo;{latestExchange.aiDialogue}&rdquo;
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">
                {isSending ? '对手角色正在开场...' : '等待 AI 率先开口...'}
              </p>
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
            <div className="shrink-0 max-h-[140px] overflow-y-auto border-b border-gray-100 bg-white px-4 py-3 text-xs space-y-1.5">
              <div><span className="font-black text-gray-400">场景 </span><span className="font-bold">{activeScene.shortTitle}</span></div>
              <div className="line-clamp-2"><span className="font-black text-gray-400">角色 </span>{activeScene.roleList}</div>
              <div className="flex flex-wrap gap-1 items-center">
                <span className="font-black text-gray-400">冲突 </span>
                {activeScene.conflicts.map(c => (
                  <span key={c} className="px-1.5 py-0.5 rounded-full bg-[#FF5722]/10 text-[#FF5722] text-[9px] font-black">{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* 对话历史 — 紧凑时间线，分析详情按需展开 */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 bg-gradient-to-b from-white to-[#f8f9fa]">
            {messages.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-4">历史记录将显示于此</p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'user' ? (
                    <div className="max-w-[88%] rounded-2xl rounded-tr-sm bg-[#202124] text-white px-3 py-2 shadow-sm">
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="w-full max-w-[92%] rounded-2xl rounded-tl-sm bg-white border border-gray-100 px-3 py-2 shadow-sm">
                      {msg.parsed ? (
                        <>
                          <div className="flex items-center gap-2 mb-1">
                            {(() => {
                              const speaker = safeText(msg.parsed.current_speaker);
                              const style = getSpeakerStyle(speaker, activeScene);
                              return (
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${SPEAKER_STYLE_CLASS[style]}`}>
                                  {speaker}
                                </span>
                              );
                            })()}
                            <SpeakButton text={safeText(msg.parsed.dialogue)} title="播放" />
                          </div>
                          <p
                            className="text-sm leading-relaxed text-[#202124] italic select-text cursor-text"
                            onMouseUp={handleDialogueMouseUp}
                          >
                            &ldquo;{safeText(msg.parsed.dialogue)}&rdquo;
                          </p>
                          {showIntelDetails && (
                            <div className="mt-2 pt-2 border-t border-gray-100 space-y-2 text-xs">
                              <p className="text-blue-800"><span className="font-black text-blue-600">意图 </span>{safeText(msg.parsed.hidden_intent)}</p>
                              {safeText(msg.parsed.flaw_point) && safeText(msg.parsed.flaw_point) !== '未识别到破绽' && (
                                <p className="text-red-800"><span className="font-black text-red-600">破绽 </span>{safeText(msg.parsed.flaw_point)}</p>
                              )}
                              {parseBranchList(msg.parsed.branch_suggestions).length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {parseBranchList(msg.parsed.branch_suggestions).map((b, i) => (
                                    <button key={i} type="button" onClick={() => setInputText(b)} className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-50 border border-gray-200 hover:border-[#FF5722] cursor-pointer">
                                      → {b}
                                    </button>
                                  ))}
                                </div>
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
              ))
            )}
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
            <div ref={bottomRef} />
          </div>

          <div className="shrink-0 border-t border-gray-100 p-4 bg-white">
            {/* 多维反馈 — 默认单行进度条，点击展开详情 */}
            {latestFeedback && (latestFeedback.feedback_pronunciation || latestFeedback.feedback_vocab || latestFeedback.feedback_role_switch || latestFeedback.feedback_strategy) && (
              <button
                type="button"
                onClick={() => setFeedbackExpanded(v => !v)}
                className="w-full mb-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-left cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">AI 反馈</span>
                  {feedbackExpanded ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                </div>
                <div className="flex gap-2">
                  {[
                    { key: 'feedback_pronunciation', label: '发音' },
                    { key: 'feedback_vocab', label: '用语' },
                    { key: 'feedback_role_switch', label: '切换' },
                    { key: 'feedback_strategy', label: '策略' },
                  ].map(({ key, label }) => {
                    const val = safeText((latestFeedback as Record<string, unknown>)[key]);
                    if (!val) return null;
                    const pctMatch = val.match(/(\d{1,3})\s*%/);
                    const pct = pctMatch ? Math.min(100, Number(pctMatch[1])) : 70;
                    return (
                      <div key={key} className="flex-1 min-w-0">
                        <div className="text-[8px] font-bold text-gray-400 truncate">{label}</div>
                        <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-[#FF5722] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {feedbackExpanded && (
                  <div className="mt-2 pt-2 border-t border-slate-200 space-y-1 text-[10px] text-gray-600">
                    {['feedback_pronunciation', 'feedback_vocab', 'feedback_role_switch', 'feedback_strategy'].map(key => {
                      const val = safeText((latestFeedback as Record<string, unknown>)[key]);
                      return val ? <p key={key}>{val}</p> : null;
                    })}
                  </div>
                )}
              </button>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="text-sm font-bold text-[#202124]">{lastNotice}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">当前局势：{activeScene.conflicts.join(' / ')}</div>
            </div>
            {isLoopholePlanted && (
              <details className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl mb-2 open:p-3">
                <summary className="px-3 py-2 text-xs font-black uppercase tracking-widest text-amber-800 cursor-pointer list-none flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  侦测到逻辑破绽 — 点击展开反击句式
                </summary>
                <div className="px-3 pb-3 space-y-1.5">
                  {currentFlawType && <p className="text-xs font-bold">类型: {currentFlawType}</p>}
                  {flawTemplates.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button type="button" onClick={() => setInputText(t)} className="flex-1 text-left text-xs italic bg-white/60 rounded-lg px-2 py-1 hover:bg-white cursor-pointer">{t}</button>
                      <button type="button" onClick={() => { void navigator.clipboard.writeText(t); }} className="p-1 rounded bg-white/80 cursor-pointer"><Copy className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </details>
            )}
            <div className="relative flex flex-col">
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
                placeholder={isRecording ? '正在倾听您的反击...' : 'AI 已开场，请用语音或文字回应...'}
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                {/* 麦克风长按按钮 */}
                {speechSupported ? (
                  <button
                    onMouseDown={startRecording}
                    onMouseUp={stopRecordingAndSend}
                    onMouseLeave={() => { if (isRecording) stopRecordingAndSend(); }}
                    onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                    onTouchEnd={(e) => { e.preventDefault(); stopRecordingAndSend(); }}
                    disabled={isSending}
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
                  disabled={isSending || !inputText.trim() || isRecording}
                  className="rounded-2xl bg-[#202124] text-white px-4 py-3 text-xs font-black
                             uppercase tracking-widest hover:bg-[#FF5722] transition-colors
                             disabled:opacity-50 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" /> 发送
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>


      {/* 口语沙盘区：划线取词悬浮入库组件 */}
      {highlightPos && highlightedWord && (
        <div
          style={{ position: "fixed", left: highlightPos.x, top: highlightPos.y, zIndex: 9999, transform: "translateX(-50%)" }}
        >
          {addWordResult ? (
            <span className={`text-xs font-black tracking-widest px-4 py-2.5 rounded-xl border shadow-xl ${addWordResult.ok ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-700 bg-red-50 border-red-200"}`}>{addWordResult.msg}</span>
          ) : (
            <div className="flex items-center gap-2 bg-[#202124] text-white px-4 py-2.5 rounded-xl border border-gray-700 shadow-2xl animate-[fadeIn_0.15s_ease-out]">
              <BookPlus className="w-4 h-4 text-[#FF5722]" />
              <button
                onMouseDown={(e) => { e.preventDefault(); handleAddHighlightedWord(); }}
                className="text-xs font-black uppercase tracking-widest hover:text-[#FF5722] transition-colors cursor-pointer"
              >{isAddingWord ? "入库中.." : ("截获 " + JSON.stringify(highlightedWord.slice(0, 20) + (highlightedWord.length > 20 ? ".." : "")))}</button>
              <button onMouseDown={(e) => { e.preventDefault(); setHighlightedWord(""); setHighlightPos(null); }} className="text-gray-400 hover:text-white text-sm ml-1 cursor-pointer">x</button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <ModuleWrapper
      title="破局 ｜ 多角色口语战争室"
      icon={<Mic className="w-8 h-8" strokeWidth={2.5} />}
      description="左侧常驻显示局势、角色与冲突点；右侧进行多角色对抗对话，并自动标记 AI 返还的逻辑破绽。"
    >
      {content}
    </ModuleWrapper>
  );
}
