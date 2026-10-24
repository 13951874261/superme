from pathlib import Path
p = Path(r"D:\cursor\work\super-agent\src\components\modules\EntertainmentModule.tsx")
s = p.read_text(encoding="utf-8")

# Replace the corrupted question-mark strings with proper Chinese
replacements = [
    ("Dify ????????????", "Dify \u6682\u4e0d\u53ef\u7528\uff0c\u5f53\u524d\u4e3a\u515c\u5e95\u5185\u5bb9"),
    ("Dify ?????????????", "Dify \u5728\u7ebf\u751f\u6210\uff0c\u6bcf\u65e5\u5185\u5bb9\u81ea\u52a8\u53d8\u5316"),
    ("\u751f\u6210\u4e2d...", "\u751f\u6210\u4e2d\u2026"),
]

for old, new in replacements:
    if old in s:
        s = s.replace(old, new)
        print(f"Replaced: {old[:20]}...")
    else:
        print(f"Not found: {old[:20]}...")

p.write_text(s, encoding="utf-8")
print("Done")
