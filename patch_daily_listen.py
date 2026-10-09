with open('vocab-server/services/dailyListenPreGenerateService.js', 'r', encoding='utf-8') as f:
    code = f.read()

old_decl = 'const durationList = resolveListenDurations({ source, durations });'
new_decl = 'let durationList = resolveListenDurations({ source, durations });'

if old_decl in code:
    code = code.replace(old_decl, new_decl)
    print("Changed const durationList to let durationList successfully.")
else:
    print("Pattern not found!")

with open('vocab-server/services/dailyListenPreGenerateService.js', 'w', encoding='utf-8') as f:
    f.write(code)