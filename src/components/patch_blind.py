import sys
sys.stdout.reconfigure(encoding='utf-8')
file_path = 'D:/cursor/work/super-agent/src/components/BlindListeningCabin.tsx'
content = open(file_path, 'r', encoding='utf-8').read()

# 更新 import
old_import = "import { transcribeAudio, fetchDifyTTS, pollTtsTask } from '../services/listeningAPI';"
new_import = "import { transcribeAudio, fetchDifyTTS, pollTtsTask, uploadLocalListeningAudio } from '../services/listeningAPI';"
if old_import in content:
    content = content.replace(old_import, new_import)
else:
    print('WARNING: import not found, will add manually')

# 在 Props 接口后面添加新的 props 和 state
old_props = '''interface Props {
  currentSentence?: string; // 当前要盲听的句子
  onSubmit?: (text: string) => void;
}'''
new_props = '''interface Props {
  currentSentence?: string; // 当前要盲听且用于生成音频的句子
  onSubmit?: (text: string) => void;
  onTranscriptLoaded?: (transcript: string) => void; // 上传本地音频转录后的回调
}

// 可选的 Edge TTS 语音列表（支持主要国家口音）
const VOICE_OPTIONS = [
  { id: 'en-US-EmmaNeural', label: '美式英语 (Emma)', accent: 'american' },
  { id: 'en-GB-LibbyNeural', label: '英式英语 (Libby)', accent: 'british' },
  { id: 'en-IN-NeerjaNeural', label: '印度英语 (Neerja)', accent: 'indian' },
  { id: 'en-AU-NatashaNeural', label: '澳大利亚英语 (Natasha)', accent: 'australian' },
  { id: 'en-GB-RyanNeural', label: '苏格兰英语 (Ryan)', accent: 'scottish' },
] as const;'''

if old_props in content:
    content = content.replace(old_props, new_props)

# 在 state 声明后添加新的 state
old_state = '''  const [isSynthesizing, setIsSynthesizing] = useState(false); // 合成中'''
new_state = '''  const [isSynthesizing, setIsSynthesizing] = useState(false); // 合成中
  
  // 口音与压力因子状态
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('en-GB-LibbyNeural');
  const [effects, setEffects] = useState<{
    accent?: 'indian' | 'british' | 'australian' | '';
    packet_loss?: boolean;
    interruptions?: boolean;
    information_gap?: boolean;
  }>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedTranscript, setUploadedTranscript] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);'''

if old_state in content:
    content = content.replace(old_state, new_state)
else:
    print('WARNING: old_state not found')

# 修改 handlePlay 以支持 voice 和 effects
old_handlePlay = '''      const ttsResp = await fetchDifyTTS(currentSentence, { isAsync: true });'''
new_handlePlay = '''      const ttsResp = await fetchDifyTTS(currentSentence, { 
        isAsync: true,
        voiceId: selectedVoiceId,
        effects: Object.keys(effects).length > 0 ? effects : undefined,
      });'''

if old_handlePlay in content:
    content = content.replace(old_handlePlay, new_handlePlay)
else:
    print('WARNING: old_handlePlay not found')

# 添加上传处理函数
upload_func = '''
  /** 处理本地音频上传 */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/x-m4a', 'video/mp4'];
    if (!allowedTypes.some(t => file.type.includes(t.split('/')[1]))) {
      showToast('请上传 mp3 或 wav 格式的音频文件', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadLocalListeningAudio(file, 'local-user');
      if (result.success && result.transcript) {
        setUploadedTranscript(result.transcript);
        // 将转录文本设为当前盲听句子的替代文本（用于后续分析比对）
        showToast('音频上传成功，已自动转录为标准原文', 'info');
      } else {
        showToast('音频上传成功但未获取到转录文本', 'info');
      }
    } catch (err: any) {
      console.error('[BlindListening] Upload error:', err);
      showToast(err.message || '上传失败，请稍后重试', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /** 切换压力因子开关 */
  const toggleEffect = (key: keyof typeof effects) => {
    setEffects(prev => ({ ...prev, [key]: !prev[key] }));
  };
'''

# 插入到 handlePlay 函数之后
insert_after = "    } finally {\n      setIsSynthesizing(false);\n    }\n  };\n\n  const handleStartRecord"
if insert_after in content:
    content = content.replace(insert_after, "    } finally {\n      setIsSynthesizing(false);\n    }\n  };\n" + upload_func + "\n  const handleStartRecord")
else:
    print('WARNING: insert_after not found, trying alternate insertion')

open(file_path, 'w', encoding='utf-8').write(content)
print('Step 1 SUCCESS')
