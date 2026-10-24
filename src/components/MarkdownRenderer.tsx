import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function MarkdownRendererComponent({ content, className = '' }: MarkdownRendererProps) {
  if (!content) return null;

  return (
    <div className={`prose prose-sm max-w-none leading-relaxed transition-all transform-gpu will-change-transform ${className}`}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

// 通过 React.memo 阻断外层高频 state (如计时器、打字、鼠标滑动) 对 Markdown AST 重新解析
const MarkdownRenderer = memo(MarkdownRendererComponent, (prevProps, nextProps) => {
  return prevProps.content === nextProps.content && prevProps.className === nextProps.className;
});

export default MarkdownRenderer;
