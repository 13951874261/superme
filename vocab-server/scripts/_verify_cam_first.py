#!/usr/bin/env python3
"""Verify dict-query Cambridge-first + enrichment flags for organise/mud."""
import json
import os
import time
import urllib.request

BASE = "http://127.0.0.1:3001"
USER = "lzhmy"

def post_dict(word: str) -> dict:
    payload = {
        "word": word,
        "dictType": "en_zh_bidirectional",
        "direction": "auto",
        "locale": "zh-CN",
        "userContext": "",
        "userId": USER,
    }
    req = urllib.request.Request(
        f"{BASE}/api/dify/dict-query",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read().decode("utf-8"))

def summarize(label: str, d: dict) -> None:
    p = d.get("payload") or {}
    senses = p.get("senses") or []
    sense_ex = sum(len(s.get("examples") or []) for s in senses)
    examples = p.get("example_sentences") or []
    print(f"=== {label} ===")
    print("ok", d.get("ok"), "fromCache", d.get("fromCache"), "enriching", d.get("backgroundEnriching"), "inVocab", d.get("inVocabulary"))
    print("translation", (p.get("translation_main") or "")[:60])
    print("direction", p.get("direction_resolved"))
    print("senses", len(senses), "sense_examples", sense_ex, "example_sentences", len(examples))
    print("idioms", len(p.get("idioms") or []), "syn", len(p.get("synonyms") or []), "col", len(p.get("collocations") or []))
    cam_ok = len(senses) > 0 or len(examples) > 0
    print("cambridge_display_ok", cam_ok)
    thin_vocab_like = (p.get("translation_main") == "组织，安排") and not cam_ok
    print("not_thin_vocab_only", not thin_vocab_like)

def main():
    words = [os.environ.get("CHECK_WORD", "organise"), "mud"]
    # dedupe if CHECK_WORD is mud
    seen = []
    for w in words:
        if w not in seen:
            seen.append(w)
    for w in seen:
        d = post_dict(w)
        summarize(f"{w} first", d)
        if d.get("backgroundEnriching"):
            time.sleep(8)
            d2 = post_dict(w)
            summarize(f"{w} after_8s", d2)

if __name__ == "__main__":
    main()
