import os
filePath = "src/components/VocabExportControl.tsx"
with open(filePath, "r", encoding="utf-8") as f_in:
    code = f_in.read().replace("\r\n", "\n")
import_target = "import {\n  exportVocabCsv,\n  type VocabExportScope,\n  type VocabTabCategory,\n} from '../utils/vocabCsvExport';"
import_replacement = "import {\n  type VocabExportScope,\n  type VocabTabCategory,\n} from '../utils/vocabCsvExport';\nimport { useTask } from './TaskContext';"
hook_target = "  const [busy, setBusy] = useState(false);\n  const rootRef = useRef<HTMLDivElement>(null);"
hook_replacement = "  const [busy, setBusy] = useState(false);\n  const rootRef = useRef<HTMLDivElement>(null);\n  const { addTask } = useTask();"
func_target = "  const runExport = async (scope: VocabExportScope) => {\n    if (busy) return;\n    setBusy(true);\n    setOpen(false);\n    try {\n      const count = await exportVocabCsv({\n        scope,\n        currentTab,\n        words,\n        filenamePrefix:\n          scope === 'due_today'\n            ? 'vocab-due'\n            : scope === 'current_tab'\n              ? `vocab-${currentTab}`\n              : 'vocab-all',\n      });\n      onExported?.(count, scope);\n    } catch (e: any) {\n      onError?.(e?.message || '????');\n    } finally {\n      setBusy(false);\n    }\n  };"
func_replacement = """  const runExport = async (scope: VocabExportScope) => {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    try {
      const response = await fetch('/api/vocab/export-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, currentTab }),
      });
      if (!response.ok) {
        throw new Error(`??????????: HTTP ${response.status}`);
      }
      const data = await response.json();
      if (!data.success || !data.taskId) {
        throw new Error(data.error || '??????????');
      }

      // ??????????????
      addTask({
        id: data.taskId,
        type: 'vocab_export' as any,
        name: `?????: ${ADVANCED_OPTIONS.find((o) => o.scope === scope)?.label || scope}`,
        status: data.status || 'pending',
        progress: 0,
        logs: ['[??] ?????????...'],
      });

      // ????????????
      try {
        const { showToast } = await import('./Toast');
        showToast('?????????????????????????????', 'success');
      } catch (e) {}

      onExported?.(0, scope);
    } catch (e: any) {
      onError?.(e?.message || '????');
      try {
        const { showToast } = await import('./Toast');
        showToast(e?.message || '??????', 'error');
      } catch (err) {}
    } finally {
      setBusy(false);
    }
  };"""
code = code.replace(import_target, import_replacement)
code = code.replace(hook_target, hook_replacement)
code = code.replace(func_target, func_replacement)
with open(filePath, "w", encoding="utf-8", newline="\n") as f_out:
    f_out.write(code)
print("PATCH DONE")
