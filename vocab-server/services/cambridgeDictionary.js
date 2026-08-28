const { fetchUrlContent } = require('./webFetcher');

const CAMBRIDGE_BASE = 'https://dictionary.cambridge.org/dictionary/english-chinese-simplified';

function isSingleEnglishWord(value) {
  return /^[A-Za-z]+(?:[-'][A-Za-z]+)*$/.test(String(value || '').trim());
}

/**
 * Clean markdown: remove URLs but preserve labels like (MOOD), [C], [U]
 */
function cleanMarkdown(value) {
  let text = String(value || '');

  // Step 1: Remove [content](url) patterns - extract content only
  text = text.replace(/\[([^\[\]]*)\]\([^)]+\)/g, '$1');
  text = text.replace(/\[\[([^\[\]]*)\]\]\([^)]+\)/g, '[$1]');

  // Step 2: Remove ONLY URLs in parentheses, NOT labels like (MOOD) or (INSTRUMENT)
  text = text.replace(/\((https?:\/\/[^)]+)\)/g, '');

  // Step 3: Remove backslashes only (preserve brackets for grammar tags)
  text = text.replace(/\\/g, '');

  // Step 4: Clean up markdown artifacts
  return text
    .replace(/[*_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitEnglishChinese(value) {
  const text = cleanMarkdown(value);
  const index = text.search(/[\u3400-\u9fff]/);
  if (index < 0) return { en: text, zh: '' };
  return { en: text.slice(0, index).trim(), zh: text.slice(index).trim() };
}

function normalizeComparable(value) {
  return cleanMarkdown(String(value || '')).toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, '');
}

function unique(items, key = (item) => JSON.stringify(item)) {
  const seen = new Set();
  return items.filter((item) => {
    const id = key(item);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Full-line IPA, including syllable dots and /ipa/us glued suffixes. */
function isPhoneticLine(value) {
  return /^\/[^/\n]+\/(?:\s*(?:us|uk))?$/i.test(String(value || '').trim());
}

function extractCambridgeExamplesSection(markdown, word) {
  const text = String(markdown || '');
  const start = text.match(/^##\s+Examples of\b[^\n]*$/im);
  if (!start || start.index == null) return [];

  const afterHeading = text.slice(start.index + start[0].length);
  const nextSection = afterHeading.search(/^##\s+(?!Examples of\b)/im);
  const section = nextSection >= 0 ? afterHeading.slice(0, nextSection) : afterHeading;

  const normalizedWord = String(word || '').trim().toLowerCase();
  return unique(
    section
      .split('\n')
      .map(splitEnglishChinese)
      .filter(({ en }) => {
        const normalized = en.toLowerCase();
        return en
          && /[a-z]/i.test(en)
          && normalized !== normalizedWord
          && !/^from the cambridge english corpus$/i.test(en)
          && !/^these examples are from corpora and from sources on the web/i.test(en)
          && !/\bwikipedia\b/i.test(en)
          && !/^(a1|a2|b1|b2|c1|c2)$/i.test(en);
      }),
    ({ en }) => normalizeComparable(en)
  );
}

/**
 * Parse a single sense block
 * Handles both structured (### headings) and flat structures
 */
function parseSense(block, fallbackWord) {
  const rawLines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const heading = cleanMarkdown(rawLines.shift() || '');

  // Parse heading to extract POS and label
  // Handles: "vibenoun (MOOD)", "noun U", "vibe noun (MOOD)", "noun[[ U ]]"
  const posWords = ['phrasal verb', 'modal verb', 'adjective', 'adverb', 'noun', 'verb', 'pronoun', 'preposition', 'conjunction', 'exclamation', 'determiner'];
  let partOfSpeech = '';
  let label = '';
  let explicitHeadword = '';

  for (const p of posWords) {
    const pEscaped = p.replace(/\s/g, '\\\\s');

    // Pattern 1: word + POS + label (e.g., "vibe noun (MOOD)")
    const r1 = new RegExp(`^(.+?)\\s+${pEscaped}(?:\\s*\\[([^\\]]+)\\]|(?:\\s*\\(([^)]+)\\)))?$`, 'i');
    const m1 = heading.match(r1);
    if (m1 && m1[1]) {
      explicitHeadword = m1[1].trim();
      partOfSpeech = p.toLowerCase();
      label = m1[2] || m1[3] || '';
      break;
    }

    // Pattern 2: POS + label (e.g., "noun U", "noun C")
    const r2 = new RegExp(`^${pEscaped}(?:\\s*\\[([^\\]]+)\\]|(?:\\s*\\(([^)]+)\\)))?$`, 'i');
    const m2 = heading.match(r2);
    if (m2) {
      partOfSpeech = p.toLowerCase();
      label = m2[1] || m2[2] || '';
      break;
    }

    // Pattern 3: merged word+POS (e.g., "vibenoun (MOOD)")
    // Use negative lookahead to ensure we don't match words that already contain the POS
    const r3 = new RegExp(`^(.+?)${pEscaped}(?![a-z])(?:\\s*\\[([^\\]]+)\\]|(?:\\s*\\(([^)]+)\\)))?$`, 'i');
    const m3 = heading.match(r3);
    if (m3 && m3[1] && m3[1].length > 0) {
      explicitHeadword = m3[1].trim();
      partOfSpeech = p.toLowerCase();
      label = m3[2] || m3[3] || '';
      break;
    }
  }

  const lines = rawLines.map(cleanMarkdown)
    .map((line) => line.replace(/^(?:Add to word list)+/i, '').replace(/Add to word listAdd to word list/gi, '').trim())
    .filter(Boolean);

  // If partOfSpeech not found from heading, try to extract from body lines
  // This handles flat structures like "mud" where POS is in a body line
  if (!partOfSpeech) {
    // Check common POS first (noun, verb, adjective, adverb) before complex ones
    const posPriority = ['verb', 'noun', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'exclamation', 'determiner', 'modal verb', 'phrasal verb'];
    for (const p of posPriority) {
      const pEscaped = p.replace(/\s/g, '\\\\s');
      const posInBody = lines.find((line) => new RegExp(`^${pEscaped}(?:\\s*\\[.*)?$`, 'i').test(line));
      if (posInBody) {
        partOfSpeech = p.toLowerCase();
        // Also extract label if present
        const m = posInBody.match(new RegExp(`^${pEscaped}\\s*\\[([^\\]]+)\\]`, 'i'));
        if (m) {
          // Clean up label: remove any leading/trailing brackets, spaces
          label = m[1].trim().replace(/^\[+|\]+$/g, '').trim();
        }
        break;
      }
    }
  }

  // 版权行只影响 copyrightMatch 的提取，不再截断 lines —— 允许 ## Examples of 段落进入解析
  const inflectionLabel = '(?:plural|singular|past tense|past participle|present participle|third person singular|comparative|superlative)';
  
  // Extract grammar tags [C], [U], [plural], etc.
  const grammar = unique(lines.flatMap((line) => {
    const matches = Array.from(line.matchAll(new RegExp(`\\[\\s*([CU]|${inflectionLabel})\\s*\\]`, 'gi')), (m) => m[1]);
    return matches;
  }));

  // Extract register (formal, informal, etc.)
  const registerPattern = '(formal|informal|literary|slang|old-fashioned|approving|disapproving)';
  const registerLinePattern = new RegExp(`(?:^|[\\s\\[\\]])(${registerPattern})\\s*$`, 'i');
  const registerLine = lines.find((line) => {
    const match = line.match(registerLinePattern);
    return !!match;
  });
  const register = registerLine?.match(registerLinePattern)?.[1] || '';
  
  // Extract CEFR level
  const level = lines.find((line) => /^(A1|A2|B1|B2|C1|C2)$/i.test(line)) || '';

  // Build metadata set for skipping
  const metadataIndexes = new Set();
  lines.forEach((line, index) => {
    if (line === registerLine || /^(A1|A2|B1|B2|C1|C2)$/i.test(line) 
        || new RegExp(`\\[\\s*(?:[CU]|${inflectionLabel})\\s*\\]`, 'i').test(line)) {
      metadataIndexes.add(index);
    }
  });

  // Find definition lines - skip phonetics, audio messages, etc.
  const isNonDefinitionLine = (line) => {
    const l = line.toLowerCase();
    return /^(uk|us|add to word list|idioms?|noun|verb|adjective|adverb|pronoun|preposition|conjunction|exclamation|determiner|modal verb|phrasal verb)(?:\s*\/.+\/)?$/i.test(line)
      || isPhoneticLine(line)
      || l.startsWith('your browser')
      || l === 'add to word listadd to word list';
  };

  // Find definition index
  let definitionIndex = lines.findIndex((line, index) =>
    !metadataIndexes.has(index)
    && !/^Add to word list$/i.test(line)
    && !isNonDefinitionLine(line)
    && /[A-Za-z]/.test(line)
  );

  let definitionEn = '';
  let translationZh = '';

  if (definitionIndex >= 0) {
    const defLine = lines[definitionIndex];
    const zhMatch = defLine.match(/[\u3400-\u9fff]/);
    if (zhMatch && zhMatch.index > 0) {
      definitionEn = defLine.slice(0, zhMatch.index).trim();
      translationZh = defLine.slice(zhMatch.index).trim();
    } else {
      definitionEn = defLine;
      // Look for Chinese translation in subsequent lines
      const translationIndex = lines.findIndex((line, index) => 
        index > definitionIndex && /[\u3400-\u9fff]/.test(line)
      );
      if (translationIndex >= 0) {
        translationZh = lines[translationIndex];
      }
    }
  }

  // Extract examples after both the English definition and its Chinese gloss
  let exampleStart = definitionIndex >= 0 ? definitionIndex + 1 : 0;
  if (translationZh) {
    const zhIndex = lines.findIndex((line, index) => index >= exampleStart && line === translationZh);
    if (zhIndex >= 0) exampleStart = zhIndex + 1;
  }
  const definitionKey = normalizeComparable(definitionEn);
  const isNonExampleLine = (line) => {
    // Stop at Idioms section or next major section
    if (/^###\s*\*?\s*idioms\s*\*?$/i.test(line)) return true;
    if (/^##\s+Examples/i.test(line)) return true;
    if (/^##/.test(line)) return true;
    if (/^###/.test(line)) return true;
    // Skip metadata lines
    if (/^(uk|us)$/i.test(line)) return true;
    if (/^your browser doesn't support html5 audio$/i.test(line)) return true;
    if (isPhoneticLine(line)) return true;
    if (/^(A1|A2|B1|B2|C1|C2)$/.test(line)) return true; // CEFR levels
    // Skip comma-separated CEFR levels like "B2,C1,C2,B2"
    if (/^[A-Z]\d?(?:\s*,\s*[A-Z]\d?)+$/.test(line)) return true;
    // Skip grammar tags like "C[ T ]", "C[U]", "T, I"
    if (/^\[?\s*[CTUI]\s*(?:,\s*[A-Z]+)*\s*\]?\s*$/i.test(line)) return true;
    if (/^(verb|noun|adjective|adverb|preposition|conjunction|interjection)$/i.test(line)) return true; // POS
    if (/^(Add to word list|To top)$/i.test(line)) return true;
    // Skip lines that are just links or navigation
    if (/^\[Share on|^exit$|^Browse|^New Words|^Word of the Day/i.test(line)) return true;
    // Skip section headers like "Synonym", "Opposites", "Compare"
    if (/^(Synonym|Opposites|Compare|Idioms?|Related word|Phrasal verb|See more)$/i.test(line)) return true;
    // Skip single words (likely synonyms/antonyms in lists)
    if (/^[a-z]+$/i.test(line) && line.length < 15) return true;
    // Skip lines starting with "- " (related examples from other sections)
    if (/^- /.test(line)) return true;
    return false;
  };

  // Extract examples - include both inline examples and ## Examples section
  const examples = [];
  let stopCollecting = false;
  let inExamplesSection = false;
  for (const line of lines.slice(exampleStart)) {
    // Stop at Idioms. After cleanMarkdown, "### **Idioms**" becomes "Idioms".
    if (/^###\s*\*?\s*idioms\s*\*?$/i.test(line) || /^idioms?$/i.test(line)) { stopCollecting = true; break; }
    // Handle ## sections
    if (/^##/.test(line)) {
      if (/^##\s+Examples/i.test(line)) { inExamplesSection = true; continue; }
      stopCollecting = true;
      continue;
    }
    // Stop at ### sections (except inside ## Examples where we already handled)
    if (/^###/.test(line)) { stopCollecting = true; continue; }
    if (stopCollecting) continue;
    // Stop at Synonym/Opposites/Compare headers (inline section markers)
    if (/^(Synonym|Opposites|Compare|Idioms?)$/i.test(line)) { stopCollecting = true; break; }
    // Skip metadata lines
    if (/^(uk|us)$/i.test(line)) continue;
    if (/^your browser doesn't support html5 audio$/i.test(line)) continue;
    if (isPhoneticLine(line)) continue;
    if (definitionKey && normalizeComparable(line) === definitionKey) continue;
    if (translationZh && line === translationZh) continue;
    if (/^(A1|A2|B1|B2|C1|C2)$/.test(line)) continue; // CEFR levels
    // Skip comma-separated CEFR levels like "B2,C1,C2,B2"
    if (/^[A-Z]\d?(?:\s*,\s*[A-Z]\d?)+$/.test(line)) continue;
    // Skip grammar tags like "C[ T ]", "C[U]", "T, I"
    if (/^\[?\s*[CTUI]\s*(?:,\s*[A-Z]+)*\s*\]?\s*$/i.test(line)) continue;
    if (/^(verb|noun|adjective|adverb|preposition|conjunction|interjection)$/i.test(line)) continue; // POS
    if (/^(Add to word list|To top)$/i.test(line)) continue;
    // Skip lines that are just links or navigation
    if (/^\[Share on|^exit$|^Browse|^New Words|^Word of the Day/i.test(line)) continue;
    // Skip section headers like "Synonym", "Opposites", "Compare"
    if (/^(Synonym|Opposites|Compare|Idioms?|Related word|Phrasal verb|See more)$/i.test(line)) continue;
    // Skip single words (likely synonyms/antonyms in lists)
    if (/^[a-z]+$/i.test(line) && line.length < 15) continue;
    // Skip lines starting with "- " (related examples from other sections)
    if (/^- /.test(line)) continue;
    // Skip corpus attribution lines
    if (/^From the Cambridge English Corpus$/i.test(line)) continue;
    // Skip copyright/translation notices
    if (/^\(Translation of\b/i.test(line)) continue;
    if (!/[A-Za-z]/.test(line)) continue;
    const item = splitEnglishChinese(line);
    if (item.en) examples.push(item);
  }

  // Extract inflected headwords
  const inflectedHeadword = lines.find((line) => new RegExp(`\\[\\s*${inflectionLabel}\\s*\\]`, 'i').test(line))
    ?.replace(/\[.*$/, '').trim()
    || lines.find((line) => new RegExp(`\\b${inflectionLabel}\\b`, 'i').test(line))
    ?.replace(new RegExp(`\\s*${inflectionLabel}\\s*$`, 'i'), '').trim();

  return {
    headword: inflectedHeadword || explicitHeadword || fallbackWord,
    part_of_speech: partOfSpeech,
    label,
    level,
    grammar,
    register,
    definition_en: definitionEn,
    translation_zh: translationZh,
    examples,
  };
}

/**
 * Parse Cambridge markdown into structured data
 * Handles both structured (### headings) and flat structures
 */
function parseCambridgeMarkdown(markdown, { word, sourceUrl } = {}) {
  // Remove everything after Examples section
  const sourceText = String(markdown || '').split(/^## Examples of\b/im)[0];
  
  // Find all ### headings
  const headingPattern = /^###\s+(.+)$/gm;
  const allMatches = Array.from(sourceText.matchAll(headingPattern));

  // Filter to only POS-type headings - exclude "Idioms", "See more results", etc.
  const posHeadingPattern = /(?:noun|verb|adjective|adverb|pronoun|preposition|conjunction|exclamation|determiner|modal verb|phrasal verb)/i;
  const matches = allMatches.filter(m => posHeadingPattern.test(m[1]));

  let senses = [];

  if (matches.length > 0) {
    // Format 1: structured with ### POS headings (e.g., vibe)
    senses = matches.map((match, index) => {
      const end = matches[index + 1]?.index ?? sourceText.length;
      return parseSense(`${match[1]}\n${sourceText.slice(match.index + match[0].length, end)}`, word);
    }).filter((sense) => sense.definition_en || sense.translation_zh);
  } else {
    // Format 2: flat structure without ### headings (e.g., mud)
    // Look for POS line pattern like "noun[[ U ]](url)"
    // Match a part-of-speech only when it begins its own Markdown line.
    // Without the anchor, words such as "pronoun" in unrelated page content
    // can be mistaken for the entry's part of speech.
    const posLinePattern = /^\s*(noun|verb|adjective|adverb|pronoun|preposition|conjunction|exclamation|determiner|modal verb|phrasal verb)\b/im;
    const posLineMatch = sourceText.match(posLinePattern);
    
    if (posLineMatch) {
      const posStart = posLineMatch.index;
      const beforePos = sourceText.slice(0, posStart).trim();
      
      // Extract headword from before POS line
      const headwordMatch = beforePos.match(/([A-Za-z]+(?:['''][A-Za-z]+)*)\s*$/i);
      const extractedHeadword = headwordMatch?.[1] || word;

      const senseBlock = sourceText.slice(posStart);
      senses = [parseSense(`${extractedHeadword}\n${senseBlock}`, word)]
        .filter((sense) => sense.definition_en || sense.translation_zh);
    }
  }

  if (!senses.length) throw new Error('Cambridge page contained no parseable senses');

  // The corpus examples live after the main dictionary entry. Attach them to
  // the primary sense while excluding the source-attribution/disclaimer lines.
  const corpusExamples = extractCambridgeExamplesSection(markdown, word);
  if (corpusExamples.length) {
    senses[0].examples = unique(
      [...(senses[0].examples || []), ...corpusExamples],
      ({ en }) => normalizeComparable(en)
    );
  }

  // Extract phonetics
  const phonetics = {};
  const pronunciationBlock = sourceText.match(/\buk\b([\s\S]*?)(?=^###\s+)/im)?.[1] || '';
  const pronunciationMatches = Array.from(pronunciationBlock.matchAll(/(\/[^/\n]+\/)(?:us\b)?/gi), (match) => match[1]);
  if (pronunciationMatches[0]) phonetics.uk = pronunciationMatches[0];
  if (pronunciationMatches[1]) phonetics.us = pronunciationMatches[1];
  
  // Extract audio URLs
  const audio = unique(Array.from(sourceText.matchAll(/\((https?:\/\/[^)]+\.mp3(?:\?[^)]*)?)\)/gi), (match) => match[1]));
  
  // Extract copyright
  const copyrightMatch = sourceText.match(/\(Translation of[\s\S]*?from the ([^)]+?)\s+(©\s*Cambridge University Press)\)/i);
  
  // Extract idioms from the ### **Idioms** section
  const idioms = [];
  const idiomsSection = sourceText.match(/###\s+\*\*?Idioms\*\*?([\s\S]*)/im);
  if (idiomsSection && idiomsSection[1]) {
    const idiomMatches = Array.from(idiomsSection[1].matchAll(/\[(.+?)\]\(https:\/\/[^)]+\)/g), (m) => cleanMarkdown(m[1]));
    idioms.push(...idiomMatches.filter(i =>
      i &&
      !i.toLowerCase().includes('meaning') &&
      !i.toLowerCase().includes('dictionary') &&
      !i.toLowerCase().includes('cambridge')
    ));
  }

  const idiomKeys = new Set(idioms.map((item) => normalizeComparable(item)));
  if (idiomKeys.size) {
    for (const sense of senses) {
      sense.examples = (sense.examples || []).filter((item) => !idiomKeys.has(normalizeComparable(item.en)));
    }
  }

  // Extract collocations from ## Collocations section
  const collocationsSection = sourceText.match(/##\s+Collocations([\s\S]*?)(?=^##|\Z)/im);
  const collocations = collocationsSection ? unique(
    Array.from(collocationsSection[1].matchAll(/^- (.+)$/gm), (m) => cleanMarkdown(m[1].trim()))
    .filter(Boolean)
  ) : [];

  // Extract inflections
  const inflections = unique(
    senses.map((sense) => sense.headword)
      .filter((headword) => headword && headword.toLowerCase() !== String(word || '').toLowerCase())
  );

  return {
    headword: String(word || senses[0].headword || '').trim(),
    raw_markdown: String(markdown || ''),
    phonetic: phonetics.uk || phonetics.us || '',
    phonetics,
    pos: unique(senses.map((sense) => sense.part_of_speech).filter(Boolean)).join(' / '),
    level: unique(senses.map((sense) => sense.level).filter(Boolean)).join(' / '),
    senses,
    definitions_en: senses.map((sense) => sense.definition_en).filter(Boolean),
    translation_main: senses[0].translation_zh,
    meaning_zh: senses[0].translation_zh,
    other_meanings: unique(
      senses.slice(1).map((sense) => ({
        meaning: sense.translation_zh,
        context: [sense.label, sense.definition_en].filter(Boolean).join(' · ')
      })),
      (item) => normalizeComparable(`${item.meaning}\0${item.context}`)
    ),
    example_sentences: unique(
      senses.flatMap((sense) => sense.examples),
      (item) => normalizeComparable(`${item.en}\0${item.zh}`)
    ),
    idioms,
    collocations,
    inflections,
    audio,
    source: copyrightMatch?.[1]?.trim() || 'Cambridge English-Chinese (Simplified) Dictionary',
    source_url: sourceUrl || `${CAMBRIDGE_BASE}/${encodeURIComponent(String(word || '').toLowerCase())}`,
    copyright: copyrightMatch?.[2] || '© Cambridge University Press',
  };
}

function mergeCambridgeWithDify(cambridge, dify = {}) {
  const cambridgeValues = Object.fromEntries(
    Object.entries(cambridge).filter(([, value]) => (
      value !== '' && value != null && (!Array.isArray(value) || value.length > 0)
    ))
  );
  const cambridgeMeanings = new Set([
    normalizeComparable(cambridge.translation_main),
    normalizeComparable(cambridge.meaning_zh),
    ...(cambridge.senses || []).map((s) => normalizeComparable(s.translation_zh)),
    ...(cambridge.other_meanings || []).map((m) => normalizeComparable(m.meaning)),
  ].filter(Boolean));

  const filteredDifyOtherMeanings = (Array.isArray(dify.other_meanings) ? dify.other_meanings : []).filter((item) => {
    const norm = normalizeComparable(item.meaning || item.meaning_zh || item.meaning_en);
    return norm && !cambridgeMeanings.has(norm);
  });

  const merged = {
    ...dify,
    ...cambridgeValues,
    direction_resolved: dify.direction_resolved || 'en_to_zh',
    // 仅展示 Cambridge 例句，不使用 Dify 补充例句
    example_sentences: cambridge.example_sentences || [],
    other_meanings: unique(
      [...(cambridge.other_meanings || []), ...filteredDifyOtherMeanings],
      (item) => normalizeComparable(item.meaning || item.meaning_zh || item.meaning_en)
    ),
    collocations: unique(
      [...(cambridge.collocations || []), ...(Array.isArray(dify.collocations) ? dify.collocations : [])],
      (item) => normalizeComparable(item)
    ),
    idioms: cambridge.idioms || [],
    cambridge_raw: cambridge,
    dify_raw: dify,
    field_sources: {},
  };
  for (const key of Object.keys(merged)) {
    if (['cambridge_raw', 'dify_raw', 'field_sources'].includes(key)) continue;
    merged.field_sources[key] = Object.prototype.hasOwnProperty.call(cambridgeValues, key) ? 'cambridge' : 'dify';
  }
  return merged;
}

async function fetchCambridgeEntry(word) {
  if (!isSingleEnglishWord(word)) throw new Error('Cambridge lookup requires one English word');
  const sourceUrl = `${CAMBRIDGE_BASE}/${encodeURIComponent(String(word).toLowerCase())}`;
  const result = await fetchUrlContent(sourceUrl);
  return parseCambridgeMarkdown(result.markdown, { word, sourceUrl });
}

module.exports = { isSingleEnglishWord, parseCambridgeMarkdown, mergeCambridgeWithDify, fetchCambridgeEntry };
