import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, ShieldAlert, ArrowRight } from 'lucide-react';
import { playClick, playSuccess, playError } from '../utils/soundEffects';
import { ensureAppUserId, getAppUserId, initializeUserSession } from '../utils/profileHelper';

interface LoginPageProps {
  onUnlock: () => void;
  key?: React.Key;
}

export default function LoginPage({ onUnlock }: LoginPageProps) {
  const [password, setPassword] = useState('');
  const [userAlias, setUserAlias] = useState(() => getAppUserId());
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasExistingUserId] = useState(() => Boolean(localStorage.getItem('super_agent_user_id')));
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;
    
    // Fetch correct password from localStorage, default is '1'
    const correctPassword = localStorage.getItem('super_agent_lock_password') || '1';

    if (password === correctPassword) {
      setIsSubmitting(true);
      try {
        playSuccess();
        await initializeUserSession(userAlias.trim() || undefined);
        onUnlock();
      } catch (err) {
        console.warn('[LoginPage] session init failed, continuing with local user id:', err);
        ensureAppUserId(userAlias.trim() || undefined);
        onUnlock();
      } finally {
        setIsSubmitting(false);
      }
    } else {
      playError();
      setIsShaking(true);
      setErrorMsg('系统秘钥验证未通过，请重试');
      setPassword('');
      // Shake for 500ms
      setTimeout(() => {
        setIsShaking(false);
      }, 500);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  return (
    <motion.div 
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative w-screen h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Background Image with sophisticated zoom-in effect on mount */}
      <motion.div
        initial={{ scale: 1.05, filter: 'blur(4px)' }}
        animate={{ scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('/images/login-bg.jpg')` }}
      />

      {/* Dark overlay with linear gradient for rich contrast */}
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/80 via-slate-950/40 to-slate-900/60" />

      {/* Futuristic grid mesh overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(18,24,38,0.08)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Glassmorphism Login Container */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={isShaking ? {
          opacity: 1,
          y: 0,
          scale: 1,
          x: [-12, 12, -8, 8, -4, 4, 0],
          transition: { duration: 0.5, ease: 'easeInOut' }
        } : {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
        }}
        className="relative z-10 w-full max-w-md mx-4 p-8 rounded-[2rem] bg-slate-900/60 border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] backdrop-blur-xl flex flex-col items-center text-center"
      >
        {/* Shield Header Emblem */}
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white shadow-inner">
            <Lock className="w-6 h-6 text-[#FF5722]" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#FF5722] flex items-center justify-center border border-slate-900 animate-pulse">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
        </div>

        {/* Branding & Subtitle */}
        <h1 className="text-xl font-bold tracking-widest text-white mb-1 uppercase font-sans">
          SUPER AGENT
        </h1>
        <p className="text-[9px] text-white/40 tracking-[0.25em] font-black uppercase mb-4">
          高层管理者锻造系统
        </p>
        
        <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-[#FF5722] to-transparent mb-6" />

        {/* Input Form */}
        <form onSubmit={handleUnlock} className="w-full space-y-4">
          <div className="relative w-full">
            <input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              placeholder="请输入系统解锁秘钥"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              className={`w-full px-5 py-4 rounded-2xl bg-white/5 border text-sm text-white placeholder-white/30 outline-none transition-all duration-300 ${
                errorMsg 
                  ? 'border-red-500/50 focus:border-red-500/70 focus:shadow-[0_0_15px_rgba(239,68,68,0.15)]' 
                  : 'border-white/10 focus:border-[#FF5722]/60 focus:shadow-[0_0_20px_rgba(255,87,34,0.15)] focus:bg-white/10'
              }`}
            />
            {/* Eye toggle button */}
            {password && (
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setShowPassword(!showPassword);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>

          <div className="w-full text-left">
            <label className="block text-[11px] font-bold text-white/50 mb-1.5 uppercase tracking-wider">
              用户账号标识 (User ID)
            </label>
            <input
              type="text"
              placeholder="请输入您的固定账号ID"
              value={userAlias}
              onChange={(e) => setUserAlias(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 outline-none transition-all duration-300 focus:border-[#FF5722]/60 focus:bg-white/10"
            />
          </div>

          {/* Error Message with micro-animation */}
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-1.5 text-red-400 text-xs font-medium"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          {/* Unlock Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            onClick={() => playClick()}
            className="w-full group relative flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-[#FF5722] hover:bg-[#ff6a3c] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-widest transition-all duration-300 shadow-lg shadow-[#FF5722]/20 hover:shadow-[#FF5722]/45 cursor-pointer active:scale-[0.98]"
          >
            {isSubmitting ? '正在初始化…' : '解锁登录'}
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </form>

        {/* Footer Hint */}
        <span className="mt-8 text-[10px] text-white/30 tracking-wider">
          系统密码已硬编码保护 • 初次请尝试默认秘钥
        </span>
      </motion.div>
    </motion.div>
  );
}
