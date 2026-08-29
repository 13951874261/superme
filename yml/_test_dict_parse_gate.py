# -*- coding: utf-8 -*-
"""Regression: weak {pos}-only slice must not beat full en_zh payload."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _dict_parse_gate import loads_for_type, _is_strong_candidate

# Case A: noisy output with a weak pos-only blob + full dict
noisy = '''
Some KB junk {"pos": "n.", "level": "CET-4"} more junk
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

got = loads_for_type(noisy, "en_zh_bidirectional")
assert got.get("translation_main") == "氛围；感觉", got
assert got.get("direction_resolved") == "en_to_zh", got
print("PASS: picks full dict over weak pos-only slice")

# Case B: only weak object -> fall through to whole-text parse returning weak,
# then VALIDATE layer would catch it; loads_for_type may still return weak via last attempt.
weak_only = '{"pos": "noun"}'
assert _is_strong_candidate({"pos": "noun"}, "en_zh_bidirectional") is False
weak_got = loads_for_type(weak_only, "en_zh_bidirectional")
# last-attempt returns the only dict; VALIDATE in main() still fails — expected
assert "direction_resolved" not in weak_got
print("PASS: weak-only is not strong; last-attempt still returns dict for VALIDATE")

# Case C: all anchors present without every optional-ish key still strong
partial = {
    "direction_resolved": "en_to_zh",
    "translation_main": "x",
    "example_sentences": [],
    "phonetic": "/x/",
    "pos": "n.",
}
assert _is_strong_candidate(partial, "en_zh_bidirectional") is True
print("PASS: all anchors => strong")
print("ALL OK")
