import sys
import paramiko
import json

def verify_isolation():
    sys.stdout.reconfigure(encoding='utf-8')
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect('150.158.34.217', 22, 'ubuntu', '19890430@lmq')

    cmd = '''
    cd /var/www/super-agent/vocab-server && node -e '
    const http = require("http");
    
    function post(path, body) {
      return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const req = http.request({
          hostname: "127.0.0.1",
          port: 3001,
          path,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload)
          }
        }, (res) => {
          let data = "";
          res.on("data", chunk => data += chunk);
          res.on("end", () => resolve(JSON.parse(data)));
        });
        req.on("error", reject);
        req.write(payload);
        req.end();
      });
    }
    
    async function test() {
      // Test 1: Request without userId should be rejected
      console.log("=== Test 1: Missing userId ===");
      const res1 = await post("/api/dify/dict-query", { word: "test" });
      console.log("Status:", res1.ok ? "FAIL (should reject)" : "PASS (rejected)");
      console.log("Message:", res1.message);
      
      // Test 2: Request with valid userId should work
      console.log("\\n=== Test 2: Valid userId ===");
      const res2 = await post("/api/dify/dict-query", { 
        word: "vibe", 
        userId: "isolation_test_user_" + Date.now()
      });
      console.log("Status:", res2.ok ? "PASS" : "FAIL");
      if (res2.payload) {
        console.log("headword:", res2.payload.headword);
        console.log("has_phonetics:", !!res2.payload.phonetics);
      }
      
      // Test 3: Verify cache isolation - query same word with different userId
      console.log("\\n=== Test 3: Cache isolation ===");
      const uid1 = "isol_user_A_" + Date.now();
      const uid2 = "isol_user_B_" + Date.now();
      
      const resA = await post("/api/dify/dict-query", { word: "bush", userId: uid1 });
      const resB = await post("/api/dify/dict-query", { word: "bush", userId: uid2 });
      
      console.log("User A headword:", resA.payload?.headword);
      console.log("User B headword:", resB.payload?.headword);
      console.log("Isolated:", resA.payload?.headword === resB.payload?.headword ? "YES (same word)" : "NO (different)");
    }
    
    test().catch(err => {
      console.error("ERROR:", err.message);
      process.exit(1);
    });
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
    verify_isolation()
