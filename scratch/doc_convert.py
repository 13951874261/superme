# -*- coding: utf-8 -*-
from markitdown import MarkItDown
import os
import sys

print("Python version:", sys.version)
md = MarkItDown()
files = [
    r"D:\cursor\work\super-agent\7.21日反馈 (已自动恢复).docx",
    r"D:\cursor\work\super-agent\7.22日反馈.docx"
]
for f in files:
    print(f"Checking {f}...")
    if os.path.exists(f):
        print(f"File exists! Size: {os.path.getsize(f)} bytes. Converting...")
        try:
            result = md.convert(f)
            out_name = f.replace(".docx", ".md")
            with open(out_name, "w", encoding="utf-8") as out:
                out.write(result.text_content)
            print(f"Successfully saved to {out_name}")
        except Exception as e:
            print(f"Error converting {f}: {e}")
    else:
        print(f"File does not exist: {f}")