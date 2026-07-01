import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  buildDifyChatbotIframeUrl,
  getDifyChatbotUserId,
  resolveDifyEmbedSession,
} from '../utils/difyChatbot';

interface DifyAssistantFrameProps {
  /** 变化时重建 iframe（例如切换画像、重新打开面板） */
  refreshKey?: string;
}

/**
 * 右侧「全局 AI 助手」内嵌 Dify 对话。
 * 打开前经后端校验会话：有效历史继续加载；过期则自动切换 scope 并开新会话。
 */
export default function DifyAssistantFrame({ refreshKey = '' }: DifyAssistantFrameProps) {
  const [iframeSrc, setIframeSrc] = useState('');
  const [error, setError] = useState('');
  const [sessionUserId, setSessionUserId] = useState('');
  const baseUserId = getDifyChatbotUserId();

  useEffect(() => {
    let cancelled = false;
    setError('');
    setIframeSrc('');
    setSessionUserId('');

    resolveDifyEmbedSession()
      .then(({ userId, conversationId, forceNew }) => {
        if (cancelled) return;
        setSessionUserId(userId);
        return buildDifyChatbotIframeUrl({ userId, conversationId, forceNew });
      })
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
  }, [baseUserId, refreshKey]);

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
      key={`${sessionUserId || baseUserId}-${refreshKey}`}
      src={iframeSrc}
      className="w-full h-full border-none"
      allow="microphone; fullscreen"
      title="Dify 全局 AI 助手"
    />
  );
}
