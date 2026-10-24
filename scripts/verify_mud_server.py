import sys
import paramiko
import base64

def debug():
    sys.stdout.reconfigure(encoding='utf-8')
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect('150.158.34.217', 22, 'ubuntu', '19890430@lmq')

    # Read the actual file from server and check the regex
    cmd = '''
    cd /var/www/super-agent/vocab-server && node -e "
    const { fetchCambridgeEntry } = require('./services/cambridgeDictionary');
    async function test() {
      const cam = await fetchCambridgeEntry('mud');
      console.log('translation_main:', JSON.stringify(cam.translation_main));
      console.log('senses count:', cam.senses?.length);
      if (cam.senses?.[0]) {
        console.log('definition_en:', JSON.stringify(cam.senses[0].definition_en));
        console.log('translation_zh:', JSON.stringify(cam.senses[0].translation_zh));
      }
    }
    test().catch(e => { console.error(e.message); process.exit(1); });
    "
    '''
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print("OUT:", out)
    if err.strip():
        print("ERR:", err)
    client.close()

if __name__ == '__main__':
    debug()