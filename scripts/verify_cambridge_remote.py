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
    const { fetchCambridgeEntry, mergeCambridgeWithDify } = require("./services/cambridgeDictionary");
    async function main() {
      const cam = await fetchCambridgeEntry("vibe");
      console.log("CAM_RAW_OK:", Boolean(cam && cam.raw_markdown && cam.senses && cam.senses.length === 2));
      console.log("CAM_HEADWORD:", cam?.headword);
      console.log("CAM_SENSES_COUNT:", cam?.senses?.length);
      console.log("CAM_PHONETICS:", JSON.stringify(cam?.phonetics));
      
      const dify = {
        translation_main: "气氛 (Dify)",
        other_meanings: [{ meaning: "（某地的）气氛，氛围", context: "dify-dup" }, { meaning: "独有义项", context: "dify-only" }],
        example_sentences: [
          { en: "The city is famous for its laid-back vibe.", zh: "旧例句" },
          { en: "Unique dify example.", zh: "独有例句" }
        ],
        synonyms: ["atmosphere"],
        business_note: "商务场景补充"
      };
      
      const merged = mergeCambridgeWithDify(cam, dify);
      console.log("MERGED_MAIN:", merged.translation_main);
      console.log("MERGED_RAW_MD_EXISTS:", Boolean(merged.raw_markdown));
      console.log("MERGED_EX_COUNT:", merged.example_sentences.length);
      console.log("MERGED_EX_DEDUP:", merged.example_sentences.filter(e => e.en.includes("laid-back")).length === 1);
      console.log("MERGED_OTHER_DEDUP:", !merged.other_meanings.some(m => m.meaning === "（某地的）气氛，氛围"));
      console.log("MERGED_OTHER_HAS_UNIQUE:", merged.other_meanings.some(m => m.meaning === "独有义项"));
      console.log("MERGED_HAS_SYNONYMS:", merged.synonyms.includes("atmosphere"));
      console.log("MERGED_HAS_BIZ:", merged.business_note === "商务场景补充");
      console.log("MERGED_FIELD_SOURCES_MAIN:", merged.field_sources?.translation_main);
      console.log("MERGED_FIELD_SOURCES_SYN:", merged.field_sources?.synonyms);
    }
    main().catch(err => {
      console.error("REMOTE_ERROR:", err.message);
      process.exit(1);
    });
    '
    """
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print("STDOUT:\n", out)
    if err.strip():
        print("STDERR:\n", err)
    client.close()

if __name__ == '__main__':
    run_remote_check()
