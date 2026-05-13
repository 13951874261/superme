import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Clock3, Headphones, Loader2, RefreshCw, Target } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import BlindListeningCabin from '../BlindListeningCabin';
import { createTrainingAttempt, submitTrainingFeedback, upsertTrainingSession, upsertKnowledgeNode } from '../../services/trainingAPI';
import { runListenWorkflow } from '../../services/difyAPI';
import { fetchListeningMaterials, ListeningDifficulty, ListeningMaterial } from '../../services/listeningAPI';

interface ListenModuleProps {
  selectedDate: string;
  initialAttempt?: any | null;
  readOnly?: boolean;
  sourceKnowledgeNode?: any | null;
}

const sceneOptions = [
  { id: 'institution', label: '体制内', hint: '政策、边界、层级、合规话术' },
  { id: 'enterprise', label: '跨国企业', hint: '资源、绩效、矩阵关系、跨文化博弈' },
  { id: 'social', label: '通用社交', hint: '关系、动机、礼貌、试探与回避' },
];

const fallacies = [
  { id: '1', label: '以偏概全' },
  { id: '2', label: '经验绑架' },
  { id: '3', label: '预设滑坡' },
  { id: '4', label: '偷换概念' },
];

const difficultyOptions: Array<ListeningDifficulty | 'all'> = ['all', 'A2', 'B1', 'B2', 'C1'];

function parseMarkdownBlocks(markdown: string) {
  const sections = markdown.split(/\n(?=##\s+)/g).map((chunk) => chunk.trim()).filter(Boolean);
  return sections.map((section) => {
    const lines = section.split('\n').map((line) => line.trim()).filter(Boolean);
    const title = lines[0].replace(/^##\s*/, '');
    const bullets = lines.slice(1).map((line) => line.replace(/^[-*]\s*/, '')).filter(Boolean);
    return { title, bullets };
  });
}

export default function ListenModule({ selectedDate, initialAttempt, readOnly = false, sourceKnowledgeNode = null }: ListenModuleProps) {
  const [sceneType, setSceneType] = useState('institution');
  const [caseText, setCaseText] = useState('要是他们牵头这个合规项目，政策风险太高，不如暂缓。');
  const [selectedFallacy, setSelectedFallacy] = useState<string | null>(null);
  const [roleJudgement, setRoleJudgement] = useState(initialAttempt?.role_judgement || '');
  const [abilityJudgement, setAbilityJudgement] = useState(initialAttempt?.ability_judgement || '');
  const [intentJudgement, setIntentJudgement] = useState(initialAttempt?.intent_judgement || '');
  const [counterQuestion, setCounterQuestion] = useState(initialAttempt?.counter_question || '');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [difyOutput, setDifyOutput] = useState('');
  const [difyError, setDifyError] = useState('');
  const [listeningMaterials, setListeningMaterials] = useState<ListeningMaterial[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<ListeningDifficulty | 'all'>('B2');
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialsError, setMaterialsError] = useState('');

  const selectedFallacyLabel = fallacies.find((f) => f.id === selectedFallacy)?.label || '';
  const selectedScene = sceneOptions.find((scene) => scene.id === sceneType) || sceneOptions[0];

  useEffect(() => {
    setRoleJudgement(initialAttempt?.role_judgement || '');
    setAbilityJudgement(initialAttempt?.ability_judgement || '');
    setIntentJudgement(initialAttempt?.intent_judgement || '');
    setCounterQuestion(initialAttempt?.counter_question || '');
  }, [initialAttempt]);

  const loadListeningMaterials = async () => {
    try {
      setMaterialsLoading(true);
      setMaterialsError('');
      const rows = await fetchListeningMaterials({ difficulty: difficultyFilter, limit: 20 });
      setListeningMaterials(rows);
      setSelectedMaterialId((current) => {
        if (rows.some((item) => item.id === current)) return current;
        return rows[0]?.id || '';
      });
    } catch (error) {
      setMaterialsError(error instanceof Error ? error.message : '听力材料加载失败');
      setListeningMaterials([]);
      setSelectedMaterialId('');
    } finally {
      setMaterialsLoading(false);
    }
  };

  useEffect(() => {
    loadListeningMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyFilter]);

  const selectedMaterial = useMemo(
    () => listeningMaterials.find((item) => item.id === selectedMaterialId) || listeningMaterials[0] || null,
    [listeningMaterials, selectedMaterialId],
  );

  const completeness = useMemo(
    () =>
      [sceneType, caseText, roleJudgement, abilityJudgement, intentJudgement, counterQuestion, selectedFallacyLabel]
        .filter((v) => String(v).trim().length > 0).length,
    [sceneType, caseText, roleJudgement, abilityJudgement, intentJudgement, counterQuestion, selectedFallacyLabel],
  );

  const score = Math.round((completeness / 7) * 10);
  const analysisPreview = useMemo(
    () => ({
      sceneType: selectedScene.label,
      sceneHint: selectedScene.hint,
      caseText,
      roleJudgement,
      abilityJudgement,
      intentJudgement,
      selectedFallacy: selectedFallacyLabel || '未选择',
      counterQuestion,
      score,
      outputMode: 'Dify structured analysis',
    }),
    [selectedScene, caseText, roleJudgement, abilityJudgement, intentJudgement, selectedFallacyLabel, counterQuestion, score],
  );

  const difyMarkdownSections = useMemo(() => parseMarkdownBlocks(difyOutput), [difyOutput]);
  const sourceSummary = useMemo(() => sourceKnowledgeNode?.source_summary_json || sourceKnowledgeNode?.extra_json?.sourceSummary || {}, [sourceKnowledgeNode]);

  const handleSubmit = async () => {
    if (readOnly) return;
    try {
      setSubmitStatus('saving');
      setDifyError('');

      const workflowResponse = await runListenWorkflow(
        {
          scene_type: selectedScene.label,
          case_text: caseText,
          role_judgement: roleJudgement,
          ability_judgement: abilityJudgement,
          intent_judgement: intentJudgement,
          fallacy_choice: selectedFallacyLabel,
          counter_question: counterQuestion,
        },
        'default-user',
      );

      const formattedOutput = workflowResponse?.data?.outputs
        ? JSON.stringify(workflowResponse.data.outputs, null, 2)
        : workflowResponse?.answer || workflowResponse?.message || JSON.stringify(workflowResponse, null, 2);
      setDifyOutput(formattedOutput);

      const session = await upsertTrainingSession({
        userId: 'default-user',
        trainingDate: selectedDate,
        totalMinutes: 60,
        listenMinutes: 30,
        logicMinutes: 30,
      });

      const attempt = await createTrainingAttempt({
        sessionId: session.sessionId,
        userId: 'default-user',
        moduleType: 'listen',
        sceneType: selectedScene.label,
        caseText,
        roleJudgement,
        abilityJudgement,
        intentJudgement,
        fallacyChoice: selectedFallacyLabel,
        counterQuestion,
        logicPoint: selectedFallacyLabel,
        userAnswer: {
          sceneType,
          caseText,
          roleJudgement,
          abilityJudgement,
          intentJudgement,
          counterQuestion,
        },
        durationSeconds: 300,
        score,
      });

      await submitTrainingFeedback({
        attemptId: attempt.attemptId,
        userId: 'default-user',
        knowledgeNodeId: sourceKnowledgeNode?.id || '',
        sceneType: selectedScene.label,
        caseText,
        decomposition: {
          socialLevel: roleJudgement,
          internalAbility: abilityJudgement,
          humanTrait: '权责争夺',
          hiddenMeaning: intentJudgement,
        },
        logicAnalysis: {
          selectedFallacy: selectedFallacyLabel,
          validity: score >= 8 ? '较高' : '中等',
        },
        strengths: selectedFallacyLabel ? `你已识别核心谬误：${selectedFallacyLabel}` : '可继续强化谬误识别',
        weaknesses: counterQuestion ? '' : '缺少反问词，建议补足追问句',
        nextFocus: '下次优先训练：层级判断、立场识别、反问句并行输出',
        score,
        rawResponse: formattedOutput,
      });

      await upsertKnowledgeNode({
        userId: 'default-user',
        moduleName: 'listen',
        topic: selectedScene.label,
        nodeName: selectedFallacyLabel || '场景判断',
        masteryLevel: score >= 8 ? 3 : score >= 6 ? 2 : 1,
        reviewDueAt: Date.now() + (score >= 8 ? 7 : 2) * 24 * 60 * 60 * 1000,
        lastPracticedAt: Date.now(),
        sourceMaterialId: sourceKnowledgeNode?.source_material_id || session.sessionId,
        extraJson: {
          sceneType: selectedScene.label,
          caseText,
          roleJudgement,
          abilityJudgement,
          intentJudgement,
          fallacyChoice: selectedFallacyLabel,
          counterQuestion,
          score,
          sourceDocumentId: sourceKnowledgeNode?.source_document_id || '',
          sourceDatasetId: sourceKnowledgeNode?.source_dataset_id || '',
          sourceSummary: sourceKnowledgeNode?.source_summary_json || {},
        },
      });

      setSubmitStatus('done');
      setTimeout(() => setSubmitStatus('idle'), 2500);
    } catch (e) {
      setDifyError(e instanceof Error ? e.message : 'Dify 调用失败');
      setSubmitStatus('error');
    }
  };

  return (
    <ModuleWrapper
      id="module-listen"
      title="洞察 ｜ 撕开逻辑的遮羞布"
      icon={<Headphones className="w-8 h-8" strokeWidth={2.5} />}
      description="核心定位：听懂潜台词与利益弦外之音、抓取他人的表达漏洞，解码人心。时间建议：每日 60 分钟。"
    >
      <div className="space-y-12">
        <section className="rounded-[2rem] bg-white border border-gray-100 p-6 shadow-[0_18px_60px_-32px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#202124] text-white text-xs font-black tracking-[0.22em] uppercase mb-3">
                <Headphones className="w-4 h-4" />
                听力盲听舱
              </div>
              <h3 className="text-3xl font-black text-[#202124] leading-tight">真实语料截获与潜台词拆解</h3>
              <p className="text-sm text-gray-500 mt-2">读取 Dify 写入的 listening_materials，支持 A2-C1 分级、真实音频、盲听笔记和底牌翻看。</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {difficultyOptions.map((difficulty) => (
                <button
                  key={difficulty}
                  onClick={() => setDifficultyFilter(difficulty)}
                  className={`px-4 py-2 rounded-full text-xs font-black transition-all ${
                    difficultyFilter === difficulty
                      ? 'bg-[#FF5722] text-white shadow-[0_10px_22px_-10px_rgba(255,87,34,0.7)]'
                      : 'bg-[#f8f9fa] text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {difficulty === 'all' ? '全部' : difficulty}
                </button>
              ))}
              <button
                onClick={loadListeningMaterials}
                disabled={materialsLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#e8f0fe] text-[#1a73e8] text-xs font-black disabled:opacity-60"
              >
                {materialsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                刷新语料
              </button>
            </div>
          </div>

          {materialsError && (
            <div className="mb-5 rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 font-bold">
              {materialsError}
            </div>
          )}

          {listeningMaterials.length > 0 && (
            <div className="mb-6 flex gap-3 overflow-x-auto pb-2">
              {listeningMaterials.map((material) => (
                <button
                  key={material.id}
                  onClick={() => setSelectedMaterialId(material.id)}
                  className={`min-w-[260px] text-left rounded-3xl border p-4 transition-all ${
                    selectedMaterial?.id === material.id
                      ? 'border-[#FF5722] bg-[#fff4ef] shadow-[0_12px_32px_-20px_rgba(255,87,34,0.7)]'
                      : 'border-gray-100 bg-[#f8f9fa] hover:bg-white hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="px-2.5 py-1 rounded-full bg-white text-[10px] font-black text-[#FF5722]">{material.difficulty}</span>
                    <span className="text-[10px] font-bold text-gray-400">{material.audio_url ? '有音频' : '待配音'}</span>
                  </div>
                  <div className="text-sm font-black text-[#202124] line-clamp-2">{material.title}</div>
                  <div className="text-xs text-gray-500 mt-2 line-clamp-1">{material.category}</div>
                </button>
              ))}
            </div>
          )}

          {!materialsLoading && listeningMaterials.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-gray-200 bg-[#f8f9fa] min-h-[260px] flex flex-col items-center justify-center text-center text-gray-400">
              <Headphones className="w-12 h-12 mb-3" strokeWidth={1.5} />
              <p className="text-sm font-black tracking-widest uppercase">暂无该难度听力材料</p>
              <p className="text-xs mt-2">请先通过 Dify 工作流写入 /api/listening/materials，或切换难度筛选。</p>
            </div>
          ) : (
            <BlindListeningCabin material={selectedMaterial} onRefresh={loadListeningMaterials} />
          )}
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-stretch">
          <div className="xl:col-span-1 flex flex-col gap-6">
            <div className="rounded-3xl bg-[#f8f9fa] p-6 border border-gray-100">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e8f0fe] text-[#1a73e8] text-xs font-bold tracking-[0.2em] uppercase mb-4">
                <Bot className="w-4 h-4" />
                Dify 输入面板
              </div>
              <h3 className="text-2xl font-black text-[#202124] leading-tight mb-2">先收集结构，再生成判断</h3>
              <p className="text-sm text-gray-600 leading-6">
                这一栏负责把场景、原句、角色判断与追问词整理成结构化输入，方便后续直接喂给 Dify 工作流。
              </p>
            </div>

            <div className="rounded-3xl bg-white border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest">场景选择</h4>
                <Clock3 className="w-4 h-4 text-gray-400" />
              </div>
              <div className="space-y-3">
                {sceneOptions.map((scene) => (
                  <button
                    key={scene.id}
                    disabled={readOnly}
                    onClick={() => setSceneType(scene.id)}
                    className={`w-full text-left rounded-2xl px-4 py-4 border transition-all ${
                      sceneType === scene.id ? 'border-[#1a73e8] bg-[#e8f0fe]' : 'border-gray-100 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="font-bold text-[#202124]">{scene.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{scene.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="xl:col-span-1 flex flex-col space-y-8">
            <div className="inline-flex items-center max-w-max px-4 py-2 bg-[#fbe9e7] text-[#FF5722] rounded-full text-xs font-bold tracking-widest uppercase">
              职场案例库 // 004
            </div>

            <div className="bg-[#f8f9fa] rounded-3xl p-8 flex-1">
              <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-6 flex items-center">
                <Target className="w-5 h-5 mr-3 text-[#FF5722]" strokeWidth={2.5} />
                样例原句
              </h4>
              <h3 className="text-3xl font-black text-[#202124] leading-tight pr-4">“要是他们牵头这个合规项目，政策风险太高，不如暂缓。”</h3>
              <div className="mt-6 rounded-3xl bg-white p-5 border border-gray-100">
                <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">当前场景</div>
                <div className="text-sm text-[#202124] font-medium">{selectedScene.label}</div>
              </div>
              <div className="mt-4 rounded-3xl bg-white p-5 border border-gray-100">
                <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">案例文本</div>
                <textarea
                  rows={4}
                  value={caseText}
                  disabled={readOnly}
                  onChange={(e) => setCaseText(e.target.value)}
                  className="w-full outline-none resize-none text-sm text-[#202124] placeholder-gray-400"
                />
              </div>
            </div>
          </div>

          <div className="xl:col-span-1 flex flex-col gap-6">
            <div className="rounded-3xl bg-white border border-gray-100 p-6">
              <h4 className="text-xl font-bold text-[#202124] mb-4">Dify 结构化输出预览</h4>
              <pre className="text-xs leading-5 text-gray-600 bg-[#f8f9fa] rounded-2xl p-4 overflow-auto max-h-[340px]">{JSON.stringify(analysisPreview, null, 2)}</pre>
            </div>

            <div className="rounded-3xl bg-white border border-gray-100 p-6">
              <h4 className="text-xl font-bold text-[#202124] mb-6">定位对方的破绽</h4>
              <div className="grid grid-cols-2 gap-4 mb-8">
                {fallacies.map((f) => (
                  <button
                    key={f.id}
                    disabled={readOnly}
                    onClick={() => setSelectedFallacy(f.id)}
                    className={`py-4 px-3 rounded-3xl text-sm font-bold transition-all duration-300 ${
                      selectedFallacy === f.id
                        ? 'bg-[#FF5722] text-white shadow-[0_10px_20px_-5px_rgba(255,87,34,0.4)] scale-105'
                        : 'bg-[#f8f9fa] border-2 border-gray-100 text-gray-500 hover:border-gray-300 hover:text-[#202124]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 mb-4">
                <input
                  value={roleJudgement}
                  disabled={readOnly}
                  onChange={(e) => setRoleJudgement(e.target.value)}
                  className="w-full bg-[#f8f9fa] rounded-2xl px-4 py-3 text-sm outline-none"
                  placeholder="社会层级判断（如：中层竞争者）"
                />
                <input
                  value={abilityJudgement}
                  disabled={readOnly}
                  onChange={(e) => setAbilityJudgement(e.target.value)}
                  className="w-full bg-[#f8f9fa] rounded-2xl px-4 py-3 text-sm outline-none"
                  placeholder="内在水准判断（如：善用风险话术）"
                />
                <input
                  value={intentJudgement}
                  disabled={readOnly}
                  onChange={(e) => setIntentJudgement(e.target.value)}
                  className="w-full bg-[#f8f9fa] rounded-2xl px-4 py-3 text-sm outline-none"
                  placeholder="真实意图判断（如：争夺主导权）"
                />
              </div>

              <textarea
                rows={4}
                value={counterQuestion}
                disabled={readOnly}
                onChange={(e) => setCounterQuestion(e.target.value)}
                className="w-full bg-[#f8f9fa] rounded-3xl p-6 text-base outline-none resize-none text-[#202124] placeholder-gray-400 font-medium focus:bg-white focus:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all"
                placeholder="直击要害。写下你的反问词..."
              />

              <button
                onClick={handleSubmit}
                disabled={submitStatus === 'saving' || readOnly}
                className="btn-primary w-full mt-6 py-5 rounded-full text-base font-black tracking-widest uppercase disabled:opacity-60"
              >
                {readOnly ? '历史记录回放' : submitStatus === 'saving' ? '提交中...' : '分析破绽并生成还击'}
              </button>
              {submitStatus === 'done' && <p className="mt-3 text-xs text-emerald-600 font-bold">已同步 Dify 结果并写入训练记录。</p>}
              {submitStatus === 'error' && <p className="mt-3 text-xs text-red-500 font-bold">提交失败，请检查 Dify 接口或后端服务。</p>}
              {difyError && <p className="mt-3 text-xs text-red-500 font-bold">{difyError}</p>}
            </div>

            {sourceSummary && (sourceSummary.overview || (sourceSummary.keyPoints && sourceSummary.keyPoints.length)) && (
              <div className="rounded-3xl bg-white border border-amber-100 p-6 shadow-[0_18px_50px_-24px_rgba(251,191,36,0.18)]">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <h4 className="text-xl font-black text-[#202124]">来源摘要卡片</h4>
                    <p className="text-xs text-gray-500 mt-1">本次训练关联的资料来源摘要</p>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-amber-600 bg-amber-50 px-3 py-1 rounded-full">source context</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sourceSummary.overview && (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-amber-500 font-black mb-2">核心摘要</div>
                      <div className="text-sm leading-6 text-gray-700 whitespace-pre-wrap">{sourceSummary.overview}</div>
                    </div>
                  )}
                  {sourceSummary.keyPoints?.length > 0 && (
                    <div className="rounded-2xl border border-amber-100 bg-white p-4">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-amber-500 font-black mb-2">关键要点</div>
                      <ul className="space-y-2">
                        {sourceSummary.keyPoints.map((item: string, idx: number) => (
                          <li key={idx} className="text-sm leading-6 text-gray-600 flex gap-3">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {sourceSummary.mistakes?.length > 0 && (
                    <div className="rounded-2xl border border-amber-100 bg-white p-4">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-amber-500 font-black mb-2">易错点</div>
                      <ul className="space-y-2">
                        {sourceSummary.mistakes.map((item: string, idx: number) => (
                          <li key={idx} className="text-sm leading-6 text-gray-600 flex gap-3">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#FF5722] flex-shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {sourceSummary.actions?.length > 0 && (
                    <div className="rounded-2xl border border-amber-100 bg-white p-4">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-amber-500 font-black mb-2">下一步行动</div>
                      <ul className="space-y-2">
                        {sourceSummary.actions.map((item: string, idx: number) => (
                          <li key={idx} className="text-sm leading-6 text-gray-600 flex gap-3">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#1a73e8] flex-shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {difyOutput && (
              <div className="rounded-3xl bg-gradient-to-br from-white via-[#fbfdff] to-[#f7fbff] border border-[#e5eef8] p-6 shadow-[0_18px_50px_-24px_rgba(26,115,232,0.22)]">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <h4 className="text-xl font-black text-[#202124]">Dify 返回结果</h4>
                    <p className="text-xs text-gray-500 mt-1">Markdown 已拆分成更易读的卡片结构</p>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-[#1a73e8] bg-[#e8f0fe] px-3 py-1 rounded-full">live output</span>
                </div>

                <div className="space-y-4">
                  {difyMarkdownSections.length > 0 ? (
                    difyMarkdownSections.map((section) => (
                      <div key={section.title} className="rounded-2xl border border-[#e8eef7] bg-white p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="h-2.5 w-2.5 rounded-full bg-[#1a73e8]" />
                          <h5 className="text-base font-bold text-[#202124]">{section.title}</h5>
                        </div>
                        <ul className="space-y-2">
                          {section.bullets.length > 0 ? (
                            section.bullets.map((bullet, idx) => (
                              <li key={`${section.title}-${idx}`} className="text-sm leading-6 text-gray-600 flex gap-3">
                                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#FF5722] flex-shrink-0" />
                                <span>{bullet}</span>
                              </li>
                            ))
                          ) : (
                            <li className="text-sm leading-6 text-gray-600 whitespace-pre-wrap">{section.title}</li>
                          )}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <pre className="text-xs leading-5 text-gray-600 bg-[#f8f9fa] rounded-2xl p-4 overflow-auto max-h-[320px] whitespace-pre-wrap">{difyOutput}</pre>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModuleWrapper>
  );
}
