require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

console.log('\n================== 物理服务器 Dify 工作流与 API Key 配置核查报告 ==================');
console.log('🌐 Dify 基础 API 域名 (DIFY_API_BASE_URL):', process.env.DIFY_API_BASE_URL || process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1');

console.log('\n[1] 商业长文生成工作流 (materail_generate_url_enhanced):');
console.log('    - 变量名: DIFY_LONG_AUDIO_API_KEY / DIFY_LISTEN_GEN_API_KEY');
console.log('    - 实际运行 API Key:', process.env.DIFY_LONG_AUDIO_API_KEY || process.env.VITE_DIFY_LONG_AUDIO_API_KEY || process.env.DIFY_LISTEN_GEN_API_KEY || '(内置默认值)');

console.log('\n[2] 今日唤醒词包与破绽词包工作流 (DailyPack Cron):');
console.log('    - 变量名: DIFY_DAILY_PACK_API_KEY / DIFY_ENGLISH_MASTERY_KEY');
console.log('    - 实际运行 API Key:', process.env.DIFY_DAILY_PACK_API_KEY || process.env.DIFY_ENGLISH_MASTERY_KEY || 'app-OShKY1EcVuLFkuxrpO28ZB0A');

console.log('\n[3] 商业词汇/短语提纯工作流 (English Mastery Extraction):');
console.log('    - 变量名: DIFY_ENGLISH_MASTERY_KEY');
console.log('    - 实际运行 API Key:', process.env.DIFY_ENGLISH_MASTERY_KEY || 'app-OShKY1EcVuLFkuxrpO28ZB0A');

console.log('\n[4] AI 商业词典探针工作流 (Dict Lookup):');
console.log('    - 变量名: DIFY_DICT_API_KEY');
console.log('    - 实际运行 API Key:', process.env.DIFY_DICT_API_KEY || 'app-zGyrsyvvzHAIO5yx11OcYdpa');
console.log('=======================================================================================\n');
