import sys
import paramiko

def debug():
    sys.stdout.reconfigure(encoding='utf-8')
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect('150.158.34.217', 22, 'ubuntu', '19890430@lmq')

    cmd = r'''
    cd /var/www/super-agent/vocab-server && node -e '
    const { fetchCambridgeEntry, parseCambridgeMarkdown } = require("./services/cambridgeDictionary");
    async function test() {
      const cam = await fetchCambridgeEntry("mud");
      console.log("=== headword ===");
      console.log(cam.headword);
      console.log("=== translation_main ===");
      console.log(cam.translation_main);
      console.log("=== senses count ===");
      console.log(cam.senses?.length);
      console.log("=== senses ===");
      for (const s of cam.senses || []) {
        console.log("  label:", s.label);
        console.log("  definition_en:", s.definition_en);
        console.log("  translation_zh:", s.translation_zh);
        console.log("  examples:", s.examples?.length);
        console.log("  ---");
      }
      console.log("=== other_meanings ===");
      for (const m of cam.other_meanings || []) {
        console.log("  meaning:", m.meaning);
        console.log("  context:", m.context);
      }
    }
    test().catch(e => { console.error(e); process.exit(1); });
    '
    '''
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print(out)
    if err.strip():
        print("STDERR:", err)
    client.close()

if __name__ == '__main__':
    debug()