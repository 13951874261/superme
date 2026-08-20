import React, { useState } from 'react';
import { AlertTriangle, Globe, Target, Users, ChevronDown, ChevronUp } from 'lucide-react';
import type { ParsedAiResponse } from '../../services/difyAPI';
import type { SceneEntry, LatestExchange } from './oralWarRoom/types';
import { renderStars, roleNameMatches } from './oralWarRoom/utils';

export interface OralWarRoomSituationPanelProps {
  isContextPanelOpen: boolean;
  activeScene: SceneEntry;
  currentDifficulty: number | null;
  latestExchange: LatestExchange;
  latestFeedback: ParsedAiResponse | null;
}

export default function OralWarRoomSituationPanel({
  isContextPanelOpen,
  activeScene,
  currentDifficulty,
  latestExchange,
  latestFeedback,
}: OralWarRoomSituationPanelProps) {
  // 折叠状态管理
  const [checklistCollapsed, setChecklistCollapsed] = useState(true);
  const [stakeholdersCollapsed, setStakeholdersCollapsed] = useState(true);
  const [culturalCollapsed, setCulturalCollapsed] = useState(true);

  return (
    <aside className={`flex flex-col gap-2 h-full overflow-y-auto ${isContextPanelOpen ? '2xl:col-span-3' : '2xl:col-span-3'}`}>
          <div className="bg-[#202124] text-white rounded-[1.5rem] xl:rounded-[2rem] p-3 xl:p-4 shadow-lg relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-36 h-36 bg-[#FF5722]/15 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-[#FF5722]" /> 当前局势 (Situation)
              </div>
              <h3 className="text-xl font-black leading-tight mb-2">{activeScene.shortTitle}</h3>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {renderStars(currentDifficulty ?? activeScene.level)}
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#FF5722]/20 text-[#FF5722] border border-[#FF5722]/30">
                  {activeScene.tier}
                </span>
                <span className="text-[9px] font-bold text-gray-400">
                  Level {currentDifficulty ?? activeScene.level}/5
                  {currentDifficulty != null && currentDifficulty !== activeScene.level && (
                    <span className="text-amber-400 ml-1">AI→{currentDifficulty}</span>
                  )}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mb-1.5">{activeScene.roleList}</p>
              <p className="text-xs text-gray-300 leading-relaxed">{activeScene.desc}</p>
              <div className="mt-3 pt-3 border-t border-white/10">
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">对话启动句</span>
                <p className="text-[11px] text-[#FF5722]/90 italic leading-relaxed mt-1 line-clamp-3">
                  &ldquo;{latestExchange.aiDialogue || activeScene.openingLine}&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* 沙盘标准结构清单 */}
          <div className="bg-white rounded-[1.5rem] xl:rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setChecklistCollapsed(!checklistCollapsed)}
              className="w-full p-3 xl:p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="text-[9px] font-black uppercase tracking-widest text-[#FF5722] flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> 沙盘结构 CHECKLIST
              </div>
              {checklistCollapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
            </button>

            {!checklistCollapsed && (
              <div className="px-3 xl:px-4 pb-3 xl:pb-4 pt-0 space-y-1.5 text-[10px] border-t border-gray-50">
                {[
                  { label: '场景名称', value: activeScene.shortTitle, ok: true },
                  { label: '角色列表', value: activeScene.roleList, ok: true },
                  { label: '背景信息', value: activeScene.desc.slice(0, 40) + (activeScene.desc.length > 40 ? '…' : ''), ok: true },
                  { label: '冲突点', value: activeScene.conflicts.join(' · '), ok: true },
                  { label: '对话启动句', value: latestExchange.aiDialogue ? 'AI 已开口' : '等待开场', ok: !!latestExchange.aiDialogue },
                  { label: '口答区域', value: latestExchange.userText ? '已回应' : '待回应', ok: !!latestExchange.userText },
                  { label: '后续分支', value: latestExchange.branchSuggestions.length ? `${latestExchange.branchSuggestions.length} 条建议` : '推进中', ok: latestExchange.branchSuggestions.length > 0 },
                  { label: '难度评级', value: `Level ${currentDifficulty ?? activeScene.level}`, ok: true },
                  { label: 'AI 反馈', value: latestFeedback ? '已生成' : '待生成', ok: !!latestFeedback },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${item.ok ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="font-black text-gray-500">{item.label} </span>
                      <span className={`font-medium ${item.ok ? 'text-gray-700' : 'text-gray-400'}`}>{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-[1.5rem] xl:rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden flex-1 flex flex-col min-h-[200px]">
            <button
              onClick={() => setStakeholdersCollapsed(!stakeholdersCollapsed)}
              className="w-full p-3 xl:p-4 flex items-center justify-between hover:bg-gray-50 transition-colors shrink-0"
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-[#202124] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#FF5722]" /> 核心参局者 (Stakeholders)
                {latestExchange.aiSpeaker && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 ml-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-bold text-gray-500">发言中</span>
                  </div>
                )}
              </div>
              {stakeholdersCollapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
            </button>

            {!stakeholdersCollapsed && (
              <div className="px-3 xl:px-4 pb-3 xl:pb-4 pt-0 overflow-y-auto border-t border-gray-50 flex-1">
                {latestExchange.jointPressure && (
                  <div className="mb-3 p-2.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-red-600">联合施压</span>
                      <p className="text-[11px] text-red-700 leading-relaxed mt-0.5">{latestExchange.jointPressure}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {activeScene.allies.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-emerald-600">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" /> 盟友 ({activeScene.allies.length})
                      </div>
                      {activeScene.allies.map(r => {
                        const isSpeaker = roleNameMatches(latestExchange.aiSpeaker, r.name);
                        const isTarget = roleNameMatches(latestExchange.roleAddress, r.name);
                        const showAssist = isSpeaker && latestExchange.isAllyAssist;
                        return (
                          <div
                            key={r.name}
                            className={`rounded-xl p-3 transition-all border ${
                              isSpeaker
                                ? 'border-emerald-400 bg-emerald-50 shadow-[0_0_12px_rgba(16,185,129,0.25)] ring-1 ring-emerald-300'
                                : isTarget
                                  ? 'border-emerald-300 bg-emerald-50 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                                  : 'border-emerald-100 bg-emerald-50/50'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-black text-emerald-900">{r.name}</span>
                                {isSpeaker && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[8px] font-bold animate-pulse">
                                    当前发言
                                  </span>
                                )}
                                {isTarget && !isSpeaker && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-200 text-emerald-700 text-[8px] font-bold">
                                    发言对象
                                  </span>
                                )}
                                {showAssist && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-info)]/15 text-[var(--color-info)] text-[8px] font-bold">
                                    暗中协助
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800 shrink-0">{r.label}</span>
                            </div>
                            <p className="text-[11px] text-emerald-700">{r.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activeScene.blockers.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-red-600">
                        <span className="w-2 h-2 rounded-full bg-red-400" /> 阻力 ({activeScene.blockers.length})
                      </div>
                      {activeScene.blockers.map(r => {
                        const isSpeaker = roleNameMatches(latestExchange.aiSpeaker, r.name);
                        const isTarget = roleNameMatches(latestExchange.roleAddress, r.name);
                        return (
                          <div
                            key={r.name}
                            className={`rounded-xl p-3 transition-all border ${
                              isSpeaker
                                ? 'border-red-400 bg-red-50 shadow-[0_0_12px_rgba(239,68,68,0.25)] ring-1 ring-red-300'
                                : isTarget
                                  ? 'border-red-300 bg-red-50 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                                  : 'border-red-100 bg-red-50/50'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-black text-red-900">{r.name}</span>
                                {isSpeaker && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold animate-pulse">
                                    当前发言
                                  </span>
                                )}
                                {isTarget && !isSpeaker && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-red-200 text-red-700 text-[8px] font-bold">
                                    发言对象
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-200 text-red-800 shrink-0">{r.label}</span>
                            </div>
                            <p className="text-[11px] text-red-700">{r.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activeScene.neutrals.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-600">
                        <span className="w-2 h-2 rounded-full bg-gray-400" /> 中立 ({activeScene.neutrals.length})
                      </div>
                      {activeScene.neutrals.map(r => {
                        const isSpeaker = roleNameMatches(latestExchange.aiSpeaker, r.name);
                        const isTarget = roleNameMatches(latestExchange.roleAddress, r.name);
                        return (
                          <div
                            key={r.name}
                            className={`rounded-xl p-3 transition-all border ${
                              isSpeaker
                                ? 'border-gray-400 bg-gray-50 shadow-[0_0_12px_rgba(107,114,128,0.2)] ring-1 ring-gray-300'
                                : isTarget
                                  ? 'border-gray-300 bg-gray-50 shadow-[0_0_12px_rgba(107,114,128,0.2)]'
                                  : 'border-gray-200 bg-gray-50/50'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-black text-gray-700">{r.name}</span>
                                {isSpeaker && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-gray-500 text-white text-[8px] font-bold animate-pulse">
                                    当前发言
                                  </span>
                                )}
                                {isTarget && !isSpeaker && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 text-[8px] font-bold">
                                    发言对象
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 shrink-0">{r.label}</span>
                            </div>
                            <p className="text-[11px] text-gray-500">{r.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {latestExchange.stanceHistory.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">立场切换</span>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {latestExchange.stanceHistory.map((h, i) => (
                        <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 text-gray-600">
                          {h.speaker} → {h.address}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-brand)]">沟通风格</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {activeScene.culturalContext.includes('Direct') && !activeScene.culturalContext.includes('委婉') ? '🔴 直接型 — 开门见山，明确表达立场' :
                     activeScene.culturalContext.includes('委婉') || activeScene.culturalContext.includes('High-context') ? '🟡 委婉型 — 察言观色，意在言外' :
                     '🟢 平衡型 — 根据语境调整表达方式'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 跨文化语境预警 - 折叠面板 */}
          {activeScene.culturalContext && (
            <div className="bg-[var(--color-accent)]/5 rounded-[1.5rem] xl:rounded-[2rem] border border-[var(--color-accent)]/20 shadow-sm overflow-hidden">
              <button
                onClick={() => setCulturalCollapsed(!culturalCollapsed)}
                className="w-full p-3 xl:p-4 flex items-center justify-between hover:bg-[var(--color-accent)]/10 transition-colors"
              >
                <h3 className="text-sm font-black text-[var(--color-brand)] uppercase tracking-widest flex items-center">
                  <Globe className="w-4 h-4 mr-2" /> 跨文化预警 (Cultural Context)
                </h3>
                {culturalCollapsed ? <ChevronDown className="w-4 h-4 text-[var(--color-ink-muted)]" /> : <ChevronUp className="w-4 h-4 text-[var(--color-ink-muted)]" />}
              </button>

              {!culturalCollapsed && (
                <div className="px-3 xl:px-4 pb-3 xl:pb-4 pt-0 border-t border-[var(--color-accent)]/20">
                  <p className="text-sm text-[var(--color-brand)] leading-relaxed font-medium">{activeScene.culturalContext}</p>
                  {latestExchange.culturalSignal && (
                    <p className="mt-3 pt-3 border-t border-[var(--color-accent)]/25 text-xs text-[var(--color-ink-secondary)]">
                      <span className="font-black text-[var(--color-accent)]">实时信号 · </span>{latestExchange.culturalSignal}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 跨文化雷达 */}
          <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-3xl p-4 border border-gray-200 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-600 mb-3 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> 跨文化雷达
            </h3>
            <div className="space-y-2">
              {[
                { label: '直接 vs 委婉', value: activeScene.culturalContext?.includes('Direct') ? 80 : activeScene.culturalContext?.includes('委婉') ? 20 : 50, color: 'bg-blue-500' },
                { label: '权力距离', value: activeScene.culturalContext?.includes('Hierarchy') || activeScene.culturalContext?.includes('等级') ? 85 : 50, color: 'bg-amber-500' },
                { label: '不确定性规避', value: activeScene.culturalContext?.includes('合规') || activeScene.culturalContext?.includes('Regulation') ? 80 : 50, color: 'bg-emerald-500' },
              ].map((dim, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-500 w-24 shrink-0">{dim.label}</span>
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full ${dim.color} rounded-full transition-all duration-500`} style={{ width: `${dim.value}%` }} />
                  </div>
                  <span className="text-[10px] font-black text-gray-600 w-8 text-right">{dim.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* 战场动态情报 */}
          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">冲突点</div>
            <div className="flex flex-wrap gap-2">
              {activeScene.conflicts.map(c => (
                <span key={c} className="px-3 py-1 rounded-full bg-[#FF5722]/10 text-[#FF5722] text-[11px] font-black uppercase tracking-widest">{c}</span>
              ))}
            </div>
          </div>
    </aside>
  );
}
