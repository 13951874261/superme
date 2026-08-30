import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Trash2, Sparkles, Loader2, ArrowLeft } from 'lucide-react';
import {
  compressUserProfile,
  saveUserCurrentProfile,
  saveCareerPathForAccount,
  buildStaticDifyProfilePreview,
  getAppUserId,
  getL3VarsLocal,
  formatL3VarsForProfile,
  getGraphSummaryLocal,
  getProfileUpdatedAtMs,
  loadUserProfileFromServer,
} from '../utils/profileHelper';
import { getStoredProfileRawForUser } from '../utils/accountStorage';
import { getErrorLedgerSummary } from '../utils/errorLedgerHelper';
import { readCareerPath, type CareerPath } from '../utils/careerProgression';
import { playClick, playWaterDrop } from '../utils/soundEffects';

type Phase = 'compressing' | 'ready';

const PROFILE_BODY_SOURCES = [
  '短板弹窗保存/清空（整段覆盖）',
  '短板精简 / 进入本页 AI 精简（整段替换）',
  '双周复盘提交（增量合并）',
  '侧栏周聊「提交并更新训练计划」（增量合并）',
  '周聊增强模块（增量合并）',
  '启动 / 登录 / 切换 User ID（按 updated_at 同步）',
] as const;

function readStoredProfileRaw(): string {
  return getStoredProfileRawForUser(getAppUserId()).trim();
}

function formatUpdatedAt(ms: number): string {
  if (!ms) return '尚未同步';
  try {
    return new Date(ms).toLocaleString('zh-CN');
  } catch {
    return String(ms);
  }
}

function ReadonlyBlock({
  title,
  body,
  emptyHint,
}: {
  title: string;
  body: string;
  emptyHint: string;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500">{title}</h4>
      <div className="w-full text-[11px] leading-relaxed p-3 bg-slate-50 border border-slate-200 rounded-xl text-zinc-700 whitespace-pre-wrap break-words min-h-[56px]">
        {body.trim() ? body : emptyHint}
      </div>
    </div>
  );
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
  const [l3Line, setL3Line] = useState('');
  const [errorLedgerLine, setErrorLedgerLine] = useState('');
  const [graphSummary, setGraphSummary] = useState('');
  const [updatedAtMs, setUpdatedAtMs] = useState(0);

  const refreshContextLayers = () => {
    setL3Line(formatL3VarsForProfile(getL3VarsLocal()));
    setErrorLedgerLine(getErrorLedgerSummary());
    setGraphSummary(getGraphSummaryLocal());
    setUpdatedAtMs(getProfileUpdatedAtMs());
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase('compressing');
    setError('');
    setCompressMeta('');
    setRecompressing(false);
    setSaving(false);

    (async () => {
      let pullHint = '';
      try {
        // 打开前强制拉取服务端最新画像 / L3 / 错题 / career，再精简展示
        await loadUserProfileFromServer();
      } catch {
        pullHint = '服务端拉取失败，已用本地缓存继续；';
      }
      if (cancelled) return;
      refreshContextLayers();
      setCareer(readCareerPath());

      try {
        const raw = readStoredProfileRaw();
        if (!raw) {
          if (!cancelled) {
            setDraftProfile('');
            setCompressMeta(pullHint ? `${pullHint}短板为空，已跳过精简` : '');
            if (pullHint) setError(pullHint.replace(/；$/, ''));
            setPhase('ready');
          }
          return;
        }
        const result = await compressUserProfile(raw, true);
        if (cancelled) return;
        setDraftProfile(result.mergedProfile);
        setCompressMeta(
          `${pullHint}已 AI 精简 · ${result.beforeLength}→${result.afterLength} 字 · 合并 ${result.dedupeCount} 处`.trim(),
        );
        setCareer(readCareerPath());
        refreshContextLayers();
        setPhase('ready');
      } catch {
        if (cancelled) return;
        setError(`${pullHint}精简失败，已打开当前落库内容`.trim());
        setDraftProfile(readStoredProfileRaw());
        setCareer(readCareerPath());
        refreshContextLayers();
        setPhase('ready');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const preview = buildStaticDifyProfilePreview(draftProfile, career);
  const busy = saving || recompressing;
  const bodyChars = draftProfile.trim().length;

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
      refreshContextLayers();
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
    refreshContextLayers();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      saveUserCurrentProfile(draftProfile.trim());
      saveCareerPathForAccount(career);
      refreshContextLayers();
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
            <p className="text-sm font-bold text-zinc-800">正在同步并精简画像…</p>
            <p className="text-[10px] text-zinc-400">
              先强制拉取服务端最新，再 AI 精简短板（职业路径不送入 LLM）
            </p>
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
                    能力短板（画像正文）
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

              <div className="md:col-span-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                  画像正文来源（E1）
                </h4>
                <p className="text-[10px] text-zinc-500">
                  下列入口均写入同一段能力短板正文（同类主题按最新时效合并）。当前{' '}
                  <span className="font-mono font-bold text-zinc-700">{bodyChars}</span> 字 · 最近同步{' '}
                  <span className="font-mono text-zinc-700">{formatUpdatedAt(updatedAtMs)}</span>
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-zinc-700">
                  {PROFILE_BODY_SOURCES.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
              </div>

              <ReadonlyBlock
                title="L3 结构化变量"
                body={l3Line}
                emptyHint="（暂无 Accent / Goal / Focus）"
              />
              <ReadonlyBlock
                title="错题账本摘要"
                body={errorLedgerLine}
                emptyHint="（暂无 oral / listening / vocab 记录）"
              />
              <div className="md:col-span-2">
                <ReadonlyBlock
                  title="关系图谱摘要"
                  body={graphSummary}
                  emptyHint="（暂无图谱关系）"
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
                  预览含：职业路径 + 短板 + L3 + 错题账本 + 图谱（与 inject 静态段一致）。记忆召回
                  Recall 按当次生成请求动态附加，本页不展示样例。
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
