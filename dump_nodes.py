import yaml, json
import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('materail_generate_url_enhanced (5).yml', 'r', encoding='utf-8') as f:
    data = yaml.safe_load(f)

nodes = data["workflow"]["graph"]["nodes"]
edges = data["workflow"]["graph"]["edges"]

# Check all nodes in edges exist
all_node_ids = set(n['id'] for n in nodes)
edge_targets = set(e['target'] for e in edges)
edge_sources = set(e['source'] for e in edges)
missing_targets = edge_targets - all_node_ids
missing_sources = edge_sources - all_node_ids
print(f"Missing targets: {missing_targets}")
print(f"Missing sources: {missing_sources}")
print()

for node in nodes:
    nid = node['id']
    ntype = node['data'].get('type')
    print(f"\n=== Node {nid} ({ntype}) ===")
    if ntype == 'assigner':
        print("Items:", json.dumps(node['data'].get('items', []), indent=2, ensure_ascii=False))
    elif ntype == 'knowledge-retrieval':
        print("Dataset IDs:", node['data'].get('dataset_ids'))
        print("Retrieval mode:", node['data'].get('retrieval_mode'))
        print("Query selector:", node['data'].get('query_variable_selector'))
    elif ntype == 'code':
        print("Code language:", node['data'].get('code_language'))
        print("Code (first 800):", str(node['data'].get('code', ''))[:800])
        print("Outputs:", node['data'].get('outputs'))
    elif ntype == 'iteration':
        print("Iterator selector:", node['data'].get('iterator_selector'))
        print("Output selector:", node['data'].get('output_selector'))
        print("Start node ID:", node['data'].get('start_node_id'))
        print("Parallel nums:", node['data'].get('parallel_nums'))
    elif ntype == 'parameter-extractor':
        print("Query:", node['data'].get('query'))
        print("Parameters:", node['data'].get('parameters'))
        instr = node['data'].get('instruction', '')
        print(f"Instruction ({len(instr)} chars):", instr[:300])
    elif ntype == 'llm':
        model = node['data'].get('model', {})
        model_name = model.get('name') if isinstance(model, dict) else str(model)
        print("Model:", model_name)
        print("Context:", node['data'].get('context'))
        prompt = node['data'].get('prompt_template', '')
        print(f"Prompt ({len(prompt)} chars):", prompt[:400])
    elif ntype == 'template-transform':
        tmpl = node['data'].get('template', '')
        print(f"Template ({len(tmpl)} chars):", tmpl[:400])
        print("Variables:", node['data'].get('variables'))
    elif ntype == 'answer':
        ans = node['data'].get('answer', '')
        print(f"Answer ({len(ans)} chars):", ans[:400])
