import sys
import paramiko
import base64

def debug():
    sys.stdout.reconfigure(encoding='utf-8')
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect('150.158.34.217', 22, 'ubuntu', '19890430@lmq')

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
        
        // This is exactly what parseSense does
        const heading = cleanMarkdown(rawLines.shift() || "");
        const headingMatch = heading.match(/^(.+?)(noun|verb|adjective|adverb|pronoun|preposition|conjunction|exclamation|determiner|modal verb|phrasal verb)\\s*(?:\\(([^)]+)\\))?$/i);
        console.log("heading:", heading);
        console.log("headingMatch:", headingMatch?.[0]);
        
        const lines = rawLines.map(cleanMarkdown)
          .map((line) => line.replace(/^(?:Add to word list)+/i, "").replace(/Add to word listAdd to word list/gi, "").trim())
          .filter(Boolean);
        
        console.log("\\n=== CLEANED LINES (0-10) ===");
        for (let i = 0; i < Math.min(12, lines.length); i++) {
          console.log(i + ":", lines[i]);
        }
        
        const contentEnd = lines.findIndex((line) => /^\\(?Translation of\\b|^To top$|^See more results/i.test(line));
        console.log("\\ncontentEnd:", contentEnd);
        if (contentEnd >= 0) lines.splice(contentEnd);
        
        const inflectionLabel = '(?:plural|singular|past tense|past participle|present participle|third person singular|comparative|superlative)';
        const metadataIndexes = new Set();
        lines.forEach((line, index) => {
          if (/^\\(A1|A2|B1|B2|C1|C2\\)$/i.test(line) || new RegExp(`\\\\[\\\\s*(?:[CU]|${inflectionLabel})\\\\s*\\\\]`, "i").test(line)) metadataIndexes.add(index);
        });
        console.log("metadataIndexes:", Array.from(metadataIndexes));
        
        const nonDefinitionPattern = /^(uk|us|your browser|[\\/\\\\][\\w\\u02c8\\u02cc\\u026a\\u028a\\u025b\\u00e6\\u0251\\u0254\\u0259\\u028c\\u026a\\u02d0]+[\\/\\\\]|add to word list|idioms?|noun|verb|adjective|adverb|pronoun|preposition|conjunction|exclamation|determiner|modal verb|phrasal verb)(?:\\s*\\[[^\\]]+\\])?$/i;
        
        for (let i = 0; i < lines.length; i++) {
          const matches = nonDefinitionPattern.test(lines[i]);
          console.log(`  ${i}: test=${matches} => "${lines[i].substring(0,60)}"`);
          if (i > 10) { console.log("  ..."); break; }
        }
        
        let definitionIndex = lines.findIndex((line, index) => 
          !metadataIndexes.has(index) 
          && !/^Add to word list$/i.test(line) 
          && !nonDefinitionPattern.test(line)
          && /[A-Za-z]/.test(line)
        );
        console.log("\\ndefinitionIndex:", definitionIndex);
        if (definitionIndex >= 0) {
          console.log("matched:", lines[definitionIndex]);
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