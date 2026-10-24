import re
import json

def clean_md(value):
    text = str(value or '')
    text = re.sub(r'\[([^\[\]]*)\]\([^)]+\)', r'\1', text)
    text = re.sub(r'\[\[([^\[\]]*)\]\]\([^)]+\)', r'[$1]', text)
    text = re.sub(r'\((https?:\/\/[^)]+)\)', '', text)
    text = text.replace('\\', '')
    return text.replace('*', '').replace('_', '').replace('`', '').replace('#', '').strip()

def split_en_zh(value):
    text = clean_md(value)
    for i, c in enumerate(text):
        if '\u3400' <= c <= '\u9fff':
            return text[:i].strip(), text[i:].strip()
    return text, ''

def extract_pos_info(heading):
    pos_words = ['phrasal verb', 'modal verb', 'adjective', 'adverb', 'noun', 'verb', 'pronoun', 'preposition', 'conjunction', 'exclamation', 'determiner']
    pos = ''; label = ''; headword = ''
    for p in pos_words:
        p_esc = re.escape(p)
        m = re.search(r'^(.+?)\s*' + p_esc + r'\s*\(([^)]+)\)', heading, re.I)
        if m:
            pos, label, headword = p.lower(), m.group(2).strip(), m.group(1).strip()
            return pos, label, headword
        m = re.search(r'^(?:' + p_esc + r')\s*\(([^)]+)\)', heading, re.I)
        if m:
            pos, label = p.lower(), m.group(1).strip()
            return pos, label, headword
        m = re.search(r'^(.+?)\s*' + p_esc + r'\b', heading, re.I)
        if m and len(m.group(1)) > 0:
            pos, headword = p.lower(), m.group(1).strip()
            return pos, label, headword
        m = re.search(r'^(?:' + p_esc + r')\s+([A-Z]+)\s*$', heading, re.I)
        if m:
            pos, label = p.lower(), m.group(1).strip()
            return pos, label, headword
        m = re.search(r'^(?:' + p_esc + r')$', heading, re.I)
        if m:
            pos = p.lower()
            return pos, label, headword
    return pos, label, headword

def is_valid_definition_line(en_text):
    if len(en_text) < 5:
        return False
    if en_text.startswith('['):
        return False
    if re.match(r'^[A-Z\s]+$', en_text) and len(en_text) < 20:
        return False
    non_def = ['add to word list', 'your browser', 'translation of', 'dictionary.cambridge', 'cambridge.org', 'vibenoun', 'noun', 'verb', 'adj', 'adv', 'plural', 'singular', 'past tense', 'past participle', 'present participle', 'third person singular', 'comparative', 'superlative']
    for p in non_def:
        if p in en_text.lower():
            return False
    return True

def main(markdown_raw, word):
    md = str(markdown_raw or '').strip()
    if not md:
        return {"result_json": json.dumps({"error": "empty"}, ensure_ascii=False)}
    
    source = re.split(r'^## Examples of', md, flags=re.I)[0]
    
    # 提取音标
    uk_match = re.search(r'\buk\b([\s\S]*?)(?=^###\s)', source, re.M)
    pron_block = uk_match.group(1) if uk_match else ''
    pron_matches = re.findall(r'(\/[^\n\/]+\/)(?:us\b)?', pron_block)
    phonetic_uk = pron_matches[0] if len(pron_matches) > 0 else ''
    phonetic_us = pron_matches[1] if len(pron_matches) > 1 else ''
    
    # 提取sense块
    all_senses = []
    sense_starts = []
    for m in re.finditer(r'^###\s+', source, re.M):
        sense_starts.append(m.start())
    
    for idx, start in enumerate(sense_starts):
        end = sense_starts[idx+1] if idx+1 < len(sense_starts) else len(source)
        block = source[start:end]
        lines = block.split('\n')
        
        heading_raw = lines[0].strip()
        heading = clean_md(heading_raw)
        pos, label, headword = extract_pos_info(heading)
        
        level = ''
        lm = re.search(r'\b(A1|A2|B1|B2|C1|C2)\b', heading, re.I)
        if lm:
            level = lm.group(1)
        grammar = re.findall(r'\[(?:\s*)?([CU])(?:\s*)?\]', heading)
        
        content_lines = lines[1:]
        definition_en = ''
        definition_zh = ''
        examples = []
        register = ''
        
        for line in content_lines:
            lc = clean_md(line)
            if not lc:
                continue
            if re.match(r'^/(?:[^\n/]+)//(?:us|uk)?$', lc):
                continue
            if re.match(r'^(uk|us)\b', lc, re.I):
                continue
            if 'Add to word list' in lc:
                continue
            if lc.lower().startswith('your browser'):
                continue
            if lc.startswith('(') and 'Translation' in lc and lc.endswith(')'):
                continue
            
            rm = re.search(r'\b(formal|informal|literary|slang|old-fashioned|approving|disapproving)\b', lc, re.I)
            if rm and not register:
                register = rm.group(1).lower()
            
            if re.match(r'^[\u3400-\u9fff]+$', lc):
                definition_zh = lc
                continue
            
            en, zh = split_en_zh(lc)
            if en and re.search(r'[A-Za-z]', en):
                if is_valid_definition_line(en):
                    if not definition_en and len(en) > 5:
                        definition_en = en
                        definition_zh = zh or ''
                    elif len(examples) < 4 and len(en) > 15:
                        examples.append({'en': en, 'zh': zh or ''})
        
        if definition_en or definition_zh:
            all_senses.append({
                'headword': headword if headword else None,
                'part_of_speech': pos,
                'label': label,
                'level': level,
                'grammar': grammar,
                'register': register,
                'definition_en': definition_en,
                'translation_zh': definition_zh,
                'examples': examples
            })
    
    # 例句
    example_sentences = []
    seen = set()
    for line in source.split('\n'):
        lc = clean_md(line)
        en, zh = split_en_zh(lc)
        if en and en not in seen and re.search(r'[A-Za-z]{3,}', en) and len(en) > 15:
            if is_valid_definition_line(en):
                seen.add(en)
                example_sentences.append({'en': en, 'zh': zh or ''})
        if len(example_sentences) >= 6:
            break
    
    # idioms
    idioms = []
    idiom_section = re.search(r'###\s+\*\*?Idioms\*\*?([\s\S]*?)(?=^##|\Z)', source, re.I | re.S)
    if idiom_section:
        for il in re.findall(r'\[(.+?)\]\(https://[^)]+\)', idiom_section.group(1)):
            il_clean = clean_md(il)
            if il_clean and il_clean.lower() not in ('meaning', 'dictionary', 'cambridge'):
                idioms.append(il_clean)
    
    core_def = all_senses[0] if all_senses else {}
    result = {
        'headword': (word or '').strip(),
        'core_definition': core_def,
        'cambridge_details': {'phonetic_uk': phonetic_uk, 'phonetic_us': phonetic_us, 'senses': all_senses},
        'example_sentences': example_sentences[:6],
        'collocations_and_extensions': {'collocations': [], 'idioms': idioms}
    }
    return {'result_json': json.dumps(result, ensure_ascii=False)}

if __name__ == "__main__":
    test_md = """# Translation of **vibe** – English–Mandarin Chinese dictionary

vibe

noun

uk

Your browser doesn't support HTML5 audio

/vaɪb/us

Your browser doesn't support HTML5 audio

/vaɪb/

### vibenoun  (MOOD)

Add to word listAdd to word list

[\[ C \]](https://dictionary.cambridge.org/help/codes.html)informal

the [mood](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/mood "mood") of a [place](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/place "place"), [situation](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/situation "situation"), [person](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/person "person"), etc. and the way that they make you [feel](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/feel "feel")

（某地、某种局面或某支曲子的） [气氛](https://dictionary.cambridge.org/dictionary/chinese-simplified-english/)， [氛围](https://dictionary.cambridge.org/dictionary/chinese-simplified-english/)

The [city](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/city "city") is [famous](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/famous "famous") for [its](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/its "its") **[laid-back](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/laid-back "laid-back")** vibe.

I [loved](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/love "loved") the [overall](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/overall "overall") vibe **of** the [place](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/place "place") but the [food](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/food "food") wasn't that [great](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/great "great").

The [music](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/music "music") has a [soothing](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/soothing "soothing") vibe.这种音乐能让人放松。

I didn't like the place—it had [bad](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/bad "bad") vibes.我不喜欢那个地方——那里给人的感觉不好。

I was getting some [weird](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/weird "weird") vibes from him—I don't [think](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/think "think") he [liked](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/like "liked") me.

### vibenoun  (INSTRUMENT)

**vibes**[\[ plural \]](https://dictionary.cambridge.org/help/codes.html)

informal for[vibraphone](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/vibraphone "meaning of vibraphone"): a [musical](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/musical "musical") [instrument](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/instrument "instrument") consisting of a [frame](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/frame "frame") with a set of [metal](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/metal "metal") [bars](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/bar "bars") in it that you [hit](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/hit "hit"). The [bars](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/bar "bars") have [electrical](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/electrical "electrical") [devices](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/device "devices") [attached](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/attached "attached") to them that make them [vibrate](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/vibrate "vibrate")(= [shake](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/shake "shake")) so that they [produce](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/produce "produce") [musical](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/musical "musical") [notes](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/note "notes") that [seem](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/seem "seem") to [shake](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/shake "shake") [slightly](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/slightly "slightly").

[电颤琴](https://dictionary.cambridge.org/dictionary/chinese-simplified-english/)， [颤音琴](https://dictionary.cambridge.org/dictionary/chinese-simplified-english/)

He would often **[play](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/play "play")** the vibes in [their](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/their "their") [recording](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/recording "recording") [sessions](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/session "sessions").

She [plays](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/play "plays") vibes and [sings](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/sing "sings") on the [album](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/album "album").

I [think](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/think "think") the vibes are such a [cool](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/cool "cool") [instrument](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/instrument "instrument").

He [begins](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/begin "begins") every [day](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/day "day") by [tapping](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/tap "tapping") out a [tune](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/tune "tune") on the vibes.

His [orchestration](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/orchestration "orchestration") [included](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/included "included") [skilful](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/skilful "skilful") use of the vibes.

(Translation of **vibe** from the **Cambridge English-Chinese (Simplified) Dictionary**)

## Examples of vibe
"""
    result = main(test_md, "vibe")
    data = json.loads(result["result_json"])
    with open('dify_test_output.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("OK - output saved")
    # Print summary without unicode chars that cause GBK issues
    print(f"headword: {data['headword']}")
    print(f"senses count: {len(data['cambridge_details']['senses'])}")
    for i, s in enumerate(data['cambridge_details']['senses']):
        print(f"  sense[{i}]: pos={s['part_of_speech']}, label={s['label']}, def_en={s['definition_en'][:40] if s['definition_en'] else 'None'}..., examples={len(s['examples'])}")
    print(f"example_sentences: {len(data['example_sentences'])}")