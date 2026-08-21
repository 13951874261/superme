import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, X, Loader2 } from 'lucide-react';
import SpeakButton from '../../../../SpeakButton';
import { addWord, updateWordPayload, queryDictionaryWithCache } from '../../../../../services/vocabAPI';
import { runWordEnrichment, toVocabEnrichmentPayload } from '../../../../../services/difyAPI';
import { playSuccess, playError, playPageTurn } from '../../../../../utils/soundEffects';
/** 与 App RightPanel 宽度一致，沉浸层需让出右侧以免 z-[9999] 挡住情报解密仓 */
const RIGHT_PANEL_WIDTH_PX = 400;

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
  // 情报解密仓打开时，沉浸层让出右侧，避免全屏遮罩盖住 RightPanel
  const [leaveRoomForPanel, setLeaveRoomForPanel] = useState(false);

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

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.open === false) {
        setLeaveRoomForPanel(false);
      } else if (detail.open === true) {
        setLeaveRoomForPanel(true);
      }
    };
    window.addEventListener('toggle-right-panel', handleToggle);
    return () => window.removeEventListener('toggle-right-panel', handleToggle);
  }, []);

  useEffect(() => {
    if (!isOpen) setLeaveRoomForPanel(false);
  }, [isOpen]);

  if (!isOpen || !generatedArticle) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="沉浸式阅读空间"
      style={leaveRoomForPanel ? { right: RIGHT_PANEL_WIDTH_PX } : undefined}
      className={`fixed top-0 left-0 bottom-0 z-[9999] flex flex-col overscroll-contain transition-[right] duration-300 ${
      leaveRoomForPanel ? '' : 'right-0'
    } ${
      immersiveTheme === 'dark' ? 'bg-[var(--color-brand-dark)] text-slate-205' :
      immersiveTheme === 'parchment' ? 'bg-[#fcf8f2] text-slate-800' : 'bg-white text-slate-900'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-8 py-5 border-b shrink-0 ${
        immersiveTheme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200/60 bg-gray-50'
      }`}>
        <div className="flex items-center gap-3">
          <BookOpen aria-hidden="true" className="w-5 h-5 text-[var(--color-brand)]" />
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
          <div className="flex items-center gap-1.5 bg-black/5 p-1 rounded-lg" role="group" aria-label="阅读主题">
            <button
              type="button"
              aria-pressed={immersiveTheme === 'paper'}
              onClick={() => setImmersiveTheme('paper')}
              className={`px-3 py-1 text-[10px] font-black uppercase rounded transition-colors ${
                immersiveTheme === 'paper' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              纸张
            </button>
            <button
              type="button"
              aria-pressed={immersiveTheme === 'parchment'}
              onClick={() => setImmersiveTheme('parchment')}
              className={`px-3 py-1 text-[10px] font-black uppercase rounded transition-colors ${
                immersiveTheme === 'parchment' ? 'bg-[#f5e6d3] shadow-sm text-[#5c3e21]' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              雅致
            </button>
            <button
              type="button"
              aria-pressed={immersiveTheme === 'dark'}
              onClick={() => setImmersiveTheme('dark')}
              className={`px-3 py-1 text-[10px] font-black uppercase rounded transition-colors ${
                immersiveTheme === 'dark' ? 'bg-slate-800 shadow-sm text-slate-200' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              深邃
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-black/5 p-1 rounded-lg" role="group" aria-label="字号">
            <button
              type="button"
              aria-pressed={immersiveFontSize === 'base'}
              aria-label="较小字号"
              onClick={() => setImmersiveFontSize('base')}
              className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded transition-colors ${
                immersiveFontSize === 'base' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-gray-800'
              }`}
              title="较小字号"
            >
              A-
            </button>
            <button
              type="button"
              aria-pressed={immersiveFontSize === 'lg'}
              aria-label="中等字号"
              onClick={() => setImmersiveFontSize('lg')}
              className={`w-7 h-7 flex items-center justify-center text-sm font-bold rounded transition-colors ${
                immersiveFontSize === 'lg' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-gray-800'
              }`}
              title="中等字号"
            >
              A
            </button>
            <button
              type="button"
              aria-pressed={immersiveFontSize === 'xl'}
              aria-label="较大字号"
              onClick={() => setImmersiveFontSize('xl')}
              className={`w-7 h-7 flex items-center justify-center text-base font-bold rounded transition-colors ${
                immersiveFontSize === 'xl' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-gray-800'
              }`}
              title="较大字号"
            >
              A+
            </button>
          </div>

          <div className="h-5 w-px bg-gray-300" aria-hidden="true" />

          <SpeakButton
            text={generatedArticle}
            label={`收听全文 (${currentVoiceName})`}
            className="px-4 py-2 bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dark)] shadow-sm text-[10px] font-black btn-press"
          />

          <button
            type="button"
            aria-label="关闭沉浸式阅读"
            onClick={() => {
              onClose();
              setSelectedWord('');
            }}
            className="w-9 h-9 flex items-center justify-center bg-black/5 hover:bg-black/10 rounded-full transition-colors cursor-pointer text-gray-500 hover:text-red-500 btn-press"
            title="关闭沉浸式阅读 (Esc)"
          >
            <X aria-hidden="true" className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Reading body */}
      <div 
        className="flex-1 overflow-y-auto overscroll-contain px-8 py-12 flex justify-center"
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
              <div className="absolute -left-12 top-1.5 opacity-0 group-hover:opacity-100 transition-[opacity,transform] duration-300 transform translate-x-2 group-hover:translate-x-0">
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
            type="button"
            disabled={isAddingSelected}
            onClick={async () => {
              playPageTurn();
              setIsAddingSelected(true);
              const targetWord = selectedWord;
              let payload: Record<string, unknown> = {
                word: targetWord,
                source: 'immersive_reading',
                theme,
              };
              try {
                // 1) 立即打开解密仓（仅 word），RightPanel 开始拉词典
                window.dispatchEvent(new CustomEvent('toggle-right-panel', {
                  detail: {
                    open: true,
                    tab: 'context',
                    wordData: { word: targetWord, source: 'immersive_reading' },
                  },
                }));

                // 2) 主动拉取与完整解密仓相同的商业词典（优先），结果经 dictPreload 注入
                let dictPreload: Awaited<ReturnType<typeof queryDictionaryWithCache>> | null = null;
                try {
                  dictPreload = await queryDictionaryWithCache({
                    word: targetWord,
                    dictType: 'en_en_business',
                  });
                  if (!dictPreload?.ok) {
                    dictPreload = await queryDictionaryWithCache({
                      word: targetWord,
                      dictType: 'en_zh_bidirectional',
                    });
                  }
                  if (dictPreload?.ok) {
                    window.dispatchEvent(new CustomEvent('toggle-right-panel', {
                      detail: {
                        open: true,
                        tab: 'context',
                        wordData: {
                          word: targetWord,
                          source: 'immersive_reading',
                          dictPreload,
                        },
                      },
                    }));
                  }
                } catch (dictErr) {
                  console.error('沉浸式阅读词典查询失败:', dictErr);
                }

                // 3) enrichment 仅用于入库 payload，不再当作解密仓主展示
                try {
                  const enriched = await runWordEnrichment(targetWord, theme);
                  payload = { ...toVocabEnrichmentPayload(enriched), source: 'immersive_reading', theme };
                } catch (enrichError) {
                  console.error('沉浸式阅读词汇补全失败，使用占位 payload 继续入库:', enrichError);
                  payload = {
                    word: targetWord,
                    phonetic: '',
                    partOfSpeech: '',
                    meaning: '',
                    definition_en: '',
                    business_note: '',
                    examples: [],
                    source: 'immersive_reading',
                    theme,
                  };
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
                    wordData: {
                      ...payload,
                      id: wordId,
                      word: targetWord,
                      ...(dictPreload?.ok ? { dictPreload } : {}),
                    },
                  },
                }));

                showNotice('dashboard', `“${targetWord}” 已加入生词本，可查看释义`, 'success');
                window.dispatchEvent(new Event('vocab-updated'));
                playSuccess();
              } catch (e) {
                playError();
                showNotice('dashboard', `“${targetWord}” 加入生词本失败，请检查网络后重试`, 'error');
              } finally {
                setIsAddingSelected(false);
                setSelectedWord('');
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase rounded-xl transition-colors cursor-pointer disabled:opacity-50 btn-press"
          >
            {isAddingSelected ? <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" /> : '加入词库'}
          </button>
          <button
            type="button"
            aria-label="取消选词"
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
