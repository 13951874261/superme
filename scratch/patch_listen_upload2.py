import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('vocab-server/server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 找到刚才插入的接口并替换为更简洁的版本
old_interface = """
// ==========================================
// 听力材料上传接口
// ==========================================
app.post('/api/listen/upload-audio', upload.any(), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: '未上传音频文件' });
    }

    const userId = req.body?.userId || 'default-user';
    const filePath = path.join(__dirname, 'public', 'long_audio', file.originalname);
    
    // 保存上传的文件
    fs.writeFileSync(filePath, fs.readFileSync(file.path));
    
    // 清理临时文件
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    // 调用 STT 获取转写文本
    let transcript = '';
    try {
      const sttRes = await fetch('/api/audio/transcriptions', {
        method: 'POST',
        body: (() => {
          const formData = new FormData();
          const blob = new Blob([fs.readFileSync(filePath)], { type: file.mimetype });
          formData.append('file', blob, file.originalname);
          formData.append('userId', userId);
          return formData;
        })()
      });
      
      if (sttRes.ok) {
        const sttData = await sttRes.json();
        transcript = sttData.text || '';
      }
    } catch (sttErr) {
      console.error('[Upload Audio] STT error:', sttErr.message);
    }

    // 返回音频 URL 和转写文本
    res.json({
      success: true,
      audioUrl: `/api/long_audio/${encodeURIComponent(file.originalname)}`,
      transcript: transcript,
      fileName: file.originalname,
      fileUrl: filePath
    });
  } catch (error) {
    console.error('[Upload Audio] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 提供 long_audio 目录的静态访问
app.use('/api/long_audio', express.static(path.join(__dirname, 'public', 'long_audio')));

"""

new_interface = """
// ==========================================
// 听力材料上传接口（保存文件并返回URL）
// ==========================================
app.post('/api/listen/upload-audio', upload.any(), async (req, res) => {
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

    // 返回音频 URL
    res.json({
      success: true,
      audioUrl: `/api/long_audio/${encodeURIComponent(uniqueName)}`,
      fileName: file.originalname,
      uniqueName: uniqueName
    });
  } catch (error) {
    console.error('[Upload Audio] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 提供 long_audio 目录的静态访问
app.use('/api/long_audio', express.static(path.join(__dirname, 'public', 'long_audio')));

"""

if old_interface in content:
    content = content.replace(old_interface, new_interface)
    print("Replaced upload audio interface with cleaner version")
else:
    print("Could not find old interface to replace")

with open('vocab-server/server.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
