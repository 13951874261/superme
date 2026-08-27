import sys
import paramiko

def debug():
    sys.stdout.reconfigure(encoding='utf-8')
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect('150.158.34.217', 22, 'ubuntu', '19890430@lmq')

    cmd = r'''
    cd /var/www/super-agent/vocab-server && node -e '
    const { fetchCambridgeEntry } = require("./services/cambridgeDictionary");
    async function test() {
      const cam = await fetchCambridgeEntry("mud");
      console.log("=== RAW MARKDOWN (first 5000 chars) ===");
      console.log(cam.raw_markdown?.substring(0, 5000));
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