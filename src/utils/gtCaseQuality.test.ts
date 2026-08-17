import { describe, expect, it } from 'vitest';
import {
  evaluateCasePushQuality,
  evaluateVerdictSectionsQuality,
  GT_CASE_BG_MIN,
  GT_VERDICT_SECTIONS_MIN,
} from './gtCaseQuality';

function padTo(text: string, minLength: number, filler = '我们在推进具体业务过程中需要全面权衡各方利益。'): string {
  let s = text;
  while (s.replace(/\s+/g, '').length < minLength) {
    s += filler;
  }
  return s;
}

describe('GT-CASE-02 黄金夹具测试套件 (F1 ~ F6)', () => {
  // F1: ≥400 字套话 + 董事长/CEO/VP，无场合时限与尖锐两难 → below_standard
  it('F1: 案例空话拦截 (≥400字套话 + 职衔) → below_standard', () => {
    const background = padTo(
      '作为业务负责人，我们与董事长、CEO、VP及总监保持高度重视与统筹兼顾。综上所述，我们要保持战略定力，深刻理解全局要求，高度重视各方诉求，统筹兼顾各项指标。',
      420,
      '我们要高度重视并深刻理解战略定力，统筹兼顾各项工作，综上所述形成共识。'
    );
    const r = evaluateCasePushQuality({
      background,
      incomplete_info: '相关各方在沟通中仍有一些情况尚待进一步明确和统筹安排。',
      decision_point: '我们需要根据上级会议要求，综合评估后续工作推进方案。',
    });
    expect(r.char_count).toBeGreaterThanOrEqual(GT_CASE_BG_MIN);
    expect(r.quality).toBe('below_standard');
  });

  // F2: 合格尖锐局 ≥400字，≥3方张力、时限场合、信息缺口、选边即伤 → ok
  it('F2: 合格尖锐案例 (≥400字，三方具名 + 场合时限 + 未知信息 + 尖锐决策) → ok', () => {
    const background = padTo(
      '你是产品线总监。董事长与CEO在周五闭门会上当场翻脸，CFO与法务各执一词，投资人要求你立刻站队。' +
      '创始人仍握有大股东投票权，秘书已发出重组预读材料。下属团队人心浮动，同事开始私下打听编制。' +
      '你既不是董事会圈内人，也不是创始人铁杆，却被逼在信息不完整时决定是否署名。' +
      '任何站队都可能在周一被单独清算，公开信草稿把治理危机写得很满，却没有给你看任何证据附件。',
      420,
      '会前四十八小时内，各方VP已开始私下对账，任何过早表态都会被视作背叛，任何沉默也会被解读成观望投机。'
    );
    const r = evaluateCasePushQuality({
      background,
      incomplete_info: '你不知道董事长是否已私下承诺保护那位VP，也不确定法务是否已锁死财务审计证据链。',
      decision_point: '十分钟后会议点名。你若公开站队副总则直接得罪董事长，若弃权则被双方清算，你签还是不签？',
    });
    expect(r.char_count).toBeGreaterThanOrEqual(GT_CASE_BG_MIN);
    expect(r.quality).toBe('ok');
  });

  // F3: 四节合计 ≥600 但全是套话，无输赢/情绪/步骤/话术 → below_standard
  it('F3: 研判空话拦截 (四节合计 ≥600 套话) → below_standard', () => {
    const clichePara = padTo(
      '我们要高度重视并深刻理解整体战略定力，统筹兼顾各方诉求。综上所述，必须在思想上保持一致，全面落实各项工作部署。',
      160,
      '我们要高度重视统筹兼顾，综上所述深刻理解战略定力。'
    );
    const r = evaluateVerdictSectionsQuality({
      interest_chain: clichePara,
      emotion_motives: clichePara,
      actionable_strategy: clichePara,
      script_examples: clichePara,
    });
    expect(r.sections_char_count).toBeGreaterThanOrEqual(GT_VERDICT_SECTIONS_MIN);
    expect(r.quality).toBe('below_standard');
  });

  // F4: 四节合计 ≥600 且具利益输赢、情绪锚点、次序动作、可出口台词 → ok
  it('F4: 合格研判 (四节合计 ≥600，利益输赢 + 情绪锚点 + 步骤次序 + 可出口话术) → ok', () => {
    const interest = padTo(
      '【利益链与输赢分析】在此局中，CEO的核心利益是巩固控制权并赢得董事会投票，赢家将全面掌控预算分配；' +
      '而副总裁已面临出局风险，输家将被彻底边缘化甚至背锅。双方结成脆弱同盟但已有裂痕，中间派中层的站队将决定利益天平走向。',
      160,
      '各方在资金链与编制分配上的核心利益发生正面冲突，同盟与阵营已现不可逆的利益裂痕。'
    );
    const emotion = padTo(
      '【情绪与动机透视】董事长表面强硬实则内心充满失控的恐惧，极度害怕被投资人架空；' +
      '李总则受制于面子与自尊心，无法接受当众被羞辱与难堪，强烈的权力欲望与焦虑驱使他铤而走险。',
      160,
      '这种权力焦虑与怕被清算的深层恐惧，构成了其非理性决策的主要情绪动机。'
    );
    const action = padTo(
      '【可执行次序策略】第一步，在周五会前先私下与法务总监对账，保全关键审批流证据；' +
      '第二步，今晚立刻与核心骨干闭门沟通稳定团队；第三步，在正式会议上再提出折中审计方案，切忌过早公开表态。',
      160,
      '必须严格遵循先私下取证、再小范围结盟、最后当众定策的行动次序。'
    );
    const script = padTo(
      '【可出口话术示范】在面对CEO追问时，可直接说出口的原话台词如下：' +
      '「张总，关于业务重组方案，我建议我们先以审计委员会的合规底线为基准，在周一闭门会上由我先汇报数据，您看这样是否最稳妥？」',
      160,
      '此台词话术既给对方留足面子，又清晰划定合规边界，原话可直接在对峙时说出。'
    );

    const r = evaluateVerdictSectionsQuality({
      interest_chain: interest,
      emotion_motives: emotion,
      actionable_strategy: action,
      script_examples: script,
    });
    expect(r.sections_char_count).toBeGreaterThanOrEqual(GT_VERDICT_SECTIONS_MIN);
    expect(r.quality).toBe('ok');
  });

  // F5: background 仅 380 字但密度合格 → below_standard (字数失败)
  it('F5: 案例字数不足拦截 (380字但密度合格) → below_standard', () => {
    const background = padTo(
      '你是产品线总监。董事长与CEO在周五闭门会上翻脸，CFO与法务各执一词，投资人要求你立刻站队。' +
      '创始人握有大股东投票权，秘书发出重组预读材料。任何站队都可能在周一被单独清算。',
      380,
      '周五会前多方争夺激烈。'
    ).slice(0, 380); // 确保去空白严格小于 400

    const r = evaluateCasePushQuality({
      background,
      incomplete_info: '你不知道董事长是否已私下承诺保护那位VP，也不确定法务是否已锁死财务审计证据链。',
      decision_point: '十分钟后会议点名。你若公开站队副总则直接得罪董事长，若弃权则被双方清算，你签还是不签？',
    });
    expect(r.char_count).toBeLessThan(GT_CASE_BG_MIN);
    expect(r.quality).toBe('below_standard');
  });

  // F6: 四节合计 500 字但密度合格 → below_standard (字数失败)
  it('F6: 研判字数不足拦截 (四节合计 500字但密度合格) → below_standard', () => {
    const r = evaluateVerdictSectionsQuality({
      interest_chain: 'CEO赢得控制权，副总面临出局，同盟出现裂痕，输家将失去全部利益预算。',
      emotion_motives: '董事长内心充满被架空的恐惧，李总为了挽回面子极度害怕当众难堪。',
      actionable_strategy: '第一步先在会前私下对账取证，第二步今晚与骨干沟通，第三步再当众表态。',
      script_examples: '直接说台词原话：「张总，我们先按合规底线汇报，周一闭门会由我说明。」',
    });
    expect(r.sections_char_count).toBeLessThan(GT_VERDICT_SECTIONS_MIN);
    expect(r.quality).toBe('below_standard');
  });
});
