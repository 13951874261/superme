import {
  ScriptWorkshopDraft,
  ScriptReviewReport,
  BrokenLinkItem
} from './ScriptWorkshopTypes';

/**
 * 统计中英文字符字数
 */
export function countWords(text: string): number {
  if (!text) return 0;
  // 移除多余空白后统计长度
  const clean = text.replace(/\s+/g, '');
  return clean.length;
}

/**
 * 预估演播时长 (分钟) - 标准 240~260 字/分钟
 */
export function estimateDurationMinutes(words: number): number {
  return Number((words / 250).toFixed(1));
}

/**
 * 提取剧本中的轮次 (以角色发言为标识，如：角色A： 或 **角色A**（...）：)
 */
export function countRounds(fullText: string): number {
  const roundMatches = fullText.match(/(?:^|\n)\s*(?:\*\*)?[\u4e00-\u9fa5a-zA-Z0-9_-]{2,10}(?:\*\*)?(?:（[^）]*）|\([^)]*\))?\s*[:：]/g);
  return roundMatches ? roundMatches.length : Math.max(1, Math.round(countWords(fullText) / 120));
}

/**
 * 本地高精度 100 分制剧本审稿与因果诊断引擎
 */
export function evaluateScriptDraft(draft: ScriptWorkshopDraft): ScriptReviewReport {
  const p1Words = countWords(draft.phases[0].content);
  const p2Words = countWords(draft.phases[1].content);
  const p3Words = countWords(draft.phases[2].content);
  const p4Words = countWords(draft.phases[3].content);
  const totalWords = p1Words + p2Words + p3Words + p4Words;
  const fullContent = draft.phases.map(p => p.content).join('\n');
  const totalRounds = countRounds(fullContent);
  const estimatedMinutes = estimateDurationMinutes(totalWords);

  const p1Ratio = totalWords > 0 ? p1Words / totalWords : 0;
  const p2Ratio = totalWords > 0 ? p2Words / totalWords : 0;
  const p3Ratio = totalWords > 0 ? p3Words / totalWords : 0;
  const p4Ratio = totalWords > 0 ? p4Words / totalWords : 0;

  // 1. 时长与节奏评分 (满分 30 分)
  let durationScore = 30;
  const durationDetails: string[] = [];

  if (totalWords >= 2100 && totalWords <= 2600) {
    durationDetails.push(`总字数 ${totalWords} 字（预估时长 ${estimatedMinutes} 分钟），完美落在 8–10 分钟黄金标准区间 (满分 15 分)`);
  } else if (totalWords >= 1800 && totalWords < 2100) {
    durationScore -= 5;
    durationDetails.push(`总字数 ${totalWords} 字略低于 2100 字门槛（预估 ${estimatedMinutes} 分钟，偏短），建议适当充实台词细节 (-5分)`);
  } else if (totalWords > 2600 && totalWords <= 3000) {
    durationScore -= 5;
    durationDetails.push(`总字数 ${totalWords} 字略高于 2600 字上限（预估 ${estimatedMinutes} 分钟，偏长），建议精简冗余对白 (-5分)`);
  } else if (totalWords < 1800) {
    durationScore -= 15;
    durationDetails.push(`总字数仅 ${totalWords} 字（预估 ${estimatedMinutes} 分钟），严重不达标，无法支撑 8-10 分钟高强度对抗 (-15分)`);
  } else {
    durationScore -= 15;
    durationDetails.push(`总字数达 ${totalWords} 字（预估 ${estimatedMinutes} 分钟），超出正常演播耐受度 (-15分)`);
  }

  // 阶段配比检查 (理想目标 2:3:4:1，即 15~20%, 30~35%, 35~40%, 10~15%)
  const isP3Dominant = p3Ratio >= 0.30;
  const isP1Reasonable = p1Ratio >= 0.10 && p1Ratio <= 0.25;
  if (isP3Dominant && isP1Reasonable) {
    durationDetails.push(`四阶段节奏配比 (${(p1Ratio*100).toFixed(0)}% : ${(p2Ratio*100).toFixed(0)}% : ${(p3Ratio*100).toFixed(0)}% : ${(p4Ratio*100).toFixed(0)}%) 符合高潮爆发结构 (满分 15 分)`);
  } else {
    durationScore -= 7;
    durationDetails.push(`四阶段配比失衡：阶段三（高潮）占比 ${(p3Ratio*100).toFixed(0)}%，未呈现清晰的 2:3:4:1 节奏波峰 (-7分)`);
  }

  // 2. 因果闭环与逻辑一致性 (满分 40 分)
  let causalityScore = 40;
  const causalityDetails: string[] = [];
  const brokenLinks: BrokenLinkItem[] = [];

  // 检测伏笔与高潮对应关键词
  const p1p2Text = draft.phases[0].content + '\n' + draft.phases[1].content;
  const p3p4Text = draft.phases[2].content + '\n' + draft.phases[3].content;

  // 检查角色动机与台词自洽
  if (draft.characters.length >= 3) {
    let characterMentionCount = 0;
    draft.characters.forEach(char => {
      if (fullContent.includes(char.name)) {
        characterMentionCount++;
      } else {
        brokenLinks.push({
          phaseId: 1,
          character: char.name,
          quoteText: `角色【${char.name}】在剧本设定中存在，但正文未登场发言`,
          issueType: '角色动机前后矛盾',
          description: `角色【${char.name}】(${char.roleTitle}) 在设定中拥有独立隐秘动机，但剧本未安排对应戏份`,
          suggestion: `在阶段一或阶段二为【${char.name}】增加至少 2 轮表态或试探对白`
        });
      }
    });

    if (characterMentionCount >= 3) {
      causalityDetails.push(`核心 ${characterMentionCount} 位角色全员登场，动机冲突鲜明 (得 20 分)`);
    } else {
      causalityScore -= 10;
      causalityDetails.push(`部分预设角色戏份缺失，影响多方博弈平衡 (-10分)`);
    }
  } else {
    causalityScore -= 10;
    causalityDetails.push(`角色人数少于 3 人，难以构成多边博弈矩阵 (-10分)`);
  }

  // 检查是否存在突兀关键词（如凭空出现未被铺垫的重要道具/绝杀）
  const abruptKeywords = ['其实我早就', '下毒', '没想到吧', '亲兄弟', '炸弹', '遗嘱'];
  abruptKeywords.forEach(kw => {
    if (p3p4Text.includes(kw) && !p1p2Text.includes(kw) && kw !== '没想到吧') {
      brokenLinks.push({
        phaseId: 3,
        quoteText: `“...${kw}...”`,
        issueType: '无前置伏笔突兀反转',
        description: `后半程高潮中使用了关键反制要素【${kw}】，但在前半程（阶段1-2）中未留下任何线索伏笔（违反契诃夫之枪原则）`,
        suggestion: `在阶段一或阶段二中，通过微表情、动作或侧面台词提前暗示该要素的存在。`
      });
      causalityScore -= 8;
    }
  });

  if (brokenLinks.length === 0) {
    causalityDetails.push('伏笔与反转闭环完整，未检测到机械降神或悬空因果 (得 20 分)');
  } else {
    causalityDetails.push(`检测到 ${brokenLinks.length} 处因果链薄弱点或契诃夫之枪遗漏 (扣除对应分数)`);
  }

  // 3. 策略强度与博弈快感 (满分 30 分)
  let strategyScore = 30;
  const strategyDetails: string[] = [];
  const highlights: string[] = [];

  // 检测信息差与反制
  if (draft.infoMatrix && draft.infoMatrix.length >= 2) {
    strategyDetails.push(`已配置 ${draft.infoMatrix.length} 项信息差对抗矩阵 (得 15 分)`);
    highlights.push('利用信息不对称构建了多重视角盲区');
  } else {
    strategyScore -= 8;
    strategyDetails.push('信息差矩阵不足 2 项，缺乏深层博弈基础 (-8分)');
  }

  // 检测多边博弈与反制深度
  if (totalRounds >= 16) {
    strategyDetails.push(`交互轮次达到 ${totalRounds} 轮，满足高强度攻防拉扯深度 (得 15 分)`);
    highlights.push('攻防转换节奏紧凑，反制层次分明');
  } else {
    strategyScore -= 7;
    strategyDetails.push(`总轮次仅 ${totalRounds} 轮（少于 16 轮），博弈过程较为平铺直叙 (-7分)`);
  }

  const finalScore = Math.max(0, Math.min(100, durationScore + causalityScore + strategyScore));

  return {
    score: finalScore,
    passed: finalScore >= 85,
    totalWords,
    estimatedMinutes,
    totalRounds,
    phaseDistribution: {
      phase1: { words: p1Words, ratio: Number(p1Ratio.toFixed(2)) },
      phase2: { words: p2Words, ratio: Number(p2Ratio.toFixed(2)) },
      phase3: { words: p3Words, ratio: Number(p3Ratio.toFixed(2)) },
      phase4: { words: p4Words, ratio: Number(p4Ratio.toFixed(2)) },
    },
    durationScore: {
      score: Math.max(0, durationScore),
      details: durationDetails,
    },
    causalityScore: {
      score: Math.max(0, causalityScore),
      details: causalityDetails,
      brokenLinks,
    },
    strategyScore: {
      score: Math.max(0, strategyScore),
      details: strategyDetails,
      highlights,
    },
  };
}

/**
 * 标杆范例预设数据库（可直接载入至工作台）
 */
export const PRESET_BENCHMARK_SCRIPTS: ScriptWorkshopDraft[] = [
  {
    sceneTitle: '《黑客危机：暗网核心代码泄露案》',
    sceneSummary: '暗网拍卖倒计时仅剩 10 分钟，天玑科技四巨头在封闭指挥室展开关于后门、背叛与资本狙击的高强度攻防博弈。',
    characters: [
      {
        id: 'c1',
        name: '林锐',
        roleTitle: '首席安全官 (CSO)',
        surfaceGoal: '坚称防火墙清白，主张物理断网',
        hiddenMotive: '昨夜家人被勒索被迫留了1号后门，但暗中将后门重定向到蜜罐，极力掩盖痕迹',
        redLine: '决不能暴露出后门日志',
        winCondition: '证明代码未失窃并抓出真凶'
      },
      {
        id: 'c2',
        name: '苏晚',
        roleTitle: '独立合规审计师',
        surfaceGoal: '例行合规核查',
        hiddenMotive: '手握林锐被勒索的私聊截图，试图逼林锐放弃股权并承担无限连带责任',
        redLine: '决不能让代码被竞对非法抽走',
        winCondition: '逼林锐签协议或完成真实审计'
      },
      {
        id: 'c3',
        name: '张恺',
        roleTitle: '竞对智芯技术VP',
        surfaceGoal: '提供第三方技术援助与离线沙盒',
        hiddenMotive: '自导自演暗网拍卖，借离线沙盒物理接入触发2号后门现场抽走代码',
        redLine: '决不能让陆远终止交易',
        winCondition: '抽走核心代码并促成贱卖并购'
      },
      {
        id: 'c4',
        name: '陆远',
        roleTitle: '大股东代表兼董事长',
        surfaceGoal: '控制损失，要求交出负责人',
        hiddenMotive: '早已通过离岸银行查到暗网保证金汇款账户实为张恺亲妹控制',
        redLine: '决不能让代码归零',
        winCondition: '引蛇出洞，锁定真凶并收网'
      }
    ],
    infoMatrix: [
      {
        id: 'info-1',
        type: 'public',
        title: '暗网拍卖倒计时',
        content: '暗网九头蛇论坛正在拍卖天玑科技核心架构，倒计时剩余 10 分钟。'
      },
      {
        id: 'info-2',
        type: 'exclusive',
        title: '林锐的蜜罐重定向',
        owner: '林锐',
        content: '林锐在凌晨 02:00 将 1 号后门接入了蜜罐，暗网根本拿不到真密钥。'
      },
      {
        id: 'info-3',
        type: 'exclusive',
        title: '张恺的2号隐藏后门',
        owner: '张恺',
        content: '张恺的离线沙盒一接入物理接口，即以 2GB/s 速率触发 2 号后门提取真实代码。'
      },
      {
        id: 'info-4',
        type: 'exclusive',
        title: '开曼空壳基金穿透',
        owner: '陆远',
        content: '陆远已掌握暗网保证金账户的实际控制人为张恺亲妹的开曼基金。'
      }
    ],
    phases: [
      {
        phaseId: 1,
        title: '阶段一：警报拉响与表面试探',
        targetDuration: '1.5 - 2.0 min',
        targetWordsRange: '350 - 450 字',
        targetRatio: 0.18,
        content: `**陆远**（将手中的平板电脑重重扣在长桌上，目光如刀扫视全场）：
“各位，暗网‘九头蛇’论坛上的倒计时还有不到十分钟。天玑核心架构的源代码如果被打包拍卖，明天开盘，集团两百亿市值就会像泡沫一样蒸发。林锐，你是安全官，今天这间屋子里只有我们四个人，我不听公关辞令，我要知道真相——门是怎么开的？”

**林锐**（指尖不易察觉地颤抖了一下，迅速在主控键盘上敲击几下，调出绿色监控图表）：
“陆董，我可以拿职业生涯担保，外部防火墙至今没有被暴力破解的物理痕迹。我们在今天凌晨 02:14 自动运行了全盘 SHA-256 哈希完整性校验，基线完全吻合。现在的外部流量更像是一次高伪装的分布式拒绝服务诱饵，只要我们立刻拔掉主干光纤，暗网拿不到最终的解密密钥。”

**张恺**（推了推金丝眼镜，嘴角挂着温和的笑意，从随身公文包里取出一个银色加密终端）：
“林总，拔光纤？一旦物理断网，明天纳斯达克的复牌直接转为停牌，这代价陆董承受得起吗？既然陆董请我作为第三方技术观察员出席，我带来智芯科技的‘天网离线沙盒’。只要把你们的镜像接入我的独立沙盒，两分钟内就能抓出那根暗桩，何必因噎废食？”

**苏晚**（翻开厚重的合规审计文件夹，冷冷抬眼，笔尖在纸面上轻轻敲击）：
“张总的热心真让人感动。不过作为独立审计师，我提醒各位：任何未经三方公证的外接设备接入核心服务器，都属于重大违规。林总刚才强调 02:14 的哈希校验吻合，但根据我收到的系统访问日志，昨夜 01:50 到 02:10 之间，最高管理员权限曾发生过一次离线签名覆盖。林总，你不觉得这二十分钟的空白，需要先向大家解释一下吗？”`
      },
      {
        phaseId: 2,
        title: '阶段二：信息差拉扯与伏笔布局',
        targetDuration: '2.5 - 3.5 min',
        targetWordsRange: '700 - 850 字',
        targetRatio: 0.32,
        content: `**陆远**（眼神一沉，靠向椅背，冷眼盯着林锐）：
“二十分钟的离线覆盖？林锐，你在瞒我什么？”

**林锐**（深吸一口气，强作镇定，背后的冷汗已浸湿衬衫）：
“那是我在做例行内核热补丁！苏审计，你懂财务合规，但不代表你懂分布式系统的运维逻辑。如果不进行离线签名覆写，暗网在昨天下午就已经利用零日漏洞攻进来了！现在时间只剩八分钟，纠结二十分钟前的例行操作，是在给黑客争取时间！”

**张恺**（立刻站起身，走到主控台旁，看似替林锐解围，实则将银色终端接口推近）：
“苏审计，技术人员有技术人员的紧急处置权，何必上纲上线？陆董，暗网那边的出价已经飙到四千万美元了。林总既然坚持没有被破，又不敢拔网线，那让我接入离线沙盒做旁路镜像监听，是目前唯一的折中方案。沙盒只读不写，完全符合合规要求，苏审计也可以在旁边全程监督，如何？”

**苏晚**（嘴角泛起一丝冰冷的弧度，目光像解剖刀一样落在林锐脸上）：
“只读不写？张总这话说得真漂亮。不过在接入之前，林总，你还没回答我的关键问题——昨夜 01:50 登录特权账户的物理 IP，为什么显示在城南的一间私人公寓？据我所知，那是你前妻和女儿目前的住址吧？你把能调动公司命脉的最高权限密钥，带回了家？”

**林锐**（脸色瞬间苍白，手掌猛地按在控制台上，瞳孔骤缩）：
“苏晚！你非法监控我的私人生活？！”

**张恺**（眼底闪过一丝狂喜，迅速趁乱将银色终端的物理光纤插入了机柜旁的镜像调试口）：
“好了两位！别内讧了！镜像已经开始旁路同步，离线沙盒正在跑流量特征。林总，把你的特权指令放开，我帮你清洗掉异常连接，保住天玑，也保住你自己的前途！”`
      },
      {
        phaseId: 3,
        title: '阶段三：底牌掀翻与双重反转（高潮）',
        targetDuration: '3.5 - 4.0 min',
        targetWordsRange: '950 - 1050 字',
        targetRatio: 0.38,
        content: `**陆远**（猛然站起，声音带着令人窒息的威压）：
“够了！暗网倒计时只剩五分钟！林锐，你今天要是给不出合理解释，不仅要承担泄密的所有民事赔偿，商业间谍罪的起诉书半小时内就会递到经侦大队！”

**苏晚**（直接将一份加盖红章的文件和平板电脑甩在桌子中央，反转 1 爆发）：
“不用等经侦了，陆董，请看大屏幕！昨晚 01:30，境外暗网中介给林锐发送了匿名勒索邮件，以他女儿的医疗账户做要挟，要求他开放 1 号后门通道。林总在 01:50 妥协并交出了后门权限！林锐，你所谓的‘内核热补丁’，根本就是你为了救家人，亲手给出卖公司的后门放行！我这里有你的全部端对端通信截屏，现在签下全额股权放弃与无限连带责任书，是陆董给你的最后体面！”

**张恺**（满面痛心疾首，实则暗中注视着银色终端上飞速增长的进度条）：
“林总……真是没想到啊，天玑的核心安全官居然监守自盗！陆董，天玑的技术声誉彻底毁了。但看在两家交情的份上，智芯科技愿意出资五千万整体接盘天玑的代码资产，帮您平掉外部投资人的窟窿。只要您现在盖章授权转让，我马上用我的沙盒强行锁死这套系统！”

**林锐**（原本惊恐的表情突然凝固，他抬起头，眼神中的慌乱在一瞬间褪去，取而代之的是极致的冷静与嘲讽）：
“苏晚，你拿到的勒索截图是真的。昨晚我确实被威胁了，也确实在 01:50 登录了特权后台……但是，你们真以为我是个任人宰割的蠢货吗？”

**张恺**（心中咯噔一下，手不自觉地想要去拔下银色终端）：
“你……你说什么？”

**林锐**（一把按住张恺伸向终端的手腕，死死扣住，反转 2 连环爆发）：
“张总，别急着拔啊！我刚才在第一阶段就强调过——凌晨 02:14 我运行了全盘哈希校验！如果我真放行了 1 号后门，哈希值怎么可能吻合？那是因为在 02:00，我就把 1 号后门重定向进了一个虚假蜜罐！暗网上的竞拍根本拿不到真正的代码！但我没想到，今天居然有人急不可耐地要带‘离线沙盒’来现场救火！”
（林锐单手猛击回车键，大屏幕瞬间切换为抓包雷达）：
“各位请看！张恺的沙盒一接入镜像口，不仅没有分析流量，反而在以每秒 2GB 的速度触发系统底层的‘2号隐藏后门’！这个后门的时间戳是三个月前智芯科技帮我们做架构升级时偷偷植入的！张恺，暗网上的拍卖只是你自导自演的烟雾弹，你真正的目的，是趁着今天的恐慌，借‘合规救援’的名义，通过物理端口把我们真正的核心引擎抽走！”

**苏晚**（脸色剧变，猛然转向张恺，手里的笔几乎被折断）：
“张恺！昨晚那份所谓的勒索线索……是你故意通过匿名信箱放给我的？！你拿我当枪使，让我帮你逼垮林锐、给你的沙盒争取接入时间？！”`
      },
      {
        phaseId: 4,
        title: '阶段四：残局决胜与因果闭环',
        targetDuration: '1.0 - 1.5 min',
        targetWordsRange: '300 - 400 字',
        targetRatio: 0.12,
        content: `**张恺**（脸色惨白如纸，拼命挣扎想要挣脱林锐的手，语无伦次）：
“血口喷人！这是技术故障！陆董，您别听他胡编，这是林锐在转移视线！”

**陆远**（从容不迫地端起茶杯，轻轻吹了吹热气，眼神冰冷彻骨）：
“张恺，你以为天玑的大股东真的只懂看财务报表吗？暗网‘九头蛇’发起拍卖的保证金钱包，注册在开曼群岛的一家空壳基金名下。而在十分钟前，瑞士安保银行已经向我证实——那家基金的最终受益人，正是你张恺的亲妹妹。公安经侦和网警支队的同志，已经在楼下电梯里了。”

**林锐**（松开张恺的手，后退一步，向陆远躬身致歉，完成所有动机与责任闭环）：
“陆董，我隐瞒家人被勒索、擅自设置蜜罐涉险，违反了最高安全条例，我自愿接受降职并扣除全年期权。张恺的 2 号后门已被反向溯源固定为法庭铁证。暗网倒计时归零，天玑的核心代码——一行也没有丢。”
（大屏幕上倒计时清零，警报红灯熄灭，绿色的‘SYSTEM SECURE’锁链在屏幕中央傲然合拢。）`
      }
    ]
  }
];
