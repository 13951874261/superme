import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Sparkles, BookOpen, Brain, Plus, Trash2, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { addWord, updateWord, batchAddWords } from '../services/vocabAPI';
import { runWordEnrichment, callVocabPurify } from '../services/difyAPI';
import { playSuccess, playError, playScan } from '../utils/soundEffects';

interface CustomCardModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialText?: string;
  editWord?: {
    id: string;
    word: string;
    category: 'business' | 'general';
    payload: any;
  };
}

export default function CustomCardModal({ onClose, onSuccess, initialText = '', editWord }: CustomCardModalProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'extract'>(
    editWord ? 'manual' : (initialText ? 'extract' : 'manual')
  );
  
  // ==========================================
  // 1. 手动录入表单状态（兼容编辑模式）
  // ==========================================
  const [word, setWord] = useState(editWord ? editWord.word : '');
  const [category, setCategory] = useState<'business' | 'general'>(editWord ? editWord.category : 'business');
  const [partOfSpeech, setPartOfSpeech] = useState(editWord ? (editWord.payload?.partOfSpeech || 'noun') : 'noun');
  const [phonetic, setPhonetic] = useState(editWord ? (editWord.payload?.phonetic || '') : '');
  const [meaning, setMeaning] = useState(editWord ? (editWord.payload?.translation_main || '') : '');
  const [definitionEn, setDefinitionEn] = useState(editWord ? (editWord.payload?.definition_en || '') : '');
  const [businessNote, setBusinessNote] = useState(editWord ? (editWord.payload?.business_note || '') : '');
  const [examples, setExamples] = useState<string[]>(
    editWord && Array.isArray(editWord.payload?.examples) && editWord.payload.examples.length > 0
      ? editWord.payload.examples 
      : ['']
  );
  
  const [isPreFilling, setIsPreFilling] = useState(false);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ==========================================
  // 2. 段落提炼状态
  // ==========================================
  const [paragraph, setParagraph] = useState(initialText);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedItems, setExtractedItems] = useState<Array<{
    word: string;
    pos?: string;
    zh_meaning?: string;
    selected: boolean;
  }>>([]);
  const [extractCategory, setExtractCategory] = useState<'business' | 'general'>('business');
  const [enrichProgress, setEnrichProgress] = useState<{
    total: number;
    current: number;
    currentWord: string;
    active: boolean;
  }>({ total: 0, current: 0, currentWord: '', active: false });

  // 如果初始文本有值，自动设置到段落里
  useEffect(() => {
    if (initialText && !editWord) {
      setParagraph(initialText);
      setActiveTab('extract');
    }
  }, [initialText, editWord]);

  // ==========================================
  // 3. 手动录入与编辑逻辑
  // ==========================================
  const handleExampleChange = (index: number, val: string) => {
    const updated = [...examples];
    updated[index] = val;
    setExamples(updated);
  };

  const addExampleField = () => {
    setExamples([...examples, '']);
  };

  const removeExampleField = (index: number) => {
    if (examples.length === 1) {
      setExamples(['']);
      return;
    }
    setExamples(examples.filter((_, i) => i !== index));
  };

  // 失去焦点或点击智能预填时触发 Dify 释义补全
  const triggerAutoPrefill = async () => {
    if (!word.trim() || isPreFilling) return;
    setIsPreFilling(true);
    setErrorMsg('');
    playScan();
    try {
      const theme = category === 'business' ? '政商务沟通' : '全场景日常沟通';
      const enriched = await runWordEnrichment(word.trim(), theme);
      if (enriched) {
        setPartOfSpeech(enriched.partOfSpeech || 'noun');
        setPhonetic(enriched.phonetic || '');
        setMeaning(enriched.meaning || '');
        setDefinitionEn(enriched.definitionEn || '');
        setBusinessNote(enriched.businessNote || '');
        if (enriched.examples && enriched.examples.length > 0) {
          setExamples(enriched.examples.filter(e => e.trim().length > 0));
        }
        playSuccess();
      }
    } catch (err: any) {
      console.error('预填失败:', err);
      setErrorMsg('AI 预填释义失败，您可以手动填写剩余内容');
    } finally {
      setIsPreFilling(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !meaning.trim()) {
      setErrorMsg('单词和核心释义为必填项');
      return;
    }
    setIsSubmittingManual(true);
    setErrorMsg('');

    const payload = {
      translation_main: meaning,
      definition_en: definitionEn,
      business_note: businessNote,
      examples: examples.filter(ex => ex.trim().length > 0),
      phonetic,
      partOfSpeech,
      source: editWord ? (editWord.payload?.source || '手动编辑闪卡') : '手动录入闪卡',
    };

    try {
      if (editWord) {
        // 调用更新接口
        await updateWord(editWord.id, {
          word: word.trim(),
          category,
          payload,
        });
      } else {
        // 创建模式
        const res = await addWord({
          word: word.trim(),
          dictType: 'manual_custom',
          category,
          payload,
        });

        if (res.success === false && res.id) {
          // 重复卡片：提示并更新其内容
          await updateWord(res.id, {
            word: word.trim(),
            category,
            payload,
          });
        }
      }

      playSuccess();
      onSuccess();
    } catch (err: any) {
      playError();
      setErrorMsg(err.message || '入库失败，请重试');
    } finally {
      setIsSubmittingManual(false);
    }
  };

  // ==========================================
  // 4. 段落提取逻辑
  // ==========================================
  const handleExtract = async () => {
    if (!paragraph.trim() || isExtracting) return;
    setIsExtracting(true);
    setExtractedItems([]);
    playScan();
    try {
      const theme = extractCategory === 'business' ? '政商务沟通' : '全场景日常沟通';
      const res = await callVocabPurify({ article_text: paragraph.trim(), topic: theme });
      if (res && (res.words || res.phrases)) {
        let items: any[] = [];
        if (res.words && res.words.length > 0) {
          items = items.concat(res.words.map(w => ({
            word: w.word,
            pos: w.pos,
            zh_meaning: w.zh_meaning,
            is_phrase: false,
            selected: true,
          })));
        }
        if (res.phrases && res.phrases.length > 0) {
          items = items.concat(res.phrases.map(p => {
            const anyP = p as any;
            return {
              word: typeof p === 'string' ? p : (anyP.phrase || p),
              pos: typeof p === 'object' && p !== null ? (anyP.pos || 'phrase') : 'phrase',
              zh_meaning: typeof p === 'object' && p !== null ? (anyP.meaning || '') : '',
              is_phrase: true,
              selected: true,
            };
          }));
        }
        setExtractedItems(items);
        playSuccess();
      } else {
        setErrorMsg('段落中未提取到有效生词或专业黑话。');
      }
    } catch (err: any) {
      playError();
      setErrorMsg(err.message || 'AI 分词提炼异常，请检查网络');
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleItemSelect = (index: number) => {
    const updated = [...extractedItems];
    updated[index].selected = !updated[index].selected;
    setExtractedItems(updated);
  };

  const handleBatchImport = async () => {
    const targets = extractedItems.filter(item => item.selected);
    if (targets.length === 0) {
      setErrorMsg('请至少勾选一个单词进行导入');
      return;
    }

    setErrorMsg('');
    setEnrichProgress({
      total: targets.length,
      current: 0,
      currentWord: '',
      active: true,
    });

    const theme = extractCategory === 'business' ? '政商务沟通' : '全场景日常沟通';
    const batchItems: any[] = [];
    let completedCount = 0;

    try {
      await Promise.all(targets.map(async (item) => {
        let payload: any = {
          translation_main: item.zh_meaning || '未分类释义',
          definition_en: '',
          business_note: '',
          examples: [],
          phonetic: '',
          partOfSpeech: item.pos || (item.is_phrase ? 'phrase' : 'noun'),
          source: '段落提炼闪卡',
        };

        try {
          const enriched = await runWordEnrichment(item.word, theme);
          if (enriched) {
            payload = {
              ...payload,
              translation_main: enriched.meaning || payload.translation_main,
              definition_en: enriched.definitionEn,
              business_note: enriched.businessNote,
              examples: enriched.examples,
              phonetic: enriched.phonetic,
              partOfSpeech: enriched.partOfSpeech || payload.partOfSpeech,
            };
          }
        } catch (enrichErr) {
          console.warn('词条 [' + item.word + '] Dify 深度解析失败，保留基础释义继续入库', enrichErr);
        }

        completedCount++;
        setEnrichProgress(prev => ({
          ...prev,
          current: completedCount,
          currentWord: item.word,
        }));

        batchItems.push({
          word: item.word,
          category: extractCategory,
          is_phrase: !!item.is_phrase,
          dictType: item.is_phrase ? 'ai_phrase' : 'ai_extracted',
          payload
        });
      }));

      const res = await batchAddWords(batchItems);
      if (res.success) {
        playSuccess();
        onSuccess();
        onClose();
      } else {
        throw new Error(res.message || '批量入库异常');
      }
    } catch (err: any) {
      playError();
      setErrorMsg(err.message || '批量导入中断，请检查数据库');
    } finally {
      setEnrichProgress(prev => ({ ...prev, active: false }));
    }
  };

  const content = (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-[fadeIn_0.2s_ease-out]">
        
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50/50 to-white">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#FF5722]" />
            <span className="font-black text-[#202124] text-sm uppercase tracking-wider">
              {editWord ? '编辑 Anki 闪卡 // Edit Flashcard' : 'Anki 式闪卡自定义制作 // Flashcard Creator'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab 切换栏 (编辑模式下隐藏段落提取) */}
        {!editWord && (
          <div className="flex border-b border-gray-100 px-6 bg-gray-50/50">
            <button
              onClick={() => { setActiveTab('manual'); setErrorMsg(''); }}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'manual' 
                  ? 'border-[#FF5722] text-[#FF5722]' 
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> 手动录入闪卡
            </button>
            <button
              onClick={() => { setActiveTab('extract'); setErrorMsg(''); }}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'extract' 
                  ? 'border-[#FF5722] text-[#FF5722]' 
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> 段落分词提炼
            </button>
          </div>
        )}

        {/* 主体滚动区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-xs text-red-600 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ==========================================
              TAB 1: 手动录入与编辑表单
              ========================================== */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 单词输入与智能预填 */}
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">
                    单词 / 短语 (Target Word) *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={word}
                      onChange={(e) => setWord(e.target.value)}
                      onBlur={triggerAutoPrefill}
                      placeholder="e.g. synergize"
                      className="flex-1 bg-gray-50 border-2 border-transparent focus:border-[#FF5722]/30 rounded-xl px-4 py-2.5 text-sm text-[#202124] outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={triggerAutoPrefill}
                      disabled={isPreFilling || !word.trim()}
                      className="px-4 bg-[#202124] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#FF5722] transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isPreFilling ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      {isPreFilling ? '解密中...' : '智能预填'}
                    </button>
                  </div>
                </div>

                {/* 词性选择 */}
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">
                    词性 (Part of Speech)
                  </label>
                  <select
                    value={partOfSpeech}
                    onChange={(e) => setPartOfSpeech(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FF5722]/30 rounded-xl px-4 py-2.5 text-sm text-[#202124] outline-none transition"
                  >
                    <option value="noun">Noun (名词)</option>
                    <option value="verb">Verb (动词)</option>
                    <option value="adjective">Adjective (形容词)</option>
                    <option value="adverb">Adverb (副词)</option>
                    <option value="phrase">Phrase (短语)</option>
                    <option value="conjunction">Conjunction (连词)</option>
                    <option value="preposition">Preposition (介词)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 发音音标 */}
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">
                    发音音标 (Phonetic)
                  </label>
                  <input
                    type="text"
                    value={phonetic}
                    onChange={(e) => setPhonetic(e.target.value)}
                    placeholder="e.g. /ˈsɪn.ə.dʒaɪz/"
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FF5722]/30 rounded-xl px-4 py-2.5 text-sm text-[#202124] outline-none transition"
                  />
                </div>

                {/* 存储分区 */}
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">
                    存入生词本分区 (Category)
                  </label>
                  <div className="flex bg-gray-100 p-1 rounded-xl w-full">
                    <button
                      type="button"
                      onClick={() => setCategory('business')}
                      className={`flex-1 text-center py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                        category === 'business' ? 'bg-white text-[#202124] shadow-sm' : 'text-gray-400'
                      }`}
                    >
                      政商务区
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategory('general')}
                      className={`flex-1 text-center py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                        category === 'general' ? 'bg-white text-[#202124] shadow-sm' : 'text-gray-400'
                      }`}
                    >
                      全场景区
                    </button>
                  </div>
                </div>
              </div>

              {/* 核心中文释义 */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">
                  核心中文释义 (Meaning) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={meaning}
                  onChange={(e) => setMeaning(e.target.value)}
                  placeholder="请输入核心中文释义，例如：协同合作，协同增效"
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FF5722]/30 rounded-xl p-3 text-sm text-[#202124] outline-none resize-none transition"
                />
              </div>

              {/* 英文定义 */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">
                  英文定义 (English Definition)
                </label>
                <textarea
                  rows={2}
                  value={definitionEn}
                  onChange={(e) => setDefinitionEn(e.target.value)}
                  placeholder="e.g. Combine or coordinate the agents or factors of a cooperative effort"
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FF5722]/30 rounded-xl p-3 text-sm text-[#202124] outline-none resize-none transition"
                />
              </div>

              {/* 商务注解 */}
              <div>
                <label className="text-[10px] font-black text-[#FF5722] uppercase tracking-widest mb-1.5 block">
                  商务注解 (Business Context)
                </label>
                <textarea
                  rows={2}
                  value={businessNote}
                  onChange={(e) => setBusinessNote(e.target.value)}
                  placeholder="补充该词在职场、汇报或商务博弈中的具体用法及策略分寸..."
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FF5722]/30 rounded-xl p-3 text-sm text-[#202124] outline-none resize-none transition"
                />
              </div>

              {/* 应用场景例句 */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex justify-between items-center">
                  <span>应用场景例句 (Usage Scenarios)</span>
                  <button
                    type="button"
                    onClick={addExampleField}
                    className="flex items-center gap-1 text-[#FF5722] hover:text-[#e64a19] text-[10px] font-black uppercase tracking-widest transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> 新增例句
                  </button>
                </label>
                <div className="space-y-2">
                  {examples.map((ex, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={ex}
                        onChange={(e) => handleExampleChange(idx, e.target.value)}
                        placeholder={`例句 ${idx + 1}`}
                        className="flex-1 bg-gray-50 border-2 border-transparent focus:border-[#FF5722]/30 rounded-xl px-4 py-2 text-sm text-[#202124] outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => removeExampleField(idx)}
                        className="p-2 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100 transition duration-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 提交按钮栏 */}
              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl border border-gray-200 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingManual || !word.trim() || !meaning.trim()}
                  className="px-8 py-2.5 bg-[#FF5722] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#e64a19] transition disabled:opacity-50 flex items-center gap-2 shadow-md hover:shadow-lg animate-pulse"
                >
                  {isSubmittingManual && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isSubmittingManual ? '正在保存...' : (editWord ? '确认保存 ➔' : '存入生词本 ➔')}
                </button>
              </div>
            </form>
          )}

          {/* ==========================================
              TAB 2: 段落分词提炼
              ========================================== */}
          {activeTab === 'extract' && !editWord && (
            <div className="space-y-4 text-left">
              
              {!enrichProgress.active && extractedItems.length === 0 && (
                <div className="space-y-4">
                  <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex gap-3 text-xs text-blue-800 font-medium">
                    <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black">智能分词机制</span>：输入一段英文文本，AI 词汇提纯引擎将调用 Dify 工作流自动扫描其中核心专业词汇及商务黑话，省去逐个查词的繁琐过程。
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">
                      英文段落内容 (English Paragraph)
                    </label>
                    <textarea
                      rows={6}
                      value={paragraph}
                      onChange={(e) => setParagraph(e.target.value)}
                      placeholder="请在此粘贴任意含有生词的英文段落、工作汇报邮件或阅读段落..."
                      className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FF5722]/30 rounded-2xl p-4 text-sm text-[#202124] outline-none resize-none transition shadow-inner"
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-6 py-2.5 rounded-xl border border-gray-200 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleExtract}
                      disabled={isExtracting || !paragraph.trim()}
                      className="px-8 py-2.5 bg-[#202124] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#FF5722] transition disabled:opacity-50 flex items-center gap-2 shadow-md hover:shadow-lg cursor-pointer"
                    >
                      {isExtracting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          正在解密提词中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                          AI 智能提炼词汇 ➔
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* 展示提纯出的单词列表 */}
              {!enrichProgress.active && extractedItems.length > 0 && (
                <div className="space-y-4 animate-[fadeIn_0.3s_ease]">
                  <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div>
                      <h4 className="text-sm font-black text-[#202124]">AI 成功提取生词</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">请勾选需要导入闪卡库的词汇：</p>
                    </div>
                    {/* 分区选择 */}
                    <div className="flex bg-gray-200/80 p-0.5 rounded-lg">
                      <button
                        onClick={() => setExtractCategory('business')}
                        className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest transition-all ${
                          extractCategory === 'business' ? 'bg-white text-[#202124] shadow-sm' : 'text-gray-400'
                        }`}
                      >
                        政商务区
                      </button>
                      <button
                        onClick={() => setExtractCategory('general')}
                        className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest transition-all ${
                          extractCategory === 'general' ? 'bg-white text-[#202124] shadow-sm' : 'text-gray-400'
                        }`}
                      >
                        全场景区
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[30vh] overflow-y-auto space-y-2 border border-gray-50 rounded-2xl p-2 bg-gray-50/50">
                    {extractedItems.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => toggleItemSelect(idx)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                          item.selected 
                            ? 'bg-[#FF5722]/5 border-[#FF5722]/20 shadow-sm' 
                            : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-400'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            item.selected ? 'bg-[#FF5722] border-transparent' : 'border-gray-300 bg-white'
                          }`}>
                            {item.selected && <span className="text-[10px] text-white font-black">✓</span>}
                          </div>
                          <div>
                            <span className={`font-bold text-sm ${item.selected ? 'text-[#202124]' : 'text-gray-400'}`}>
                              {item.word}
                            </span>
                            {item.pos && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 uppercase font-mono">
                                {item.pos}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-medium text-gray-500">
                          {item.zh_meaning}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setExtractedItems([])}
                      className="px-6 py-2.5 rounded-xl border border-gray-200 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition"
                    >
                      返回重新输入
                    </button>
                    <button
                      type="button"
                      onClick={handleBatchImport}
                      className="px-8 py-2.5 bg-[#FF5722] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#e64a19] transition flex items-center gap-2 shadow-md hover:shadow-lg"
                    >
                      一键批量补全并入库 (Auto-Enrich & Import) ➔
                    </button>
                  </div>
                </div>
              )}

              {/* 批量处理进度条 */}
              {enrichProgress.active && (
                <div className="py-8 text-center space-y-4">
                  <div className="inline-block relative">
                    <Loader2 className="w-12 h-12 text-[#FF5722] animate-spin" />
                    <Brain className="w-5 h-5 text-[#202124] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-black text-[#202124] text-sm">正在深度解析与收录闪卡...</h4>
                    <p className="text-xs text-gray-400 mt-1 font-mono">
                      当前处理单词: <span className="font-bold text-[#FF5722]">"{enrichProgress.currentWord}"</span>
                    </p>
                  </div>
                  
                  {/* 进度条 */}
                  <div className="w-full max-w-sm mx-auto bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#FF5722] to-amber-400 h-full rounded-full transition-all duration-300"
                      style={{ width: `${(enrichProgress.current / enrichProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    进度: {enrichProgress.current} / {enrichProgress.total} ({(Math.round((enrichProgress.current / enrichProgress.total) * 100))}%)
                  </p>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
