
filePath = r"vocab-server/server.js"
with open(filePath, "r", encoding="utf-8") as f_in:
    code = f_in.read()

# Locate wordsToEnrich loop and dify query block
target_block = """        const wordsToEnrich = [];
        const normalizedList = [];
        for (const w of filtered) {
          const normP = normalizePayload(w);
          normalizedList.push({ ...w, payload: normP });
          const type = getItemType(w);
          const isTranslationBlank = !normP.meaning || !normP.meaning.trim();
          const isPosBlank = !normP.pos || !normP.pos.trim();
          const isPhoneticBlank = type === '?? (Word)' && (!normP.phonetic || !normP.phonetic.trim());
          if (isTranslationBlank || isPosBlank || isPhoneticBlank) {
            wordsToEnrich.push({ ...w, payload: normP });
          }
        }
        taskQueue.updateTask(task.id, {
          logs: [`??? ${wordsToEnrich.length} ?????????????????? Dify ??...`]
        });
        const concurrencyLimit = 5;
        let enrichedCount = 0;
        for (let i = 0; i < wordsToEnrich.length; i += concurrencyLimit) {
          const chunk = wordsToEnrich.slice(i, i + concurrencyLimit);
          await Promise.all(chunk.map(async (w) => {
            try {
              let dictType = w.dict_type || 'en_zh_bidirectional';
              if (dictType === 'ai_phrase' || dictType === 'ai_sentence' || dictType === 'ai_extracted') {
                dictType = 'en_zh_bidirectional';
              }
              const res = await queryDifyDictOnBackend(w.word, dictType);
              if (res && res.ok && res.payload) {
                const dp = res.payload;
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
                  source: '????????'
                };
                delete newPayload.definition;
                db.prepare('UPDATE vocabulary SET payload = ? WHERE id = ?').run(JSON.stringify(newPayload), w.id);
                const idx = normalizedList.findIndex(n => n.id === w.id);
                if (idx !== -1) {
                  normalizedList[idx].payload = normalizePayload({ ...w, payload: newPayload });
                }
                enrichedCount++;
              }
            } catch (err) {
              console.error(`[Backend Export Worker] Error enriching "${w.word}":`, err.message);
            }
          }));
          const progressPercent = Math.min(90, Math.round((i / wordsToEnrich.length) * 80) + 10);
          taskQueue.updateTask(task.id, {
            progress: progressPercent,
            logs: [`??? ${Math.min(wordsToEnrich.length, i + concurrencyLimit)}/${wordsToEnrich.length} ??????????...`]
          });
        }"""

replacement_block = """        const wordsToEnrich = [];
        const normalizedList = [];
        for (const w of filtered) {
          const normP = normalizePayload(w);
          normalizedList.push({ ...w, payload: normP });
          const type = getItemType(w);
          const isTranslationBlank = !normP.meaning || !normP.meaning.trim();
          const isPosBlank = !normP.pos || !normP.pos.trim();
          const isPhoneticBlank = type === '?? (Word)' && (!normP.phonetic || !normP.phonetic.trim());
          if (isTranslationBlank || isPosBlank || isPhoneticBlank) {
            wordsToEnrich.push({ ...w, payload: normP });
          }
        }

        taskQueue.updateTask(task.id, {
          logs: [`??? ${wordsToEnrich.length} ????????????????????????? Dify ??...`]
        });

        // ?????????
        let enrichedCount = 0;
        let cachedMatchCount = 0;
        let onlineQueryCount = 0;
        const maxOnlineQueries = 80; // ???????????? 80 ? Dify ??????????

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
              if (dictType === 'ai_phrase' || dictType === 'ai_sentence' || dictType === 'ai_extracted') {
                dictType = 'en_zh_bidirectional';
              }

              // 1. ????????? dict_query_log ????
              let parsedResult = null;
              try {
                const cachedLog = db.prepare('SELECT response_payload FROM dict_query_log WHERE word = ? AND is_success = 1 ORDER BY created_at DESC LIMIT 1').get(w.word.trim());
                if (cachedLog) {
                  const logData = JSON.parse(cachedLog.response_payload);
                  if (logData && logData.ok && logData.payload) {
                    parsedResult = logData;
                    cachedMatchCount++;
                  }
                }
              } catch (e) {}

              // 2. ???????????????????? Dify
              if (!parsedResult) {
                if (onlineQueryCount < maxOnlineQueries) {
                  onlineQueryCount++;
                  parsedResult = await queryDifyDictOnBackend(w.word, dictType);
                }
              }

              // 3. ???????????????
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
                  source: '????????'
                };
                delete newPayload.definition;
                db.prepare('UPDATE vocabulary SET payload = ? WHERE id = ?').run(JSON.stringify(newPayload), w.id);

                const idx = normalizedList.findIndex(n => n.id === w.id);
                if (idx !== -1) {
                  normalizedList[idx].payload = normalizePayload({ ...w, payload: newPayload });
                }
                enrichedCount++;
              }
            } catch (err) {
              console.error(`[Backend Export Worker] Error enriching "${w.word}":`, err.message);
            }
          }));

          const progressPercent = Math.min(90, Math.round(((i * concurrencyLimit) / wordsToEnrich.length) * 80) + 10);
          taskQueue.updateTask(task.id, {
            progress: progressPercent,
            logs: [`??? ${Math.min(wordsToEnrich.length, (i + 1) * concurrencyLimit)}/${wordsToEnrich.length} ??? (??????: ${cachedMatchCount}, ?????: ${onlineQueryCount}/${maxOnlineQueries})...`]
          });
        }"""

if target_block in code:
    code = code.replace(target_block, replacement_block)
    with open(filePath, "w", encoding="utf-8") as f_out:
        f_out.write(code)
    print("SUCCESS")
else:
    # try replacing Unix newline if needed
    target_block_lf = target_block.replace("\r\n", "\n")
    if target_block_lf in code:
        code = code.replace(target_block_lf, replacement_block)
        with open(filePath, "w", encoding="utf-8") as f_out:
            f_out.write(code)
        print("SUCCESS LF")
    else:
        print("TARGET BLOCK NOT FOUND")
