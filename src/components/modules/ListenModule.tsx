import React, { useState } from 'react';
import { BlindListeningCabin } from '../BlindListeningCabin';
import { runListeningEngine } from '../../services/listeningAPI';
import { ComparisonResult } from '../../types/listening';

export default function ListenModule({ selectedDate }: { selectedDate?: string }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);

  // 生产环境中，该文本由系统从数据库或音频源动态加载
  const standardText = "Let's table this discussion for now. I think we need to align with global before making any commitments.";

  const handleSubmit = async (userDraft: string) => {
    setIsProcessing(true);
    try {
      const analysisData = await runListeningEngine(userDraft, standardText);
      setResult(analysisData);
    } catch (error) {
      console.error(error);
      alert('AI 解析出错，请确保 Dify 服务配置正确。');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* 顶部：盲听舱 */}
      <BlindListeningCabin isProcessing={isProcessing} onSubmit={handleSubmit} />

      {/* 底部：解析结果区（仅在成功比对后解锁展示） */}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up">
          
          {/* 左侧专区：听力纠错与复盘 */}
          <div className="space-y-6">
            <div className="bg-red-50/50 rounded-xl p-6 border border-red-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-red-900">听辨比对</h3>
                <span className="bg-white px-3 py-1 rounded-full text-sm font-semibold text-red-600 shadow-sm">
                  准确率: {result.comparison.accuracy_score}
                </span>
              </div>
              
              <div className="space-y-4">
                {result.comparison.errors.map((err, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-md border border-red-50 shadow-sm">
                    <p className="text-sm line-through text-gray-400">你听到: {err.user_heard}</p>
                    <p className="text-sm font-medium text-red-600 mt-1">原文是: {err.actual_words}</p>
                    <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded">💡 {err.reason}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm font-medium text-red-800 mt-4 italic">
                "{result.comparison.coach_comment}"
              </p>
            </div>
          </div>

          {/* 右侧专区：弦外之音与权力结构 */}
          <div className="space-y-6">
            <div className="bg-blue-50/50 rounded-xl p-6 border border-blue-100">
              <h3 className="font-bold text-blue-900 mb-4">Subtext / 潜台词深度剖析</h3>
              
              <div className="space-y-5">
                <div>
                  <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Surface Meaning</h4>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded-md shadow-sm">{result.subtext_analysis.surface_meaning}</p>
                </div>
                
                <div>
                  <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Hidden Subtext</h4>
                  <p className="text-sm text-gray-800 bg-white p-3 rounded-md border-l-4 border-blue-500 shadow-sm">
                    {result.subtext_analysis.hidden_subtext}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Power Dynamics</h4>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded-md shadow-sm">{result.subtext_analysis.power_dynamics}</p>
                </div>

                {result.subtext_analysis.key_jargons.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Key Jargons / 黑话解码</h4>
                    <ul className="space-y-2">
                      {result.subtext_analysis.key_jargons.map((jargon, idx) => (
                        <li key={idx} className="bg-white p-2 rounded-md shadow-sm flex flex-col">
                          <span className="font-bold text-gray-800 text-sm">{jargon.word}</span>
                          <span className="text-xs text-gray-600 mt-1">{jargon.meaning}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
