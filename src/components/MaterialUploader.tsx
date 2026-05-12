import React, { useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, UploadCloud } from 'lucide-react';
import { uploadMaterialToKB } from '../services/difyAPI';

interface MaterialUploaderProps {
  topicHint?: string;
  onUploadSuccess?: () => void;
}

export default function MaterialUploader({ topicHint = '政商务外刊/信函', onUploadSuccess }: MaterialUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getPureTopic = () => topicHint.split('-')[1]?.trim() || topicHint;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isUploading) return;

    setIsUploading(true);
    setUploadStatus('idle');
    setErrorMessage('');

    try {
      await uploadMaterialToKB(file, getPureTopic());
      setUploadStatus('success');
      if (onUploadSuccess) onUploadSuccess();
      setTimeout(() => setUploadStatus('idle'), 3500);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '上传失败，请检查网络或配置');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="bg-[#202124] rounded-[2rem] p-8 text-white relative overflow-hidden mt-8">
      <div className="absolute top-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h4 className="text-sm font-black uppercase tracking-widest text-blue-400 mb-2 flex items-center">
            <UploadCloud className="w-5 h-5 mr-2" />
            实战语料投喂 (Target Material)
          </h4>
          <p className="text-xs text-gray-400 font-medium leading-relaxed">
            当前绑定主题：<span className="text-white">{topicHint}</span>
            <br />支持 PDF / Word / TXT。上传后 Dify 将自动完成高质分块与向量化。
          </p>
        </div>

        <div className="flex-shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.txt,.md"
            className="hidden"
            id="material-upload"
            disabled={isUploading}
          />
          <label
            htmlFor="material-upload"
            className={`flex items-center justify-center px-6 py-3 rounded-xl text-xs font-black tracking-widest uppercase transition-all shadow-lg
              ${isUploading ? 'bg-gray-700 text-gray-400 cursor-not-allowed' :
                uploadStatus === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-pointer' :
                'bg-white text-[#202124] hover:bg-gray-200 cursor-pointer'}`}
          >
            {isUploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 解析向量化中...</>
            ) : uploadStatus === 'success' ? (
              <><CheckCircle2 className="w-4 h-4 mr-2" /> 投喂成功</>
            ) : (
              <><FileText className="w-4 h-4 mr-2" /> 选择本地文档</>
            )}
          </label>
        </div>
      </div>

      {uploadStatus === 'error' && (
        <div className="relative z-10 mt-4 text-[10px] text-red-400 font-bold bg-red-400/10 px-4 py-2 rounded-lg border border-red-400/20">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
