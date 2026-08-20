import React, { useEffect, useMemo, useState } from "react";
import { getAppUserId } from "../../utils/profileHelper";

type GraphKind = "knowledge" | "module";
type GraphRel = "synced_to" | "used_by";

interface GraphNode {
  id: string;
  kind: GraphKind;
  refId: string;
  title: string;
  syncStatus?: string;
  type?: string;
}

interface GraphEdge {
  id: string;
  fromId: string;
  toId: string;
  rel: GraphRel;
}

const MODULE_ORDER = ["listen", "speak", "game_theory", "writing", "aesthetic"] as const;
const MODULE_LABEL: Record<string, string> = {
  listen: "听",
  speak: "说",
  game_theory: "博弈",
  writing: "写作",
  aesthetic: "审美",
};

export default function KnowledgeGraphPanel() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadGraph = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/knowledge-vault/graph?userId=${encodeURIComponent(getAppUserId())}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "图谱加载失败");
      setNodes(Array.isArray(data.nodes) ? data.nodes : []);
      setEdges(Array.isArray(data.edges) ? data.edges : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "图谱加载失败");
      setNodes([]);
      setEdges([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGraph();
    const onUpdated = () => { void loadGraph(); };
    window.addEventListener("knowledge-vault-updated", onUpdated);
    return () => window.removeEventListener("knowledge-vault-updated", onUpdated);
  }, []);

  const knowledgeNodes = useMemo(
    () => nodes.filter((node) => node.kind === "knowledge"),
    [nodes]
  );
  const moduleNodes = useMemo(() => {
    const byRef = new Map(nodes.filter((node) => node.kind === "module").map((node) => [node.refId, node]));
    return MODULE_ORDER.map((refId) => byRef.get(refId)).filter((node): node is GraphNode => !!node);
  }, [nodes]);

  const layout = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    knowledgeNodes.forEach((node, index) => {
      positions.set(node.id, { x: 28, y: 28 + index * 58 });
    });
    const knowledgeHeight = Math.max(knowledgeNodes.length * 58, 180);
    moduleNodes.forEach((node, index) => {
      const gap = knowledgeHeight / Math.max(moduleNodes.length, 1);
      positions.set(node.id, { x: 300, y: 28 + gap * index + 8 });
    });
    return {
      positions,
      width: 420,
      height: Math.max(knowledgeHeight + 24, 220),
    };
  }, [knowledgeNodes, moduleNodes]);

  if (loading) {
    return <div className="text-center py-8 text-zinc-500 text-xs">图谱加载中...</div>;
  }
  if (error) {
    return <div className="bg-red-900/50 border border-red-700 text-red-200 text-xs px-3 py-2 rounded-lg">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[#FF5722]">知识图谱</h3>
          <p className="text-[10px] text-zinc-500 mt-1">草稿节点可见但不连模块；确认同步后连到听 / 说 / 博弈；训练成功后出现「已使用」边。</p>
        </div>
        <button
          type="button"
          onClick={() => { void loadGraph(); }}
          className="text-[10px] font-black text-[#FF5722] hover:underline cursor-pointer shrink-0"
        >
          刷新
        </button>
      </div>
      <div className="flex flex-wrap gap-3 text-[10px] text-zinc-400">
        <span className="flex items-center gap-1"><span className="inline-block w-6 border-t border-emerald-400" /> 已同步</span>
        <span className="flex items-center gap-1"><span className="inline-block w-6 border-t border-dashed border-sky-400" /> 已使用</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full border border-dashed border-zinc-500" /> 草稿</span>
      </div>
      {knowledgeNodes.length === 0 ? (
        <p className="text-xs text-zinc-500 italic">暂无知识节点。先在四分页录入或上传草稿。</p>
      ) : (
        <div className="overflow-auto rounded-xl border border-zinc-800 bg-zinc-950/70">
          <svg width={layout.width} height={layout.height} role="img" aria-label="知识与听说博弈连线图谱">
            {edges.map((edge) => {
              const from = layout.positions.get(edge.fromId);
              const to = layout.positions.get(edge.toId);
              if (!from || !to) return null;
              const isUsed = edge.rel === "used_by";
              return (
                <line
                  key={edge.id}
                  x1={from.x + 96}
                  y1={from.y + 16}
                  x2={to.x}
                  y2={to.y + 16}
                  stroke={isUsed ? "#38bdf8" : "#34d399"}
                  strokeWidth={isUsed ? 1.25 : 1.75}
                  strokeDasharray={isUsed ? "4 3" : undefined}
                />
              );
            })}
            {knowledgeNodes.map((node) => {
              const pos = layout.positions.get(node.id);
              if (!pos) return null;
              const draft = node.syncStatus !== "synced";
              return (
                <g key={node.id}>
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={96}
                    height={32}
                    rx={8}
                    fill="#18181b"
                    stroke={draft ? "#71717a" : "#FF5722"}
                    strokeDasharray={draft ? "3 2" : undefined}
                  />
                  <text x={pos.x + 8} y={pos.y + 20} fill="#f4f4f5" fontSize="10">
                    {(node.title || "未命名").slice(0, 8)}
                  </text>
                </g>
              );
            })}
            {moduleNodes.map((node) => {
              const pos = layout.positions.get(node.id);
              if (!pos) return null;
              return (
                <g key={node.id}>
                  <rect x={pos.x} y={pos.y} width={72} height={32} rx={8} fill="#27272a" stroke="#a1a1aa" />
                  <text x={pos.x + 22} y={pos.y + 20} fill="#fafafa" fontSize="12">
                    {MODULE_LABEL[node.refId] || node.title}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
      <ul className="space-y-1 text-[10px] text-zinc-400">
        {knowledgeNodes.map((node) => {
          const linked = edges.filter((edge) => edge.fromId === node.id);
          const synced = linked.filter((edge) => edge.rel === "synced_to").map((edge) => MODULE_LABEL[edge.toId.split(":").pop() || ""] || edge.toId);
          const used = linked.filter((edge) => edge.rel === "used_by").map((edge) => MODULE_LABEL[edge.toId.split(":").pop() || ""] || edge.toId);
          return (
            <li key={node.id}>
              {node.title}
              {node.syncStatus === "synced" ? "｜已同步 " + (synced.join("/") || "无") : "｜草稿，无模块边"}
              {used.length ? "｜已使用 " + used.join("/") : ""}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
