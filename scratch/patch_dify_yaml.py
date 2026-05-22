import sys
from pathlib import Path
from ruamel.yaml import YAML

yaml = YAML()
yaml.preserve_quotes = True
yaml.indent(mapping=2, sequence=2, offset=0)

files_to_patch = [
    r"d:\cursor\work\super-agent\yml\English_Writing_Review.yml",
    r"d:\cursor\work\super-agent\yml\English_Sentence_Evaluation.yml",
    r"d:\cursor\work\super-agent\yml\English_Word_Enricher.yml",
    r"d:\cursor\work\super-agent\yml\Listening_Comparison_Engine (1).yml"
]

prompt_injections = {
    "English_Writing_Review.yml": "\n\n【系统隐性约束】：当前用户的谈判阵地是【{{#START_ID#.theme#}}】。请在批阅其战略站位（L3_Strategic_Position）时，严格根据该阵地的特有文化与核心冲突来评判其权力分寸是否得当。",
    "English_Sentence_Evaluation.yml": "\n\n【系统隐性约束】：请判定用户造句的得体性。注意！当前的实战场景为【{{#START_ID#.theme#}}】。如果造句语法正确，但在该场景下显得过于冒犯或过于软弱，请判定为不合格，并在 feedback 中给出符合该场景的商务建议。",
    "English_Word_Enricher.yml": "\n\n【系统隐性约束】：请结合【{{#START_ID#.theme#}}】这一特定场景，为用户提取单词释义。特别是在生成 business_note 时，必须给出该词在【{{#START_ID#.theme#}}】中的地道用法和潜在陷阱。",
    "Listening_Comparison_Engine (1).yml": "\n\n【系统隐性约束】：请结合背景大环境【{{#START_ID#.theme#}}】，深度剖析对话双方的 hidden_subtext (潜台词) 与 power_dynamics (权力动态)。不要做泛泛而谈，必须与该背景下的利益冲突强绑定。"
}

theme_var = {
    'default': '',
    'hint': '',
    'label': '阵地主题(theme)',
    'max_length': 256,
    'options': [],
    'placeholder': '',
    'required': True,
    'type': 'text-input',
    'variable': 'theme'
}

for fp in files_to_patch:
    p = Path(fp)
    if not p.exists():
        print(f"File not found: {p}")
        continue
    
    with open(p, 'r', encoding='utf-8') as f:
        data = yaml.load(f)
        
    start_id = None
    
    # 1. 查找 start 节点并注入 theme 变量
    if 'workflow' in data and 'graph' in data['workflow'] and 'nodes' in data['workflow']['graph']:
        for node in data['workflow']['graph']['nodes']:
            if node.get('data', {}).get('type') == 'start':
                start_id = node.get('id')
                variables = node['data'].get('variables', [])
                # 检查是否已经存在 theme
                if not any(v.get('variable') == 'theme' for v in variables):
                    variables.append(theme_var)
                    print(f"[{p.name}] 注入了 theme 变量到 start 节点 (ID: {start_id})")
                else:
                    print(f"[{p.name}] theme 变量已存在于 start 节点")
                break
    
    if not start_id:
        print(f"[{p.name}] 无法找到 start 节点！")
        continue

    # 2. 查找 llm 节点并注入 prompt
    injection_text = prompt_injections.get(p.name, "").replace("#START_ID#", start_id)
    if not injection_text:
        continue
        
    for node in data['workflow']['graph']['nodes']:
        if node.get('data', {}).get('type') == 'llm':
            templates = node['data'].get('prompt_template', [])
            for tpl in templates:
                if tpl.get('role') == 'system':
                    if "【系统隐性约束】" not in tpl['text']:
                        tpl['text'] += injection_text
                        print(f"[{p.name}] 成功在 LLM 节点 (ID: {node.get('id')}) 注入了实战提示词")
                    else:
                        print(f"[{p.name}] LLM 节点已包含实战提示词，跳过注入")

    with open(p, 'w', encoding='utf-8') as f:
        yaml.dump(data, f)
    print(f"[{p.name}] 处理完成。\n")
