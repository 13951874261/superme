import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Mic, Loader2, History, ChevronDown, CheckCircle, AlertCircle, Volume2 } from 'lucide-react';
import { transcribeAudio } from '../../services/listeningAPI';

interface PronunciationTrainerProps {
  initialNotes: string;
  onNotesChange: (notes: string) => void;
  userId?: string;
}

interface AssessmentResult {
  score: number;
  phonetic?: string;
  issueType?: string;
  analysis?: string;
  suggestion?: string;
  correctionNote?: string;
  target_text: string;
  recognized_text: string;
}

export default function PronunciationTrainer({ initialNotes, onNotesChange, userId = 'default-user' }: PronunciationTrainerProps) {
  const [targetText, setTargetText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);
  const [localNotes, setLocalNotes] = useState(initialNotes);
  const [toast, setToast] = useState<{show: boolean, message: string}>({show: false, message: ''});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [lastResult, setLastResult] = useState<AssessmentResult | null>(null);

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast(t => ({ ...t, show: false }));
    }, 3000);
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // 同步外部状态
  useEffect(() => {
    if (initialNotes !== localNotes) {
      setLocalNotes(initialNotes);
    }
  }, [initialNotes]);

  // 解析历史记录
  const records = useMemo(() => {
    if (!localNotes.trim()) return [];
    // 匹配类似 [14:20:05] 的时间戳作为分隔符
    const parts = localNotes.split(/(?=\[\d{1,2}:\d{2}:\d{2}\])/).filter(p => p.trim());
    if (parts.length === 0) return [{ id: '0', title: '默认记录', content: localNotes }];
    return parts.map((p, i) => {
      const match = p.match(/^\[(.*?)\] 目标: (.*?)\n/);
      const title = match ? `${match[1]} - ${match[2]}` : `记录 ${i + 1}`;
      return { id: i.toString(), title, content: p.trim() };
    });
  }, [localNotes]);

  const handleNotesEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (records.length === 0) {
      setLocalNotes(val);
      onNotesChange(val);
      return;
    }
    const updatedRecords = [...records];
    updatedRecords[selectedIndex] = { ...updatedRecords[selectedIndex], content: val };
    const newNotes = updatedRecords.map(r => r.content).join('\n\n');
    setLocalNotes(newNotes);
    onNotesChange(newNotes);
  };

  const startRecording = async () => {
    if (!targetText.trim()) {
      showToast('请先输入您要练习的目标单词或句子！');
      return;
    }
    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      const mediaRecorder = new MediaRecorder(streamRef.current);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleAssessment(audioBlob);
        // 核心修复：绝对不要在这里 stop track！保持麦克风热启动状态，实现零延迟按住即录
        // stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('无法访问麦克风:', err);
      showToast('无法访问麦克风，请检查浏览器权限设置。');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAssessment = async (audioBlob: Blob) => {
    setIsAssessing(true);
    setLastResult(null);
    try {
      const recognizedText = await transcribeAudio(audioBlob);

      const response = await fetch(`/api/pronunciation-assessment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetText,
          recognizedText,
          userId
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || '发音诊断失败');
      }

      const result: AssessmentResult = {
        score: data.score || 0,
        phonetic: data.phonetic,
        issueType: data.issueType,
        analysis: data.analysis,
        suggestion: data.suggestion,
        correctionNote: data.correctionNote,
        target_text: targetText,
        recognized_text: recognizedText || '',
      };
      setLastResult(result);

      // 生成笔记内容（仅记录核心信息，避免与卡片重复）
      const noteLines = [
        `[${new Date().toLocaleTimeString()}] 练习: ${targetText}`,
        `识别: ${recognizedText || '无法识别'}`,
        `评分: ${data.score}分`
      ].filter(Boolean);

      const newNote = noteLines.join('\n') + '\n';
      const updatedNotes = newNote + localNotes;
      setLocalNotes(updatedNotes);
      onNotesChange(updatedNotes);
      setSelectedIndex(0); // 自动选中最新的一条
      setTargetText('');

    } catch (err: any) {
      console.error('发音评估请求失败:', err);
      showToast(err.message || '诊断失败，请重试');
    } finally {
      setIsAssessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* 顶部操作区 */}
      <div className="flex gap-2 items-center relative">
        {toast.show && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#202124] border border-[#FF5722]/30 text-white text-xs px-4 py-2 rounded-lg shadow-[0_4px_12px_rgba(255,87,34,0.15)] z-50 whitespace-nowrap animate-fade-in-up flex items-center gap-2 transition-opacity duration-300">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5722] animate-pulse"></span>
            {toast.message}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#202124] rotate-45 border-r border-b border-[#FF5722]/30"></div>
          </div>
        )}
        <input
          type="text"
          value={targetText}
          onChange={(e) => setTargetText(e.target.value)}
          placeholder="输入想练的词 (如 leverage)"
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FF5722]/50 transition-colors"
          disabled={isRecording || isAssessing}
        />
        
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onMouseLeave={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          disabled={isAssessing}
          className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            isRecording 
              ? 'bg-red-500 text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
              : isAssessing
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-[#FF5722] text-white hover:bg-[#FF5722]/80'
          }`}
          title="按住录音，松开诊断"
        >
          {isAssessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Mic className={`w-5 h-5 ${isRecording ? 'animate-bounce' : ''}`} />
          )}
        </button>
      </div>

      {/* 历史记录选择器 */}
      {records.length > 0 && (
        <div className="relative">
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center justify-between bg-black/30 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-gray-300 hover:bg-black/50 transition-colors"
          >
            <div className="flex items-center gap-2 truncate">
              <History className="w-3.5 h-3.5 text-[#FF5722]" />
              <span className="truncate">{records[selectedIndex]?.title || '选择历史记录'}</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#2a2b2f] border border-white/10 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
              {records.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelectedIndex(i);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors border-b border-white/5 last:border-0 ${
                    i === selectedIndex ? 'bg-[#FF5722]/20 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {r.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 内容展示区：使用自适应高度，通过 rows=6 保证初始可见度 */}
      <div className="flex-1 relative mt-1">
        <textarea
          value={records.length > 0 ? records[selectedIndex]?.content : localNotes}
          onChange={handleNotesEdit}
          onClick={(e) => e.stopPropagation()}
          rows={6}
          className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-sm text-white/90 placeholder-gray-600 outline-none resize-y focus:border-white/20 transition-colors"
          placeholder="录音后的 AI 诊断结果将自动填充于此，您也可以手动补充笔记..."
        />
        {isAssessing && (
          <div className="absolute inset-0 bg-black/50 rounded-xl flex flex-col items-center justify-center backdrop-blur-sm z-10">
            <div className="flex items-center gap-2 text-[#FF5722] font-semibold text-xs tracking-widest uppercase">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>AI 诊断中...</span>
            </div>
          </div>
        )}
      </div>

      {/* 结构化评测结果展示 */}
      {lastResult && (
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 border border-white/10">
          {/* 头部：得分和音标 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {/* 得分圆环 */}
              <div className="relative w-16 h-16">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="stroke-[#333] stroke-[3]"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={`stroke-[3] ${
                      lastResult.score >= 80 ? 'stroke-green-500' :
                      lastResult.score >= 60 ? 'stroke-yellow-500' : 'stroke-red-500'
                    }`}
                    strokeDasharray={`${lastResult.score}, 100`}
                    strokeLinecap="round"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-lg font-bold ${
                    lastResult.score >= 80 ? 'text-green-400' :
                    lastResult.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {lastResult.score}
                  </span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-lg">{lastResult.target_text}</span>
                  {lastResult.phonetic && (
                    <span className="text-gray-400 text-sm flex items-center gap-1">
                      <Volume2 className="w-3 h-3" />
                      {lastResult.phonetic}
                    </span>
                  )}
                </div>
                <div className="text-gray-400 text-xs mt-0.5">
                  识别: {lastResult.recognized_text || '无法识别'}
                </div>
              </div>
            </div>
            {/* 问题类型标签 */}
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              lastResult.issueType === 'vowel' ? 'bg-blue-500/20 text-blue-400' :
              lastResult.issueType === 'consonant' ? 'bg-purple-500/20 text-purple-400' :
              lastResult.issueType === 'stress' ? 'bg-orange-500/20 text-orange-400' :
              lastResult.issueType === 'rhythm' ? 'bg-cyan-500/20 text-cyan-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {{
                vowel: '元音',
                consonant: '辅音',
                stress: '重音',
                rhythm: '节奏',
                other: '综合'
              }[lastResult.issueType || 'other'] || '综合'}
            </span>
          </div>

          {/* 分析和建议 */}
          <div className="space-y-2">
            {lastResult.analysis && (
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[#FF5722] mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-gray-400 text-xs mb-0.5">问题分析</div>
                  <div className="text-white/90 text-sm">{lastResult.analysis}</div>
                </div>
              </div>
            )}
            {lastResult.suggestion && (
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-gray-400 text-xs mb-0.5">改进建议</div>
                  <div className="text-white/90 text-sm">{lastResult.suggestion}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
