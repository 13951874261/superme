import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw, Upload, Copy, AlertTriangle, Download, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { API_BASE, YOUTUBE_SETUP_GUIDE_URL, YOUTUBE_SETUP_KIT_FILENAME, YOUTUBE_SETUP_KIT_URL } from '../constants/youtubeSetup';

export function isYoutubeUrl(url: string): boolean {
  const value = String(url || '').trim();
  if (!value) return false;
  return /(?:youtube\.com|youtu\.be)/i.test(value);
}

type CheckResult = {
  ok: boolean;
  message: string;
  configured?: string;
  path?: string;
  hasLoginInfo?: boolean;
  ageDays?: number | null;
};

type PreflightResponse = {
  success?: boolean;
  ready?: boolean;
  checks?: {
    proxy?: CheckResult;
    cookies?: CheckResult;
    downloadProbe?: CheckResult & { skipped?: boolean };
  };
  tunnel?: {
    localProxy: string;
    remoteProxy: string;
    command: string;
    steps?: string[];
  };
  configured?: {
    proxy?: string;
    cookiesFile?: string;
  };
};

interface YoutubePreflightPanelProps {
  onReadyChange?: (ready: boolean) => void;
  onOpenGuide?: () => void;
}

export default function YoutubePreflightPanel({ onReadyChange, onOpenGuide }: YoutubePreflightPanelProps) {
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proxyDraft, setProxyDraft] = useState('http://127.0.0.1:17897');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const runPreflight = useCallback(async (probe = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/materials/youtube-preflight?probe=${probe ? '1' : '0'}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '检测失败');
      setPreflight(data);
      if (data.configured?.proxy) setProxyDraft(data.configured.proxy);
      onReadyChange?.(Boolean(data.ready));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '检测失败';
      setError(message);
      onReadyChange?.(false);
    } finally {
      setLoading(false);
    }
  }, [onReadyChange]);

  useEffect(() => {
    runPreflight(false);
  }, [runPreflight]);

  const saveProxy = async () => {
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('proxy', proxyDraft.trim());
      const res = await fetch(`${API_BASE}/api/materials/youtube-config`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存失败');
      setPreflight(data);
      onReadyChange?.(Boolean(data.ready));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const uploadCookies = async (file: File) => {
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('cookies', file);
      const res = await fetch(`${API_BASE}/api/materials/youtube-config`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '上传失败');
      setPreflight(data);
      onReadyChange?.(Boolean(data.ready));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setSaving(false);
    }
  };

  const copyTunnel = async () => {
    const cmd = preflight?.tunnel?.command || '';
    if (!cmd) return;
    await navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const checks = preflight?.checks;
  const ready = Boolean(preflight?.ready);

  const renderCheck = (label: string, check?: CheckResult) => (
    <div className="flex items-start gap-2 text-xs">
      {check?.ok ? (
        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
      ) : (
        <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
      )}
      <div>
        <p className="font-bold text-gray-700">{label}</p>
        <p className="text-gray-500">{check?.message || '未检测'}</p>
      </div>
    </div>
  );

  return (
    <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-black text-amber-900 uppercase tracking-wider">YouTube 运行前提</p>
          <p className="text-[10px] text-amber-800/80 mt-0.5">
            {ready ? '已就绪，可直接提交 YouTube 链接' : 'Windows 用户推荐一键配置，无需手动敲命令'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => runPreflight(true)}
          disabled={loading || saving}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wide bg-white border border-amber-200 rounded-md text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '检测中' : '检测就绪'}
        </button>
      </div>

      <div className="space-y-2 bg-white/70 rounded-lg p-3 border border-amber-100">
        {renderCheck('① 反向隧道 / 代理', checks?.proxy)}
        {renderCheck('② YouTube Cookies', checks?.cookies)}
        {checks?.downloadProbe && !checks.downloadProbe.skipped && (
          renderCheck('③ yt-dlp 探针', checks.downloadProbe)
        )}
      </div>

      {!ready && (
        <div className="rounded-lg border border-amber-300 bg-white p-3 space-y-2">
          <p className="text-xs font-black text-amber-900">快速配置指引</p>
          <ol className="text-[11px] text-gray-700 space-y-1 list-decimal list-inside">
            <li>点击链接框右侧 <strong>「下载配置」</strong>，解压后双击 <code className="bg-gray-100 px-1 rounded">一键配置YouTube.bat</code></li>
            <li>首次输入 SSH 密码，等待脚本完成</li>
            <li>回到本页点击 <strong>「检测就绪」</strong></li>
          </ol>
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href={YOUTUBE_SETUP_KIT_URL}
              download={YOUTUBE_SETUP_KIT_FILENAME}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase bg-amber-600 text-white rounded-md hover:bg-amber-700"
            >
              <Download className="w-3 h-3" />
              下载配置包
            </a>
            {onOpenGuide ? (
              <button
                type="button"
                onClick={onOpenGuide}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase bg-white border border-amber-200 text-amber-900 rounded-md hover:bg-amber-50"
              >
                <BookOpen className="w-3 h-3" />
                查看新手手册
              </button>
            ) : (
              <a
                href={YOUTUBE_SETUP_GUIDE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase bg-white border border-amber-200 text-amber-900 rounded-md hover:bg-amber-50"
              >
                <BookOpen className="w-3 h-3" />
                查看新手手册
              </a>
            )}
          </div>
          <p className="text-[10px] text-gray-500">
            电脑重启后运行包内「保持YouTube隧道.bat」；cookies 约 2 周需重新配置。
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-1 text-[10px] font-bold text-amber-900 uppercase tracking-wide"
      >
        {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {showAdvanced ? '收起高级配置' : '展开高级配置（手动上传 cookies / 改代理）'}
      </button>

      {showAdvanced && (
        <>
          {!ready && preflight?.tunnel?.steps && preflight.tunnel.steps.length > 0 && (
            <div className="text-[10px] text-amber-900 bg-amber-100/80 border border-amber-200 rounded-md p-2 space-y-1">
              <p className="font-bold">手动配置步骤</p>
              {preflight.tunnel.steps.map((step, i) => (
                <p key={step}>{i + 1}. {step}</p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            <label className="text-[10px] font-bold text-gray-600 uppercase">服务器代理地址 (YTDLP_PROXY)</label>
            <div className="flex gap-2">
              <input
                value={proxyDraft}
                onChange={(e) => setProxyDraft(e.target.value)}
                placeholder="http://127.0.0.1:17897"
                className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white"
                disabled={saving}
              />
              <button
                type="button"
                onClick={saveProxy}
                disabled={saving || !proxyDraft.trim()}
                className="px-3 py-1.5 text-[10px] font-bold uppercase bg-amber-600 text-white rounded-md disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase bg-white border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
              <Upload className="w-3 h-3" />
              上传 cookies.txt
              <input
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                disabled={saving}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadCookies(file);
                  e.target.value = '';
                }}
              />
            </label>
            <button
              type="button"
              onClick={copyTunnel}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase bg-white border border-gray-200 rounded-md hover:bg-gray-50"
            >
              <Copy className="w-3 h-3" />
              {copied ? '已复制隧道命令' : '复制 plink 隧道命令'}
            </button>
          </div>

          {preflight?.tunnel?.command && (
            <pre className="text-[10px] text-gray-600 bg-gray-900 text-gray-100 p-2 rounded-md overflow-x-auto whitespace-pre-wrap break-all">
              {preflight.tunnel.command}
            </pre>
          )}
        </>
      )}

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-600">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {ready ? (
        <p className="text-xs font-bold text-green-700 flex items-center gap-1">
          <CheckCircle2 className="w-4 h-4" /> YouTube 下载前提已就绪，可提交链接
        </p>
      ) : (
        <p className="text-xs text-amber-800 flex items-center gap-1">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          请先完成一键配置并通过检测，再提交 YouTube 链接
        </p>
      )}
    </div>
  );
}
