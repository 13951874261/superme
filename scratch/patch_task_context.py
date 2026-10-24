
filePath = r"src/components/TaskContext.tsx"
with open(filePath, "r", encoding="utf-8") as f_in:
    code = f_in.read()

target = "  type: 'url' | 'video' | 'material' | 'tts' | 'game_theory' | 'listen_backfill';"
replacement = "  type: 'url' | 'video' | 'material' | 'tts' | 'game_theory' | 'listen_backfill' | 'vocab_export';"

if target in code:
    code = code.replace(target, replacement)
    with open(filePath, "w", encoding="utf-8") as f_out:
        f_out.write(code)
    print("SUCCESS")
else:
    print("TARGET NOT FOUND")
