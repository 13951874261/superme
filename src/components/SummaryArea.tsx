import React, { useEffect, useState } from 'react';
import { Sparkles, Send, Bot, PenLine } from 'lucide-react';
import { getTrainingSessionByDate, upsertDailyReview } from '../services/trainingAPI';

interface SummaryAreaProps {
  selectedDate: string;
}

export default function SummaryArea({ selectedDate }: SummaryAreaProps) {
  const [sessionId, setSessionId] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [nextFocus, setNextFocus] = useState('明日重点：继续训练谬误识别与反问句构造。');
  const [reflection, setReflection] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const detail = await getTrainingSessionByDate({
          userId: 'default-user',
          trainingDate: selectedDate,
        });
        setSessionId(detail.session?.id || '');
        const attempts = detail.attempts || [];
        const avgScore =
          attempts.length > 0
            ? Math.round(attempts.reduce((acc, it) => acc + (Number(it?.score) || 0), 0) / attempts.length)
            : 0;
        const autoSummary =
          attempts.length > 0
            ? `当日已完成 ${attempts.length} 次训练，平均效率评分 ${avgScore}/10。建议聚焦“角色层级判断 + 谬误识别”联合练习。`
            : '今日尚无训练提交，先完成至少 1 次场景拆解以生成有效复盘。';
        setSummaryText(detail.review?.summary || autoSummary);
        if (detail.review?.next_day_focus) setNextFocus(detail.review.next_day_focus);
      } catch {
        setSummaryText('复盘数据加载失败，请确认后端服务可用。');
      }
    };
    init();
  }, [selectedDate]);

  const handleSaveReview = async () => {
    if (!sessionId) return;
    try {
      setSaving(true);
      const mergedSummary = reflection.trim()
        ? `${summaryText}\n\n用户补充反思：${reflection.trim()}`
        : summaryText;
      await upsertDailyReview({
        sessionId,
        userId: 'default-user',
        trainingDate: selectedDate,
        summary: mergedSummary,
        accuracyByTag: {},
        nextDayFocus: nextFocus,
        efficiencyScore: 7,
      });
      setSummaryText(mergedSummary);
      setReflection('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full relative px-2 mb-20">
      {/* 康奈尔底栏标题注记 */}
      <div className="absolute -top-3 left-10 bg-[#fafafa] px-6 text-[11px] font-black tracking-[0.2em] text-[#FF5722] uppercase border-l-4 border-[#FF5722] z-10 shadow-sm">
        Cornell Summary Area
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-4 border-gray-100 rounded-[2rem] p-8 md:p-12 hover:border-[#FF5722]/20 transition-colors duration-500 bg-white relative">
        
        {/* 左半区：每周实践复盘 (AI总结区) */}
        <div className="flex flex-col border-b md:border-b-0 md:border-r border-gray-100 md:pr-12 md:pb-0 pb-10">
          <h3 className="font-black text-[#202124] mb-4 flex items-center text-xl tracking-tight">
            <Bot className="w-5 h-5 mr-3 text-[#FF5722]" strokeWidth={2.5} />
            专属复盘与弱点扫描
          </h3>
          <p className="text-[11px] text-gray-400 mb-8 font-bold tracking-[0.1em] uppercase">
            AI 汇总进度 / 总结思维漏洞 / 定向深化建议
          </p>
          
          <div className="flex-1 bg-gray-50 rounded-2xl p-6 text-sm text-[#202124] leading-relaxed font-medium min-h-[200px] border border-gray-100 shadow-inner group transition-all hover:bg-white">
             <div className="flex items-center text-[#FF5722] mb-3 text-xs font-bold font-mono">
                <Sparkles className="w-3 h-3 mr-2 animate-pulse" />
                ANALYZING WEEKLY DATA...
             </div>
             {summaryText}
             <div className="mt-4 text-xs text-gray-500"> {nextFocus} </div>
          </div>
        </div>

        {/* 右半区：个人随笔与专属智能体对话 (私人陪伴) */}
        <div className="flex flex-col md:pl-4">
          <h3 className="font-black text-[#202124] mb-4 flex items-center text-xl tracking-tight">
            <PenLine className="w-5 h-5 mr-3 text-[#FF5722]" strokeWidth={2.5} />
            每周夜话与心智投喂
          </h3>
          <p className="text-[11px] text-gray-400 mb-8 font-bold tracking-[0.1em] uppercase">
            私密沉淀 / 读书感想 / 智能体人格喂养
          </p>
          
          <div className="flex-1 flex flex-col relative w-full group">
            <textarea 
              rows={6} 
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              className="w-full bg-[#f1f3f4] border-2 border-transparent rounded-2xl p-5 text-sm text-[#202124] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FF5722]/10 focus:border-[#FF5722] mb-6 transition-all duration-300 resize-none leading-relaxed placeholder-gray-400 font-medium" 
              placeholder="记录这周的内心感悟，或是你刚读完的书的启发。你越吐露真言，这个 AI 就越能与您的潜意识同频同构..."
            />
            
            <button
              onClick={handleSaveReview}
              disabled={saving}
              className="w-full mt-auto bg-[#202124] hover:bg-[#FF5722] text-white py-4 rounded-full text-xs font-bold tracking-[0.15em] uppercase flex items-center justify-center transition-all duration-300 shadow-[0_4px_14px_rgba(0,0,0,0.08)] hover:shadow-[0_6px_20px_rgba(255,87,34,0.3)] disabled:opacity-60"
            >
              <Send className="w-4 h-4 mr-3" strokeWidth={2.5} />
              {saving ? '保存中...' : '上传心智与反思至专属分身'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
