import React, { useState, useRef } from 'react';
import { Video, Link, Languages, UploadCloud, FileVideo, AlertTriangle, Play, Sparkles } from 'lucide-react';

interface VideoTranscribePanelProps {
  topicHint?: string;
  onTaskCreated: (taskId: string) => void;
}

const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';

export default function VideoTranscribePanel({ topicHint = '', onTaskCreated }: VideoTranscribePanelProps) {
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('auto');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        setSelectedFile(file);
        setVideoUrl(''); // 选择文件后清除 URL
        setError(null);
      } else {
        setError('仅支持视频文件格式 (如 .mp4, .mkv, .mov)');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setVideoUrl(''); // 选择文件后清除 URL
      setError(null);
    }
  };

  // 辅助函数：将文件转换为 Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSubmit = async () => {
    if (!videoUrl.trim() && !selectedFile) {
      setError('请粘贴视频 URL 或拖入本地视频文件');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSubmitStatus('正在准备任务...');

    try {
      if (selectedFile) {
        let directUploadSuccess = false;
        let taskId = '';

        try {
          // 步骤 1：尝试直接上传
          setSubmitStatus('正在尝试直接上传视频文件...');
          const directFormData = new FormData();
          directFormData.append('video', selectedFile);

          const uploadRes = await fetch(`${API_BASE}/api/materials/upload-direct`, {
            method: 'POST',
            body: directFormData,
          });

          if (!uploadRes.ok) {
            throw new Error(`直接上传失败，HTTP 状态码: ${uploadRes.status}`);
          }

          const uploadData = await uploadRes.json();
          if (!uploadData.success || !uploadData.url) {
            throw new Error(uploadData.error || '直接上传未返回有效直链');
          }

          // 步骤 2：使用返回的直链 URL 调用解析接口
          setSubmitStatus('直接上传成功！正在提交视频直链并创建转写任务...');
          const parseFormData = new FormData();
          parseFormData.append('language', language);
          parseFormData.append('subtitle', topicHint);
          parseFormData.append('url', uploadData.url);

          const parseRes = await fetch(`${API_BASE}/api/materials/fetch-video`, {
            method: 'POST',
            body: parseFormData,
          });

          if (!parseRes.ok) {
            throw new Error(`提交直链解析失败，HTTP 状态码: ${parseRes.status}`);
          }

          const parseData = await parseRes.json();
          if (!parseData.success) {
            throw new Error(parseData.error || '创建转写任务失败');
          }

          taskId = parseData.taskId;
          directUploadSuccess = true;
          setSubmitStatus('任务已成功建立！');
        } catch (directError: any) {
          console.warn('[Direct Upload Failed, falling back to chunks]:', directError);
          // 步骤 3：直接上传失败，进行退回分片上传的托底处理
          setSubmitStatus('直接上传受限或失败，正在启动备用分片上传方案...');
          
          const uploadId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
          const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB 一个分片
          const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);

          for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
            const chunkBlob = selectedFile.slice(start, end);

            let success = false;
            let retries = 3;
            while (retries > 0 && !success) {
              try {
                const chunkFormData = new FormData();
                chunkFormData.append('uploadId', uploadId);
                chunkFormData.append('chunkIndex', String(i));
                chunkFormData.append('totalChunks', String(totalChunks));
                chunkFormData.append('chunk', chunkBlob, selectedFile.name);

                const percent = Math.round((i / totalChunks) * 100);
                setSubmitStatus(`正在分片上传视频 (${i + 1}/${totalChunks}) - 进度: ${percent}% ...`);

                const chunkRes = await fetch(`${API_BASE}/api/materials/upload-chunk`, {
                  method: 'POST',
                  body: chunkFormData,
                });

                if (!chunkRes.ok) {
                  throw new Error(`HTTP 错误 ${chunkRes.status}`);
                }
                success = true;
              } catch (err: any) {
                retries--;
                if (retries <= 0) {
                  throw new Error(`分片 (${i + 1}/${totalChunks}) 上传失败: ${err.message || '网络连接中断，请重试'}`);
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }
            }
          }

          // 所有分片上传完毕，合并分片
          setSubmitStatus('分片上传完成，正在通知服务器合并文件并创建转写任务...');
          const mergeRes = await fetch(`${API_BASE}/api/materials/merge-chunks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              uploadId,
              fileName: selectedFile.name,
              language,
              subtitle: topicHint,
              totalChunks,
            }),
          });

          if (!mergeRes.ok) {
            throw new Error('分片合并请求失败');
          }

          const mergeData = await mergeRes.json();
          if (!mergeData.success) {
            throw new Error(mergeData.error || '分片合并转写失败');
          }
          taskId = mergeData.taskId;
        }

        // 通知上层组件任务已成功建立
        onTaskCreated(taskId);
      } else {
        // 原有 URL 链接提交逻辑
        setSubmitStatus('正在提交视频链接并创建转写任务...');
        const formData = new FormData();
        formData.append('language', language);
        formData.append('subtitle', topicHint);
        formData.append('url', videoUrl.trim());

        const response = await fetch(`${API_BASE}/api/materials/fetch-video`, {
          method: 'POST',
          body: formData,
        });

        const contentType = response.headers.get('content-type') || '';

        if (!response.ok) {
          if (contentType.includes('text/html')) {
            const htmlSnippet = await response.text();
            let readableError = '服务器拒绝了上传请求（返回了HTML错误页面）';
            if (htmlSnippet.includes('502') || htmlSnippet.includes('504')) {
              readableError = '后端服务暂时不可用或请求超时，请稍后重试。';
            }
            throw new Error(readableError);
          }
          try {
            const data = await response.json();
            throw new Error(data.error || '创建视频转写任务失败');
          } catch (e: any) {
            throw new Error(e.message || '创建视频转写任务失败');
          }
        }

        const data = await response.json();
        if (data.success === false) {
          throw new Error(data.error || '创建视频转写任务失败');
        }

        onTaskCreated(data.taskId);
      }

      // 清空选择
      setSelectedFile(null);
      setVideoUrl('');
      setSubmitStatus(null);
    } catch (err: any) {
      setError(err.message || '任务发起失败，请稍后重试');
      setSubmitStatus(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 语言选择栏 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
          <Languages className="w-3.5 h-3.5 text-[#FF5722]" />
          视频主语言
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs transition-all focus:border-[#FF5722] focus:bg-white focus:outline-none"
          disabled={isSubmitting}
        >
          <option value="auto">自动识别 (Auto-Detect)</option>
          <option value="en">英语 (English)</option>
          <option value="zh">中文 (Chinese)</option>
          <option value="ja">日语 (Japanese)</option>
          <option value="es">西班牙语 (Spanish)</option>
          <option value="fr">法语 (French)</option>
          <option value="de">德语 (German)</option>
        </select>
      </div>

      {/* URL 输入或拖拽区域选择器 */}
      <div className="grid grid-cols-1 gap-4">
        {/* 模式 A：粘贴 URL */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <Link className="w-3.5 h-3.5" />
            粘贴视频链接
          </label>
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => {
              setVideoUrl(e.target.value);
              setSelectedFile(null); // 清理拖拽文件以保持互斥
            }}
            placeholder="粘贴 MP4 视频直链地址 (如 https://example.com/movie.mp4)"
            className="w-full px-4 py-3 bg-[#F8F9FA] border border-gray-200 rounded-2xl text-xs transition-all focus:border-[#FF5722] focus:bg-white focus:outline-none"
            disabled={isSubmitting}
          />
        </div>

        {/* 分隔线 */}
        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-gray-100"></div>
          <span className="flex-shrink mx-4 text-[10px] text-gray-400 font-bold uppercase tracking-wider">或者</span>
          <div className="flex-grow border-t border-gray-100"></div>
        </div>

        {/* 模式 B：拖入文件 */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => !isSubmitting && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            isDragActive 
              ? 'border-[#FF5722] bg-[#FF5722]/5' 
              : selectedFile 
                ? 'border-green-400 bg-green-50/20' 
                : 'border-gray-200 hover:border-gray-300 bg-[#F8F9FA]'
          } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/*"
            className="hidden"
            disabled={isSubmitting}
          />

          {selectedFile ? (
            <div className="flex flex-col items-center gap-2">
              <FileVideo className="w-10 h-10 text-green-500" />
              <p className="text-xs font-bold text-gray-700 truncate max-w-[250px]">{selectedFile.name}</p>
              <p className="text-[10px] text-gray-400">
                文件大小: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB (建议不超过 200MB)
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <UploadCloud className={`w-10 h-10 ${isDragActive ? 'text-[#FF5722]' : 'text-gray-400'}`} />
              <p className="text-xs font-bold text-gray-600">拖拽本地视频文件到这里</p>
              <p className="text-[10px] text-gray-400">或点击此处浏览选择文件</p>
            </div>
          )}
        </div>
      </div>

      {/* 状态与报错 */}
      {error && (
        <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {submitStatus && (
        <div className="p-3 bg-orange-50 text-orange-700 border border-orange-100 rounded-xl text-xs flex items-center gap-2 animate-pulse">
          <Sparkles className="w-4 h-4 shrink-0 animate-spin text-[#FF5722]" />
          <span>{submitStatus}</span>
        </div>
      )}

      {/* 提交流程按钮 */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || (!videoUrl.trim() && !selectedFile)}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#FF5722] hover:bg-[#E64A19] text-white rounded-2xl text-xs font-black tracking-widest uppercase transition-all shadow-md disabled:opacity-40 disabled:hover:bg-[#FF5722] cursor-pointer"
      >
        <Play className="w-4 h-4 fill-current" />
        开始转写并提纯
      </button>
    </div>
  );
}
