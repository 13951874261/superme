const DEFAULT_TACTICS = [
  { id: 't1', name: '恩威并施', category: 'downward', description: '适时给予下属利益和资源，同时维持考核或问责的压力，使其产生敬畏之心。' },
  { id: 't2', name: '制衡术', category: 'downward', description: '在两个或多个下属或部门之间制造合理的良性竞争或权利对抗，以防出现权力合谋或一方独大。' },
  { id: 't3', name: '分而治之', category: 'downward', description: '隔离下属的信息沟通，打破其暗中建立的利益小同盟，分别进行管理和谈话。' },
  { id: 't4', name: '边缘化', category: 'downward', description: '通过调整业务线、分管责任，收回核心资源，将不服从者逐步架空移出核心决策圈。' },
  { id: 't5', name: '借势上位', category: 'upward', description: '拉拢或利用外部更高层或总部总裁级的大人物（或风口机制），借用上层意志对直接主管施加无形制衡。' },
  { id: 't6', name: '构建联盟', category: 'upward', description: '暗中横向联络其他被边缘化或受压迫的核心人员，组建信息互通与战术呼应的攻守同盟。' },
  { id: 't7', name: '信息垄断', category: 'upward', description: '掌控唯一的关键业务细节、核心供应链关系或底层代码，使自己成为团队中无可替代的存在。' },
  { id: 't8', name: '软对抗', category: 'upward', description: '不直接顶撞，而是通过效率降低、合规核查、汇报拖延等无破绽的制度化行为消极回复。' },
  { id: 't9', name: '架空', category: 'downward', description: '保留对方面子和职位，收回编制、预算、议程和签字权，使其无法进入核心决策。信号：会议改成“征求意见”、文件不再会签。反制：在上级程序里把职责写死，留下交接痕迹。' },
  { id: 't10', name: '捧杀', category: 'downward', description: '公开高调表扬并把人推到不可完成的指标或聚光灯位置，失败后名正言顺追责。信号：突然委以“一把手工程”却不给资源。反制：书面确认资源、时限和成败标准再接。' },
  { id: 't11', name: '借刀杀人', category: 'downward', description: '自己不现身，让审计、董事会、客户或平行部门当刀，完成清理或夺权。信号：举报、合规函、突然进场的第三方调查。反制：把调查范围和材料清单锁在书面程序内。' },
  { id: 't12', name: '隔山打牛', category: 'upward', description: '不直接打主线，先打相邻条线的预算、合规或人事节点，逼主线就范。信号：你的项目没动，友邻处室先被卡章。反制：识别真正的痛点部门，补齐其程序与证据链。' }
];

function seedGameTheoryTactics(db) {
  if (!db || typeof db.prepare !== 'function') return;
  const listed = db.prepare('SELECT name FROM game_theory_tactics WHERE user_id = ?').all('system') || [];
  const existing = new Set(listed.map((row) => row && row.name).filter(Boolean));
  const insert = db.prepare(
    'INSERT INTO game_theory_tactics (id, user_id, name, category, description, is_custom, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const tactic of DEFAULT_TACTICS) {
    if (existing.has(tactic.name)) continue;
    insert.run(tactic.id, 'system', tactic.name, tactic.category, tactic.description, 0, Date.now());
    existing.add(tactic.name);
  }
}

module.exports = { seedGameTheoryTactics, DEFAULT_TACTICS };
