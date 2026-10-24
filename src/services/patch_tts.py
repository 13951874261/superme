import sys
sys.stdout.reconfigure(encoding='utf-8')
file_path = 'D:/cursor/work/super-agent/src/services/ttsAPI.ts'
content = open(file_path, 'r', encoding='utf-8').read()

old_options = '''export interface TtsSpeechOptions {
  model?: string;
  isAsync?: boolean;
}'''

new_options = '''export interface TtsSpeechOptions {
  model?: string;
  isAsync?: boolean;
  effects?: {
    accent?: 'indian' | 'british' | 'australian' | '';
    packet_loss?: boolean;
    interruptions?: boolean;
    information_gap?: boolean;
  };
}'''

old_body = '''      body: JSON.stringify({
        input,
        model: options.model ?? buildTtsModel(),
        ...(options.isAsync !== undefined ? { isAsync: options.isAsync } : {}),
      }),'''

new_body = '''      body: JSON.stringify({
        input,
        model: options.model ?? buildTtsModel(),
        ...(options.isAsync !== undefined ? { isAsync: options.isAsync } : {}),
        ...(options.effects !== undefined ? { effects: options.effects } : {}),
      }),'''

if old_options not in content or old_body not in content:
    print('ERROR: target content not found')
    sys.exit(1)

content = content.replace(old_options, new_options).replace(old_body, new_body)
open(file_path, 'w', encoding='utf-8').write(content)
print('SUCCESS')
