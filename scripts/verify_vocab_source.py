import sys
import paramiko

def run_remote_check():
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect('150.158.34.217', 22, 'ubuntu', '19890430@lmq')

    cmd = """
    cd /var/www/super-agent/vocab-server && node -e '
    const db = require("better-sqlite3")("/var/www/super-agent/vocab.db");
    const row = db.prepare("SELECT payload FROM vocabulary WHERE word = ? COLLATE NOCASE ORDER BY added_at DESC LIMIT 1").get("vibe");
    if (row) {
      const p = JSON.parse(row.payload);
      console.log("=== 入库 payload 关键字段来源 ===");
      console.log("translation_main:", p.translation_main?.substring(0,30));
      console.log("phonetics:", p.phonetics);
      console.log("senses_len:", p.senses?.length);
      console.log("raw_markdown_len:", p.raw_markdown?.length);
      console.log("synonyms:", p.synonyms);
      console.log("antonyms:", p.antonyms);
      console.log("collocations:", p.collocations);
      console.log("business_note:", p.business_note);
      console.log("memory_aids_root:", p.root_memory || (p.memory_aids?.root_memory));
      console.log("field_sources:", JSON.stringify(p.field_sources, null, 2));
    } else {
      console.log("未找到 vibe 词条");
    }
    '
    """
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print(out)
    if err.strip():
        print("ERR:", err)
    client.close()

if __name__ == '__main__':
    run_remote_check()