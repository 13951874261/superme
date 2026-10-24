const fs = require('fs');
const file = 'D:/cursor/work/super-agent/src/components/SpeakButton.tsx';
let code = fs.readFileSync(file, 'utf-8');

const regex = /throw new Error\(TTS synthesis failed: \);/;
const newStr = "throw new Error(TTS synthesis failed: \);";

if (regex.test(code)) {
  code = code.replace(regex, newStr);
  fs.writeFileSync(file, code, 'utf-8');
  console.log('Fixed syntax error');
} else {
  console.log('Target string not found');
}
