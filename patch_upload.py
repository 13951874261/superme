import sys
sys.stdout.reconfigure(encoding='utf-8')
file_path = 'D:/cursor/work/super-agent/vocab-server/server.js'
content = open(file_path, 'r', encoding='utf-8').read()

marker = "app.post('/api/listen/upload-audio'"
start = content.find(marker)
if start == -1:
    print('ERROR: start not found')
    sys.exit(1)

brace_start = content.find('{', start)
if brace_start == -1:
    print('ERROR: brace not found')
    sys.exit(1)

pos = brace_start
level = 0
in_str = None
escape = False
while pos < len(content):
    ch = content[pos]
    if in_str:
        if escape:
            escape = False
        elif ch == '\\':
            escape = True
        elif ch == in_str:
            in_str = None
    else:
        if ch in ('"', "'", '`'):
            in_str = ch
        elif ch == '{':
            level += 1
        elif ch == '}':
            level -= 1
            if level == 0:
                end = content.find(');', pos)
                end += 2
                break
    pos += 1
else:
    print('ERROR: end not found')
    sys.exit(1)

old_block = content[start:end]
print('OLD LEN', len(old_block))

new_block = """app.post('/api/listen/upload-audio', upload.any(), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: '未上传音频文件' });
    }

    // 生成唯一文件名避免冲突
    const uniqueName = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(__dirname, 'public', 'long_audio', uniqueName);

    // 保存上传的文件
    fs.writeFileSync(filePath, fs.readFileSync(file.path));

    // 清理临时文件
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    // 自动转写音频获取标准原文
    let transcript = '';
    try {
      const { transcribeAudioFile } = require('./services/audioTranscriptionService');
      transcript = await transcribeAudioFile(file, req.body ? (req.body.userId || 'default-user') : 'default-user');

      const transcriptDir = path.join(__dirname, 'public', 'long_audio_transcripts');
      if (!fs.existsSync(transcriptDir)) {
        fs.mkdirSync(transcriptDir, { recursive: true });
      }
      const transcriptPath = path.join(transcriptDir, `${uniqueName}.txt`);
      fs.writeFileSync(transcriptPath, transcript, 'utf8');

      console.log('[Upload Audio] 转写成功，文本长度: ' + transcript.length);
    } catch (transcribeErr) {
      console.error('[Upload Audio] 转写失败:', transcribeErr.message);
    }

    // 返回音频 URL 与转录文本
    res.json({
      success: true,
      audioUrl: `/api/long_audio/${encodeURIComponent(uniqueName)}`,
      fileName: file.originalname,
      uniqueName: uniqueName,
      transcript: transcript
    });
  } catch (error) {
    console.error('[Upload Audio] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});"""

content = content[:start] + new_block + content[end:]
open(file_path, 'w', encoding='utf-8').write(content)
print('SUCCESS')
