import React, { useState, useEffect } from 'react';
import { Type, BookA, Languages, ChevronRight, Search, Loader2, BookmarkPlus, AlertCircle, ChevronLeft, CheckCircle2 } from 'lucide-react';
import SpeakButton from './SpeakButton';
import { addWord, queryDictionary } from '../services/vocabAPI';

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

// 现代汉语词典一体化排版
function renderZhModern(payload: any, query: string) {
  const { definition, usage_notes, collocations, confusable_pairs, example_sentences } = payload;

  return (
    <div className="space-y-4 text-left">
      {/* 头部 */}
      <div className="flex items-baseline justify-between pb-2 border-b border-gray-100">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-gray-900 select-all">{query}</span>
          <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">现代汉语</span>
        </div>
      </div>

      {/* 释义 */}
      <div className="bg-indigo-50/20 border border-indigo-100/50 rounded-xl p-3.5 shadow-sm">
        <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">词典释义</div>
        <div className="text-sm font-semibold text-gray-800 leading-relaxed">{definition}</div>
      </div>

      {/* 用法说明 */}
      {usage_notes && (
        <div className="border-l-4 border-indigo-500 bg-indigo-50/10 p-3 rounded-r-xl border border-y-gray-100 border-r-gray-100">
          <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">用法/语境规范</div>
          <div className="text-xs text-gray-600 leading-relaxed">{usage_notes}</div>
        </div>
      )}

      {/* 搭配 */}
      {Array.isArray(collocations) && collocations.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">常用搭配</div>
          <div className="flex flex-wrap gap-1.5">
            {collocations.map((coll: string, idx: number) => (
              <span key={idx} className="text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200/50 px-2.5 py-1 rounded-full">
                {coll}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 易混辨析 */}
      {Array.isArray(confusable_pairs) && confusable_pairs.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">易混近义辨析</div>
          <div className="space-y-2">
            {confusable_pairs.map((pair: any, idx: number) => (
              <div key={idx} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm hover:shadow transition">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{pair.term}</span>
                </div>
                <div className="text-xs text-gray-500 leading-relaxed mt-1 pl-3">{pair.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 例句 */}
      {Array.isArray(example_sentences) && example_sentences.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">例句支撑</div>
          <div className="space-y-2 bg-gray-50/50 border border-gray-100 rounded-xl p-3">
            {example_sentences.map((sent: string, idx: number) => (
              <div key={idx} className="text-xs text-gray-700 leading-relaxed flex gap-2">
                <span className="text-indigo-400 font-bold shrink-0">{idx + 1}.</span>
                <span>{sent}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 商务英英词典一体化排版
function renderEnEnBusiness(payload: any, query: string) {
  const { headword, pos, definitions_en, business_notes, scenarios } = payload;
  const wordDisplay = headword || query;

  return (
    <div className="space-y-4 text-left">
      {/* 头部 */}
      <div className="flex items-baseline justify-between pb-2 border-b border-gray-100">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xl font-bold text-gray-900 select-all">{wordDisplay}</span>
          {pos && (
            <span className="text-xs italic text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-medium">{pos}</span>
          )}
          <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">商务英英</span>
        </div>
        {hasEnglishText(wordDisplay) && (
          <SpeakButton text={wordDisplay} title="播放词条发音" className="w-7 h-7" iconClassName="w-3.5 h-3.5" />
        )}
      </div>

      {/* 定义列表 */}
      {Array.isArray(definitions_en) && definitions_en.length > 0 && (
        <div className="bg-indigo-50/20 border border-indigo-100/50 rounded-xl p-3.5 shadow-sm">
          <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1.5">Definitions</div>
          <ol className="list-decimal pl-4 space-y-2">
            {definitions_en.map((def: string, idx: number) => (
              <li key={idx} className="text-sm text-gray-800 leading-relaxed font-medium pl-0.5">
                {def}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 商务注解 */}
      {business_notes && (
        <div className="border-l-4 border-indigo-500 bg-indigo-50/10 p-3 rounded-r-xl border border-y-gray-100 border-r-gray-100">
          <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">商务用法注解</div>
          <div className="text-xs text-gray-600 leading-relaxed font-medium">{business_notes}</div>
        </div>
      )}

      {/* 应用场景 */}
      {Array.isArray(scenarios) && scenarios.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Workplace Scenarios</div>
          <div className="space-y-2.5">
            {scenarios.map((sc: any, idx: number) => (
              <div key={idx} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm hover:border-indigo-100 transition">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
                  <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">{sc.scene || '场景'}</span>
                  {hasEnglishText(sc.example_en) && (
                    <SpeakButton text={sc.example_en} title="播放例句发音" className="ml-auto w-6 h-6 shrink-0" iconClassName="w-3 h-3" />
                  )}
                </div>
                <div className="text-sm font-medium text-gray-800 leading-relaxed pl-3">{sc.example_en}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 英汉双向商务词典一体化排版
function renderEnZhBidirectional(payload: any, query: string) {
  const { direction_resolved, phonetic, translation_main, business_examples } = payload;
  const isEnToZh = direction_resolved === 'en_to_zh';
  const speakText = query;

  return (
    <div className="space-y-4 text-left">
      {/* 头部 */}
      <div className="flex items-baseline justify-between pb-2 border-b border-gray-100">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xl font-bold text-gray-900 select-all">{query}</span>
          {phonetic && (
            <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{phonetic}</span>
          )}
          <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
            {isEnToZh ? '英 ➜ 汉' : '汉 ➜ 英'}
          </span>
        </div>
        {hasEnglishText(speakText) && (
          <SpeakButton text={speakText} title="播放词条发音" className="w-7 h-7" iconClassName="w-3.5 h-3.5" />
        )}
      </div>

      {/* 核心翻译 */}
      <div className="bg-indigo-50/20 border border-indigo-100/50 rounded-xl p-3.5 shadow-sm">
        <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">核心译义</div>
        <div className="text-base font-bold text-gray-800 leading-relaxed">{translation_main}</div>
      </div>

      {/* 商务例句 */}
      {Array.isArray(business_examples) && business_examples.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">商务语境例句</div>
          <div className="space-y-2.5">
            {business_examples.map((ex: any, idx: number) => (
              <div key={idx} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm hover:border-indigo-100 transition">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
                  <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">{ex.scene || '商务场景'}</span>
                  {hasEnglishText(ex.en) && (
                    <SpeakButton text={ex.en} title="播放例句发音" className="ml-auto w-6 h-6 shrink-0" iconClassName="w-3 h-3" />
                  )}
                </div>
                <div className="text-sm font-medium text-gray-800 leading-relaxed pl-3">{ex.en}</div>
                <div className="text-xs text-gray-500 mt-1 leading-relaxed pl-3">{ex.zh}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const DICT_CONFIG = {
  zh_modern:           { title: '现代汉语词典', subtitle: '词汇溯源与写作文风升维支撑', icon: <Type className="w-5 h-5" />, color: 'text-indigo-600 bg-indigo-50' },
  en_en_business:      { title: '英英词典',     subtitle: '沉浸获取原生商务英英解释',   icon: <BookA className="w-5 h-5" />, color: 'text-indigo-600 bg-indigo-50' },
  en_zh_bidirectional: { title: '英汉双向译制', subtitle: '带音标及职场黑话穿透',       icon: <Languages className="w-5 h-5" />, color: 'text-indigo-600 bg-indigo-50' },
} as const;

const DICT_ORDER: DictType[] = ['zh_modern', 'en_en_business', 'en_zh_bidirectional'];

export default function DictionaryPanel() {
  const [openDict, setOpenDict] = useState<DictType | null>(null);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DictResult | null>(null);
  const [activeTab, setActiveTab] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'saved'|'exists'|'error'>('idle');

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
      setSaveStatus('saved');
    };
    window.addEventListener('vocab-view', handleView);
    return () => window.removeEventListener('vocab-view', handleView);
  }, []);

  const handleToggle = (type: DictType, e: React.MouseEvent) => {
    e.stopPropagation();
    if (openDict === type) {
      setOpenDict(null); setResult(null); setQuery(''); setActiveTab('');
    } else {
      setOpenDict(type); setResult(null); setQuery(''); setActiveTab('');
    }
  };

  const handleSearch = async (type: DictType) => {
    if (!query.trim()) return;
    setIsLoading(true); setResult(null); setActiveTab('');
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

  const handleSave = async (type: DictType) => {
    if (!result?.payload || !query.trim()) return;
    setSaveStatus('saving');
    try {
      const res = await addWord({ word: query.trim(), dictType: type, payload: result.payload });
      setSaveStatus(res.success ? 'saved' : 'exists');
      if (res.success) window.dispatchEvent(new CustomEvent('vocab-updated'));
    } catch { setSaveStatus('error'); }
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  return (
    <div className="px-6 pb-6 mt-4">
      <h3 className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3 pl-2">Utility Tools</h3>
      <div className="space-y-2">
        {DICT_ORDER.map((type) => {
          const cfg = DICT_CONFIG[type];
          const isOpen = openDict === type;

          return (
            <div key={type} className={`rounded-2xl border transition-all ${isOpen ? 'border-indigo-100 shadow-md' : 'border-gray-100 shadow-sm'} overflow-hidden bg-white`}>
              {/* 菜单行 */}
              <button
                onClick={(e) => handleToggle(type, e)}
                className="w-full flex items-center p-3 hover:bg-gray-50 transition-all group"
              >
                <div className={`p-2 rounded-xl mr-4 ${cfg.color}`}>{cfg.icon}</div>
                <div className="text-left flex-1">
                  <div className="font-bold text-[#202124] text-sm">{cfg.title}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{cfg.subtitle}</div>
                </div>
                <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform duration-300 ${isOpen ? 'rotate-90 text-indigo-500' : 'group-hover:text-gray-500'}`} />
              </button>

              {/* 内联展开的详情区 */}
              {isOpen && (
                <div className="border-t border-gray-100 p-3 flex flex-col gap-3 bg-[#fafafa]">
                  {/* 搜索框 */}
                  <div className="relative">
                    <input
                      type="text"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleSearch(type); }}
                      onClick={e => e.stopPropagation()}
                      placeholder="切入精准词条..."
                      className="w-full bg-white border border-gray-200 rounded-xl pl-4 pr-12 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-sm transition animate-none"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSearch(type); }}
                      disabled={isLoading || !query.trim()}
                      className="absolute right-2 top-1.5 bg-[#202124] text-white p-1.5 rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* 加载中 */}
                  {isLoading && (
                    <div className="flex flex-col items-center py-6 text-gray-400 animate-pulse">
                      <Loader2 className="w-6 h-6 animate-spin mb-2 text-indigo-600" />
                      <span className="text-xs">Dify 工作流深度解构中...</span>
                    </div>
                  )}

                  {/* 错误 */}
                  {result?.ok === false && (
                    <div className="flex items-start text-red-500 text-xs bg-red-50 p-3 rounded-xl border border-red-100">
                      <AlertCircle className="w-4 h-4 mr-2 shrink-0 mt-0.5" />
                      <span>{result.message || '查询失败'}</span>
                    </div>
                  )}

                  {/* 结果区 */}
                  {result?.ok && result.payload && (
                    <div className="bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm space-y-4">
                      {/* 一体化排版展示 */}
                      {result.type === 'zh_modern' ? renderZhModern(result.payload, query) :
                       result.type === 'en_en_business' ? renderEnEnBusiness(result.payload, query) :
                       result.type === 'en_zh_bidirectional' ? renderEnZhBidirectional(result.payload, query) :
                       /* Fallback 旧式渲染 */
                       <div className="space-y-4">
                         <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                           <span className="text-sm font-bold text-gray-800">{query}</span>
                           <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">未格式化数据</span>
                         </div>
                         <div className="text-xs leading-relaxed text-gray-600">
                           {renderValue(result.payload, 0, 'payload', query)}
                         </div>
                       </div>
                      }

                      {/* 收录操作 */}
                      <div className="flex justify-end pt-3 border-t border-gray-100">
                        <button
                          title={saveStatus === 'saved' ? '已收录' : saveStatus === 'exists' ? '已存在' : '收录'}
                          disabled={saveStatus === 'saving'}
                          onClick={(e) => { e.stopPropagation(); handleSave(type); }}
                          className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold ${
                            saveStatus === 'saved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                            saveStatus === 'exists' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 
                            saveStatus === 'error' ? 'bg-red-50 text-red-500 border border-red-100' : 
                            'bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-100/50 hover:border-indigo-600'
                          }`}
                        >
                          {saveStatus === 'saved' ? <><CheckCircle2 className="w-3.5 h-3.5" />已收录</> :
                           saveStatus === 'exists' ? <><CheckCircle2 className="w-3.5 h-3.5" />已存在</> :
                           saveStatus === 'saving' ? <>保存中...</> :
                           saveStatus === 'error' ? <>失败</> :
                           <><BookmarkPlus className="w-3.5 h-3.5" />收录至生词本</>}
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
