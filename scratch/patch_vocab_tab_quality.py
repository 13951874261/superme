filePath = "src/components/modules/english/tabs/VocabTab.tsx"
with open(filePath, "r", encoding="utf-8") as f_in:
    code = f_in.read()

# 1. Patch imports: add XCircle, AlertTriangle
target_import = "import { BookOpen, Loader2, CheckCircle2, Zap, Briefcase, Globe, CalendarCheck, Library, BrainCircuit } from 'lucide-react';"
replacement_import = "import { BookOpen, Loader2, CheckCircle2, Zap, Briefcase, Globe, CalendarCheck, Library, BrainCircuit, XCircle, AlertTriangle } from 'lucide-react';"

if target_import in code:
    code = code.replace(target_import, replacement_import)
    print("Imports patched")
elif target_import.replace("\r\n", "\n") in code:
    code = code.replace(target_import.replace("\r\n", "\n"), replacement_import.replace("\r\n", "\n"))
    print("Imports patched (LF)")
else:
    print("Imports NOT FOUND")

# 2. Patch: Add submittingQuality state
target_state = "  const [submitting, setSubmitting] = useState(false);"
replacement_state = "  const [submitting, setSubmitting] = useState(false);\n  const [submittingQuality, setSubmittingQuality] = useState(false);"

if target_state in code:
    code = code.replace(target_state, replacement_state)
    print("State patched")
elif target_state.replace("\r\n", "\n") in code:
    code = code.replace(target_state.replace("\r\n", "\n"), replacement_state.replace("\r\n", "\n"))
    print("State patched (LF)")
else:
    print("State NOT FOUND")

# 3. Patch: Add handleQuality function before handleEvaluate
target_func = "  const handleEvaluate = async () => {"
replacement_func = """  const handleQuality = async (quality: number) => {
    if (!currentWord || submittingQuality) return;
    setSubmittingQuality(true);
    try {
      await submitReview(currentWord.id, quality);
      playSuccess();
      if (quality === 5) setShowConfetti(true);
      window.dispatchEvent(new Event('vocab-updated'));
      showNotice('eval', `已评分 ${quality}/5，推入下个词`, 'success');
      setEvalResult(null);
      setSentenceInput('');
      advanceWord();
      setIsFlipped(false);
      setSpellInput('');
    } catch (err: any) {
      playError();
      showNotice('eval', `评分录入失败: ${err.message}`, 'error');
    } finally {
      setSubmittingQuality(false);
    }
  };

  const handleEvaluate = async () => {"""

if target_func in code:
    code = code.replace(target_func, replacement_func)
    print("handleQuality function patched")
elif target_func.replace("\r\n", "\n") in code:
    code = code.replace(target_func.replace("\r\n", "\n"), replacement_func.replace("\r\n", "\n"))
    print("handleQuality function patched (LF)")
else:
    print("handleQuality function NOT FOUND")

with open(filePath, "w", encoding="utf-8") as f_out:
    f_out.write(code)
print("done")
