import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Mic, Send, ShieldAlert, Sparkles, Target, Users } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import SpeakButton from '../SpeakButton';
import { sendOralChatMessage } from '../../services/difyAPI';

interface ParsedAiResponse {
  current_speaker: unknown;
  dialogue: unknown;
  hidden_intent: unknown;
  flaw_point: unknown;
  evaluation: unknown;
}

interface MessageItem {
  id: string;
  role: 'user' | 'ai';
  content: string;
  parsed?: ParsedAiResponse | null;
}

function stripMarkdownJson(text: string) {
  return String(text || '').replace(/```json/g, '').replace(/```/g, '').trim();
}

function parseAiPayload(raw: string): ParsedAiResponse | null {
  try {
    return JSON.parse(stripMarkdownJson(raw));
  } catch {
    return null;
  }
}

function safeText(value: unknown) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

interface OralWarRoomProps {
  embedded?: boolean;
}

export default function OralWarRoom({ embedded = false }: OralWarRoomProps) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [lastNotice, setLastNotice] = useState('沙盘已就绪，输入你的开场白。');
  const bottomRef = useRef<HTMLDivElement>(null);

  const situation = useMemo(() => ({
    topic: '利率上浮 0.5% / 抵押物权属争议',
    allies: ['CEO（盟友）'],
    blockers: ['CFO（阻力）'],
    neutrals: ['监管方（中立）'],
  }), []);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  const handleSend = async () => {
    const content = inputText.trim();
    if (!content || isSending) return;

    const userMsg: MessageItem = { id: `${Date.now()}-u`, role: 'user', content };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);
    setLastNotice('对手正在推演回应...');

    try {
      const res = await sendOralChatMessage(content, conversationId);
      if (res.conversation_id) setConversationId(res.conversation_id);

      const rawText = String(res.answer || res.message || '');
      const parsed = parseAiPayload(rawText);
      const aiMsg: MessageItem = {
        id: `${Date.now()}-a`,
        role: 'ai',
        content: rawText,
        parsed,
      };
      setMessages(prev => [...prev, aiMsg]);

      if (parsed?.flaw_point) {
        setLastNotice(`🎯 发现破绽：${safeText(parsed.flaw_point)}`);
      } else {
        setLastNotice('已收到回应，继续追问。');
      }
      scrollToBottom();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '对话失败';
      setLastNotice(msg);
    } finally {
      setIsSending(false);
    }
  };

  const content = (
    <div className="bg-[#f8f9fa] rounded-[2rem] xl:rounded-[2.5rem] p-3 sm:p-4 md:p-6 border border-gray-100 shadow-sm">
      <div className="grid grid-cols-1 2xl:grid-cols-12 gap-4 xl:gap-6 h-auto 2xl:h-[760px]">
        <aside className="2xl:col-span-4 grid grid-cols-1 md:grid-cols-3 2xl:flex 2xl:flex-col gap-4 xl:gap-5 h-full">
          <div className="bg-[#202124] text-white rounded-[1.5rem] xl:rounded-[2rem] p-5 xl:p-6 shadow-lg relative overflow-hidden md:min-h-[210px] 2xl:min-h-0">
            <div className="absolute -right-10 -top-10 w-36 h-36 bg-[#FF5722]/15 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-[#FF5722]" /> 当前局势
              </div>
              <h3 className="text-xl xl:text-2xl font-black leading-tight mb-3">{situation.topic}</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                争议重点集中在利率上浮 0.5% 的成本分摊，以及抵押物权属争议引发的合规风险。
              </p>
            </div>
          </div>

          <div className="bg-white rounded-[1.5rem] xl:rounded-[2rem] p-5 xl:p-6 border border-gray-100 shadow-sm md:col-span-2 2xl:col-span-1 flex-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#202124] flex items-center gap-2 mb-5">
              <Users className="w-4 h-4 text-[#FF5722]" /> 角色列表
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 2xl:grid-cols-1 gap-3 xl:gap-4">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="font-black text-emerald-900">CEO（盟友）</span>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">盟友</span>
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed">支持推进交易，但需要你拿出更强的收益与落地方案。</p>
              </div>

              <div className="rounded-2xl border border-red-100 bg-red-50 p-4 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF5722]" />
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="font-black text-red-900">CFO（阻力）</span>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-red-100 text-[#FF5722]">阻力</span>
                </div>
                <p className="text-xs text-red-700 leading-relaxed">擅长用预算、资本回报和风险条款压缩你的谈判空间。</p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-400" />
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="font-black text-gray-700">监管方（中立）</span>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-gray-200 text-gray-600">中立</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">关注抵押物权属、合规文本和程序正义，不参与商业偏好站队。</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[1.5rem] xl:rounded-[2rem] p-5 border border-gray-100 shadow-sm md:col-span-3 2xl:col-span-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">冲突点</div>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full bg-[#FF5722]/10 text-[#FF5722] text-[11px] font-black uppercase tracking-widest">利率上浮 0.5%</span>
              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-[11px] font-black uppercase tracking-widest">抵押物权属争议</span>
            </div>
          </div>
        </aside>

        <section className="2xl:col-span-8 flex flex-col bg-white rounded-[1.5rem] xl:rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden h-[680px] sm:h-[720px] 2xl:h-full">
          <div className="p-5 border-b border-gray-100 bg-[#f8f9fa] flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[#FF5722] mb-1">对抗通信通道</div>
              <h4 className="text-lg font-black text-[#202124]">实时解析 AI 破绽并引导反击</h4>
            </div>
            <div className="text-[11px] font-black uppercase tracking-widest text-gray-500 bg-white rounded-full px-3 py-2 border border-gray-200">
              {isSending ? '对手推演中' : '待命'}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gradient-to-b from-white to-[#f8f9fa]">
            {messages.length === 0 ? (
              <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-gray-400 text-center px-6">
                <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">输入你的开场白，激活对手角色并捕捉逻辑破绽。</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'user' ? (
                    <div className="max-w-[82%] rounded-3xl rounded-tr-md bg-[#202124] text-white px-5 py-4 shadow-md">
                      <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">你</div>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="w-full max-w-[92%] rounded-3xl rounded-tl-md bg-white border border-gray-100 px-5 py-4 shadow-sm">
                      {msg.parsed ? (
                        <>
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#202124] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1">
                              {safeText(msg.parsed.current_speaker)}
                            </span>
                            {msg.parsed.flaw_point ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase tracking-widest px-3 py-1">
                                <Sparkles className="w-3 h-3" /> 🎯 发现破绽
                              </span>
                            ) : null}
                          </div>

                          <div className="rounded-2xl bg-[#f8f9fa] border border-gray-100 p-4 mb-3">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Dialogue</p>
                              <SpeakButton text={safeText(msg.parsed.dialogue)} title="播放 AI 英文发言" />
                            </div>
                            <p className="text-sm leading-relaxed text-[#202124] italic">“{safeText(msg.parsed.dialogue)}”</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                              <div className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">Hidden Intent</div>
                              <p className="text-sm text-blue-900 leading-relaxed">{safeText(msg.parsed.hidden_intent)}</p>
                            </div>
                            <div className="rounded-2xl bg-red-50 border border-red-100 p-4">
                              <div className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-2">🎯 发现破绽</div>
                              <p className="text-sm text-red-900 leading-relaxed">{safeText(msg.parsed.flaw_point || '未识别到破绽')}</p>
                            </div>
                          </div>

                          <div className="mt-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2">Evaluation</div>
                            <p className="text-sm text-emerald-900 leading-relaxed">{safeText(msg.parsed.evaluation)}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#202124] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1">
                              AI
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-black uppercase tracking-widest px-3 py-1">
                              <AlertTriangle className="w-3 h-3" /> 解析失败
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-gray-100 p-5 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="text-sm font-bold text-[#202124]">{lastNotice}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">当前局势：利率上浮 0.5% / 抵押权争议</div>
            </div>
            <div className="relative">
              <textarea
                rows={3}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="w-full rounded-3xl border-2 border-gray-200 bg-[#f8f9fa] px-5 py-4 pr-24 text-sm text-[#202124] outline-none resize-none focus:border-[#FF5722] transition-colors"
                placeholder="输入你的破局发言，按 Enter 发送，Shift+Enter 换行..."
              />
              <button
                onClick={handleSend}
                disabled={isSending || !inputText.trim()}
                className="absolute right-3 bottom-3 rounded-2xl bg-[#202124] text-white px-4 py-3 text-xs font-black uppercase tracking-widest hover:bg-[#FF5722] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-4 h-4" /> 发送
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <ModuleWrapper
      title="破局 ｜ 多角色口语战争室"
      icon={<Mic className="w-8 h-8" strokeWidth={2.5} />}
      description="左侧常驻显示局势、角色与冲突点；右侧进行多角色对抗对话，并自动标记 AI 返还的逻辑破绽。"
    >
      {content}
    </ModuleWrapper>
  );
}
