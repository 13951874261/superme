filePath = "src/components/modules/english/tabs/dashboard/ThemeGateway.tsx"
with open(filePath, "r", encoding="utf-8") as f_in:
    code = f_in.read()

# Remove the unused StatusBadge import
target_import = """import { StatusBadge } from '../ui/Badge/StatusBadge';"""
code = code.replace(target_import + "\n", "").replace(target_import + "\r\n", "")

with open(filePath, "w", encoding="utf-8") as f_out:
    f_out.write(code)
print("Removed StatusBadge import!")
