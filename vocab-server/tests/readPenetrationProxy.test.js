const assert = require("assert");
const { createReadPenetrationAnalyzer } = require("../services/readPenetrationProxy");

(async () => {
  const requests = [];
  const analyze = createReadPenetrationAnalyzer({
    apiKey: "server-only-key",
    baseUrl: "https://dify.example/v1",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        json: async () => ({ data: { outputs: { analysis_result: '{"surface_conclusion":"已解析"}' } } }),
      };
    },
  });

  await assert.rejects(() => analyze({ sceneType: "invalid", textInput: "测试", userId: "u1" }), /无效的穿透读场景类型/);
  await assert.rejects(() => analyze({ sceneType: "policy", textInput: "", userId: "u1" }), /请输入待分析文本/);

  const result = await analyze({
    sceneType: "policy",
    textInput: "这是一段待穿透分析的政策材料。",
    userId: "u1",
    userProfile: "关注政策意图",
    systemTime: "2026-08-11 10:00:00",
  });

  assert.deepStrictEqual(result, { surface_conclusion: "已解析" });
  assert.strictEqual(requests.length, 1);
  assert.strictEqual(requests[0].url, "https://dify.example/v1/workflows/run");
  assert.strictEqual(requests[0].options.headers.Authorization, "Bearer server-only-key");
  const body = JSON.parse(requests[0].options.body);
  assert.strictEqual(body.user, "u1");
  assert.strictEqual(body.inputs.scene_type, "policy");
  assert.strictEqual(body.inputs.text_input, "这是一段待穿透分析的政策材料。");
  assert.strictEqual(body.inputs.user_current_profile, "关注政策意图");
  assert.strictEqual(body.inputs._system_time, "2026-08-11 10:00:00");
  assert.strictEqual(body.response_mode, "blocking");
  console.log("readPenetrationProxy tests passed");
})().catch((error) => { console.error(error); process.exit(1); });

