import json
import sqlite3

db = sqlite3.connect("/var/www/super-agent/vocab.db")
rows = db.execute(
    "SELECT id, word, category, dict_type, payload FROM vocabulary WHERE word LIKE ?",
    ("%vocabzone-e2e-probe%",),
).fetchall()
print("count", len(rows))
for rid, word, cat, dt, payload in rows:
    print("---", rid, word, cat, dt)
    p = json.loads(payload or "{}")
    print("keys", sorted(p.keys()) if isinstance(p, dict) else type(p))
    if not isinstance(p, dict):
        continue
    for k in [
        "translation_main",
        "meaning_zh",
        "meaning",
        "definition",
        "definition_en",
        "translation",
        "explain",
        "pos",
        "phonetic",
        "etymology",
    ]:
        v = p.get(k)
        if v not in (None, ""):
            print(k, str(v)[:240])
    for k in [
        "example_sentences",
        "examples",
        "business_examples",
        "scenarios",
        "synonyms",
        "antonyms",
        "collocations",
        "senses",
    ]:
        v = p.get(k)
        n = len(v) if hasattr(v, "__len__") and not isinstance(v, str) else None
        print(k, type(v).__name__, n, str(v)[:400])
