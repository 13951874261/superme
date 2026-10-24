/**
 * XF-FEED-02 黄金夹具单测：听 / 说 / 博弈 三模块出题与生成变难硬卡
 * 
 * 夹具说明：
 * - F-L1 / F-L2：听模块浅层复述稿（100% 拒收） vs 含隐藏底牌/信息差的博弈剧本（100% 通过）
 * - F-S1 / F-S2：说模块浅层场景（100% 拒收） vs 含目标冲突与硬约束的实战场景（100% 通过）
 * - F-G1 / F-G2：博弈模块浅层简案（100% 拒收） vs 含信息不对称/真实底线的博弈攻防案例（100% 通过）
 */

const assert = require('assert');
const {
  evaluateListenScriptHardness,
  evaluateSpeakScenarioHardness,
  evaluateGameTheoryCaseHardness,
} = require('../services/moduleHardnessQuality');

// ----------------------------------------------------
// 1. 洞察(听) 夹具：F-L1 vs F-L2
// ----------------------------------------------------
const FL1_SHALLOW_SCRIPT = `
张总对李总说：“所谓BATNA就是最佳替代方案，我们在谈判中应当准备好备选方案。”
李总说：“好的，我完全理解并同意这个概念，我们下周再聊。”
`;

const FL2_HARDENED_SCRIPT = `
王总（微笑，推过一份修订合同）：“李总，如果这批元器件的交期提前两周，我们在单价上可以再让利3%。”
李总（眼神微敛，未接合同）：“王总，据我所知，你们二号厂房上周因环保改造停工，真能在下月前完成交付吗？我方现在的替代方案是直接向华南供应商调货。”
王总（暗自一惊，意识到对方已探知内部信息差）：“华南的良品率和我们无法相提并论。这样，我们把违约金比例上浮至20%，并签署排他协议。”
李总（抓住对方的底牌破绽，试探对方真实底线）：“违约金可以谈，但必须以首付款延期结算为前提条件，否则我们只能启动BATNA方案。”
`;

const resL1 = evaluateListenScriptHardness(FL1_SHALLOW_SCRIPT);
assert.strictEqual(resL1.ok, false, 'F-L1 浅层书摘复述必须被听模块硬卡拒收');
assert.ok(resL1.failedChecks.length > 0);

const resL2 = evaluateListenScriptHardness(FL2_HARDENED_SCRIPT);
assert.strictEqual(resL2.ok, true, 'F-L2 具备信息差与底牌试探的剧本必须通过听模块硬卡');
assert.strictEqual(resL2.reason, 'ok');

// ----------------------------------------------------
// 2. 破局(说) 夹具：F-S1 vs F-S2
// ----------------------------------------------------
const FS1_SHALLOW_SCENARIO = `
你是一家公司的销售代表，今天要去客户公司拜访王总，向他介绍公司最新的产品功能，请运用沟通技巧进行讲解。
`;

const FS2_HARDENED_SCENARIO = `
【谈判实战情境】
你代表核心供应商与采购总监李总进行年度续约谈判。
【你的核心目标】
力争在下季度将供货基准价上调6%，以对冲原材料暴涨带来的亏损。
【核心冲突与严苛约束】
1. 利益冲突：李总态度极其强硬，并在开场便以引入竞品供应商为威胁，要求你方继续降价3%；
2. 严苛死线：必须在今晚6点前敲定保供备忘录，否则明天生产线将面临停工风险；
3. 真实底线：公司财务下达的死命令是涨价幅度不得低于2%，绝对不能击穿真实底线；
4. 破局要求：你必须在守住底线的同时，运用替代方案拆解对方的施压，促成双方达成妥协。
`;

const resS1 = evaluateSpeakScenarioHardness(FS1_SHALLOW_SCENARIO);
assert.strictEqual(resS1.ok, false, 'F-S1 浅层无冲突场景必须被说模块硬卡拒收');

const resS2 = evaluateSpeakScenarioHardness(FS2_HARDENED_SCENARIO);
assert.strictEqual(resS2.ok, true, 'F-S2 具备目标冲突与严苛死线约束的场景必须通过说模块硬卡');
assert.strictEqual(resS2.reason, 'ok');

// ----------------------------------------------------
// 3. 驭心博弈 夹具：F-G1 vs F-G2
// ----------------------------------------------------
const FG1_SHALLOW_CASE = {
  title: '普通合作谈判',
  background: '甲公司和乙公司打算合资开发新业务，双方都希望能在这个项目中赚到更多的利润。',
  incomplete_info: '双方不完全清楚对方的成本。',
  decision_point: '究竟是合作还是不合作？',
};

const FG2_HARDENED_CASE = {
  title: '控股权收购与对赌博弈',
  background: `
在一家高端芯片设计企业的控股收购战中，买方利用行业下行周期的信息不对称故意散布虚假估值，企图低价吸筹；
卖方创始团队虽然公开底线宣称估值绝不低于8000万元，但实际真实底线只有5500万元，且正面临核心团队被挖角与现金流断裂的致命双重危机。
双方在多轮闭门博弈中反复试探彼此的BATNA与底牌：若卖方强硬决裂则可能直接破产出局，若买方过度压价则会逼迫卖方倒向国资白衣骑士。
`,
  incomplete_info: '买方隐瞒了已与国资达成过桥贷款协议的信息差，卖方则隐瞒了第二代专利已通过初审的关键筹码。',
  decision_point: '今晚24点前，是选择签署对赌协议保全控制权，还是直接亮出专利底牌实施战略反制？若妥协则面临被架空反噬，若对抗则可能玉石俱焚。',
};

const resG1 = evaluateGameTheoryCaseHardness(FG1_SHALLOW_CASE);
assert.strictEqual(resG1.ok, false, 'F-G1 浅层简案必须被博弈硬卡拒收');

const resG2 = evaluateGameTheoryCaseHardness(FG2_HARDENED_CASE);
assert.strictEqual(resG2.ok, true, 'F-G2 深度博弈案例必须通过博弈硬卡');
assert.strictEqual(resG2.reason, 'ok');

console.log('moduleHardnessQuality.test.js: All module hardness golden fixture tests passed successfully!');
