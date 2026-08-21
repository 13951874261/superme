import { useCallback, useEffect, useRef, useState } from 'react';
import { addWord } from '../../../services/vocabAPI';
import type { SceneEntry } from './types';
import { getVocabZoneFromScene } from './utils';

export function useOralTextSelection(
  activeScene: SceneEntry,
  activeSceneId: string,
  sceneTheme: string,
) {
  const [breakthroughMenu, setBreakthroughMenu] = useState<{
    position: { x: number; y: number };
    selectedText: string;
    messageId: string;
  } | null>(null);
  const [highlightedWord, setHighlightedWord] = useState('');
  const [highlightPos, setHighlightPos] = useState<{ x: number; y: number } | null>(null);
  const [isAddingWord, setIsAddingWord] = useState(false);
  const [addWordResult, setAddWordResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const sceneThemeRef = useRef(sceneTheme);
  useEffect(() => { sceneThemeRef.current = sceneTheme; }, [sceneTheme]);

  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processTextSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setBreakthroughMenu(null);
      return;
    }
    const text = sel.toString().trim();
    if (text.length < 2) return;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const messageEl = (range.commonAncestorContainer as HTMLElement)?.parentElement?.closest?.('[data-message-id]')
      || (range.commonAncestorContainer as HTMLElement)?.closest?.('[data-message-id]');
    const messageId = messageEl?.getAttribute('data-message-id') || '';
    const inAiBubble = Boolean(messageEl?.getAttribute('data-ai-message'));

    if (inAiBubble && text.length >= 3) {
      setHighlightedWord('');
      setHighlightPos(null);
      setBreakthroughMenu({
        position: { x: rect.left + rect.width / 2, y: rect.top - 8 },
        selectedText: text,
        messageId,
      });
      return;
    }

    setBreakthroughMenu(null);
    if (text.length <= 60 && /^[a-zA-Z\s\-',.]+$/.test(text) && text.split(/\s+/).length <= 5) {
      setHighlightedWord(text);
      setHighlightPos({ x: rect.left + rect.width / 2, y: rect.top - 52 });
      setAddWordResult(null);
    }
  }, []);

  const handleDialogueMouseUp = () => {
    if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    selectionTimerRef.current = setTimeout(processTextSelection, 120);
  };

  useEffect(() => {
    const onSelectionChange = () => {
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
      selectionTimerRef.current = setTimeout(processTextSelection, 150);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    };
  }, [processTextSelection]);

  useEffect(() => {
    if (!highlightedWord && !breakthroughMenu) return;
    const dismiss = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-vocab-popup]') || target.closest('[data-dialogue-select]') || target.closest('[data-breakthrough-menu]')) return;
      setHighlightedWord('');
      setHighlightPos(null);
      setBreakthroughMenu(null);
    };
    document.addEventListener('mousedown', dismiss);
    return () => document.removeEventListener('mousedown', dismiss);
  }, [highlightedWord, breakthroughMenu]);

  const handleAddHighlightedWord = async () => {
    if (!highlightedWord || isAddingWord) return;
    setIsAddingWord(true);
    try {
      const zone = getVocabZoneFromScene(activeScene.title);
      await addWord({
        word: highlightedWord,
        dictType: 'oral-highlight',
        category: zone,
        payload: {
          source: 'oral_warroom',
          theme: sceneThemeRef.current,
          scene_id: activeSceneId,
          scene_title: activeScene.title,
          auto_zone: zone,
        },
      });
      window.dispatchEvent(new Event('vocab-updated'));
      setAddWordResult({ ok: true, msg: `"${highlightedWord}" 已加入生词本[${zone === 'business' ? '政商务区' : '全场景区'}]` });
      setTimeout(() => { setHighlightedWord(''); setHighlightPos(null); setAddWordResult(null); }, 2500);
    } catch {
      setAddWordResult({ ok: false, msg: '加入失败，请重试' });
      setTimeout(() => { setAddWordResult(null); }, 2000);
    } finally {
      setIsAddingWord(false);
    }
  };

  const dismissVocabPopup = useCallback(() => {
    setHighlightedWord('');
    setHighlightPos(null);
  }, []);

  return {
    breakthroughMenu,
    setBreakthroughMenu,
    highlightedWord,
    highlightPos,
    isAddingWord,
    addWordResult,
    handleDialogueMouseUp,
    handleAddHighlightedWord,
    dismissVocabPopup,
  };
}
