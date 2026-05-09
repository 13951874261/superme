import React, { useState, useEffect } from 'react';
import { Type, BookA, Languages, ChevronLeft, Search, Loader2, BookmarkPlus, AlertCircle, ChevronRight, CheckCircle2 } from 'lucide-react';
import { addWord, queryDictionary } from '../services/vocabAPI';

type DictType = 'zh_modern' | 'en_en_business' | 'en_zh_bidirectional' | null;

interface DictResult {
  ok: boolean;
  type?: string;
  payload?: any;
  error_code?: string;
  message?: string;
}

// 英文 payload key → 中文显示名称映射表（覆盖 Dify 常见返回字段）
const KEY_LABEL_MAP: Record<string, string> = {
  // 基础信息
  headword: '词条',
  word: '词条',
  term: '词汇',
  pos: '词性',
  part_of_speech: '词性',
  level: '语言等级',
  register: '语体风格',
  type: '类型',
  note: '注解',
  remark: '备注',
  tip: '提示',
  explanation: '说明',

  // 翻译方向与核心译义（英汉双向）
  direction: '翻译方向',
  direction_resolved: '翻译方向',
  'direction resolved': '翻译方向',
  translation_main: '核心译义',
  'translation main': '核心译义',
  translation: '译文',
  zh: '中文',
  en: '英文',
  scene: '场景',
  context: '语境',

  // 发音与词源
  phonetic: '音标',
  phonetics: '音标',
  pronunciation: '发音',
  etymology: '词源',

  // 定义与释义
  definition: '词义定义',
  definitions: '词义定义',
  definitions_en: '英文定义',
  'definitions en': '英文定义',

  // 用法与说明
  usage_notes: '使用说明',
  'usage notes': '使用说明',
  usage: '用法说明',
  notes: '补充注解',
  writing_tips: '写作技巧',
  formal_usage: '正式用法',
  informal_usage: '非正式用法',
  common_mistakes: '常见错误',

  // 搭配与语境
  collocations: '搭配用法',
  collocation: '搭配用法',
  business_context: '商务语境',
  business_notes: '商务注解',
  'business notes': '商务注解',
  business_examples: '商务例句',
  'business examples': '商务例句',

  // 易混词与近反义词
  confusable_pairs: '易混词辨析',
  'confusable pairs': '易混词辨析',
  confusable: '易混词辨析',
  synonyms: '近义词',
  antonyms: '反义词',
  related_words: '相关词汇',
  compound_words: '复合词',
  idioms: '习语',
  proverbs: '谚语',

  // 例句与场景
  example_sentences: '例句',
  'example sentences': '例句',
  examples: '例句',
  example: '例句',
  scenarios: '应用场景',
  'application scenarios': '应用场景',

  // 翻译与文化
  cross_cultural: '跨文化注解',
  hidden_meaning: '职场弦外之音',

  // 总结
  summary: '总结',
};


function getChineseLabel(key: string): string {
  return KEY_LABEL_MAP[key.toLowerCase()] || KEY_LABEL_MAP[key] || key.replace(/_/g, ' ');
}

// 已知枚举值 → 中文翻译（如翻译方向、词性标记等）
const VALUE_LABEL_MAP: Record<string, string> = {
  // 翻译方向枚举
  zh_to_en: '中文 → 英文',
  en_to_zh: '英文 → 中文',
  auto: '自动识别',
  en_en: '英英解释',
  // 词性
  noun: '名词',
  verb: '动词',
  adjective: '形容词',
  adverb: '副词',
  preposition: '介词',
  conjunction: '连词',
  pronoun: '代词',
  interjection: '感叹词',
  // 语体等级
  formal: '正式',
  informal: '非正式',
  neutral: '中性',
  colloquial: '口语',
  // 常见布尔类语义
  'true': '是',
  'false': '否',
};

function getChineseValue(value: string): string {
  return VALUE_LABEL_MAP[value] || VALUE_LABEL_MAP[value.toLowerCase()] || value;
}

// 安全递归渲染任意 payload 值（导出供 FlashCard 复用）
export function renderValue(value: any, depth = 0): React.ReactNode {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return <span className="whitespace-pre-wrap leading-relaxed">{getChineseValue(value)}</span>;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span className="whitespace-pre-wrap leading-relaxed">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-2 mt-1">
        {value.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#FF5722]/50 shrink-0"></span>
            <span className="text-gray-700">{renderValue(item, depth + 1)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === 'object') {
    return (
      <div className="space-y-4 mt-1">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
            {/* 子字段标签 — 独立一行，突出显示 */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white">
              <span className="w-1 h-4 rounded-full bg-[#FF5722] inline-block shrink-0"></span>
              <span className="text-[13px] font-black text-[#202124] tracking-wide">
                {getChineseLabel(k)}
              </span>
            </div>
            {/* 子字段内容 */}
            <div className="px-3 py-2.5 text-sm text-gray-700 leading-relaxed">
              {renderValue(v, depth + 1)}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <span>{String(value)}</span>;
}

export default function DictionaryPanel() {
  const [activeDict, setActiveDict] = useState<DictType>(null);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DictResult | null>(null);
  const [activeTab, setActiveTab] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'exists' | 'error'>('idle');

  useEffect(() => {
    const handleView = (e: any) => {
      const entry = e.detail;
      setQuery(entry.word || '');
      setActiveDict((entry.dict_type as DictType) || 'en_zh_bidirectional');
      if (entry.payload) {
        setResult({
          ok: true,
          type: entry.dict_type,
          payload: entry.payload
        });
        const rootKeys = Object.keys(entry.payload);
        if (rootKeys.length > 0) setActiveTab(rootKeys[0]);
      }
      setSaveStatus('saved');
    };
    
    window.addEventListener('vocab-view', handleView);
    return () => window.removeEventListener('vocab-view', handleView);
  }, []);

  const dictConfig = {
    'zh_modern': {
      title: '现代汉语词典',
      subtitle: '词汇溯源与写作文风升维支撑',
      icon: <Type className="w-5 h-5" />,
      colorClass: 'text-blue-600 bg-blue-50 group-hover:bg-blue-100'
    },
    'en_en_business': {
      title: '英英词典',
      subtitle: '沉浸获取原生商务英英解释',
      icon: <BookA className="w-5 h-5" />,
      colorClass: 'text-purple-600 bg-purple-50 group-hover:bg-purple-100'
    },
    'en_zh_bidirectional': {
      title: '英汉双向译制',
      subtitle: '带音标及职场黑话穿透',
      icon: <Languages className="w-5 h-5" />,
      colorClass: 'text-emerald-600 bg-emerald-50 group-hover:bg-emerald-100'
    }
  };

  const handleSearch = async () => {
    if (!query.trim() || !activeDict) return;
    setIsLoading(true);
    setResult(null);
    setActiveTab('');

    try {
      const parsed = await queryDictionary({
        word: query.trim(),
        dictType: activeDict,
        direction: 'auto',
        locale: 'zh-CN',
        userContext: '',
        userId: 'frontend-panel',
      });
      console.log('[DictionaryPanel] Proxy payload:', JSON.stringify(parsed?.payload, null, 2));
      setResult(parsed);
      const firstKey = Object.keys(parsed?.payload || {})[0];
      if (firstKey) setActiveTab(firstKey);
    } catch (err: any) {
      console.error(err);
      setResult({ ok: false, message: err.message || '网络请求或解析异常' });
    } finally {
      setIsLoading(false);
    }
  };

  // ── 词典选择首页 ──────────────────────────────────────────
  if (!activeDict) {
    return (
      <div className="px-6 pb-6 mt-4">
        <h3 className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3 pl-2">Utility Tools</h3>
        <div className="space-y-2">
          {(Object.keys(dictConfig) as DictType[]).map((type) => {
            if (!type) return null;
            const config = dictConfig[type];
            return (
              <button
                key={type}
                onClick={() => { setActiveDict(type); setResult(null); setQuery(''); }}
                className="w-full bg-white flex items-center p-3 rounded-2xl hover:bg-gray-50 border border-gray-100 shadow-sm transition-all group"
              >
                <div className={`p-2 rounded-xl transition-colors mr-4 ${config.colorClass}`}>
                  {config.icon}
                </div>
                <div className="text-left flex-1">
                  <div className="font-bold text-[#202124] text-sm">{config.title}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{config.subtitle}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── 检索面板 ──────────────────────────────────────────────
  const config = dictConfig[activeDict];
  const payloadKeys = Object.keys(result?.payload || {});
  const activeContent = result?.payload?.[activeTab];
  const activeTabIndex = payloadKeys.indexOf(activeTab);

  return (
    <div className="px-6 pb-6 mt-4 flex flex-col gap-3">
      {/* 顶部标题栏 */}
      <div className="flex items-center">
        <button
          onClick={() => setActiveDict(null)}
          className="mr-3 p-1.5 rounded-full hover:bg-gray-200 text-gray-500 transition shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-sm text-[#202124] flex items-center">
          <span className={`mr-2 ${config.colorClass.split(' ')[0]}`}>{config.icon}</span>
          {config.title}
        </span>
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="切入精准词条..."
          className="w-full bg-white border border-gray-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-[#FF5722] focus:ring-1 focus:ring-[#FF5722] shadow-sm transition"
        />
        <button
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
          className="absolute right-2 top-2 bg-[#202124] text-white p-1.5 rounded-lg hover:bg-[#FF5722] disabled:opacity-50 transition"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </div>

      {/* 加载中 */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mb-2 text-[#FF5722]" />
          <span className="text-xs">Dify 工作流深度解构中...</span>
        </div>
      )}

      {/* 错误提示 */}
      {result?.ok === false && (
        <div className="flex items-start text-red-500 text-xs bg-red-50 p-3 rounded-xl">
          <AlertCircle className="w-4 h-4 mr-2 shrink-0 mt-0.5" />
          <span>{result.message || '查询失败'}</span>
        </div>
      )}

      {/* Tab 导航 + 独立容器内容（仅在成功时显示）*/}
      {result?.ok && payloadKeys.length > 0 && (
        <>
          {/* Tab 导航：中文标签横排，支持换行 */}
          <div className="flex flex-wrap gap-1.5 items-center">
            {payloadKeys.map(key => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                  activeTab === key
                    ? 'bg-[#FF5722] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800'
                }`}
              >
                {getChineseLabel(key)}
              </button>
            ))}

            {/* 生词本收录 */}
            <button
              title={saveStatus === 'saved' ? '已收录' : saveStatus === 'exists' ? '已在生词本中' : '添加到生词本'}
              disabled={saveStatus === 'saving'}
              onClick={async () => {
                if (!result?.payload || !query.trim()) return;
                setSaveStatus('saving');
                try {
                  const res = await addWord({
                    word: query.trim(),
                    dictType: activeDict || '',
                    payload: result.payload,
                  });
                  if (res.success) {
                    setSaveStatus('saved');
                    window.dispatchEvent(new CustomEvent('vocab-updated'));
                  } else {
                    setSaveStatus('exists');
                  }
                } catch {
                  setSaveStatus('error');
                }
                setTimeout(() => setSaveStatus('idle'), 3000);
              }}
              className={`ml-auto px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 text-[11px] font-bold ${
                saveStatus === 'saved' ? 'bg-emerald-100 text-emerald-600' :
                saveStatus === 'exists' ? 'bg-amber-100 text-amber-600' :
                saveStatus === 'error' ? 'bg-red-100 text-red-500' :
                'bg-[#FF5722]/10 hover:bg-[#FF5722] text-[#FF5722] hover:text-white'
              }`}
            >
              {saveStatus === 'saved' ? <><CheckCircle2 className="w-3 h-3" />已收录</> :
               saveStatus === 'exists' ? <><CheckCircle2 className="w-3 h-3" />已存在</> :
               saveStatus === 'saving' ? <>保存中...</> :
               saveStatus === 'error' ? <>连接失败</> :
               <><BookmarkPlus className="w-3 h-3" />收录</>}
            </button>
          </div>

          {/* 独立内容容器：Tab 切换，无需滚动 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-inner p-4 min-h-[160px]">
            {/* Tab 页脚标记 */}
            <div className="flex items-center gap-1.5 mb-3 pb-1 border-b border-[#FF5722]/20">
              <span className="w-1 h-4 bg-[#FF5722] rounded-full inline-block"></span>
              <span className="text-[11px] font-black text-[#FF5722] uppercase tracking-wider">
                {getChineseLabel(activeTab)}
              </span>
              <span className="ml-auto text-[10px] text-gray-300">
                {activeTabIndex + 1} / {payloadKeys.length}
              </span>
            </div>

            {/* 当前 Tab 的内容 */}
            <div className="text-sm leading-relaxed text-gray-700 overflow-y-auto max-h-[260px] scrollbar-thin pr-1">
              {/* 音标字段：自适应渲染 */}
              {['phonetic', 'phonetics', 'pronunciation'].includes(activeTab) ? (
                (() => {
                  if (!activeContent) {
                    return <div className="text-gray-300 text-center text-xs py-6 italic">暂无音标数据</div>;
                  }
                  const strVal = typeof activeContent === 'string' ? activeContent : JSON.stringify(activeContent);
                  const hasChinese = /[\u4e00-\u9fa5]/.test(strVal);
                  // 包含中文 → 普通文本展示（Dify 返回了非音标内容）
                  if (hasChinese) {
                    return (
                      <div>
                        <div className="text-[10px] text-amber-500 bg-amber-50 border border-amber-100 rounded px-2 py-1 mb-3 inline-flex items-center gap-1">
                          ⚠️ AI 返回了释义文本而非 IPA 音标
                        </div>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap">{strVal}</div>
                      </div>
                    );
                  }
                  // 拼音/IPA → 大字号 serif 字体展示
                  return (
                    <div className="text-center py-4">
                      <span
                        className="text-2xl font-bold text-[#202124] tracking-widest"
                        style={{ fontFamily: "'Times New Roman', Times, serif" }}
                      >
                        {strVal}
                      </span>
                    </div>
                  );
                })()
              ) : (
                /* 通用渲染 */
                activeContent !== null && activeContent !== undefined && activeContent !== ''
                  ? renderValue(activeContent)
                  : <div className="text-gray-300 text-center text-xs py-6 italic">当前维度暂无数据</div>
              )}
            </div>

            {/* 上一个 / 下一个导航箭头 */}
            <div className="flex justify-between mt-4 pt-2 border-t border-gray-50">
              <button
                onClick={() => {
                  const prevKey = payloadKeys[activeTabIndex - 1];
                  if (prevKey) setActiveTab(prevKey);
                }}
                disabled={activeTabIndex === 0}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#FF5722] disabled:opacity-30 transition"
              >
                <ChevronLeft className="w-4 h-4" />
                {activeTabIndex > 0 ? getChineseLabel(payloadKeys[activeTabIndex - 1]) : ''}
              </button>
              <button
                onClick={() => {
                  const nextKey = payloadKeys[activeTabIndex + 1];
                  if (nextKey) setActiveTab(nextKey);
                }}
                disabled={activeTabIndex === payloadKeys.length - 1}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#FF5722] disabled:opacity-30 transition"
              >
                {activeTabIndex < payloadKeys.length - 1 ? getChineseLabel(payloadKeys[activeTabIndex + 1]) : ''}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* 默认空态 */}
      {!result && !isLoading && (
        <div className="text-gray-400 text-center py-8 text-xs">等待输入待解构词块...</div>
      )}
    </div>
  );
}
