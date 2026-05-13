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

export function renderValue(value: any, depth = 0): React.ReactNode {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const displayValue = getVal(value);
    return (
      <span className="inline-flex items-start gap-2 whitespace-pre-wrap leading-relaxed">
        <span>{displayValue}</span>
        {hasEnglishText(value) ? <SpeakButton text={value} title="播放英文内容" className="mt-0.5 flex-shrink-0 w-7 h-7" iconClassName="w-3.5 h-3.5" /> : null}
      </span>
    );
  }
  if (typeof value === 'number' || typeof value === 'boolean') return <span>{String(value)}</span>;
  if (Array.isArray(value)) return (
    <ul className="space-y-2 mt-1">
      {value.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#FF5722]/50 shrink-0"></span>
          <span className="text-gray-700">{renderValue(item, depth + 1)}</span>
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
          <div className="px-3 py-2.5 text-sm text-gray-700 leading-relaxed">{renderValue(v, depth + 1)}</div>
        </div>
      ))}
    </div>
  );
  return <span>{String(value)}</span>;
}

const DICT_CONFIG = {
  zh_modern:           { title: '现代汉语词典', subtitle: '词汇溯源与写作文风升维支撑', icon: <Type className="w-5 h-5" />, color: 'text-blue-600 bg-blue-50' },
  en_en_business:      { title: '英英词典',     subtitle: '沉浸获取原生商务英英解释',   icon: <BookA className="w-5 h-5" />, color: 'text-purple-600 bg-purple-50' },
  en_zh_bidirectional: { title: '英汉双向译制', subtitle: '带音标及职场黑话穿透',       icon: <Languages className="w-5 h-5" />, color: 'text-emerald-600 bg-emerald-50' },
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
          const payloadKeys = Object.keys(result?.payload || {});
          const activeIdx = payloadKeys.indexOf(activeTab);
          const activeContent = result?.payload?.[activeTab];

          return (
            <div key={type} className={`rounded-2xl border transition-all ${isOpen ? 'border-gray-200 shadow-md' : 'border-gray-100 shadow-sm'} overflow-hidden bg-white`}>
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
                <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform duration-300 ${isOpen ? 'rotate-90 text-[#FF5722]' : 'group-hover:text-gray-500'}`} />
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
                      className="w-full bg-white border border-gray-200 rounded-xl pl-4 pr-12 py-2.5 text-sm focus:outline-none focus:border-[#FF5722] shadow-sm transition"
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
                  {isLoading && (
                    <div className="flex flex-col items-center py-6 text-gray-400">
                      <Loader2 className="w-6 h-6 animate-spin mb-2 text-[#FF5722]" />
                      <span className="text-xs">Dify 工作流深度解构中...</span>
                    </div>
                  )}

                  {/* 错误 */}
                  {result?.ok === false && (
                    <div className="flex items-start text-red-500 text-xs bg-red-50 p-3 rounded-xl">
                      <AlertCircle className="w-4 h-4 mr-2 shrink-0 mt-0.5" />
                      <span>{result.message || '查询失败'}</span>
                    </div>
                  )}

                  {/* 结果区 */}
                  {result?.ok && payloadKeys.length > 0 && (
                    <>
                      {/* Tab 导航 + 收录按钮 */}
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {payloadKeys.map(key => (
                          <button
                            key={key}
                            onClick={(e) => { e.stopPropagation(); setActiveTab(key); }}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${activeTab === key ? 'bg-[#FF5722] text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                          >
                            {getLabel(key)}
                          </button>
                        ))}
                        <button
                          title={saveStatus === 'saved' ? '已收录' : saveStatus === 'exists' ? '已存在' : '收录'}
                          disabled={saveStatus === 'saving'}
                          onClick={(e) => { e.stopPropagation(); handleSave(type); }}
                          className={`ml-auto px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 text-[11px] font-bold ${saveStatus === 'saved' ? 'bg-emerald-100 text-emerald-600' : saveStatus === 'exists' ? 'bg-amber-100 text-amber-600' : saveStatus === 'error' ? 'bg-red-100 text-red-500' : 'bg-[#FF5722]/10 hover:bg-[#FF5722] text-[#FF5722] hover:text-white'}`}
                        >
                          {saveStatus === 'saved' ? <><CheckCircle2 className="w-3 h-3" />已收录</> :
                           saveStatus === 'exists' ? <><CheckCircle2 className="w-3 h-3" />已存在</> :
                           saveStatus === 'saving' ? <>保存中...</> :
                           saveStatus === 'error' ? <>失败</> :
                           <><BookmarkPlus className="w-3 h-3" />收录</>}
                        </button>
                      </div>

                      {/* 内容框 */}
                      <div className="bg-white rounded-xl border border-gray-100 shadow-inner p-3 min-h-[100px]">
                        <div className="flex items-center gap-1.5 mb-3 pb-1 border-b border-[#FF5722]/20">
                          <span className="w-1 h-4 bg-[#FF5722] rounded-full inline-block"></span>
                          <span className="text-[11px] font-black text-[#FF5722] uppercase tracking-wider">{getLabel(activeTab)}</span>
                          {typeof activeContent === 'string' && hasEnglishText(activeContent) ? (
                            <SpeakButton text={activeContent} title="播放当前英文内容" className="ml-auto w-7 h-7" iconClassName="w-3.5 h-3.5" />
                          ) : null}
                          <span className="ml-auto text-[10px] text-gray-300">{activeIdx + 1} / {payloadKeys.length}</span>
                        </div>
                        <div className="text-sm leading-relaxed text-gray-700 overflow-y-auto max-h-[200px] scrollbar-thin pr-1">
                          {activeContent !== null && activeContent !== undefined && activeContent !== ''
                            ? renderValue(activeContent)
                            : <div className="text-gray-300 text-center text-xs py-4 italic">当前维度暂无数据</div>}
                        </div>
                        {/* 前后导航 */}
                        <div className="flex justify-between mt-3 pt-2 border-t border-gray-50">
                          <button onClick={(e) => { e.stopPropagation(); const k = payloadKeys[activeIdx - 1]; if (k) setActiveTab(k); }} disabled={activeIdx === 0} className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#FF5722] disabled:opacity-30 transition">
                            <ChevronLeft className="w-4 h-4" />{activeIdx > 0 ? getLabel(payloadKeys[activeIdx - 1]) : ''}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); const k = payloadKeys[activeIdx + 1]; if (k) setActiveTab(k); }} disabled={activeIdx === payloadKeys.length - 1} className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#FF5722] disabled:opacity-30 transition">
                            {activeIdx < payloadKeys.length - 1 ? getLabel(payloadKeys[activeIdx + 1]) : ''}<ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </>
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
