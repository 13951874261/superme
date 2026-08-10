filePath = "src/components/modules/english/tabs/dashboard/ThemeGateway.tsx"
with open(filePath, "r", encoding="utf-8") as f_in:
    code = f_in.read()

# Remove the StatusBadge that shows the lock visual
target_badge = '''        <StatusBadge 
          status={masteryData?.isMastered ? 'unlocked' : 'locked'}
          label={masteryData?.isMastered ? '已通关' : '未达标'}
        />'''

replacement_badge = '''        <span className="text-[10px] text-slate-400 font-medium">
          {masteryData?.isMastered ? '已通关' : '未达标'}
        </span>'''

if target_badge in code:
    code = code.replace(target_badge, replacement_badge)
    print("StatusBadge removed")
elif target_badge.replace("\r\n", "\n") in code:
    code = code.replace(target_badge.replace("\r\n", "\n"), replacement_badge.replace("\r\n", "\n"))
    print("StatusBadge removed (LF)")
else:
    print("StatusBadge NOT FOUND")

with open(filePath, "w", encoding="utf-8") as f_out:
    f_out.write(code)
print("done")
