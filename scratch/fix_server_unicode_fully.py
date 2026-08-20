
filePath = r"vocab-server/server.js"
with open(filePath, "r", encoding="utf-8") as f_in:
    code = f_in.read()

start_pattern = "app.post('/api/vocab/export-background'"
start_idx = code.find(start_pattern)

if start_idx != -1:
    end_pattern = "res.status(500).json({ success: false, error:"
    end_search_idx = code.find(end_pattern, start_idx)
    if end_search_idx != -1:
        close_idx = code.find("});", end_search_idx)
        if close_idx != -1:
            end_idx = close_idx + 3
            print("Found target block to replace! Length:", end_idx - start_idx)
            
            replacement = r'''app.post('/api/vocab/export-background', async (req, res) => {
  try {
    const { scope = 'all', currentTab = 'business' } = req.body || {};
    const taskQueue = require('./services/taskQueue');
    let scopeLabel = '\u5168\u90e8\u8bcd\u6761';
    if (scope === 'current_tab') scopeLabel = `\u5f53\u524d\u5206\u533a (${currentTab})`;
    else if (scope === 'due_today') scopeLabel = '\u4eca\u65e5\u5f85\u590d\u4e60';
    else if (scope === 'words_only') scopeLabel = '\u4ec5\u5355\u8bcd';
    else if (scope === 'phrases_only') scopeLabel = '\u4ec5\u77ed\u8bed';
    else if (scope === 'sentences_only') scopeLabel = '\u4ec5\u53e5\u5b50';
    const taskName = `\u5bfc\u51fa\u8bcd\u6761: ${scopeLabel}`;
    const task = taskQueue.createTask('vocab_export', taskName);
    res.json({ success: true, taskId: task.id, status: task.status });
    setImmediate(async () => {
      try {
        taskQueue.updateTask(task.id, {
          status: 'running',
          progress: 5,
          logs: ['\u5f00\u59cb\u62c9\u53d6\u751f\u8bcd\u672c\u6570\u636e\u5e76\u51c6\u5907\u5bfc\u51fa...']
        });
        const words = db.prepare('SELECT * FROM vocabulary ORDER BY added_at DESC').all();
        const parsedWords = words.map(w => {
          let payload = {};
          try {
            payload = w.payload ? JSON.parse(w.payload) : {};
          } catch (e) {}
          return { ...w, payload };
        });
        const now = Date.now();
        const matchesVocabTab = (w, tab) => w.category === tab || (!w.category && tab === 'business');
        const isDueToday = (w, ts) => w.repetitions !== 999 && w.next_review_date <= ts;
        const getItemType = (w) => {
          const payload = w.payload || {};
          if (payload.is_sentence === true) return '\u53e5\u5b50 (Sentence)';
          if (payload.is_phrase === true) return '\u77ed\u8bed (Phrase)';
          const text = (w.word || '').trim();
          const wordCount = text.split(/\s+/).filter(Boolean).length;
          if (wordCount > 4) return '\u53e5\u5b50 (Sentence)';
          if (wordCount > 1) return '\u77ed\u8bed (Phrase)';
          return '\u5355\u8bcd (Word)';
        };
        let filtered = [];
        switch (scope) {
          case 'all':
            filtered = parsedWords;
            break;
          case 'current_tab':
            filtered = parsedWords.filter(w => matchesVocabTab(w, currentTab));
            break;
          case 'due_today':
            filtered = parsedWords.filter(w => isDueToday(w, now));
            break;
          case 'words_only':
            filtered = parsedWords.filter(w => getItemType(w) === '\u5355\u8bcd (Word)');
            break;
          case 'phrases_only':
            filtered = parsedWords.filter(w => getItemType(w) === '\u77ed\u8bed (Phrase)');
            break;
          case 'sentences_only':
            filtered = parsedWords.filter(w => getItemType(w) === '\u53e5\u5b50 (Sentence)');
            break;
          default:
            filtered = parsedWords;
        }
        taskQueue.updateTask(task.id, {
          progress: 10,
          logs: [`\u62c9\u53d6\u5b8c\u6210\uff0c\u5171\u8fc7\u6ee4\u51fa ${filtered.length} \u6761\u8bcd\u6761\u3002\u5f00\u59cb\u68c0\u6d4b\u5e76\u81ea\u52a8\u8865\u9f50\u7a7a\u767d\u5b57\u6bb5...`]
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
        const normalizePayload = (w) => {
          const payload = { ...(w.payload || {}) };
          let pos = (payload.pos || '').trim();
          if (!pos) {
            pos = (payload.partOfSpeech || payload.part_of_speech || '').trim();
          }
          if (pos.includes('\u8bcd\u6027\uff08\u5982') || pos.includes('??') || pos.includes('\u5f85\u590d\u4e60') || pos.includes('\u5f85\u5904\u7406')) {
            pos = '';
          }
          let phonetic = (payload.phonetic || '').trim();
          if (!phonetic) {
            phonetic = (payload.phonetic_symbol || payload.symbol || payload.pronunciation || '').trim();
          }
          if (phonetic.includes('\u97f3\u6807\uff1a') || phonetic.includes('??') || phonetic.includes('\u5f85\u590d\u4e60') || phonetic.includes('\u5f85\u5904\u7406')) {
            phonetic = '';
          }
          let meaning = getWordTranslation(payload).trim();
          if (meaning.includes('\u5f85\u590d\u4e60\u8865\u5145') || meaning.includes('\u7b80\u660e\u8f6d\u8981') || meaning.includes('\u5f85\u5904\u7406') || meaning.includes('\u82f1\u82f1\u8bcd\u5178')) {
            meaning = '';
          }
          const type = getItemType(w);
          if (type === '\u53e5\u5b50 (Sentence)') {
            if (!pos) pos = 'sentence';
            if (!phonetic) phonetic = '/';
          } else if (type === '\u77ed\u8bed (Phrase)') {
            if (!pos) pos = 'phrase';
            if (!phonetic) phonetic = '/';
          }
          return { ...payload, pos, phonetic, meaning, translation_main: meaning };
        };
        const wordsToEnrich = [];
        const normalizedList = [];
        for (const w of filtered) {
          const normP = normalizePayload(w);
          normalizedList.push({ ...w, payload: normP });
          const type = getItemType(w);
          const isTranslationBlank = !normP.meaning || !normP.meaning.trim();
          const isPosBlank = !normP.pos || !normP.pos.trim();
          const isPhoneticBlank = type === '\u5355\u8bcd (Word)' && (!normP.phonetic || !normP.phonetic.trim());
          if (isTranslationBlank || isPosBlank || isPhoneticBlank) {
            wordsToEnrich.push({ ...w, payload: normP });
          }
        }
        taskQueue.updateTask(task.id, {
          logs: [`\u68c0\u6d4b\u5230 ${wordsToEnrich.length} \u4e2a\u8bcd\u6761\u6709\u7a7a\u767d\u6216\u5360\u4f4d\u7a5f\u5217\uff0c\u6b63\u5728\u542f\u52a8\u672c\u5730\u7f13\u5b58\u67e5\u8be2\u4e0e\u5728\u7ebf Dify \u8865\u9f50...`]
        });
        let enrichedCount = 0;
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
              if (dictType === 'ai_phrase' || dictType === 'ai_sentence' || dictType === 'ai_extracted') {
                dictType = 'en_zh_bidirectional';
              }
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
              if (!parsedResult) {
                if (onlineQueryCount < maxOnlineQueries) {
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
                  source: '\u5bfc\u51fa\u540e\u53f0\u81ea\u52a8\u8865\u5168'
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
            logs: [`\u5df2\u5904\u7406 ${Math.min(wordsToEnrich.length, (i + 1) * concurrencyLimit)}/${wordsToEnrich.length} \u4e2a\u8bcd\u6761 (\u672c\u5730\u7f13\u5b58\u5339\u914d: ${cachedMatchCount}, \u5728\u7ebf\u67e5\u8be2\u6570: ${onlineQueryCount}/${maxOnlineQueries})...`]
          });
        }
        taskQueue.updateTask(task.id, {
          logs: [`\u5728\u7ebf\u8865\u9f50\u5904\u7406\u5b8c\u6210\uff0c\u6210\u529f\u8865\u9f50 ${enrichedCount} \u4e2a\u8bcd\u6761\u3002\u6b63\u5728\u5bf9\u6240\u6709\u5269\u4e59\u7a7a\u767d\u5217\u5e94\u7528\u672c\u5730\u515c\u5e95\u5e76\u751f\u6210 CSV...`]
        });
        const finalExportList = normalizedList.map(w => {
          const payload = { ...(w.payload || {}) };
          const type = getItemType(w);
          if (!payload.pos || !payload.pos.trim()) {
            if (type === '\u53e5\u5b50 (Sentence)') payload.pos = 'sentence';
            else if (type === '\u77ed\u8bed (Phrase)') payload.pos = 'phrase';
            else payload.pos = 'word';
          }
          if (!payload.phonetic || !payload.phonetic.trim()) {
            payload.phonetic = '/';
          }
          if (!payload.meaning || !payload.meaning.trim()) {
            payload.meaning = w.word;
            payload.translation_main = w.word;
          }
          return { ...w, payload };
        });
        const getExampleSentences = (w) => {
          const payload = w.payload || {};
          const sources = [
            payload.example_sentences,
            payload.scenarios,
            payload.business_examples,
            payload.examples,
            payload.example
          ];
          const examples = sources.find(s => Array.isArray(s) && s.length > 0) || [];
          if (!Array.isArray(examples)) return { en: '', zh: '' };
          const enList = [];
          const zhList = [];
          examples.forEach(ex => {
            if (typeof ex === 'string') {
              const en = ex.trim();
              if (!en || en.includes('\u4f8b\u53e51') || en.includes('\u4f8b\u53e52') || en.includes('\u4e2d\u6587\u7ffb\u8bd1') || en.includes('\u793a\u4f8b')) return;
              enList.push(en);
              zhList.push('');
              return;
            }
            if (typeof ex === 'object' && ex !== null) {
              const en = String(ex.en || ex.example_en || ex.sentence || ex.example || '').trim();
              const zh = String(ex.zh || ex.translation || ex.example_zh || '').trim();
              if (!en && !zh) return;
              if (en.includes('\u4f8b\u53e51') || en.includes('\u4f8b\u53e52') || zh.includes('\u4e2d\u6587\u7ffb\u8bd1') || en.includes('\u793a\u4f8b')) return;
              enList.push(en);
              zhList.push(zh);
            }
          });
          return { en: enList.join('\n'), zh: zhList.join('\n') };
        };
        const escapeCsvCell = (val) => {
          const str = String(val || '');
          if (/[",\n\r]/.test(str)) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        const headers = [
          'word',
          'type',
          'translation',
          'phonetic',
          'pos',
          'example_sentences_en',
          'example_sentences_zh',
          'repetitions',
          'next_review_date',
          'due_today'
        ];
        const rows = finalExportList.map(w => {
          const payload = w.payload || {};
          const examples = getExampleSentences(w);
          const cells = [
            w.word || '',
            getItemType(w),
            getWordTranslation(payload),
            payload.phonetic || '',
            payload.pos || '',
            examples.en,
            examples.zh,
            String(w.repetitions ?? ''),
            w.next_review_date ? new Date(w.next_review_date).toISOString() : '',
            (w.repetitions !== 999 && w.next_review_date <= now) ? 'yes' : 'no'
          ];
          return cells.map(c => escapeCsvCell(c)).join(',');
        });
        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const filename = `vocab-export-${scope}-${timestamp}.csv`;
        taskQueue.updateTask(task.id, {
          status: 'completed',
          progress: 100,
          logs: [`[\u6210\u529f] CSV \u5bfc\u51fa\u5c31\u7eea\uff01\u5171\u5bfc\u51fa ${finalExportList.length} \u6761\u8bcd\u6761\u3002`],
          result: {
            name: filename,
            content: csvContent,
            mimeType: 'text/csv;charset=utf-8;'
          }
        });
        console.log(`[Backend Export Worker] Successfully completed background export for task "${task.id}".`);
      } catch (err) {
        console.error('[Backend Export Worker] Background job crash:', err);
        taskQueue.updateTask(task.id, {
          status: 'failed',
          error: `\u540e\u53f0\u5bfc\u51fa\u53d1\u751f\u4e25\u91cd\u9519\u8bef: ${err.message}`
        });
      }
    });
  } catch (error) {
    console.error('[Export Background Error]:', error);
    res.status(500).json({ success: false, error: `\u540e\u53f0\u5bfc\u51fa\u53d1\u751f\u4e25\u91cd\u9519\u8bef: ${error.message}` });
  }
});'''
            
            new_code = code[:start_idx] + replacement + code[end_idx:]
            with open(filePath, "w", encoding="utf-8", newline="\n") as f_out:
                f_out.write(new_code)
            print("SUCCESS")
        else:
            print("close_idx not found")
    else:
        print("end_search_idx not found")
else:
    print("start_idx not found")
