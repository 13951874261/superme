import json

# Read current workflow YAML
with open('yml/dict_tool_workflow.yml', 'r', encoding='utf-8') as f:
    content = f.read()

# Define the new robust python code
new_python_code = """import json

_ALLOWED = frozenset({"zh_modern", "en_en_business", "en_zh_bidirectional"})


def _pick_raw_by_type(dict_type: str, raw_zh: str, raw_en: str, raw_enzh: str) -> str:
    t = (dict_type or "").strip()
    if t == "zh_modern":
        return (raw_zh or "").strip()
    if t == "en_en_business":
        return (raw_en or "").strip()
    return (raw_enzh or "").strip()


def main(raw_zh: str, raw_en: str, raw_enzh: str, word: str, route_type: str) -> dict:
    def fail(code: str, msg: str) -> dict:
        err = {
            "ok": False,
            "error_code": code,
            "message": msg,
            "word": word or "",
            "type": (route_type or "").strip(),
        }
        return {"result_json": json.dumps(err, ensure_ascii=False)}

    dt = (route_type or "").strip()
    if dt not in _ALLOWED:
        return fail("INPUT", "type 必须是 zh_modern | en_en_business | en_zh_bidirectional")
    t = _pick_raw_by_type(dt, raw_zh, raw_en, raw_enzh)
    
    def extract_json_str(s: str) -> str:
        s = s.strip()
        first_fence = s.find("```")
        if first_fence != -1:
            start_idx = s.find("\\n", first_fence)
            if start_idx == -1:
                start_idx = first_fence + 3
            else:
                start_idx += 1
            last_fence = s.rfind("```")
            if last_fence != -1 and last_fence > start_idx:
                return s[start_idx:last_fence].strip()
        first_brace = s.find('{')
        first_bracket = s.find('[')
        if first_brace == -1 and first_bracket == -1:
            return s
        if first_brace != -1 and (first_bracket == -1 or first_brace < first_bracket):
            last_brace = s.rfind('}')
            if last_brace != -1:
                return s[first_brace:last_brace+1]
        else:
            last_bracket = s.rfind(']')
            if last_bracket != -1:
                return s[first_bracket:last_bracket+1]
        return s

    t_clean = extract_json_str(t)
    if not t_clean:
        return fail("PARSE", "LLM 输出为空（请确认当前分支 LLM 已执行且三路汇入本节点）")
    try:
        payload = json.loads(t_clean)
    except Exception as e:
        return fail("PARSE", "LLM 输出非合法 JSON: " + str(e))
    if not isinstance(payload, dict):
        return fail("PARSE", "根节点必须是 JSON 对象")
    out = {"ok": True, "type": dt, "payload": payload}
    return {"result_json": json.dumps(out, ensure_ascii=False)}"""

# We want to format this new_python_code as a YAML double-quoted string.
# To do this safely, we can serialize it to JSON, which gives us the double-quoted string with escapes.
serialized_code = json.dumps(new_python_code, ensure_ascii=False)

# Let's locate the old code string in yml/dict_tool_workflow.yml
# In the yml file, the code string starts at line 828:
# code: "import json\n\n_FENCE = chr(96) * 3\n_ALLOWED = frozenset({\"zh_modern\"\
#           , \"en_en_business\", \"en_zh_bidirectional\"})\n\n\ndef _pick_raw_by_type(dict_type:\
# ... all the way to:
# ... return {\"result_json\": json.dumps(out, ensure_ascii=False)}\n"
#
# Let's search for code: "import json\n\n_FENCE
# Since the YAML has line continuation with backslashes, we can find the start index of code: "import json
start_key = 'code: "import json\\n\\n_FENCE'
start_idx = content.find(start_key)
if start_idx == -1:
    # Let's try searching for code: "import json
    start_key = 'code: "import json'
    start_idx = content.find(start_key)

if start_idx == -1:
    print("Error: Could not locate the python code block in YAML!")
    exit(1)

# Find the end of the double quoted string.
# Since it is a double quoted string, we can find the closing quote "
# We must scan character by character to handle escaped quotes \" and line continuations
idx = start_idx + len('code: ')
if content[idx] != '"':
    print("Error: The code block does not start with double quote!")
    exit(1)

# Scan for closing double quote
idx += 1
while idx < len(content):
    if content[idx] == '"' and content[idx-1] != '\\':
        break
    idx += 1

end_idx = idx

old_code_block = content[start_idx:end_idx+1]
new_code_block = f"code: {serialized_code}"

# Replace and write back
new_content = content[:start_idx] + new_code_block + content[end_idx+1:]
with open('yml/dict_tool_workflow.yml', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Successfully updated yml/dict_tool_workflow.yml!")
