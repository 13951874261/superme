import React, { useEffect, useState } from 'react';
import { BookmarkPlus, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import CustomCardModal from './CustomCardModal';
import { useEnglishContext } from './modules/english/context/EnglishContext';
import { useVocabCollect } from '../hooks/useVocabCollect';
import VocabZoneCollectButtons from './VocabZoneCollectButtons';
import {
  VOCAB_ZONE_LABEL,
  classifyCollectKind,
  type VocabCategory,
} from '../utils/vocabZoneLabels';

export default function TextHighlighter() {
  const { theme } = useEnglishContext();
  const {
    collect: collectVocab,
    hydrateTexts,
    getCollectingZone,
    getQueuedZone,
    getStoredCategory,
  } = useVocabCollect();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ message: string; isError: boolean } | null>(null);
  const [isParaSelection, setIsParaSelection] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!selectedText) return;
    const sync = () => hydrateTexts([selectedText]);
    sync();
    window.addEventListener('vocab-updated', sync);
    return () => window.removeEventListener('vocab-updated', sync);
  }, [selectedText, hydrateTexts]);

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

  const handleSave = async (e: React.MouseEvent, category?: VocabCategory) => {
    e.preventDefault(); // 阻止默认行为以防止选区立即丢失
    e.stopPropagation();
    
    if (isParaSelection) {
      setShowModal(true);
      setPosition(null); // 立即隐藏悬浮气泡
      return;
    }

    if (!selectedText || isSaving || !category) return;
    setIsSaving(true);

    const targetWord = selectedText;
    const kind = classifyCollectKind(targetWord);
    const stored = getStoredCategory(targetWord);

    try {
      const outcome = await collectVocab({
        text: targetWord,
        category,
        ...kind,
        migrateOnly: !!stored && stored !== category,
        source: '全局划线收录',
        topic: theme,
        payload: { source: '全局划线收录' },
        anchor: e.currentTarget,
      });
      if (outcome === 'failed' || outcome === 'blocked') {
        if (outcome === 'failed') {
          setSaveResult({ message: '加入失败，请检查网络后重试', isError: true });
        }
        return;
      }

      setSaveResult({ message: `战术词汇「${targetWord}」已存入${VOCAB_ZONE_LABEL[category]}！`, isError: false });

      window.dispatchEvent(new CustomEvent('toggle-right-panel', {
        detail: { open: true, tab: 'context', wordData: { word: targetWord, source: '全局划线收录' } }
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
        onMouseDown={isParaSelection ? handleSave : undefined}
        style={{ left: position.x, top: position.y, position: 'fixed' }}
        className={`z-[9999] transform -translate-x-1/2 px-4 py-2.5 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] text-xs font-black tracking-widest flex items-center gap-2 transition-all ${
          saveResult 
            ? (saveResult.isError ? 'bg-red-500 text-white border border-red-600' : 'bg-emerald-500 text-white border border-emerald-600')
            : 'bg-[#202124] uppercase text-white border border-gray-700 animate-[bounce_0.2s_ease-out]'
        } ${isParaSelection && !saveResult ? 'cursor-pointer hover:bg-[#FF5722]' : ''}`}
      >
        {saveResult ? (
          <span>{saveResult.message}</span>
        ) : isParaSelection ? (
          <>
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>快速段落制卡</span>
          </>
        ) : (
          <VocabZoneCollectButtons
            text={selectedText}
            storedCategory={getStoredCategory(selectedText)}
            matrixReady={!!getStoredCategory(selectedText)}
            collectingZone={getCollectingZone(selectedText)}
            queuedZone={getQueuedZone(selectedText)}
            onCollect={(zone, anchor) => {
              const fakeEvent = {
                preventDefault() {},
                stopPropagation() {},
                currentTarget: anchor,
                clientX: position?.x || 0,
                clientY: position?.y || 0,
              } as unknown as React.MouseEvent;
              void handleSave(fakeEvent, zone);
            }}
            onBlockedWhileCollecting={(activeZone) => {
              setSaveResult({ message: `正在收录至${VOCAB_ZONE_LABEL[activeZone]}，请稍候`, isError: false });
              setTimeout(() => setSaveResult(null), 2200);
            }}
          />
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
