const Database = require('better-sqlite3');
const db = new Database('/var/www/super-agent/vocab.db');

const rows = db.prepare(`
  SELECT id, user_id, created_at, length(response_payload) AS len, response_payload
  FROM dict_query_log
  WHERE word='mud' COLLATE NOCASE AND is_success=1
  ORDER BY created_at DESC
  LIMIT 20
`).all();

for (const row of rows) {
  let syn = 0, col = 0, ety = false, biz = 0, ok = null;
  try {
    const j = JSON.parse(row.response_payload);
    const p = j.payload || {};
    ok = j.ok;
    syn = Array.isArray(p.synonyms) ? p.synonyms.length : 0;
    col = Array.isArray(p.collocations) ? p.collocations.length : 0;
    ety = !!(p.etymology && String(p.etymology).trim());
    biz = Array.isArray(p.business_examples) ? p.business_examples.length : 0;
  } catch (e) {
    console.log('parse fail', row.created_at, e.message);
    continue;
  }
  console.log(JSON.stringify({
    created_at: row.created_at,
    len: row.len,
    ok,
    syn,
    col,
    ety,
    biz,
  }));
}

// any word with enrichment for this user recently?
const enriched = db.prepare(`
  SELECT word, created_at, length(response_payload) AS len
  FROM dict_query_log
  WHERE user_id='lzhmy' AND is_success=1
    AND response_payload LIKE '%"synonyms":[%'
    AND response_payload NOT LIKE '%"synonyms":[]%'
  ORDER BY created_at DESC
  LIMIT 10
`).all();
console.log('recent enriched samples', enriched);
