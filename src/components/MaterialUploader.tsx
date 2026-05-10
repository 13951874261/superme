import React, { useState } from 'react';
import { UploadCloud, Link as LinkIcon, FileText } from 'lucide-react';
import { createMaterialIngestJob, uploadMaterialDocument } from '../services/trainingAPI';

interface MaterialUploaderProps {
  topicHint?: string;
  onUploadSuccess?: () => void;
}

export default function MaterialUploader({ topicHint = '政商务外刊/信函', onUploadSuccess }: MaterialUploaderProps) {
  const [materialText, setMaterialText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!materialText.trim()) return;
    setIsSubmitting(true);
    try {
      await createMaterialIngestJob({
        userId: 'default-user',
        sourceType: 'text',
        sourceName: `${topicHint} - 文本投喂`,
        sourceText: materialText.trim(),
        topic: topicHint,
      });
      setMaterialText('');
      if (onUploadSuccess) onUploadSuccess();
    } catch (e) {
      console.error(e);
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
        rows={4}
        value={materialText}
        onChange={(e) => setMaterialText(e.target.value)}
        className="w-full bg-[#f8f9fa] border-2 border-transparent focus:border-[#FF5722]/30 focus:bg-white rounded-2xl p-4 text-sm text-[#202124] outline-none resize-none transition-all placeholder-gray-400 mb-4"
        placeholder="粘贴外部的商务邮件、外刊长文或会议录音文本...系统将自动提纯生词与结构。"
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
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting || !materialText.trim()}
          className="px-6 py-2.5 bg-[#202124] text-white text-xs font-black tracking-widest uppercase rounded-full hover:bg-[#FF5722] transition-colors disabled:opacity-50"
        >
          {isSubmitting ? '解析入库中...' : '提交提纯'}
        </button>
      </div>
    </div>
  );
}
