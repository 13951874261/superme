import sys
sys.stdout.reconfigure(encoding='utf-8')
file_path = 'D:/cursor/work/super-agent/src/services/listeningAPI.ts'
content = open(file_path, 'r', encoding='utf-8').read()

# 1. 查找并在首部附近引入 effects 类型定义
old_fetchDifyTTS = '''export async function fetchDifyTTS(text: string, options: { isAsync?: boolean } = {}): Promise<TtsResponse> {
  return requestTtsSpeech(text, {
    model: buildTtsModel(),
    isAsync: options.isAsync ?? true,
  });
}'''

new_fetchDifyTTS = '''export async function fetchDifyTTS(
  text: string, 
  options: { 
    isAsync?: boolean;
    voiceId?: string;
    effects?: {
      accent?: 'indian' | 'british' | 'australian' | '';
      packet_loss?: boolean;
      interruptions?: boolean;
      information_gap?: boolean;
    };
  } = {}
): Promise<TtsResponse> {
  return requestTtsSpeech(text, {
    model: buildTtsModel(options.voiceId),
    isAsync: options.isAsync ?? true,
    effects: options.effects,
  });
}'''

# 2. 新增本地音频上传 API 函数
upload_api_func = '''
/**
 * 上传本地听力音频文件，并触发转录返回原文
 */
export async function uploadLocalListeningAudio(file: File, userId: string = 'local-user'): Promise<{
  success: boolean;
  audioUrl: string;
  fileName: string;
  uniqueName: string;
  transcript: string;
}> {
  const formData = new FormData();
  formData.append('video', file); // 路由里用的是 upload.any()，这里传给 multer，也可以用 multer 的 key 匹配
  formData.append('userId', userId);

  const response = await fetch('/api/listen/upload-audio', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`音频上传失败: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || '音频上传处理失败');
  }

  return data;
}
'''

if old_fetchDifyTTS not in content:
    print('ERROR: old_fetchDifyTTS not found')
    sys.exit(1)

content = content.replace(old_fetchDifyTTS, new_fetchDifyTTS)
content += upload_api_func

open(file_path, 'w', encoding='utf-8').write(content)
print('SUCCESS')
