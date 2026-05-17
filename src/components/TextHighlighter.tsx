import React, { useEffect, useState } from 'react';
import { BookmarkPlus } from 'lucide-react';
import confetti from 'canvas-confetti';
import { addWord, updateWordPayload } from '../services/vocabAPI';
import { runWordEnrichment, toVocabEnrichmentPayload } from '../services/difyAPI';

export default function TextHighlighter() {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ message: string; isError: boolean } | null>(null);

  useEffect(() => {
    const handleSelection = () => {
      // 避免在保存过程中或展示结果时重置位置
      const isCurrentlySaving = document.getElementById('text-highlighter-saving')?.dataset.saving === 'true';
      if (isCurrentlySaving) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setTimeout(() => setPosition(null), 150);
        return;
      }

      const text = selection.toString().trim();
      if (text.length >= 2 && text.length <= 40 && /^[a-zA-Z\s\-']+$/.test(text)) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 45,
        });
        setSelectedText(text);
      }
    };

    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, []);

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault(); // 阻止默认行为以防止选区立即丢失
    e.stopPropagation();
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
      source: '全局划线截获',
    };

    try {
      try {
        const enriched = await runWordEnrichment(targetWord);
        payload = toVocabEnrichmentPayload(enriched);
      } catch (enrichError) {
        console.error('词汇补全失败，使用占位 payload 继续入库:', enrichError);
      }

      const created = await addWord({
        word: targetWord,
        dictType: 'manual_capture',
        category: 'business',
        payload,
      });

      const wordId = created?.id;
      if (wordId) {
        await updateWordPayload(wordId, payload);
      }

      const existedMessage = created?.success === false ? '（已自动更新释义）' : '';
      setSaveResult({ message: `🎯 战术词汇「${targetWord}」已秘密存入政商库！${existedMessage}`, isError: false });
      
      // 触发高端烟花效果
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight },
        colors: ['#10B981', '#047857', '#FF5722', '#F97316'],
        zIndex: 10000,
      });

      window.getSelection()?.removeAllRanges();
      setTimeout(() => {
        setSaveResult(null);
        setPosition(null);
      }, 3000);
    } catch (error) {
      console.error(error);
      setSaveResult({ message: '🚫 截获失败，请检查指挥中心网络。', isError: true });
      setTimeout(() => {
        setSaveResult(null);
        setPosition(null);
      }, 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (!position) return null;

  return (
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
          <BookmarkPlus className={`w-4 h-4 mr-2 ${isSaving ? 'text-gray-400 animate-spin' : 'text-[#FF5722]'}`} />
          {isSaving ? '情报补全中...' : '截获至弹药库'}
        </>
      )}
    </div>
  );
}
