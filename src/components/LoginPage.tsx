import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { playClick, playSuccess, playError } from '../utils/soundEffects';
import { ensureAppUserId, initializeUserSession } from '../utils/profileHelper';
import { verifyInvite } from '../services/authAPI';

gsap.registerPlugin(useGSAP);

interface LoginPageProps {
  onUnlock: () => void;
  key?: React.Key;
}

/** 卫星节点相对核心的位置，用于表达“生长 / 重组 / 贴合” */
const SATELLITES = [
  { cx: 24, cy: 30, r: 3.2 },
  { cx: 76, cy: 24, r: 2.6 },
  { cx: 86, cy: 62, r: 3.6 },
  { cx: 58, cy: 84, r: 2.8 },
  { cx: 20, cy: 70, r: 3 },
  { cx: 46, cy: 16, r: 2.2 },
];

const CORE = { cx: 50, cy: 50, r: 6 };

export default function LoginPage({ onUnlock }: LoginPageProps) {
  const [account, setAccount] = useState(
    () => localStorage.getItem('super_agent_user_id')?.trim() || ''
  );
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          motionOk: '(prefers-reduced-motion: no-preference)',
          motionReduced: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          const { motionOk } = context.conditions as { motionOk: boolean };

          if (!motionOk) {
            gsap.set('.login-reveal, .login-node, .login-link', { autoAlpha: 1, y: 0, scale: 1 });
            return;
          }

          gsap.from('.login-reveal', {
            autoAlpha: 0,
            y: 16,
            duration: 0.6,
            ease: 'power3.out',
            stagger: 0.08,
          });

          gsap.from('.login-node', {
            autoAlpha: 0,
            duration: 0.7,
            ease: 'power2.out',
            stagger: 0.06,
            delay: 0.2,
          });

          gsap.from('.login-link', {
            autoAlpha: 0,
            duration: 0.8,
            ease: 'power1.out',
            stagger: 0.05,
            delay: 0.5,
          });

          // 持续迭代：节点缓慢重组，链路呼吸
          gsap.to('.login-satellite', {
            x: () => gsap.utils.random(-6, 6),
            y: () => gsap.utils.random(-6, 6),
            duration: 3.2,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
            repeatRefresh: true,
            stagger: 0.25,
          });

          gsap.to('.login-core', {
            scale: 1.12,
            duration: 2.4,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
            delay: 0.9,
          });

          gsap.to('.login-link', {
            autoAlpha: 0.28,
            duration: 2,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
            stagger: 0.2,
            delay: 1.4,
          });
        }
      );

      inputRef.current?.focus();
    },
    { scope: rootRef }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmed = account.trim();
    if (!trimmed) {
      playError();
      setErrorMsg('请输入受邀账号');
      inputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const result = await verifyInvite(trimmed);
      if (!result.success) {
        playError();
        setErrorMsg(result.error || '该账号未被邀请');
        inputRef.current?.focus();
        return;
      }

      playSuccess();
      try {
        await initializeUserSession(trimmed);
      } catch (err) {
        console.warn('[LoginPage] session init failed, continuing with local user id:', err);
        ensureAppUserId(trimmed);
      }
      onUnlock();
    } catch (err) {
      console.warn('[LoginPage] verify invite failed:', err);
      playError();
      setErrorMsg('暂时无法验证，请稍后重试');
      inputRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      ref={rootRef}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-screen h-screen flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden bg-canvas"
    >
      {/* 左：理念场 */}
      <section className="relative flex-1 min-h-[42vh] lg:min-h-0 bg-brand-dark text-white overflow-hidden flex flex-col justify-between px-8 py-10 lg:px-16 lg:py-14">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:36px_36px]"
        />
        <div
          aria-hidden="true"
          className="absolute -left-24 -top-24 w-[420px] h-[420px] rounded-full bg-[#FF5722]/10 blur-3xl"
        />

        <p className="login-reveal relative text-xs font-bold tracking-[0.32em] uppercase text-white/50">
          Super Agent
        </p>

        <div className="relative max-w-xl">
          <h1 className="login-reveal text-5xl lg:text-6xl font-bold tracking-tight text-balance">
            因您而变
          </h1>
          <p className="login-reveal mt-4 text-base lg:text-lg leading-relaxed text-white/70 text-pretty">
            这是一套会学、会改、会贴着你迭代的 AI 原生 Agent。
          </p>

          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            className="login-graph mt-8 w-40 h-40 lg:w-52 lg:h-52"
          >
            {SATELLITES.map((node) => (
              <line
                key={`link-${node.cx}-${node.cy}`}
                className="login-link"
                x1={CORE.cx}
                y1={CORE.cy}
                x2={node.cx}
                y2={node.cy}
                stroke="#FF5722"
                strokeWidth="0.6"
                opacity="0.6"
              />
            ))}
            <circle
              className="login-node login-core"
              cx={CORE.cx}
              cy={CORE.cy}
              r={CORE.r}
              fill="#FF5722"
            />
            {SATELLITES.map((node) => (
              <circle
                key={`node-${node.cx}-${node.cy}`}
                className="login-node login-satellite"
                cx={node.cx}
                cy={node.cy}
                r={node.r}
                fill="#ffffff"
                opacity="0.85"
              />
            ))}
          </svg>
        </div>

        <p className="login-reveal relative text-[11px] lg:text-xs font-bold tracking-[0.2em] uppercase text-white/45">
          AI 原生 · Agent · 自主学习 · 不断迭代
        </p>
      </section>

      {/* 右：邀请门 */}
      <section className="relative w-full lg:w-[440px] xl:w-[480px] shrink-0 bg-surface flex flex-col justify-between gap-8 px-8 py-10 lg:px-12 lg:py-14 border-t lg:border-t-0 lg:border-l border-border">
        <p className="login-reveal text-[11px] font-bold tracking-[0.2em] uppercase text-ink-muted">
          仅限受邀访问
        </p>

        <div className="login-reveal w-full max-w-sm">
          <h2 className="text-2xl font-bold text-ink-primary tracking-tight">进入系统</h2>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label
                htmlFor="invited-account"
                className="block text-xs font-bold text-ink-secondary mb-2 tracking-wide"
              >
                受邀账号
              </label>
              <input
                id="invited-account"
                ref={inputRef}
                type="text"
                name="username"
                autoComplete="username"
                spellCheck={false}
                placeholder="请输入受邀账号…"
                value={account}
                onChange={(e) => {
                  setAccount(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                aria-invalid={Boolean(errorMsg)}
                aria-describedby={errorMsg ? 'invited-account-error' : undefined}
                className={`w-full px-4 py-3 rounded-xl bg-canvas border text-sm text-ink-primary placeholder-ink-muted outline-none transition-[border-color,box-shadow,background-color] duration-200 focus-visible:ring-2 focus-visible:ring-[#FF5722]/40 ${
                  errorMsg
                    ? 'border-danger focus-visible:border-danger'
                    : 'border-border focus-visible:border-[#FF5722]'
                }`}
              />
            </div>

            <div id="invited-account-error" role="status" aria-live="polite" className="min-h-[20px]">
              {errorMsg && (
                <span className="flex items-center gap-1.5 text-danger text-xs font-medium">
                  <ShieldAlert aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
                  {errorMsg}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              onClick={() => playClick()}
              className="group w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-[#FF5722] hover:bg-[#ff6a3c] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm tracking-wide transition-[background-color,box-shadow,transform] duration-200 shadow-card hover:shadow-hover focus-visible:ring-2 focus-visible:ring-[#FF5722]/50 focus-visible:ring-offset-2 active:scale-[0.99] cursor-pointer touch-manipulation"
            >
              {isSubmitting ? '验证中…' : '验证并进入'}
              {!isSubmitting && (
                <ArrowRight
                  aria-hidden="true"
                  className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
                />
              )}
            </button>
          </form>

          <p className="mt-4 text-xs text-ink-muted">未在名单内无法访问。</p>
        </div>

        <p className="login-reveal text-[11px] text-ink-muted tracking-wide">仅限受邀账户</p>
      </section>
    </motion.div>
  );
}
