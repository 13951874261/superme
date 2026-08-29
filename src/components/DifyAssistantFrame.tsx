import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  getDifyChatbotUserId,
  prepareDifyAssistantIframe,
} from '../utils/difyChatbot';

interface DifyAssistantFrameProps {
  /** 变化时重建 iframe（例如切换画像、重新打开面板） */
  refreshKey?: string;
}

/**
 * 右侧「全局 AI 助手」内嵌 Dify 对话。
 * 登录后即预热；呼出大屏不重建 iframe。记忆仍绑定 app_user_id（登录账号）。
 */
export default function DifyAssistantFrame({ refreshKey = '' }: DifyAssistantFrameProps) {
  const [iframeSrc, setIframeSrc] = useState('');
  const [error, setError] = useState('');
  const [sessionUserId, setSessionUserId] = useState('');
  const [openNonce, setOpenNonce] = useState(0);
  const forceNewRef = useRef(false);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const forceNew = Boolean((event as CustomEvent<{ forceNew?: boolean }>).detail?.forceNew);
      if (!forceNew) return;
      forceNewRef.current = true;
      setOpenNonce((prev) => prev + 1);
    };
    const onSettings = () => {
      forceNewRef.current = true;
      setOpenNonce((prev) => prev + 1);
    };
    window.addEventListener('dify-assistant-open', onOpen);
    window.addEventListener('dify-embed-settings-changed', onSettings);
    return () => {
      window.removeEventListener('dify-assistant-open', onOpen);
      window.removeEventListener('dify-embed-settings-changed', onSettings);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError('');

    const userId = getDifyChatbotUserId();
    setSessionUserId(userId);
    const forceNew = forceNewRef.current;
    forceNewRef.current = false;

    prepareDifyAssistantIframe(forceNew)
      .then((url) => {
        if (!cancelled && url) setIframeSrc(url);
      })
      .catch((e) => {
        console.error('[DifyAssistantFrame] failed to build iframe url', e);
        if (!cancelled) setError('答疑助手加载失败，请刷新页面重试');
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey, openNonce]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-xs text-red-500">
        {error}
      </div>
    );
  }

  if (!iframeSrc) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-xs font-bold uppercase tracking-wider">正在打开对话…</span>
      </div>
    );
  }

  return (
    <iframe
      key={`${sessionUserId}-${refreshKey}-${openNonce}`}
      src={iframeSrc}
      className="w-full h-full border-none"
      allow="microphone; fullscreen"
      title="全局 AI 助手"
    />
  );
}
