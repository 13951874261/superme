async function testDify() {
  const difyApiKey = 'app-YysFumsmeSAeJaQMobMpW24r';
  const baseUrl = 'https://dify.234124123.xyz/v1';

  const payload = {
    inputs: {
      scene_type: 'corp_clash',
      game_model: 'pig_game',
      case_text: '跨国区域VP在明知道供应链延迟是由他心腹部门造成的状况下，在董事会上却通过极度专业的合规词汇，将第一罪责隐性转移到你的大区头上。此刻会议离轮到你发言还有最后十分钟。',
      user_answer: '① 利益结构分析：\n跨国VP保护心腹，我方力求洗脱供应链延迟罪责\n\n② 善/恶动机透视：\nVP出于自保与巩固权力，蓄意嫁祸我方；我方属防卫动机\n\n③ 对方权力弱点：\nVP所引用的合规词汇存在业务硬伤，且财务审计并不直接归属VP管辖\n\n④ 博弈关键节点：\n会场发言时，利用数据模型当场拆穿VP的逻辑硬伤，并将审计焦点引向具体延迟原因',
      applied_tactics: '构建联盟, 软对抗'
    },
    response_mode: 'blocking',
    user: 'default-user'
  };

  try {
    console.log('Sending request to Dify...');
    const response = await fetch(`${baseUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${difyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('Response Status:', response.status);
    const text = await response.text();
    console.log('Response Body Snippet:', text.substring(0, 1000));
    
    if (response.ok) {
      const data = JSON.parse(text);
      const rawResult = data?.data?.outputs?.analysis_result ?? data?.data?.outputs?.result ?? data?.answer ?? data?.message ?? '';
      console.log('\n--- Raw Result Output ---');
      console.log(rawResult);
      
      const cleanJson = String(rawResult).replace(/```json/g, '').replace(/```/g, '').trim();
      console.log('\n--- Cleaned JSON ---');
      console.log(cleanJson);
      
      try {
        const parsed = JSON.parse(cleanJson);
        console.log('\n--- Parsed JSON Success ---');
        console.log(JSON.stringify(parsed, null, 2));
      } catch (err) {
        console.error('Failed to parse cleaned JSON:', err.message);
      }
    }
  } catch (err) {
    console.error('Network or Execution Error:', err);
  }
}

testDify();
