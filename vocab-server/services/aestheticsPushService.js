const crypto = require('crypto');

const RETENTION_DAYS = 7;
const DEFAULT_SCOPE = 'mixed';

const FALLBACK_SCENARIOS = [
  {
    slug: 'art-gallery',
    category: 'aesthetics',
    title: '艺术展闭幕式中的含蓄社交',
    type: '高端文化社交',
    description: '先谈观看感受，再谈判断；不以价格替代审美。',
    background: '闭幕式人流动线密、赞助方与藏家交错。你需要在不打断别人观看的前提下，用具体作品细节打开对话，并给对方留下评价空间。',
    rules: [
      '先站在作品侧前方，不挡主视线',
      '开场只描述你看见的一个细节，不先定价',
      '对方未问时，不主动介绍自己的收藏或预算',
      '转场时先点头致谢，再让出观看位置',
      '合影或交换名片等对方先伸手'
    ],
    temper: '声音压低，语速放慢。兴趣放在作品上，而不是证明自己更懂。',
    dialogue_example: '「这一组冷色块把走廊的灯光压住了，我更在意它和旁边那件的距离，也想听听您最先停下来的是哪一处。」',
    traps: [
      '用拍卖成交价衡量作品高下',
      '打断导览或挡在藏家拍照机位前',
      '连问三句却不给对方接话空隙',
      '把个人偏好说成圈内共识',
      '当场批评主办方选件眼光'
    ],
    practice_task: '下次看展时，对同一件作品写下：一个可见细节、一句感受、一个留给同伴的问题。'
  },
  {
    slug: 'tea-room',
    category: 'social',
    title: '茶席中的谈话节奏控制',
    type: '中式雅集',
    description: '七分茶三分情，续茶时用克制的回礼保持交流节奏。',
    background: '茶席上续茶、让座和沉默都是发言。你要判断谁在主茶、谁在陪坐，并把话题压在茶与当下，而不是急于谈事。',
    rules: [
      '茶只倒七分，杯口朝向主客方便取用',
      '主人续茶时立刻行对应辈分的扣指礼',
      '先听完一句再接，不抢主茶人的停顿',
      '话题从茶温、香气或器型切入',
      '离席前把杯位复原，不把手机放到席面中央'
    ],
    temper: '动作放慢，肩背放松。用续茶和停顿控制节奏，不靠提高音量占场。',
    dialogue_example: '「赵处，这道老白茶茶气温和，正适合今天把话说慢一点。您先尝这杯，我再给您续上。」',
    traps: [
      '茶满过沿还继续倒',
      '主人续茶时低头看手机',
      '大口鲸吞或把冷茶留到变味',
      '席间直接谈立项和人事',
      '用三指礼对长辈或用单指礼对平辈'
    ],
    practice_task: '找一次喝茶，只练两件事：续茶时的回礼，以及把一句公务话改成茶席能说的短句。'
  },
  {
    slug: 'auction',
    category: 'aesthetics',
    title: '拍卖预展中的价值判断',
    type: '收藏品社交',
    description: '先询问来源与工艺，再表达偏好，不抢先判断价格。',
    background: '预展是看物也是看人。你要在不暴露预算的前提下，把判断建立在来源、工艺和保存状态上。',
    rules: [
      '先看标签上的来源和年代，再开口',
      '询问保存状态和修复痕迹，不先问估价',
      '表达偏好时只说一件，不横向贬低邻件',
      '与顾问对话保持一问一答，不围堵',
      '离开展柜时把隔栏位置让给下一位'
    ],
    temper: '好奇而克制。把不确定说成问题，而不是结论。',
    dialogue_example: '「这件的包浆和底部款识我对得上，修复痕迹我想再看一眼。您方便说说它最近一次的流传记录吗？」',
    traps: [
      '当众报出心理价或资金盘',
      '用“真假”二字当场下判',
      '翻动展品或贴得过近触发警报',
      '把别家成交价套到这件上压人',
      '跟着别人举牌节奏起哄评价'
    ],
    practice_task: '选一件展品，只写三栏：来源、工艺疑点、你不会当众说的价格判断。'
  },
  {
    slug: 'opera',
    category: 'aesthetics',
    title: '歌剧散场后的跨文化谈资',
    type: '古典艺术社交',
    description: '从具体乐章和现场感受切入，避免背诵式炫耀知识。',
    background: '散场人流向外，谈话窗口很短。你要用今晚听到的一个段落打开话题，而不是背词条。',
    rules: [
      '等指挥双手放下、掌声第一波过后再评',
      '先说今晚哪一段让你停住，不先报作曲家年谱',
      '对不熟的剧目只问感受，不装成常客',
      '走廊里把音量压到只给身边人听',
      '邀约下一场时给出具体剧目或日期，不空说“改天”'
    ],
    temper: '内敛、具体。把知识收在问题里，而不是铺成演讲。',
    dialogue_example: '「第二幕那句延长音把整个厅压住了。我更在意它和灯光暗下去的同步，您当时有没有同样的停顿？」',
    traps: [
      '乐章或幕间鼓掌',
      '散场时大声复述维基百科条目',
      '比较票价来证明自己更懂',
      '批评邻座着装或迟到',
      '把个人口味说成正统标准'
    ],
    practice_task: '完整听完一幕，只记下一个时间点和一句现场感受，第二天用它开一次不超过 20 秒的谈话。'
  },
  {
    slug: 'golf',
    category: 'social',
    title: '高尔夫球场上的失误应对',
    type: '轻商务社交',
    description: '把失误处理为节奏管理，不抱怨、不急于证明实力。',
    background: '球场上每一次挥杆都暴露情绪。你要在失误后保住节奏、草皮和同组关系。',
    rules: [
      '他人站位准备时完全静音、不入视线',
      '打完立刻填沙或放回草皮',
      '失误后只说一句节奏判断，不解释技术',
      '报杆如实，不替别人改记分',
      '让后方组通过时主动靠边并举手示意'
    ],
    temper: '肩松、脸平。把输赢留在记分卡上，不留在表情上。',
    dialogue_example: '「这杆我节奏快了半拍，下一洞我把准备动作收短。李总这杆弹道很稳，您先请。」',
    traps: [
      '砸杆、骂地或回头看队友表情',
      '在别人上杆时走路或接电话',
      '为面子少报一杆',
      '指导同组技术除非被明确问起',
      '拖延找球超过约定时间'
    ],
    practice_task: '练习场连续打 10 球，只练失误后的三秒：收杆、填动作、说一句不自贬的话。'
  },
  {
    slug: 'dinner',
    category: 'social',
    title: '私人家宴中的座次与敬酒',
    type: '政商务礼仪',
    description: '先观察主宾关系和主人节奏，再决定发言与敬酒顺序。',
    background: '家宴比酒店更看隐秩序。你要先认清主陪、主宾和家中长辈，再决定何时举杯。',
    rules: [
      '入座前等主人示意，不抢主宾右手位',
      '第一轮由主陪启动，你再按尊卑补敬',
      '杯口低于对方，祝词不超过两句',
      '夹菜先让长辈和主宾，不翻盘底',
      '离席向主人道谢，不在门口谈未尽的公事'
    ],
    temper: '谦逊、观察优先。身体微前倾，目光给正在说话的人。',
    dialogue_example: '「张局，今天能坐到您旁边是我的学习。这杯我先干，您随意，也请您多保重身体。」',
    traps: [
      '隔人敬酒或跨桌灌酒',
      '祝词又长又油，点名别人隐私',
      '主宾未动筷就先夹菜',
      '把商务条件放到第二巡酒里谈',
      '劝酒用“不给面子”施压'
    ],
    practice_task: '下次家宴只做一件事：看清谁先举杯，再决定自己的顺序和祝词长度。'
  },
  {
    slug: 'cigar',
    category: 'aesthetics',
    title: '雪茄会所中的边界感',
    type: '高端休闲社交',
    description: '尊重对方品鉴节奏，不主动纠正他人选择，不把消费当身份证明。',
    background: '会所里点燃、静置和谈话是同一套节奏。你要管好自己的烟头和话题边界。',
    rules: [
      '询问能否共用火源，不抢别人的剪和喷枪',
      '点燃后不把烟雾直对他人面部',
      '灰积到该落时再轻磕，不频繁弹灰',
      '评价只说自己这支的气味层次',
      '未抽完的雪茄静置熄灭，不按进缸底'
    ],
    temper: '松弛、少解释。把专业词留到被问的时候。',
    dialogue_example: '「这支前段有一点皮革和可可，我先坐一会儿。您那支如果更干，我就不拿我的口味去比。」',
    traps: [
      '纠正别人选的规格或品牌',
      '把价格和限量挂在嘴边',
      '吸入肺或当香烟连抽',
      '用喷枪对着别人的手试火',
      '把商务谈判压进第一支还没燃稳的时候'
    ],
    practice_task: '点一支时只做三步：问火、慢燃、说一句气味，不提价格。'
  },
  {
    slug: 'museum',
    category: 'aesthetics',
    title: '博物馆专场中的低声交流',
    type: '公共文化社交',
    description: '用具体细节表达兴趣，控制音量和停留时间，给他人留出观看空间。',
    background: '专场灯光暗、距离近。你的音量和站位会直接决定别人能不能看。',
    rules: [
      '在展签侧说话，音量只到同伴',
      '一件展品停留有限，不围成封闭圈',
      '先读展签再发表判断',
      '拍照遵守禁闪和禁自拍杆',
      '讲解员讲话时停步、不穿插提问超过一次'
    ],
    temper: '轻、短、具体。把兴奋收在用词里，不收在音量里。',
    dialogue_example: '「看这件的修复接缝，右侧比左侧旧一层。我们往左让一点，后面还有人要过。」',
    traps: [
      '对着展柜开手电筒或闪光灯',
      '靠在展柜玻璃上指点',
      '用百科词条盖过展签信息',
      '带着一群人堵住主通道',
      '嘲笑其他观众的问题'
    ],
    practice_task: '下一场展览只选三件，每件只说一个可见细节，然后主动让位。'
  },
  {
    slug: 'dress',
    category: 'social',
    title: '正式晚宴的着装色彩分寸',
    type: '场合审美',
    description: '优先服从场合等级和主宾信息，不让服装成为抢夺注意力的工具。',
    background: '晚宴灯光、地毯和主宾着装已经定了调。你要让自己的颜色和材质进入场合，而不是压过场合。',
    rules: [
      '先确认请柬上的着装等级再选颜色',
      '主宾若着深色，你避免更抢眼的金属和大面积亮片',
      '配饰只留一件记忆点，不全身发光',
      '外套、围巾在进厅时按接待指示安置',
      '夸别人着装只提剪裁或颜色，不提价格'
    ],
    temper: '干净、安静。让人先看见场合，再看见你。',
    dialogue_example: '「今晚厅里的暖光很适合您这身深色绒面。我选了更收的剪裁，免得在主桌边上跳出来。」',
    traps: [
      '颜色比主宾或主人更跳',
      '当众整理吊牌、商标或价格',
      '评论别人“这件不适合晚宴”',
      '香水浓到一米外都能先闻到你',
      '用潮牌反差当个性，无视请柬等级'
    ],
    practice_task: '下次正式局，先写下主宾可能的色系，再删掉自己搭配里最抢眼的一件。'
  },
  {
    slug: 'flowers',
    category: 'aesthetics',
    title: '商务会面中的花艺话题',
    type: '日常审美社交',
    description: '以季节、空间和照料谈花，不用昂贵与否直接评价品位。',
    background: '会客厅的花是主人布置的一部分。你要从季节和空间关系进入，而不是估价。',
    rules: [
      '先认季节和花材，再谈喜好',
      '问这组花和房间光线的关系',
      '不触碰花器，只在可视距离欣赏',
      '若要送花，先问场合和过敏，不自行加香',
      '把花事收在两句内，再把话交回正题'
    ],
    temper: '轻巧、不黏。花是过门，不是主场。',
    dialogue_example: '「这一枝正好对着窗，下午的光会把叶子抬起来。您是按这个季节换的，还是按这间房的进深选的？」',
    traps: [
      '开口就问这束多少钱',
      '用手拨开花头看品种',
      '把别人的花艺说成“太家常”',
      '送花选浓香或带刺却不说明',
      '用花艺话题拖延不愿进入正事'
    ],
    practice_task: '观察一处商务空间的花，只准备两句：季节，以及它和光线/桌面的关系。'
  },
  {
    slug: 'wine',
    category: 'aesthetics',
    title: '红酒品鉴中的克制表达',
    type: '餐桌审美',
    description: '描述香气和口感即可，不把个人偏好包装成专业结论。',
    background: '侍酒和同桌都在听你怎么说这杯酒。你要描述，不要判决。',
    rules: [
      '持杯脚或杯底，不捂杯肚',
      '先看色、再闻、再小口，不一次喝干',
      '只描述你尝到的一层味道',
      '侍酒提问时先答温度和醒酒，不改别人的点单',
      '敬酒仍守杯口低于对方'
    ],
    temper: '慢、短、诚实。不会的词不说。',
    dialogue_example: '「这杯前段有一点红果，单宁现在刚好贴着牙龈。我还想再醒两分钟，您要是觉得它已经打开了，我们就按您的节奏。」',
    traps: [
      '像喝啤酒一样满口灌',
      '背产区和分数压同桌',
      '纠正侍酒的倒法来显专业',
      '把“我喝过更贵的”当评价',
      '没尝完就给酒庄下定论'
    ],
    practice_task: '今晚只练持杯和一句味道描述，不报产区、年份和价格。'
  },
  {
    slug: 'calligraphy',
    category: 'aesthetics',
    title: '书法雅集中的作品交流',
    type: '传统文化社交',
    description: '先说气息、章法和观看感受，再提出问题，不贸然下定论。',
    background: '雅集里每个人都可能是写的人。你要先看再问，把评价留在气息和章法，而不是对错。',
    rules: [
      '先整幅远看，再近看单字，不伸手触纸',
      '开场说气息或行气，不先判功力高低',
      '请教用“哪一笔您最在意”，而不是“这字对不对”',
      '别人落笔时不旁观指导',
      '离开时把观帖位置让回原位'
    ],
    temper: '静、敬。把好胜收起来，把眼睛留下来。',
    dialogue_example: '「这幅中段的行气是连着走的，我停在第三行的提按。您写的时候是先定中轴，还是先定字距？」',
    traps: [
      '用印刷体标准去量手写',
      '当场改别人的字或抢笔示范',
      '比较谁的老师名气更大',
      '把作品拍成短视频而不问许可',
      '用“外行看热闹”堵别人提问'
    ],
    practice_task: '临一张字时只写三句观后感：气息、一个单字、一个你不会当众下的结论。'
  }
].map((item) => ({
  scenario_id: `fallback-${item.slug}`,
  category: item.category,
  title: item.title,
  type: item.type,
  description: item.description,
  background: item.background,
  rules: item.rules,
  temper: item.temper,
  dialogue_example: item.dialogue_example,
  traps: item.traps,
  practice_task: item.practice_task,
  difficulty: 8,
  dedupe_key: `fallback-${item.slug}`
}));

function todayInShanghai() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function parseScenario(raw) {
  if (raw && typeof raw === 'object') return raw;
  const text = String(raw || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(text); } catch { return null; }
}

function isValidScenario(value) {
  return value && typeof value === 'object'
    && typeof value.title === 'string' && value.title.trim()
    && typeof value.description === 'string'
    && Array.isArray(value.rules) && value.rules.length >= 5
    && typeof value.temper === 'string'
    && typeof value.dialogue_example === 'string'
    && Array.isArray(value.traps) && value.traps.length >= 2
    && typeof value.practice_task === 'string';
}

function normalizeScenario(value) {
  const scenario = { ...value };
  scenario.scenario_id = String(scenario.scenario_id || 'generated-' + crypto.randomUUID());
  scenario.dedupe_key = String(scenario.dedupe_key || scenario.scenario_id);
  scenario.category = scenario.category === 'social' ? 'social' : 'aesthetics';
  scenario.difficulty = Math.max(1, Math.min(10, Number(scenario.difficulty) || 8));
  if (!scenario.background || scenario.background.length < 50) {
    scenario.background = '在社交场景的实践中，参与者需要判断场合规则、关系距离和发言时机。';
  }
  if (!scenario.temper || scenario.temper.length < 30) {
    scenario.temper = '保持松弛、克制和开放。不要急于证明自己知道更多，也不要把个人偏好强行上升为统一标准。';
  }
  if (!scenario.dialogue_example || scenario.dialogue_example.length < 20) {
    scenario.dialogue_example = '我更关注现场呈现出的细节和交流节奏，也想听听您最在意的部分。';
  }
  const defaultRules = [
    '先观察场合和关系结构',
    '先描述事实再表达判断',
    '给对方留下回应空间',
    '身体与语气保持松弛，不抢主位',
    '转场或离席时致谢，不强行收束话题到自己',
  ];
  if (!Array.isArray(scenario.rules)) {
    scenario.rules = String(scenario.rules || '')
      .split(/[。；;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  scenario.rules = scenario.rules.map((r) => String(r || '').trim()).filter(Boolean);
  if (scenario.rules.length < 5) {
    const seen = new Set(scenario.rules);
    for (const pad of defaultRules) {
      if (scenario.rules.length >= 5) break;
      if (seen.has(pad)) continue;
      scenario.rules.push(pad);
      seen.add(pad);
    }
  }
  if (!Array.isArray(scenario.traps) || scenario.traps.length < 3) {
    scenario.traps = ['不懂装懂并堆砌术语', '抢话或过早下结论', '把消费价格等同于审美价值'];
  }
  if (!scenario.practice_task || scenario.practice_task.length < 10) {
    scenario.practice_task = '围绕今日场景写下一句观察：一个事实、一个感受、一个留给对方的问题。';
  }
  return scenario;
}

function pickFallback(recentKeys) {
  const unused = FALLBACK_SCENARIOS.filter((item) => !recentKeys.includes(item.dedupe_key));
  if (unused.length) return unused[0];
  const oldestKey = recentKeys[recentKeys.length - 1];
  return FALLBACK_SCENARIOS.find((item) => item.dedupe_key === oldestKey) || FALLBACK_SCENARIOS[0];
}

async function generateWithDify({ apiKey, baseUrl, recentKeys, scope, context, difficulty, userProfile }) {
  if (!apiKey) return null;
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/workflows/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: {
        scene_scope: scope || DEFAULT_SCOPE,
        preferred_context: context || '政商务与日常社交并行',
        difficulty: difficulty || 'advanced',
        avoid_topics: recentKeys.join(', '),
        user_profile: userProfile || '',
        generation_request: '生成一个新的高阶审美与社交博弈实操情境'
      },
      response_mode: 'blocking',
      user: 'aesthetic-generator'
    })
  });
  if (!response.ok) throw new Error(`Dify HTTP ${response.status}`);
  const payload = await response.json();
  const output = payload?.data?.outputs?.scenario_json
    ?? payload?.data?.outputs?.text
    ?? payload?.data?.outputs?.result;
  const scenario = parseScenario(output);
  return isValidScenario(scenario) ? normalizeScenario(scenario) : null;
}

function initAestheticsPushTables(db) {
  db.prepare(`CREATE TABLE IF NOT EXISTS daily_aesthetics_pushes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    push_date TEXT NOT NULL,
    scenario_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`).run();

  const indexes = db.prepare('PRAGMA index_list(daily_aesthetics_pushes)').all();
  const hasCompositeUnique = indexes.some((idx) => {
    if (!idx.unique) return false;
    const cols = db.prepare(`PRAGMA index_info("${String(idx.name).replace(/"/g, '""')}")`).all().map((col) => col.name);
    return cols.includes('user_id') && cols.includes('push_date') && cols.length === 2;
  });
  if (hasCompositeUnique) {
    db.exec(`
      CREATE TABLE daily_aesthetics_pushes_mig (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        push_date TEXT NOT NULL,
        scenario_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      INSERT INTO daily_aesthetics_pushes_mig (id, user_id, push_date, scenario_json, created_at)
        SELECT id, user_id, push_date, scenario_json, created_at FROM daily_aesthetics_pushes;
      DROP TABLE daily_aesthetics_pushes;
      ALTER TABLE daily_aesthetics_pushes_mig RENAME TO daily_aesthetics_pushes;
    `);
  }
  db.prepare('CREATE INDEX IF NOT EXISTS idx_aesthetics_push_user_created ON daily_aesthetics_pushes(user_id, created_at)').run();
}

function createService({ db, apiKey, baseUrl }) {
  const getRecent = db.prepare('SELECT scenario_json FROM daily_aesthetics_pushes WHERE user_id = ? AND push_date >= date(?, ?) ORDER BY created_at DESC');
  const save = db.prepare('INSERT INTO daily_aesthetics_pushes (id, user_id, push_date, scenario_json, created_at) VALUES (?, ?, ?, ?, ?)');

  async function getDailyPush({ userId = 'default-user', force = false, scope, context, difficulty, userProfile } = {}) {
    const pushDate = todayInShanghai();
    const recentRows = getRecent.all(userId, pushDate, `-${RETENTION_DAYS} days`);
    const recentKeys = recentRows.map((row) => parseScenario(row.scenario_json)?.dedupe_key).filter(Boolean);
    let scenario = null;
    let source = 'dify';
    try {
      scenario = await generateWithDify({ apiKey, baseUrl, recentKeys, scope, context, difficulty, userProfile });
    } catch (error) {
      console.warn('[Aesthetics Push] Dify generation failed:', error.message);
    }
    if (!scenario || recentKeys.includes(scenario.dedupe_key)) {
      source = 'fallback';
      scenario = pickFallback(recentKeys);
    }
    save.run(crypto.randomUUID(), userId, pushDate, JSON.stringify(scenario), Date.now());
    return { ...scenario, push_date: pushDate, source, refreshed: Boolean(force) };
  }

  return { getDailyPush };
}

module.exports = { initAestheticsPushTables, createService, FALLBACK_SCENARIOS };
