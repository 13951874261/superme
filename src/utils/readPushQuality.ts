/** 穿透(读)每日推送字数门禁（与 RD-LEN-01 冻结规格一致） */
export const READ_PUSH_MIN_CHARS = 1500;

export function countReadMaterialChars(text: string): number {
  return String(text || '').replace(/\s+/g, '').length;
}

export interface ReadPushQualityResult {
  charCount: number;
  quality: 'ok' | 'below_standard';
  genreOk: boolean;
  detailOk: boolean;
  partiesOk: boolean;
  citationOk: boolean;
  densityOk: boolean;
  missingReasons: string[];
  qualityNote?: string;
}

// 利益方词表（去重计数）
const PARTY_KEYWORDS = [
  '甲方', '乙方', '监管', '总行', '分行', '某银行', '某企业', '某省', '某市', '某局',
  '某公司', '董事会', '法务', '合规', '对手方', '投资者', '承销商', '发包方', '承包方',
  '租户', '房东', '借款人', '贷款人', '原告', '被告', '管理层', '工会', '供应商'
];

// 摘要套话词表
const CLICHE_KEYWORDS = ['旨在', '高度重视', '统筹兼顾', '综上所述', '本文认为'];

// 条款标记正则
const CLAUSE_REGEX = /(?:第[一二三四五六七八九十百\d]+条|[（(][一二三四五六七八九十\d]+[)）]|^\s*\d+[\.、])/gm;

// 真实文号/法规红线正则
const OFFICIAL_CITATION_REGEX = /(?:(?:国发|国办发|银保监|银发|证监|发改|财税)[〔\[\(\（]\d{4}[〕\]\)\）]\s*(?:\d+号)?|《中华人民共和国[^\n《》]{2,20}法》\s*第[一二三四五六七八九十\d]+条)/g;

export function evaluateReadPushQuality(text: string): ReadPushQualityResult {
  const rawText = String(text || '');
  const charCount = countReadMaterialChars(rawText);

  if (!rawText.trim()) {
    return {
      charCount: 0,
      quality: 'below_standard',
      genreOk: false,
      detailOk: false,
      partiesOk: false,
      citationOk: true,
      densityOk: false,
      missingReasons: ['正文为空'],
      qualityNote: '正文为空',
    };
  }

  // 去掉前缀
  const cleanText = rawText.replace(/^(好的|以下是|为您生成|为你生成)[，：:\s\n]*/i, '');

  // 1. genreOk: 段落数 >= 4 或 条款标记 >= 2；且套话命中 < 3
  const paragraphs = cleanText.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0);
  const clauseMatches = cleanText.match(CLAUSE_REGEX) || [];
  const clauseCount = clauseMatches.length;
  
  let clicheCount = 0;
  for (const cliche of CLICHE_KEYWORDS) {
    const matches = cleanText.match(new RegExp(cliche, 'g'));
    if (matches) {
      clicheCount += matches.length;
    }
  }
  const genreOk = (paragraphs.length >= 4 || clauseCount >= 2) && clicheCount < 3;

  // 2. detailOk: 数字 token >= 3 或 条款标记 >= 2
  const numberMatches = cleanText.match(/\d+(?:\.\d+)?/g) || [];
  const detailOk = numberMatches.length >= 3 || clauseCount >= 2;

  // 3. partiesOk: 利益方去重命中 >= 2
  const matchedParties = new Set<string>();
  for (const party of PARTY_KEYWORDS) {
    if (cleanText.includes(party)) {
      matchedParties.add(party);
    }
  }
  const partiesOk = matchedParties.size >= 2;

  // 4. citationOk: 若匹配真实机关文号形态，且前后 20 字内无「训练」→ 失败
  let citationOk = true;
  let match: RegExpExecArray | null;
  const citationRegex = new RegExp(OFFICIAL_CITATION_REGEX.source, 'g');
  while ((match = citationRegex.exec(cleanText)) !== null) {
    const start = Math.max(0, match.index - 20);
    const end = Math.min(cleanText.length, match.index + match[0].length + 20);
    const surrounding = cleanText.slice(start, end);
    if (!surrounding.includes('训练')) {
      citationOk = false;
      break;
    }
  }

  const densityOk = genreOk && detailOk && partiesOk && citationOk;
  const isLengthOk = charCount >= READ_PUSH_MIN_CHARS;
  const quality: 'ok' | 'below_standard' = (isLengthOk && densityOk) ? 'ok' : 'below_standard';

  const missingReasons: string[] = [];
  if (!isLengthOk) missingReasons.push(`字数不足${READ_PUSH_MIN_CHARS}字`);
  if (!genreOk) missingReasons.push('缺乏原文体裁结构或套话过多');
  if (!detailOk) missingReasons.push('缺具体条款/数据');
  if (!partiesOk) missingReasons.push('缺多方利益主体');
  if (!citationOk) missingReasons.push('包含未标〔训练〕的真实机关文号');

  const qualityNote = missingReasons.length > 0
    ? `未达详尽标准（当前约 ${charCount} 字 / 缺：${missingReasons.join('、')}）`
    : undefined;

  return {
    charCount,
    quality,
    genreOk,
    detailOk,
    partiesOk,
    citationOk,
    densityOk,
    missingReasons,
    qualityNote,
  };
}

