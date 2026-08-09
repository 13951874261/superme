const Database = require('/var/www/super-agent/vocab-server/node_modules/better-sqlite3');
const db = new Database('/var/www/super-agent/vocab.db');

const words = db.prepare('SELECT * FROM vocabulary').all();
const parsedWords = words.map(w => {
  let payload = {};
  try {
    payload = w.payload ? JSON.parse(w.payload) : {};
  } catch (e) {}
  return { ...w, payload };
});

const getWordTranslation = (payload) => {
  if (typeof payload.translation_main === 'string' && payload.translation_main.trim()) return payload.translation_main;
  if (typeof payload.meaning === 'string' && payload.meaning.trim()) return payload.meaning;
  if (typeof payload.meaning_zh === 'string' && payload.meaning_zh.trim()) return payload.meaning_zh;
  if (typeof payload.translation === 'string' && payload.translation.trim()) return payload.translation;
  if (typeof payload.definition === 'string' && payload.definition.trim()) return payload.definition;
  if (Array.isArray(payload.definitions_en) && payload.definitions_en[0]) {
    return String(payload.definitions_en[0]);
  }
  if (typeof payload.explain === 'string' && payload.explain.trim()) return payload.explain;
  return '';
};

const getItemType = (w) => {
  const payload = w.payload || {};
  if (payload.is_sentence === true) return '句子 (Sentence)';
  if (payload.is_phrase === true) return '短语 (Phrase)';
  const text = (w.word || '').trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount > 4) return '句子 (Sentence)';
  if (wordCount > 1) return '短语 (Phrase)';
  return '单词 (Word)';
};

const normalizePayload = (w) => {
  const payload = { ...(w.payload || {}) };
  let pos = (payload.pos || '').trim();
  if (!pos) {
    pos = (payload.partOfSpeech || payload.part_of_speech || '').trim();
  }
  if (pos.includes('词性（如') || pos.includes('??') || pos.includes('待复习') || pos.includes('待处理')) {
    pos = '';
  }
  let phonetic = (payload.phonetic || '').trim();
  if (!phonetic) {
    phonetic = (payload.phonetic_symbol || payload.symbol || payload.pronunciation || '').trim();
  }
  if (phonetic.includes('音标') || phonetic.includes('??') || phonetic.includes('待复习') || phonetic.includes('待处理')) {
    phonetic = '';
  }
  let meaning = getWordTranslation(payload).trim();
  if (meaning.includes('英文释义') || meaning.includes('中文释义') || meaning.includes('待复习') || meaning.includes('待处理') || meaning.includes('简明扼要') || meaning.includes('直译') || meaning.includes('拼写对齐') || meaning.includes('特定画像')) {
    meaning = '';
  }
  const type = getItemType(w);
  if (type === '句子 (Sentence)') {
    if (!pos) pos = 'sentence';
    if (!phonetic) phonetic = '/';
  } else if (type === '短语 (Phrase)') {
    if (!pos) pos = 'phrase';
    if (!phonetic) phonetic = '/';
  }
  return { ...payload, pos, phonetic, meaning, translation_main: meaning };
};

const wordsToEnrich = [];
for (const w of parsedWords) {
  const normP = normalizePayload(w);
  const type = getItemType(w);
  const isTranslationBlank = !normP.meaning || !normP.meaning.trim();
  const isPosBlank = !normP.pos || !normP.pos.trim();
  const isPhoneticBlank = type === '单词 (Word)' && (!normP.phonetic || !normP.phonetic.trim());
  if (isTranslationBlank || isPosBlank || isPhoneticBlank) {
    wordsToEnrich.push({ ...w, payload: normP });
  }
}

console.log('Words to enrich:', wordsToEnrich.length);
let count = 0;
for (const w of wordsToEnrich) {
  try {
    const cachedLog = db.prepare('SELECT response_payload FROM dict_query_log WHERE word = ? AND is_success = 1 ORDER BY created_at DESC LIMIT 1').get(w.word.trim());
    if (cachedLog) {
      count++;
      if (count <= 5) {
        console.log(`Match success for "${w.word}"!`);
      }
    }
  } catch (e) {
    console.error(`Error querying for "${w.word}":`, e);
  }
}
console.log(`Total match successes: ${count}`);
