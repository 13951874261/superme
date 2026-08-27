const { fetchUrlContent } = require('./webFetcher');

const CAMBRIDGE_BASE = 'https://dictionary.cambridge.org/dictionary/english-chinese-simplified';

function isSingleEnglishWord(value) {
  return /^[A-Za-z]+(?:['’-][A-Za-z]+)*$/.test(String(value || '').trim());
}

function cleanMarkdown(value) {
  return String(value || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#]/g, '')
    .replace(/\\([\[\]])/g, '$1')
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

function parseSense(block, fallbackWord) {
  const rawLines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const heading = cleanMarkdown(rawLines.shift() || '');
  const headingMatch = heading.match(/^(.+?)(noun|verb|adjective|adverb|pronoun|preposition|conjunction|exclamation|determiner|modal verb|phrasal verb)\s*(?:\(([^)]+)\))?$/i);
  const partOfSpeech = headingMatch?.[2]?.toLowerCase() || '';
  const label = headingMatch?.[3]?.trim() || '';
  const lines = rawLines.map(cleanMarkdown)
    .map((line) => line.replace(/^(?:Add to word list)+/i, '').trim())
    .filter(Boolean);
  const contentEnd = lines.findIndex((line) => /^\(?Translation of\b|^To top$|^See more results/i.test(line));
  if (contentEnd >= 0) lines.splice(contentEnd);
  const inflectionLabel = '(?:plural|singular|past tense|past participle|present participle|third person singular|comparative|superlative)';
  const grammar = unique(lines.flatMap((line) => Array.from(line.matchAll(new RegExp(`\\[\\s*([CU]|${inflectionLabel})\\s*\\]`, 'gi')), (match) => match[1])));
  const registerPattern = '(formal|informal|literary|slang|old-fashioned|approving|disapproving)';
  const registerLinePattern = new RegExp(`${registerPattern}$`, 'i');
  const registerLine = lines.find((line) => {
    const match = line.match(registerLinePattern);
    return !!match && (match.index === 0 || line.slice(0, match.index).includes(']'));
  });
  const register = registerLine?.match(registerLinePattern)?.[1] || '';
  const level = lines.find((line) => /^(A1|A2|B1|B2|C1|C2)$/i.test(line)) || '';
  const metadataIndexes = new Set();
  lines.forEach((line, index) => {
    if (line === registerLine || /^(A1|A2|B1|B2|C1|C2)$/i.test(line) || new RegExp(`\\[\\s*(?:[CU]|${inflectionLabel})\\s*\\]`, 'i').test(line)) metadataIndexes.add(index);
  });
  const definitionIndex = lines.findIndex((line, index) => !metadataIndexes.has(index) && !/^Add to word list$/i.test(line) && !/[\u3400-\u9fff]/.test(line) && /[A-Za-z]/.test(line));
  const definitionEn = definitionIndex >= 0 ? lines[definitionIndex] : '';
  const translationIndex = lines.findIndex((line, index) => index > definitionIndex && /[\u3400-\u9fff]/.test(line));
  const translationZh = translationIndex >= 0 ? lines[translationIndex] : '';
  const exampleStart = translationIndex >= 0 ? translationIndex + 1 : definitionIndex + 1;
  const examples = lines.slice(exampleStart)
    .filter((line) => !/^Add to word list|^To top$/i.test(line))
    .map(splitEnglishChinese)
    .filter((item) => item.en);
  const explicitHeadword = headingMatch?.[1]?.trim().replace(new RegExp(`${partOfSpeech}$`, 'i'), '').trim();
  const inflectedHeadword = lines.find((line) => new RegExp(`\\[\\s*${inflectionLabel}\\s*\\]`, 'i').test(line))?.replace(/\[.*$/, '').trim();

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

function parseCambridgeMarkdown(markdown, { word, sourceUrl } = {}) {
  const sourceText = String(markdown || '').split(/^## Examples of\b/im)[0];
  const headingPattern = /^###\s+(.+)$/gm;
  const matches = Array.from(sourceText.matchAll(headingPattern));
  const senses = matches.map((match, index) => {
    const end = matches[index + 1]?.index ?? sourceText.length;
    return parseSense(`${match[1]}\n${sourceText.slice(match.index + match[0].length, end)}`, word);
  }).filter((sense) => sense.definition_en || sense.translation_zh);
  if (!senses.length) throw new Error('Cambridge page contained no parseable senses');

  const phonetics = {};
  const pronunciationBlock = sourceText.match(/\buk\b([\s\S]*?)(?=^###\s+)/im)?.[1] || '';
  const pronunciationMatches = Array.from(pronunciationBlock.matchAll(/(\/[^/\n]+\/)(?:us\b)?/gi), (match) => match[1]);
  if (pronunciationMatches[0]) phonetics.uk = pronunciationMatches[0];
  if (pronunciationMatches[1]) phonetics.us = pronunciationMatches[1];
  const audio = unique(Array.from(sourceText.matchAll(/\((https?:\/\/[^)]+\.mp3(?:\?[^)]*)?)\)/gi), (match) => match[1]));
  const copyrightMatch = sourceText.match(/\(Translation of[\s\S]*?from the ([^)]+?)\s+(©\s*Cambridge University Press)\)/i);
  const collocations = unique(Array.from(sourceText.matchAll(/\b(?:collocation|phrase)\b[^\n]*\n+([^\n]+)/gi), (match) => cleanMarkdown(match[1])).map((match) => cleanMarkdown(match[1])).filter(Boolean));
  const inflections = unique(senses.map((sense) => sense.headword).filter((headword) => headword && headword.toLowerCase() !== String(word || '').toLowerCase()));

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
    other_meanings: unique(senses.slice(1).map((sense) => ({ meaning: sense.translation_zh, context: [sense.label, sense.definition_en].filter(Boolean).join(' · ') })), (item) => normalizeComparable(`${item.meaning}\0${item.context}`)),
    example_sentences: unique(senses.flatMap((sense) => sense.examples), (item) => normalizeComparable(`${item.en}\0${item.zh}`)),
    collocations,
    inflections,
    audio,
    source: copyrightMatch?.[1]?.trim() || 'Cambridge English-Chinese (Simplified) Dictionary',
    source_url: sourceUrl || `${CAMBRIDGE_BASE}/${encodeURIComponent(String(word || '').toLowerCase())}`,
    copyright: copyrightMatch?.[2] || '© Cambridge University Press',
  };
}

function mergeCambridgeWithDify(cambridge, dify = {}) {
  const difyExamples = Array.isArray(dify.example_sentences) ? dify.example_sentences.map((item) => typeof item === 'string' ? { en: item, zh: '' } : item) : [];
  const cambridgeValues = Object.fromEntries(Object.entries(cambridge).filter(([, value]) => (
    value !== '' && value != null && (!Array.isArray(value) || value.length > 0)
  )));
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
    example_sentences: unique([...(cambridge.example_sentences || []), ...difyExamples], (item) => normalizeComparable(item.en || `${item.en}\0${item.zh}`)),
    other_meanings: unique([...(cambridge.other_meanings || []), ...filteredDifyOtherMeanings], (item) => normalizeComparable(item.meaning || item.meaning_zh || item.meaning_en)),
    collocations: unique([...(cambridge.collocations || []), ...(Array.isArray(dify.collocations) ? dify.collocations : [])], (item) => normalizeComparable(item)),
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
