import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock3, Loader2, Target, TimerReset, Volume2, Zap } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import SpeakButton from '../SpeakButton';
import { runEnglishWakeupRoutine } from '../../services/difyAPI';
import { upsertTrainingSession } from '../../services/trainingAPI';

interface WakeupWord {
  word: string;
  ipa: string;
  pronunciation_note: string;
  meaning_zh: string;
  example: string;
}

interface WakeupResult {
  theme: string;
  vocab: WakeupWord[];
  grammar: {
    point: string;
    explanation: string;
    examples: Array<{ correct: string; incorrect: string }>;
  };
}

function formatSeconds(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function DailyWakeupModule() {
  const [theme, setTheme] = useState('银团贷款');
  const [result, setResult] = useState<WakeupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string>('等待开始今日唤醒');
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const stopTimer = () => {
    setRunning(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    startRef.current = Date.now();
    setSeconds(0);
    setRunning(true);
    timerRef.current = window.setInterval(() => {
      if (!startRef.current) return;
      setSeconds(Math.max(0, Math.floor((Date.now() - startRef.current) / 1000)));
    }, 1000);
  };

  useEffect(() => () => stopTimer(), []);

  const handleStart = async () => {
    setLoading(true);
    setNotice('正在生成今日唤醒内容...');
    try {
      const data = await runEnglishWakeupRoutine(theme);
      setResult(data);
      setNotice(`已生成主题：${data.theme || theme}`);
      startTimer();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!result) {
      setNotice('请先开始今日唤醒');
      return;
    }
    setCheckInLoading(true);
    try {
      const today = new Date();
      const trainingDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      await upsertTrainingSession({
        trainingDate,
        totalMinutes: Math.max(1, Math.ceil(seconds / 60)),
        listenMinutes: 0,
        logicMinutes: 0,
      });
      setNotice(`打卡成功，今日练习时长 ${formatSeconds(seconds)}`);
      stopTimer();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '打卡失败');
    } finally {
      setCheckInLoading(false);
    }
  };

  const completedCount = useMemo(() => result?.vocab?.length || 0, [result]);

  return (
    <ModuleWrapper
      title="每日唤醒 ｜ 发音与语法闭环"
      icon={<Target className="w-8 h-8" strokeWidth={2.5} />}
      description="根据主题生成发音注意点与关联语法点，配合 TTS 朗读和训练时长打卡，形成每日唤醒闭环。"
    >
      <div className="space-y-6">
        <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[#FF5722] mb-2">Daily Wakeup // 基础唤醒</div>
              <h3 className="text-2xl font-black text-[#202124]">发音与语法唤醒机制</h3>
              <p className="text-sm text-gray-500 mt-2">主题驱动生成 10 个高频词 + 1 个关联语法点，并记录练习时长。</p>
            </div>
            <div className="flex items-center gap-4">
              {/* 右上角：简短功能说明区 */}
              <div className="hidden md:flex flex-col items-start justify-center gap-1.5 text-xs text-gray-500 font-medium mr-4 border-l-2 border-gray-100 pl-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF5722]"></div>
                  <span>场景高频词汇实时生成</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF5722]"></div>
                  <span>标准发音示范与影子跟读</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF5722]"></div>
                  <span>商业语法提取与正误对比</span>
                </div>
              </div>

              {/* 计时器组件 */}
              <div className="flex items-center gap-3 rounded-2xl bg-[#f8f9fa] border border-gray-100 px-4 py-3">
                <Clock3 className="w-5 h-5 text-[#FF5722]" />
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-gray-400 font-black">专注时长</div>
                  <div className="text-lg font-black text-[#202124]">{formatSeconds(seconds)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-3">
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5722]"
              placeholder="输入主题，例如：银团贷款"
            />
            <button
              onClick={handleStart}
              disabled={loading}
              className="px-6 py-3 rounded-2xl bg-[#202124] text-white font-black text-xs tracking-widest uppercase hover:bg-[#FF5722] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {loading ? '唤醒生成中' : '开始今日唤醒'}
            </button>
            <button
              onClick={handleCheckIn}
              disabled={checkInLoading || !result}
              className="px-6 py-3 rounded-2xl bg-emerald-500 text-white font-black text-xs tracking-widest uppercase hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {checkInLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              完成打卡
            </button>
          </div>

          <div className="rounded-2xl bg-[#f8f9fa] border border-gray-100 p-4 text-sm text-gray-600 flex items-center justify-between gap-4">
            <span>{notice}</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">已生成 {completedCount} 个词</span>
          </div>
        </div>

        {result && (
          <>
            <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <Volume2 className="w-5 h-5 text-[#FF5722]" />
                <h4 className="text-sm font-black uppercase tracking-widest text-[#202124]">10 个高频词发音注意点</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.vocab.map((item) => (
                  <div
                    key={item.word}
                    className="text-left rounded-2xl border border-gray-100 p-4 bg-[#f8f9fa] hover:border-[#FF5722] hover:bg-white transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-lg font-black text-[#202124]">{item.word}</div>
                          <SpeakButton text={item.word} title={`播放 ${item.word}`} />
                        </div>
                        <div className="text-sm text-blue-600 font-mono mt-1">{item.ipa}</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mt-2">{item.meaning_zh}</div>
                    <div className="mt-3 rounded-xl bg-orange-50 text-orange-700 text-xs font-medium p-3 leading-relaxed">
                      {item.pronunciation_note}
                    </div>
                    <div className="mt-3 text-xs text-gray-500 italic leading-relaxed flex items-start justify-between gap-3">
                      <span>{item.example}</span>
                      <SpeakButton text={item.example} title="播放例句" className="flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#202124] rounded-[2rem] border border-gray-900 p-6 lg:p-8 text-white shadow-sm flex flex-col gap-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <TimerReset className="w-5 h-5 text-[#FF5722]" />
                  <h4 className="text-sm font-black uppercase tracking-widest">关联语法点</h4>
                </div>
                <div className="text-[11px] text-gray-400 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 flex flex-col gap-1.5 leading-relaxed">
                  <div className="flex items-start gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-[#FF5722] mt-1.5 shrink-0"></div>
                    <div><span className="text-gray-300 font-bold">作用：</span>提供造句底层骨架，完成从单词发音到严谨商务长句的升维闭环。</div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-[#FF5722] mt-1.5 shrink-0"></div>
                    <div><span className="text-gray-300 font-bold">用法：</span>结合上方高频词，对照正误示例进行场景化跟读与造句训练。</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mt-2">
                {/* 左侧：语法核心与释义 */}
                <div className="lg:col-span-5 flex flex-col">
                  <h5 className="text-2xl lg:text-3xl font-black mb-4">{result.grammar.point}</h5>
                  <p className="text-gray-300 text-sm lg:text-base leading-relaxed">{result.grammar.explanation}</p>
                </div>
                
                {/* 右侧：实战例句对错阵列 */}
                <div className="lg:col-span-7 flex flex-col gap-4">
                  {result.grammar.examples.map((ex, idx) => (
                    <div key={idx} className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col md:flex-row gap-6">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> Correct
                          </div>
                          <SpeakButton text={ex.correct} title="播放正确商务例句" />
                        </div>
                        <div className="text-sm text-white font-medium leading-relaxed">{ex.correct}</div>
                      </div>
                      
                      <div className="hidden md:block w-px bg-white/10"></div>
                      
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-[10px] font-black uppercase tracking-widest text-red-400 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div> Incorrect
                          </div>
                          <SpeakButton text={ex.incorrect} title="播放常见错误发音以作比对" />
                        </div>
                        <div className="text-sm text-gray-400 leading-relaxed">{ex.incorrect}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ModuleWrapper>
  );
}
