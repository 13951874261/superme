import React, { useEffect, useRef } from 'react';
import { hierarchy, tree, type HierarchyPointLink, type HierarchyPointNode } from 'd3-hierarchy';
import { select } from 'd3-selection';
import { linkHorizontal } from 'd3-shape';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import type { InsightMindMapNode } from '../../../utils/insightMindMapBuilder';

type LayoutNode = InsightMindMapNode & {
  children?: LayoutNode[];
  _children?: LayoutNode[];
};

type Props = {
  data: InsightMindMapNode;
  svgRef?: React.Ref<SVGSVGElement | null>;
};

function cloneLayout(node: InsightMindMapNode): LayoutNode {
  return {
    name: node.name,
    detail: node.detail,
    children: node.children?.map(cloneLayout),
  };
}

function assignRef(ref: React.Ref<SVGSVGElement | null> | undefined, value: SVGSVGElement | null) {
  if (!ref) return;
  if (typeof ref === 'function') ref(value);
  else (ref as React.MutableRefObject<SVGSVGElement | null>).current = value;
}

const NODE_FILL = '#0f172a';
const NODE_STROKE = '#fbbf24';
const TEXT_FILL = '#e2e8f0';
const LINK_STROKE = '#475569';
const COLLAPSED_FILL = '#fbbf24';

export default function InsightMindMap({ data, svgRef }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const layoutRoot = cloneLayout(data);
    let width = host.clientWidth || 640;
    let height = host.clientHeight || 360;

    const svg = select(host)
      .selectAll<SVGSVGElement, null>('svg')
      .data([null])
      .join('svg')
      .attr('role', 'img')
      .attr('aria-label', '洞察思维导图')
      .attr('width', width)
      .attr('height', height)
      .style('background', '#0f172a')
      .style('display', 'block')
      .style('cursor', 'grab');

    assignRef(svgRef, svg.node());

    const g = svg.append('g');
    const zoomer: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 2.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoomer);
    svg.on('dblclick.zoom', null);

    const linkGen = linkHorizontal<{ source: { x: number; y: number }; target: { x: number; y: number } }, { x: number; y: number }>()
      .x((d) => d.y)
      .y((d) => d.x);

    const fit = (rootNode: ReturnType<typeof hierarchy<LayoutNode>>) => {
      const nodes = rootNode.descendants();
      const minX = Math.min(...nodes.map((d) => d.x));
      const maxX = Math.max(...nodes.map((d) => d.x));
      const minY = Math.min(...nodes.map((d) => d.y));
      const maxY = Math.max(...nodes.map((d) => d.y));
      const treeW = Math.max(maxY - minY, 1);
      const treeH = Math.max(maxX - minX, 1);
      const scale = Math.min((width - 80) / treeW, (height - 48) / treeH, 1.2);
      const tx = (width - scale * (maxY + minY)) / 2;
      const ty = (height - scale * (maxX + minX)) / 2;
      const transform = zoomIdentity.translate(tx, ty).scale(scale);
      svg.call(zoomer.transform, transform);
    };

    const render = (shouldFit = false) => {
      const root = hierarchy(layoutRoot, (d) => d.children);
      const dx = 56;
      const dy = Math.max(168, width / (root.height + 2));
      tree<LayoutNode>().nodeSize([dx, dy])(root);

      const links = g
        .selectAll<SVGPathElement, HierarchyPointLink<LayoutNode>>('path.insight-link')
        .data(root.links(), (d) => `${d.source.data.name}-${d.target.data.name}`);

      links.join(
        (enter) =>
          enter
            .append('path')
            .attr('class', 'insight-link')
            .attr('fill', 'none')
            .attr('stroke', LINK_STROKE)
            .attr('stroke-width', 1.5)
            .attr('d', (d) => linkGen(d as never)),
        (update) => update.attr('d', (d) => linkGen(d as never)),
        (exit) => exit.remove(),
      );

      const nodeSel = g
        .selectAll<SVGGElement, HierarchyPointNode<LayoutNode>>('g.insight-node')
        .data(root.descendants(), (d) => `${d.data.name}-${d.depth}-${d.parent?.data.name || 'root'}`);

      const nodeEnter = nodeSel
        .enter()
        .append('g')
        .attr('class', 'insight-node')
        .attr('transform', (d) => `translate(${d.y},${d.x})`)
        .style('cursor', (d) => (d.data.children || d.data._children ? 'pointer' : 'default'))
        .on('click', (event, d) => {
          event.stopPropagation();
          const item = d.data;
          if (item.children) {
            item._children = item.children;
            item.children = undefined;
          } else if (item._children) {
            item.children = item._children;
            item._children = undefined;
          } else {
            return;
          }
          render(false);
        });

      nodeEnter
        .append('circle')
        .attr('r', (d) => (d.depth === 0 ? 8 : 5.5))
        .attr('fill', (d) => (d.data._children ? COLLAPSED_FILL : NODE_FILL))
        .attr('stroke', NODE_STROKE)
        .attr('stroke-width', 1.6);

      nodeEnter
        .append('text')
        .attr('class', 'insight-toggle')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', 9)
        .attr('font-weight', 700)
        .attr('fill', (d) => (d.data._children ? NODE_FILL : NODE_STROKE))
        .text((d) => (d.data._children ? '+' : d.children ? '−' : ''));

      nodeEnter
        .append('text')
        .attr('dy', '0.32em')
        .attr('x', (d) => (d.children || d.data._children ? -12 : 12))
        .attr('text-anchor', (d) => (d.children || d.data._children ? 'end' : 'start'))
        .attr('fill', TEXT_FILL)
        .attr('font-size', (d) => (d.depth === 0 ? 13 : 11))
        .attr('font-weight', (d) => (d.depth <= 1 ? 700 : 500))
        .text((d) => d.data.name)
        .append('title')
        .text((d) => d.data.detail || d.data.name);

      nodeSel
        .merge(nodeEnter)
        .attr('transform', (d) => `translate(${d.y},${d.x})`)
        .select('circle')
        .attr('fill', (d) => (d.data._children ? COLLAPSED_FILL : NODE_FILL));

      nodeSel
        .merge(nodeEnter)
        .select('text.insight-toggle')
        .attr('fill', (d) => (d.data._children ? NODE_FILL : NODE_STROKE))
        .text((d) => (d.data._children ? '+' : d.children ? '−' : ''));

      nodeSel.exit().remove();

      if (shouldFit) fit(root);
    };

    svg.on('dblclick', () => {
      const root = hierarchy(layoutRoot, (d) => d.children);
      tree<LayoutNode>().nodeSize([56, Math.max(168, width / (root.height + 2))])(root);
      fit(root);
    });

    render(true);

    const observer = new ResizeObserver(() => {
      width = host.clientWidth || width;
      height = host.clientHeight || height;
      svg.attr('width', width).attr('height', height);
      render(true);
    });
    observer.observe(host);

    return () => {
      observer.disconnect();
      svg.on('.zoom', null);
      svg.on('dblclick', null);
      svg.selectAll('*').remove();
      assignRef(svgRef, null);
    };
  }, [data, svgRef]);

  return <div ref={hostRef} className="w-full h-[280px] xl:h-[360px]" />;
}
