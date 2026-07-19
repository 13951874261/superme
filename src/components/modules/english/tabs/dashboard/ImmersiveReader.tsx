import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, X, Loader2 } from 'lucide-react';
import SpeakButton from '../../../../SpeakButton';
import { addWord, updateWordPayload } from '../../../../../services/vocabAPI';
import { runWordEnrichment, toVocabEnrichmentPayload } from '../../../../../services/difyAPI';
import { playSuccess, playError, playPageTurn } from '../../../../../utils/soundEffects';

export interface ImmersiveReaderProps {
  isOpen: boolean;
  onClose: () => void;
  generatedArticle: string;
  theme: string;
  cefrLevel: string;
  genre: string;
  currentVoiceName: string;
  immersiveTheme: 'paper' | 'parchment' | 'dark';
  setImmersiveTheme: (t: 'paper' | 'parchment' | 'dark') => void;
  immersiveFontSize: 'base' | 'lg' | 'xl';
  setImmersiveFontSize: (s: 'base' | 'lg' | 'xl') => void;
  selectedWord: string;
  setSelectedWord: (w: string) => void;
  isAddingSelected: boolean;
  setIsAddingSelected: (val: boolean) => void;
  showNotice: (anchor: string, msg: string, type: string) => void;
}

export function ImmersiveReader({
  isOpen,
  onClose,
  generatedArticle,
  theme,
  cefrLevel,
  genre,
  currentVoiceName,
  immersiveTheme,
  setImmersiveTheme,
  immersiveFontSize,
  setImmersiveFontSize,
  selectedWord,
  setSelectedWord,
  isAddingSelected,
  setIsAddingSelected,
  showNotice
}: ImmersiveReaderProps) {
  
  // Esc 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !generatedArticle) return null;

  return createPortal(
    <div className={`fixed inset-0 z-[9999] flex flex-col transition-all duration-300 ${
      immersiveTheme === 'dark' ? 'bg-[#0f172a] text-slate-205' :
      immersiveTheme === 'parchment' ? 'bg-[#fcf8f2] text-slate-800' : 'bg-white text-slate-900'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-8 py-5 border-b shrink-0 ${
        immersiveTheme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200/60 bg-gray-50'
      }`}>
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-[var(--color-brand)]" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-brand)]">
              沉浸式阅读空间 // Immersive Reading Room
            </h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
              Theme: {theme} | cefr: {cefrLevel} | genre: {genre}
            </p>
          </div>
        </div>

        {/* Typography Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-black/5 p-1 rounded-lg">
            <button
              onClick={() => setImmersiveTheme('paper')}
              className={`px-3 py-1 text-[10px] font-black uppercase rounded ${
                immersiveTheme === 'paper' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              纸张
            </button>
            <button
              onClick={() => setImmersiveTheme('parchment')}
              className={`px-3 py-1 text-[10px] font-black uppercase rounded ${
                immersiveTheme === 'parchment' ? 'bg-[#f5e6d3] shadow-sm text-[#5c3e21]' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              雅致
            </button>
            <button
              onClick={() => setImmersiveTheme('dark')}
              className={`px-3 py-1 text-[10px] font-black uppercase rounded ${
                immersiveTheme === 'dark' ? 'bg-slate-800 shadow-sm text-slate-200' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              深邃
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-black/5 p-1 rounded-lg">
            <button
              onClick={() => setImmersiveFontSize('base')}
              className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded ${
                immersiveFontSize === 'base' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-gray-800'
              }`}
              title="较小字号"
            >
              A-
            </button>
            <button
              onClick={() => setImmersiveFontSize('lg')}
              className={`w-7 h-7 flex items-center justify-center text-sm font-bold rounded ${
                immersiveFontSize === 'lg' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-gray-800'
              }`}
              title="中等字号"
            >
              A
            </button>
            <button
              onClick={() => setImmersiveFontSize('xl')}
              className={`w-7 h-7 flex items-center justify-center text-base font-bold rounded ${
                immersiveFontSize === 'xl' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-gray-800'
              }`}
              title="较大字号"
            >
              A+
            </button>
          </div>

          <div className="h-5 w-px bg-gray-300" />

          <SpeakButton
            text={generatedArticle}
            label={`收听全文 (${currentVoiceName})`}
            className="px-4 py-2 bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dark)] shadow-sm text-[10px] font-black btn-press"
          />

          <button
            onClick={() => {
              onClose();
              setSelectedWord('');
            }}
            className="w-9 h-9 flex items-center justify-center bg-black/5 hover:bg-black/10 rounded-full transition-colors cursor-pointer text-gray-500 hover:text-red-500 btn-press"
            title="关闭沉浸式阅读 (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Reading body */}
      <div 
        className="flex-1 overflow-y-auto px-8 py-12 flex justify-center"
        style={{ scrollbarWidth: 'thin' }}
      >
        <div 
          className={`max-w-3xl w-full font-serif leading-loose select-text cursor-text ${
            immersiveFontSize === 'base' ? 'text-base' :
            immersiveFontSize === 'lg' ? 'text-lg md:text-xl' : 'text-xl md:text-2xl'
          }`}
          onMouseUp={() => {
            const sel = window.getSelection()?.toString().trim();
            if (sel && sel.split(/\s+/).length <= 5) {
              setSelectedWord(sel);
            }
          }}
        >
          {generatedArticle.split('\n\n').map((paragraph, index) => (
            <div key={index} className="group relative flex items-start gap-4 mb-8">
              <div className="absolute -left-12 top-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                <SpeakButton
                  text={paragraph}
                  className="w-8 h-8 bg-orange-50 hover:bg-[var(--color-brand)] text-[var(--color-brand)] hover:text-white rounded-full shadow-sm cursor-pointer"
                  iconClassName="w-3.5 h-3.5"
                  title="朗读本段"
                />
              </div>
              <p className="indent-8 leading-relaxed hover:opacity-100 transition-opacity flex-1">
                {paragraph}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Selection Tooltip */}
      {selectedWord && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-55 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl border animate-[fadeIn_0.2s_ease-out] ${
          immersiveTheme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
        }`}>
          <span className="text-xs font-black text-[var(--color-brand)]">“{selectedWord}”</span>
          <button
            disabled={isAddingSelected}
            onClick={async () => {
              playPageTurn();
              setIsAddingSelected(true);
              const targetWord = selectedWord;
              let payload = {
                word: targetWord,
                phonetic: '',
                partOfSpeech: '',
                meaning: '待复习补充',
                definition_en: '',
                business_note: '',
                examples: [] as string[],
                source: 'immersive_reading',
                theme,
              };
              try {
                try {
                  const enriched = await runWordEnrichment(targetWord, theme);
                  payload = { ...toVocabEnrichmentPayload(enriched), source: 'immersive_reading', theme };
                } catch (enrichError) {
                  console.error('沉浸式阅读词汇补全失败，使用占位 payload 继续入库:', enrichError);
                }

                const category = theme === '日常场景' || theme.includes('日常') ? 'general' : 'business';
                const created = await addWord({
                  word: targetWord,
                  dictType: 'immersive-highlight',
                  scene_type: category,
                  category,
                  payload,
                });

                const wordId = created?.id;
                if (wordId) {
                  await updateWordPayload(wordId, payload);
                }

                window.dispatchEvent(new CustomEvent('toggle-right-panel', {
                  detail: {
                    open: true,
                    tab: 'context',
                    wordData: { ...payload, id: wordId, word: targetWord },
                  },
                }));

                showNotice('dashboard', `“${targetWord}” 已成功加入词库并解锁解析`, 'success');
                window.dispatchEvent(new Event('vocab-updated'));
                playSuccess();
              } catch (e) {
                playError();
                showNotice('dashboard', `“${targetWord}” 入库失败，请检查网络`, 'error');
              } finally {
                setIsAddingSelected(false);
                setSelectedWord('');
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer disabled:opacity-50 btn-press"
          >
            {isAddingSelected ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '加入词库'}
          </button>
          <button
            onClick={() => setSelectedWord('')}
            className="text-gray-400 hover:text-gray-600 text-sm font-bold ml-1"
          >
            取消
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
