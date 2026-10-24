import re

test_md = """### vibenoun  (MOOD)

the mood of a place, situation, person

### vibenoun  (INSTRUMENT)

vibes plural for vibraphone
"""

# 测试不同正则
pattern1 = re.compile(r'^###\s+(.+?)(?=^###|\Z)', re.MULTILINE)
pattern2 = re.compile(r'^###\s+(.+?)(?=^###|\Z)', re.MULTILINE | re.DOTALL)

print("Pattern 1 (no DOTALL):")
matches1 = list(pattern1.finditer(test_md))
print(f"  Matches: {len(matches1)}")

print("\nPattern 2 (with DOTALL):")
matches2 = list(pattern2.finditer(test_md))
print(f"  Matches: {len(matches2)}")
for m in matches2:
    print(f"  Match: {repr(m.group(0)[:80])}...")