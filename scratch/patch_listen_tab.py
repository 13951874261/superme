import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/components/modules/english/tabs/ListenTab.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 添加 UploadCloud 和 FileAudio 到 lucide-react 导入
old_import = "import { Headphones, Loader2, PlayCircle, PauseCircle, FastForward, EyeOff, Eye, Target, Zap, AlertTriangle, BookPlus } from 'lucide-react';"
new_import = "import { Headphones, Loader2, PlayCircle, PauseCircle, FastForward, EyeOff, Eye, Target, Zap, AlertTriangle, BookPlus, UploadCloud, FileAudio } from 'lucide-react';"

if old_import in content:
    content = content.replace(old_import, new_import)
    print("Updated imports")
else:
    print("Import not found")

# 2. 在 state 定义后添加上传相关的 state
old_states = "  const [pregenArticleStatus, setPregenArticleStatus] = useState<string | null>(null);"
new_states = """  const [pregenArticleStatus, setPregenArticleStatus] = useState<string | null>(null);
  const [listenMode, setListenMode] = useState<'auto' | 'upload'>('auto');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedTranscript, setUploadedTranscript] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);"""

if old_states in content:
    content = content.replace(old_states, new_states)
    print("Added upload states")
else:
    print("States not found")

# 3. 在 generateListenMaterial 函数后添加上传处理函数
old_func_end = """  const handleListenAnalyze = async () => {
    if (!listenInput.trim()) {
      showNotice('listen', '请先在盲打区输入您的听写记录', 'error');
      return;
    }"""

new_func_end = """  // 上传音频文件处理
  const handleUploadAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件大小 (限制 50MB)
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
      // 1. 上传文件到服务器
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', 'default-user');

      const uploadRes = await fetch('/api/listen/upload-audio', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error('上传失败');
      }

      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        throw new Error(uploadData.error || '上传失败');
      }

      // 设置音频 URL
      setListenAudioUrl(uploadData.audioUrl);
      setUploadProgress(50);

      // 2. 调用 STT 转写
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
      showNotice('listen', '音频上传成功，请听音频并默写内容', 'info');
    } catch (err: any) {
      showNotice('listen', `上传失败: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
      setIsTranscribing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleListenAnalyze = async () => {
    if (!listenInput.trim()) {
      showNotice('listen', '请先在盲打区输入您的听写记录', 'error');
      return;
    }"""

if old_func_end in content:
    content = content.replace(old_func_end, new_func_end)
    print("Added upload handler")
else:
    print("Function end not found")

with open('src/components/modules/english/tabs/ListenTab.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
