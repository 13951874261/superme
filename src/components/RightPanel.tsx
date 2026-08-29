import React, { useState, useEffect, memo } from 'react';
import { X, BrainCircuit, Globe, BookOpen, Volume2, ShieldCheck, HelpCircle, Check, Loader2, Clock, SlidersHorizontal } from 'lucide-react';
import { getVocabByWord, getVocabItem, queryDictionaryWithCache, type VocabEntry } from '../services/vocabAPI';
import { EnEnBusinessView, EnZhBidirectionalView, ZhModernView } from './DictionaryPanel';
import MemoryAidPanel from './MemoryAidPanel';
import DifyAssistantFrame from './DifyAssistantFrame';
import { motion } from 'motion/react';
import SpeakButton from './SpeakButton';
import { getAccentPref, saveAccentPref, ACCENT_CHANGED_EVENT, sanitizeProfileContent, getAppUserId } from '../utils/profileHelper';
import {
  resetDifyChatbotSession,
  invalidateMemoryPackCache,
  getDifyEmbedInputOverrides,
  setDifyEmbedInputOverrides,
} from '../utils/difyChatbot';
import { playClick, playReveal, playSwitch } from '../utils/soundEffects';
import { GLOBAL_SPRING } from '../utils/motion';

interface RightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'assistant' | 'context';
  setActiveTab: (tab: 'assistant' | 'context') => void;
  wordData: any;
}

function RightPanelComponent({ isOpen, onClose, activeTab, setActiveTab, wordData }: RightPanelProps) {

  const [profile, setProfile] = useState(() => getAccentPref());
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showEmbedSettings, setShowEmbedSettings] = useState(false);
  const [embedAccount, setEmbedAccount] = useState('');
  const [embedMemoryPack, setEmbedMemoryPack] = useState('');

  const [localWordEntry, setLocalWordEntry] = useState<VocabEntry | null>(null);
  const [dictResult, setDictResult] = useState<any>(null);
  const [dictLoading, setDictLoading] = useState(false);

  useEffect(() => {
    const handleVocabUpdate = async () => {
      if (!wordData?.word) return;
      try {
        const found = await getVocabByWord(wordData.word);
        if (found?.id) {
          const item = await getVocabItem(found.id).catch(() => found);
          setLocalWordEntry(item || found);
        } else {
          setLocalWordEntry(null);
        }
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener('vocab-updated', handleVocabUpdate);
    return () => window.removeEventListener('vocab-updated', handleVocabUpdate);
  }, [wordData]);

  useEffect(() => {
    const word = typeof wordData?.word === 'string' ? wordData.word.trim() : '';
    if (!isOpen || !word) {
      if (!word) {
        setLocalWordEntry(null);
        setDictResult(null);
        setDictLoading(false);
      }
      return;
    }

    let cancelled = false;

    // 沉浸式等入口可注入与完整解密仓相同的词典结果，优先采用，避免只显示「待复习补充」
    const preload = wordData?.dictPreload;
    if (preload?.ok && preload?.payload) {
      setDictResult(preload);
      setDictLoading(false);
    }

    const loadData = async () => {
      if (!preload?.ok) {
        setDictResult(null);
        setDictLoading(true);
      }
      try {
        const found = await getVocabByWord(word);
        if (cancelled) return;
        if (found?.id) {
          const item = await getVocabItem(found.id).catch(() => found);
          if (cancelled) return;
          setLocalWordEntry(item || found);
        } else {
          setLocalWordEntry(null);
        }
      } catch (err) {
        console.error('Failed to search local word database:', err);
        if (!cancelled) setLocalWordEntry(null);
      }

      // 已有有效 preload 时不再重复打断 UI；后台仍可刷新
      try {
        let res = await queryDictionaryWithCache({
          word,
          dictType: 'en_en_business',
        });
        if (cancelled) return;
        if (!(res && res.ok)) {
          res = await queryDictionaryWithCache({
            word,
            dictType: 'en_zh_bidirectional',
          });
        }
        if (cancelled) return;
        if (res && res.ok) {
          setDictResult(res);
        } else if (!preload?.ok) {
          setDictResult(null);
        }
      } catch (err) {
        console.error('Failed to query dictionary for RightPanel:', err);
        if (!cancelled && !preload?.ok) setDictResult(null);
      } finally {
        if (!cancelled) setDictLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [isOpen, wordData?.word, wordData?.dictPreload]);

  const [bgEnabled, setBgEnabled] = useState(
    localStorage.getItem('super_agent_bg_enabled') !== 'false'
  );

  useEffect(() => {
    const handleSettingsChange = () => {
      setBgEnabled(localStorage.getItem('super_agent_bg_enabled') !== 'false');
    };
    window.addEventListener('global-settings-changed', handleSettingsChange);
    return () => window.removeEventListener('global-settings-changed', handleSettingsChange);
  }, []);

  // 监听打开状态触发纸张翻页音效
  useEffect(() => {
    if (isOpen) {
      playReveal();
    }
  }, [isOpen]);

  const handleTabChange = (tab: 'assistant' | 'context') => {
    if (activeTab !== tab) {
      playSwitch(); // 切换 Tab
      setActiveTab(tab);
    }
  };

  const profileLabel = (() => {
    if (!profile) return '默认';
    const locale = profile.match(/英国\s*\(UK\)|美国\s*\(US\)/)?.[0];
    const clean = sanitizeProfileContent(profile);
    if (locale) return locale;
    if (!clean) return '已自定义';
    return clean.length > 12 ? `${clean.slice(0, 10)}…` : clean;
  })();

  useEffect(() => {
    const handleProfileChange = () => {
      setProfile(getAccentPref());
      invalidateMemoryPackCache();
    };
    window.addEventListener(ACCENT_CHANGED_EVENT, handleProfileChange);
    window.addEventListener("global-profile-changed", handleProfileChange);
    return () => {
      window.removeEventListener(ACCENT_CHANGED_EVENT, handleProfileChange);
      window.removeEventListener("global-profile-changed", handleProfileChange);
    };
  }, []);

  const openEmbedSettings = () => {
    const overrides = getDifyEmbedInputOverrides();
    setEmbedAccount(overrides.app_user_id || getAppUserId());
    setEmbedMemoryPack(overrides.memory_pack || '');
    setShowEmbedSettings(true);
  };

  const saveEmbedSettings = () => {
    setDifyEmbedInputOverrides({
      app_user_id: embedAccount,
      memory_pack: embedMemoryPack,
    });
    setShowEmbedSettings(false);
  };

  return (
    <>
      {isOpen && <div className="w-[400px] shrink-0 h-screen" aria-hidden />}
      <motion.aside
        initial={false}
        animate={{ x: isOpen ? 0 : '100%' }}
        transition={GLOBAL_SPRING}
        className={`motion-layer fixed top-0 right-0 h-screen w-[400px] border-l border-zinc-150 bg-gradient-to-b ${bgEnabled ? 'from-zinc-50/70 to-white/60' : 'from-zinc-50 to-white'} backdrop-blur-md flex flex-col shadow-[-16px_0_40px_rgba(0,0,0,0.015)] overflow-hidden transform-gpu will-change-transform ${isOpen ? 'z-[10050]' : 'z-0 pointer-events-none'}`}
        aria-hidden={!isOpen}
      >

          {/* 头部 Tab 区域 */}
          <div className={`flex items-center justify-between gap-2 border-b border-zinc-200 ${bgEnabled ? 'bg-white/60' : 'bg-white'} px-4 py-3 shrink-0 transition-colors duration-300 min-w-0`}>
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <button
                onClick={() => handleTabChange('assistant')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition cursor-pointer shrink-0 ${
                  activeTab === 'assistant'
                    ? 'bg-[#202124] text-white'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                全局 AI 助手
              </button>
              <button
                onClick={() => handleTabChange('context')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition cursor-pointer shrink-0 ${
                  activeTab === 'context'
                    ? 'bg-[#202124] text-white'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                词义解析
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <div className="relative flex items-center max-w-[120px]">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  title={profile ? `画像: ${profile}` : '画像: 默认'}
                  className="h-8 max-w-full px-3 rounded-full border border-gray-150 bg-white/70 backdrop-blur-md shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gray-650 cursor-pointer min-w-0"
                >
                  <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">画像: {profileLabel}</span>
                </button>

                {showProfileMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-[998]" 
                      onClick={() => setShowProfileMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 z-[999] w-48 bg-white/90 backdrop-blur-lg border border-gray-100 rounded-2xl shadow-xl p-1.5 animate-[fadeIn_0.1s_ease-out]">
                      {[
                        { label: '英国 (UK)', value: '英国 (UK)', desc: '英式拼写及口音标准' },
                        { label: '美国 (US)', value: '美国 (US)', desc: '美式拼写及口音标准' },
                        { label: '未设定 (默认)', value: '', desc: '不进行特定倾向限制' }
                      ].map((item) => (
                        <button
                          key={item.value}
                          onClick={() => {
                            saveAccentPref(item.value);
                            setShowProfileMenu(false);
                          }}
                          className="w-full flex flex-col items-start p-2 rounded-xl text-left transition hover:bg-slate-50 cursor-pointer"
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                              {item.label}
                            </span>
                            {profile === item.value && <Check className="w-3 h-3 text-indigo-600" />}
                          </div>
                          <span className="text-[8px] text-gray-400 font-medium mt-0.5">
                            {item.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {activeTab === 'assistant' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      openEmbedSettings();
                    }}
                    className="h-8 px-2.5 rounded-full border border-gray-150 bg-white/70 text-[9px] font-black uppercase tracking-wider text-gray-500 hover:text-[#1C64F2] hover:border-[#1C64F2]/30 transition cursor-pointer"
                    title="修改登录账号或记忆包"
                  >
                    对话设置
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      resetDifyChatbotSession();
                    }}
                    className="h-8 px-2.5 rounded-full border border-gray-150 bg-white/70 text-[9px] font-black uppercase tracking-wider text-gray-500 hover:text-[#1C64F2] hover:border-[#1C64F2]/30 transition cursor-pointer"
                    title="清除本地过期会话并重新开始"
                  >
                    新对话
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  playClick();
                  onClose();
                }}
                className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-[#FF5722] transition cursor-pointer"
                title="收起分析舱"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 内容区域：助手 iframe 常驻，切换词义解析时只隐藏不卸载 */}
          <div className="flex-1 overflow-hidden min-h-0 bg-white relative">
            <div
              className={`w-full h-full ${
                activeTab === 'assistant' ? '' : 'invisible pointer-events-none absolute inset-0'
              }`}
            >
              <DifyAssistantFrame refreshKey={profile} />
            </div>
            {activeTab === 'context' && (
              <div className="w-full h-full overflow-y-auto p-5 space-y-6">
                    {!wordData ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400 px-4">
                        <BookOpen className="w-12 h-12 mb-3 text-gray-300 stroke-[1.5]" />
                        <div className="font-bold text-xs uppercase tracking-widest text-gray-600 mb-1">
                          词义解析就绪
                        </div>
                        <p className="text-[11px] leading-relaxed max-w-[240px]">
                          在左侧主工作区选中任意英文商务词汇，系统将自动调取深层商业洞察并在此呈现。
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-5 animate-[fadeIn_0.3s_ease]">
                        {/* 词条头部 */}
                        <div className="bg-[#FF5722]/5 border border-[#FF5722]/10 rounded-2xl p-5 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[#FF5722]/10 to-transparent rounded-bl-full"></div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-black uppercase tracking-widest bg-[#FF5722] text-white px-2 py-0.5 rounded">
                              已解密
                            </span>
                            <span className="text-[9px] font-bold text-gray-400">
                              来源: {wordData.source || '划词收录'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                                {wordData.word}
                              </h2>
                              {wordData.phonetic && (
                                <span className="text-xs text-gray-400 font-mono block">
                                  /{wordData.phonetic}/
                                </span>
                              )}
                              {localWordEntry && localWordEntry.next_review_date <= Date.now() && (
                                <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-bold">
                                  <Clock className="w-3 h-3" />
                                  <span>今日待复习</span>
                                </div>
                              )}
                            </div>
                            <SpeakButton
                              text={wordData.word}
                              className="w-9 h-9 bg-white border border-gray-100 text-gray-600 shadow-sm"
                            />
                          </div>
                        </div>

                        {/* 字典详情融合 */}
                        {dictLoading ? (
                          <div className="flex flex-col items-center justify-center py-10">
                            <Loader2 className="w-6 h-6 text-[#FF5722] animate-spin mb-2" />
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">正在加载商业词典…</span>
                          </div>
                        ) : dictResult && dictResult.ok && dictResult.payload ? (
                          <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm space-y-4">
                            {dictResult.type === 'en_en_business' && (
                              <EnEnBusinessView payload={dictResult.payload} query={wordData.word} />
                            )}
                            {dictResult.type === 'en_zh_bidirectional' && (
                              <EnZhBidirectionalView payload={dictResult.payload} query={wordData.word} />
                            )}
                            {dictResult.type === 'zh_modern' && (
                              <ZhModernView payload={dictResult.payload} query={wordData.word} />
                            )}
                          </div>
                        ) : (
                          /* 保底降级显示 */
                          <div className="space-y-5">
                            {/* 核心释义 */}
                            <div className="space-y-2">
                              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <span className="w-1 h-3 bg-[#FF5722] rounded-full"></span>
                                核心释义
                              </div>
                              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs text-gray-800 leading-relaxed font-semibold">
                                {(!wordData.meaning || wordData.meaning === '待复习补充')
                                  ? '词典结果暂未返回，请稍后重试或从生词本再次打开该词。'
                                  : wordData.meaning}
                              </div>
                            </div>

                            {/* 英文定义 */}
                            {wordData.definition_en && (
                              <div className="space-y-2">
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center justify-between">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-1 h-3 bg-blue-500 rounded-full"></span>
                                    English Definition
                                  </span>
                                  <SpeakButton text={wordData.definition_en} className="w-6 h-6 border-none bg-transparent hover:bg-slate-100" iconClassName="w-3.5 h-3.5" />
                                </div>
                                <div className="bg-white border border-gray-100 rounded-xl p-4 text-xs text-gray-600 leading-relaxed font-medium">
                                  {wordData.definition_en}
                                </div>
                              </div>
                            )}

                            {/* 商务注解 */}
                            {wordData.business_note && (
                              <div className="space-y-2">
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center justify-between">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-1 h-3 bg-[var(--color-accent)] rounded-full"></span>
                                    Business Context / 商务注解
                                  </span>
                                  <SpeakButton text={wordData.business_note} className="w-6 h-6 border-none bg-transparent hover:bg-slate-100" iconClassName="w-3.5 h-3.5" />
                                </div>
                                <div className="bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20 text-[var(--color-brand)] rounded-xl p-4 text-xs leading-relaxed italic font-medium">
                                  {wordData.business_note}
                                </div>
                              </div>
                            )}

                            {/* 应用场景 */}
                            {wordData.examples && wordData.examples.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                  <span className="w-1 h-3 bg-[#FF5722] rounded-full"></span>
                                  Usage Scenarios / 应用场景
                                </div>
                                <div className="space-y-2">
                                  {wordData.examples.map((ex, index) => (
                                    <div
                                      key={index}
                                      className="bg-slate-50 border border-slate-100/70 p-3.5 rounded-xl text-xs text-gray-600 leading-relaxed relative pl-6 pr-10 font-medium"
                                    >
                                      <span className="absolute left-2.5 top-4 w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                      {ex}
                                      <SpeakButton
                                        text={ex}
                                        className="absolute right-2 top-2 w-6 h-6 border-none bg-transparent hover:bg-slate-200"
                                        iconClassName="w-3.5 h-3.5"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 生词本记忆辅助融合 */}
                        {localWordEntry && (
                          <div className="border-t border-gray-150 pt-5 mt-5">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                              <BrainCircuit className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                              生词记忆辅助
                            </h3>
                            <MemoryAidPanel wordId={localWordEntry.id} wordText={wordData.word} />
                          </div>
                        )}

                        {/* 安全状态提醒 */}
                        <div className="pt-4 border-t border-gray-100 flex items-center gap-2 text-[10px] text-gray-400">
                          <ShieldCheck className="w-4 h-4 text-emerald-500" />
                          已保存并加入生词本
                        </div>
                      </div>
                    )}
              </div>
            )}
          </div>
        </motion.aside>
      {showEmbedSettings && isOpen && (
        <div className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black text-gray-800">
                <SlidersHorizontal className="h-4 w-4 text-[#1C64F2]" />
                对话设置
              </div>
              <button
                type="button"
                onClick={() => setShowEmbedSettings(false)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                title="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mb-3 block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                登录账号（选填）
              </span>
              <input
                value={embedAccount}
                onChange={(e) => setEmbedAccount(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1C64F2]"
                placeholder="默认使用当前登录账号"
              />
            </label>
            <label className="mb-4 block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                结构化记忆包（选填）
              </span>
              <textarea
                value={embedMemoryPack}
                onChange={(e) => setEmbedMemoryPack(e.target.value)}
                rows={4}
                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1C64F2]"
                placeholder="需要注入时再填写，平时可留空"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEmbedSettings(false)}
                className="rounded-xl px-3 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveEmbedSettings}
                className="rounded-xl bg-[#1C64F2] px-3 py-2 text-xs font-bold text-white hover:bg-[#1557d0]"
              >
                保存并重新打开
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const RightPanel = memo(RightPanelComponent);
export default RightPanel;

