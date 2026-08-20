import json

def extract_json_str(s: str) -> str:
    s = s.strip()
    
    # Check if wrapped in triple backticks anywhere
    first_fence = s.find("```")
    if first_fence != -1:
        start_idx = s.find("\n", first_fence)
        if start_idx == -1:
            start_idx = first_fence + 3
        else:
            start_idx += 1
            
        last_fence = s.rfind("```")
        if last_fence != -1 and last_fence > start_idx:
            return s[start_idx:last_fence].strip()
            
    # If no markdown fences are found, try extracting by matching braces
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

# Test cases
cases = [
    # 1. Clean JSON
    '{"ok": true}',
    # 2. Triple backticks with json language specifier
    '```json\n{"ok": true}\n```',
    # 3. Triple backticks with spaces and leading text
    'Here is the result:\n```json\n{"ok": true}\n```\nHope it helps!',
    # 4. Triple backticks without language specifier
    '```\n{"ok": true}\n```',
    # 5. Nested json with braces
    'Some text {"nested": {"value": 1}} other text',
]

for idx, c in enumerate(cases):
    extracted = extract_json_str(c)
    try:
        parsed = json.loads(extracted)
        print(f"Case {idx + 1} passed: {parsed}")
    except Exception as e:
        print(f"Case {idx + 1} failed: {e}. Extracted: {repr(extracted)}")
