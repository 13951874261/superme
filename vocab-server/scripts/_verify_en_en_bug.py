#!/usr/bin/env python3
import json
import urllib.request

def query(word, dict_type):
    payload = {
        "word": word,
        "dictType": dict_type,
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
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read().decode("utf-8"))

def summarize(label, d):
    p = d.get("payload") or {}
    print("===", label, "===")
    print("ok", d.get("ok"), "cache", d.get("fromCache"), "enriching", d.get("backgroundEnriching"))
    print("edition", p.get("edition"))
    print("source_url", p.get("source_url"))
    print("def0", (p.get("definitions_en") or [""])[0][:80])
    print("meaning_zh", repr(p.get("meaning_zh") or ""))
    print("business_notes", repr((p.get("business_notes") or "")[:40]))
    print("senses", len(p.get("senses") or []), "examples", len(p.get("example_sentences") or []))
    print("syn", len(p.get("synonyms") or []), "col", len(p.get("collocations") or []))
    url_ok = "dictionary/english/" in str(p.get("source_url") or "")
    pure = not (p.get("meaning_zh") or "").strip() and not (p.get("business_notes") or "").strip()
    print("ACCEPT_url_english", url_ok)
    print("ACCEPT_pure_en_fields", pure)
    print("ACCEPT_cam_body", len(p.get("senses") or []) > 0 or len(p.get("definitions_en") or []) > 0)

# en_en single word
summarize("en_en bug", query("bug", "en_en_business"))
# en_zh regression: should still be simplified Chinese dictionary
d = query("mud", "en_zh_bidirectional")
p = d.get("payload") or {}
print("=== en_zh mud regression ===")
print("source_url", p.get("source_url"))
print("ACCEPT_still_simplified", "english-chinese-simplified" in str(p.get("source_url") or ""))
