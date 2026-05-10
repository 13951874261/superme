import React, { useEffect, useState } from 'react';
import { BookmarkPlus } from 'lucide-react';
import { addWord, updateWordPayload } from '../services/vocabAPI';
import { runWordEnrichment, toVocabEnrichmentPayload } from '../services/difyAPI';

export default function TextHighlighter() {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleSelection = () => {
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

      const existedMessage = created?.success === false ? '（已存在，已自动更新释义）' : '';
      alert(`🎯 战术词汇「${targetWord}」已秘密存入政商库！${existedMessage}`);
      window.getSelection()?.removeAllRanges();
      setPosition(null);
    } catch (error) {
      console.error(error);
      alert('入库失败，请检查后端状态。');
    } finally {
      setIsSaving(false);
    }
  };

  if (!position) return null;

  return (
    <div
      onClick={handleSave}
      style={{ left: position.x, top: position.y, position: 'fixed' }}
      className="z-[9999] transform -translate-x-1/2 bg-[#202124] text-white px-3 py-2 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.3)] text-xs font-black tracking-widest uppercase flex items-center cursor-pointer hover:bg-[#FF5722] transition-colors border border-gray-700 animate-[bounce_0.2s_ease-out]"
    >
      <BookmarkPlus className="w-4 h-4 mr-2 text-[#FF5722]" />
      {isSaving ? '情报补全中...' : '截获至弹药库'}
    </div>
  );
}
