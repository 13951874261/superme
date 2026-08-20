import yaml, json
import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('materail_generate_url_enhanced (5).yml', 'r', encoding='utf-8') as f:
    data = yaml.safe_load(f)

print("=== DETAILED NODE INSPECTION ===\n")

nodes = data["workflow"]["graph"]["nodes"]
edges = data["workflow"]["graph"]["edges"]

# Check all variable references in prompts
import re
var_ref_pattern = re.compile(r'\{\{#([^#}]+)#\}\}')

for node in nodes:
    nid = node["id"]
    ntype = node["data"].get("type", "")
    
    # Check prompt templates
    prompt = node["data"].get("prompt_template", [])
    if isinstance(prompt, list):
        for msg in prompt:
            text = msg.get("text", "")
            refs = var_ref_pattern.findall(text)
            if refs:
                for ref in refs:
                    parts = ref.split(".")
                    if len(parts) >= 2:
                        node_id = parts[0]
                        var_name = parts[1]
                        # Check if node exists
                        found = any(n["id"] == node_id for n in nodes)
                        if not found:
                            print(f"ERROR in {nid} ({ntype}): Reference to non-existent node {node_id} in {ref}")
    
    # Check code node variables
    if ntype == "code":
        variables = node["data"].get("variables", [])
        for var in variables:
            selector = var.get("value_selector", [])
            if len(selector) >= 1:
                node_id = selector[0]
                found = any(n["id"] == node_id for n in nodes)
                if not found:
                    print(f"ERROR in {nid}: Variable references non-existent node {node_id}")
    
    # Check assigner items
    if ntype == "assigner":
        items = node["data"].get("items", [])
        for item in items:
            var_sel = item.get("variable_selector", [])
            if var_sel:
                node_id = var_sel[0] if isinstance(var_sel, list) else var_sel
                if isinstance(node_id, str):
                    found = any(n["id"] == node_id for n in nodes)
                    if not found:
                        print(f"ERROR in {nid}: Assigner references non-existent node {node_id}")
    
    # Check parameter extractor
    if ntype == "parameter-extractor":
        query = node["data"].get("query", [])
        if query:
            node_id = query[0] if isinstance(query, list) else query
            if isinstance(node_id, str):
                found = any(n["id"] == node_id for n in nodes)
                if not found:
                    print(f"ERROR in {nid}: Parameter extractor references non-existent node {node_id}")

print("=== VARIABLE REFERENCE CHECK COMPLETE ===\n")

# Check edge connections
print("=== EDGE CONNECTION CHECK ===")
for e in edges:
    src = e["source"]
    tgt = e["target"]
    print(f"  {src} -> {tgt}")

print()

# Check iteration inner nodes
print("=== ITERATION INNER NODES ===")
iter_nodes = [n for n in nodes if n["data"].get("type") == "iteration"]
for it in iter_nodes:
    start_id = it["data"].get("start_node_id")
    output_sel = it["data"].get("output_selector")
    
    # Find all nodes inside this iteration
    inner_nodes = [n for n in nodes if n.get("parentId") == it["id"]]
    print(f"  Iteration {it['id']}:")
    print(f"    Start: {start_id}")
    print(f"    Output: {output_sel}")
    print(f"    Inner nodes: {[n['id'] for n in inner_nodes]}")
    
    # Check edges inside iteration
    inner_edges = [e for e in edges if e["data"].get("isInIteration") == True]
    print(f"    Inner edges: {[(e['source'], e['target']) for e in inner_edges]}")

print()

# Check if all required fields are present
print("=== REQUIRED FIELDS CHECK ===")
for node in nodes:
    nid = node["id"]
    ntype = node["data"].get("type", "")
    
    # Check id
    if "id" not in node:
        print(f"ERROR {nid}: Missing 'id' field")
    
    # Check data
    if "data" not in node:
        print(f"ERROR {nid}: Missing 'data' field")
    else:
        if "type" not in node["data"]:
            print(f"ERROR {nid}: Missing 'type' in data")
        
        # Check position
        if "position" not in node:
            print(f"WARNING {nid}: Missing 'position' field")
        
        # Check specific node types
        if ntype == "start":
            if "variables" not in node["data"]:
                print(f"ERROR {nid}: Start node missing 'variables'")
        
        if ntype == "llm":
            if "model" not in node["data"]:
                print(f"ERROR {nid}: LLM node missing 'model'")
            if "prompt_template" not in node["data"]:
                print(f"ERROR {nid}: LLM node missing 'prompt_template'")
        
        if ntype == "iteration":
            if "iterator_selector" not in node["data"]:
                print(f"ERROR {nid}: Iteration missing 'iterator_selector'")
            if "start_node_id" not in node["data"]:
                print(f"ERROR {nid}: Iteration missing 'start_node_id'")

print("\n=== VALIDATION COMPLETE ===")
