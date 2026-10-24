import yaml, json
import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('materail_generate_url_enhanced (5).yml', 'r', encoding='utf-8') as f:
    data = yaml.safe_load(f)

print("=== DIFY WORKFLOW VALIDATION REPORT ===\n")
print(f"Version: {data.get('version')}")
print(f"Kind: {data.get('kind')}")
print()

# Validate graph structure
graph = data.get("workflow", {}).get("graph", {})
nodes = graph.get("nodes", [])
edges = graph.get("edges", [])

print(f"Nodes: {len(nodes)}")
print(f"Edges: {len(edges)}")
print()

# Check all edges reference valid nodes
node_ids = set(n["id"] for n in nodes)
print("=== Edge Validation ===")
all_valid = True
for e in edges:
    src, tgt = e["source"], e["target"]
    if src not in node_ids:
        print(f"  ERROR: Source node {src} not found")
        all_valid = False
    if tgt not in node_ids:
        print(f"  ERROR: Target node {tgt} not found")
        all_valid = False
if all_valid:
    print("  All edges reference valid nodes ✓")
print()

# Check iteration structure
print("=== Iteration Node Validation ===")
iter_nodes = [n for n in nodes if n["data"].get("type") == "iteration"]
for it in iter_nodes:
    iid = it["id"]
    start_id = it["data"].get("start_node_id")
    output_sel = it["data"].get("output_selector")
    print(f"  Iteration {iid}")
    print(f"    Start node: {start_id}")
    print(f"    Output selector: {output_sel}")
    
    # Check if start node exists
    start_node = next((n for n in nodes if n["id"] == start_id), None)
    if start_node:
        print(f"    Start node exists ✓")
        # Check if start node has parentId set to iteration
        if start_node.get("parentId") == iid:
            print(f"    Start node parentId correct ✓")
        else:
            print(f"    ERROR: Start node parentId should be {iid}")
    else:
        print(f"    ERROR: Start node {start_id} not found")
    
    # Check output selector references valid node
    if output_sel:
        out_node_id = output_sel[0]
        out_var = output_sel[1]
        out_node = next((n for n in nodes if n["id"] == out_node_id), None)
        if out_node:
            print(f"    Output selector references valid node {out_node_id} ✓")
        else:
            print(f"    ERROR: Output selector references non-existent node {out_node_id}")
print()

# Check assigner node structure
print("=== Assigner Node Validation ===")
assigner_nodes = [n for n in nodes if n["data"].get("type") == "assigner"]
for asgn in assigner_nodes:
    data = asgn["data"]
    print(f"  Assigner {asgn['id']}")
    print(f"    Version: {data.get('version', '1')}")
    if data.get('version') == '2':
        if 'items' not in data:
            print(f"    ERROR: Version 2 requires 'items' field")
        else:
            print(f"    Items count: {len(data.get('items', []))}")
    else:
        # v1 format
        if 'operations' not in data and 'assigned_variable_selector' not in data:
            print(f"    WARNING: Missing operations or assigned_variable_selector")
print()

# Check answer node structure
print("=== Answer Node Validation ===")
answer_nodes = [n for n in nodes if n["data"].get("type") == "answer"]
for ans in answer_nodes:
    data = ans["data"]
    print(f"  Answer {ans['id']}")
    has_outputs = 'outputs' in data
    has_answer = 'answer' in data
    has_variables = 'variables' in data
    print(f"    Has outputs: {has_outputs}")
    print(f"    Has answer: {has_answer}")
    print(f"    Has variables: {has_variables}")
    if has_outputs and has_answer:
        print(f"    WARNING: Both outputs and answer present - may cause conflict")
print()

# Check knowledge retrieval
print("=== Knowledge Retrieval Validation ===")
kr_nodes = [n for n in nodes if n["data"].get("type") == "knowledge-retrieval"]
for kr in kr_nodes:
    data = kr["data"]
    print(f"  KR {kr['id']}")
    dataset_ids = data.get("dataset_ids", [])
    print(f"    Dataset IDs: {dataset_ids}")
    if not dataset_ids:
        print(f"    WARNING: No dataset IDs specified")
    else:
        print(f"    Dataset IDs present ✓")
print()

# Check LLM model references
print("=== LLM Model Validation ===")
llm_nodes = [n for n in nodes if n["data"].get("type") == "llm"]
for llm in llm_nodes:
    model = llm["data"].get("model", {})
    provider = model.get("provider", "")
    name = model.get("name", "")
    print(f"  LLM {llm['id']}")
    print(f"    Provider: {provider}")
    print(f"    Model name: {name}")
    if not provider or not name:
        print(f"    WARNING: Missing provider or model name")
print()

print("=== VALIDATION COMPLETE ===")
