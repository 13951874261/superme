filePath = "src/components/FlashCard.tsx"
with open(filePath, "r", encoding="utf-8") as f_in:
    code = f_in.read()

# Add word display on the back side (when flipped)
target_back = """              {isFlipped && (
                <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 animate-[fadeIn_0.2s_ease] relative">
                  {/* 1. 核心释义 */}"""

replacement_back = """              {isFlipped && (
                <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 animate-[fadeIn_0.2s_ease] relative">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div className="text-2xl font-black text-[#202124] tracking-tight select-all">{current.word}</div>
                    <SpeakButton text={current.word} title={`播放 ${current.word}`} className="w-8 h-8 bg-slate-100 hover:bg-[#FF5722] hover:text-white border border-gray-200 rounded-lg" iconClassName="w-4 h-4" />
                  </div>
                  {/* 1. 核心释义 */}"""

if target_back in code:
    code = code.replace(target_back, replacement_back)
    print("Back-side word display patched (CRLF)")
elif target_back.replace("\r\n", "\n") in code:
    code = code.replace(target_back.replace("\r\n", "\n"), replacement_back.replace("\r\n", "\n"))
    print("Back-side word display patched (LF)")
else:
    print("Back-side target NOT FOUND")

with open(filePath, "w", encoding="utf-8") as f_out:
    f_out.write(code)
print("done")
