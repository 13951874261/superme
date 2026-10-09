import type { InsightMindMapNode } from './insightMindMapBuilder';

export interface TheoryPoint {
  title: string;
  explanation: string;
  example: string;
}

export interface TheoryItemNode {
  title: string;
  concept: string;
  framework: string[];
  points: string[];
  structuredPoints?: TheoryPoint[];
}

export const DEFAULT_THEORY_DATA: Record<string, TheoryItemNode[]> = {
  '逻辑学与系统谬误': [
    {
      title: '非形式逻辑谬误',
      concept: '在论证过程中，论据与论题之间没有逻辑必然性，而通过修辞或情绪手段使人信服。',
      framework: ['滑坡谬误', '以偏概全', '诉诸权威', '偷换概念'],
      points: [
        '滑坡谬误：无限放大某种可能后果，形成恐吓。例如：“你今天迟到，明天就会旷工，最后就会被开除。”',
        '以偏概全：用个别甚至极端的特例推导普遍规律。例如：“我认识的一个名校毕业生不会写公文，说明名校教育毫无意义。”',
        '诉诸权威：利用某个领域的名气来证明另一个领域的正确性。例如：“某著名物理学家说这个商业模式必定成功。”',
        '偷换概念：在讨论中悄悄改变某个词语的内涵。例如：“把工作中的‘认真负责’偷偷偷换为‘必须无偿加班’。”'
      ],
      structuredPoints: [
        {
          title: '滑坡谬误',
          explanation: '无限放大某种微小动作的后续可能后果，制造非理性的恐惧或压迫感。',
          example: '“你今天在周会上迟到5分钟，明天就会在客户汇报中掉链子，最后整个项目都会被你搞砸。”'
        },
        {
          title: '以偏概全',
          explanation: '用极少数样本或个别偶发案例，强行概括为普遍必然规律。',
          example: '“我认识的一个名校高材生连公文格式都不会调，说明名牌大学毕业生根本没有实战能力。”'
        },
        {
          title: '诉诸权威',
          explanation: '脱离专业领域，借用名气、职位或权威光环压制异见。',
          example: '“某跨国技术总监都夸赞过这个方向，你们怎么能质疑这个方案的合理性？”'
        },
        {
          title: '偷换概念',
          explanation: '在沟通推进过程中，悄悄转移或替换核心词汇的实际外延与内涵。',
          example: '“管理层要求大家‘全力以赴’，你怎么能准时下班？你这是缺乏职业素养。”（将“尽职尽责”偷换为“强制加班”）'
        }
      ]
    },
    {
      title: '因果关系误区',
      concept: '混淆相关性与因果性，或者将时间上的先后关系强行解释为因果关系。',
      framework: ['后此谬误', '单因谬误', '因果倒置'],
      points: [
        '后此谬误：因为 B 发生在 A 之后，就判定 A 导致了 B。例如：“新领导上任后业绩下滑，就是新领导的责任。”',
        '单因谬误：复杂问题简单化，只归结于单一因素。例如：“项目失败完全是因为宣传没做好。”',
        '因果倒置：把结果当成原因，倒果为因。例如：“员工士气高涨是因为公司业绩好，而不是员工士气导致了业绩。”'
      ],
      structuredPoints: [
        {
          title: '后此谬误',
          explanation: '仅仅因为事件B发生在事件A之后，就断定A是B发生的原因。',
          example: '“新主管刚接手部门当月利润就下滑了3%，说明他的管理能力完全不行。”（忽略了市场淡季因素）'
        },
        {
          title: '单因谬误',
          explanation: '将多重复杂因素共同作用的结果，轻率归咎于单一可控或不可控因素。',
          example: '“这次竞标失败，完全是因为前端演示时PPT格式错位了一页。”'
        },
        {
          title: '因果倒置',
          explanation: '颠倒因果发展次序，把伴生结果或后果误当作初始原因。',
          example: '“优秀的团队总是氛围轻松，所以只要我们天天团建放松，业务就能自然增长。”'
        }
      ]
    }
  ],
  '人性分析与心理侧写': [
    {
      title: '弦外之音解码机制',
      concept: '理解人际沟通中隐藏在表层话术之下的真实利益诉求、层级防卫或情绪宣泄。',
      framework: ['利益驱动判定', '阶层安全防卫', '同僚压力构建'],
      points: [
        '体制内话术：委婉、注重层级、避免直接冲突，常用“以退为进”或“虚指”敲打。例如：“这件事原则上没有问题，但还要看领导班子怎么统筹。”',
        '跨国企业话术：表面平等、重效率指标，常用高大上的行业术语（Jargon）进行自我防卫或施压。例如：“我们需要先align一下ROI和OKR对齐度。”'
      ],
      structuredPoints: [
        {
          title: '体制内以退为进与虚指',
          explanation: '使用看似赞同、支持的客套措辞，在转折后提出实质性前提条件或阻断诉求。',
          example: '“小李的想法很有创新意识，原则上支持，不过具体落实前建议先报分管领导通盘审定。”（实为委婉否决）'
        },
        {
          title: '跨国企业术语防卫与施压',
          explanation: '用抽象专业词汇构建专业壁垒，掩盖进度拖延或向协作方转嫁责任风险。',
          example: '“对于当前进度延迟我们深表同理，但我们需要确保核心接口完成全链路SOP闭环后再启动下阶段。”（实为推迟交付）'
        },
        {
          title: '同僚压力与道德绑架',
          explanation: '通过拔高集体利益或过往付出，迫使对方在利益分配或责任划分上做出让步。',
          example: '“大家都为了这个大局拼了半个月，如果你们组在这个节点坚持按合同流程走，大家的心血就全白费了。”'
        }
      ]
    },
    {
      title: '非语言信号暗示',
      concept: '肢体语言、面部表情、眼神方向、语速及停顿等生理与动作反馈。',
      framework: ['微表情检测', '肢体紧张度', '音调与停顿映射'],
      points: [
        '食指轻敲桌面：通常暗示潜在的控制欲、焦躁或内心催促。',
        '眼神偏离与斜瞟：可能在临时寻找托词，或暗示对当前对比物的不屑。',
        '语速突然变慢且加重：表明正在进行高度蓄意的“表演式情绪施压”。'
      ],
      structuredPoints: [
        {
          title: '节奏与动作微暗示',
          explanation: '手指敲击桌面、频繁调整坐姿或整理袖口，常反映被动防御或隐秘焦躁。',
          example: '在听取汇报时食指有节奏地快速敲击桌面，表明对方注意力已转移到催促进度或内心产生质疑。'
        },
        {
          title: '视线与微表情反馈',
          explanation: '瞬间斜瞟、挑眉或视线快速扫过门口，折射出真实顾虑或不屑意图。',
          example: '在提到某项方案预算时对方视线瞬间右上移并微抿嘴唇，表明其正在大脑中构思推脱借口。'
        },
        {
          title: '音调变频与停顿施压',
          explanation: '刻意拉长词间停顿、语速骤降并加重尾音，为下属或谈判对手营造窒息式心理压迫。',
          example: '“方案……我看过了。但你确定……这就是你们组拿出的最高水准？”（通过停顿与冷淡反问制造压迫感）'
        }
      ]
    }
  ]
};

function parsePointText(raw: string): TheoryPoint {
  const colonIdx = raw.indexOf('：');
  const fallbackColon = colonIdx === -1 ? raw.indexOf(':') : colonIdx;
  if (fallbackColon !== -1) {
    const title = raw.slice(0, fallbackColon).trim();
    const rest = raw.slice(fallbackColon + 1).trim();
    const exampleMatch = rest.match(/例如[：:](.*)$/);
    if (exampleMatch) {
      const explanation = rest.slice(0, exampleMatch.index).trim();
      const example = exampleMatch[1].trim();
      return {
        title,
        explanation: explanation || title,
        example: example || '暂无具体例句',
      };
    }
    return {
      title,
      explanation: rest,
      example: '暂无具体例句',
    };
  }
  return {
    title: raw.slice(0, 16),
    explanation: raw,
    example: '暂无具体例句',
  };
}

/**
 * 将静态理论数据转换为 InsightMindMapNode 树形结构
 */
export function buildStaticTheoryTree(
  theoryData: Record<string, TheoryItemNode[]> = DEFAULT_THEORY_DATA
): InsightMindMapNode {
  const categoryNodes: InsightMindMapNode[] = [];

  for (const [category, items] of Object.entries(theoryData)) {
    const itemNodes: InsightMindMapNode[] = items.map((item) => {
      const pointLeaves: InsightMindMapNode[] = [];

      if (item.structuredPoints && item.structuredPoints.length > 0) {
        for (const sp of item.structuredPoints) {
          pointLeaves.push({
            name: sp.title,
            detail: `【概念要点】${sp.explanation}\n【场景举例】${sp.example}`,
          });
        }
      } else {
        for (const p of item.points) {
          const parsed = parsePointText(p);
          pointLeaves.push({
            name: parsed.title,
            detail: `【概念要点】${parsed.explanation}\n【场景举例】${parsed.example}`,
          });
        }
      }

      return {
        name: item.title,
        detail: `【概念解读】${item.concept}\n【框架构成】${item.framework.join('、')}`,
        children: pointLeaves,
      };
    });

    categoryNodes.push({
      name: category,
      detail: `共包含 ${items.length} 个核心理论模块`,
      children: itemNodes,
    });
  }

  return {
    name: '洞察理论框架',
    detail: '逻辑学、系统谬误与人性心理侧写体系',
    children: categoryNodes,
  };
}

export interface MaterialDraftLike {
  title?: string;
  summary?: string;
  tags?: string[];
  category?: string;
  source_type?: string;
  excerpt?: string;
  points?: Array<{ title?: string; explanation?: string; example?: string } | string>;
  knowledgePoints?: Array<{ title?: string; explanation?: string; example?: string }>;
  [key: string]: unknown;
}

/**
 * 将素材上传结果/草稿转换为思维导图分支
 */
export function adaptMaterialDraftToMindMapNode(
  draft: MaterialDraftLike | null | undefined,
  fallbackTitle?: string
): InsightMindMapNode {
  const rawTitle = (draft?.title || fallbackTitle || '已导入素材').trim();
  const cleanTitle = rawTitle.replace(/\.[^.]+$/, '').slice(0, 30);
  const summary = (draft?.summary || draft?.excerpt || '').trim();
  const tags = Array.isArray(draft?.tags) ? draft.tags.map(String) : [];

  const children: InsightMindMapNode[] = [];

  const knowledgePoints = draft?.knowledgePoints || draft?.points;
  if (Array.isArray(knowledgePoints) && knowledgePoints.length > 0) {
    for (const kp of knowledgePoints) {
      if (typeof kp === 'string') {
        const parsed = parsePointText(kp);
        children.push({
          name: parsed.title,
          detail: `【要点阐述】${parsed.explanation}\n【场景举例】${parsed.example}`,
        });
      } else if (kp && typeof kp === 'object') {
        const title = (kp.title || '核心知识点').slice(0, 20);
        const explanation = kp.explanation || summary || '无详细阐述';
        const example = kp.example || '可前往「资料管理中心」补充例证。';
        children.push({
          name: title,
          detail: `【要点阐述】${explanation}\n【场景举例】${example}`,
        });
      }
    }
  }

  // 若没有结构化知识点列表，利用 summary 与 tags 提炼出叶节点
  if (children.length === 0) {
    if (summary) {
      // 若有多段或多句，拆分要点
      const sentences = summary
        .split(/[。\n；;]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 4);

      if (sentences.length > 1) {
        sentences.slice(0, 4).forEach((sent, idx) => {
          children.push({
            name: tags[idx] || `核心要点 ${idx + 1}`,
            detail: `【要点阐述】${sent}\n【场景举例】可结合实际对话进行博弈解码。`,
          });
        });
      } else {
        children.push({
          name: tags[0] || '核心知识点',
          detail: `【要点提炼】${summary}\n【场景举例】可前往「资料管理中心」手动补充更多例证与侧写案例。`,
        });
      }
    } else {
      children.push({
        name: '待提炼知识点',
        detail: '【说明】当前素材尚未提取出结构化要点，请前往资料管理中心手动录入。',
      });
    }
  }

  const tagsInfo = tags.length > 0 ? `\n【关联标签】${tags.join('、')}` : '';

  return {
    name: `素材衍生：${cleanTitle}`,
    detail: `【素材摘要】${summary || '暂无摘要'}${tagsInfo}`,
    children,
  };
}

/**
 * 构建完整的洞察(听) 理论框架与素材合集导图树（M1 合集模式）
 */
export function buildUnifiedTheoryMindMapTree(options?: {
  staticData?: Record<string, TheoryItemNode[]>;
  materialDrafts?: Array<MaterialDraftLike | InsightMindMapNode>;
}): InsightMindMapNode {
  const staticRoot = buildStaticTheoryTree(options?.staticData);
  const materialDrafts = options?.materialDrafts || [];

  if (materialDrafts.length === 0) {
    return staticRoot;
  }

  const materialNodes: InsightMindMapNode[] = [];
  for (const m of materialDrafts) {
    if (m && typeof m === 'object') {
      if ('children' in m && 'name' in m && Array.isArray((m as InsightMindMapNode).children)) {
        materialNodes.push(m as InsightMindMapNode);
      } else {
        materialNodes.push(adaptMaterialDraftToMindMapNode(m as MaterialDraftLike));
      }
    }
  }

  const combinedChildren: InsightMindMapNode[] = [
    ...(staticRoot.children || []),
    ...materialNodes,
  ];

  return {
    name: '听读 理论框架体系',
    detail: `包含 ${staticRoot.children?.length || 0} 个经典理论大类及 ${materialNodes.length} 份素材衍生体系`,
    children: combinedChildren,
  };
}
