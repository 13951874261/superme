I will write the detailed design proposal for Option A in Chinese for the user's confirmation.

---

### **设计确认与修改提案**

您已选择 **选项 A（高级内容流预览）**。为了贯彻 `$impeccable` 与 `$design-taste-frontend` 的高标准，且严格遵循 `AGENTS.md` 的“**完全充分明确需求，并举例说明经我确认后才允许修改**”原则，我设计了如下具体实现方案：

---

### **1. 交互与布局设计示意（预览效果说明）**

在右侧 **Step 3 区域**，我们将原来的静态说明文字替换为**智能预览窗口**（设计高度为 `220px`，深色底色 `#0b0f19`，带平滑滚动与渐变淡出蒙版）：

*   **场景 1：未选择任何材料时**
    显示淡灰色优雅提示：“系统将自动执行：清空知识库 → 向量化切片 → Dify提纯词汇 → 写入生词本。当前等待载入材料...”
*   **场景 2：载入本地文档/网页提取材料时**
    顶部显示文件名与大小（如 `📄 Financial_Report.md (12.4 KB)`），下方为前 `500` 字的文本内容缩略预览（支持平滑滚动，底部有 `bg-gradient-to-t` 的半透明黑色遮罩淡出，具有极佳的视觉深度）。
*   **场景 3：粘贴视频链接或拖入本地视频时**
    *   **本地视频**：在 Step 3 预览区生成一个高保真的微型 `<video>` 播放器，带有圆角与精美边框，支持直接点击播放、调整进度、静音等。
    *   **网络视频**：显示带有播放图标的链接卡片，展示视频直链地址。

---

### **2. 具体代码修改设计（举例说明）**

我计划修改以下两个文件，修改仅限于预览功能的引入，不影响任何原有的提纯、分片上传、合并或 Dify API 调用逻辑：

#### **修改文件 1：`src/components/VideoTranscribePanel.tsx`**
*   **添加属性**：
    ```typescript
    interface VideoTranscribePanelProps {
      topicHint?: string;
      onTaskCreated: (taskId: string) => void;
      onMediaChange?: (media: { type: 'file' | 'url'; file?: File; url?: string } | null) => void;
    }
    ```
*   **逻辑触发**：当用户选择视频文件或粘贴视频链接时，触发 `onMediaChange` 回调：
    ```typescript
    // 选择本地视频时
    onMediaChange?.({ type: 'file', file });
    // 输入视频URL时
    onMediaChange?.({ type: 'url', url: videoUrl });
    // 转写提交成功或清空时
    onMediaChange?.(null);
    ```

#### **修改文件 2：`src/components/MaterialUploader.tsx`**
*   **状态设计**：
    ```typescript
    // 用于保存文本文件的预览字串
    const [previewContent, setPreviewContent] = useState<string>('');
    // 用于保存来自视频面板的媒体预览状态
    const [videoMedia, setVideoMedia] = useState<{ type: 'file' | 'url'; file?: File; url?: string } | null>(null);
    // 用于视频文件本地播放的 Object URL
    const [videoObjectURL, setVideoObjectURL] = useState<string>('');
    ```
*   **读取文本文件的 Effect**：
    ```typescript
    useEffect(() => {
      if (selectedFiles.length > 0) {
        const file = selectedFiles[0];
        if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            setPreviewContent((e.target?.result as string) || '');
          };
          reader.readAsText(file);
        } else {
          setPreviewContent('[二进制文档] 这是一个 PDF/Word 材料。点击“开始上传并提纯”后，系统将在服务器自动解析文本并提纯。');
        }
      } else {
        setPreviewContent('');
      }
    }, [selectedFiles]);
    ```
*   **处理视频 Blob URL 的 Effect**：
    ```typescript
    useEffect(() => {
      if (videoMedia?.type === 'file' && videoMedia.file) {
        const url = URL.createObjectURL(videoMedia.file);
        setVideoObjectURL(url);
        return () => URL.revokeObjectURL(url);
      } else {
        setVideoObjectURL('');
      }
    }, [videoMedia]);
    ```
*   **JSX 结构调整（Step 3 执行区域）**：
    将 Step 3 结构修改为动态渲染：
    ```tsx
    <section className="rounded-2xl bg-[#202124] border border-gray-900 p-5 text-white flex flex-col justify-between lg:col-span-1 min-h-[340px]">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="text-[10px] font-black uppercase tracking-widest text-[#FF5722] mb-3">Step 3 执行与预览</div>
        
        {/* 动态预览窗口 */}
        <div className="flex-1 min-h-[160px] max-h-[200px] mb-4 bg-gray-950/40 rounded-xl p-3 border border-gray-800 flex flex-col overflow-hidden relative">
          {activeTab === 'video' && videoMedia ? (
            // 视频预览
            <div className="flex-grow flex flex-col justify-center min-h-0">
              <div className="text-[9px] text-gray-500 mb-1.5 truncate">
                {videoMedia.type === 'file' ? `本地视频: ${videoMedia.file?.name}` : `网络视频: ${videoMedia.url}`}
              </div>
              {videoMedia.type === 'file' && videoObjectURL ? (
                <video src={videoObjectURL} controls className="w-full max-h-[120px] rounded-lg bg-black border border-gray-800" />
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center border border-dashed border-gray-800 rounded-lg p-3">
                  <Play className="w-6 h-6 text-gray-600 mb-1" />
                  <span className="text-[9px] text-gray-400">视频链接已就绪，可在左侧发起转写</span>
                </div>
              )}
            </div>
          ) : selectedFiles.length > 0 ? (
            // 文本/网页/导入文件预览
            <div className="flex-grow flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-gray-800 text-[9px] text-gray-500">
                <span className="truncate max-w-[120px]">{selectedFiles[0].name}</span>
                <span className="font-mono">{(selectedFiles[0].size / 1024).toFixed(1)} KB</span>
              </div>
              <div className="flex-grow overflow-y-auto text-[10px] text-gray-300 font-mono leading-relaxed pr-1 whitespace-pre-wrap break-all">
                {previewContent || '正在加载预览...'}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-gray-950/80 to-transparent pointer-events-none" />
            </div>
          ) : (
            // 默认提示
            <div className="flex-grow flex flex-col items-center justify-center text-center p-2">
              <p className="text-[11px] text-gray-400 leading-relaxed">
                系统将自动执行：清空知识库 → 载入材料 → 向量化切片 → Dify智能抽提词汇 → 写入生词本。
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* 按钮部分保持不变 */}
      ...
    </section>
    ```

