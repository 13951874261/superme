import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Target, AlertTriangle, Globe, ChevronRight, ClipboardList } from 'lucide-react';
import type { BreakthroughRecord, SceneEntry } from './oralWarRoom/types';

interface Props {
  scene: SceneEntry | null;
  breakthroughRecords: BreakthroughRecord[];
  sessionNotes: string;
  onNotesChange: (notes: string) => void;
  onClose: () => void;
  activeTab: 'relations' | 'breakthroughs' | 'notes';
  onTabChange: (tab: 'relations' | 'breakthroughs' | 'notes') => void;
}

const TAB_CONFIG = {
  relations: { label: '角色关系', icon: Target, color: 'text-[var(--color-accent)]' },
  breakthroughs: { label: '漏洞审计', icon: ClipboardList, color: 'text-amber-500' },
  notes: { label: '会话笔记', icon: BookOpen, color: 'text-[var(--color-accent)]' },
};

const TYPE_CONFIG = {
  logic: { label: '逻辑漏洞', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  fact: { label: '事实矛盾', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  intent: { label: '意图避重', color: 'text-[var(--color-accent)]', bg: 'bg-[var(--color-accent)]/10', border: 'border-[var(--color-accent)]/25' },
};

export default function OralWarRoomContextPanel({
  scene,
  breakthroughRecords,
  sessionNotes,
  onNotesChange,
  onClose,
  activeTab,
  onTabChange,
}: Props) {
  if (!scene) return null;

  const correctCount = breakthroughRecords.filter(r => r.correct).length;
  const accuracy = breakthroughRecords.length
    ? Math.round((correctCount / breakthroughRecords.length) * 100)
    : 0;

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: '100%', opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="h-full flex flex-col overflow-hidden spotlight-border rounded-2xl bg-white"
    >
      <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-canvas)]/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[var(--color-accent)]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-ink-muted)]">上下文</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] transition-colors cursor-pointer text-[11px] font-bold"
          >
            收起 ×
          </button>
        </div>

        <div className="flex gap-1">
          {(Object.keys(TAB_CONFIG) as Array<keyof typeof TAB_CONFIG>).map((tab) => {
            const { label, icon: Icon } = TAB_CONFIG[tab];
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer
                  ${isActive
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'bg-transparent text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)]'
                  }`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'relations' && (
            <motion.div
              key="relations"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="space-y-5"
            >
              <section>
                <div className="flex items-center gap-1.5 mb-2">
                  <Globe className="w-3 h-3 text-blue-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-ink-muted)]">文化注释</span>
                </div>
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                  <p className="text-[10px] text-[var(--color-ink-secondary)] leading-relaxed italic">{scene.culturalContext}</p>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-1.5 mb-2">
                  <Target className="w-3 h-3 text-[var(--color-accent)]" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-ink-muted)]">角色关系</span>
                </div>
                <div className="space-y-2">
                  {scene.allies.map((role, idx) => (
                    <motion.div
                      key={`ally-${role.name}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.08 }}
                      className="flex items-start gap-2 p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      <div>
                        <span className="text-[10px] font-bold text-emerald-700">{role.name}</span>
                        <span className="text-[9px] text-emerald-500 ml-1">友</span>
                        <p className="text-[9px] text-[var(--color-ink-muted)] mt-0.5 leading-relaxed">{role.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                  {scene.blockers.map((role, idx) => (
                    <motion.div
                      key={`blocker-${role.name}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (scene.allies.length + idx) * 0.08 }}
                      className="flex items-start gap-2 p-2.5 bg-red-50/60 rounded-xl border border-red-100"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                      <div>
                        <span className="text-[10px] font-bold text-red-700">{role.name}</span>
                        <span className="text-[9px] text-red-500 ml-1">阻</span>
                        <p className="text-[9px] text-[var(--color-ink-muted)] mt-0.5 leading-relaxed">{role.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                  {scene.neutrals.map((role, idx) => (
                    <motion.div
                      key={`neutral-${role.name}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (scene.allies.length + scene.blockers.length + idx) * 0.08 }}
                      className="flex items-start gap-2 p-2.5 bg-slate-50/60 rounded-xl border border-slate-100"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                      <div>
                        <span className="text-[10px] font-bold text-slate-600">{role.name}</span>
                        <span className="text-[9px] text-slate-400 ml-1">中</span>
                        <p className="text-[9px] text-[var(--color-ink-muted)] mt-0.5 leading-relaxed">{role.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-ink-muted)]">核心冲突</span>
                </div>
                <div className="space-y-1.5">
                  {scene.conflicts.map((conflict) => (
                    <div key={conflict} className="flex items-center gap-2">
                      <ChevronRight className="w-3 h-3 text-amber-400" />
                      <span className="text-[10px] text-[var(--color-ink-secondary)]">{conflict}</span>
                    </div>
                  ))}
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'breakthroughs' && (
            <motion.div
              key="breakthroughs"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-3"
            >
              {breakthroughRecords.length > 0 && (
                <div className="text-[9px] font-black text-[var(--color-ink-muted)] mb-2">
                  正确率 {accuracy}% · {correctCount}/{breakthroughRecords.length}
                </div>
              )}
              {breakthroughRecords.length === 0 ? (
                <div className="text-center py-8">
                  <ClipboardList className="w-8 h-8 text-[var(--color-ink-muted)] mx-auto mb-2" />
                  <p className="text-[10px] text-[var(--color-ink-muted)]">暂无漏洞记录</p>
                  <p className="text-[9px] text-[var(--color-ink-muted)]/60 mt-1">在 AI 回复中划词并标记漏洞类型</p>
                </div>
              ) : (
                breakthroughRecords.map((record, idx) => {
                  const typeConfig = TYPE_CONFIG[record.type];
                  return (
                    <motion.div
                      key={record.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`p-3 rounded-xl border ${typeConfig.bg} ${typeConfig.border}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[9px] font-black ${typeConfig.color}`}>{typeConfig.label}</span>
                        <span className={`text-[9px] font-black ${record.correct ? 'text-emerald-600' : 'text-red-600'}`}>
                          {record.correct ? '✓ 正确' : '✗ 错误'}
                        </span>
                      </div>
                      <p className="text-[10px] text-[var(--color-ink-secondary)] italic truncate">&ldquo;{record.text}&rdquo;</p>
                      <p className="text-[9px] text-[var(--color-ink-muted)] mt-1">
                        {new Date(record.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}

          {activeTab === 'notes' && (
            <motion.div
              key="notes"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen className="w-3 h-3 text-[var(--color-accent)]" />
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-ink-muted)]">我的笔记</span>
              </div>
              <textarea
                value={sessionNotes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="记录关键论点、文化差异或待跟进事项..."
                rows={12}
                className="w-full p-3 text-[10px] text-[var(--color-ink-secondary)] bg-[var(--color-canvas)]/50 rounded-xl border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)] resize-none leading-relaxed placeholder:text-[var(--color-ink-muted)]"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
