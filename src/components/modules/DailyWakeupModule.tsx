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
      title="英语战略 ｜ 每日唤醒"
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
            <div className="flex items-center gap-3 rounded-2xl bg-[#f8f9fa] border border-gray-100 px-4 py-3">
              <Clock3 className="w-5 h-5 text-[#FF5722]" />
              <div>
                <div className="text-[10px] uppercase tracking-widest text-gray-400 font-black">专注时长</div>
                <div className="text-lg font-black text-[#202124]">{formatSeconds(seconds)}</div>
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

            <div className="bg-[#202124] rounded-[2rem] border border-gray-900 p-6 text-white shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <TimerReset className="w-5 h-5 text-[#FF5722]" />
                <h4 className="text-sm font-black uppercase tracking-widest">关联语法点</h4>
              </div>
              <h5 className="text-2xl font-black mb-3">{result.grammar.point}</h5>
              <p className="text-gray-300 text-sm leading-relaxed mb-4">{result.grammar.explanation}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.grammar.examples.map((ex, idx) => (
                  <div key={idx} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300 mb-2">Correct</div>
                    <div className="text-sm text-white mb-3">{ex.correct}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-red-300 mb-2">Incorrect</div>
                    <div className="text-sm text-gray-300">{ex.incorrect}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </ModuleWrapper>
  );
}
