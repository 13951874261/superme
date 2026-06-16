import React, { useState, useEffect } from 'react';
import { Settings, Zap, ZapOff, Activity, Lock, Unlock } from 'lucide-react';
import { playScan } from '../utils/soundEffects';
import { getUserCurrentProfile, saveUserCurrentProfile } from '../utils/profileHelper';

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
  const [profile, setProfile] = useState(() => getUserCurrentProfile());

  const [isPasswordSectionOpen, setIsPasswordSectionOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  const handleSavePassword = () => {
    const currentPassword = localStorage.getItem('super_agent_lock_password') || '1';
    if (oldPassword !== currentPassword) {
      setPwdError('原密码输入不正确');
      setPwdSuccess('');
      return;
    }
    if (!newPassword) {
      setPwdError('新密码不能为空');
      setPwdSuccess('');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('两次输入的新密码不一致');
      setPwdSuccess('');
      return;
    }
    localStorage.setItem('super_agent_lock_password', newPassword);
    setPwdSuccess('密码修改成功');
    setPwdError('');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPwdSuccess(''), 3000);
  };

  useEffect(() => {
    const handleProfileChange = () => {
      setProfile(getUserCurrentProfile());
    };
    window.addEventListener('global-profile-changed', handleProfileChange);
    return () => window.removeEventListener('global-profile-changed', handleProfileChange);
  }, []);

  useEffect(() => {
    localStorage.setItem('super_agent_global_rate', String(rate));
    localStorage.setItem('super_agent_global_diff', difficulty);
    localStorage.setItem('super_agent_global_interceptor', String(isInterceptorEnabled));
    window.dispatchEvent(new Event('global-settings-changed'));
  }, [rate, difficulty, isInterceptorEnabled]);

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 bg-[#202124] text-white p-5 rounded-2xl shadow-2xl border border-gray-800 w-72 animate-[fadeIn_0.2s_ease-out]">
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
                onChange={(e) => { setRate(Number(e.target.value)); playScan(); }}
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
                  onClick={() => { saveUserCurrentProfile('英国 (UK)'); playScan(); }}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${profile === '英国 (UK)' ? 'bg-[#FF5722] text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  英国 (UK)
                </button>
                <button
                  type="button"
                  onClick={() => { saveUserCurrentProfile('美国 (US)'); playScan(); }}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${profile === '美国 (US)' ? 'bg-[#FF5722] text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  美国 (US)
                </button>
                <button
                  type="button"
                  onClick={() => { saveUserCurrentProfile(''); playScan(); }}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${!profile ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  默认
                </button>
              </div>
            </div>

            <div>
               <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 block">
                 大模型对抗烈度
               </label>
               <div className="flex bg-gray-800 p-1 rounded-xl">
                 <button
                   onClick={() => { setDifficulty('standard'); playScan(); }}
                   className={`flex-1 flex items-center justify-center py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${difficulty === 'standard' ? 'bg-[#FF5722] text-white' : 'text-gray-400 hover:text-white'}`}
                 >
                   <ZapOff className="w-3 h-3 mr-1" /> 标准
                 </button>
                 <button
                   onClick={() => { setDifficulty('hardcore'); playScan(); }}
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
                    onClick={() => { setIsInterceptorEnabled(true); playScan(); }}
                    className={`flex-1 flex items-center justify-center py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${isInterceptorEnabled ? 'bg-[#FF5722] text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    <Lock className="w-3 h-3 mr-1" /> 启用
                  </button>
                  <button
                    onClick={() => { setIsInterceptorEnabled(false); playScan(); }}
                    className={`flex-1 flex items-center justify-center py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${!isInterceptorEnabled ? 'bg-green-600 text-white shadow-[0_0_15px_rgba(22,163,74,0.5)]' : 'text-gray-400 hover:text-white'}`}
                  >
                    <Unlock className="w-3 h-3 mr-1" /> 禁用
                  </button>
                </div>
              </div>

              {/* 修改系统解锁密码折叠项 */}
              <div className="border-t border-gray-800 pt-4">
                <button
                  type="button"
                  onClick={() => { setIsPasswordSectionOpen(!isPasswordSectionOpen); playScan(); }}
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
                      onClick={() => { handleSavePassword(); playScan(); }}
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
        onClick={() => { setIsOpen(!isOpen); playScan(); }}
        className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 ${isOpen ? 'bg-[#FF5722] text-white' : 'bg-[#202124] text-gray-400 hover:text-white'}`}
        title="全局参数控制台"
      >
        <Activity className="w-5 h-5" />
      </button>
    </div>
  );
}
