import React, { useState } from 'react';
import { useEnglishContext, deriveL3MasteryScore } from '../context/EnglishContext';
import SpeakButton from '../../../SpeakButton';
import Confetti from '../../../Confetti';
import { runEnglishWriteReview } from '../../../../services/difyAPI';
import { createTrainingAttempt, submitTrainingFeedback, checkThemeMastery } from '../../../../services/trainingAPI';
import { playSuccess, playError, playScan } from '../../../../utils/soundEffects';

const ReviewCard = ({ title, content, isLoading, color = 'text-gray-500', isDark = false, optimized = '' }: any) => (
  <div className={`rounded-2xl p-6 border flex-1 ${isDark ? 'bg-[#202124] text-white border-gray-800' : 'bg-white border-gray-100'}`}>
    <h5 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDark ? 'text-[#FF5722]' : color}`}>
      {title}
    </h5>
    {isLoading ? (
      <p className="text-sm text-gray-400 italic">Dify 正在审阅中...</p>
    ) : content ? (
      <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{content}</p>
    ) : (
      <p className="text-sm text-gray-400 italic">等待提交分析...</p>
    )}
    {isDark && optimized && (
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h5 className="text-[10px] font-black uppercase tracking-widest text-[#FF5722]">
            AI 高管级示范文本 (Optimized Version)
          </h5>
          <SpeakButton text={optimized} title="播放 AI 高管级示范文本" />
        </div>
        <p className="text-sm text-gray-300 leading-relaxed italic">{optimized}</p>
      </div>
    )}
  </div>
);

export default function WriteTab() {
  const {
    theme,
    sessionId,
    setMasteryData,
    writingText, setWritingText,
    writeIntent, setWriteIntent,
    isReviewing, setIsReviewing,
    reviewResult, setReviewResult,
    inlineNotice, noticeAnchor, showNotice
  } = useEnglishContext();

  const [isGeneratingChallenge, setIsGeneratingChallenge] = useState(false);
  const [challengeText, setChallengeText] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  const generateChallenge = async () => {
    setIsGeneratingChallenge(true);
    playScan();
    try {
      const { runListenMaterialGenerator } = await import('../../../../services/difyAPI');
      const promptTheme = `【任务生成模式】请针对主题“${theme}”，生成一封极具攻击性或极其刁钻的英文商务邮件/汇报任务，要求用户必须运用高阶沟通技巧来破局回复。只输出邮件正文。`;
      const result = await runListenMaterialGenerator(promptTheme);
      setChallengeText(result);
      setWriteIntent(`回复这封刁钻的邮件/任务，妥善解决 ${theme} 中的冲突`);
      playSuccess();
    } catch (e) {
      playError();
      showNotice('review', '生成任务失败', 'error');
    } finally {
      setIsGeneratingChallenge(false);
    }
  };

  const handleReview = async () => {
    if (!writingText) {
      playError();
      showNotice('review', '请输入您的草稿', 'error');
      return;
    }
    setIsReviewing(true);
    playScan();
    showNotice('review', '提交批阅中...', 'info');
    try {
      const raw = (await runEnglishWriteReview(writingText, writeIntent)) as any;
      const normalized = {
        L1: String(raw.L1_Grammar || raw.L1 || ''),
        L2: String(raw.L2_Business_Tone || raw.L2 || ''),
        L3: String(raw.L3_Strategic_Position || raw.L3 || ''),
        optimized_version: String(raw.optimized_version || ''),
      };
      setReviewResult(normalized);
      showNotice('review', '批阅完成', 'success');

      const l3Score = deriveL3MasteryScore({ ...raw, ...normalized });
      if (sessionId) {
        const att = await createTrainingAttempt({
          sessionId,
          userId: 'default-user',
          moduleType: 'write',
          sceneType: theme,
          caseText: writingText.slice(0, 4000),
          userAnswer: {
            writeLevel: 'L3',
            theme,
            mailIntent: writeIntent.slice(0, 2000),
          },
          durationSeconds: 0,
          score: l3Score,
        });
        await submitTrainingFeedback({
          attemptId: att.attemptId,
          userId: 'default-user',
          decomposition: { L1: normalized.L1, L2: normalized.L2 },
          logicAnalysis: { L3: normalized.L3, writeLevel: 'L3' },
          strengths: '纵深书面 L3 已归档',
          weaknesses: '',
          nextFocus: '继续巩固口语沙盘与书面站位',
          score: l3Score,
          rawResponse: JSON.stringify(raw).slice(0, 12000),
        });
      }
      
      if (l3Score >= 8) {
        playSuccess();
        setShowConfetti(true);
      } else {
        playSuccess();
      }

      checkThemeMastery(theme)
        .then((res) => {
          if (res.success) {
            setMasteryData({
              isMastered: res.isMastered,
              oralCount: res.oralCount,
              maxWriteScore: res.maxWriteScore,
            });
          }
        })
        .catch(() => {});
    } catch (error) {
      playError();
      showNotice('review', '批阅失败，请检查 API 配置或网络', 'error');
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 relative">
      {/* 战术使用指南 SOP */}
      <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5 flex items-start gap-4 shrink-0 shadow-sm">
        <div className="bg-emerald-500 text-white p-2.5 rounded-xl shrink-0 mt-0.5 shadow-sm">
           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </div>
        <div className="flex-1">
          <h5 className="text-[11px] font-black uppercase tracking-widest text-emerald-900 mb-2.5">战术使用指南 // Tactical SOP</h5>
          <div className="text-[13px] text-emerald-800/90 leading-relaxed font-medium flex flex-col gap-1.5">
            <div><span className="font-black text-emerald-600 mr-2">操作说明：</span>获取刁难任务，并在中栏起草商务邮件。左侧战术锦囊可作参考。完成后提交三维批阅。</div>
            <div><span className="font-black text-emerald-600 mr-2">功能亮点：</span>AI 三阶纵深批阅 (L1 基础语法 / L2 商务分寸 / L3 战略站位)。不仅仅是改错，更是教您在文字中构建权力结构。</div>
            <div><span className="font-black text-emerald-600 mr-2">生态定位：</span>【最终审判】调用全盘积累的词汇弹药。必须在 L3 战略站位上取得 8 分以上的高阶评价，方可真正通关当前主题。</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
      {inlineNotice && noticeAnchor === 'review' && (
        <div className={`absolute left-1/2 -translate-x-1/2 -top-3 z-20 rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase shadow-lg border ${inlineNotice.tone === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : inlineNotice.tone === 'error' ? 'bg-red-500 text-white border-red-400' : 'bg-gray-800 text-white border-gray-700'}`}>
          {inlineNotice.text}
        </div>
      )}

      {/* 左栏：战术指南 */}
      <div className="lg:col-span-3 bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm flex flex-col h-[75vh]">
        <h4 className="text-[11px] font-black uppercase tracking-widest text-blue-600 mb-4 border-b border-gray-100 pb-3">
          Tactical Guide // 战术行文指南
        </h4>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
            <h5 className="text-[10px] font-bold text-blue-900 mb-1.5 uppercase tracking-widest">1. 破冰与切入 (Opening)</h5>
            <p className="text-xs text-blue-800 leading-relaxed font-medium">避免寒暄过多。直入正题，例如："I'm writing to directly address the concerns raised..."</p>
          </div>
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50">
            <h5 className="text-[10px] font-bold text-emerald-900 mb-1.5 uppercase tracking-widest">2. 施压分寸 (Pressure Tone)</h5>
            <p className="text-xs text-emerald-800 leading-relaxed font-medium">使用被动语态淡化攻击性，使用情态动词留有余地："It would be appreciated if..."</p>
          </div>
          <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100/50">
            <h5 className="text-[10px] font-bold text-amber-900 mb-1.5 uppercase tracking-widest">3. 找破绽 (Identifying Flaws)</h5>
            <p className="text-xs text-amber-800 leading-relaxed font-medium">指出逻辑断层词：contradiction, ambiguity, oversight。例如："There seems to be an ambiguity in the latest figures..."</p>
          </div>
          <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100/50">
            <h5 className="text-[10px] font-bold text-purple-900 mb-1.5 uppercase tracking-widest">4. 跨文化思维 (Cross-Cultural)</h5>
            <p className="text-xs text-purple-800 leading-relaxed font-medium">美系高管喜好 "Action-oriented"，日系高管偏好 "Consensus-building"。行文注意转换视角。</p>
          </div>
        </div>
      </div>

      {/* 中栏：AI出题与起草 */}
      <div className="lg:col-span-5 bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm flex flex-col h-[75vh]">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-[11px] font-black text-[#202124] uppercase tracking-widest flex items-center">
            Mission Brief // 突发行动指令
          </h4>
          <button onClick={generateChallenge} disabled={isGeneratingChallenge} className="bg-[#FF5722] text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-[#E64A19] transition-colors disabled:opacity-50 cursor-pointer shadow-sm">
            {isGeneratingChallenge ? '正在生成敌情...' : '获取突发刁难任务'}
          </button>
        </div>
        
        <div className="bg-[#202124] text-gray-300 p-5 rounded-2xl text-sm leading-relaxed mb-6 min-h-[120px] font-medium border border-gray-800 shadow-inner overflow-y-auto">
          {challengeText || `点击右上方按钮，让 AI 根据当前阵地【${theme}】为您生成一封需要紧急处理的刁钻邮件或汇报任务。`}
        </div>

        <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">
          Drafting Zone // 纵深书面起草
        </h4>
        <textarea 
          value={writingText} 
          onChange={(e) => setWritingText(e.target.value)} 
          className="w-full bg-[#f8f9fa] border-2 border-transparent focus:border-[#FF5722]/30 rounded-2xl p-5 text-sm text-[#202124] outline-none resize-none leading-relaxed flex-1 shadow-inner placeholder-gray-400" 
          placeholder="在此撰写您的破局回复..." 
        />
        
        <div className="mt-4 shrink-0">
          <button onClick={handleReview} disabled={isReviewing || !writingText} className="bg-[#202124] text-white w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#FF5722] transition-colors disabled:opacity-50 shadow-md cursor-pointer">
            {isReviewing ? 'Dify 正在执行战术审阅...' : '提交三维战略批阅'}
          </button>
        </div>
      </div>

      {/* 右栏：批阅结果 */}
      <div className="lg:col-span-4 flex flex-col gap-4 h-[75vh] overflow-y-auto pr-1">
        <ReviewCard title="L1 语法与措辞" content={reviewResult?.L1} isLoading={isReviewing} />
        <ReviewCard title="L2 商务分寸" content={reviewResult?.L2} isLoading={isReviewing} color="text-[#d84315]" />
        <ReviewCard title="L3 战略站位" content={reviewResult?.L3} isLoading={isReviewing} isDark optimized={reviewResult?.optimized_version} />
      </div>
      </div>
    </div>
  );
}
