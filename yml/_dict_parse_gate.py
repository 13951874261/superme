# -*- coding: utf-8 -*-
"""Unit-testable extract of dict_tool '封装 API JSON' loads_for_type gate."""
import json
import re
import ast

_REQUIRED_KEYS = {
    "en_zh_bidirectional": [
        "direction_resolved", "phonetic", "pos", "translation_main",
        "other_meanings", "business_examples", "example_sentences",
        "synonyms", "antonyms", "collocations",
    ],
}

_ANCHOR_KEYS = {
    "en_zh_bidirectional": ("direction_resolved", "translation_main", "example_sentences"),
}


def _strip_wrappers(s: str) -> str:
    s = (s or "").strip()
    s = re.sub(r"<think>[\s\S]*?</think>", "", s, flags=re.I).strip()
    s = re.sub(r"<reasoning>[\s\S]*?</reasoning>", "", s, flags=re.I).strip()
    return s


def _normalize_quotes(s: str) -> str:
    trans = str.maketrans({
        "\u201c": '"', "\u201d": '"', "\u2018": "'", "\u2019": "'",
        "\uff02": '"', "\uff07": "'",
        "\uff5b": "{", "\uff5d": "}",
    })
    return s.translate(trans)


def _strip_trailing_commas(s: str) -> str:
    return re.sub(r",(\s*[}\]])", r"\1", s)


def _balanced_slices(s: str, open_ch="{", close_ch="}"):
    n = len(s)
    i = 0
    while i < n:
        if s[i] != open_ch:
            i += 1
            continue
        depth = 0
        in_str = False
        esc = False
        quote = ""
        for j in range(i, n):
            ch = s[j]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == quote:
                    in_str = False
                continue
            if ch in ('"', "'"):
                in_str = True
                quote = ch
                continue
            if ch == open_ch:
                depth += 1
            elif ch == close_ch:
                depth -= 1
                if depth == 0:
                    yield s[i : j + 1]
                    break
        i += 1


def _try_parse_obj(cand: str):
    cand = _normalize_quotes(cand).strip()
    variants = [cand, _strip_trailing_commas(cand)]
    for v in variants:
        try:
            obj = json.loads(v)
            if isinstance(obj, dict):
                return obj
        except Exception:
            pass
    for v in variants:
        try:
            obj = ast.literal_eval(v)
            if isinstance(obj, dict):
                return obj
        except Exception:
            pass
    try:
        fixed = re.sub(r"(?<![\\])'", '"', variants[-1])
        obj = json.loads(_strip_trailing_commas(fixed))
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass
    return None


def _is_strong_candidate(obj: dict, dt: str) -> bool:
    """Reject weak slices that only share a few keys (e.g. only pos)."""
    required = _REQUIRED_KEYS.get(dt, [])
    anchors = _ANCHOR_KEYS.get(dt, ())
    req_hit = sum(1 for k in required if k in obj)
    anchors_hit = sum(1 for a in anchors if a in obj)
    # Must hit ALL anchors, OR at least 70% of required keys (ceil)
    min_req = max(len(anchors), (len(required) * 7 + 9) // 10)  # ~70%
    return anchors_hit >= len(anchors) or req_hit >= min_req


def loads_for_type(raw: str, dt: str):
    s = _strip_wrappers(raw)
    if not s:
        raise ValueError("empty LLM text")

    fence = re.search(r"```(?:json|JSON)?\s*([\s\S]*?)```", s)
    blobs = []
    if fence:
        blobs.append(fence.group(1).strip())
    blobs.append(s)

    anchors = _ANCHOR_KEYS.get(dt, ())
    required = _REQUIRED_KEYS.get(dt, [])
    best = None
    best_score = -1

    for blob in blobs:
        slices = list(_balanced_slices(blob))
        if not slices and blob.strip().startswith("{"):
            slices = [blob.strip()]
        ordered = []
        for sl in slices:
            if any(a in sl for a in anchors):
                ordered.append(sl)
        for sl in slices:
            if sl not in ordered:
                ordered.append(sl)

        for sl in ordered:
            obj = _try_parse_obj(sl)
            if not obj:
                continue
            if not _is_strong_candidate(obj, dt):
                continue
            score = sum(1 for k in required if k in obj)
            score += sum(2 for a in anchors if a in obj)
            if score > best_score:
                best_score = score
                best = obj

    if best is not None and best_score > 0:
        return best

    obj = _try_parse_obj(s)
    if isinstance(obj, dict):
        return obj

    raise ValueError("无法从 LLM 输出中定位合法词典 JSON 对象")
