import sys
import paramiko

def debug():
    sys.stdout.reconfigure(encoding='utf-8')
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect('150.158.34.217', 22, 'ubuntu', '19890430@lmq')

    # Use base64 to encode the node script
    import base64
    script = '''
    const { fetchCambridgeEntry } = require("./services/cambridgeDictionary");
    function cleanMarkdown(value) {
      return String(value || "")
        .replace(/!\\[[^\\]]*\\]\\([^)]*\\)/g, "")
        .replace(/\\[([^\\]]+)\\]\\([^)]*\\)/g, "$1")
        .replace(/[*_`#]/g, "")
        .replace(/\\\\([\\[]])/g, "$1")
        .replace(/\\s+/g, " ")
        .trim();
    }
    async function test() {
      const cam = await fetchCambridgeEntry("mud");
      const sourceText = cam.raw_markdown.split(/^## Examples of\\b/im)[0];
      
      const posLineMatch = sourceText.match(/^(noun|verb|adjective|adverb|pronoun|preposition|conjunction|exclamation|determiner|modal verb|phrasal verb)\\b/im);
      if (posLineMatch) {
        const senseBlock = sourceText.slice(posLineMatch.index);
        const rawLines = senseBlock.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);
        console.log("=== RAW LINES after pos ===");
        for (const line of rawLines) {
          console.log("RAW:", line.substring(0, 150));
        }
        
        console.log("\\n=== CLEANED LINES ===");
        for (const line of rawLines) {
          const cleaned = cleanMarkdown(line);
          if (cleaned) console.log("CLEAN:", cleaned.substring(0, 200));
        }
      }
    }
    test().catch(e => { console.error(e); process.exit(1); });
    '''
    
    encoded = base64.b64encode(script.encode('utf-8')).decode('ascii')
    cmd = f'cd /var/www/super-agent/vocab-server && echo "{encoded}" | base64 -d | node'
    
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print(out)
    if err.strip():
        print("STDERR:", err)
    client.close()

if __name__ == '__main__':
    debug()