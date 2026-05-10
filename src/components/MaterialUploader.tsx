import React, { useState } from 'react';
import { CheckCircle2, FileText, Link as LinkIcon, Loader2, UploadCloud } from 'lucide-react';
import { callVocabPurify } from '../services/difyAPI';
import { addWord } from '../services/vocabAPI';

interface MaterialUploaderProps {
  topicHint?: string;
  onUploadSuccess?: () => void;
}

export default function MaterialUploader({ topicHint = '政商务外刊/信函', onUploadSuccess }: MaterialUploaderProps) {
  const [materialText, setMaterialText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!materialText.trim()) return;
    setIsSubmitting(true);
    setIsSuccess(false);
    setStatusMsg('Dify 引擎深层提纯中...');

    try {
      const parsedData = await callVocabPurify({ article_text: materialText.trim() });
      setStatusMsg('提纯完成，正在写入政商务生词本...');

      const words = Array.isArray(parsedData.words) ? parsedData.words : [];
      for (const w of words) {
        await addWord({
          word: w.word,
          dictType: 'dify_extracted',
          category: 'business',
          payload: {
            phonetic: w.phonetic,
            pos: w.pos,
            meaning: w.zh_meaning,
            related_phrases: parsedData.phrases || [],
            related_sentences: parsedData.sentences || [],
          },
        });
      }

      setStatusMsg(`成功入库 ${words.length} 个高阶词汇`);
      setMaterialText('');
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setStatusMsg('');
      }, 3000);

      if (onUploadSuccess) onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setStatusMsg(`处理失败: ${e?.message || '未知错误'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center">
          <UploadCloud className="w-4 h-4 mr-2 text-[#FF5722]" /> 
          战术素材投喂口
        </h4>
        <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-1 rounded font-bold uppercase">{topicHint}</span>
      </div>
      
      <textarea
        rows={5}
        value={materialText}
        onChange={(e) => setMaterialText(e.target.value)}
        className="w-full bg-[#f8f9fa] border-2 border-transparent focus:border-[#FF5722]/30 focus:bg-white rounded-2xl p-4 text-sm text-[#202124] outline-none resize-none transition-all placeholder-gray-400 mb-4"
        placeholder="粘贴外部的长文、宏观报告或跨国会议录音文本... Dify 将自动提纯商业黑话，并写入左侧的「政商务区」生词本。"
      />
      
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button className="p-2 bg-gray-50 text-gray-400 hover:text-[#1a73e8] rounded-xl transition-colors" title="URL 抓取 (规划中)">
            <LinkIcon className="w-4 h-4" />
          </button>
          <button className="p-2 bg-gray-50 text-gray-400 hover:text-[#FF5722] rounded-xl transition-colors" title="PDF 上传">
            <FileText className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-4">
          {statusMsg && (
            <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center ${isSuccess ? 'text-emerald-500' : 'text-gray-400'}`}>
              {isSuccess && <CheckCircle2 className="w-3 h-3 mr-1" />}
              {statusMsg}
            </span>
          )}
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting || !materialText.trim()}
            className="px-6 py-2.5 bg-[#202124] text-white text-xs font-black tracking-widest uppercase rounded-full hover:bg-[#FF5722] transition-colors disabled:opacity-50 flex items-center"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isSubmitting ? '引擎解析中' : '执行提纯'}
          </button>
        </div>
      </div>
    </div>
  );
}
