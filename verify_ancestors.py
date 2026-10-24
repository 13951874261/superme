import yaml, re
from collections import defaultdict

with open('materail_generate_url_enhanced (5).yml', 'r', encoding='utf-8') as f:
    data = yaml.safe_load(f)

nodes = data["workflow"]["graph"]["nodes"]
edges = data["workflow"]["graph"]["edges"]

node_map = {n["id"]: n for n in nodes}

# Build graph adjacency list to find reachable nodes (ancestors)
adj = defaultdict(list)
for e in edges:
    adj[e["target"]].append(e["source"])

# For iteration nodes, we need to know what nodes are inside and how they execute
# Nodes inside iteration can access variables of nodes executing before the iteration, 
# and iteration-start variables (e.g. iterator item).
# Nodes outside iteration CANNOT directly access variables inside the iteration, 
# except via the iteration node's output.

# Find ancestors of a node
def get_ancestors(node_id, visited=None):
    if visited is None:
        visited = set()
    ancestors = set()
    # If the node has a parentId, it is inside an iteration.
    # It can access nodes outside the iteration that executed before the iteration node.
    node = node_map.get(node_id)
    if node and node.get("parentId"):
        parent_id = node["parentId"]
        ancestors.add(parent_id)
        # Also add iteration-start
        iter_node = node_map.get(parent_id)
        if iter_node:
            start_id = iter_node["data"].get("start_node_id")
            if start_id:
                ancestors.add(start_id)
        ancestors.update(get_ancestors(parent_id, visited))
        
    for parent in adj[node_id]:
        if parent not in visited:
            visited.add(parent)
            ancestors.add(parent)
            ancestors.update(get_ancestors(parent, visited))
    return ancestors

print("=== Ancestor Verification ===")
for node in nodes:
    nid = node["id"]
    ntype = node["data"].get("type")
    
    # Get all ancestors
    ancestors = get_ancestors(nid)
    
    # Find all references in node content
    node_str = yaml.dump(node, allow_unicode=True)
    refs = re.findall(r'\{\{#[^}]+#\}\}', node_str)
    
    if refs:
        print(f"Node {nid} ({ntype}):")
        for ref in sorted(set(refs)):
            parts = ref.strip("{}#").split(".")
            ref_node_id = parts[0]
            if ref_node_id in ["conversation", "sys"]:
                print(f"  {ref} -> OK (System/Conversation variable)")
            elif ref_node_id == nid:
                print(f"  {ref} -> OK (Self reference)")
            elif ref_node_id in ancestors:
                print(f"  {ref} -> OK (Ancestor node)")
            else:
                print(f"  ERROR: {ref} is NOT an ancestor!")
                
    # Also check explicitly configured selectors (e.g. inputs, variables)
    if ntype == "code":
        variables = node["data"].get("variables", [])
        for var in variables:
            selector = var.get("value_selector", [])
            if selector:
                ref_node_id = selector[0]
                if ref_node_id not in ["conversation", "sys"] and ref_node_id not in ancestors:
                    print(f"  ERROR in code selector: {selector} is NOT an ancestor!")
                    
    if ntype == "template-transform":
        variables = node["data"].get("variables", [])
        for var in variables:
            selector = var.get("value_selector", [])
            if selector:
                ref_node_id = selector[0]
                if ref_node_id not in ["conversation", "sys"] and ref_node_id not in ancestors:
                    print(f"  ERROR in template selector: {selector} is NOT an ancestor!")

print("\n=== Validation Finished ===")
