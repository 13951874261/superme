import React, { useState, useEffect, useRef } from 'react';
import { Type, BookA, Languages, ChevronRight, Search, Loader2, BookmarkPlus, AlertCircle, ChevronLeft, CheckCircle2, ChevronDown, Sparkles, BookOpen, AlertOctagon } from 'lucide-react';
import gsap from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

gsap.registerPlugin(ScrambleTextPlugin);
import SpeakButton from './SpeakButton';
import { lookupVocabWords, queryDictionary } from '../services/vocabAPI';
import type { ZhModernPayload, EnEnBusinessPayload, EnZhBidirectionalPayload } from '../services/vocabAPI';
import { extractSynonymsAntonymsCollocations } from '../utils/vocabCsvExport';
import {
  UtilityZhModernView,
  UtilityEnEnBusinessView,
  UtilityEnZhBidirectionalView,
} from './DictionaryUtilityViews';
import { useVocabCollect } from '../hooks/useVocabCollect';
import { VOCAB_COLLECT_LABEL } from '../utils/backgroundHandoff';
import { showToast } from './Toast';

type DictType = 'zh_modern' | 'en_en_business' | 'en_zh_bidirectional';

interface DictResult {
  ok: boolean;
  type?: string;
  payload?: any;
  error_code?: string;
  message?: string;
}

const KEY_LABEL_MAP: Record<string, string> = {
  headword: '词条', word: '词条', term: '词汇', pos: '词性', part_of_speech: '词性',
  level: '语言等级', register: '语体风格', type: '类型', note: '注解', remark: '备注',
  tip: '提示', explanation: '说明', direction: '翻译方向', direction_resolved: '翻译方向',
  translation_main: '核心译义', translation: '译文', zh: '中文', en: '英文',
  scene: '场景', context: '语境', phonetic: '音标', phonetics: '音标',
  pronunciation: '发音', etymology: '词源', definition: '词义定义', definitions: '词义定义',
  definitions_en: '英文定义', usage_notes: '使用说明', usage: '用法说明', notes: '补充注解',
  writing_tips: '写作技巧', formal_usage: '正式用法', informal_usage: '非正式用法',
  common_mistakes: '常见错误', collocations: '搭配用法', collocation: '搭配用法',
  business_context: '商务语境', business_notes: '商务注解', business_examples: '商务例句',
  confusable_pairs: '易混词辨析', confusable: '易混词辨析', synonyms: '近义词',
  antonyms: '反义词', related_words: '相关词汇', compound_words: '复合词',
  idioms: '习语', proverbs: '谚语', example_sentences: '例句', examples: '例句',
  example: '例句', scenarios: '应用场景', cross_cultural: '跨文化注解',
  hidden_meaning: '职场弦外之音', summary: '总结',
};

const VALUE_LABEL_MAP: Record<string, string> = {
  zh_to_en: '中文 → 英文', en_to_zh: '英文 → 中文', auto: '自动识别',
  en_en: '英英解释', noun: '名词', verb: '动词', adjective: '形容词',
  adverb: '副词', preposition: '介词', conjunction: '连词', pronoun: '代词',
  formal: '正式', informal: '非正式', neutral: '中性', colloquial: '口语',
  'true': '是', 'false': '否',
};

function getLabel(key: string) { return KEY_LABEL_MAP[key.toLowerCase()] || key.replace(/_/g, ' '); }
function getVal(v: string) { return VALUE_LABEL_MAP[v] || VALUE_LABEL_MAP[v?.toLowerCase()] || v; }
function hasEnglishText(value: string) { return /[A-Za-z]{2,}/.test(value); }

export function renderValue(value: any, depth = 0, keyName?: string, queryWord?: string): React.ReactNode {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const displayValue = getVal(value);
    const isPhonetic = keyName && (keyName.toLowerCase().includes('phonetic') || keyName.toLowerCase().includes('pronunciation'));
    const speakText = isPhonetic && queryWord ? queryWord : value;
    return (
      <span className="inline-flex items-start gap-2 whitespace-pre-wrap leading-relaxed">
        <span>{displayValue}</span>
        {hasEnglishText(speakText) ? <SpeakButton text={speakText} title="播放英文内容" className="mt-0.5 flex-shrink-0 w-7 h-7" iconClassName="w-3.5 h-3.5" /> : null}
      </span>
    );
  }
  if (typeof value === 'number' || typeof value === 'boolean') return <span>{String(value)}</span>;
  if (Array.isArray(value)) return (
    <ul className="space-y-2 mt-1">
      {value.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#FF5722]/50 shrink-0"></span>
          <span className="text-gray-700">{renderValue(item, depth + 1, keyName, queryWord)}</span>
        </li>
      ))}
    </ul>
  );
  if (typeof value === 'object') return (
    <div className="space-y-4 mt-1">
      {Object.entries(value).map(([k, v]) => (
        <div key={k} className="rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white">
            <span className="w-1 h-4 rounded-full bg-[#FF5722] inline-block shrink-0"></span>
            <span className="text-[13px] font-black text-[#202124] tracking-wide">{getLabel(k)}</span>
          </div>
          <div className="px-3 py-2.5 text-sm text-gray-700 leading-relaxed">{renderValue(v, depth + 1, k, queryWord)}</div>
        </div>
      ))}
    </div>
  );
  return <span>{String(value)}</span>;
}

function renderLevelBadge(level?: string) {
  if (!level) return null;
  const cleanLevel = level.trim().toUpperCase();
  
  let bgStyles = 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  if (cleanLevel.includes('CET-4') || cleanLevel.includes('CET4')) {
    bgStyles = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  } else if (cleanLevel.includes('CET-6') || cleanLevel.includes('CET6')) {
    bgStyles = 'bg-teal-500/10 text-teal-400 border-teal-500/20';
  } else if (cleanLevel.includes('考研') || cleanLevel.includes('KY')) {
    bgStyles = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
  } else if (cleanLevel.includes('TOEFL') || cleanLevel.includes('托福')) {
    bgStyles = 'bg-sky-500/10 text-sky-400 border-sky-500/20';
  } else if (cleanLevel.includes('GRE')) {
    bgStyles = 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/20';
  } else if (cleanLevel.includes('BUSINESS') || cleanLevel.includes('商务')) {
    bgStyles = 'bg-orange-500/10 text-orange-400 border-orange-500/20';
  } else if (cleanLevel.includes('IELTS') || cleanLevel.includes('雅思')) {
    bgStyles = 'bg-[var(--color-info)]/10 text-[var(--color-info)] border-[var(--color-info)]/20';
  }

  return (
    <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded select-none ${bgStyles}`}>
      {level}
    </span>
  );
}


// ==========================================
// 1. 现代汉语词典卡片展示组件
// ==========================================
interface ZhModernViewProps {
  payload: ZhModernPayload;
  query: string;
}

export function ZhModernView({ payload, query }: ZhModernViewProps) {
  const { pos, definition, phonetic, usage_notes, other_meanings = [], example_sentences = [], collocations = [], synonyms = [], antonyms = [], confusable_pairs = [] } = payload;
  
  const validExampleSentences = example_sentences.filter(sent => typeof sent === 'string' ? sent.trim() : false);
  
  const [openMeaningIdx, setOpenMeaningIdx] = useState<number | null>(null);
  const [showCollocations, setShowCollocations] = useState(false);
  const [showConfusable, setShowConfusable] = useState(false);

  return (
    <div className="space-y-4 text-left select-text selection:bg-[var(--color-accent)]/20">
      {/* 词条头部 */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white rounded-2xl p-4 border border-slate-800 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 w-24 h-24 bg-[var(--color-info)]/10 rounded-full blur-xl pointer-events-none"></div>
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="text-2xl font-black tracking-tight select-all text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-indigo-100">{query}</span>
          {phonetic && (
            <span className="text-sm font-mono text-indigo-300/90 font-medium">[{phonetic}]</span>
          )}
          {pos && (
            <span className="text-xs bg-[var(--color-info)]/20 text-[var(--color-info)] border border-[var(--color-info)]/30 px-2 py-0.5 rounded-md font-semibold select-none">
              {pos}
            </span>
          )}
          {payload.level && renderLevelBadge(payload.level)}
          <span className="text-[10px] font-bold text-[var(--color-info)] bg-[var(--color-info)]/10 border border-[var(--color-info)]/20 px-1.5 py-0.5 rounded ml-auto select-none">现代汉语</span>
        </div>
      </div>

      {/* 核心释义 */}
      <div className="relative border border-[var(--color-border)] bg-gradient-to-r from-slate-50/80 to-slate-50/20 rounded-2xl p-4 shadow-sm overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-500"></div>
        <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1.5 select-none flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5" />
          核心释义
        </div>
        <div className="text-sm font-semibold text-gray-800 leading-relaxed">{definition}</div>
      </div>

      {/* 用法说明 */}
      {usage_notes && (
        <div className="border border-gray-100 bg-gray-50/30 rounded-2xl p-3.5 shadow-inner">
          <div className="text-[10px] font-bold text-[var(--color-info)] uppercase tracking-widest mb-1 flex items-center gap-1 select-none">
            <Sparkles className="w-3.5 h-3.5" />
            用法语境规范
          </div>
          <div className="text-xs text-gray-600 leading-relaxed font-medium">{usage_notes}</div>
        </div>
      )}

      {/* 其他释义 (手风琴) */}
      {other_meanings.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 select-none">其他释义 (点击展开语境)</div>
          <div className="space-y-2">
            {other_meanings.map((item, idx) => {
              const isOpen = openMeaningIdx === idx;
              return (
                <div key={idx} className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm hover:border-gray-200 transition-all">
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMeaningIdx(isOpen ? null : idx); }}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50/50 transition"
                  >
                    <span className="text-xs font-bold text-gray-750">{item.meaning}</span>
                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-205 ${isOpen ? 'rotate-90 text-[var(--color-info)]' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 border-t border-gray-50 text-[11px] text-gray-500 bg-gray-50/30 leading-relaxed">
                      <span className="font-bold text-gray-400">语境例证：</span>{item.context}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 例句区 */}
      {validExampleSentences.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 select-none">例句支撑</div>
          <div className="space-y-2 bg-gray-50/40 border border-gray-100 rounded-2xl p-3 shadow-inner">
            {validExampleSentences.map((sent, idx) => (
              <div key={idx} className="bg-white border border-gray-100/80 border-l-2 border-l-indigo-400 rounded-xl p-3 shadow-sm hover:shadow transition text-xs text-gray-700 leading-relaxed flex gap-2">
                <span className="text-[var(--color-info)] font-bold shrink-0">{idx + 1}.</span>
                <span className="select-text">{sent}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 同义词/反义词 (并排胶囊标签云) */}
      {(synonyms.length > 0 || antonyms.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {synonyms.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 select-none">近义词</div>
              <div className="flex flex-wrap gap-1.5">
                {synonyms.map((s, idx) => (
                  <span key={idx} className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100/80 px-2.5 py-1 rounded-full shadow-sm">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {antonyms.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 select-none">反义词</div>
              <div className="flex flex-wrap gap-1.5">
                {antonyms.map((a, idx) => (
                  <span key={idx} className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100/80 px-2.5 py-1 rounded-full shadow-sm">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 搭配与易混辨析 (折叠面板) */}
      <div className="space-y-2 pt-2">
        {collocations.length > 0 && (
          <div className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm">
            <button
              onClick={(e) => { e.stopPropagation(); setShowCollocations(!showCollocations); }}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50/50 transition font-bold text-xs text-gray-650 select-none"
            >
              <span>常用搭配 ({collocations.length})</span>
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${showCollocations ? 'rotate-90' : ''}`} />
            </button>
            {showCollocations && (
              <div className="p-3 border-t border-gray-50 bg-gray-50/30 flex flex-wrap gap-1.5">
                {collocations.map((coll, idx) => (
                  <span key={idx} className="text-xs font-medium text-gray-600 bg-white border border-gray-200/80 px-2.5 py-1 rounded-lg">
                    {coll}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {confusable_pairs.length > 0 && (
          <div className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm">
            <button
              onClick={(e) => { e.stopPropagation(); setShowConfusable(!showConfusable); }}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50/50 transition font-bold text-xs text-gray-650 select-none"
            >
              <span>易混近义辨析 ({confusable_pairs.length})</span>
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${showConfusable ? 'rotate-90' : ''}`} />
            </button>
            {showConfusable && (
              <div className="p-3 border-t border-gray-50 bg-gray-50/30 space-y-2.5">
                {confusable_pairs.map((pair, idx) => (
                  <div key={idx} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1.5 select-none">
                      <AlertOctagon className="w-3.5 h-3.5 text-[var(--color-info)]" />
                      <span className="text-xs font-bold text-[var(--color-brand)] bg-slate-50 px-2 py-0.5 rounded-md">{pair.term}</span>
                    </div>
                    <div className="text-xs text-gray-500 leading-relaxed pl-5">{pair.note}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 2. 商务英英词典卡片展示组件
// ==========================================
interface EnEnBusinessViewProps {
  payload: EnEnBusinessPayload;
 query: string;
}

export function EnEnBusinessView({ payload, query }: EnEnBusinessViewProps) {
  const { headword, pos, phonetic, definitions_en = [], business_notes, scenarios = [], other_meanings = [], example_sentences = [], meaning_zh } = payload;
  const wordDisplay = headword || query;
  const extracted = extractSynonymsAntonymsCollocations(wordDisplay, payload);
  const synonymsList = extracted.synonyms;
  const antonymsList = extracted.antonyms;
  const collocationsList = extracted.collocations;
  
  // 过滤掉空内容的 scenarios
  const validScenarios = scenarios.filter(sc => {
    if (typeof sc === 'string') return sc.trim();
    return sc.example_en?.trim();
  }).map(sc => {
    if (typeof sc === 'string') return { scene: 'Scenario', example_en: sc };
    return sc;
  });
  
  // 过滤掉空内容的 example_sentences (EnEnBusinessView 中是字符串数组)
  const validEnExampleSentences = example_sentences.filter(sent => {
    if (typeof sent === 'string') return sent.trim();
    return sent?.en?.trim() || sent?.zh?.trim();
  }).map(sent => {
    if (typeof sent === 'string') return sent;
    return sent.en || sent.zh || '';
  });
  
  const [openMeaningIdx, setOpenMeaningIdx] = useState<number | null>(null);
  const [showCollocations, setShowCollocations] = useState(false);

  return (
    <div className="space-y-4 text-left select-text selection:bg-[var(--color-accent)]/20">
      {/* 词条头部 */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white rounded-2xl p-4 border border-slate-800 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 w-24 h-24 bg-[var(--color-info)]/10 rounded-full blur-xl pointer-events-none"></div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-2xl font-black tracking-tight select-all text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-indigo-100">{wordDisplay}</span>
          {phonetic && (
            <span className="text-sm font-mono text-indigo-300/90 font-medium">{phonetic}</span>
          )}
          {pos && (
            <span className="text-xs italic bg-[var(--color-info)]/20 text-[var(--color-info)] border border-[var(--color-info)]/30 px-2 py-0.5 rounded-md font-semibold select-none">
              {pos}
            </span>
          )}
          {payload.level && renderLevelBadge(payload.level)}
          <span className="text-[10px] font-bold text-[var(--color-info)] bg-[var(--color-info)]/10 border border-[var(--color-info)]/20 px-1.5 py-0.5 rounded ml-auto select-none">商务英英</span>
          {hasEnglishText(wordDisplay) && (
            <SpeakButton text={wordDisplay} title="播放词条发音" className="w-7 h-7 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center justify-center shrink-0 border border-white/10" iconClassName="w-3.5 h-3.5" />
          )}
        </div>
      </div>

      {/* 中文译义 */}
      {meaning_zh && meaning_zh.trim() && (
        <div className="relative border border-rose-100/80 bg-gradient-to-r from-rose-50/50 to-rose-100/10 rounded-2xl p-4 shadow-sm overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500"></div>
          <div className="text-[10px] font-bold text-rose-700 uppercase tracking-widest mb-1.5 select-none flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            中文译义
          </div>
          <div className="text-sm font-bold text-gray-800 leading-relaxed">
            {meaning_zh}
          </div>
        </div>
      )}

      {/* 定义列表 */}
      {definitions_en.length > 0 && (
        <div className="relative border border-amber-100/80 bg-gradient-to-r from-amber-50/50 to-amber-100/10 rounded-2xl p-4 shadow-sm overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500"></div>
          <div className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1.5 select-none flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            Definitions
          </div>
          <ol className="list-decimal pl-4 space-y-2">
            {definitions_en.map((def, idx) => (
              <li key={idx} className="text-sm font-semibold text-gray-800 leading-relaxed pl-0.5">
                {def}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 商务注解 */}
      {business_notes && (
        <div className="border border-[var(--color-border)] bg-slate-50/40 p-4 rounded-2xl shadow-sm">
          <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1 flex items-center gap-1 select-none">
            <Sparkles className="w-3.5 h-3.5" />
            Business Usage Notes
          </div>
          <div className="text-xs text-gray-600 leading-relaxed font-medium">{business_notes}</div>
        </div>
      )}

      {/* 其他释义 (手风琴) */}
      {other_meanings.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 select-none">Other Meanings (Click to expand context)</div>
          <div className="space-y-2">
            {other_meanings.map((item, idx) => {
              const isOpen = openMeaningIdx === idx;
              return (
                <div key={idx} className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm hover:border-gray-200 transition-all">
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMeaningIdx(isOpen ? null : idx); }}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50/50 transition"
                  >
                    <span className="text-xs font-bold text-gray-700">{item.meaning_en}</span>
                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-90 text-[var(--color-info)]' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 border-t border-gray-50 text-[11px] text-gray-500 bg-gray-50/30 leading-relaxed select-text">
                      <span className="font-bold text-gray-400">Context: </span>{item.context_en}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 商务场景用例 (Scenarios) */}
      {validScenarios.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 select-none">Workplace Scenarios</div>
          <div className="space-y-2.5">
            {validScenarios.map((sc, idx) => (
              <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm hover:border-indigo-100 hover:shadow transition">
                <div className="flex items-center gap-1.5 mb-1.5 select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
                  <span className="text-[10px] font-bold text-[var(--color-info)] bg-slate-50 px-1.5 py-0.5 rounded">{sc.scene || 'Scenario'}</span>
                  {hasEnglishText(sc.example_en) && (
                    <SpeakButton text={sc.example_en} title="Play example audio" className="ml-auto w-6 h-6 hover:bg-gray-100 rounded-lg flex items-center justify-center shrink-0 border border-gray-100" iconClassName="w-3 h-3" />
                  )}
                </div>
                <div className="text-sm font-semibold text-gray-800 leading-relaxed pl-3 select-text">{sc.example_en}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 真实例句支撑 */}
      {validEnExampleSentences.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 select-none">Example Sentences</div>
          <div className="space-y-2 bg-gray-50/40 border border-gray-100 rounded-2xl p-3 shadow-inner">
            {validEnExampleSentences.map((sent, idx) => (
              <div key={idx} className="bg-white border border-gray-100/80 border-l-2 border-l-indigo-400 rounded-xl p-3 shadow-sm hover:shadow transition text-xs text-gray-700 leading-relaxed flex items-start gap-2">
                <span className="text-[var(--color-info)] font-bold shrink-0 mt-0.5 select-none">{idx + 1}.</span>
                <span className="flex-1 select-text">{sent}</span>
                {hasEnglishText(sent) && (
                  <SpeakButton text={sent} title="Play audio" className="w-6 h-6 hover:bg-gray-50 rounded-md flex items-center justify-center shrink-0" iconClassName="w-3 h-3" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 同义词/反义词 (常驻并排胶囊标签云) */}
      {(synonymsList.length > 0 || antonymsList.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {synonymsList.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 select-none">Synonyms / 近义词</div>
              <div className="flex flex-wrap gap-1.5">
                {synonymsList.map((s, idx) => (
                  <span key={idx} className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100/80 px-2.5 py-1 rounded-full shadow-sm">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {antonymsList.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 select-none">Antonyms / 反义词</div>
              <div className="flex flex-wrap gap-1.5">
                {antonymsList.map((a, idx) => (
                  <span key={idx} className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100/80 px-2.5 py-1 rounded-full shadow-sm">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 常用搭配 (常驻高亮全展示) */}
      {collocationsList.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 select-none">Collocations / 常用搭配组合</div>
          <div className="p-3.5 border border-indigo-100/80 bg-gradient-to-r from-indigo-50/40 to-slate-50/50 rounded-2xl flex flex-wrap gap-2 shadow-sm">
            {collocationsList.map((coll, idx) => (
              <span key={idx} className="text-xs font-bold text-indigo-900 bg-white border border-indigo-200/80 px-3 py-1 rounded-xl shadow-xs">
                {coll}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. 英汉双向商务词典卡片展示组件
// ==========================================
interface EnZhBidirectionalViewProps {
  payload: EnZhBidirectionalPayload;
  query: string;
}

export function EnZhBidirectionalView({ payload, query }: EnZhBidirectionalViewProps) {
  const { direction_resolved, phonetic, pos, translation_main, other_meanings = [], business_examples = [], example_sentences = [], etymology } = payload;
  const extracted = extractSynonymsAntonymsCollocations(query, payload);
  const synonymsList = extracted.synonyms;
  const antonymsList = extracted.antonyms;
  const collocationsList = extracted.collocations;
  
  // 过滤掉空内容的 business_examples
  const validBusinessExamples = business_examples.filter(ex => {
    if (typeof ex === 'string') return ex.trim();
    return (ex.en?.trim() || ex.zh?.trim());
  }).map(ex => {
    if (typeof ex === 'string') return { scene: '商务场景', en: ex, zh: '' };
    return ex;
  });
  
  // 过滤掉空内容的 example_sentences
  const validExampleSentences = example_sentences.filter(sent => {
    if (typeof sent === 'string') return sent.trim();
    return (sent.en?.trim() || sent.zh?.trim());
  }).map(sent => {
    if (typeof sent === 'string') return { en: sent, zh: '' };
    return sent;
  });
  
  const [openMeaningIdx, setOpenMeaningIdx] = useState<number | null>(null);
  const [showCollocations, setShowCollocations] = useState(false);
  const isEnToZh = direction_resolved === 'en_to_zh';
  const speakText = query;

  return (
    <div className="space-y-4 text-left select-text selection:bg-[var(--color-accent)]/20">
      {/* 词条头部 */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white rounded-2xl p-4 border border-slate-800 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 w-24 h-24 bg-[var(--color-info)]/10 rounded-full blur-xl pointer-events-none"></div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-2xl font-black tracking-tight select-all text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-indigo-100">{query}</span>
          {phonetic && (
            <span className="text-sm font-mono text-indigo-300/90 font-medium">[{phonetic}]</span>
          )}
          {pos && (
            <span className="text-xs italic bg-[var(--color-info)]/20 text-[var(--color-info)] border border-[var(--color-info)]/30 px-2 py-0.5 rounded-md font-semibold select-none">
              {pos}
            </span>
          )}
          {payload.level && renderLevelBadge(payload.level)}
          <span className="text-[10px] font-bold text-[var(--color-info)] bg-[var(--color-info)]/10 border border-[var(--color-info)]/20 px-1.5 py-0.5 rounded ml-auto select-none">
            {isEnToZh ? '英 ➜ 汉' : '汉 ➜ 英'}
          </span>
          {hasEnglishText(speakText) && (
            <SpeakButton text={speakText} title="播放词条发音" className="w-7 h-7 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center justify-center shrink-0 border border-white/10" iconClassName="w-3.5 h-3.5" />
          )}
        </div>
      </div>

      {/* 核心释义 */}
      <div className="relative border border-[var(--color-border)] bg-gradient-to-r from-slate-50/80 to-slate-50/20 rounded-2xl p-4 shadow-sm overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-500"></div>
        <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1 select-none flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5" />
          核心释义
        </div>
        <div className="text-base font-bold text-gray-800 leading-relaxed mt-1">{translation_main}</div>
      </div>

      {/* 其他释义 (手风琴) */}
      {other_meanings.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 select-none">其他释义 (点击展开语境)</div>
          <div className="space-y-2">
            {other_meanings.map((item, idx) => {
              const isOpen = openMeaningIdx === idx;
              return (
                <div key={idx} className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm hover:border-gray-200 transition-all">
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMeaningIdx(isOpen ? null : idx); }}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50/50 transition"
                  >
                    <span className="text-xs font-bold text-gray-700">{item.meaning}</span>
                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-90 text-[var(--color-info)]' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 border-t border-gray-50 text-[11px] text-gray-500 bg-gray-50/30 leading-relaxed select-text">
                      <span className="font-bold text-gray-400">{isEnToZh ? 'Context: ' : '使用说明：'}</span>{item.context}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 商务场景例句 (Business Examples) */}
      {validBusinessExamples.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 select-none">商务语境场景</div>
          <div className="space-y-2.5">
            {validBusinessExamples.map((ex, idx) => (
              <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm hover:border-indigo-100 hover:shadow transition">
                <div className="flex items-center gap-1.5 mb-1 select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
                  <span className="text-[10px] font-bold text-[var(--color-info)] bg-slate-50 px-1.5 py-0.5 rounded">{ex.scene || '商务场景'}</span>
                  {hasEnglishText(ex.en) && (
                    <SpeakButton text={ex.en} title="播放例句发音" className="ml-auto w-6 h-6 hover:bg-gray-100 rounded-lg flex items-center justify-center shrink-0 border border-gray-100" iconClassName="w-3 h-3" />
                  )}
                </div>
                <div className="text-sm font-semibold text-gray-800 leading-relaxed pl-3 select-text">{ex.en}</div>
                <div className="text-xs text-gray-500 mt-1 leading-relaxed pl-3 select-text">{ex.zh}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 真实中英双语例句 */}
      {validExampleSentences.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 select-none">中英对照例句</div>
          <div className="space-y-2 bg-gray-50/40 border border-gray-100 rounded-2xl p-3 shadow-inner">
            {validExampleSentences.map((sent, idx) => (
              <div key={idx} className="bg-white border border-gray-100/80 border-l-2 border-l-indigo-400 rounded-xl p-3 shadow-sm hover:shadow transition text-xs leading-relaxed flex items-start gap-2">
                <span className="text-[var(--color-info)] font-bold shrink-0 mt-0.5 select-none">{idx + 1}.</span>
                <div className="flex-1 space-y-1">
                  <div className="text-gray-800 font-medium select-text">{sent.en}</div>
                  <div className="text-gray-500 select-text">{sent.zh}</div>
                </div>
                {hasEnglishText(sent.en) && (
                  <SpeakButton text={sent.en} title="播放音轨" className="w-6 h-6 hover:bg-gray-50 rounded-md flex items-center justify-center shrink-0 mt-0.5" iconClassName="w-3 h-3" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 同义词/反义词 (常驻胶囊标签云) */}
      {(synonymsList.length > 0 || antonymsList.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {synonymsList.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 select-none">Synonyms / 近义词</div>
              <div className="flex flex-wrap gap-1.5">
                {synonymsList.map((s, idx) => (
                  <span key={idx} className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100/80 px-2.5 py-1 rounded-full shadow-sm">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {antonymsList.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 select-none">Antonyms / 反义词</div>
              <div className="flex flex-wrap gap-1.5">
                {antonymsList.map((a, idx) => (
                  <span key={idx} className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100/80 px-2.5 py-1 rounded-full shadow-sm">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 高频搭配与词源 (常驻全展示) */}
      {(collocationsList.length > 0 || etymology) && (
        <div className="space-y-3 pt-2">
          {collocationsList.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 select-none">Collocations / 常用搭配组合 ({collocationsList.length})</div>
              <div className="p-3 border border-indigo-100/80 bg-gradient-to-r from-indigo-50/30 to-slate-50/40 rounded-2xl flex flex-wrap gap-2 shadow-sm">
                {collocationsList.map((coll, idx) => (
                  <span key={idx} className="text-xs font-bold text-indigo-900 bg-white border border-indigo-200/70 px-3 py-1 rounded-xl shadow-xs">
                    {coll}
                  </span>
                ))}
              </div>
            </div>
          )}
          {etymology && (
            <div className="space-y-1.5 border border-amber-100/80 bg-amber-50/20 p-3.5 rounded-2xl">
              <div className="text-[10px] font-bold text-amber-700 uppercase tracking-widest select-none">词汇探源 (Etymology)</div>
              <div className="text-xs text-slate-700 leading-relaxed select-text font-medium">{etymology}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const DICT_CONFIG = {
  zh_modern:           { title: '现代汉语词典', subtitle: '词汇溯源与写作文风提升', icon: <Type className="w-5 h-5" />, color: 'text-[#FF5722] bg-[#FF5722]/10' },
  en_en_business:      { title: '英英词典',     subtitle: '沉浸获取原生商务英英解释',   icon: <BookA className="w-5 h-5" />, color: 'text-[#FF5722] bg-[#FF5722]/10' },
  en_zh_bidirectional: { title: '英汉双向译制', subtitle: '带音标及职场用语解析',       icon: <Languages className="w-5 h-5" />, color: 'text-[#FF5722] bg-[#FF5722]/10' },
} as const;

const DICT_ORDER: DictType[] = ['zh_modern', 'en_en_business', 'en_zh_bidirectional'];

function DictLoadingIndicator({ word }: { word: string }) {
  const statusRef = useRef<HTMLSpanElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!statusRef.current) return;
    const phases = [
      { text: '正在连接词典引擎…', chars: 'ABCDEFabcdef0123456789' },
      { text: '深度解析语义语境…', chars: 'ABCDEFabcdef0123456789' },
      { text: '提取职场用语解析…', chars: 'ABCDEFabcdef0123456789' },
      { text: '整合近义辨析与例句…', chars: 'ABCDEFabcdef0123456789' },
    ];
    const tl = gsap.timeline({ repeat: -1 });
    phases.forEach((phase, i) => {
      tl.to(statusRef.current!, {
        duration: 1.4,
        scrambleText: { text: phase.text, chars: phase.chars, revealDelay: 0.3, speed: 0.7 },
        delay: i === 0 ? 0 : 0.4,
      });
    });
    return () => { tl.kill(); };
  }, []);

  useEffect(() => {
    if (!dotRef.current) return;
    const tl = gsap.timeline({ repeat: -1 });
    tl.to(dotRef.current, { opacity: 0.2, duration: 0.5, ease: 'power1.inOut' })
      .to(dotRef.current, { opacity: 1, duration: 0.5, ease: 'power1.inOut' });
    return () => { tl.kill(); };
  }, []);

  return (
    <div className="flex flex-col items-center py-7 gap-4">
      <div className="relative w-10 h-10 flex items-center justify-center">
        <span ref={dotRef} className="absolute w-10 h-10 rounded-full bg-[#FF5722]/10 border border-[#FF5722]/30" />
        <Loader2 className="w-5 h-5 text-[#FF5722] animate-spin relative z-10" />
      </div>
      {word && (
        <div className="text-center">
          <span className="text-[11px] font-black text-[#FF5722] tracking-widest uppercase bg-[#FF5722]/8 border border-[#FF5722]/20 px-3 py-1 rounded-full">
            {word}
          </span>
        </div>
      )}
      <span
        ref={statusRef}
        className="text-xs text-stone-400 font-medium min-h-[1.2em] text-center"
      >
        正在连接词典引擎…
      </span>
      <p className="text-[10px] text-stone-300 text-center max-w-[180px] leading-relaxed">
        首次查询需调用 AI 深度解析，通常需要 10~30 秒
      </p>
    </div>
  );
}

export default function DictionaryPanel() {
  const [openDict, setOpenDict] = useState<DictType | null>(null);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DictResult | null>(null);
  const [activeTab, setActiveTab] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [markedSaved, setMarkedSaved] = useState(false);
  const { collect, hydrateCollected, isCollecting, isQueued, isCollected } = useVocabCollect({
    notify: (message, type) => showToast({ message, type }),
  });

  const wordKey = query.trim();
  const collecting = wordKey ? isCollecting(wordKey) : false;
  const queued = wordKey ? isQueued(wordKey) : false;
  const collected = markedSaved || (wordKey ? isCollected(wordKey) : false);

  useEffect(() => {
    const handleView = (e: any) => {
      const entry = e.detail;
      setQuery(entry.word || '');
      setOpenDict((entry.dict_type as DictType) || 'en_zh_bidirectional');
      if (entry.payload) {
        setResult({ ok: true, type: entry.dict_type, payload: entry.payload });
        const keys = Object.keys(entry.payload);
        if (keys.length > 0) setActiveTab(keys[0]);
      }
      setSaveError(false);
      setMarkedSaved(true);
    };
    window.addEventListener('vocab-view', handleView);
    return () => window.removeEventListener('vocab-view', handleView);
  }, []);

  useEffect(() => {
    const text = query.trim();
    if (!text || !result?.ok) return;
    let cancelled = false;
    const syncCollected = () => {
      void lookupVocabWords([text]).then((items) => {
        if (cancelled || !items.length) return;
        hydrateCollected(items.map((item) => item.word));
        setMarkedSaved(true);
      }).catch(() => {});
    };
    syncCollected();
    window.addEventListener('vocab-updated', syncCollected);
    return () => {
      cancelled = true;
      window.removeEventListener('vocab-updated', syncCollected);
    };
  }, [query, result?.ok, hydrateCollected]);

  const handleToggle = (type: DictType, e: React.MouseEvent) => {
    e.stopPropagation();
    if (openDict === type) {
      setOpenDict(null); setResult(null); setQuery(''); setActiveTab('');
    } else {
      setOpenDict(type); setResult(null); setQuery(''); setActiveTab('');
    }
    setSaveError(false);
    setMarkedSaved(false);
  };

  const handleSearch = async (type: DictType) => {
    if (!query.trim()) return;
    setIsLoading(true); setResult(null); setActiveTab(''); setSaveError(false); setMarkedSaved(false);
    try {
      const parsed = await queryDictionary({ word: query.trim(), dictType: type, direction: 'auto', locale: 'zh-CN', userContext: '', userId: 'frontend-panel' });
      setResult(parsed);
      const firstKey = Object.keys(parsed?.payload || {})[0];
      if (firstKey) setActiveTab(firstKey);
    } catch (err: any) {
      setResult({ ok: false, message: err.message || '网络请求异常' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (type: DictType, anchor?: HTMLElement | null) => {
    if (!result?.payload || !query.trim()) return;
    setSaveError(false);
    const text = query.trim();
    const outcome = await collect({
      text,
      dictType: type,
      isPhrase: /\s/.test(text),
      source: 'Dictionary Panel',
      topic: '词典收录',
      payload: result.payload as Record<string, any>,
      anchor,
    });
    if (outcome === 'failed') setSaveError(true);
    if (outcome === 'collected') setMarkedSaved(true);
  };

  return (
    <div className="px-6 pb-6 mt-4">
      <h3 className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3 pl-2">Utility Tools</h3>
      <div className="space-y-2">
        {DICT_ORDER.map((type) => {
          const cfg = DICT_CONFIG[type];
          const isOpen = openDict === type;

          return (
            <div key={type} className={`rounded-2xl border transition-all ${isOpen ? 'border-[#FF5722]/25 shadow-md' : 'border-stone-200/80 shadow-sm'} overflow-hidden bg-white`}>
              {/* 菜单行 */}
              <button
                onClick={(e) => handleToggle(type, e)}
                className="w-full flex items-center p-3 hover:bg-stone-50 transition-all group"
              >
                <div className={`p-2 rounded-xl mr-4 ${cfg.color}`}>{cfg.icon}</div>
                <div className="text-left flex-1">
                  <div className="font-bold text-[#202124] text-sm">{cfg.title}</div>
                  <div className="text-[11px] text-stone-400 mt-0.5">{cfg.subtitle}</div>
                </div>
                <ChevronRight className={`w-4 h-4 text-stone-300 transition-transform duration-300 ${isOpen ? 'rotate-90 text-[#FF5722]' : 'group-hover:text-stone-500'}`} />
              </button>

              {/* 内联展开的详情区 */}
              {isOpen && (
                <div className="border-t border-stone-100 p-3 flex flex-col gap-3 bg-[#fafafa]">
                  {/* 搜索框 */}
                  <div className="relative">
                    <input
                      type="text"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleSearch(type); }}
                      onClick={e => e.stopPropagation()}
                      placeholder="切入精准词条..."
                      className="w-full bg-white border border-stone-200 rounded-xl pl-4 pr-12 py-2.5 text-sm focus:outline-none focus:border-[#FF5722] focus:ring-1 focus:ring-[#FF5722]/40 shadow-sm transition animate-none"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSearch(type); }}
                      disabled={isLoading || !query.trim()}
                      className="absolute right-2 top-1.5 bg-[#202124] text-white p-1.5 rounded-lg hover:bg-[#FF5722] disabled:opacity-50 transition"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* 加载中 */}
                  {isLoading && <DictLoadingIndicator word={query.trim()} />}

                  {/* 错误 */}
                  {result?.ok === false && (
                    <div className="flex items-start text-red-500 text-xs bg-red-50 p-3 rounded-xl border border-red-100">
                      <AlertCircle className="w-4 h-4 mr-2 shrink-0 mt-0.5" />
                      <span>{result.message || '查询失败'}</span>
                    </div>
                  )}

                  {/* 结果区：侧栏专用 Utility 视图（解密仓仍用导出的 legacy 视图） */}
                  {result?.ok && result.payload && (
                    <div className="bg-white rounded-xl border border-stone-200/80 p-3.5 shadow-sm space-y-4">
                      {result.type === 'zh_modern' ? <UtilityZhModernView payload={result.payload} query={query} /> :
                       result.type === 'en_en_business' ? <UtilityEnEnBusinessView payload={result.payload} query={query} /> :
                       result.type === 'en_zh_bidirectional' ? <UtilityEnZhBidirectionalView payload={result.payload} query={query} /> :
                       <div className="space-y-4">
                         <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                           <span className="text-sm font-bold text-stone-800">{query}</span>
                           <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">未格式化数据</span>
                         </div>
                         <div className="text-xs leading-relaxed text-stone-600">
                           {renderValue(result.payload, 0, 'payload', query)}
                         </div>
                       </div>
                      }

                      {/* 收录操作：与全站收录同 FSM（收录中 → 后台处理中 → 已收录） */}
                      <div className="flex justify-end pt-3 border-t border-stone-100">
                        <button
                          type="button"
                          title={
                            collected
                              ? VOCAB_COLLECT_LABEL.done
                              : queued
                                ? VOCAB_COLLECT_LABEL.queued
                                : collecting
                                  ? VOCAB_COLLECT_LABEL.collecting
                                  : '加入生词本并补齐释义等信息'
                          }
                          disabled={collecting || queued || collected}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleSave(type, e.currentTarget);
                          }}
                          className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold disabled:cursor-default ${
                            collected
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                              : saveError
                                ? 'bg-red-50 text-red-500 border border-red-100'
                                : queued
                                  ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                  : collecting
                                    ? 'bg-orange-50 text-[#FF5722] border border-orange-100'
                                    : 'bg-[#FF5722]/10 hover:bg-[#FF5722] text-[#FF5722] hover:text-white border border-[#FF5722]/25 hover:border-[#FF5722]'
                          }`}
                        >
                          {collected ? (
                            <><CheckCircle2 className="w-3.5 h-3.5" />{VOCAB_COLLECT_LABEL.done}</>
                          ) : saveError ? (
                            <>失败</>
                          ) : collecting || queued ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" />{collecting ? VOCAB_COLLECT_LABEL.collecting : VOCAB_COLLECT_LABEL.queued}</>
                          ) : (
                            <><BookmarkPlus className="w-3.5 h-3.5" />收录至生词本</>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 空态提示 */}
                  {!result && !isLoading && (
                    <div className="text-gray-400 text-center py-4 text-xs">等待输入待解构词块...</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
