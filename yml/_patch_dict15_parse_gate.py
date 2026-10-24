# -*- coding: utf-8 -*-
"""Patch dict_tool_workflow (15).yml -> parse-gate fixed export."""
from __future__ import annotations

import re
from pathlib import Path

SRC = Path(r"c:\Users\lzhumy\Downloads\dict_tool_workflow (15).yml")
OUT = Path(r"D:\cursor\work\super-agent\yml\dict_tool_workflow_parse_fixed.yml")
OUT_DOWNLOAD = Path(r"c:\Users\lzhumy\Downloads\dict_tool_workflow (16)-parse-gate.yml")

ENZH_EXAMPLE = r'''
【完整输出示例（英译汉，查询 vibe 时必须达到同等完整度，键名不可改）】
{"direction_resolved":"en_to_zh","phonetic":"/vaɪb/","pos":"n.","translation_main":"氛围；感觉","level":"CET-4","etymology":"源自 vibrate 的口语缩短。","other_meanings":[{"meaning":"vibes 复数：整体感受","note":"口语"}],"business_examples":[{"scene":"商务会议","en":"The vibe in the kickoff meeting was constructive.","zh":"启动会上的氛围很建设性。"}],"example_sentences":[{"en":"I like the vibe of this cafe.","zh":"我喜欢这家咖啡馆的氛围。"}],"synonyms":["atmosphere","mood"],"antonyms":[],"collocations":["good vibe","catch the vibe"]}
禁止只输出含 pos/level 等少数键的残缺对象；禁止输出多个互不相关的 JSON 片段。
'''

# --- replacements inside the unescaped Python code of 封装 API JSON ---
OLD_SCORE = '''            obj = _try_parse_obj(sl)
            if not obj:
                continue
            score = sum(1 for k in required if k in obj)
            # bonus if anchors present
            score += sum(2 for a in anchors if a in obj)
            if score > best_score:
                best_score = score
                best = obj

    if best is not None and best_score > 0:
        return best'''

NEW_SCORE = '''            obj = _try_parse_obj(sl)
            if not obj:
                continue
            # strong-candidate gate: reject weak slices that only share a few keys (e.g. only pos)
            req_hit = sum(1 for k in required if k in obj)
            anchors_hit = sum(1 for a in anchors if a in obj)
            min_req = max(len(anchors), (len(required) * 7 + 9) // 10)  # ~70%
            if anchors_hit < len(anchors) and req_hit < min_req:
                continue
            score = req_hit + anchors_hit * 2
            if score > best_score:
                best_score = score
                best = obj

    if best is not None and best_score > 0:
        return best'''

OLD_VALIDATE = '''    missing = [k for k in required if k not in payload]
    if missing:
        return fail(
            "VALIDATE",
            f"LLM 返回 JSON 缺少 {len(missing)} 个必须字段: {', '.join(missing)}。"
            f"请检查当前分支 LLM 节点 Prompt 是否包含这些键。",
        )'''

NEW_VALIDATE = '''    missing = [k for k in required if k not in payload]
    if missing:
        present = [k for k in required if k in payload]
        preview = str(list(payload.keys())[:12])
        return fail(
            "VALIDATE",
            f"LLM 返回 JSON 缺少 {len(missing)} 个必须字段: {', '.join(missing)}。"
            f"已有: {', '.join(present) or '(无)'}。keys={preview}。"
            f"请检查英汉双向·LLM 原始输出是否完整，或是否误选了残缺 JSON 片段。",
        )'''


def yaml_escape_code(code: str) -> str:
    """Re-embed Python code into Dify-style double-quoted YAML scalar with line wraps."""
    # Escape for double-quoted YAML
    s = code.replace("\\", "\\\\").replace('"', '\\"')
    # Keep as one logical string with \\n for newlines — Dify export also wraps lines;
    # we wrap every ~100 chars at \\n boundaries for readability.
    parts = s.split("\\n")
    # Actually after replace, newlines in code became literal backslash-n only if we did that.
    # We need: real newlines in code -> the two chars \ and n in the YAML string.
    s2 = code.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
    # Soft-wrap at ~90 chars without breaking mid-escape: split on \\n sequences
    chunks = s2.split("\\n")
    out_lines = []
    buf = '"'
    first = True
    for i, chunk in enumerate(chunks):
        piece = chunk if i == 0 else ("\\n" + chunk)
        # if adding piece makes line too long, flush
        if not first and len(buf) + len(piece) > 100:
            out_lines.append(buf + "\\")
            buf = "          " + piece  # continuation indent matching Dify export
        else:
            buf += piece
        first = False
    out_lines.append(buf + '"')
    return "\n".join(out_lines)


def extract_code_block(text: str) -> tuple[str, int, int]:
    """Find the 封装 API JSON code: "..." block; return unescaped code and span in file."""
    marker = '        title: 封装 API JSON'
    title_idx = text.find(marker)
    if title_idx < 0:
        raise SystemExit("title 封装 API JSON not found")
    # search backwards for code: "
    code_key = '        code: "'
    start = text.rfind(code_key, 0, title_idx)
    if start < 0:
        raise SystemExit("code: key not found before title")
    content_start = start + len(code_key)
    # scan escaped double-quoted string
    i = content_start
    out = []
    while i < len(text):
        ch = text[i]
        if ch == "\\" and i + 1 < len(text):
            nxt = text[i + 1]
            if nxt == "n":
                out.append("\n")
                i += 2
                continue
            if nxt == '"':
                out.append('"')
                i += 2
                continue
            if nxt == "\\":
                out.append("\\")
                i += 2
                continue
            if nxt == "\n":
                # line continuation in YAML: backslash before newline then spaces
                i += 2
                while i < len(text) and text[i] in " \t":
                    i += 1
                continue
            out.append(nxt)
            i += 2
            continue
        if ch == '"':
            # end of string
            return "".join(out), start, i + 1
        if ch == "\n":
            # bare newline shouldn't appear inside; skip indent artifacts
            i += 1
            continue
        out.append(ch)
        i += 1
    raise SystemExit("unterminated code string")


def patch_enzh_prompt(text: str) -> str:
    """Append example before the closing of en-zh system prompt (before output discipline end)."""
    # Anchor: unique end of en-zh system prompt inside (15)
    anchor = (
        "4. 若知识库与当前查词无关，完全忽略知识库，仍为当前词条生成完整"
        "\\n            \\ JSON。\\n\""
    )
    # There are 3 LLM prompts with similar ending. Target the one after 英汉双向 title context.
    # Find "你是英汉双向商务及通用学习词典生成器" then the first occurrence of the closing JSON纪律 after it.
    enzh_start = text.find("你是英汉双向商务及通用学习词典生成器")
    if enzh_start < 0:
        raise SystemExit("en-zh prompt start not found")
    # Find the output discipline closing near enzh
    close_pat = (
        "4. 若知识库与当前查词无关，完全忽略知识库，仍为当前词条生成完整"
    )
    close_idx = text.find(close_pat, enzh_start)
    if close_idx < 0:
        raise SystemExit("en-zh prompt close not found")
    # Find end of this prompt string: `\n"` after JSON。
    end_marker = "\\ JSON。\\n\""
    end_idx = text.find(end_marker, close_idx)
    if end_idx < 0:
        # alternate wrapping
        end_marker2 = "JSON。\\n\""
        end_idx = text.find(end_marker2, close_idx)
        if end_idx < 0:
            raise SystemExit("en-zh prompt string end not found")
        insert_at = end_idx
        # insert before JSON。\n"
        # Actually we want to insert BEFORE the closing `JSON。\n"`
        # Better: insert after "JSON。\n" content, before closing quote — i.e. before final `"`
        # Structure: ...完整\n            \ JSON。\n"
        # We'll replace `JSON。\n"` with `JSON。\n` + escaped example + `"`
        example_escaped = (
            ENZH_EXAMPLE.strip()
            .replace("\\", "\\\\")
            .replace('"', '\\"')
            .replace("\n", "\\n")
        )
        old = text[end_idx : end_idx + len(end_marker2)]
        new = "JSON。\\n" + example_escaped + "\\n\""
        return text[:end_idx] + new + text[end_idx + len(end_marker2) :]

    example_escaped = (
        ENZH_EXAMPLE.strip()
        .replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
    )
    # end_marker is `\ JSON。\n"`
    new = "\\ JSON。\\n" + example_escaped + "\\n\""
    return text[:end_idx] + new + text[end_idx + len(end_marker) :]


def main():
    text = SRC.read_text(encoding="utf-8")
    code, start, end = extract_code_block(text)
    if OLD_SCORE not in code:
        raise SystemExit("OLD_SCORE block not found in extracted code — DSL may have changed")
    if OLD_VALIDATE not in code:
        raise SystemExit("OLD_VALIDATE block not found in extracted code")
    code2 = code.replace(OLD_SCORE, NEW_SCORE, 1).replace(OLD_VALIDATE, NEW_VALIDATE, 1)

    # Re-embed code with same wrapping style as Dify (backslash-newline continuations)
    embedded = yaml_escape_code(code2)
    # yaml_escape_code returns full "....", we need `        code: ` + that
    new_code_field = "        code: " + embedded
    text2 = text[:start] + new_code_field + text[end:]

    text3 = patch_enzh_prompt(text2)

    # bump app description lightly if present
    text3 = text3.replace(
        "desc: 三路 LLM 汇入。按 required/anchor 键定位真实 JSON；识别知识库回显；兼容单引号/fence/尾逗号。",
        "desc: 三路 LLM 汇入。强候选门槛（全 anchor 或 ≥70% 必填键）；拒绝仅含 pos 的残缺片段；VALIDATE 带 keys 预览。",
        1,
    )

    OUT.write_text(text3, encoding="utf-8")
    OUT_DOWNLOAD.write_text(text3, encoding="utf-8")
    print("Wrote", OUT)
    print("Wrote", OUT_DOWNLOAD)
    # verify extract again
    code_v, _, _ = extract_code_block(text3)
    assert "strong-candidate gate" in code_v or "min_req" in code_v
    assert "keys={preview}" in code_v
    assert "完整输出示例" in text3 or "good vibe" in text3
    print("Verify OK: gate + validate + example present")


if __name__ == "__main__":
    main()
