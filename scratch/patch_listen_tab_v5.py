import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/components/modules/english/tabs/ListenTab.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('\r\n', '\n')

# 1. 替换 imports
old_import = "import { Headphones, Loader2, PlayCircle, PauseCircle, FastForward, EyeOff, Eye, Target, Zap, AlertTriangle, BookPlus } from 'lucide-react';"
new_import = "import { Headphones, Loader2, PlayCircle, PauseCircle, FastForward, EyeOff, Eye, Target, Zap, AlertTriangle, BookPlus, UploadCloud, FileAudio } from 'lucide-react';"
content = content.replace(old_import, new_import)

# 2. 插入状态变量 (只替换一次，利用唯一的 filterFetchTimer 之前)
old_states = "  const filterFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);"
new_states = """  const [listenMode, setListenMode] = useState<'auto' | 'upload'>('auto');
  const [listenAccent, setListenAccent] = useState<'normal' | 'indian' | 'british' | 'australian'>('normal');
  const [listenInterruptions, setListenInterruptions] = useState(false);
  const [listenPacketLoss, setListenPacketLoss] = useState(false);
  const [listenInfoGap, setListenInfoGap] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedTranscript, setUploadedTranscript] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const filterFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);"""
content = content.replace(old_states, new_states)

# 3. 插入上传处理函数 (只在第一个 handleListenAnalyze 之前插入)
old_func_end = """  const handleListenAnalyze = async () => {"""
new_func_end = """  const handleUploadAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showNotice('listen', '音频文件不能超过 50MB', 'error');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadedFileName(file.name);
    setUploadedTranscript('');
    setListenInput('');
    setListenResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', 'default-user');

      const uploadRes = await fetch('/api/listen/upload-audio', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('上传失败');

      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error(uploadData.error || '上传失败');

      setListenAudioUrl(uploadData.audioUrl);
      setUploadProgress(50);

      setIsTranscribing(true);
      const sttFormData = new FormData();
      sttFormData.append('file', file);
      sttFormData.append('userId', 'default-user');

      const sttRes = await fetch('/api/audio/transcriptions', {
        method: 'POST',
        body: sttFormData,
      });

      if (sttRes.ok) {
        const sttData = await sttRes.json();
        if (sttData.text) {
          setUploadedTranscript(sttData.text);
          setListenMaterial(sttData.text);
        }
      }

      setUploadProgress(100);
      showNotice('listen', '音频上传及转写成功，请听音频并默写内容', 'info');
    } catch (err: any) {
      showNotice('listen', `上传失败: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
      setIsTranscribing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleListenAnalyze = async () => {"""
content = content.replace(old_func_end, new_func_end)

# 4. 插入按钮及模式切换
old_btn = """                <button
                  onClick={() => generateListenMaterial(theme)}
                  disabled={isListenMaterialLoading}
                  className="ml-auto shrink-0 whitespace-nowrap bg-gradient-to-r from-[#FF5722] to-[#f44336] text-white text-[10px] px-3.5 py-1.5 rounded-lg font-black tracking-widest shadow-md hover:shadow-lg hover:from-[#e64a19] hover:to-[#d32f2f] transition-all disabled:opacity-50 disabled:grayscale flex items-center gap-1.5"
                >
                  {isListenMaterialLoading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 正在查询/生成今日内容...</>
                  ) : (
                    <><Zap className="w-3.5 h-3.5 text-amber-300" /> 查询/生成今日精听</>
                  )}
                </button>"""

new_btn = """<div className="flex items-center gap-2 ml-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setListenMode('auto')}
                    className={`text-[10px] px-2.5 py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                      listenMode === 'auto'
                        ? 'bg-[#FF5722] text-white shadow-sm'
                        : 'bg-black/20 text-gray-400 hover:text-white hover:bg-black/40 border border-white/10'
                    }`}
                  >
                    自动生成
                  </button>
                  <button
                    type="button"
                    onClick={() => setListenMode('upload')}
                    className={`text-[10px] px-2.5 py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                      listenMode === 'upload'
                        ? 'bg-[#FF5722] text-white shadow-sm'
                        : 'bg-black/20 text-gray-400 hover:text-white hover:bg-black/40 border border-white/10'
                    }`}
                  >
                    上传音频
                  </button>
                </div>
                {listenMode === 'upload' ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*,video/*"
                      onChange={handleUploadAudio}
                      className="hidden"
                      id="listen-audio-upload"
                      disabled={isUploading || isTranscribing}
                    />
                    <label
                      htmlFor="listen-audio-upload"
                      className={`whitespace-nowrap bg-gradient-to-r from-[#FF5722] to-[#f44336] text-white text-[10px] px-3.5 py-1.5 rounded-lg font-black tracking-widest shadow-md hover:shadow-lg hover:from-[#e64a19] hover:to-[#d32f2f] transition-all disabled:opacity-50 disabled:grayscale flex items-center gap-1.5 cursor-pointer ${
                        isUploading || isTranscribing ? 'pointer-events-none opacity-50' : ''
                      }`}
                    >
                      {isUploading ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 上传中...</>
                      ) : isTranscribing ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 转写中...</>
                      ) : (
                        <><UploadCloud className="w-3.5 h-3.5 text-amber-300" /> 上传音频</>
                      )}
                    </label>
                    {uploadedFileName && (
                      <span className="text-[10px] text-white/60 max-w-[100px] truncate" title={uploadedFileName}>
                        {uploadedFileName}
                      </span>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => generateListenMaterial(theme)}
                    disabled={isListenMaterialLoading}
                    className="whitespace-nowrap bg-gradient-to-r from-[#FF5722] to-[#f44336] text-white text-[10px] px-3.5 py-1.5 rounded-lg font-black tracking-widest shadow-md hover:shadow-lg hover:from-[#e64a19] hover:to-[#d32f2f] transition-all disabled:opacity-50 disabled:grayscale flex items-center gap-1.5"
                  >
                    {isListenMaterialLoading ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 正在生成...</>
                    ) : (
                      <><Zap className="w-3.5 h-3.5 text-amber-300" /> 生成今日精听</>
                    )}
                  </button>
                )}"""
content = content.replace(old_btn, new_btn)

# 5. 添加压力因素选项的渲染
search_pos = content.find("{isCacheableDuration && (pregenStatus === 'missing'")
if search_pos >= 0:
    pressure_ui = """{/* 压力因素选择器 */}
              <div className="flex flex-wrap items-center gap-3 mt-3 relative z-10 border-t border-white/5 pt-3 w-full">
                <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">压力因素:</span>
                <select
                  value={listenAccent}
                  onChange={(e) => setListenAccent(e.target.value as any)}
                  className="bg-black/30 text-white/90 text-[10px] px-2.5 py-1 rounded-lg border border-white/10 outline-none focus:border-[#FF5722] cursor-pointer hover:border-white/20"
                >
                  <option value="normal" className="text-black">标准发音</option>
                  <option value="indian" className="text-black">印度口音 (India)</option>
                  <option value="british" className="text-black">英国口音 (UK)</option>
                  <option value="australian" className="text-black">澳洲口音 (AU)</option>
                </select>
                <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={listenInterruptions}
                    onChange={(e) => setListenInterruptions(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-white/10 bg-black/20 text-[#FF5722] focus:ring-0 focus:ring-offset-0"
                  />
                  故意打断
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={listenPacketLoss}
                    onChange={(e) => setListenPacketLoss(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-white/10 bg-black/20 text-[#FF5722] focus:ring-0 focus:ring-offset-0"
                  />
                  网络卡顿
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={listenInfoGap}
                    onChange={(e) => setListenInfoGap(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-white/10 bg-black/20 text-[#FF5722] focus:ring-0 focus:ring-offset-0"
                  />
                  白噪丢包
                </label>
              </div>

              """
    content = content[:search_pos] + pressure_ui + content[search_pos:]
    print("Pressure UI inserted successfully")

with open('src/components/modules/english/tabs/ListenTab.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("ListenTab.tsx successfully patched!")
