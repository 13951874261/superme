filePath = "vocab-server/server.js"
with open(filePath, "r", encoding="utf-8") as f_in:
    code = f_in.read()

# 1. Replace maxOnlineQueries = 80
if "const maxOnlineQueries = 80;" in code:
    code = code.replace("const maxOnlineQueries = 80;", "const maxOnlineQueries = 1000;")
    print("maxOnlineQueries replaced")
else:
    print("maxOnlineQueries NOT found or already replaced")

# 2. Replace the isEnglishWord check
target_check = """              if (!parsedResult) {
                const wordText = w.word.trim();
                const type = getItemType(w);
                const isEnglishWord = type === '\\u5355\\u8bcd (Word)' &&
                                      !/[\\u4e00-\\u9fa5]/.test(wordText) &&
                                      !wordText.includes('{') &&
                                      !wordText.includes('[') &&
                                      !wordText.includes('"');
                if (isEnglishWord && onlineQueryCount < maxOnlineQueries) {
                  onlineQueryCount++;
                  parsedResult = await queryDifyDictOnBackend(w.word, dictType);
                }
              }"""

replacement_check = """              if (!parsedResult) {
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
              }"""

if target_check in code:
    code = code.replace(target_check, replacement_check)
    print("isEnglishWord check replaced (CRLF)")
elif target_check.replace("\r\n", "\n") in code:
    code = code.replace(target_check.replace("\r\n", "\n"), replacement_check.replace("\r\n", "\n"))
    print("isEnglishWord check replaced (LF)")
else:
    print("isEnglishWord check NOT found")

# 3. Replace the result assignment to handle type mapping
target_mapping = """              if (parsedResult && parsedResult.ok && parsedResult.payload) {
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
                let examplesList = [];"""

replacement_mapping = """              if (parsedResult && parsedResult.ok && parsedResult.payload) {
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
                let examplesList = [];"""

if target_mapping in code:
    code = code.replace(target_mapping, replacement_mapping)
    print("result mapping replaced (CRLF)")
elif target_mapping.replace("\r\n", "\n") in code:
    code = code.replace(target_mapping.replace("\r\n", "\n"), replacement_mapping.replace("\r\n", "\n"))
    print("result mapping replaced (LF)")
else:
    print("result mapping NOT found")

with open(filePath, "w", encoding="utf-8") as f_out:
    f_out.write(code)
print("done")
