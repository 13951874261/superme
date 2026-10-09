const fs = require('fs');
const file = 'D:/cursor/work/super-agent/src/components/SpeakButton.tsx';
let code = fs.readFileSync(file, 'utf-8');

const regex = /const response = await fetch\('[\s\S]*?return playAudio\(audioUrl, effectiveRate\);/;

const newStr = "function chunkTextForTTS(text: string, maxLength = 800) {\\n" +
"      const chunks = [];\\n" +
"      let currentChunk = '';\\n" +
"      const sentences = text.match(/[^.!?\\\\n]+[.!?\\\\n]*/g) || [text];\\n" +
"      for (let sentence of sentences) {\\n" +
"        if ((currentChunk + sentence).length > maxLength && currentChunk.length > 0) {\\n" +
"          chunks.push(currentChunk.trim());\\n" +
"          currentChunk = '';\\n" +
"        }\\n" +
"        currentChunk += sentence;\\n" +
"      }\\n" +
"      if (currentChunk.trim()) {\\n" +
"        chunks.push(currentChunk.trim());\\n" +
"      }\\n" +
"      return chunks;\\n" +
"    }\\n" +
"\\n" +
"    const chunks = chunkTextForTTS(content);\\n" +
"    const blobs: Blob[] = [];\\n" +
"\\n" +
"    // 流式播放队列\\n" +
"    for (let i = 0; i < chunks.length; i++) {\\n" +
"      const chunk = chunks[i];\\n" +
"      if (!chunk) continue;\\n" +
"      \\n" +
"      const response = await fetch('/api/tts/speech', {\\n" +
"        method: 'POST',\\n" +
"        headers: {\\n" +
"          'Content-Type': 'application/json'\\n" +
"        },\\n" +
"        body: JSON.stringify({\\n" +
"          model: modelName,\\n" +
"          input: chunk\\n" +
"        })\\n" +
"      });\\n" +
"\\n" +
"      if (!response.ok) {\\n" +
"        throw new Error(TTS synthesis failed: \);\\n" +
"      }\\n" +
"\\n" +
"      const chunkBlob = await response.blob();\\n" +
"      blobs.push(chunkBlob);\\n" +
"    }\\n" +
"\\n" +
"    clearInterval(timer);\\n" +
"    if (loader) {\\n" +
"      loader.update(100);\\n" +
"      setTimeout(() => loader.destroy(), 250);\\n" +
"    }\\n" +
"\\n" +
"    if (blobs.length === 0) {\\n" +
"      throw new Error('TTS failed: empty content');\\n" +
"    }\\n" +
"\\n" +
"    const finalBlob = new Blob(blobs, { type: 'audio/mpeg' });\\n" +
"    const audioUrl = URL.createObjectURL(finalBlob);\\n" +
"    return playAudio(audioUrl, effectiveRate);";

if (regex.test(code)) {
  code = code.replace(regex, newStr);
  fs.writeFileSync(file, code, 'utf-8');
  console.log('Patched SpeakButton.tsx');
} else {
  console.log('Target string not found in SpeakButton.tsx');
}
