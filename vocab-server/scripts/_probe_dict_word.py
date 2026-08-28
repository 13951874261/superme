#!/usr/bin/env python3
import json
import os
import urllib.request

word = os.environ.get("CHECK_WORD", "organise")
payload = {
    "word": word,
    "dictType": "en_zh_bidirectional",
    "direction": "auto",
    "locale": "zh-CN",
    "userContext": "",
    "userId": "lzhmy",
}
req = urllib.request.Request(
    "http://127.0.0.1:3001/api/dify/dict-query",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=60) as resp:
    raw = resp.read()
d = json.loads(raw)
p = d.get("payload") or {}
print("bytes", len(raw))
print("ok", d.get("ok"), "fromCache", d.get("fromCache"), "enriching", d.get("backgroundEnriching"))
print("translation", (p.get("translation_main") or "")[:60])
print("direction", p.get("direction_resolved"))
print("examples", len(p.get("example_sentences") or []))
print("senses", len(p.get("senses") or []))
print("sense_examples", sum(len(s.get("examples") or []) for s in (p.get("senses") or [])))
print("synonyms", p.get("synonyms") or [])
print("collocations", (p.get("collocations") or [])[:5])
print("idioms", len(p.get("idioms") or []))
