import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('vocab-server/server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 统一换行符
content = content.replace('\r\n', '\n')

# 找到 global.synthesizeAndSaveAudio = synthesizeAndSaveAudio; 的位置
marker = 'global.synthesizeAndSaveAudio = synthesizeAndSaveAudio;'
idx = content.find(marker)

if idx >= 0:
    # 查找前一个大括号 } 的结束位置
    func_end_idx = content.rfind('}', 0, idx)
    
    if func_end_idx >= 0:
        new_logic = """
  // 音频后处理：压力因素效果
  const effects = extra?.effects || null;
  if (effects && fs.existsSync(audioPath)) {
    try {
      await applyAudioEffects(audioPath, effects);
    } catch (effErr) {
      console.warn('[TTS] 音频后处理失败（非致命）:', effErr.message);
    }
  }
"""
        
        effects_func = """
// 音频后处理函数：应用压力因素效果
async function applyAudioEffects(audioPath, effects) {
  const { execFile } = require('child_process');
  const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  const tmpPath = audioPath + '.temp.mp3';
  
  const filterParts = [];
  
  // 1. 口音效果（通过改变音调和语速模拟）
  if (effects.accent) {
    if (effects.accent === 'indian') {
      filterParts.push('rubberband=pitch=0.95');
    } else if (effects.accent === 'british') {
      filterParts.push('rubberband=pitch=1.05');
    } else if (effects.accent === 'australian') {
      filterParts.push('rubberband=pitch=1.02');
    }
  }
  
  // 2. 卡顿效果（随机插入短暂静音）
  if (effects.packet_loss) {
    filterParts.push("aevald='if(eq(t\\,0.5)\\,0.001\\,1)*if(eq(t\\,2.0)\\,0.001\\,1)*if(eq(t\\,4.0)\\,0.001\\,1)'");
  }
  
  // 3. 打断效果
  if (effects.interruptions) {
    filterParts.push('anull=duration=0.3');
  }
  
  // 4. 信息缺失（背景噪音）
  if (effects.information_gap) {
    filterParts.push('anoisesrc=d=1:a=0.05');
  }
  
  if (filterParts.length > 0) {
    const filterChain = filterParts.join(',');
    const args = ['-i', audioPath, '-af', filterChain, '-y', tmpPath];
    
    await new Promise((resolve, reject) => {
      execFile(ffmpegPath, args, { timeout: 30000 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // 替换原文件
    if (fs.existsSync(tmpPath)) {
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      fs.renameSync(tmpPath, audioPath);
    }
  }
}

"""
        
        # 在 synthesizeAndSaveAudio 函数体结尾大括号前插入 new_logic
        # 在 global.synthesizeAndSaveAudio 赋值之前插入 effects_func
        content = content[:func_end_idx] + new_logic + content[func_end_idx:idx] + effects_func + content[idx:]
        print("Success inserting effects logic!")
    else:
        print("Could not find preceding brace")
else:
    print("Could not find global assignment marker")

with open('vocab-server/server.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
