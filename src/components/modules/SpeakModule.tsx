import React, { useState, useEffect } from 'react';
import { Play, Loader2, ShieldAlert, Target, GitBranch, Zap } from 'lucide-react';
import { runSpeakInfluenceEngine, SpeakInfluenceResult } from '../../services/difyAPI';

export default function SpeakModule() {
  const [trainingMode, setTrainingMode] = useState<'结构化表达' | '精准提问' | '即兴反击'>('结构化表达');
  const [scenario, setScenario] = useState('');
  const [userRole, setUserRole] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [userInput, setUserInput] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SpeakInfluenceResult | null>(null);

  // 弹框相关状态：触发声光电提示
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  // 自动隐藏提示框（3秒）
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
  };

  const handleSubmit = async () => {
    if (!scenario || !userRole || !targetAudience || !userInput) {
      triggerToast('请填写完整的上下文信息！');
      return;
    }
    
    setIsLoading(true);
    setResult(null);
    setShowToast(false); // 提交时清除旧错误提示

    try {
      const response = await runSpeakInfluenceEngine({
        training_mode: trainingMode,
        scenario,
        user_role: userRole,
        target_audience: targetAudience,
        user_input: userInput
      });
      setResult(response);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Dify API 调用失败";
      console.error(msg, error);
      triggerToast(`评估失败: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto pr-2">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center">
          <ShieldAlert className="w-6 h-6 mr-2 text-indigo-600" />
          破局系统（说）：高阶影响力与精准提问
        </h2>
        <p className="text-slate-500 text-sm mb-6">
          基于权力动态的降维沟通训练。不学废话，只练在关键时刻能稳住底盘、主导局面的结构化话术。
        </p>

        {/* 训练模式选择 */}
        <div className="flex space-x-4 mb-6">
          {(['结构化表达', '精准提问', '即兴反击'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setTrainingMode(mode)}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                trainingMode === mode
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {mode === '结构化表达' && <GitBranch className="w-4 h-4 mr-2" />}
              {mode === '精准提问' && <Target className="w-4 h-4 mr-2" />}
              {mode === '即兴反击' && <ShieldAlert className="w-4 h-4 mr-2" />}
              {mode}
            </button>
          ))}
        </div>

        {/* 上下文环境设定 */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">沟通场景</label>
            <input
              type="text"
              placeholder="例：跨部门资源协调会"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">你的身份</label>
            <input
              type="text"
              placeholder="例：项目经理、科员"
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">受众身份</label>
            <input
              type="text"
              placeholder="例：业务处长、外企高管"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* 话术输入 */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            你的原始话术 / 应对策略
          </label>
          <textarea
            rows={4}
            placeholder="把你想说的话、或者面对质问时你的第一反应写下来..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
          />
        </div>

        {/* 提交按钮与悬浮声光电提示层 */}
        <div className="relative">
          {/* 声光电悬浮提示框 */}
          {showToast && (
            <div className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 min-w-[320px] z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* 声光电外发光与动态渐变边框 */}
              <div className="relative p-[2px] rounded-xl bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500 shadow-[0_0_20px_rgba(244,63,94,0.7)] animate-pulse">
                {/* 内部深色主体容器 */}
                <div className="bg-slate-900 rounded-[10px] px-5 py-3 flex items-center justify-center space-x-3">
                  <Zap className="w-6 h-6 text-yellow-400 animate-bounce drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" fill="currentColor" />
                  <span className="text-white text-sm font-bold tracking-wider">{toastMsg}</span>
                  <Zap className="w-6 h-6 text-yellow-400 animate-bounce drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" fill="currentColor" />
                </div>
                {/* 底部倒三角箭头 */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900 rotate-45 border-r-2 border-b-2 border-indigo-500/50"></div>
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 transition-all duration-300 disabled:opacity-70 relative overflow-hidden group"
          >
            {/* 按钮 hover 时的炫光效果 */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-20 transition-opacity duration-500"></div>
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin relative z-10" />
                <span className="relative z-10">高阶推演中...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2 relative z-10" />
                <span className="relative z-10">提交教练评估</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 评估结果展示区 */}
      {result && (
        <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-800">教练深度剖析</h3>
            <div className="flex items-center bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              <span className="text-sm font-semibold text-emerald-700 mr-2">分寸与逻辑战力:</span>
              <span className="text-lg font-black text-emerald-600">{result.score}</span>
              <span className="text-xs text-emerald-600 ml-1">/ 100</span>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-bold text-rose-600 mb-2 flex items-center">
                <span className="w-1.5 h-4 bg-rose-500 rounded-full mr-2"></span>
                破绽与失分点 (Critique)
              </h4>
              <p className="text-slate-700 text-sm leading-relaxed bg-rose-50/50 p-4 rounded-lg border border-rose-100">
                {result.critique}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-bold text-indigo-600 mb-2 flex items-center">
                <span className="w-1.5 h-4 bg-indigo-500 rounded-full mr-2"></span>
                高维策略重构 (Framework Analysis)
              </h4>
              <p className="text-slate-700 text-sm leading-relaxed bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                {result.framework_analysis}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-bold text-emerald-600 mb-2 flex items-center">
                <span className="w-1.5 h-4 bg-emerald-500 rounded-full mr-2"></span>
                满分实战话术 (Golden Script)
              </h4>
              <div className="bg-emerald-50 p-5 rounded-lg border border-emerald-200 relative">
                <span className="absolute top-2 left-2 text-4xl text-emerald-200 font-serif leading-none">"</span>
                <p className="text-emerald-900 text-base font-medium leading-relaxed relative z-10 pl-4">
                  {result.revised_version}
                </p>
                <span className="absolute bottom-[-10px] right-4 text-4xl text-emerald-200 font-serif leading-none">"</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
