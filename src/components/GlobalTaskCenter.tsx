import React, { useState } from 'react';
import { useTask, TaskItem } from './TaskContext';
import { X, Video, Globe, Loader2, CheckCircle2, XCircle, Terminal, FileText, ChevronDown, ChevronUp, Download, Import } from 'lucide-react';

export default function GlobalTaskCenter() {
  const { tasks, isOpen, setIsOpen, pendingCount } = useTask();
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  const toggleLogs = (taskId: string) => {
    setExpandedLogs(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const handleImport = (task: TaskItem) => {
    if (!task.result) return;
    
    // 发送全局事件，由 MaterialUploader 接收并处理虚拟材料导入
    window.dispatchEvent(new CustomEvent('import-virtual-material', {
      detail: {
        name: task.result.name,
        content: task.result.content,
        mimeType: task.result.mimeType
      }
    }));
    
    // 关闭抽屉，聚焦上传界面
    setIsOpen(false);
  };

  const handleDownload = (task: TaskItem) => {
    if (!task.result) return;
    const blob = new Blob([task.result.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = task.result.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* 背景遮罩 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] transition-opacity duration-300 animate-in fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 右侧滑出面板 */}
      <div 
        className={`fixed top-0 right-0 h-full w-full sm:w-[440px] bg-white shadow-2xl z-[100] flex flex-col transition-all duration-300 ease-in-out border-l border-gray-100 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-[#F8F9FA]">
          <div>
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
              提纯任务中心
              {pendingCount > 0 && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5722] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF5722]"></span>
                </span>
              )}
            </h3>
            <p className="text-[11px] text-gray-400 font-medium mt-1">
              查看网页内容提取与视频转写的后台处理进度
            </p>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Task List */}
        <div className="flex-grow overflow-y-auto p-6 space-y-4">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <FileText className="w-12 h-12 text-gray-300 stroke-[1.5]" />
              <div>
                <p className="text-xs font-bold text-gray-600">暂无任何后台任务</p>
                <p className="text-[10px] text-gray-400 mt-1 max-w-[200px] leading-relaxed">
                  通过网页提取或视频字幕功能发起的任务会在此展示。
                </p>
              </div>
            </div>
          ) : (
            tasks.map(task => {
              const isExpanded = !!expandedLogs[task.id];
              return (
                <div 
                  key={task.id} 
                  className={`p-4 rounded-2xl border transition-all duration-300 ${
                    task.status === 'completed' 
                      ? 'border-green-100 bg-green-50/5' 
                      : task.status === 'failed' 
                        ? 'border-red-100 bg-red-50/5' 
                        : 'border-gray-100 bg-[#F8F9FA]/50'
                  }`}
                >
                  {/* 头部信息 */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-2 rounded-xl shrink-0 ${
                        task.type === 'video' ? 'bg-[#FF5722]/10 text-[#FF5722]' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {task.type === 'video' ? <Video className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-gray-800 truncate" title={task.name}>
                          {task.name}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {task.id}</p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {task.status === 'pending' && (
                        <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> 排队中
                        </span>
                      )}
                      {task.status === 'running' && (
                        <span className="text-[9px] font-bold text-[#FF5722] bg-[#FF5722]/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> 处理中 {task.progress}%
                        </span>
                      )}
                      {task.status === 'completed' && (
                        <span className="text-[9px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> 已就绪
                        </span>
                      )}
                      {task.status === 'failed' && (
                        <span className="text-[9px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> 失败
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 进度条 */}
                  {(task.status === 'pending' || task.status === 'running') && (
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-3">
                      <div 
                        className="bg-gradient-to-r from-[#FF5722] to-amber-400 h-full transition-all duration-500"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  )}

                  {/* 失败原因 */}
                  {task.status === 'failed' && task.error && (
                    <p className="text-[11px] text-red-500 bg-red-50/50 p-2.5 rounded-xl border border-red-50 mb-3 leading-relaxed">
                      {task.error}
                    </p>
                  )}

                  {/* 结果操作按钮 */}
                  {task.status === 'completed' && task.result && (
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => handleImport(task)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#FF5722] hover:bg-[#E64A19] text-white rounded-lg text-[10px] font-bold tracking-wider uppercase transition-colors cursor-pointer"
                      >
                        <Import className="w-3 h-3" />
                        导入并提纯
                      </button>
                      <button
                        onClick={() => handleDownload(task)}
                        className="flex items-center justify-center gap-1 px-3 py-1.5 border border-gray-200 hover:border-gray-300 text-gray-600 rounded-lg text-[10px] font-bold transition-colors cursor-pointer bg-white"
                        title="下载转写好的 Markdown"
                      >
                        <Download className="w-3 h-3" />
                        下载
                      </button>
                    </div>
                  )}

                  {/* 日志展开栏 */}
                  <div className="border-t border-gray-100/50 pt-2">
                    <button
                      onClick={() => toggleLogs(task.id)}
                      className="flex items-center text-[10px] text-gray-400 hover:text-gray-600 font-bold transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 mr-0.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 mr-0.5" />
                      )}
                      <Terminal className="w-3 h-3 mr-1" />
                      {isExpanded ? '隐藏运行日志' : '查看运行日志'}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 bg-gray-900 text-gray-300 rounded-xl p-3 max-h-36 overflow-y-auto text-[9px] font-mono space-y-1.5 border border-gray-800 animate-in slide-in-from-top-1 duration-200">
                        {task.logs && task.logs.length > 0 ? (
                          task.logs.map((log, idx) => <div key={`${task.id}-log-${idx}`}>{log}</div>)
                        ) : (
                          <div className="text-gray-500">尚无运行日志...</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
