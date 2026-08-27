import sys
import paramiko

def run_remote_http_test():
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect('150.158.34.217', 22, 'ubuntu', '19890430@lmq')

    cmd = """
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
      const testUser = "verify_test_user_" + Date.now();
      console.log("=== 1. 测试 /api/dify/dict-query (vibe) ===");
      const dictRes = await post("/api/dify/dict-query", {
        word: "vibe",
        dictType: "en_zh_bidirectional",
        userId: testUser
      });
      console.log("dict_ok:", dictRes.ok);
      const payload = dictRes.payload || {};
      console.log("headword:", payload.headword);
      console.log("senses_count:", payload.senses?.length);
      console.log("raw_markdown_exists:", Boolean(payload.raw_markdown));
      console.log("phonetics:", JSON.stringify(payload.phonetics));
      console.log("source:", payload.source);
      console.log("field_source_main:", payload.field_sources?.translation_main);
      console.log("field_source_senses:", payload.field_sources?.senses);

      console.log("\\n=== 2. 测试 /api/vocab/add-enriched (保存入生词本) ===");
      const addRes = await post("/api/vocab/add-enriched", {
        word: "vibe",
        payload: payload,
        userId: testUser
      });
      console.log("add_success:", addRes.success);
      const savedPayload = typeof addRes.entry?.payload === "string" ? JSON.parse(addRes.entry.payload) : (addRes.entry?.payload || {});
      console.log("saved_has_raw_md:", Boolean(savedPayload.raw_markdown));
      console.log("saved_senses_count:", savedPayload.senses?.length);
      console.log("saved_phonetics:", JSON.stringify(savedPayload.phonetics));
      console.log("saved_field_source_main:", savedPayload.field_sources?.translation_main);
    }

    test().catch(err => {
      console.error("HTTP_TEST_ERR:", err);
      process.exit(1);
    });
    '
    """
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print("REMOTE_HTTP_OUT:\n", out)
    if err.strip():
        print("REMOTE_HTTP_ERR:\n", err)
    client.close()

if __name__ == '__main__':
    run_remote_http_test()
