import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Trash2, Sparkles, Loader2, ArrowLeft } from 'lucide-react';
import {
  compressUserProfile,
  saveUserCurrentProfile,
  saveCareerPathForAccount,
  buildCareerAwareProfileString,
  getAppUserId,
} from '../utils/profileHelper';
import { readCareerPath, type CareerPath } from '../utils/careerProgression';
import { playClick, playWaterDrop } from '../utils/soundEffects';

type Phase = 'compressing' | 'ready';

function readStoredProfileRaw(): string {
  return (
    localStorage.getItem('user_current_profile') ||
    localStorage.getItem('User_Current_Profile') ||
    ''
  ).trim();
}

export default function UserProfileOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('compressing');
  const [compressMeta, setCompressMeta] = useState('');
  const [draftProfile, setDraftProfile] = useState('');
  const [career, setCareer] = useState<CareerPath>(() => readCareerPath());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [recompressing, setRecompressing] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase('compressing');
    setError('');
    setCompressMeta('');
    setRecompressing(false);
    setSaving(false);

    (async () => {
      try {
        const raw = readStoredProfileRaw();
        if (!raw) {
          if (!cancelled) {
            setDraftProfile('');
            setCareer(readCareerPath());
            setPhase('ready');
          }
          return;
        }
        const result = await compressUserProfile(raw, true);
        if (cancelled) return;
        setDraftProfile(result.mergedProfile);
        setCompressMeta(
          `已 AI 精简 · ${result.beforeLength}→${result.afterLength} 字 · 合并 ${result.dedupeCount} 处`,
        );
        setCareer(readCareerPath());
        setPhase('ready');
      } catch {
        if (cancelled) return;
        setError('精简失败，已打开当前落库内容');
        setDraftProfile(readStoredProfileRaw());
        setCareer(readCareerPath());
        setPhase('ready');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const preview = buildCareerAwareProfileString(draftProfile, career);
  const busy = saving || recompressing;

  const handleRecompress = async () => {
    const text = draftProfile.trim();
    if (!text) {
      alert('画像内容为空，无法精简');
      return;
    }
    setRecompressing(true);
    setError('');
    try {
      playClick();
      const result = await compressUserProfile(text, true);
      setDraftProfile(result.mergedProfile);
      setCompressMeta(
        `已 AI 精简 · ${result.beforeLength}→${result.afterLength} 字 · 合并 ${result.dedupeCount} 处`,
      );
      playWaterDrop?.();
    } catch {
      setError('再次精简失败，请稍后重试');
    } finally {
      setRecompressing(false);
    }
  };

  const handleClear = () => {
    if (!window.confirm('确定清空能力短板画像吗？清空后无法自动恢复（职业路径不受影响）')) return;
    playClick();
    saveUserCurrentProfile('');
    setDraftProfile('');
    setCompressMeta('');
    setError('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      saveUserCurrentProfile(draftProfile.trim());
      saveCareerPathForAccount(career);
      playWaterDrop?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => {
          if (phase === 'compressing') onClose();
          else if (!busy) onClose();
        }}
      />
      <div
        className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {phase === 'compressing' && (
          <div className="flex flex-col items-center justify-center gap-4 px-8 py-24">
            <Loader2 className="w-8 h-8 text-[#FF5722] animate-spin" />
            <p className="text-sm font-bold text-zinc-800">正在概括并精简画像…</p>
            <p className="text-[10px] text-zinc-400">职业路径不会送入 LLM 压缩</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-4 py-2 text-[11px] font-bold text-zinc-500 hover:text-zinc-800 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
          </div>
        )}

        {phase === 'ready' && (
          <>
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-start gap-3 min-w-0">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className="p-2 rounded-lg hover:bg-slate-100 text-zinc-500 transition-colors disabled:opacity-50"
                  aria-label="返回"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-zinc-900 tracking-wide">当前账号画像</h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5 font-mono truncate">
                    User ID: {getAppUserId()}
                  </p>
                  {compressMeta && (
                    <p className="text-[10px] text-emerald-700 mt-1 font-medium">{compressMeta}</p>
                  )}
                  {error && (
                    <p className="text-[10px] text-amber-700 mt-1 font-medium">{error}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="p-2 rounded-lg hover:bg-slate-100 text-zinc-500 transition-colors disabled:opacity-50"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                  职业路径
                </h4>
                <div>
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">
                    起点职位 (History)
                  </label>
                  <input
                    type="text"
                    value={career.history}
                    onChange={(e) => setCareer({ ...career, history: e.target.value })}
                    disabled={busy}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF5722] bg-white font-medium disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-emerald-600 font-semibold uppercase tracking-widest block mb-1">
                    当前定位 (Current)
                  </label>
                  <input
                    type="text"
                    value={career.current}
                    onChange={(e) => setCareer({ ...career, current: e.target.value })}
                    disabled={busy}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF5722] bg-white font-medium disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">
                    意向目标 (Target)
                  </label>
                  <input
                    type="text"
                    value={career.target}
                    onChange={(e) => setCareer({ ...career, target: e.target.value })}
                    disabled={busy}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF5722] bg-white font-medium disabled:opacity-60"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                    <span>能力匹配度</span>
                    <span className="font-mono tabular-nums font-extrabold text-[#FF5722]">
                      {career.progress}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={career.progress}
                    onChange={(e) =>
                      setCareer({ ...career, progress: Number(e.target.value) })
                    }
                    disabled={busy}
                    className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#FF5722] disabled:opacity-60"
                  />
                </div>
                <p className="text-[10px] text-zinc-400">
                  职业字段可编辑，保存时写入账号；不会送入 LLM 精简。
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                    能力短板
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClear}
                      disabled={busy}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50 rounded-lg border border-red-100 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                      清空
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRecompress()}
                      disabled={busy || !draftProfile.trim()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold text-[#FF5722] hover:bg-[#FF5722]/5 rounded-lg border border-[#FF5722]/20 transition-colors disabled:opacity-50"
                    >
                      {recompressing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      {recompressing ? '精简中…' : '再次精简'}
                    </button>
                  </div>
                </div>
                <textarea
                  value={draftProfile}
                  onChange={(e) => setDraftProfile(e.target.value)}
                  rows={12}
                  disabled={busy}
                  className="w-full text-xs leading-relaxed p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#FF5722]/40 focus:bg-white resize-y min-h-[220px] font-medium text-zinc-800 disabled:opacity-60"
                  placeholder="暂无短板内容。可直接输入或粘贴后保存。"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                  注入预览（只读）
                </h4>
                <div className="w-full text-[11px] leading-relaxed p-4 bg-slate-50 border border-slate-200 rounded-xl text-zinc-700 whitespace-pre-wrap break-words min-h-[72px]">
                  {preview || '（空）'}
                </div>
                <p className="text-[10px] text-zinc-400">
                  实际注入 Dify 时会前置职业路径行；上框仅预览，不可编辑。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50 sticky bottom-0">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="px-4 py-2.5 text-[11px] font-bold text-zinc-500 hover:text-zinc-800 rounded-xl transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[11px] font-black text-white bg-zinc-950 hover:bg-[#FF5722] rounded-xl transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? '保存中…' : '保存画像'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
