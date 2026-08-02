import yaml, json
import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('materail_generate_url_enhanced (5).yml', 'r', encoding='utf-8') as f:
    data = yaml.safe_load(f)

edges = data["workflow"]["graph"]["edges"]
nodes = data["workflow"]["graph"]["nodes"]

# Check iteration node config
iter_node = next((n for n in nodes if n['id'] == '1780396184720'), None)
if iter_node:
    print("=== Iteration Node ===")
    print(json.dumps(iter_node['data'], indent=2, ensure_ascii=False))

print("\n=== All Edges ===")
for e in edges:
    print(f"  {e['source']} -> {e['target']}")

# Check if iteration has edge to its start node
iter_id = '1780396184720'
iter_start_id = iter_node['data'].get('start_node_id') if iter_node else None
print(f"\nIteration start_node_id: {iter_start_id}")

# Check edges connected to iteration
iter_in_edges = [e for e in edges if e['target'] == iter_id]
iter_out_edges = [e for e in edges if e['source'] == iter_id]
print(f"Edges INTO iteration: {[e['source'] for e in iter_in_edges]}")
print(f"Edges FROM iteration: {[e['target'] for e in iter_out_edges]}")

# Check edges connected to iteration-start
if iter_start_id:
    start_in_edges = [e for e in edges if e['target'] == iter_start_id]
    start_out_edges = [e for e in edges if e['source'] == iter_start_id]
    print(f"Edges INTO iteration-start: {[e['source'] for e in start_in_edges]}")
    print(f"Edges FROM iteration-start: {[e['target'] for e in start_out_edges]}")

# Check LLM model configs
print("\n=== LLM Model Configs ===")
for node in nodes:
    if node['data'].get('type') == 'llm':
        model = node['data'].get('model', {})
        print(f"Node {node['id']}: model = {json.dumps(model, ensure_ascii=False)}")

# Check knowledge retrieval config
print("\n=== Knowledge Retrieval Config ===")
kr_node = next((n for n in nodes if n['data'].get('type') == 'knowledge-retrieval'), None)
if kr_node:
    print(json.dumps(kr_node['data'], indent=2, ensure_ascii=False))

# Check if conversation variables exist
print("\n=== Conversation Variables ===")
for var in data['workflow'].get('conversation_variables', []):
    print(f"  {var['name']} (id={var['id']})")

