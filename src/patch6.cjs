const fs = require('fs');
const file = 'D:/cursor/work/super-agent/src/components/SpeakButton.tsx';
let code = fs.readFileSync(file, 'utf-8');

const regex = /function chunkTextForTTS[\s\S]*?return playAudio\(audioUrl, effectiveRate\);/;

const newStr = "function chunkTextForTTS(text: string, maxLength = 800) {\n" +
"      const chunks = [];\n" +
"      let currentChunk = '';\n" +
"      const sentences = text.match(/[^.!?\\n]+[.!?\\n]*/g) || [text];\n" +
"      for (let sentence of sentences) {\n" +
"        if ((currentChunk + sentence).length > maxLength && currentChunk.length > 0) {\n" +
"          chunks.push(currentChunk.trim());\n" +
"          currentChunk = '';\n" +
"        }\n" +
"        currentChunk += sentence;\n" +
"      }\n" +
"      if (currentChunk.trim()) {\n" +
"        chunks.push(currentChunk.trim());\n" +
"      }\n" +
"      return chunks;\n" +
"    }\n" +
"\n" +
"    const chunks = chunkTextForTTS(content);\n" +
"    \n" +
"    return new Promise(async (resolve, reject) => {\n" +
"      let currentIndex = 0;\n" +
"      let hasError = false;\n" +
"      \n" +
"      const playNext = async () => {\n" +
"        if (currentIndex >= chunks.length || hasError) {\n" +
"          if (currentIndex >= chunks.length && !hasError) {\n" +
"            clearInterval(timer);\n" +
"            if (loader) {\n" +
"              loader.update(100);\n" +
"              setTimeout(() => loader.destroy(), 250);\n" +
"            }\n" +
"            resolve(true);\n" +
"          }\n" +
"          return;\n" +
"        }\n" +
"        \n" +
"        try {\n" +
"          const chunk = chunks[currentIndex];\n" +
"          const response = await fetch('/api/tts/speech', {\n" +
"            method: 'POST',\n" +
"            headers: {\n" +
"              'Content-Type': 'application/json'\n" +
"            },\n" +
"            body: JSON.stringify({\n" +
"              model: modelName,\n" +
"              input: chunk\n" +
"            })\n" +
"          });\n" +
"\n" +
"          if (!response.ok) {\n" +
"            throw new Error(TTS synthesis failed: \);\n" +
"          }\n" +
"\n" +
"          const blob = await response.blob();\n" +
"          const currentAudioUrl = URL.createObjectURL(blob);\n" +
"          \n" +
"          if (currentIndex === 0) {\n" +
"             // 第一段加载完，可以取消进度条等待感，但此时先不直接关\n" +
"          }\n" +
"          \n" +
"          const isFinished = await playAudio(currentAudioUrl, effectiveRate);\n" +
"          if (isFinished) {\n" +
"            currentIndex++;\n" +
"            playNext();\n" +
"          } else {\n" +
"             hasError = true;\n" +
"             reject(new Error(\"Audio playback interrupted or failed\"));\n" +
"          }\n" +
"        } catch (error) {\n" +
"          hasError = true;\n" +
"          reject(error);\n" +
"        }\n" +
"      };\n" +
"      \n" +
"      playNext();\n" +
"    });";

if (regex.test(code)) {
  code = code.replace(regex, newStr);
  fs.writeFileSync(file, code, 'utf-8');
  console.log('Patched SpeakButton.tsx');
} else {
  console.log('Target string not found');
}
