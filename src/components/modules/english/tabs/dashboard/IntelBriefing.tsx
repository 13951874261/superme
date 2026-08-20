import React from 'react';
import { BookOpen, FileText, RefreshCw } from 'lucide-react';
import SpeakButton from '../../../../SpeakButton';
import { VocabularyGrid } from './VocabularyGrid';
import { playSuccess } from '../../../../../utils/soundEffects';

export interface IntelBriefingProps {
  generatedArticle: string;
  setGeneratedArticle: (v: string) => void;
  intelSource: string;
  setIntelSource: (v: string) => void;
  isAutoGenerating: boolean;
  handleAutoGenerate: () => Promise<void>;
  theme: string;
  currentVoiceName: string;
  showResetConfirm: boolean;
  setShowResetConfirm: (v: boolean) => void;
  setExtractedWords: (v: string[]) => void;
  setExtractedPhrases: (v: string[]) => void;
  setExtractedSentences: (v: string[]) => void;
  isArticleExpanded: boolean;
  setIsArticleExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;
  showNotice: (anchor: string, msg: string, type: string) => void;
  setIsImmersiveOpen: (v: boolean) => void;
  customText: string;
  setCustomText: (v: string) => void;
  extractedWords: string[];
  extractedPhrases: string[];
  extractedSentences: string[];
  vocabDetailsMap: Record<string, any>;
  asyncMeanings: Record<string, { meaning: string; phonetic?: string }>;
  handleAddWordToVocab: (text: string, isPhrase?: boolean, isSentence?: boolean) => Promise<void>;
  fetchBilingualTranslation: (text: string) => Promise<void>;
  handleBatchAddCategory?: (category: 'words' | 'phrases' | 'sentences') => Promise<void>;
  handleBatchAddAll?: () => Promise<void>;
}

export function IntelBriefing({
  generatedArticle,
  setGeneratedArticle,
  intelSource,
  setIntelSource,
  isAutoGenerating,
  handleAutoGenerate,
  theme,
  currentVoiceName,
  showResetConfirm,
  setShowResetConfirm,
  setExtractedWords,
  setExtractedPhrases,
  setExtractedSentences,
  isArticleExpanded,
  setIsArticleExpanded,
  showNotice,
  setIsImmersiveOpen,
  customText,
  setCustomText,
  extractedWords,
  extractedPhrases,
  extractedSentences,
  vocabDetailsMap,
  asyncMeanings,
  handleAddWordToVocab,
  fetchBilingualTranslation,
  handleBatchAddCategory,
  handleBatchAddAll
}: IntelBriefingProps) {
  
  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-5 md:p-6 shadow-[0_6px_20px_rgba(0,0,0,0.015)] mb-6 space-y-5 relative">
      {/* 新设计的 UI 状态指示条 */}
      <div className="intel-source-banner" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px',
        backgroundColor: '#1a202c',
        borderLeft: '4px solid var(--color-brand)',
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <div>
          <span style={{ color: '#718096', marginRight: '8px', fontSize: '12px', fontWeight: 'bold' }}>📂 当前情报源:</span>
          <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: '900', letterSpacing: '0.05em' }}>{intelSource}</span>
        </div>
        {intelSource !== '每日系统生成' && (
          <button 
            onClick={async () => {
              localStorage.setItem('super_agent_intel_source', '每日系统生成');
              setIntelSource('每日系统生成');
              await handleAutoGenerate();
            }}
            disabled={isAutoGenerating}
            style={{ color: 'var(--color-brand-light)', background: 'none', border: 'none', cursor: isAutoGenerating ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: isAutoGenerating ? 0.5 : 1 }}
            className="btn-press"
          >
            [ 还原每日生成 ]
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <h4 className="text-sm font-black uppercase tracking-widest text-[var(--color-brand)] mb-1 flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            今日情报截获 // Immersive Intel Briefing
          </h4>
          <p className="text-xs text-gray-400 font-medium">
            基于主阵地主题【{theme}】生成的高阶商业实战材料，支持 {currentVoiceName} 语音收听与沉浸式阅读。
          </p>
        </div>
        {generatedArticle && (
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative inline-block">
              <button
                onClick={() => setShowResetConfirm(!showResetConfirm)}
                className="flex items-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-750 transition-colors shadow-sm font-black rounded-xl text-xs uppercase tracking-widest cursor-pointer btn-press"
                title="清空已生成内容，重新配置生成"
              >
                <RefreshCw className="w-4 h-4" /> 重新初始化
              </button>

              {showResetConfirm && (
                <div className="absolute right-0 top-full mt-2.5 z-50 w-72 bg-white border border-indigo-100 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.08)] p-5 text-left border-t-4 border-t-[var(--color-brand)] animate-[fadeIn_0.15s_ease-out]">
                  <div className="flex items-start gap-3">
                    <div className="bg-indigo-50 p-2 rounded-xl text-[var(--color-brand)] shrink-0">
                      <RefreshCw className="w-5 h-5 animate-spin-slow" />
                    </div>
                    <div>
                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">确认重新初始化吗？</h5>
                      <p className="text-[11px] text-gray-400 font-medium leading-relaxed mt-1">
                        这只会清除当前页面展示的今日长文和本地缓存，以便您可以重新配置生成。它**不会**删除生词库里已入库的单词。
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2.5 mt-5 pt-3 border-t border-gray-50">
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold cursor-pointer transition-colors btn-press"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => {
                        setShowResetConfirm(false);
                        setGeneratedArticle('');
                        setExtractedWords([]);
                        setExtractedPhrases([]);
                        setExtractedSentences([]);
                        setIsArticleExpanded(false);
                        localStorage.removeItem('super_agent_last_generated_article');
                        localStorage.removeItem('super_agent_last_generated_words');
                        localStorage.removeItem('super_agent_last_generated_phrases');
                        localStorage.removeItem('super_agent_last_generated_sentences');
                        showNotice('dashboard', '已成功初始化生成器，可以重新配置生成。', 'success');
                        playSuccess();
                      }}
                      className="px-3.5 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all shadow-sm btn-press"
                    >
                      确认初始化
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsImmersiveOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white transition-colors shadow-md font-black rounded-xl text-xs uppercase tracking-widest cursor-pointer btn-press"
            >
              <BookOpen className="w-4 h-4" /> 沉浸式阅读
            </button>
            <SpeakButton 
              text={generatedArticle} 
              label={`收听全文 (${currentVoiceName})`} 
              className="px-5 py-3 bg-[#202124] text-white hover:bg-[var(--color-brand)] shadow-md font-black rounded-xl btn-press" 
            />
          </div>
        )}
      </div>

      {generatedArticle ? (
        <>
          <div className="relative">
            <div
              className={`text-sm text-gray-800 leading-relaxed font-serif p-6 bg-[#f8f9fa]/60 rounded-2xl border border-gray-100 whitespace-pre-line select-text shadow-sm transition-all duration-300 ${
                isArticleExpanded ? '' : 'line-clamp-6'
              }`}
            >
              {generatedArticle}
            </div>

            {generatedArticle.length > 300 && (
              <button
                type="button"
                onClick={() => setIsArticleExpanded(prev => !prev)}
                className="mt-3 inline-flex items-center px-4 py-2 rounded-full bg-orange-50 text-[var(--color-brand)] text-xs font-black hover:bg-orange-100 transition-colors btn-press"
              >
                {isArticleExpanded ? '收起长文' : '展开全文'}
              </button>
            )}
          </div>

          <VocabularyGrid 
            extractedWords={extractedWords}
            extractedPhrases={extractedPhrases}
            extractedSentences={extractedSentences}
            vocabDetailsMap={vocabDetailsMap}
            asyncMeanings={asyncMeanings}
            handleAddWordToVocab={handleAddWordToVocab}
            fetchBilingualTranslation={fetchBilingualTranslation}
            handleBatchAddCategory={handleBatchAddCategory}
            handleBatchAddAll={handleBatchAddAll}
          />
        </>
      ) : (
        <div className="w-full grid grid-cols-1 lg:grid-cols-10 gap-8 items-stretch">
          
          {/* Left Column: Guidelines & Daily Quote (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-5 text-left">
            {/* 1. Guideline Card */}
            <div className="flex-1 bg-white/70 backdrop-blur-[4px] rounded-[1.5rem] border border-slate-100 p-6 flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="absolute right-[-20px] top-[-20px] w-24 h-24 rounded-full bg-indigo-50/35 blur-xl pointer-events-none"></div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-50 p-3 rounded-2xl text-[var(--color-brand)] shadow-inner">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                      AI 智能提纯引擎
                    </h5>
                    <span className="text-[9px] bg-indigo-100 text-[var(--color-brand)] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider mt-0.5 inline-block">
                      Active Intel Engine
                    </span>
                  </div>
                </div>
                
                <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
                  本模块是您的高能英文训练场。通过在右侧输入框粘贴英文商业段落、会议纪要或财经新闻，AI 引擎将自动提供以下强力补给：
                </p>
                
                <ul className="space-y-2.5 pt-1.5">
                  <li className="flex items-start gap-2 text-[11px] text-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] mt-1.5 shrink-0"></span>
                    <span><strong>句子级高保真点读</strong>：采用先进的语音发音人进行极速流式朗读。</span>
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] mt-1.5 shrink-0"></span>
                    <span><strong>商战词汇与短语提取</strong>：自动匹配并标记难词与高频词伙。</span>
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] mt-1.5 shrink-0"></span>
                    <span><strong>艾宾浩斯智能复习</strong>：成功提取的生词将一键加入您的长期记忆复习曲线。</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-dashed border-slate-100 mt-4">
                <button
                  onClick={() => {
                    const samples = [
                      "Apple Inc. plans to adjust its supply chain pricing strategy to mitigate macroeconomic tariffs and currency fluctuations.",
                      "The board of directors raised concerns about the company's Q3 revenue margins, emphasizing the need for stricter operational cost-cutting measures.",
                      "Our priority in this bilateral negotiation is to secure a long-term licensing agreement while maintaining absolute control over our intellectual property rights."
                    ];
                    const randomSample = samples[Math.floor(Math.random() * samples.length)];
                    setCustomText(randomSample);
                    showNotice('dashboard', '已成功加载商业研读示例文本', 'success');
                    playSuccess();
                  }}
                  className="w-full py-2 bg-indigo-50/60 hover:bg-indigo-100/80 text-[var(--color-brand)] font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all border border-indigo-100/40 cursor-pointer btn-press"
                >
                   随机加载商业研读示例
                </button>
              </div>
            </div>

            {/* 2. Daily Quote Card */}
            <div className="bg-[#FAF6F0]/70 rounded-[1.5rem] border border-[#F0E5D8]/80 p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#B8860B]">
                    Daily Quote // 今日商战箴言
                  </span>
                </div>
                <p className="text-xs text-slate-705 font-serif italic leading-relaxed">
                  "In business, you don't get what you deserve, you get what you negotiate."
                </p>
                <p className="text-[10px] text-slate-400 font-semibold text-right">
                  — Chester L. Karrass
                </p>
              </div>
              <div className="flex justify-end mt-2">
                <SpeakButton
                  text="In business, you don't get what you deserve, you get what you negotiate."
                  iconClassName="w-3 h-3"
                  className="w-6 h-6 bg-amber-50/80 text-amber-700 hover:bg-amber-600 hover:text-white border-none rounded-full cursor-pointer btn-press"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Custom Text Input Area (6 cols) */}
          <div className="lg:col-span-6 bg-white/50 backdrop-blur-[2px] rounded-[1.5rem] border border-slate-100 p-6 flex flex-col justify-between shadow-sm">
            <div className="space-y-3 flex-1 flex flex-col text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  研读段落情报输入 (Input Material)
                </span>
                {customText.length > 0 && (
                  <span className="text-[9px] text-gray-405 font-bold">
                    已输入 {customText.length} 字符
                  </span>
                )}
              </div>
              <textarea
                placeholder="在此处输入或粘贴您要研读的英文段落材料..."
                className="w-full flex-1 min-h-[280px] p-5 text-sm bg-white border border-gray-150 rounded-2xl outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-indigo-100 font-sans resize-none shadow-[0_2px_12px_rgba(0,0,0,0.01)] transition-all text-slate-800 leading-relaxed placeholder:text-gray-350"
                onChange={(e) => setCustomText(e.target.value)}
                value={customText}
              />
            </div>

            <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                {customText.trim() ? "👉 准备就绪，请选择操作" : "✍️ 请在上方输入段落开始研读"}
              </div>
              
              {customText.trim() && (
                <div className="flex gap-2.5 animate-[fadeIn_0.2s_ease-out]">
                  <SpeakButton 
                    text={customText} 
                    label="立即收听" 
                    className="px-4.5 py-2.5 bg-[#202124] text-white hover:bg-[var(--color-brand)] shadow-sm font-black rounded-xl text-[10px] uppercase tracking-widest cursor-pointer btn-press" 
                  />
                  <button
                    onClick={() => {
                      setGeneratedArticle(customText);
                      localStorage.setItem('super_agent_last_generated_article', customText);
                      setIsImmersiveOpen(true);
                      showNotice('dashboard', '已加载自定义文本进入沉浸式阅读空间', 'success');
                      playSuccess();
                    }}
                    className="flex items-center gap-2 px-4.5 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white transition-colors shadow-sm font-black rounded-xl text-[10px] uppercase tracking-widest cursor-pointer btn-press"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> 进入沉浸式阅读
                  </button>
                </div>
              )}
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
