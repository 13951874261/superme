import React, { useState, useEffect } from 'react';
import Header from './Header';
import ListenModule from './modules/ListenModule';
import SpeakModule from './modules/SpeakModule';
import ReadModule from './modules/ReadModule';
import WriteModule from './modules/WriteModule';
import EnglishModule from './modules/EnglishModule';
import EntertainmentModule from './modules/EntertainmentModule';
import GameTheoryModule from './modules/GameTheoryModule';
import SummaryArea from './SummaryArea';
import CollapsiblePanel from './CollapsiblePanel';
import { Headphones, Mic, BookOpen, PenTool, Globe, Coffee, Target, Sparkles, History, Database, LibraryBig, FileText } from 'lucide-react';
import { createMaterialIngestJob, generateMaterialSummary, getTrainingSessionByDate, listKnowledgeNodes, listMaterialIngestJobs, syncMaterialDifyStatus, uploadMaterialDocument } from '../services/trainingAPI';
import { getTodayDateDot } from '../utils/date';

interface MainContentProps {
  selectedDate?: string;
}

export default function MainContent({ selectedDate = getTodayDateDot() }: MainContentProps) {
  // 判断当前选中的日期是否为 "今天"
  const isHistorical = selectedDate !== getTodayDateDot();
  
  // 用于点击日期切换时，主屏幕重设造成的数据冲刷动画特效
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sessionData, setSessionData] = useState<any | null>(null);
  const [knowledgeNodes, setKnowledgeNodes] = useState<any[]>([]);
  const [materialJobs, setMaterialJobs] = useState<any[]>([]);
  const [materialName, setMaterialName] = useState('');
  const [materialTopic, setMaterialTopic] = useState('');
  const [materialText, setMaterialText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [materialSubmitting, setMaterialSubmitting] = useState(false);
  const [materialError, setMaterialError] = useState('');
  const [autoTriggerAfterUpload, setAutoTriggerAfterUpload] = useState(true);
  const [selectedKnowledgeNode, setSelectedKnowledgeNode] = useState<any | null>(null);
  const [selectedTrainingHistory, setSelectedTrainingHistory] = useState<any | null>(null);
  const [selectedMaterialJob, setSelectedMaterialJob] = useState<any | null>(null);
  const [materialDrawerCollapsed, setMaterialDrawerCollapsed] = useState(false);
  const [materialInputExpanded, setMaterialInputExpanded] = useState(false);
  const [materialViewMode, setMaterialViewMode] = useState<'card' | 'list'>('list');
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialActionMode, setMaterialActionMode] = useState<'update' | 'delete' | null>(null);
  const [materialActionTarget, setMaterialActionTarget] = useState<any | null>(null);
  const [materialUpdateText, setMaterialUpdateText] = useState('');
  const [materialUpdateFiles, setMaterialUpdateFiles] = useState<File[]>([]);
  const [materialUpdateSubmitting, setMaterialUpdateSubmitting] = useState(false);

  
  useEffect(() => {
    setIsRefreshing(true);
    const timer = setTimeout(() => setIsRefreshing(false), 400); // 400ms loading effect
    return () => clearTimeout(timer);
  }, [selectedDate]);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const data = await getTrainingSessionByDate({
          userId: 'default-user',
          trainingDate: selectedDate,
        });
        setSessionData(data);
      } catch {
        setSessionData(null);
      }
    };
    const loadKnowledge = async () => {
      try {
        const nodes = await listKnowledgeNodes('default-user', selectedMaterialJob?.id || '');
        setKnowledgeNodes(nodes.slice(0, 6));
      } catch {
        setKnowledgeNodes([]);
      }
    };
    const loadMaterials = async () => {
      try {
        const jobs = await listMaterialIngestJobs('default-user');
        setMaterialJobs(jobs.slice(0, 4));
      } catch {
        setMaterialJobs([]);
      }
    };
    loadSession();
    loadKnowledge();
    loadMaterials();
  }, [selectedDate, selectedMaterialJob?.id]);

  const latestListenAttempt = sessionData?.attempts?.find((a: any) => a.module_type === 'listen') || null;
  const latestListenKnowledgeNode = knowledgeNodes.find((node: any) => node.module_name === 'listen') || null;

  const handleCreateMaterial = async () => {
    const hasText = materialText.trim().length > 0;
    const hasFile = attachedFiles.length > 0;
    if (!materialName.trim() && !hasText && !hasFile) return;
    setMaterialSubmitting(true);
    setMaterialError('');
    try {
      let materialId = '';
      if (hasFile) {
        const file = attachedFiles[0];
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        bytes.forEach((b) => { binary += String.fromCharCode(b); });
        const base64Content = btoa(binary);
        const uploadRes = await uploadMaterialDocument({
          userId: 'default-user',
          sourceName: materialName.trim() || file.name,
          topic: materialTopic.trim(),
          fileName: file.name,
          mimeType: file.type,
          base64Content,
        });
        materialId = uploadRes.materialId;
      } else {
        const createRes = await createMaterialIngestJob({
          userId: 'default-user',
          sourceType: 'text',
          sourceName: materialName.trim() || '未命名资料',
          sourceText: materialText.trim(),
          topic: materialTopic.trim(),
        });
        materialId = createRes.materialId;
      }
      setMaterialName('');
      setMaterialTopic('');
      setMaterialText('');
      setAttachedFiles([]);
      if (autoTriggerAfterUpload && materialId) {
        await generateMaterialSummary(materialId);
      }
      const jobs = await listMaterialIngestJobs('default-user');
      setMaterialJobs(jobs.slice(0, 4));
    } catch (e) {
      setMaterialError(e instanceof Error ? e.message : '资料创建失败');
    } finally {
      setMaterialSubmitting(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachedFiles(files.slice(0, 5));
  };

  const extractStructuredSections = (summaryJson: Record<string, unknown> | string) => {
    const cleanText = (value: unknown) => String(value ?? '')
      .replace(/^\s*["']+/, '')
      .replace(/["']+\s*$/, '')
      .replace(/^\s*[,，；;]+\s*$/, '')
      .replace(/^\s*[-•]+\s*/g, '')
      .trim();

    const stripCodeFence = (text: string) => {
      if (!text.startsWith('```')) return text;
      const lines = text.split('\n');
      if (lines.length && lines[0].startsWith('```')) lines.shift();
      if (lines.length && lines[lines.length - 1].trim() === '```') lines.pop();
      return lines.join('\n').trim();
    };

    const extractJsonText = (value: unknown) => {
      if (typeof value !== 'string') return value;
      const text = stripCodeFence(value.trim());
      if (!text) return value;
      if (text.startsWith('{') || text.startsWith('[')) return text;
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1).trim();
      const arrStart = text.indexOf('[');
      const arrEnd = text.lastIndexOf(']');
      if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) return text.slice(arrStart, arrEnd + 1).trim();
      return text;
    };

    const tryParseJson = (value: unknown) => {
      if (typeof value !== 'string') return value;
      const text = extractJsonText(value);
      if (typeof text !== 'string') return text;
      if (!text) return value;
      if (!text.startsWith('{') && !text.startsWith('[')) return value;
      try { return JSON.parse(text); } catch { return value; }
    };

    const resolveCandidate = (value: unknown): unknown => {
      const parsed = tryParseJson(value);
      if (typeof parsed === 'string') {
        const cleaned = cleanText(parsed);
        const reparsed = tryParseJson(cleaned);
        return reparsed === cleaned ? cleaned : resolveCandidate(reparsed);
      }
      if (Array.isArray(parsed)) return parsed.map((item) => resolveCandidate(item));
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        return Object.fromEntries(Object.entries(obj).map(([key, val]) => [key, resolveCandidate(val)]));
      }
      return parsed;
    };

    const root = resolveCandidate(typeof summaryJson === 'string' ? tryParseJson(summaryJson) : summaryJson) || {};

    const deepGet = (obj: unknown, path: string[]): unknown => {
      let cur: any = obj;
      for (const key of path) {
        if (!cur || typeof cur !== 'object') return undefined;
        cur = cur[key];
      }
      return cur;
    };

    const resolvePayloadRoot = (obj: unknown): any => {
      const candidates = [
        ['workflowRun', 'data', 'outputs', 'result', 'result'],
        ['workflowRun', 'data', 'outputs', 'result'],
        ['data', 'outputs', 'result', 'result'],
        ['data', 'outputs', 'result'],
        ['outputs', 'result', 'result'],
        ['outputs', 'result'],
        ['result', 'result'],
        ['result_json'],
        ['result'],
        ['output'],
        ['data'],
        ['overview'],
      ];

      for (const path of candidates) {
        const candidate = deepGet(obj, path);
        const parsed = resolveCandidate(candidate);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const keys = Object.keys(parsed as Record<string, unknown>);
          if (keys.some((k) => ['summary', 'overview', 'key_points', 'common_mistakes', 'suggested_actions', 'keywords', 'title'].includes(k))) {
            return parsed;
          }
        }
      }

      return obj;
    };

    const raw = resolvePayloadRoot(root) as Record<string, unknown>;
    const extractFinalObject = (value: unknown, depth = 0): Record<string, unknown> | null => {
      if (depth > 8) return null;
      const parsed = resolveCandidate(value);
      if (!parsed) return null;

      if (typeof parsed === 'string') {
        const text = cleanText(parsed);
        const jsonLike = tryParseJson(text);
        if (jsonLike && typeof jsonLike === 'object' && !Array.isArray(jsonLike)) {
          return extractFinalObject(jsonLike, depth + 1);
        }
        if (typeof jsonLike === 'string' && jsonLike !== text) {
          return extractFinalObject(jsonLike, depth + 1);
        }
        return null;
      }

      if (Array.isArray(parsed)) return null;
      if (typeof parsed !== 'object') return null;

      const obj = parsed as Record<string, unknown>;
      const structuralKeys = ['title', 'overview', 'key_points', 'common_mistakes', 'suggested_actions', 'keywords'];
      const hasStructure = structuralKeys.some((key) => Object.prototype.hasOwnProperty.call(obj, key));

      if (hasStructure) {
        const nestedCandidates = [obj.result, obj.workflowRun?.data?.outputs?.result, obj.data?.outputs?.result, obj.outputs?.result];
        for (const candidate of nestedCandidates) {
          const nested = extractFinalObject(candidate, depth + 1);
          if (nested) {
            const merged = { ...obj, ...nested };
            return merged;
          }
        }
        return obj;
      }

      const nextCandidates = [obj.result, obj.workflowRun?.data?.outputs?.result, obj.data?.outputs?.result, obj.outputs?.result, obj.result_json, obj.output, obj.data, obj.overview];
      for (const candidate of nextCandidates) {
        const nested = extractFinalObject(candidate, depth + 1);
        if (nested) return nested;
      }

      return null;
    };

    const payload = extractFinalObject(raw?.result) || extractFinalObject(raw) || raw;
    const pick = (...keys: string[]) => {
      for (const key of keys) {
        const val = resolveCandidate((payload as Record<string, unknown>)[key]);
        if (typeof val === 'string' && cleanText(val)) return val;
      }
      return undefined;
    };
    const arrays = (...keys: string[]) => {
      for (const key of keys) {
        const val = resolveCandidate((payload as Record<string, unknown>)[key]);
        if (Array.isArray(val)) return val;
      }
      return undefined;
    };
    const listify = (...keys: string[]) => (arrays(...keys) || []).map((v) => cleanText(v)).filter(Boolean);

    const summary = cleanText(pick('overview', 'summary', 'abstract', 'text') || '');
    return {
      title: cleanText(pick('title', 'doc_title', 'name') || 'Dify 消化结果'),
      overview: summary,
      keyPoints: listify('key_points', 'points', 'highlights'),
      mistakes: listify('common_mistakes', 'mistakes', 'pitfalls'),
      actions: listify('suggested_actions', 'actions', 'next_steps'),
      keywords: listify('keywords', 'tags', 'terms').length > 0
        ? listify('keywords', 'tags', 'terms')
        : (() => {
            const fallback = [pick('title', 'doc_title', 'name'), summary]
              .filter(Boolean)
              .join(' ')
              .split(/\s+/)
              .map((item) => cleanText(item))
              .filter(Boolean);
            return Array.from(new Set(fallback)).slice(0, 6);
          })(),
    };
  };

  const getKnowledgeTrainingHistory = (node: any) => {
    const history = node?.extra_json?.training_history || node?.training_history || [];
    return Array.isArray(history) ? history : [];
  };

  const formatTs = (value: number | string | null | undefined) => {
    const ts = Number(value || 0);
    if (!ts) return '未知';
    const ms = ts < 1000000000000 ? ts * 1000 : ts;
    return new Date(ms).toLocaleString();
  };

  const renderSectionCards = (summaryJson: Record<string, unknown>) => {
    const structured = extractStructuredSections(summaryJson);
    const normalizeText = (value: string) => String(value || '')
      .replace(/[；;]+\s*/g, '。')
      .replace(/[。．.]+\s*/g, '。')
      .replace(/\s*。\s*/g, '。')
      .replace(/。+/g, '。')
      .replace(/[。．.]+$/g, '')
      .trim();
    const splitSentences = (value: string) => normalizeText(value)
      .split(/。+/)
      .map((item) => item.trim())
      .filter(Boolean);
    const sections = [
      { label: '核心摘要', items: splitSentences(structured.overview) },
      { label: '关键要点', items: structured.keyPoints.map((item) => normalizeText(item)).filter(Boolean) },
      { label: '易错点', items: structured.mistakes.map((item) => normalizeText(item)).filter(Boolean) },
      { label: '下一步行动', items: structured.actions.map((item) => normalizeText(item)).filter(Boolean) },
      { label: '关键词', items: structured.keywords.map((item) => normalizeText(item)).filter(Boolean) },
    ].filter((section) => section.items.length > 0);

    if (!sections.length) {
      return <div className="text-xs text-gray-400 leading-6">暂无结构化结果，等待 Dify 消化返回。</div>;
    }

    return (
      <div className="space-y-3 mt-3">
        <div className="rounded-2xl bg-white border border-gray-100 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black mb-2">标题</div>
          <div className="text-sm font-black text-[#202124] leading-6">{structured.title}</div>
        </div>
        {sections.map((section) => (
          <div key={section.label} className="rounded-2xl bg-white border border-gray-100 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black mb-3">{section.label}</div>
            <div className="space-y-2">
              {section.items.map((item, idx) => (
                <div key={`${section.label}-${idx}`} className="rounded-xl bg-[#fafafa] border border-gray-100 px-3 py-2 text-xs leading-6 text-gray-700 whitespace-pre-wrap">
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
        {structured.keywords.length > 0 && (
          <div className="rounded-2xl bg-white border border-gray-100 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black mb-3">关键词</div>
            <div className="flex flex-wrap gap-2">
              {structured.keywords.map((item, idx) => (
                <span key={`keyword-${idx}`} className="rounded-full bg-[#e8f0fe] text-[#1a73e8] px-3 py-1 text-[11px] font-black tracking-[0.08em]">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFeedbackCards = (history: any) => {
    const decomposition = history?.decomposition_json || history?.decomposition || {};
    const logicAnalysis = history?.logic_analysis_json || history?.logicAnalysis || {};
    const cards = [
      { label: '优点', content: history?.strengths },
      { label: '不足', content: history?.weaknesses },
      { label: '下一步', content: history?.nextFocus },
      { label: '逻辑分析', content: typeof logicAnalysis === 'object' ? JSON.stringify(logicAnalysis, null, 2) : String(logicAnalysis || '') },
      { label: '结构拆解', content: typeof decomposition === 'object' ? JSON.stringify(decomposition, null, 2) : String(decomposition || '') },
    ].filter((card) => card.content && String(card.content).trim());

    if (!cards.length) {
      return <div className="text-sm text-gray-400">暂无反馈结构化内容</div>;
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black mb-2">{card.label}</div>
            <div className="text-sm text-[#202124] leading-7 whitespace-pre-wrap">{card.content as string}</div>
          </div>
        ))}
      </div>
    );
  };

  const getJobStatusMeta = (job: any) => {
    const status = String(job?.status || '').toLowerCase();
    if (status === 'processed') {
      return {
        label: '已完成',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
        description: '知识库处理已完成，可用于后续检索与总结',
      };
    }
    if (status === 'failed') {
      return {
        label: '处理失败',
        className: 'bg-red-50 text-red-700 border-red-200',
        dot: 'bg-red-500',
        description: '处理失败，请查看错误原因',
      };
    }
    if (status === 'processing') {
      return {
        label: '处理中',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500 animate-pulse',
        description: '正在送往 Dify 处理，请稍候',
      };
    }
    return {
      label: job?.status || 'pending',
      className: 'bg-slate-50 text-slate-600 border-slate-200',
      dot: 'bg-slate-400',
      description: '等待处理',
    };
  };

  const renderDifyStatusCard = (job: any) => {
    const structuredSource = job?.workflowRun?.data?.outputs?.result
      || job?.workflow_run?.data?.outputs?.result
      || job?.workflowRun?.data?.outputs
      || job?.workflow_run?.data?.outputs
      || job?.summary_json
      || {};
    const structured = extractStructuredSections(structuredSource);
    const meta = getJobStatusMeta(job);
    const debugText = typeof structuredSource === 'string' ? structuredSource : JSON.stringify(structuredSource, null, 2);
    return (
      <div className="mt-3 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#202124] font-black">Dify 文档状态</div>
          </div>
          <span className={`text-[10px] px-3 py-1 rounded-full border font-black ${meta.className}`}>{meta.label}</span>
        </div>
        <div className="text-xs text-gray-500 mb-3">{meta.description}</div>
        <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
          <div className="rounded-xl bg-[#fafafa] px-3 py-2">分段数：{job.dify_segment_count ?? 0}</div>
          <div className="rounded-xl bg-[#fafafa] px-3 py-2">字数：{job.dify_word_count ?? 0}</div>
          <div className="rounded-xl bg-[#fafafa] px-3 py-2">语言：{job.dify_doc_language || '未知'}</div>
          <div className="rounded-xl bg-[#fafafa] px-3 py-2">Batch：{job.dify_batch_id || '—'}</div>
        </div>
        {job.error_message && (
          <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 leading-6">
            错误原因：{job.error_message}
          </div>
        )}
        <div className="mt-3 rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-blue-500 font-black mb-2">调试展示 workflowRun.data.outputs.result</div>
          <pre className="text-[10px] leading-5 text-blue-900 whitespace-pre-wrap break-all max-h-56 overflow-auto">{debugText}</pre>
        </div>

      </div>
    );
  };

  const materialList = materialJobs.map((job: any) => ({
    ...job,
    summary_json: job.workflowRun?.data?.outputs?.result || job.workflow_run?.data?.outputs?.result || job.summary_json || {},
  }));

  const refreshMaterials = async () => {
    const jobs = await listMaterialIngestJobs('default-user');
    setMaterialJobs(jobs.slice(0, 4));
    return jobs;
  };

  const handleGenerateSummary = async (materialId: string) => {
    setMaterialError('');
    try {
      await generateMaterialSummary(materialId);
      await refreshMaterials();
    } catch (e) {
      setMaterialError(e instanceof Error ? e.message : '生成摘要失败');
    }
  };

  const openMaterialActionDrawer = (material: any, mode: 'update' | 'delete') => {
    if (!material?.id) return;
    setMaterialActionTarget(material);
    setMaterialActionMode(mode);
    setSelectedMaterialJob(material);
    setSelectedKnowledgeNode(null);
    if (mode === 'update') {
      setMaterialUpdateText(material.source_text || '');
      setMaterialUpdateFiles([]);
    }
  };

  const closeMaterialActionDrawer = () => {
    setMaterialActionMode(null);
    setMaterialActionTarget(null);
    setMaterialUpdateText('');
    setMaterialUpdateFiles([]);
  };

  const handleMaterialUpdateFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setMaterialUpdateFiles(files.slice(0, 1));
  };

  const submitMaterialUpdate = async () => {
    if (!materialActionTarget?.id) return;
    setMaterialUpdateSubmitting(true);
    setMaterialError('');
    try {
      if (materialUpdateFiles.length > 0) {
        const file = materialUpdateFiles[0];
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        bytes.forEach((b) => { binary += String.fromCharCode(b); });
        const base64Content = btoa(binary);
        await fetch(`/api/material/${encodeURIComponent(materialActionTarget.id)}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'file', fileName: file.name, mimeType: file.type, base64Content, sourceName: materialActionTarget.source_name, topic: materialActionTarget.topic || '' }),
        });
      } else {
        await fetch(`/api/material/${encodeURIComponent(materialActionTarget.id)}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'text', sourceText: materialUpdateText, sourceName: materialActionTarget.source_name, topic: materialActionTarget.topic || '' }),
        });
      }
      const jobs = await listMaterialIngestJobs('default-user');
      setMaterialJobs(jobs.slice(0, 4));
      const nodes = await listKnowledgeNodes('default-user', selectedMaterialJob?.id || '');
      setKnowledgeNodes(nodes.slice(0, 6));
      closeMaterialActionDrawer();
    } catch (e) {
      setMaterialError(e instanceof Error ? e.message : '更新资料失败');
    } finally {
      setMaterialUpdateSubmitting(false);
    }
  };

  const confirmDeleteMaterial = async () => {
    if (!materialActionTarget?.id) return;
    setMaterialError('');
    try {
      await fetch(`/api/material/${encodeURIComponent(materialActionTarget.id)}`, { method: 'DELETE' });
      const jobs = await listMaterialIngestJobs('default-user');
      setMaterialJobs(jobs.slice(0, 4));
      setSelectedMaterialJob(null);
      setSelectedKnowledgeNode(null);
      const nodes = await listKnowledgeNodes('default-user', '');
      setKnowledgeNodes(nodes.slice(0, 6));
      closeMaterialActionDrawer();
    } catch (e) {
      setMaterialError(e instanceof Error ? e.message : '删除资料失败');
    }
  };

  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;
    const pollingTargetIds = materialJobs
      .filter((job) => ['pending', 'processing'].includes(String(job.status)))
      .map((job) => job.id)
      .slice(0, 3);

    if (!pollingTargetIds.length) return;

    const poll = async (attempt = 0) => {
      if (stopped || attempt >= 12) return;
      try {
        let changed = false;
        for (const id of pollingTargetIds) {
          const result = await syncMaterialDifyStatus(id);
          if (result?.success) changed = true;
        }
        if (changed) {
          await refreshMaterials();
        }
      } catch {
        // 轮询失败不打断整体流程，下一轮继续
      } finally {
        if (!stopped) {
          timer = window.setTimeout(() => poll(attempt + 1), 5000);
        }
      }
    };

    timer = window.setTimeout(() => poll(0), 3000);
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [materialJobs]);



  const filteredMaterialList = materialJobs.filter((job: any) => String(job.source_name || '').toLowerCase().includes(materialSearch.trim().toLowerCase()));

  return (
    <main id="main-content" className="flex-1 flex flex-col h-screen overflow-y-auto bg-[#fafafa] relative scroll-smooth font-sans">
      <Header />
      
      <div className="px-5 md:px-8 lg:px-10 xl:px-12 2xl:px-16 mx-auto w-full max-w-[1680px] 2xl:max-w-[1760px] pt-10 pb-24">
        {/* 如果点击了非当天的日期，顶部降维弹出档案查阅模式警示带 */}
        <div className={`transition-all duration-500 ease-in-out flex justify-center ${isHistorical ? 'mb-6 opacity-100 max-h-20' : 'mb-0 opacity-0 max-h-0 overflow-hidden'}`}>
           <div className="bg-[#202124] text-white px-5 py-2.5 rounded-full flex items-center shadow-[0_4px_16px_rgba(32,33,36,0.2)] border border-gray-700 w-max">
             <History className="w-4 h-4 mr-2 text-amber-500 animate-spin-reverse-slow" />
             <span className="text-[11px] font-bold tracking-[0.1em] uppercase">
               沉浸式档案查阅提取：当前正在剖析 <span className="text-[#FF5722] mx-1 text-xs border-b border-[#FF5722]">{selectedDate}</span> 的对弈数据沙盘
             </span>
           </div>
        </div>

        {/* 全局大进度条 - Blogger极简风格，增加过去日期的区分变异表现色 */}
        <div className={`mb-14 bg-white p-8 rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border ${isHistorical ? 'border-amber-100' : 'border-gray-100'} flex items-center justify-between relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-500 max-w-none w-full`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FF5722]/5 to-transparent rounded-bl-[100px] -z-10 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="flex-1 mr-12">
            <h2 className="text-sm font-black text-gray-400 tracking-[0.2em] uppercase mb-4 flex items-center">
              <Sparkles className={`w-4 h-4 mr-2 ${isHistorical ? 'text-amber-500' : 'text-[#FF5722]'}`} />
              {isHistorical ? '全维攻克记录 / ARCHIVED SPRINT' : '今日核心主线 / DAILY SPRINT'}
            </h2>
            <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out relative ${isHistorical ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-[#FF9800] to-[#FF5722]'}`} 
                style={{ width: isHistorical ? '100%' : '40%' }}
              >
                <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/30 animate-pulse"></div>
              </div>
            </div>
          </div>
          <div className="text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-[#202124] to-[#5f6368]">
            {isHistorical ? '100' : '40'}<span className="text-3xl text-gray-400 font-bold ml-1">%</span>
          </div>
        </div>

        {/* 资料区总控台：统一入口 + 任务 + 知识点 */}
        <section className="mb-10 w-full bg-white rounded-[2rem] border border-gray-100 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.18)] overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-white via-[#fff8f5] to-white">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-black mb-1">MATERIAL CONTROL CONSOLE</div>
              <div className="text-xl font-black text-[#202124]">资料区总控台</div>
            </div>
            <button onClick={() => setMaterialDrawerCollapsed((v) => !v)} className="rounded-full bg-[#f3f4f6] px-4 py-2 text-sm font-black text-[#202124] hover:bg-[#e5e7eb]">{materialDrawerCollapsed ? '展开 ▼' : '收起 ▲'}</button>
          </div>
          {!materialDrawerCollapsed && (
            <div className="p-5 lg:p-6 space-y-5">
              <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5">
                <div className="rounded-[1.75rem] border border-gray-100 bg-[#fafafa] p-5">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-black mb-2">MATERIAL INPUT</div>
                      <h3 className="text-2xl font-black text-[#202124] flex items-center gap-3"><FileText className="w-6 h-6 text-[#FF5722]" />资料导入入口</h3>
                    </div>
                    <button onClick={() => setMaterialInputExpanded((v) => !v)} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-black text-[#202124] hover:border-[#FF5722] hover:text-[#FF5722]">{materialInputExpanded ? '隐藏 ▲' : '展开 ▼'}</button>
                  </div>
                  {materialInputExpanded && (
                    <>
                      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <input value={materialName} onChange={(e) => setMaterialName(e.target.value)} className="w-full rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm outline-none" placeholder="资料名称，例如：海外信贷谈判笔记" />
                        <input value={materialTopic} onChange={(e) => setMaterialTopic(e.target.value)} className="w-full rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm outline-none" placeholder="主题，例如：跨国企业职场博弈" />
                      </div>
                      <div className="mt-4 rounded-3xl border border-dashed border-gray-200 bg-white px-4 py-4 space-y-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black mb-1">FILE UPLOAD</div>
                            <div className="text-sm text-[#202124] font-bold">文件上传入口</div>
                          </div>
                          <label className="cursor-pointer rounded-full bg-white border border-gray-200 px-4 py-2 text-xs font-black tracking-widest uppercase text-[#202124] hover:border-[#FF5722] hover:text-[#FF5722]">
                            选择文件
                            <input type="file" multiple accept=".txt,.md,.markdown,.json,.pdf" className="hidden" onChange={handleFileChange} />
                          </label>
                        </div>
                        <div className="text-xs text-gray-500 leading-6 flex items-center justify-between gap-3 flex-wrap"><span>支持 `.txt`、`.md`、`.json`、`.pdf`。上传后可自动生成摘要，也可先只保存任务。</span></div>
                        {attachedFiles.length > 0 && (<div className="flex flex-wrap gap-2">{attachedFiles.map((file) => (<span key={file.name} className="text-[11px] px-3 py-1 rounded-full bg-[#fafafa] border border-gray-200 text-gray-600">{file.name}</span>))}</div>)}
                        <label className="mt-1 flex items-center gap-2 text-xs text-gray-500 font-bold cursor-pointer select-none"><input type="checkbox" checked={autoTriggerAfterUpload} onChange={(e) => setAutoTriggerAfterUpload(e.target.checked)} />上传后自动生成摘要</label>
                      </div>
                      <textarea value={materialText} onChange={(e) => setMaterialText(e.target.value)} rows={5} className="mt-4 w-full rounded-3xl border border-gray-100 bg-white px-4 py-4 text-sm outline-none resize-none" placeholder="粘贴书籍摘要、课堂笔记、案例材料，后续可直接生成摘要。" />
                      <div className="flex items-center justify-between mt-4 gap-4 flex-wrap"><p className="text-xs text-gray-400">保存后可在资料任务中看到结构化结果。</p><button onClick={handleCreateMaterial} disabled={materialSubmitting} className="px-5 py-3 rounded-full border border-gray-200 text-sm font-bold text-[#202124] hover:border-[#FF5722] hover:text-[#FF5722] disabled:opacity-60">{materialSubmitting ? '提交中...' : '保存资料'}</button></div>
                      {materialError && <div className="mt-3 text-xs font-bold text-red-500">{materialError}</div>}
                    </>
                  )}
                </div>
                <div className="rounded-[1.75rem] border border-gray-100 bg-[#fafafa] p-5">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-black mb-2">KNOWLEDGE STATUS</div>
                      <h3 className="text-2xl font-black text-[#202124] flex items-center gap-3"><LibraryBig className="w-6 h-6 text-[#1a73e8]" />{selectedMaterialJob ? `${selectedMaterialJob.source_name || '当前材料'} 知识点掌握看板` : '知识点掌握看板'}</h3>
                    </div>
                    <Sparkles className="w-5 h-5 text-gray-300" />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white border border-gray-100 p-4">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black mb-2">今日概览</div>
                      <div className="text-2xl font-black text-[#202124]">{sessionData?.attempts?.length || 0}</div>
                      <div className="text-xs text-gray-500 mt-1">训练尝试次数</div>
                    </div>
                    <div className="rounded-2xl bg-white border border-gray-100 p-4">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black mb-2">资料任务</div>
                      <div className="text-2xl font-black text-[#202124]">{materialJobs.length}</div>
                      <div className="text-xs text-gray-500 mt-1">当前任务数</div>
                    </div>
                    <div className="rounded-2xl bg-white border border-gray-100 p-4">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black mb-2">知识点</div>
                      <div className="text-2xl font-black text-[#202124]">{knowledgeNodes.length}</div>
                      <div className="text-xs text-gray-500 mt-1">已加载节点</div>
                    </div>
                    <div className="rounded-2xl bg-white border border-gray-100 p-4">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black mb-2">当前状态</div>
                      <div className="text-sm font-bold text-[#202124] leading-6">{selectedMaterialJob?.status || '未选中材料'}</div>
                      <div className="text-xs text-gray-500 mt-1">最近选中资料</div>
                    </div>
                  </div>
                  <div className="space-y-3 mt-5 max-h-[22rem] overflow-auto pr-1">
                    {knowledgeNodes.length > 0 ? knowledgeNodes.map((node: any) => (
                      <div key={node.id} className="rounded-2xl border border-gray-100 bg-white p-4 cursor-pointer hover:border-[#1a73e8] transition-colors" onClick={() => setSelectedKnowledgeNode(node)}>
                        <div className="flex items-center justify-between gap-3 mb-2"><div className="font-bold text-[#202124] truncate">{node.node_name || '未命名知识点'}</div><span className="text-[10px] uppercase tracking-[0.2em] font-black px-2 py-1 rounded-full bg-[#e8f0fe] text-[#1a73e8]">L{node.mastery_level}</span></div>
                        <div className="text-xs text-gray-500 leading-5">{node.topic || node.module_name || '未分类'}</div>
                        <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-gray-500">
                          <div className="rounded-xl bg-[#fafafa] border border-gray-100 px-3 py-2"><span className="font-bold text-gray-400 uppercase tracking-[0.15em] mr-2">来源资料</span><span className="text-[#202124]">{node.extra_json?.source_name || node.source_material_id || '未关联'}</span></div>
                          <div className="rounded-xl bg-[#fafafa] border border-gray-100 px-3 py-2"><span className="font-bold text-gray-400 uppercase tracking-[0.15em] mr-2">文档状态</span><span className="text-[#202124]">{node.extra_json?.dify_display_status || node.extra_json?.dify_document_status || '未知'}</span></div>
                          <div className="rounded-xl bg-[#fafafa] border border-gray-100 px-3 py-2"><span className="font-bold text-gray-400 uppercase tracking-[0.15em] mr-2">来源文档</span><span className="text-[#202124] break-all">{node.source_document_id || '未绑定'}</span></div>
                          <div className="rounded-xl bg-[#fafafa] border border-gray-100 px-3 py-2"><span className="font-bold text-gray-400 uppercase tracking-[0.15em] mr-2">摘要状态</span><span className="text-[#202124]">{node.source_summary_json ? '已生成' : '未生成'}</span></div>
                          <button onClick={() => setSelectedKnowledgeNode(node)} className="rounded-xl bg-[#e8f0fe] text-[#1a73e8] px-3 py-2 font-black uppercase tracking-[0.15em]">查看来源详情</button>
                        </div>
                      </div>
                    )) : <div className="text-sm text-gray-400">暂无知识点状态</div>}
                  </div>
                </div>
              </div>
              <div className="rounded-[1.75rem] border border-gray-100 bg-[#fafafa] p-5 2xl:p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-bold mb-2">MATERIAL INGEST</div>
                    <h3 className="text-2xl font-black text-[#202124] flex items-center gap-3"><FileText className="w-6 h-6 text-[#FF5722]" />资料消化任务</h3>
                  </div>
                  <Database className="w-5 h-5 text-gray-300" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
                  <div>
                    <div className="mb-4 flex items-center justify-between gap-3 flex-wrap"><div className="rounded-full border border-gray-200 bg-white px-3 py-2 flex items-center gap-2 text-xs font-bold text-gray-500"><span>列表</span><button onClick={() => setMaterialViewMode('list')} className={`px-3 py-1 rounded-full ${materialViewMode === 'list' ? 'bg-[#1a73e8] text-white' : 'bg-white text-gray-500'}`}>开</button><button onClick={() => setMaterialViewMode('card')} className={`px-3 py-1 rounded-full ${materialViewMode === 'card' ? 'bg-[#1a73e8] text-white' : 'bg-white text-gray-500'}`}>卡</button></div></div>
                    <div className="mb-4"><input value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)} className="w-full sm:max-w-xs rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm outline-none" placeholder="文件名模糊搜索，例如：越狱 / RPA / tauri" /></div>
                    <div className="space-y-3 max-h-72 overflow-auto pr-1">{filteredMaterialList.length > 0 ? filteredMaterialList.map((job: any) => { const meta = getJobStatusMeta(job); const progress = job.status === 'processed' ? 100 : job.status === 'processing' ? 62 : job.status === 'failed' ? 100 : 18; return materialViewMode === 'card' ? (<div key={job.id} onClick={() => setSelectedMaterialJob(job)} className={`relative overflow-hidden rounded-[1.9rem] border p-5 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.35)] transition-all cursor-pointer ${selectedMaterialJob?.id === job.id ? 'ring-2 ring-[#1a73e8] border-[#1a73e8]' : ''} ${job.status === 'processed' ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white' : job.status === 'failed' ? 'border-red-200 bg-gradient-to-br from-red-50 via-white to-white' : 'border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white'} ${job.status === 'processing' ? 'ring-2 ring-amber-200/60' : ''}`}><div className={`absolute left-0 top-0 h-full w-1.5 ${job.status === 'processed' ? 'bg-emerald-500' : job.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'}`} /><div className="flex items-start justify-between gap-3 mb-3 pl-1"><div className="min-w-0"><div className="font-extrabold text-[#202124] truncate text-[16px] leading-6">{job.source_name || '未命名资料'}</div><div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-gray-400 font-black">{job.topic || job.source_type || '未分类'}</div></div><span className={`inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-black px-3 py-1.5 rounded-full border shadow-sm ${meta.className}`}><span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />{meta.label}</span></div><div className="pl-1"><div className="h-2 rounded-full bg-white/80 border border-gray-100 overflow-hidden"><div className={`h-full rounded-full transition-all ${job.status === 'processed' ? 'bg-emerald-500' : job.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${progress}%` }} /></div><div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 font-semibold"><span>{meta.description}</span><span>{progress}%</span></div></div><div className="mt-4 pl-1 flex items-center gap-2 flex-wrap"><button onClick={() => handleGenerateSummary(job.id)} className="text-[11px] px-4 py-2.5 rounded-full bg-[#1a73e8] text-white font-black shadow-sm hover:opacity-90">生成摘要</button><button onClick={() => openMaterialActionDrawer(job, 'update')} className="text-[11px] px-4 py-2.5 rounded-full bg-white border border-gray-200 text-[#202124] font-black hover:border-[#1a73e8] hover:text-[#1a73e8]">更新</button><button onClick={() => openMaterialActionDrawer(job, 'delete')} className="text-[11px] px-4 py-2.5 rounded-full bg-white border border-red-200 text-red-600 font-black hover:bg-red-50">删除</button><span className="text-[11px] text-gray-500 font-bold">{job.dify_segment_count ?? 0} 段 · {job.dify_word_count ?? 0} 词</span>{job.status === 'failed' && job.error_message && <span className="text-[11px] text-red-600 font-bold">失败原因可见</span>}</div>{job.status !== 'pending' && renderDifyStatusCard(job)}</div>) : (<div key={job.id} className="rounded-2xl border border-gray-100 bg-white p-4 flex items-center justify-between gap-4 cursor-pointer hover:border-[#1a73e8] transition-colors" onClick={() => setSelectedMaterialJob(job)}><div className="min-w-0"><div className="font-extrabold text-[#202124] truncate text-[15px] leading-6">{job.source_name || '未命名资料'}</div><div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-gray-400 font-black">{job.topic || job.source_type || '未分类'}</div><div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500"><span>{meta.description}</span><span className="text-gray-300">·</span><span>{job.dify_segment_count ?? 0} 段</span><span className="text-gray-300">·</span><span>{job.dify_word_count ?? 0} 词</span></div></div><div className="flex items-center gap-3 shrink-0"><span className={`inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-black px-3 py-1.5 rounded-full border shadow-sm ${meta.className}`}><span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />{meta.label}</span><span className="text-[11px] text-gray-500 font-bold">{progress}%</span></div></div>); }) : <div className="text-sm text-gray-400">暂无资料任务</div>}</div>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-gradient-to-br from-[#e8f0fe] to-white border border-[#d6e4ff] p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-[#1a73e8] font-black">仪表盘总览</div>
                        <Target className="w-4 h-4 text-[#1a73e8]" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-[#202124]">
                        <div className="rounded-xl bg-white/80 px-3 py-2 border border-white"><div className="text-[10px] uppercase tracking-[0.15em] text-gray-400 font-black">选中资料</div><div className="mt-1 font-bold truncate">{selectedMaterialJob?.source_name || '无'}</div></div>
                        <div className="rounded-xl bg-white/80 px-3 py-2 border border-white"><div className="text-[10px] uppercase tracking-[0.15em] text-gray-400 font-black">知识点</div><div className="mt-1 font-bold">{knowledgeNodes.length}</div></div>
                        <div className="rounded-xl bg-white/80 px-3 py-2 border border-white"><div className="text-[10px] uppercase tracking-[0.15em] text-gray-400 font-black">任务数</div><div className="mt-1 font-bold">{materialJobs.length}</div></div>
                        <div className="rounded-xl bg-white/80 px-3 py-2 border border-white"><div className="text-[10px] uppercase tracking-[0.15em] text-gray-400 font-black">训练尝试</div><div className="mt-1 font-bold">{sessionData?.attempts?.length || 0}</div></div>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black">进度概览</div>
                        <Sparkles className="w-4 h-4 text-gray-300" />
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1"><span>当前资料状态</span><span>{selectedMaterialJob?.status || '未选中'}</span></div>
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#1a73e8] to-[#7aa7ff]" style={{ width: `${selectedMaterialJob?.status === 'processed' ? 100 : selectedMaterialJob?.status === 'processing' ? 62 : selectedMaterialJob?.status === 'failed' ? 100 : 18}%` }} /></div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1"><span>知识点覆盖</span><span>{knowledgeNodes.length > 0 ? '已加载' : '待加载'}</span></div>
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#34a853] to-[#7fdc8a]" style={{ width: `${Math.min(knowledgeNodes.length * 20, 100)}%` }} /></div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1"><span>资料池活跃度</span><span>{materialJobs.length}/4</span></div>
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#ff9800] to-[#ffb74d]" style={{ width: `${Math.min(materialJobs.length * 25, 100)}%` }} /></div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black">快捷入口</div>
                        <LibraryBig className="w-4 h-4 text-gray-300" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-[#202124]">
                        <div className="rounded-xl bg-[#fafafa] px-3 py-2 border border-gray-100">生成摘要</div>
                        <div className="rounded-xl bg-[#fafafa] px-3 py-2 border border-gray-100">更新资料</div>
                        <div className="rounded-xl bg-[#fafafa] px-3 py-2 border border-gray-100">删除资料</div>
                        <div className="rounded-xl bg-[#fafafa] px-3 py-2 border border-gray-100">知识点详情</div>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black">状态提示</div>
                        <Coffee className="w-4 h-4 text-gray-300" />
                      </div>
                      <div className="text-sm text-gray-500 leading-7">右侧区域承担辅助信息与状态总览，帮助主内容区更像一个可视化工作台。</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 知识点详情抽屉 */}
{/* 知识点详情抽屉 */}
        {selectedKnowledgeNode && (
          <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 backdrop-blur-sm">
            <div className="w-full max-w-xl h-full bg-white shadow-[0_24px_80px_-24px_rgba(0,0,0,0.35)] border-l border-gray-100 overflow-y-auto">
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 px-6 py-5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black mb-1">KNOWLEDGE DETAIL</div>
                  <h3 className="text-xl font-black text-[#202124]">{selectedKnowledgeNode.node_name || '未命名知识点'}</h3>
                </div>
                <button
                  onClick={() => setSelectedKnowledgeNode(null)}
                  className="rounded-full px-4 py-2 text-sm font-black text-gray-500 hover:text-[#202124] hover:bg-gray-100"
                >
                  关闭
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="rounded-2xl border border-gray-100 bg-[#fafafa] p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black mb-2">基础信息</div>
                  <div className="text-sm text-[#202124] leading-7">
                    <div>主题：{selectedKnowledgeNode.topic || '未分类'}</div>
                    <div>模块：{selectedKnowledgeNode.module_name || '未分类'}</div>
                    <div>掌握等级：L{selectedKnowledgeNode.mastery_level}</div>
                    <div>复习时间：{selectedKnowledgeNode.review_due_at ? new Date(selectedKnowledgeNode.review_due_at).toLocaleString() : '未设置'}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-[#fafafa] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black">文档身份</div>
                    <span className={`text-[10px] uppercase tracking-[0.2em] font-black px-2 py-1 rounded-full ${String(selectedKnowledgeNode.extra_json?.dify_display_status || selectedKnowledgeNode.extra_json?.dify_document_status || '').includes('available') || String(selectedKnowledgeNode.extra_json?.dify_document_status || '').includes('completed') ? 'bg-emerald-50 text-emerald-700' : String(selectedKnowledgeNode.extra_json?.dify_document_status || '').includes('error') ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                      {selectedKnowledgeNode.extra_json?.dify_display_status || selectedKnowledgeNode.extra_json?.dify_document_status || 'unknown'}
                    </span>
                  </div>
                  <div className="rounded-xl bg-white border border-gray-100 px-3 py-2 text-sm text-[#202124] leading-7">
                    <div>来源资料：{selectedKnowledgeNode.extra_json?.source_name || selectedKnowledgeNode.source_material_id || '未关联'}</div>
                    <div>文档名称：{selectedKnowledgeNode.extra_json?.dify_document_name || selectedKnowledgeNode.extra_json?.source_name || '未命名文档'}</div>
                    <div className="break-all">文档ID：{selectedKnowledgeNode.source_document_id || '未绑定'}</div>
                    <div className="break-all">知识库ID：{selectedKnowledgeNode.source_dataset_id || '未绑定'}</div>
                  </div>

                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black">处理状态</div>
                  <div className="grid grid-cols-2 gap-2 text-[12px] text-gray-600">
                    <div className="rounded-xl bg-white border border-gray-100 px-3 py-2">indexing：{selectedKnowledgeNode.extra_json?.dify_document_status || '未知'}</div>
                    <div className="rounded-xl bg-white border border-gray-100 px-3 py-2">display：{selectedKnowledgeNode.extra_json?.dify_display_status || '未知'}</div>
                    <div className="rounded-xl bg-white border border-gray-100 px-3 py-2">分段：{selectedKnowledgeNode.extra_json?.dify_segment_count ?? 0}</div>
                    <div className="rounded-xl bg-white border border-gray-100 px-3 py-2">词数：{selectedKnowledgeNode.extra_json?.dify_word_count ?? 0}</div>
                    <div className="rounded-xl bg-white border border-gray-100 px-3 py-2">语言：{selectedKnowledgeNode.extra_json?.dify_doc_language || '未知'}</div>
                    <div className="rounded-xl bg-white border border-gray-100 px-3 py-2">Batch：{selectedKnowledgeNode.extra_json?.dify_batch_id || '—'}</div>
                  </div>

                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black">来源与错误</div>
                  <div className="rounded-xl bg-white border border-gray-100 px-3 py-2 text-sm text-[#202124] leading-7">
                    <div>来源类型：{selectedKnowledgeNode.extra_json?.dify_data_source_type || 'upload_file'}</div>
                    <div>创建者：{selectedKnowledgeNode.extra_json?.dify_created_by || '未知'}</div>
                    <div>创建时间：{formatTs(selectedKnowledgeNode.extra_json?.dify_created_at)}</div>
                    {selectedKnowledgeNode.extra_json?.error_message && (
                      <div className="mt-2 rounded-lg border border-red-100 bg-red-50 px-2 py-1 text-red-700">错误：{selectedKnowledgeNode.extra_json.error_message}</div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-[#fafafa] p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black mb-2">摘要卡片</div>
                  {renderSectionCards((selectedMaterialJob?.workflowRun?.data?.outputs?.result as Record<string, unknown>) || (selectedMaterialJob?.workflow_run?.data?.outputs?.result as Record<string, unknown>) || (selectedMaterialJob?.summary_json as Record<string, unknown>) || selectedKnowledgeNode.source_summary_json || {})}
                </div>

                <div className="rounded-2xl border border-gray-100 bg-[#fafafa] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black">训练历史</div>
                    <div className="text-[11px] text-gray-500">{getKnowledgeTrainingHistory(selectedKnowledgeNode).length} 条</div>
                  </div>
                  <div className="space-y-3">
                    {getKnowledgeTrainingHistory(selectedKnowledgeNode).length > 0 ? getKnowledgeTrainingHistory(selectedKnowledgeNode).map((item: any, idx: number) => (
                      <button key={`${item.attemptId || idx}`} onClick={() => setSelectedTrainingHistory(item)} className="w-full text-left rounded-2xl border border-gray-100 bg-white p-4 hover:border-[#1a73e8] transition-colors">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="font-bold text-[#202124]">{item.sceneType || '未命名场景'}</div>
                          <span className="text-[10px] uppercase tracking-[0.2em] font-black px-2 py-1 rounded-full bg-[#e8f0fe] text-[#1a73e8]">{item.score ?? '-'} 分</span>
                        </div>
                        <div className="text-xs text-gray-500 leading-6">
                          <div>时间：{item.createdAt ? new Date(item.createdAt).toLocaleString() : '未知'}</div>
                          <div className="mt-1 line-clamp-2">案例：{item.caseText || '无'}</div>
                        </div>
                      </button>
                    )) : <div className="text-sm text-gray-400">暂无训练历史</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {materialActionMode && materialActionTarget && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
            <div className="w-full max-w-xl bg-white rounded-[2rem] border border-gray-100 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.45)] overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black mb-1">{materialActionMode === 'update' ? 'UPDATE DOCUMENT' : 'DELETE DOCUMENT'}</div>
                  <h3 className="text-xl font-black text-[#202124]">{materialActionTarget.source_name || '未命名资料'}</h3>
                </div>
                <button onClick={closeMaterialActionDrawer} className="rounded-full px-4 py-2 text-sm font-black text-gray-500 hover:text-[#202124] hover:bg-gray-100">关闭</button>
              </div>
              <div className="p-6 space-y-4">
                {materialActionMode === 'update' ? (
                  <>
                    <div className="text-sm text-gray-500">可通过文件或文本更新该文档。</div>
                    <label className="block text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-2">更新方式</label>
                    <div className="grid grid-cols-1 gap-3">
                      <label className="rounded-2xl border border-gray-200 p-4 cursor-pointer flex items-center justify-between gap-4">
                        <span className="font-bold text-[#202124]">上传新文件</span>
                        <input type="file" accept=".txt,.md,.markdown,.json,.pdf" onChange={handleMaterialUpdateFiles} />
                      </label>
                      <textarea
                        value={materialUpdateText}
                        onChange={(e) => setMaterialUpdateText(e.target.value)}
                        rows={6}
                        className="w-full rounded-3xl border border-gray-100 bg-[#fafafa] px-4 py-4 text-sm outline-none resize-none"
                        placeholder="或直接替换文本内容"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button onClick={closeMaterialActionDrawer} className="px-5 py-3 rounded-full border border-gray-200 text-sm font-black text-[#202124]">取消</button>
                      <button onClick={submitMaterialUpdate} disabled={materialUpdateSubmitting} className="px-5 py-3 rounded-full bg-[#1a73e8] text-white text-sm font-black disabled:opacity-60">{materialUpdateSubmitting ? '更新中...' : '确认更新'}</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 leading-7">删除后将同步移除本地材料记录与关联知识点，请确认是否继续。</div>
                    <div className="text-sm text-gray-500">文件：{materialActionTarget.source_name || '未命名资料'}</div>
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button onClick={closeMaterialActionDrawer} className="px-5 py-3 rounded-full border border-gray-200 text-sm font-black text-[#202124]">取消</button>
                      <button onClick={confirmDeleteMaterial} className="px-5 py-3 rounded-full bg-red-600 text-white text-sm font-black">确认删除</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedTrainingHistory && selectedKnowledgeNode && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-[2rem] shadow-[0_30px_90px_-30px_rgba(0,0,0,0.45)] border border-gray-100">
              <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-6 py-5 flex items-center justify-between rounded-t-[2rem]">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black mb-1">TRAINING REPLAY</div>
                  <h3 className="text-xl font-black text-[#202124]">{selectedTrainingHistory.sceneType || '训练详情'}</h3>
                </div>
                <button onClick={() => setSelectedTrainingHistory(null)} className="rounded-full px-4 py-2 text-sm font-black text-gray-500 hover:text-[#202124] hover:bg-gray-100">关闭</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="rounded-2xl border border-gray-100 bg-[#fafafa] p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[#202124] leading-7">
                    <div>时间：{selectedTrainingHistory.createdAt ? new Date(selectedTrainingHistory.createdAt).toLocaleString() : '未知'}</div>
                    <div>得分：{selectedTrainingHistory.score ?? '-'}</div>
                    <div>场景：{selectedTrainingHistory.sceneType || '未知'}</div>
                    <div>知识点：{selectedKnowledgeNode.node_name || '未命名'}</div>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-[#fafafa] p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black mb-2">案例文本</div>
                  <div className="text-sm text-[#202124] leading-7 whitespace-pre-wrap">{selectedTrainingHistory.caseText || '无'}</div>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-[#fafafa] p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black mb-3">训练反馈</div>
                  {renderFeedbackCards(selectedTrainingHistory)}
                </div>
                <div className="rounded-2xl border border-gray-100 bg-[#fafafa] p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black mb-2">关联知识点来源</div>
                  {renderSectionCards((selectedKnowledgeNode?.workflowRun?.data?.outputs?.result as Record<string, unknown>) || (selectedKnowledgeNode?.workflow_run?.data?.outputs?.result as Record<string, unknown>) || selectedKnowledgeNode.source_summary_json || {})}
                </div>
              </div>
            </div>
          </div>
        )}


        {/* 专属隔离：康奈尔底部笔记区 */}
        <div className="pt-20 pb-12 w-full flex justify-center mt-12 relative flex-col max-w-none mx-auto">
          <div className="w-full">
            <SummaryArea selectedDate={selectedDate} />
          </div>
        </div>
      </div>
    </main>
  );
}
