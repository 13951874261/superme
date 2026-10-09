export type WriteVariant = 'zh' | 'en';

export type WriteGovernanceTaskType = 'document_correction' | 'business_writing' | 'value_proposal' | 'logic_optimization';

export type WriteModuleDef = {
  id: string;
  label: string;
  desc: string;
  placeholder: string;
  review: 'governance' | 'english';
  taskType?: WriteGovernanceTaskType;
};

export type WriteGovernanceLike = {
  taskType: WriteGovernanceTaskType;
  level_1?: string;
  level_2?: string;
  level_3?: string;
  tone_evaluation?: string;
  compressed_text?: string;
  skill_point?: string;
  admin_flaws?: string;
  value_extraction?: string;
  business_proposal?: string;
  pyramid_structure?: string;
  final_article?: string;
  structural_diagnosis?: string;
  actionable_takeaway?: string;
  rawJson?: string;
};

export const WRITE_MODULES_ZH: WriteModuleDef[] = [
  {
    id: 'gov_write',
    label: '体制内公文',
    desc: '政府汇报、部门公文、调研报告——文治三级批改',
    placeholder: '在此起草中文公文、汇报或调研报告草案…',
    review: 'governance',
    taskType: 'document_correction',
  },
  {
    id: 'biz_zh',
    label: '中文商务函',
    desc: '请示、协调函、对外函件——语气评估与压缩改写',
    placeholder: '在此起草中文商务函、请示或对外函件…',
    review: 'governance',
    taskType: 'business_writing',
  },
  {
    id: 'personal_brand',
    label: '履历价值提炼',
    desc: '把日常行政经历提炼成可迁移的商业价值提案',
    placeholder: '在此输入中文工作背景或项目履历…',
    review: 'governance',
    taskType: 'value_proposal',
  },
];

export const WRITE_MODULES_EN: WriteModuleDef[] = [
  {
    id: 'biz_proposal',
    label: '英文商务信函',
    desc: 'Executive email, cross-team alignment, and high-stakes proposals',
    placeholder: 'Draft your executive email or proposal in English…',
    review: 'english',
  },
  {
    id: 'limit_challenge',
    label: '英文篇幅训练',
    desc: 'Compress to 50/100/200 words or expand the argument',
    placeholder: 'Paste a long English paragraph to compress or expand…',
    review: 'english',
  },
  {
    id: 'essay_reflection',
    label: '英文思辨短文',
    desc: 'Workplace reflection with grammar, tone, and strategic position review',
    placeholder: 'Write a short English essay or reflection…',
    review: 'english',
  },
];

export function writeModulesFor(variant: WriteVariant): WriteModuleDef[] {
  return variant === 'zh' ? WRITE_MODULES_ZH : WRITE_MODULES_EN;
}

export function defaultWriteModuleId(variant: WriteVariant): string {
  return writeModulesFor(variant)[0].id;
}

function optimizedFromRawJson(rawJson?: string): string {
  if (!rawJson) return '';
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    return String(parsed.optimized_version || '');
  } catch {
    return '';
  }
}

export function mapGovernanceToReview(result: WriteGovernanceLike): {
  L1: string;
  L2: string;
  L3: string;
  optimized_version: string;
} {
  if (result.taskType === 'business_writing') {
    return {
      L1: String(result.tone_evaluation || ''),
      L2: String(result.skill_point || ''),
      L3: '',
      optimized_version: String(result.compressed_text || ''),
    };
  }
  if (result.taskType === 'value_proposal') {
    return {
      L1: String(result.admin_flaws || ''),
      L2: String(result.value_extraction || ''),
      L3: '',
      optimized_version: String(result.business_proposal || ''),
    };
  }
  return {
    L1: String(result.level_1 || ''),
    L2: String(result.level_2 || ''),
    L3: String(result.level_3 || ''),
    optimized_version: optimizedFromRawJson(result.rawJson),
  };
}
