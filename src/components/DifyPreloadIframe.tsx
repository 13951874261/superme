import { useEffect, useRef } from 'react';
import { buildMinimalIframeUrl, getDifyChatbotUserId } from '../utils/difyChatbot';

/**
 * 隐藏预加载 iframe — 在后台加载 Dify 大屏页面，利用浏览器缓存
 * 用户点击"呼出独立对话大屏"时，页面已在缓存中，加载速度提升显著。
 */
export default function DifyPreloadIframe() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;
    void buildMinimalIframeUrl(getDifyChatbotUserId()).then((url) => {
      if (!cancelled && iframeRef.current) iframeRef.current.src = url;
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      aria-hidden="true"
      style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1px', height: '1px', border: 'none' }}
      title="dify-preload"
    />
  );
}
