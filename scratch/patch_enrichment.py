filePath = r"vocab-server/server.js"
with open(filePath, "r", encoding="utf-8") as f_in:
    code = f_in.read()

# Part 1: queryDifyDictOnBackend caching
target_part1 = """    let parsedResult;
    try {
      parsedResult = typeof resultStr === 'string' ? JSON.parse(resultStr.trim()) : resultStr;
    } catch (e) {
      let cleanStr = resultStr.trim();
      if (cleanStr.startsWith('```')) {
        const lines = cleanStr.split('\\n');
        if (lines[0].startsWith('```')) lines.shift();
        if (lines[lines.length - 1].startsWith('```')) lines.pop();
        cleanStr = lines.join('\\n').trim();
      }
      try {
        parsedResult = JSON.parse(cleanStr);
      } catch (inner) {
        return null;
      }
    }
    return parsedResult;"""

replacement_part1 = """    let parsedResult;
    try {
      parsedResult = typeof resultStr === 'string' ? JSON.parse(resultStr.trim()) : resultStr;
    } catch (e) {
      let cleanStr = resultStr.trim();
      if (cleanStr.startsWith('```')) {
        const lines = cleanStr.split('\\n');
        if (lines[0].startsWith('```')) lines.shift();
        if (lines[lines.length - 1].startsWith('```')) lines.pop();
        cleanStr = lines.join('\\n').trim();
      }
      try {
        parsedResult = JSON.parse(cleanStr);
      } catch (inner) {
        return null;
      }
    }
    try {
      db.prepare(`
        INSERT INTO dict_query_log (id, word, dict_type, direction, user_context, locale, is_success, response_payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(crypto.randomUUID(), word.trim(), cleanDictType, direction, '', 'zh-CN', JSON.stringify(parsedResult), Date.now());
    } catch (logErr) {
      console.error('[Backend Export Worker] Cache Write Error:', logErr.message);
    }
    return parsedResult;"""

# Part 2: maxOnlineQueries and query condition
target_part2 = """        let enrichedCount = 0;
        let cachedMatchCount = 0;
        let onlineQueryCount = 0;
        const maxOnlineQueries = 80;
        const concurrencyLimit = 8;
        const chunks = [];
        for (let i = 0; i < wordsToEnrich.length; i += concurrencyLimit) {
          chunks.push(wordsToEnrich.slice(i, i + concurrencyLimit));
        }
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          await Promise.all(chunk.map(async (w) => {
            try {
              let dictType = w.dict_type || 'en_zh_bidirectional';
              if (!['zh_modern', 'en_en_business', 'en_zh_bidirectional'].includes(dictType)) {
                dictType = 'en_zh_bidirectional';
              }
              let parsedResult = null;
              try {
                const cleanWord = w.word.trim();
                let cachedLog = db.prepare('SELECT response_payload FROM dict_query_log WHERE word = ? AND is_success = 1 ORDER BY created_at DESC LIMIT 1').get(cleanWord);
                if (!cachedLog) {
                  cachedLog = db.prepare('SELECT response_payload FROM dict_query_log WHERE word = ? AND is_success = 1 ORDER BY created_at DESC LIMIT 1').get(cleanWord.toLowerCase());
                }
                if (cachedLog) {
                  const logData = JSON.parse(cachedLog.response_payload);
                  if (logData && logData.ok && logData.payload) {
                    parsedResult = logData;
                    cachedMatchCount++;
                  }
                }
              } catch (e) {
                console.error('[Cache Query Error for ' + w.word + ']:', e);
              }
              if (!parsedResult) {
                const wordText = w.word.trim();
                const type = getItemType(w);
                const isEnglishWord = type === '\\u5355\\u8bcd (Word)' &&
                                      !/[\u4e00-\u9fa5]/.test(wordText) &&
                                      !wordText.includes('{') &&
                                      !wordText.includes('[') &&
                                      !wordText.includes('"');
                if (isEnglishWord && onlineQueryCount < maxOnlineQueries) {
                  onlineQueryCount++;
                  parsedResult = await queryDifyDictOnBackend(w.word, dictType);
                }
              }
              if (parsedResult && parsedResult.ok && parsedResult.payload) {
                const dp = parsedResult.payload;
                let meaning = dp.translation_main || '';
                if (!meaning && Array.isArray(dp.definitions_en)) {
                  meaning = dp.definitions_en.join('; ');
                }
                if (!meaning) {
                  meaning = dp.meaning || dp.definition || '';
                }
                let pos = dp.pos || dp.partOfSpeech || '';
                let phonetic = dp.phonetic || '';
                let examplesList = [];
                if (Array.isArray(dp.example_sentences)) examplesList = dp.example_sentences;
                else if (Array.isArray(dp.examples)) examplesList = dp.examples;
                const newPayload = {
                  ...w.payload,
                  word: w.word,
                  phonetic: phonetic.trim(),
                  pos: pos.trim(),
                  meaning: meaning.trim(),
                  translation_main: meaning.trim(),
                  example_sentences: examplesList,
                  source: '\\u5bfc\\u51fa\\u540e\\u53f0\\u81ea\\u52a8\\u8865\\u5168'
                };"""

replacement_part2 = """        let enrichedCount = 0;
        let cachedMatchCount = 0;
        let onlineQueryCount = 0;
        const maxOnlineQueries = 1000;
        const concurrencyLimit = 8;
        const chunks = [];
        for (let i = 0; i < wordsToEnrich.length; i += concurrencyLimit) {
          chunks.push(wordsToEnrich.slice(i, i + concurrencyLimit));
        }
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          await Promise.all(chunk.map(async (w) => {
            try {
              let dictType = w.dict_type || 'en_zh_bidirectional';
              if (!['zh_modern', 'en_en_business', 'en_zh_bidirectional'].includes(dictType)) {
                dictType = 'en_zh_bidirectional';
              }
              let parsedResult = null;
              try {
                const cleanWord = w.word.trim();
                let cachedLog = db.prepare('SELECT response_payload FROM dict_query_log WHERE word = ? AND is_success = 1 ORDER BY created_at DESC LIMIT 1').get(cleanWord);
                if (!cachedLog) {
                  cachedLog = db.prepare('SELECT response_payload FROM dict_query_log WHERE word = ? AND is_success = 1 ORDER BY created_at DESC LIMIT 1').get(cleanWord.toLowerCase());
                }
                if (cachedLog) {
                  const logData = JSON.parse(cachedLog.response_payload);
                  if (logData && logData.ok && logData.payload) {
                    parsedResult = logData;
                    cachedMatchCount++;
                  }
                }
              } catch (e) {
                console.error('[Cache Query Error for ' + w.word + ']:', e);
              }
              if (!parsedResult) {
                const wordText = w.word.trim();
                const type = getItemType(w);
                const isValidText = wordText.length > 0 &&
                                    !wordText.includes('{') &&
                                    !wordText.includes('[') &&
                                    !wordText.includes('"');
                if (isValidText && onlineQueryCount < maxOnlineQueries) {
                  onlineQueryCount++;
                  parsedResult = await queryDifyDictOnBackend(w.word, dictType);
                }
              }
              if (parsedResult && parsedResult.ok && parsedResult.payload) {
                const dp = parsedResult.payload;
                let meaning = dp.translation_main || '';
                if (!meaning && Array.isArray(dp.definitions_en)) {
                  meaning = dp.definitions_en.join('; ');
                }
                if (!meaning) {
                  meaning = dp.meaning || dp.definition || '';
                }
                let pos = dp.pos || dp.partOfSpeech || '';
                let phonetic = dp.phonetic || '';
                const type = getItemType(w);
                if (type === '\\u5355\\u8bcd (Word)') {
                  // Keep pos and phonetic as returned
                } else if (type === '\\u53e5\\u5b50 (Sentence)') {
                  if (!pos) pos = 'sentence';
                  if (!phonetic) phonetic = '/';
                } else if (type === '\\u77ed\\u8bed (Phrase)') {
                  if (!pos) pos = 'phrase';
                  if (!phonetic) phonetic = '/';
                }
                let examplesList = [];
                if (Array.isArray(dp.example_sentences)) examplesList = dp.example_sentences;
                else if (Array.isArray(dp.examples)) examplesList = dp.examples;
                const newPayload = {
                  ...w.payload,
                  word: w.word,
                  phonetic: phonetic.trim(),
                  pos: pos.trim(),
                  meaning: meaning.trim(),
                  translation_main: meaning.trim(),
                  example_sentences: examplesList,
                  source: '\\u5bfc\\u51fa\\u540e\\u53f0\\u81ea\\u52a8\\u8865\\u5168'
                };"""

# Perform replacement
p1_success = False
p2_success = False

if target_part1 in code:
    code = code.replace(target_part1, replacement_part1)
    p1_success = True
else:
    target_part1_lf = target_part1.replace("\r\n", "\n")
    if target_part1_lf in code:
        code = code.replace(target_part1_lf, replacement_part1.replace("\r\n", "\n"))
        p1_success = True

if target_part2 in code:
    code = code.replace(target_part2, replacement_part2)
    p2_success = True
else:
    target_part2_lf = target_part2.replace("\r\n", "\n")
    if target_part2_lf in code:
        code = code.replace(target_part2_lf, replacement_part2.replace("\r\n", "\n"))
        p2_success = True

if p1_success and p2_success:
    with open(filePath, "w", encoding="utf-8") as f_out:
        f_out.write(code)
    print("BOTH PARTS SUCCESSFULLY PATCHED")
else:
    print(f"FAILED: Part 1 Success: {p1_success}, Part 2 Success: {p2_success}")
