import React, { useEffect, useState } from 'react';
import { BookmarkPlus, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { addWord, updateWordPayload } from '../services/vocabAPI';
import { runWordEnrichment, toVocabEnrichmentPayload } from '../services/difyAPI';
import CustomCardModal from './CustomCardModal';
import { useEnglishContext, BUSINESS_THEMES } from './modules/english/context/EnglishContext';

export default function TextHighlighter() {
  const { theme } = useEnglishContext();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ message: string; isError: boolean } | null>(null);
  const [isParaSelection, setIsParaSelection] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const handleSelection = () => {
      if (showModal) return;

      // 避免在保存过程中或展示结果时重置位置
      const isCurrentlySaving = document.getElementById('text-highlighter-saving')?.dataset.saving === 'true';
      if (isCurrentlySaving) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        if (!showModal) {
          setTimeout(() => setPosition(null), 150);
        }
        return;
      }

      const text = selection.toString().trim();
      if (text.length >= 2) {
        const hasLetters = /[a-zA-Z]/.test(text);
        if (!hasLetters) return;

        // 判断是单词/短语还是长句段落
        const isWord = text.length <= 40 && /^[a-zA-Z\s\-']+$/.test(text);
        if (isWord || text.length > 40) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 45,
          });
          setSelectedText(text);
          setIsParaSelection(!isWord);
        }
      }
    };

    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, [showModal]);

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault(); // 阻止默认行为以防止选区立即丢失
    e.stopPropagation();
    
    if (isParaSelection) {
      setShowModal(true);
      setPosition(null); // 立即隐藏悬浮气泡
      return;
    }

    if (!selectedText || isSaving) return;
    setIsSaving(true);

    const targetWord = selectedText;
    let payload = {
      word: targetWord,
      phonetic: '',
      partOfSpeech: '',
      meaning: '待复习补充',
      definition_en: '',
      business_note: '',
      examples: [] as string[],
      source: '全局划线收录',
    };

    try {
      try {
        const enriched = await runWordEnrichment(targetWord, theme);
        payload = toVocabEnrichmentPayload(enriched);
      } catch (enrichError) {
        console.error('词汇补全失败，使用占位 payload 继续入库:', enrichError);
      }

      const isBusiness = BUSINESS_THEMES.some(t => t.value === theme);
      const category = isBusiness ? 'business' : 'general';

      const created = await addWord({
        word: targetWord,
        dictType: 'manual_capture',
        category: category,  // 动态智能分类
        payload,
      });

      const wordId = created?.id;
      if (wordId) {
        await updateWordPayload(wordId, payload);
      }

      const existedMessage = created?.success === false ? '（已自动更新释义）' : '';
      const categoryLabel = category === 'business' ? '政商务区' : '全场景区';
      setSaveResult({ message: `战术词汇「${targetWord}」已存入${categoryLabel}！${existedMessage}`, isError: false });
      
      // 触发右侧 30% 视窗自动弹出并显示该词详情
      window.dispatchEvent(new CustomEvent('toggle-right-panel', {
        detail: { open: true, tab: 'context', wordData: { ...payload, id: wordId } }
      }));

      // Light celebration burst (aligned with Confetti.tsx — avoid jank)
      if (
        typeof window === 'undefined' ||
        typeof window.matchMedia !== 'function' ||
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        confetti({
          particleCount: 18,
          spread: 46,
          startVelocity: 12,
          decay: 0.92,
          ticks: 90,
          gravity: 0.9,
          scalar: 0.7,
          origin: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight },
          colors: ['#10B981', '#047857', '#FF5722', '#F97316'],
          zIndex: 10000,
        });
      }

      window.getSelection()?.removeAllRanges();
      setTimeout(() => {
        setSaveResult(null);
        setPosition(null);
      }, 3000);
    } catch (error) {
      console.error(error);
      setSaveResult({ message: '加入失败，请检查网络后重试', isError: true });
      setTimeout(() => {
        setSaveResult(null);
        setPosition(null);
      }, 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (!position) return showModal ? (
    <CustomCardModal
      initialText={selectedText}
      onClose={() => {
        setShowModal(false);
        window.getSelection()?.removeAllRanges();
      }}
      onSuccess={() => {
        setShowModal(false);
        window.getSelection()?.removeAllRanges();
        window.dispatchEvent(new Event('vocab-updated'));
      }}
    />
  ) : null;

  return (
    <>
      <div
        id="text-highlighter-saving"
        data-saving={isSaving || saveResult !== null ? 'true' : 'false'}
        onMouseDown={handleSave}
        style={{ left: position.x, top: position.y, position: 'fixed' }}
        className={`z-[9999] transform -translate-x-1/2 px-4 py-2.5 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] text-xs font-black tracking-widest flex items-center cursor-pointer transition-all ${
          saveResult 
            ? (saveResult.isError ? 'bg-red-500 text-white border border-red-600' : 'bg-emerald-500 text-white border border-emerald-600')
            : 'bg-[#202124] uppercase text-white hover:bg-[#FF5722] border border-gray-700 animate-[bounce_0.2s_ease-out]'
        }`}
      >
        {saveResult ? (
          <span>{saveResult.message}</span>
        ) : (
          <>
            {isParaSelection ? (
              <>
                <Sparkles className="w-4 h-4 mr-2 text-amber-400 animate-pulse" />
                <span>快速段落制卡</span>
              </>
            ) : (
              <>
                <BookmarkPlus className={`w-4 h-4 mr-2 ${isSaving ? 'text-gray-400 animate-spin' : 'text-[#FF5722]'}`} />
                <span>{isSaving ? '信息补全中…' : '加入生词本'}</span>
              </>
            )}
          </>
        )}
      </div>

      {showModal && (
        <CustomCardModal
          initialText={selectedText}
          onClose={() => {
            setShowModal(false);
            window.getSelection()?.removeAllRanges();
          }}
          onSuccess={() => {
            setShowModal(false);
            window.getSelection()?.removeAllRanges();
            window.dispatchEvent(new Event('vocab-updated'));
          }}
        />
      )}
    </>
  );
}
