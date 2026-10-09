import re

def extract_pos(heading):
    """从标题中提取词性、标签和显式词头"""
    pos_words = ['phrasal verb', 'modal verb', 'adjective', 'adverb', 'noun', 'verb', 'pronoun', 'preposition', 'conjunction', 'exclamation', 'determiner']
    
    part_of_speech = ''
    label = ''
    explicit_headword = ''
    
    for p in pos_words:
        p_esc = p.replace(' ', r'\s+')
        
        # Pattern 1: word + POS + (label) e.g., "vibe noun (MOOD)" or "vibenoun(MOOD)" 
        m = re.search(r'^(.+?)\s*' + p_esc + r'\s*\(([^)]+)\)', heading, re.I)
        if m:
            part_of_speech = p.lower()
            label = m.group(2).strip()
            explicit_headword = m.group(1).strip()
            return part_of_speech, label, explicit_headword
        
        # Pattern 2: POS + (label) e.g., "noun (MOOD)" or "noun(MOOD)"
        m = re.search(r'^(?:' + p_esc + r')\s*\(([^)]+)\)', heading, re.I)
        if m:
            part_of_speech = p.lower()
            label = m.group(1).strip()
            return part_of_speech, label, explicit_headword
        
        # Pattern 3: POS + space + label (e.g., "noun C", "noun U") - check before POS only
        m = re.search(r'^(?:' + p_esc + r')\s+([A-Z]+(?:\s+[A-Z]+)?)\s*$', heading, re.I)
        if m:
            part_of_speech = p.lower()
            label = m.group(1).strip()
            return part_of_speech, label, explicit_headword
        
        # Pattern 4: word + POS (no label) e.g., "vibenoun" or "vibe noun"
        m = re.search(r'^(.+?)\s*' + p_esc + r'(?![a-z])', heading, re.I)
        if m and len(m.group(1)) > 0:
            part_of_speech = p.lower()
            explicit_headword = m.group(1).strip()
            return part_of_speech, label, explicit_headword
        
        # Pattern 5: POS only e.g., "noun"
        m = re.search(r'^(?:' + p_esc + r')$', heading, re.I)
        if m:
            part_of_speech = p.lower()
            return part_of_speech, label, explicit_headword
    
    return part_of_speech, label, explicit_headword

# Test
test_cases = [
    'vibenoun  (MOOD)',
    'vibenoun (INSTRUMENT)',
    'noun C',
    'noun U',
    'vibenoun',
    'vibe noun (MOOD)',
    'adjective good',
    'verb',
    'noun',
]

for tc in test_cases:
    pos, label, headword = extract_pos(tc)
    print(f"'{tc}' -> pos='{pos}', label='{label}', headword='{headword}'")