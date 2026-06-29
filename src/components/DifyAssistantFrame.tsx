import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  buildDifyChatbotIframeUrl,
  getDifyChatbotUserId,
} from '../utils/difyChatbot';

interface DifyAssistantFrameProps {
  /** 变化时重建 iframe（例如切换画像、重新打开面板） */
  refreshKey?: string;
}

/**
 * 右侧「全局 AI 助手」内嵌 Dify 对话。
 * 必须使用带 sys.user_id + inputs 的 URL，避免裸 /chatbot/{token} 触发过期 conversation 404。
 */
export default function DifyAssistantFrame({ refreshKey = '' }: DifyAssistantFrameProps) {
  const [iframeSrc, setIframeSrc] = useState('');
  const [error, setError] = useState('');
  const userId = getDifyChatbotUserId();

  useEffect(() => {
    let cancelled = false;
    setError('');
    setIframeSrc('');

    buildDifyChatbotIframeUrl()
      .then((url) => {
        if (!cancelled) setIframeSrc(url);
      })
      .catch((e) => {
        console.error('[DifyAssistantFrame] failed to build iframe url', e);
        if (!cancelled) setError('答疑助手加载失败，请刷新页面重试');
      });

    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

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
        <span className="text-xs font-bold uppercase tracking-wider">正在连接答疑助手…</span>
      </div>
    );
  }

  return (
    <iframe
      key={`${userId}-${refreshKey}`}
      src={iframeSrc}
      className="w-full h-full border-none"
      allow="microphone; fullscreen"
      title="Dify 全局 AI 助手"
    />
  );
}
