# -*- coding: utf-8 -*-
"""Verify patched YAML code node still parses & applies strong gate."""
import re
from pathlib import Path

text = Path(r"D:\cursor\work\super-agent\yml\dict_tool_workflow_parse_fixed.yml").read_text(encoding="utf-8")

marker = '        title: 封装 API JSON'
title_idx = text.find(marker)
code_key = '        code: "'
start = text.rfind(code_key, 0, title_idx) + len(code_key)
i = start
out = []
while i < len(text):
    ch = text[i]
    if ch == "\\" and i + 1 < len(text):
        nxt = text[i + 1]
        if nxt == "n":
            out.append("\n"); i += 2; continue
        if nxt == '"':
            out.append('"'); i += 2; continue
        if nxt == "\\":
            out.append("\\"); i += 2; continue
        if nxt == "\n":
            i += 2
            while i < len(text) and text[i] in " \t":
                i += 1
            continue
        out.append(nxt); i += 2; continue
    if ch == '"':
        break
    if ch == "\n":
        i += 1; continue
    out.append(ch); i += 1

code = "".join(out)
ns = {}
exec(code, ns)
loads_for_type = ns["loads_for_type"]
main = ns["main"]

noisy = '''
KB {"pos": "n.", "level": "CET-4"}
{
  "direction_resolved": "en_to_zh",
  "phonetic": "/vaɪb/",
  "pos": "n.",
  "translation_main": "氛围；感觉",
  "other_meanings": [],
  "business_examples": [{"scene": "会议", "en": "The vibe was positive.", "zh": "气氛积极。"}],
  "example_sentences": [{"en": "I like the vibe here.", "zh": "我喜欢这里的氛围。"}],
  "synonyms": ["atmosphere"],
  "antonyms": [],
  "collocations": ["good vibe"]
}
'''
payload = loads_for_type(noisy, "en_zh_bidirectional")
assert payload["translation_main"] == "氛围；感觉"
print("YAML code loads_for_type OK")

# weak-only -> VALIDATE
import json
res = main("", "", '{"pos":"n."}', "vibe", "en_zh_bidirectional")
obj = json.loads(res["result_json"])
assert obj["ok"] is False and obj["error_code"] == "VALIDATE"
assert "keys=" in obj["message"]
print("VALIDATE message improved:", obj["message"][:120], "...")

# full success
res2 = main("", "", noisy, "vibe", "en_zh_bidirectional")
obj2 = json.loads(res2["result_json"])
assert obj2["ok"] is True
print("full success OK")

assert "完整输出示例" in text or "good vibe" in text
print("prompt example present")
print("ALL VERIFY OK")
