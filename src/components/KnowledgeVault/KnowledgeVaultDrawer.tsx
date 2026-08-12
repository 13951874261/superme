import React, { useState } from "react";
import { X, Plus, Trash2, Save, Edit2, Download, FileText, RefreshCw } from "lucide-react";
import { useKnowledgeVault } from "./useKnowledgeVault";
import * as vaultExport from "./vaultExport";

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
    addAestheticTip, updateAestheticTip, deleteAestheticTip
  } = useKnowledgeVault();

  const [activeTab, setActiveTab] = useState<"english" | "theory" | "writing" | "aesthetic">("english");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleDelete = async (type: string, id: string) => {
    try {
      if (type === "english") await deleteEnglishNote(id);
      else if (type === "theory") await deleteTheoryFrame(id);
      else if (type === "writing") await deleteWritingSkill(id);
      else if (type === "aesthetic") await deleteAestheticTip(id);
    } catch {
      handleError("删除失败");
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

  if (!isOpen) return null;

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
            <button onClick={() => vaultExport.exportAllToCsv(vault)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer" title="导出全部 (CSV)">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={() => vaultExport.exportAllToWord(vault)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer" title="导出全部 (Word)">
              <FileText className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 bg-[#212225] shrink-0 font-bold text-[10px] uppercase tracking-wider">
          {[
            { id: "english" as const, label: "英语笔记本" },
            { id: "theory" as const, label: "逻辑博弈框架" },
            { id: "writing" as const, label: "写作技巧" },
            { id: "aesthetic" as const, label: "审美要点" }
          ].map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setEditingId(null); }}
              className={`flex-1 py-3 text-center transition-colors border-b-2 cursor-pointer ${activeTab === t.id ? "border-[#FF5722] text-[#FF5722]" : "border-transparent text-zinc-400 hover:text-zinc-200"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

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
                          <button type="button" onClick={() => handleDelete("english", n.id)} className="p-1 hover:bg-zinc-800 text-red-500 rounded transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-300 mt-2">{n.meaning}</p>
                      {n.example && <p className="text-[11px] text-zinc-400 italic mt-1.5 border-l-2 border-zinc-700 pl-2">""{n.example}""</p>}
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
                      <button type="button" onClick={() => handleDelete("theory", f.id)} className="p-1 hover:bg-zinc-800 text-red-500 rounded transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300 mt-2 whitespace-pre-wrap">{f.summary}</p>
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
                      <button type="button" onClick={() => handleDelete("writing", s.id)} className="p-1 hover:bg-zinc-800 text-red-500 rounded transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300 mt-2 whitespace-pre-wrap">{s.content}</p>
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
                      <button type="button" onClick={() => handleDelete("aesthetic", t.id)} className="p-1 hover:bg-zinc-800 text-red-500 rounded transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300 mt-2 whitespace-pre-wrap">{t.content}</p>
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
        </div>
      </div>
    </div>
  );
}