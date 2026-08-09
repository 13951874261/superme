filePath = "src/components/modules/english/tabs/VocabTab.tsx"
with open(filePath, "r", encoding="utf-8") as f_in:
    code = f_in.read()

# 2. Patch: Add submittingQuality state after isSpellError
target_state = "  const [isSpellError, setIsSpellError] = useState(false);"
replacement_state = "  const [isSpellError, setIsSpellError] = useState(false);\n  const [submittingQuality, setSubmittingQuality] = useState(false);"

if target_state in code:
    code = code.replace(target_state, replacement_state)
    print("State patched")
elif target_state.replace("\r\n", "\n") in code:
    code = code.replace(target_state.replace("\r\n", "\n"), replacement_state.replace("\r\n", "\n"))
    print("State patched (LF)")
else:
    print("State NOT FOUND")

with open(filePath, "w", encoding="utf-8") as f_out:
    f_out.write(code)
print("done")
