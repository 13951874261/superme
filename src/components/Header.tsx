import React, { useState, useEffect, memo, useRef } from 'react';
import { Target, TrendingUp, Volume2, Globe, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { VOICE_OPTIONS } from '../config/voices';
import { speakEnglish } from './SpeakButton';
import { useTask } from './TaskContext';
import { TASK_CENTER_PULSE_EVENT } from '../utils/backgroundHandoff';
import {
  CAREER_CHANGED_EVENT,
  careerNodeLabel,
  readCareerPath,
} from '../utils/careerProgression';

gsap.registerPlugin(useGSAP);

const PREVIEW_TEXT_PREFIX = 'Hi! I am ';

function HeaderComponent() {

  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    return localStorage.getItem('super_agent_default_voice') || 'en-GB-LibbyNeural';
  });
  const [showVoiceDropdown, setShowVoiceDropdown] = useState(false);
  const [activeVoiceTab, setActiveVoiceTab] = useState<'all' | 'US' | 'UK' | 'other'>('all');
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [previewErrorVoiceId, setPreviewErrorVoiceId] = useState<string | null>(null);
  const { pendingCount, setIsOpen } = useTask();
  const taskCenterBtnRef = useRef<HTMLButtonElement>(null);
  const [careerPath, setCareerPath] = useState(readCareerPath);

  useGSAP(
    (_ctx, contextSafe) => {
      const btn = taskCenterBtnRef.current;
      if (!btn) return;

      const onPulse = contextSafe(() => {
        gsap.fromTo(
          btn,
          { scale: 1 },
          {
            scale: 1.08,
            duration: 0.12,
            yoyo: true,
            repeat: 3,
            ease: 'power1.inOut',
            clearProps: 'scale',
          }
        );
      });

      window.addEventListener(TASK_CENTER_PULSE_EVENT, onPulse);
      return () => window.removeEventListener(TASK_CENTER_PULSE_EVENT, onPulse);
    },
    { dependencies: [] }
  );

  useEffect(() => {
    const handleStorageChange = () => {
      setSelectedVoice(localStorage.getItem('super_agent_default_voice') || 'en-GB-LibbyNeural');
    };
    const syncCareer = () => setCareerPath(readCareerPath());
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('storage', syncCareer);
    window.addEventListener('global-voice-changed', handleStorageChange);
    window.addEventListener(CAREER_CHANGED_EVENT, syncCareer);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('storage', syncCareer);
      window.removeEventListener('global-voice-changed', handleStorageChange);
      window.removeEventListener(CAREER_CHANGED_EVENT, syncCareer);
    };
  }, []);

  useEffect(() => {
    let errorTimer: ReturnType<typeof setTimeout>;

    const handlePreviewTtsState = (e: Event) => {
      const { content, state } = (e as CustomEvent).detail;
      if (typeof content !== 'string' || !content.startsWith(PREVIEW_TEXT_PREFIX)) return;
      if (state === 'loading') {
        setPreviewErrorVoiceId(null);
      } else if (state === 'stopped') {
        setPreviewingVoiceId(null);
      }
    };

    const handlePreviewTtsError = (e: Event) => {
      const { content } = (e as CustomEvent).detail;
      if (typeof content !== 'string' || !content.startsWith(PREVIEW_TEXT_PREFIX)) return;
      setPreviewingVoiceId((current) => {
        if (current) setPreviewErrorVoiceId(current);
        return null;
      });
      errorTimer = setTimeout(() => setPreviewErrorVoiceId(null), 2000);
    };

    window.addEventListener('tts-state', handlePreviewTtsState);
    window.addEventListener('tts-error', handlePreviewTtsError);
    return () => {
      window.removeEventListener('tts-state', handlePreviewTtsState);
      window.removeEventListener('tts-error', handlePreviewTtsError);
      if (errorTimer) clearTimeout(errorTimer);
    };
  }, []);

  const handleSelectVoice = (voiceId: string) => {
    setSelectedVoice(voiceId);
    localStorage.setItem('super_agent_default_voice', voiceId);
    setShowVoiceDropdown(false);
    window.dispatchEvent(new Event('global-voice-changed'));
  };

  const handlePreviewVoice = async (e: React.MouseEvent, voiceId: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    const previewText = `${PREVIEW_TEXT_PREFIX}${name}, presenting my accent for your learning.`;
    const originalVoice = localStorage.getItem('super_agent_default_voice');
    setPreviewingVoiceId(voiceId);
    setPreviewErrorVoiceId(null);
    localStorage.setItem('super_agent_default_voice', voiceId);
    try {
      await speakEnglish(previewText, 0.95);
    } catch {
      setPreviewingVoiceId(null);
      setPreviewErrorVoiceId(voiceId);
      setTimeout(() => setPreviewErrorVoiceId(null), 2000);
    } finally {
      if (originalVoice) {
        localStorage.setItem('super_agent_default_voice', originalVoice);
      } else {
        localStorage.removeItem('super_agent_default_voice');
      }
    }
  };

  return (
    <header className="w-full max-w-[1400px] mx-auto px-4 md:px-6 py-2 relative z-50">
      <div className="grid grid-cols-12 items-center gap-3 md:gap-4 px-3 py-2.5 md:px-4 md:py-3 rounded-xl border border-slate-200/50 bg-white/85 backdrop-blur-xl shadow-[0_10px_24px_-12px_rgba(0,0,0,0.02)]">
        
        {/* 1. 左侧：品牌与叙事区 */}
        <div className="col-span-12 xl:col-span-3 flex flex-col justify-center min-w-0">
          <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-1.5 leading-tight">
            B·AI <span className="font-normal text-slate-700 text-lg md:text-xl">高管数字练习场</span>
          </h1>
          <p className="text-[10px] text-slate-400 leading-snug mt-0.5 max-w-[40ch] truncate xl:whitespace-normal">
            AI 做专业，你做领导；AI 做事务，你做人心；AI 做逻辑，你做格局。
          </p>
        </div>

        {/* 2. 中间：微操作台 */}
        <div className="col-span-12 xl:col-span-6 flex items-center justify-center gap-2 xl:gap-3 flex-wrap xl:flex-nowrap">
          {/* 专注模式 */}
          <button className="h-8 px-3 rounded-full border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all flex items-center gap-2 text-xs font-medium text-slate-600 whitespace-nowrap flex-shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            沉浸式专注模式
          </button>

          {/* 全局声线 (Voice Center) */}
          <div className="relative inline-block text-left flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowVoiceDropdown(!showVoiceDropdown)}
              className="h-8 px-3 rounded-full border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:border-blue-200 cursor-pointer whitespace-nowrap"
              title="设置全局发音人"
            >
              <Volume2 className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">声线:</span>
              <span className="font-black text-slate-800 ml-1">
                {(() => {
                  const matched = VOICE_OPTIONS.find(v => v.id === selectedVoice);
                  return matched ? `${matched.name} (${matched.country})` : 'Libby (英国 (UK))';
                })()}
              </span>
            </button>

            <AnimatePresence>
              {showVoiceDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  className="absolute left-1/2 -translate-x-1/2 xl:left-auto xl:translate-x-0 xl:right-0 top-full mt-2.5 z-50 w-96 bg-white/90 backdrop-blur-2xl border border-[var(--color-border)] rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.06)] overflow-hidden text-left"
                >
                  {/* Dropdown Header */}
                  <div className="p-4 bg-gray-50/40 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-[var(--color-brand)]" />
                      <span className="text-[11px] font-black text-[var(--color-ink-primary)] tracking-wide">声线控制中心</span>
                    </div>
                    <button
                      onClick={() => setShowVoiceDropdown(false)}
                      className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] cursor-pointer font-bold transition-colors"
                    >
                      关闭
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-gray-100 bg-gray-50/50 p-1 gap-1">
                    {(['all', 'US', 'UK', 'other'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveVoiceTab(tab)}
                        className={`flex-1 text-center py-1.5 text-[10px] font-bold rounded-lg cursor-pointer transition-all ${
                          activeVoiceTab === tab
                            ? 'bg-white text-[var(--color-brand)] shadow-sm'
                            : 'text-[var(--color-ink-muted)] hover:bg-white/50 hover:text-[var(--color-ink-secondary)]'
                        }`}
                      >
                        {tab === 'all' ? '全部' : tab === 'US' ? '美音' : tab === 'UK' ? '英音' : '其他'}
                      </button>
                    ))}
                  </div>

                  {/* Voice List */}
                  <div className="max-h-72 overflow-y-auto p-2.5 space-y-1">
                    {VOICE_OPTIONS.filter((voice) => {
                      if (activeVoiceTab === 'US') return voice.id.includes('en-US');
                      if (activeVoiceTab === 'UK') return voice.id.includes('en-GB');
                      if (activeVoiceTab === 'other') return !voice.id.includes('en-US') && !voice.id.includes('en-GB');
                      return true;
                    }).map((voice) => {
                      const isSelected = voice.id === selectedVoice;
                      return (
                        <div
                          key={voice.id}
                          onClick={() => handleSelectVoice(voice.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors border ${
                            isSelected
                              ? 'bg-[var(--color-brand-subtle)] border-transparent text-[var(--color-brand)]'
                              : voice.highlight
                                ? 'bg-red-50/30 border-red-100/50 text-red-500 hover:bg-red-50/50 hover:border-red-100'
                                : 'bg-transparent border-transparent hover:bg-gray-50/80 text-[var(--color-ink-secondary)]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                              <span className={`text-xs ${isSelected ? 'font-black' : 'font-semibold'} ${voice.highlight ? 'text-red-500 font-bold' : ''}`}>
                                {voice.name}
                                {voice.highlight && <span className="ml-1 text-[8px] bg-red-100 text-red-600 px-1 py-0.5 rounded uppercase font-black">Ana</span>}
                              </span>
                              <span className="text-[9px] opacity-70 font-medium">
                                {voice.country} · {voice.gender === 'F' ? '女' : '男'}
                              </span>
                            </div>
                          </div>
                          
                          <button
                            onClick={(e) => handlePreviewVoice(e, voice.id, voice.name)}
                            disabled={previewingVoiceId === voice.id}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              previewErrorVoiceId === voice.id
                                ? 'bg-red-50 border-red-300 text-red-500'
                                : isSelected
                                ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)]'
                                : 'bg-white border-gray-200 text-gray-400 hover:text-[var(--color-brand)] hover:border-[var(--color-brand-light)]'
                            } ${previewingVoiceId === voice.id ? 'opacity-80 cursor-wait' : ''}`}
                            title={previewErrorVoiceId === voice.id ? '试听失败' : '试听发音'}
                          >
                            {previewingVoiceId === voice.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : previewErrorVoiceId === voice.id ? (
                              <span className="text-[9px] font-bold block leading-none px-1">失败</span>
                            ) : (
                              <span className="text-[9px] font-bold block leading-none px-1">试听</span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 后台任务中心 */}
          <div className="relative inline-block text-left flex-shrink-0">
            <button
              ref={taskCenterBtnRef}
              type="button"
              onClick={() => setIsOpen(true)}
              className="h-8 px-3 rounded-full border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:border-amber-200 cursor-pointer relative whitespace-nowrap"
              title="查看后台任务中心"
              data-task-center-trigger
            >
              <Loader2 className={`w-3.5 h-3.5 text-amber-500 ${pendingCount > 0 ? 'animate-spin' : ''}`} />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">后台任务:</span>
              <span className="font-black text-slate-800 ml-1">
                {pendingCount > 0 ? `${pendingCount} 个进行中` : '查看队列'}
              </span>
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#FF5722] text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-white animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 3. 右侧：步进器演变轴 */}
        <div className="col-span-12 xl:col-span-3 flex flex-col gap-1 xl:pl-4 xl:border-l xl:border-slate-100">
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono tracking-wider">
            <span>EVOLUTION</span>
            <span className="text-[10px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded-md">{careerPath.progress}%</span>
          </div>
          
          {/* 进度条轨道容器：固定高度，确保圆点垂直居中 */}
          <div className="relative h-7">
            {/* 进度背景条：跨越三个节点 */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-slate-100 rounded-full z-0">
              <div className="h-full bg-gradient-to-r from-[var(--color-brand-light)] to-[var(--color-accent)] rounded-full transition-all duration-1000 ease-out" style={{ width: `${careerPath.progress}%` }}></div>
            </div>

            {/* 节点轨道：均匀分布 */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex justify-between items-start z-10 px-1">
              <div className="flex flex-col items-center max-w-[32%] min-w-0 -mt-1">
                <div className="w-3 h-3 rounded-full bg-slate-500 border-2 border-white shadow-sm"></div>
                <span className="text-[9px] text-slate-400 font-mono leading-none mt-1">既往</span>
                <span className="text-[10px] font-semibold text-slate-600 mt-0.5 truncate max-w-full" title={careerPath.history}>{careerNodeLabel(careerPath.history)}</span>
              </div>

              <div className="flex flex-col items-center max-w-[32%] min-w-0 -mt-1">
                <div className="w-4 h-4 rounded-full bg-[var(--color-accent)] border-2 border-white shadow-md flex items-center justify-center relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75"></span>
                  <div className="w-1.5 h-1.5 rounded-full bg-white relative z-20"></div>
                </div>
                <span className="text-[9px] text-[var(--color-accent)] font-bold font-mono leading-none mt-1">现职</span>
                <span className="text-[10px] font-bold text-slate-800 mt-0.5 truncate max-w-full" title={careerPath.current}>{careerNodeLabel(careerPath.current)}</span>
              </div>

              <div className="flex flex-col items-center max-w-[32%] min-w-0 -mt-1 opacity-55">
                <div className="w-3 h-3 rounded-full bg-slate-200 border-2 border-white shadow-sm"></div>
                <span className="text-[9px] text-slate-400 font-mono leading-none mt-1">目标</span>
                <span className="text-[10px] font-semibold text-slate-500 mt-0.5 truncate max-w-full" title={careerPath.target}>{careerNodeLabel(careerPath.target)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </header>
  );
}

const Header = memo(HeaderComponent);
export default Header;
