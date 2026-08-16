const fs = require('fs');
const file = 'D:/cursor/work/super-agent/src/components/SpeakButton.tsx';
let code = fs.readFileSync(file, 'utf-8');

code = code.replace("throw new Error(TTS synthesis failed: \);", "throw new Error(TTS synthesis failed: \);");

fs.writeFileSync(file, code, 'utf-8');
console.log('Fixed interpolation syntax');
