import React, { useState, useEffect } from 'react';
import { Settings, Zap, ZapOff, Activity, Lock, Unlock, Image } from 'lucide-react';
import { playClick, playSwitch, playReveal, playDrag, playValidatePass, playValidateFail, setGlobalVolume } from '../utils/soundEffects';
import { getAccentPref, saveAccentPref, ACCENT_CHANGED_EVENT, getAppUserId, setAppUserId, loadUserProfileFromServer, getUserWeaknessProfile } from '../utils/profileHelper';
import { readCareerPath, careerNodeLabel } from '../utils/careerProgression';
import { reloadDifyChatbotEmbed } from '../utils/difyChatbot';
import UserProfileOverlay from './UserProfileOverlay';

export type GlobalDifficulty = 'standard' | 'hardcore';

export default function GlobalSettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [rate, setRate] = useState(Number(localStorage.getItem('super_agent_global_rate') || 1.0));
  const [difficulty, setDifficulty] = useState<GlobalDifficulty>(
    (localStorage.getItem('super_agent_global_diff') as GlobalDifficulty) || 'standard'
  );
  const [isInterceptorEnabled, setIsInterceptorEnabled] = useState<boolean>(
    localStorage.getItem('super_agent_global_interceptor') !== 'false'
  );
  const [profile, setProfile] = useState(() => getAccentPref());
  const [appUserId, setAppUserIdState] = useState(() => getAppUserId());
  const [userIdDraft, setUserIdDraft] = useState('');
  const [isUserIdSectionOpen, setIsUserIdSectionOpen] = useState(false);
  const [userIdMsg, setUserIdMsg] = useState('');
  const [userIdError, setUserIdError] = useState('');

  const [bgEnabled, setBgEnabled] = useState<boolean>(
    localStorage.getItem('super_agent_bg_enabled') !== 'false'
  );
  const [bgIndex, setBgIndex] = useState<number>(
    parseInt(localStorage.getItem('super_agent_bg_index') || '0', 10)
  );
  const [bgBlur, setBgBlur] = useState<number>(
    parseInt(localStorage.getItem('super_agent_bg_blur') || '10', 10)
  );
  const [bgOpacity, setBgOpacity] = useState<number>(
    parseFloat(localStorage.getItem('super_agent_bg_opacity') || '0.45')
  );
  const [isBgSectionOpen, setIsBgSectionOpen] = useState(false);

  const [isPasswordSectionOpen, setIsPasswordSectionOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    localStorage.getItem('super_agent_sound_enabled') !== 'false'
  );
  const [soundVolume, setSoundVolume] = useState<number>(
    parseFloat(localStorage.getItem('super_agent_sound_volume') || '0.5')
  );
  const [profileOverlayOpen, setProfileOverlayOpen] = useState(false);

  const careerPreview = readCareerPath();
  const careerPreviewLine = `${careerNodeLabel(careerPreview.current)}→${careerNodeLabel(careerPreview.target)} · ${careerPreview.progress}%`;
  const weaknessPreview = getUserWeaknessProfile() || '暂无短板';

  const handleSavePassword = () => {
    const currentPassword = localStorage.getItem('super_agent_lock_password') || '1';
    if (oldPassword !== currentPassword) {
      setPwdError('原密码输入不正确');
      setPwdSuccess('');
      playValidateFail();
      return;
    }
    if (!newPassword) {
      setPwdError('新密码不能为空');
      setPwdSuccess('');
      playValidateFail();
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('两次输入的新密码不一致');
      setPwdSuccess('');
      playValidateFail();
      return;
    }
    localStorage.setItem('super_agent_lock_password', newPassword);
    setPwdSuccess('密码修改成功');
    setPwdError('');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    playValidatePass();
    setTimeout(() => setPwdSuccess(''), 3000);
  };

  const handleSaveUserId = async () => {
    const next = userIdDraft.trim();
    if (!next) {
      setUserIdError('用户标识不能为空');
      setUserIdMsg('');
      playValidateFail();
      return;
    }
    if (next === appUserId) {
      setUserIdMsg('标识未变更');
      setUserIdError('');
      return;
    }
    try {
      setAppUserId(next);
      await loadUserProfileFromServer(next);
      const saved = getAppUserId();
      setAppUserIdState(saved);
      setUserIdDraft(saved);
      reloadDifyChatbotEmbed();
      setUserIdMsg('用户标识已更新，画像已从服务端同步');
      setUserIdError('');
      playValidatePass();
      setTimeout(() => setUserIdMsg(''), 3000);
    } catch {
      setUserIdError('更新失败，请检查后端服务');
      setUserIdMsg('');
      playValidateFail();
    }
  };

  useEffect(() => {
    const handleAccentChange = () => {
      setProfile(getAccentPref());
    };
    window.addEventListener(ACCENT_CHANGED_EVENT, handleAccentChange);
    return () => window.removeEventListener(ACCENT_CHANGED_EVENT, handleAccentChange);
  }, []);

  useEffect(() => {
    localStorage.setItem('super_agent_global_rate', String(rate));
    localStorage.setItem('super_agent_global_diff', difficulty);
    localStorage.setItem('super_agent_global_interceptor', String(isInterceptorEnabled));
    localStorage.setItem('super_agent_bg_enabled', String(bgEnabled));
    localStorage.setItem('super_agent_bg_index', String(bgIndex));
    localStorage.setItem('super_agent_bg_blur', String(bgBlur));
    localStorage.setItem('super_agent_bg_opacity', String(bgOpacity));
    window.dispatchEvent(new Event('global-settings-changed'));
  }, [rate, difficulty, isInterceptorEnabled, bgEnabled, bgIndex, bgBlur, bgOpacity]);

  useEffect(() => {
    localStorage.setItem('super_agent_sound_enabled', String(soundEnabled));
    localStorage.setItem('super_agent_sound_volume', String(soundVolume));
    setGlobalVolume(soundVolume);
    window.dispatchEvent(new Event('global-sound-changed'));
  }, [soundEnabled, soundVolume]);

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 bg-[#202124] text-white p-5 rounded-2xl shadow-2xl border border-gray-800 w-72 max-h-[80vh] overflow-y-auto custom-scrollbar animate-[fadeIn_0.2s_ease-out]">
          <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-3">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-300 flex items-center">
              <Settings className="w-4 h-4 mr-2" /> 全局统筹 (Global)
            </h4>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex justify-between mb-3">
                <span>发音语速倍率</span>
                <span className="text-[#FF5722]">{rate.toFixed(1)}x</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={rate}
                onChange={(e) => { setRate(Number(e.target.value)); playDrag(); }}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#FF5722]"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 block">
                地区画像偏好
              </label>
              <div className="flex bg-gray-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => { saveAccentPref('英国 (UK)'); playSwitch(); }}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${profile === '英国 (UK)' ? 'bg-[#FF5722] text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  英国 (UK)
                </button>
                <button
                  type="button"
                  onClick={() => { saveAccentPref('美国 (US)'); playSwitch(); }}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${profile === '美国 (US)' ? 'bg-[#FF5722] text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  美国 (US)
                </button>
                <button
                  type="button"
                  onClick={() => { saveAccentPref(''); playSwitch(); }}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${!profile ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  默认
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 block">
                当前账号画像
              </label>
              <div className="bg-gray-800/50 p-3 rounded-xl border border-gray-700 space-y-2">
                <p className="text-[9px] text-gray-400 truncate">{careerPreviewLine}</p>
                <p className="text-[9px] text-gray-500 truncate">{weaknessPreview}</p>
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setIsOpen(false);
                    setProfileOverlayOpen(true);
                  }}
                  className="w-full py-2 rounded-lg bg-[#FF5722] hover:bg-[#ff6a3c] text-[10px] font-black uppercase tracking-widest text-white transition-colors"
                >
                  打开
                </button>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => {
                  setIsUserIdSectionOpen(!isUserIdSectionOpen);
                  if (!isUserIdSectionOpen) {
                    setUserIdDraft(appUserId);
                    setUserIdMsg('');
                    setUserIdError('');
                  }
                  playClick();
                }}
                className="w-full text-left text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 flex items-center justify-between"
              >
                <span>用户标识 (User ID)</span>
                <span className="text-gray-500 normal-case font-mono text-[9px] truncate max-w-[120px]">{appUserId}</span>
              </button>
              {isUserIdSectionOpen && (
                <div className="space-y-3 bg-gray-800/50 p-3 rounded-xl border border-gray-700">
                  <p className="text-[9px] text-gray-500 leading-relaxed">
                    用于 SQLite 画像与配额隔离。修改后将加载该标识下的服务端数据。
                  </p>
                  <input
                    type="text"
                    value={userIdDraft}
                    onChange={(e) => {
                      setUserIdDraft(e.target.value);
                      if (userIdError) setUserIdError('');
                    }}
                    placeholder="例如 lzhumy 或 user_xxx"
                    className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-xs text-white placeholder-gray-600 outline-none focus:border-[#FF5722]/60"
                  />
                  {userIdError && <p className="text-[10px] text-red-400">{userIdError}</p>}
                  {userIdMsg && <p className="text-[10px] text-green-400">{userIdMsg}</p>}
                  <button
                    type="button"
                    onClick={() => { playClick(); void handleSaveUserId(); }}
                    className="w-full py-2 rounded-lg bg-[#FF5722] hover:bg-[#ff6a3c] text-[10px] font-black uppercase tracking-widest text-white transition-colors"
                  >
                    保存用户标识
                  </button>
                </div>
              )}
            </div>

            <div>
               <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 block">
                 大模型对抗烈度
               </label>
               <div className="flex bg-gray-800 p-1 rounded-xl">
                 <button
                   onClick={() => { setDifficulty('standard'); playSwitch(); }}
                   className={`flex-1 flex items-center justify-center py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${difficulty === 'standard' ? 'bg-[#FF5722] text-white' : 'text-gray-400 hover:text-white'}`}
                 >
                   <ZapOff className="w-3 h-3 mr-1" /> 标准
                 </button>
                 <button
                   onClick={() => { setDifficulty('hardcore'); playSwitch(); }}
                   className={`flex-1 flex items-center justify-center py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${difficulty === 'hardcore' ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'text-gray-400 hover:text-white'}`}
                 >
                   <Zap className="w-3 h-3 mr-1" /> 极限
                 </button>
               </div>
             </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 block">
                  全局控制阻断
                </label>
                <div className="flex bg-gray-800 p-1 rounded-xl">
                  <button
                    onClick={() => { setIsInterceptorEnabled(true); playSwitch(); }}
                    className={`flex-1 flex items-center justify-center py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${isInterceptorEnabled ? 'bg-[#FF5722] text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    <Lock className="w-3 h-3 mr-1" /> 启用
                  </button>
                  <button
                    onClick={() => { setIsInterceptorEnabled(false); playSwitch(); }}
                    className={`flex-1 flex items-center justify-center py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${!isInterceptorEnabled ? 'bg-green-600 text-white shadow-[0_0_15px_rgba(22,163,74,0.5)]' : 'text-gray-400 hover:text-white'}`}
                  >
                    <Unlock className="w-3 h-3 mr-1" /> 禁用
                  </button>
                </div>
              </div>

              {/* 网页背景图控制折叠项 */}
              <div className="border-t border-gray-800 pt-4">
                <button
                  type="button"
                  onClick={() => { setIsBgSectionOpen(!isBgSectionOpen); playReveal(); }}
                  className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors py-1 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5"><Image className="w-3.5 h-3.5" /> 网页背景图管理</span>
                  <span className="text-xs">{isBgSectionOpen ? '▲' : '▼'}</span>
                </button>

                {isBgSectionOpen && (
                  <div className="mt-3 space-y-4 animate-[fadeIn_0.2s_ease-out]">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">
                        背景显示开关
                      </label>
                      <div className="flex bg-gray-800 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => { setBgEnabled(true); playSwitch(); }}
                          className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer ${bgEnabled ? 'bg-[#FF5722] text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                          开启
                        </button>
                        <button
                          type="button"
                          onClick={() => { setBgEnabled(false); playSwitch(); }}
                          className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer ${!bgEnabled ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                          关闭
                        </button>
                      </div>
                    </div>

                    {bgEnabled && (
                      <>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">
                            选择背景图
                          </label>
                          <div className="grid grid-cols-4 gap-2">
                            {Array.from({ length: 8 }).map((_, index) => {
                              const isActive = bgIndex === index;
                              return (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => { setBgIndex(index); playClick(); }}
                                  style={{
                                    backgroundImage: `url(/images/backgrounds/bg-${index + 1}.jpg)`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                  }}
                                  className={`aspect-video rounded-lg relative overflow-hidden transition-all duration-200 cursor-pointer shadow-md hover:scale-105 ${
                                    isActive 
                                      ? 'ring-2 ring-[#FF5722] ring-offset-1 ring-offset-zinc-900 scale-105 shadow-[#FF5722]/30' 
                                      : 'brightness-75 hover:brightness-100'
                                  }`}
                                  title={`背景图 ${index + 1}`}
                                >
                                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                    <span className="text-[9px] font-mono font-black text-white bg-black/60 px-1.5 py-0.5 rounded">
                                      {index + 1}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex justify-between mb-2">
                            <span>背景模糊度</span>
                            <span className="text-[#FF5722] font-mono font-bold">{bgBlur}px</span>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="24"
                            step="1"
                            value={bgBlur}
                            onChange={(e) => { setBgBlur(Number(e.target.value)); playDrag(); }}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#FF5722]"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex justify-between mb-2">
                            <span>图层遮罩透明度</span>
                            <span className="text-[#FF5722] font-mono font-bold">{Math.round(bgOpacity * 100)}%</span>
                          </label>
                          <input
                            type="range"
                            min="0.10"
                            max="0.90"
                            step="0.05"
                            value={bgOpacity}
                            onChange={(e) => { setBgOpacity(Number(e.target.value)); playDrag(); }}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#FF5722]"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* 音效设置 */}
              <div className="border-t border-gray-800 pt-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
                  音效设置
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-300">启用音效</span>
                    <button
                      type="button"
                      onClick={() => { setSoundEnabled(!soundEnabled); playClick(); }}
                      className={`relative w-10 h-5 rounded-full transition-colors ${soundEnabled ? 'bg-[#FF5722]' : 'bg-gray-600'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${soundEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-300">音量</span>
                    <span className="text-[11px] text-[#FF5722]">{Math.round(soundVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={soundVolume}
                    onChange={(e) => { setSoundVolume(parseFloat(e.target.value)); playDrag(); }}
                    disabled={!soundEnabled}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#FF5722] disabled:opacity-40"
                  />
                </div>
              </div>

              {/* 修改系统解锁密码折叠项 */}
              <div className="border-t border-gray-800 pt-4">
                <button
                  type="button"
                  onClick={() => { setIsPasswordSectionOpen(!isPasswordSectionOpen); playReveal(); }}
                  className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors py-1 cursor-pointer"
                >
                  <span>修改系统密码</span>
                  <span className="text-xs">{isPasswordSectionOpen ? '▲' : '▼'}</span>
                </button>
                
                {isPasswordSectionOpen && (
                  <div className="mt-3 space-y-3 animate-[fadeIn_0.2s_ease-out]">
                    <input
                      type="password"
                      placeholder="请输入原密码"
                      value={oldPassword}
                      onChange={(e) => { setOldPassword(e.target.value); setPwdError(''); }}
                      className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-white placeholder-gray-500 outline-none focus:border-[#FF5722]"
                    />
                    <input
                      type="password"
                      placeholder="请输入新密码"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setPwdError(''); }}
                      className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-white placeholder-gray-500 outline-none focus:border-[#FF5722]"
                    />
                    <input
                      type="password"
                      placeholder="请确认新密码"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setPwdError(''); }}
                      className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-white placeholder-gray-500 outline-none focus:border-[#FF5722]"
                    />
                    
                    {pwdError && (
                      <div className="text-[10px] text-red-500 font-bold">{pwdError}</div>
                    )}
                    {pwdSuccess && (
                      <div className="text-[10px] text-green-500 font-bold">{pwdSuccess}</div>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => { handleSavePassword(); }}
                      className="w-full py-2 bg-[#FF5722] hover:bg-[#ff6a3c] text-[10px] font-black uppercase tracking-widest text-white rounded-lg transition-colors cursor-pointer"
                    >
                      保存密码
                    </button>
                  </div>
                )}
              </div>
          </div>
        </div>
      )}

      <button
        onClick={() => { setIsOpen(!isOpen); playReveal(); }}
        className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 ${isOpen ? 'bg-[#FF5722] text-white' : 'bg-[#202124] text-gray-400 hover:text-white'}`}
        title="全局参数控制台"
      >
        <Activity className="w-5 h-5" />
      </button>

      <UserProfileOverlay
        open={profileOverlayOpen}
        onClose={() => setProfileOverlayOpen(false)}
      />
    </div>
  );
}
