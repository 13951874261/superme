import { useEffect, useRef } from 'react';
import { buildMinimalIframeUrl, getDifyChatbotUserId } from '../utils/difyChatbot';

/**
 * 隐藏预加载 iframe — 在后台加载 Dify 大屏页面，利用浏览器缓存
 * 用户点击"呼出独立对话大屏"时，页面已在缓存中，加载速度提升显著。
 */
export default function DifyPreloadIframe() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // ponytail: 页面加载后立即预热 Dify 大屏到浏览器缓存
    // 升级路径：若需按用户定制内容，可改为按需加载
    const url = buildMinimalIframeUrl(getDifyChatbotUserId());
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.src = url;
    }
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
