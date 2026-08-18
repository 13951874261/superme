import React, { useState } from "react";
import { X, Plus, Trash2, Save, Edit2, Download, FileText, RefreshCw } from "lucide-react";
import { useKnowledgeVault, type KnowledgeSyncFields, type KnowledgeTraceView } from "./useKnowledgeVault";
import type { KnowledgeModule } from "../../types/knowledge";
import * as vaultExport from "./vaultExport";
import { fetchKnowledgeRevisions, summarizeKnowledgeRevision, type KnowledgeRevisionView } from "./vaultRevisions";
import { getAppUserId } from "../../utils/profileHelper";
import KnowledgeGraphPanel from "./KnowledgeGraphPanel";
import MaterialUploader from "../MaterialUploader";
import { useTask } from "../TaskContext";
import { playClick, playGentleWarning } from "../../utils/soundEffects";

type MindmapView = { center?: string; branches?: Array<{ title?: string; children?: string[] }> };

function refineStatusLabel(status?: string): { text: string; className: string } | null {
  if (status === "pending") return { text: "加深中", className: "bg-sky-900/40 text-sky-300" };
  if (status === "done") return { text: "已加深", className: "bg-violet-900/40 text-violet-300" };
  if (status === "failed") return { text: "加深失败", className: "bg-rose-900/40 text-rose-300" };
  return null;
}

function MindmapReadonly({ mindmap }: { mindmap: MindmapView }) {
  const branches = Array.isArray(mindmap.branches) ? mindmap.branches : [];
  return (
    <div className="mt-2 rounded-lg border border-zinc-700 bg-zinc-950/80 p-2 space-y-1">
      <p className="text-[10px] font-black text-[#FF5722]">导图 · {mindmap.center || "未命名"}</p>
      {branches.slice(0, 12).map((br, idx) => {
        const childList = Array.isArray(br.children)
          ? br.children
              .map((c) => (typeof c === "string" ? c : String((c as any)?.title || "")))
              .filter(Boolean)
          : [];
        return (
          <div key={idx} className="text-[10px] text-zinc-300">
            <span className="font-bold text-zinc-200">{br.title || `分支${idx + 1}`}</span>
            {childList.length > 0 && (
              <span className="text-zinc-400"> — {childList.slice(0, 6).join("、")}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const MODULE_OPTIONS: { value: KnowledgeModule; label: string }[] = [
  { value: "listen", label: "听力" },
  { value: "speak", label: "口语" },
  { value: "game_theory", label: "博弈" },
  { value: "writing", label: "写作" },
  { value: "aesthetic", label: "审美" },
];

const SOURCE_TYPE_LABEL: Record<string, string> = {
  manual: "手动录入",
  upload_book: "书籍上传",
  upload_video: "视频上传",
  ai_extract: "AI 提炼",
  from_vocab: "生词本导入",
  from_game_tactics: "战术库导入",
  from_profile: "画像导入",
};

const ACTION_LABEL: Record<string, string> = {
  generated: "生成",
  analyzed: "分析",
  reviewed: "复盘",
};

function statusLabel(item: KnowledgeSyncFields): { text: string; className: string } {
  const status = item.syncStatus || "draft";
  if (status === "archived") return { text: "已归档", className: "bg-zinc-800 text-zinc-400" };
  if (status === "synced") {
    const names = (item.moduleTargets || []).map((m) => MODULE_OPTIONS.find((o) => o.value === m)?.label || m).join("/");
    return { text: names ? `已同步至：${names}` : "已同步", className: "bg-emerald-900/40 text-emerald-300" };
  }
  if (status === "approved") return { text: "已确认未同步", className: "bg-amber-900/40 text-amber-300" };
  return { text: "待确认", className: "bg-zinc-800 text-zinc-400" };
}

function KnowledgeSyncPanel({
  item,
  onSync,
  onRetryRefine,
  disabled,
}: {
  item: KnowledgeSyncFields & { id: string; source?: string };
  onSync: (id: string, targets: KnowledgeModule[]) => Promise<void>;
  onRetryRefine?: (id: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [targets, setTargets] = useState<KnowledgeModule[]>(item.moduleTargets || []);
  const [busy, setBusy] = useState(false);
  const [refineBusy, setRefineBusy] = useState(false);
  const [openTraces, setOpenTraces] = useState(false);
  const [openRevisions, setOpenRevisions] = useState(false);
  const [revisions, setRevisions] = useState<KnowledgeRevisionView[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsError, setRevisionsError] = useState<string | null>(null);
  const status = statusLabel(item);
  const refine = refineStatusLabel(item.refineStatus);
  const traces: KnowledgeTraceView[] = item.traces || [];
  const mindmap = item.mindmap && typeof item.mindmap === "object" ? item.mindmap as MindmapView : null;

  const toggle = (value: KnowledgeModule) => {
    setTargets((prev) => prev.includes(value) ? prev.filter((mod) => mod !== value) : [...prev, value]);
  };

  const confirmSync = async () => {
    if (!window.confirm("该知识将用于听力场景生成、口语训练或博弈分析。确定同步？")) return;
    setBusy(true);
    try {
      await onSync(item.id, targets);
    } finally {
      setBusy(false);
    }
  };

  const retryRefine = async () => {
    if (!onRetryRefine) return;
    setRefineBusy(true);
    try {
      await onRetryRefine(item.id);
    } finally {
      setRefineBusy(false);
    }
  };

  const toggleRevisions = async () => {
    const next = !openRevisions;
    setOpenRevisions(next);
    if (!next) return;
    setRevisionsLoading(true);
    setRevisionsError(null);
    try {
      setRevisions(await fetchKnowledgeRevisions(item.id, getAppUserId()));
    } catch {
      setRevisions([]);
      setRevisionsError("历史版本加载失败");
    } finally {
      setRevisionsLoading(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${status.className}`}>{status.text}</span>
        <span className="text-[10px] text-zinc-500">{SOURCE_TYPE_LABEL[item.sourceType || "manual"] || item.sourceType}</span>
        {item.source ? <span className="text-[10px] text-zinc-500">来源：{item.source}</span> : null}
        {item.sourceRef?.fileName ? <span className="text-[10px] text-zinc-500">文件：{item.sourceRef.fileName}</span> : null}
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300">
          L{item.difficulty || 1}
        </span>
        <span className="text-[10px] text-zinc-500">使用 {item.usageCount || 0} 次</span>
        {refine && (
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${refine.className}`}>{refine.text}</span>
        )}
      </div>
      {mindmap && <MindmapReadonly mindmap={mindmap} />}
      {item.refineStatus === "failed" && onRetryRefine && (
        <button
          type="button"
          disabled={refineBusy || disabled}
          onClick={() => { void retryRefine(); }}
          className="text-[10px] font-black px-2 py-1 rounded border border-rose-500/40 text-rose-300 hover:bg-rose-950/40 disabled:opacity-50 cursor-pointer"
        >
          {refineBusy ? "重试中..." : "重试加深"}
        </button>
      )}
      <div className="text-[10px] font-bold text-zinc-500">同步到训练模块</div>
      <div className="flex flex-wrap gap-3">
        {MODULE_OPTIONS.map((option) => (
          <label key={option.value} className="flex items-center gap-1 text-[11px] text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={targets.includes(option.value)}
              disabled={disabled || busy || item.syncStatus === "archived"}
              onChange={() => toggle(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled || busy || item.syncStatus === "archived"}
        onClick={confirmSync}
        className="text-[11px] font-black px-2 py-1 rounded-lg bg-[#FF5722]/15 text-[#FF5722] border border-[#FF5722]/30 disabled:opacity-50 cursor-pointer"
      >
        {busy ? "同步中..." : "确认并同步"}
      </button>
      <button
        type="button"
        onClick={() => setOpenTraces((open) => !open)}
        className="ml-2 text-[10px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
      >
        {openTraces ? "收起使用记录" : `使用记录（${traces.length}）`}
      </button>
      <button
        type="button"
        onClick={() => { void toggleRevisions(); }}
        className="ml-2 text-[10px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
      >
        {openRevisions ? "收起历史版本" : `历史版本${revisions.length ? `（${revisions.length}）` : ""}`}
      </button>
      {openTraces && (
        <div className="text-[10px] text-zinc-400 space-y-1" aria-live="polite">
          {traces.length === 0 ? (
            <p>暂无训练引用</p>
          ) : traces.map((trace, index) => (
            <p key={`${trace.module}-${trace.usedAt}-${index}`}>
              {MODULE_OPTIONS.find((o) => o.value === trace.module)?.label || trace.module}
              {trace.action ? `｜${ACTION_LABEL[trace.action] || trace.action}` : ""}
              {trace.taskId ? `｜任务 ${trace.taskId}` : ""}
              {trace.sessionId ? `｜会话 ${trace.sessionId}` : ""}
              ｜{trace.usedAt ? new Date(trace.usedAt).toLocaleString("zh-CN") : "时间未知"}
            </p>
          ))}
        </div>
      )}
      {openRevisions && (
        <div className="text-[10px] text-zinc-400 space-y-1" aria-live="polite">
          {revisionsLoading ? (
            <p>加载中...</p>
          ) : revisionsError ? (
            <p>{revisionsError}</p>
          ) : revisions.length === 0 ? (
            <p>暂无历史版本</p>
          ) : revisions.map((rev) => (
            <p key={rev.id}>
              {rev.createdAt ? new Date(rev.createdAt).toLocaleString("zh-CN") : "时间未知"}
              ｜{summarizeKnowledgeRevision(rev.snapshot)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

interface KnowledgeVaultDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KnowledgeVaultDrawer({ isOpen, onClose }: KnowledgeVaultDrawerProps) {
  const {
    vault,
    loading,
    refresh,
    addEnglishNote, updateEnglishNote, deleteEnglishNote,
    addTheoryFrame, updateTheoryFrame, deleteTheoryFrame,
    addWritingSkill, updateWritingSkill, deleteWritingSkill,
    addAestheticTip, updateAestheticTip, deleteAestheticTip,
    syncKnowledge, archiveKnowledge, importMapped,
  } = useKnowledgeVault();
  const { addTask, startPolling } = useTask();

  const [activeTab, setActiveTab] = useState<"english" | "theory" | "writing" | "aesthetic" | "graph">("english");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  // Form states for add
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [example, setExample] = useState("");
  const [theoryTitle, setTheoryTitle] = useState("");
  const [theoryCat, setTheoryCat] = useState<"game_theory" | "psychology" | "logic">("game_theory");
  const [theorySummary, setTheorySummary] = useState("");
  const [writeTitle, setWriteTitle] = useState("");
  const [writeCat, setWriteCat] = useState("");
  const [writeContent, setWriteContent] = useState("");
  const [aestheticTitle, setAestheticTitle] = useState("");
  const [aestheticCat, setAestheticCat] = useState("");
  const [aestheticContent, setAestheticContent] = useState("");

  // Edit mode states
  const [editWord, setEditWord] = useState("");
  const [editMeaning, setEditMeaning] = useState("");
  const [editExample, setEditExample] = useState("");

  const handleError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (activeTab === "english") {
        if (!word.trim()) return;
        await addEnglishNote({ word: word.trim(), meaning, example, source: "手动新增" });
        setWord(""); setMeaning(""); setExample("");
      } else if (activeTab === "theory") {
        if (!theoryTitle.trim()) return;
        await addTheoryFrame({ title: theoryTitle.trim(), category: theoryCat, summary: theorySummary, source: "手动新增" });
        setTheoryTitle(""); setTheorySummary("");
      } else if (activeTab === "writing") {
        if (!writeTitle.trim()) return;
        await addWritingSkill({ title: writeTitle.trim(), category: writeCat || "通用", content: writeContent, source: "手动新增" });
        setWriteTitle(""); setWriteCat(""); setWriteContent("");
      } else if (activeTab === "aesthetic") {
        if (!aestheticTitle.trim()) return;
        await addAestheticTip({ title: aestheticTitle.trim(), category: aestheticCat || "社交", content: aestheticContent, source: "手动新增" });
        setAestheticTitle(""); setAestheticCat(""); setAestheticContent("");
      }
    } catch (err) {
      handleError("添加失败，请重试");
    }
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditWord(item.word || "");
    setEditMeaning(item.meaning || "");
    setEditExample(item.example || "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await updateEnglishNote(editingId, { word: editWord, meaning: editMeaning, example: editExample });
      setEditingId(null);
    } catch (err) {
      handleError("保存失败，请重试");
    }
  };

  const handleDelete = async (type: string, item: KnowledgeSyncFields & { id: string }) => {
    try {
      if ((item.traces || []).length > 0 || item.syncStatus === "archived") {
        await archiveKnowledge(item.id);
        return;
      }
      if (type === "english") await deleteEnglishNote(item.id);
      else if (type === "theory") await deleteTheoryFrame(item.id);
      else if (type === "writing") await deleteWritingSkill(item.id);
      else if (type === "aesthetic") await deleteAestheticTip(item.id);
    } catch {
      handleError("删除失败");
    }
  };

  const handleConfirmSync = async (id: string, targets: KnowledgeModule[]) => {
    try {
      await syncKnowledge(id, targets);
    } catch {
      handleError("同步失败，请重试");
    }
  };

  const handleRetryRefine = async (id: string) => {
    try {
      const res = await fetch(`/api/knowledge-vault/notes/${id}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: getAppUserId() }),
      });
      if (!res.ok) throw new Error("refine failed");
      const data = await res.json();
      if (data && data.taskId) {
        addTask({
          id: data.taskId,
          type: "vault_refine",
          name: "知识点加深",
          status: "pending",
          progress: 0,
          logs: ["已提交加深任务"],
        });
        startPolling(data.taskId);
        try {
          const { showToast } = await import("../Toast");
          showToast({ message: "已加入任务中心：知识点加深", type: "success" });
        } catch {}
      }
      await refresh();
    } catch {
      handleError("加深失败，请重试");
    }
  };

  const handleSync = async () => {
    setError(null);
    try {
      const res = await fetch("/api/vocab/list?light=0");
      const data = await res.json();
      const words = (data && Array.isArray(data) ? data : (data && data.items ? data.items : []));
      for (const w of words) {
        const exists = vault.englishNotes.some(n => n.word.toLowerCase() === (w.word || "").toLowerCase());
        if (!exists) {
          await addEnglishNote({
            word: w.word || "",
            meaning: w.payload?.translation_main || w.translation || "",
            example: (w.payload?.examples && w.payload.examples.length > 0 ? w.payload.examples[0].en : ""),
            source: "生词本同步"
          });
        }
      }
      await refresh();
    } catch {
      handleError("同步失败");
    }
  };

  const handleImportMapped = async (source: "tactics" | "prototypes") => {
    setError(null);
    setMapNotice(null);
    try {
      const result = await importMapped(source);
      const label = source === "tactics" ? "战术库" : "人性档案";
      setMapNotice(`${label}已导入 ${result.createdCount} 条草稿，跳过 ${result.skippedCount} 条已映射。请勾选模块后确认同步。`);
      setTimeout(() => setMapNotice(null), 4000);
    } catch {
      handleError("导入失败，请重试");
    }
  };

  if (!isOpen) return null;

  const enqueueVaultExport = async (format: 'csv' | 'docx') => {
    if (exportBusy) return;
    playClick();
    setExportBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 0));
      const title = '资料管理总汇';
      const payload =
        format === 'csv'
          ? {
              format: 'csv' as const,
              title,
              filename: '资料管理总汇.csv',
              csvContent: vaultExport.buildAllVaultCsvString(vault),
            }
          : {
              format: 'docx' as const,
              title,
              filename: '资料管理总汇.docx',
              sections: vaultExport.buildAllVaultWordSections(vault),
            };
      const { taskId, status } = await vaultExport.requestVaultExportBackground(payload);
      addTask({
        id: taskId,
        type: 'vault_export',
        name: format === 'csv' ? '导出资料抽屉 CSV' : '导出资料抽屉 Word',
        status: (status as 'pending' | 'running') || 'pending',
        progress: 0,
        logs: ['[系统] 后台导出任务已提交...'],
      });
      try {
        const { showToast } = await import('../Toast');
        showToast({ message: '导出任务已在后台执行，请前往【后台任务】下载', type: 'success' });
      } catch {}
    } catch (err) {
      playGentleWarning();
      try {
        const { showToast } = await import('../Toast');
        showToast({ message: err instanceof Error ? err.message : '发起导出失败', type: 'error' });
      } catch {}
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-[40rem] max-w-full bg-[#1b1c1e] text-[#f3f4f6] h-full flex flex-col shadow-2xl border-l border-zinc-800">

        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-[#212225]">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-[#FF5722]">资料管理中心</h2>
            <p className="text-[10px] text-zinc-400 font-bold mt-0.5">多分块知识库 · 可导入/编辑/导出</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { void enqueueVaultExport('csv'); }}
              disabled={exportBusy}
              className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              title="导出全部 (CSV)"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => { void enqueueVaultExport('docx'); }}
              disabled={exportBusy}
              className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              title="导出全部 (Word)"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 bg-[#212225] shrink-0 font-bold text-[10px] uppercase tracking-wider overflow-x-auto">
          {[
            { id: "english" as const, label: "英语笔记本" },
            { id: "theory" as const, label: "逻辑博弈框架" },
            { id: "writing" as const, label: "写作技巧" },
            { id: "aesthetic" as const, label: "审美要点" },
            { id: "graph" as const, label: "图谱" }
          ].map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setEditingId(null); }}
              className={`flex-1 min-w-[4.5rem] py-3 text-center transition-colors border-b-2 cursor-pointer whitespace-nowrap ${activeTab === t.id ? "border-[#FF5722] text-[#FF5722]" : "border-transparent text-zinc-400 hover:text-zinc-200"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "graph" ? (
            <KnowledgeGraphPanel />
          ) : (
            <>

          {/* Sync button (english tab only) */}
          {activeTab === "english" && (
            <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
              <div>
                <span className="text-xs font-bold">从系统生词本一键同步</span>
                <p className="text-[9px] text-zinc-400 mt-0.5">将生词本词条导入知识抽屉</p>
              </div>
              <button onClick={handleSync} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF5722]/10 hover:bg-[#FF5722]/20 border border-[#FF5722]/30 text-[#FF5722] text-xs font-black rounded-lg transition-all disabled:opacity-50 cursor-pointer">
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {loading ? "加载中..." : "开始同步"}
              </button>
            </div>
          )}

          {activeTab === "theory" && (
            <>
            <MaterialUploader
              compact
              topicHint="书籍 / 材料提纯"
              onUploadSuccess={() => {
                void refresh();
              }}
            />
            <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl space-y-2">
              <div>
                <span className="text-xs font-bold">从博弈模块映射导入</span>
                <p className="text-[9px] text-zinc-400 mt-0.5">写入理论框架草稿，不删除原战术库/档案；确认同步后才注入训练</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => handleImportMapped("tactics")} disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF5722]/10 hover:bg-[#FF5722]/20 border border-[#FF5722]/30 text-[#FF5722] text-xs font-black rounded-lg transition-all disabled:opacity-50 cursor-pointer">
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  导入战术库
                </button>
                <button type="button" onClick={() => handleImportMapped("prototypes")} disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF5722]/10 hover:bg-[#FF5722]/20 border border-[#FF5722]/30 text-[#FF5722] text-xs font-black rounded-lg transition-all disabled:opacity-50 cursor-pointer">
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  导入人性档案
                </button>
              </div>
              {mapNotice && <p className="text-[10px] text-emerald-400 font-bold">{mapNotice}</p>}
            </div>
            </>
          )}

          {/* Add form */}
          <form onSubmit={handleAdd} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#FF5722] flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> 录入新知识点
            </h3>

            {activeTab === "english" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="text" placeholder="单词 / 句子" value={word} onChange={e => setWord(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-xs px-3 py-2 rounded-lg outline-none focus:border-[#FF5722]" />
                <input type="text" placeholder="释义" value={meaning} onChange={e => setMeaning(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-xs px-3 py-2 rounded-lg outline-none focus:border-[#FF5722]" />
                <input type="text" placeholder="场景例句" value={example} onChange={e => setExample(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-xs px-3 py-2 rounded-lg outline-none focus:border-[#FF5722] md:col-span-2" />
              </div>
            )}
            {activeTab === "theory" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="text" placeholder="理论标题" value={theoryTitle} onChange={e => setTheoryTitle(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-xs px-3 py-2 rounded-lg outline-none focus:border-[#FF5722]" />
                <select value={theoryCat} onChange={e => setTheoryCat(e.target.value as any)}
                  className="bg-zinc-800 border border-zinc-700 text-xs px-3 py-2 rounded-lg outline-none focus:border-[#FF5722]">
                  <option value="game_theory">博弈论</option>
                  <option value="psychology">心理学</option>
                  <option value="logic">逻辑学</option>
                </select>
                <textarea placeholder="核心概要及因果链路说明" value={theorySummary} onChange={e => setTheorySummary(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-xs px-3 py-2 rounded-lg outline-none focus:border-[#FF5722] md:col-span-2 resize-y h-16" />
              </div>
            )}
            {activeTab === "writing" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="text" placeholder="技巧标题" value={writeTitle} onChange={e => setWriteTitle(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-xs px-3 py-2 rounded-lg outline-none focus:border-[#FF5722]" />
                <input type="text" placeholder="类别标签" value={writeCat} onChange={e => setWriteCat(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-xs px-3 py-2 rounded-lg outline-none focus:border-[#FF5722]" />
                <textarea placeholder="具体要点说明" value={writeContent} onChange={e => setWriteContent(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-xs px-3 py-2 rounded-lg outline-none focus:border-[#FF5722] md:col-span-2 resize-y h-16" />
              </div>
            )}
            {activeTab === "aesthetic" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="text" placeholder="审美要点标题" value={aestheticTitle} onChange={e => setAestheticTitle(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-xs px-3 py-2 rounded-lg outline-none focus:border-[#FF5722]" />
                <input type="text" placeholder="类别标签" value={aestheticCat} onChange={e => setAestheticCat(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-xs px-3 py-2 rounded-lg outline-none focus:border-[#FF5722]" />
                <textarea placeholder="社交场景应对实操要点" value={aestheticContent} onChange={e => setAestheticContent(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-xs px-3 py-2 rounded-lg outline-none focus:border-[#FF5722] md:col-span-2 resize-y h-16" />
              </div>
            )}

            <button type="submit" className="w-full bg-[#FF5722] hover:bg-[#ff6a3c] text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer">
              确认添加知识点
            </button>
          </form>

          {/* Error banner */}
          {error && <div className="bg-red-900/50 border border-red-700 text-red-200 text-xs px-3 py-2 rounded-lg">{error}</div>}

          {/* List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">已录入列表</span>
              <div className="flex gap-2">
                <button onClick={() => {
                  if (activeTab === "english") vaultExport.exportEnglishNotesToCsv(vault.englishNotes);
                  else if (activeTab === "theory") vaultExport.exportTheoryFramesToCsv(vault.theoryFrames);
                  else if (activeTab === "writing") vaultExport.exportWritingSkillsToCsv(vault.writingSkills);
                  else if (activeTab === "aesthetic") vaultExport.exportAestheticTipsToCsv(vault.aestheticTips);
                }} className="text-[10px] font-black text-[#FF5722] hover:underline cursor-pointer">导出本分块 (CSV)</button>
                {activeTab === "english" && (
                  <button onClick={() => vaultExport.exportEnglishNotesToWord(vault.englishNotes)} className="text-[10px] font-black text-[#FF5722] hover:underline cursor-pointer">导出本分块 (Word)</button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8 text-zinc-500 text-xs">加载中...</div>
              ) : activeTab === "english" && vault.englishNotes.map(n => (
                <div key={n.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl relative group">
                  {editingId === n.id ? (
                    <div className="space-y-2">
                      <input value={editWord} onChange={e => setEditWord(e.target.value)} placeholder="单词"
                        className="w-full bg-zinc-800 border border-zinc-700 text-xs px-2 py-1 rounded outline-none focus:border-[#FF5722]" />
                      <input value={editMeaning} onChange={e => setEditMeaning(e.target.value)} placeholder="释义"
                        className="w-full bg-zinc-800 border border-zinc-700 text-xs px-2 py-1 rounded outline-none focus:border-[#FF5722]" />
                      <input value={editExample} onChange={e => setEditExample(e.target.value)} placeholder="例句"
                        className="w-full bg-zinc-800 border border-zinc-700 text-xs px-2 py-1 rounded outline-none focus:border-[#FF5722]" />
                      <div className="flex gap-2">
                        <button type="button" onClick={saveEdit} className="flex items-center gap-1 text-xs bg-[#FF5722] hover:bg-[#ff6a3c] text-white px-2 py-1 rounded cursor-pointer">
                          <Save className="w-3 h-3" /> 保存
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="text-xs text-zinc-400 hover:text-white cursor-pointer">取消</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-black text-[#FF5722]">{n.word}</span>
                          <span className="text-[9px] font-mono font-bold bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded ml-2 uppercase">{n.source}</span>
                        </div>
                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button type="button" onClick={() => startEdit(n)} className="p-1 hover:bg-zinc-800 text-blue-400 rounded transition-colors cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => handleDelete("english", n)} className="p-1 hover:bg-zinc-800 text-red-500 rounded transition-colors cursor-pointer" title={(n.traces || []).length > 0 ? "已有引用，将归档" : "删除"}><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-300 mt-2">{n.meaning}</p>
                      {n.example && <p className="text-[11px] text-zinc-400 italic mt-1.5 border-l-2 border-zinc-700 pl-2">""{n.example}""</p>}
                      <KnowledgeSyncPanel key={`${n.id}-${n.syncStatus}-${(n.moduleTargets || []).join(",")}`} item={n} onSync={handleConfirmSync} onRetryRefine={handleRetryRefine} />
                    </>
                  )}
                </div>
              ))}

              {activeTab === "theory" && vault.theoryFrames.map(f => (
                <div key={f.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl relative group">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-black text-[#FF5722]">{f.title}</span>
                      <span className="text-[9px] font-mono font-bold bg-zinc-800 text-emerald-400 px-1.5 py-0.5 rounded ml-2 uppercase">
                        {{ game_theory: "博弈论", psychology: "心理学", logic: "逻辑学" }[f.category] || f.category}
                      </span>
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => handleDelete("theory", f)} className="p-1 hover:bg-zinc-800 text-red-500 rounded transition-colors cursor-pointer" title={(f.traces || []).length > 0 ? "已有引用，将归档" : "删除"}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300 mt-2 whitespace-pre-wrap">{f.summary}</p>
                  <KnowledgeSyncPanel key={`${f.id}-${f.syncStatus}-${(f.moduleTargets || []).join(",")}`} item={f} onSync={handleConfirmSync} onRetryRefine={handleRetryRefine} />
                </div>
              ))}

              {activeTab === "writing" && vault.writingSkills.map(s => (
                <div key={s.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl relative group">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-black text-[#FF5722]">{s.title}</span>
                      <span className="text-[9px] font-mono font-bold bg-zinc-800 text-purple-400 px-1.5 py-0.5 rounded ml-2 uppercase">{s.category}</span>
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => handleDelete("writing", s)} className="p-1 hover:bg-zinc-800 text-red-500 rounded transition-colors cursor-pointer" title={(s.traces || []).length > 0 ? "已有引用，将归档" : "删除"}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300 mt-2 whitespace-pre-wrap">{s.content}</p>
                  <KnowledgeSyncPanel key={`${s.id}-${s.syncStatus}-${(s.moduleTargets || []).join(",")}`} item={s} onSync={handleConfirmSync} onRetryRefine={handleRetryRefine} />
                </div>
              ))}

              {activeTab === "aesthetic" && vault.aestheticTips.map(t => (
                <div key={t.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl relative group">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-black text-[#FF5722]">{t.title}</span>
                      <span className="text-[9px] font-mono font-bold bg-zinc-800 text-orange-400 px-1.5 py-0.5 rounded ml-2 uppercase">{t.category}</span>
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => handleDelete("aesthetic", t)} className="p-1 hover:bg-zinc-800 text-red-500 rounded transition-colors cursor-pointer" title={(t.traces || []).length > 0 ? "已有引用，将归档" : "删除"}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300 mt-2 whitespace-pre-wrap">{t.content}</p>
                  <KnowledgeSyncPanel key={`${t.id}-${t.syncStatus}-${(t.moduleTargets || []).join(",")}`} item={t} onSync={handleConfirmSync} onRetryRefine={handleRetryRefine} />
                </div>
              ))}

              {((activeTab === "english" && vault.englishNotes.length === 0) ||
                (activeTab === "theory" && vault.theoryFrames.length === 0) ||
                (activeTab === "writing" && vault.writingSkills.length === 0) ||
                (activeTab === "aesthetic" && vault.aestheticTips.length === 0)) && !loading && (
                <div className="text-center py-8 text-zinc-500 text-xs italic">暂无已录入的知识点，请在上方进行录入或同步</div>
              )}
            </div>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}