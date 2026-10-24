import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, FileText, CheckCircle2, AlertTriangle, UploadCloud } from 'lucide-react';
import { addCustomTheme } from '../../../../services/trainingAPI';
import { playSuccess, playError } from '../../../../utils/soundEffects';

interface CustomThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newThemeName: string) => void;
}

export default function CustomThemeModal({ isOpen, onClose, onSuccess }: CustomThemeModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [themeName, setThemeName] = useState('');
  const [file, setFile] = useState<{ fileName: string; content: string } | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [extractedResult, setExtractedResult] = useState<{
    displayName: string;
    addedWordsCount: number;
    addedPhrasesCount: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('文件大小不能超过 10MB');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const base64Content = reader.result as string;
      setFile({
        fileName: selectedFile.name,
        content: base64Content,
      });
      setStep(2);
    };
    reader.onerror = () => {
      setError('读取文件失败，请重试');
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleStartProcess = async () => {
    if (!themeName.trim()) {
      setError('请输入场景主题名称');
      return;
    }
    if (!file && !manualInput.trim()) {
      setError('请先上传场景材料文件，或直接手动输入材料文本');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProcessStatus('正在解析上传文件…');

    try {
      setProcessStatus('正在上传并整理场景材料…');
      
      let payloadFile = file;
      if (!payloadFile && manualInput.trim()) {
        const utf8Encoder = new TextEncoder();
        const bytes = utf8Encoder.encode(manualInput.trim());
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Content = 'data:text/plain;base64,' + btoa(binary);
        payloadFile = { fileName: 'manual_input.txt', content: base64Content };
      }

      const res = await addCustomTheme({
        themeName: themeName.trim(),
        file: payloadFile!,
      });

      if (res.success) {
        playSuccess();
        setExtractedResult({
          displayName: res.theme.displayName || res.theme.themeName || themeName.trim(),
          addedWordsCount: res.addedWordsCount || 0,
          addedPhrasesCount: res.addedPhrasesCount || 0,
        });
        setStep(3);
      } else {
        throw new Error('创建自定义场景主题失败');
      }
    } catch (err: any) {
      playError();
      const errorMsg = err.message || '自定义场景创建中发生异常';
      console.error('[CustomThemeModal] 创建失败:', err);
      setError((errorMsg ? `${errorMsg}。` : '') + '请稍后重试；若仍失败，请联系管理员检查服务是否正常。');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (extractedResult) {
      onSuccess(extractedResult.displayName);
      handleClose();
    }
  };

  const handleClose = () => {
    setStep(1);
    setThemeName('');
    setFile(null);
    setManualInput('');
    setIsProcessing(false);
    setProcessStatus('');
    setError(null);
    setExtractedResult(null);
    onClose();
  };

  return createPortal(
    (
    <div role="dialog" aria-modal="true" aria-label="自定义场景" className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm overscroll-contain animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 w-full max-w-xl text-white shadow-2xl relative overflow-hidden">
        {/* 背景光效 */}
        <div className="absolute -right-24 -top-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-24 -bottom-24 w-60 h-60 bg-[#FF5722]/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* 顶部标题与关闭 */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <h4 className="text-base font-black tracking-widest uppercase">
              创建自定义练习场景 <span className="text-indigo-400">// Custom Theme</span>
            </h4>
          </div>
          <button type="button" aria-label="关闭自定义场景" onClick={handleClose} className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-slate-800 rounded-lg"
          >
            <X aria-hidden="true" className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 mt-4 p-3.5 bg-red-950/40 border border-red-800/60 text-red-300 rounded-2xl text-xs font-medium animate-[fadeIn_0.15s_ease-out]" role="alert">
            <AlertTriangle aria-hidden="true" className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* 步骤内容 */}
        <div className="py-6 space-y-5">
          {step === 1 && (
            <div className="space-y-4 animate-[fadeIn_0.15s_ease-out]">
              <div className="space-y-2">
                <label htmlFor="custom-theme-name" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Step 1: 命名您的练习主题</label>
                <input
                  id="custom-theme-name"
                  type="text"
                  placeholder="例如：Tesla Q3 Earnings Call"
                  value={themeName}
                  onChange={(e) => {
                    setThemeName(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full bg-slate-800/60 border border-slate-800 focus-visible:border-indigo-500 rounded-2xl px-5 py-3.5 text-sm font-bold placeholder-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 transition-[border-color,box-shadow,background-color]"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="custom-theme-manual" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Step 2: 上传您的学习材料</label>
                
                {!file && (
                <div className="mb-3">
                  <textarea
                    id="custom-theme-manual"
                    value={manualInput}
                    onChange={(e) => {
                      setManualInput(e.target.value);
                      if (error) setError(null);
                    }}
                    aria-label="手动输入学习材料"
                    placeholder="或直接粘贴/输入您的自定义学习路线、场景背景描述或词条知识点（输入后点击下方按钮进入下一步）"
                    rows={4}
                    className="w-full bg-slate-800/60 border border-slate-800 focus-visible:border-indigo-500 rounded-2xl px-4 py-3 text-xs font-medium placeholder-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 transition-[border-color,box-shadow,background-color] resize-none"
                  />
                  {manualInput.trim() && (
                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="px-4 py-1.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase rounded-lg hover:bg-indigo-500/30 transition-colors"
                      >
                        使用此文本材料 →
                      </button>
                    </div>
                  )}
                </div>
                )}
                
                <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-8 text-center bg-slate-800/20 hover:bg-slate-800/40 transition-colors relative cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.md"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <p className="text-xs font-bold text-slate-200">点击或拖拽上传 PDF/DOCX/TXT/MD</p>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">支持格式: .pdf .docx .txt .md (最大 10MB)</p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (file || manualInput.trim()) && (
            <div className="space-y-5 animate-[fadeIn_0.15s_ease-out]">
              <div className="bg-slate-800/40 border border-slate-800/60 rounded-2xl p-4 flex items-center gap-3">
                <FileText className="w-8 h-8 text-indigo-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black truncate">{file?.fileName || '手动输入文本材料'}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">文件已读取，准备整理场景材料</p>
                </div>
              </div>

              {isProcessing ? (
                <div className="flex flex-col items-center justify-center py-6 gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider animate-pulse">{processStatus}</span>
                </div>
              ) : (
                <button
                  onClick={handleStartProcess}
                  className="w-full bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white font-black py-4.5 rounded-2xl text-xs uppercase tracking-widest transition-colors cursor-pointer shadow-lg shadow-[var(--color-brand)]/15"
                >
                  开始上传并整理场景
                </button>
              )}
            </div>
          )}

          {step === 3 && extractedResult && (
            <div className="space-y-5 animate-[fadeIn_0.15s_ease-out]">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h5 className="text-sm font-black text-emerald-300">自定义场景创建成功！</h5>
                <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                  已根据你的材料整理出常用商业词和短句
                </p>
              </div>

              <div className="bg-slate-800/40 border border-slate-800/60 rounded-2xl p-5 space-y-3.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold">优化后的场景名</span>
                  <span className="font-black text-slate-200">{extractedResult.displayName}</span>
                </div>
                <div className="w-full h-px bg-slate-800/80" />
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold">整理出的核心词汇</span>
                  <span className="font-black text-indigo-400">{extractedResult.addedWordsCount} 个</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold">整理出的实用短句</span>
                  <span className="font-black text-emerald-400">{extractedResult.addedPhrasesCount} 个</span>
                </div>
              </div>

              <button
                onClick={handleConfirm}
                className="w-full bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white font-black py-4.5 rounded-2xl text-xs uppercase tracking-widest transition-colors cursor-pointer shadow-lg shadow-[var(--color-brand)]/15"
              >
                确认并立即进入此场景
              </button>
            </div>
          )}
        </div>

        {/* 底部取消 */}
        {step !== 3 && !isProcessing && (
          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              onClick={handleClose}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black uppercase tracking-widest rounded-xl transition-colors cursor-pointer"
            >
              取消
            </button>
          </div>
        )}
      </div>
    </div>
    ),
    document.body
  );
}
