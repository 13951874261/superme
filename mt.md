我将为您分析并定位全局需改造的每一个文件，输出**详细的改造方案（包含文件目录、文件名、参考代码及重构细节）**供您审核。

我们将主要针对以下 **5 个核心页面文件** 和 **1 个公共播放组件** 进行改造：

---

### **一、修改文件目录与文件名清单：**
1.  **公共播放组件**：`src/components/SpeakButton.tsx` (注入当前句子进度事件机制)
2.  **词汇矩阵**：`src/components/modules/english/tabs/VocabTab.tsx` (例句/释义人文感重构，跟读高亮与自动滚动)
3.  **情报解密舱**：`src/components/RightPanel.tsx` (划词解密面板中英文人文排版，TTS 跟读自动滚动)
4.  **听力盲听**：`src/components/modules/english/tabs/ListenTab.tsx` (全屏弹窗与听力材料的原生 `<audio>` 播放进度平滑自动滚动)
5.  **穿透阅读**：`src/components/modules/ReadModule.tsx` (大段输入与四宫格因果拆解的人文排版与 TTS 自动滚动)
6.  **纵深书面**：`src/components/modules/english/tabs/WriteTab.tsx` (CEO优化版及纠错分析报告的 TTS 跟读自动滚动)

---

### **二、各文件详细改造方案与参考代码：**

#### **1. `src/components/SpeakButton.tsx` 改造方案**
*   **目的**：使长文本播放时，随着队列切换句子，能实时通过 Window 事件派发当前正在播放的句子索引，从而驱动各阅读界面的自动滚动。
*   **修改点**：
    *   在 `playSentenceQueue` 内部循环播放句子时，每次 `play()` 之前，派发当前播放句子的 index。
*   **参考代码**：
    ```tsx
    // 在 playSentenceQueue 内部的 for 循环中：
    for (let i = 0; i < sentences.length; i++) {
      if (myQueue.isCancelled) return;

      try {
        prefetchNext(i);
        const audio = await fetchAudioForSentence(i);
        if (myQueue.isCancelled) return;

        // 【新增】：派发当前播放句子的自定义事件，告知其他组件正在播放 content 以及第 i 句
        window.dispatchEvent(new CustomEvent('tts-sentence-progress', {
          detail: { content, index: i, sentence: sentences[i] }
        }));
        
        // ... 原有音频播放逻辑保持不变 ...
    ```

---

#### **2. `src/components/modules/english/tabs/VocabTab.tsx` 改造方案**
*   **目的**：为单词和例句引入经典人文感斜体（选项 A），并且在造句评估返回评语、或展示例句时，点击 TTS 能够自动高亮并自动滚动。
*   **修改点**：
    *   生词展示英文统一加上 `font-serif italic text-3xl font-semibold text-slate-900 tracking-wide`。
    *   例句展示使用 `font-serif italic text-base text-slate-800 leading-relaxed` 包装。
*   **参考代码**：
    ```tsx
    {/* 单词卡片主词展示 */}
    <h3 className="text-3xl font-serif italic font-bold tracking-wide text-slate-900 leading-none">
      {currentWord.word}
    </h3>
    
    {/* 例句区 */}
    <div className="mt-4 pl-4 border-l-2 border-slate-200">
      <span className="block text-[9px] font-black tracking-widest text-slate-400 uppercase">Context / 语境例句</span>
      <p className="text-base font-serif italic text-slate-800 leading-relaxed">
        "{currentWordExample}"
      </p>
    </div>
    ```

---

#### **3. `src/components/RightPanel.tsx` 改造方案**
*   **目的**：优化解密舱的排版，当点击 TTS 播放释义/注解时，若文本超长，自动向下滚动。
*   **修改点**：
    *   重构 `RightPanel` 核心释义、英文定义、商务注解、应用场景中英文显示，区分出 `font-serif italic` 和 `font-sans`。
    *   解密详情页容器增加 Ref，并添加 TTS 进度监听事件，实现平滑滚动。
*   **参考代码**：
    ```tsx
    // 监听 TTS 进度事件实现自动滚动
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      const handleProgress = (e: Event) => {
        const { content, index } = (e as CustomEvent).detail;
        // 如果正在播放此处的文本，滚动容器以保持视口可见
        if (scrollContainerRef.current) {
          const activeEl = scrollContainerRef.current.querySelector(`[data-sentence-idx="${index}"]`);
          if (activeEl) {
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      };
      window.addEventListener('tts-sentence-progress', handleProgress);
      return () => window.removeEventListener('tts-sentence-progress', handleProgress);
    }, []);
    ```

---

#### **4. `src/components/modules/english/tabs/ListenTab.tsx` 改造方案**
*   **目的**：当听力音频播放时，全屏原文弹窗内的英文 Transcript（用 `font-serif` 经典体展示）能够根据 `<audio>` 播放进度自动向下滚动。
*   **修改点**：
    *   在原生 `<audio>` 的 `onTimeUpdate` 中更新 `currentTime`，并绑定滚动位置：
        `scrollTop = (currentTime / duration) * (scrollHeight - clientHeight)`。
    *   全屏弹窗文字容器挂载 Ref 并进行动画平滑绑定。
*   **参考代码**：
    ```tsx
    const fullscreenScrollRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
      if (isFullscreenText && isPlaying && audioRef.current && fullscreenScrollRef.current) {
        const container = fullscreenScrollRef.current;
        const audio = audioRef.current;
        
        const updateScroll = () => {
          if (!audio.duration) return;
          const ratio = audio.currentTime / audio.duration;
          // 平滑计算出目标 scrollTop
          const targetScrollTop = ratio * (container.scrollHeight - container.clientHeight);
          container.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
          });
        };
        
        audio.addEventListener('timeupdate', updateScroll);
        return () => audio.removeEventListener('timeupdate', updateScroll);
      }
    }, [isFullscreenText, isPlaying]);
    ```

---

#### **5. `src/components/modules/ReadModule.tsx` 改造方案**
*   **目的**：对四宫格报告输出的长篇内容应用“人文感中英文”，提供 TTS 点击朗读并自动高亮与滚动。
*   **修改点**：
    *   由于四宫格返回的信息非常详细，给每个结果栏配备 `SpeakButton`；
    *   将输出的英文句子用 `<span>` 进行包裹，监听 `tts-sentence-progress` 进行卡拉OK式的高亮高能跟读，并且跟随滚动。
*   **参考代码**：
    ```tsx
    // 渲染带有跟读滚动高亮功能的文本段落
    const HighlightableParagraph = ({ text }: { text: string }) => {
      const sentences = useMemo(() => splitIntoSentences(text), [text]);
      const [activeIndex, setActiveIndex] = useState<number | null>(null);
      const containerRef = useRef<HTMLParagraphElement>(null);

      useEffect(() => {
        const handler = (e: Event) => {
          const { content, index } = (e as CustomEvent).detail;
          if (normalizeSpeakText(text) === content) {
            setActiveIndex(index);
            // 自动滚动到对应句子
            const activeSpan = containerRef.current?.querySelector(`[data-idx="${index}"]`);
            if (activeSpan) {
              activeSpan.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
        };
        const handleStop = () => setActiveIndex(null);
        window.addEventListener('tts-sentence-progress', handler);
        window.addEventListener('tts-stopped', handleStop); // 播放结束重置
        return () => {
          window.removeEventListener('tts-sentence-progress', handler);
          window.removeEventListener('tts-stopped', handleStop);
        };
      }, [text]);

      return (
        <p ref={containerRef} className="text-sm leading-relaxed font-sans text-slate-700">
          {sentences.map((s, i) => {
            const isEng = /[a-zA-Z]/.test(s);
            return (
              <span
                key={i}
                data-idx={i}
                className={`transition-all duration-300 mx-0.5 rounded px-0.5 ${
                  isEng ? 'font-serif italic font-medium text-slate-900' : 'font-sans text-slate-700'
                } ${activeIndex === i ? 'bg-amber-100 ring-2 ring-amber-400 font-bold' : ''}`}
              >
                {s}
              </span>
            );
          })}
        </p>
      );
    };
    ```

---

### **三、改造步骤与控制计划：**
按照流程刚性要求，我们将把代码修改划分为**单步执行阶段**：
1.  **第一步（本步确认后）**：修改公共播音控制组件 `SpeakButton.tsx` 并使其获得事件分发能力。
2.  **第二步**：修改 `VocabTab.tsx` 和 `RightPanel.tsx`，完成词汇与情报解密舱的人文排版与 TTS 滚动同步。
3.  **第三步**：修改 `ListenTab.tsx`，解决听力原文弹窗在音频播放时的平滑自动滚动。
4.  **第四步**：修改 `ReadModule.tsx` 和 `WriteTab.tsx`，完成穿透解构和书面分析结果的中英文排版及高亮跟读滚动。
5.  **第五步**：提供包含完整菜单路径、测试数据及预期结果的**测试验证用例**供您最终体验与合并。

---

