filePath = "src/components/modules/EnglishModule.tsx"
with open(filePath, "r", encoding="utf-8") as f_in:
    code = f_in.read()

# Update description to remove "必须达成硬性通关标准方可解锁下行主题"
target_desc = """      description="不仅是交流，而是用英语构建信任、影响他人并主导跨国谈判。必须达成硬性通关标准方可解锁下行主题。" """
replacement_desc = """      description="不仅是交流，而是用英语构建信任、影响他人并主导跨国谈判。可在进度总控的「战略路线图」中自由切换想要练习的主题或阶段。" """

if target_desc in code:
    code = code.replace(target_desc, replacement_desc)
    print("Description patched (CRLF)")
elif target_desc.replace("\r\n", "\n") in code:
    code = code.replace(target_desc.replace("\r\n", "\n"), replacement_desc.replace("\r\n", "\n"))
    print("Description patched (LF)")
else:
    # Let's try exact matching without spaces
    target_desc_clean = 'description="不仅是交流，而是用英语构建信任、影响他人并主导跨国谈判。必须达成硬性通关标准方可解锁下行主题。"'
    replacement_desc_clean = 'description="不仅是交流，而是用英语构建信任、影响他人并主导跨国谈判。可在进度总控的「战略路线图」中自由切换想要练习的主题或阶段。"'
    if target_desc_clean in code:
        code = code.replace(target_desc_clean, replacement_desc_clean)
        print("Description patched clean (CRLF)")
    elif target_desc_clean.replace("\r\n", "\n") in code:
        code = code.replace(target_desc_clean.replace("\r\n", "\n"), replacement_desc_clean.replace("\r\n", "\n"))
        print("Description patched clean (LF)")
    else:
        print("Description target NOT FOUND")

with open(filePath, "w", encoding="utf-8") as f_out:
    f_out.write(code)
print("done")
