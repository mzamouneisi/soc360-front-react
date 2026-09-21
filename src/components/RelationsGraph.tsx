import { tr } from '../i18n/translate'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { TableRelation } from '../api/tables'
import { InlineButton } from './ui'

const NODE_WIDTH = 120
const NODE_HEIGHT = 50

interface GraphRelation {
  table: string
  column: string
  target_table: string
  target_pk: string
}

interface GraphNode {
  id: string
  tables: string[]
  columns?: string[]
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
  isFixed?: boolean
}

interface GraphLink {
  source: string
  target: string
  table: string
  target_table: string
  column: string
  target_pk: string
  type: string
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

function toGraphRelations(relations: TableRelation[]): GraphRelation[] {
  return relations.map((r) => ({
    table: r.tableName,
    column: r.columnName,
    target_table: r.targetTable,
    target_pk: r.targetPk,
  }))
}

function buildGraph(relations: GraphRelation[]): GraphData {
  if (!Array.isArray(relations)) return { nodes: [], links: [] }
  const nodeMap = new Map<string, GraphNode>()
  const links: GraphLink[] = []
  relations.forEach((r) => {
    const src = r.table
    const tgt = r.target_table
    if (!nodeMap.has(src)) nodeMap.set(src, { id: src, tables: [src], columns: [] })
    if (!nodeMap.has(tgt)) nodeMap.set(tgt, { id: tgt, tables: [tgt], columns: [] })
    links.push({
      source: src,
      target: tgt,
      table: r.table,
      target_table: r.target_table,
      column: r.column,
      target_pk: r.target_pk,
      type: 'fk',
    })
  })
  return { nodes: Array.from(nodeMap.values()), links }
}

function filterGraph(relations: GraphRelation[], targetTableId: string): GraphData {
  if (!targetTableId || !Array.isArray(relations)) return buildGraph(relations)
  const nodesToShow = new Set<string>()
  const filteredLinks = relations.filter((r) => {
    if (r.table === targetTableId || r.target_table === targetTableId) {
      nodesToShow.add(r.table)
      nodesToShow.add(r.target_table)
      return true
    }
    return false
  })
  const filteredNodes = Array.from(nodesToShow).map((id) => ({
    id,
    tables: [id],
    columns: [],
  }))
  const validNodeIds = new Set(filteredNodes.map((n) => n.id))
  const finalLinks = filteredLinks
    .map((l) => ({ ...l, source: l.table, target: l.target_table, type: 'fk' }))
    .filter((l) => validNodeIds.has(l.source) && validNodeIds.has(l.target))
  return { nodes: filteredNodes, links: finalLinks }
}

function truncate(s: string | null | undefined, n: number): string {
  if (!n || n <= 0 || !s) return ''
  if (s.length <= n) return s
  if (n <= 2) return s.substring(0, n)
  return s.substring(0, n - 1) + '…'
}

interface TooltipState {
  visible: boolean
  left: number
  top: number
  text: string
}

export function RelationsGraph({
  relations,
  focusedTable = null,
}: {
  relations: TableRelation[]
  focusedTable?: string | null
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<any>(null)
  const zoomGRef = useRef<any>(null)
  const linkGroupRef = useRef<any>(null)
  const nodeGroupRef = useRef<any>(null)
  const zoomBehaviorRef = useRef<any>(null)
  const simulationRef = useRef<any>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const dimsRef = useRef({ width: 1200, height: 800 })
  const arrowMarkerId = useRef('arrow-' + Math.floor(Math.random() * 1000000))

  const [isolated, setIsolated] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    left: 0,
    top: 0,
    text: '',
  })

  const showTooltip = useCallback((event: MouseEvent, text: string) => {
    const container = containerRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    setTooltip({
      visible: true,
      left: event.clientX - containerRect.left + 12,
      top: event.clientY - containerRect.top + 12,
      text,
    })
  }, [])

  const hideTooltip = useCallback(() => {
    setTooltip((t) => ({ ...t, visible: false }))
  }, [])

  const fit = useCallback(() => {
    const svg = svgRef.current
    const zoomG = zoomGRef.current
    const zoomBehavior = zoomBehaviorRef.current
    if (!svg || !zoomG || !zoomBehavior) return
    const nodesAndLinks = zoomG.node().getBBox()
    if (!nodesAndLinks || (nodesAndLinks.width === 0 && nodesAndLinks.height === 0)) {
      svg.transition().duration(500).call(zoomBehavior.transform, d3.zoomIdentity)
      return
    }
    const { x, y, width, height } = nodesAndLinks
    const padding = 50
    const scaleX = (dimsRef.current.width - 2 * padding) / width
    const scaleY = (dimsRef.current.height - 2 * padding) / height
    const scale = Math.min(scaleX, scaleY, 1.5)
    const translateX = dimsRef.current.width / 2 - scale * (x + width / 2)
    const translateY = dimsRef.current.height / 2 - scale * (y + height / 2)
    const transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale)
    svg.transition().duration(750).call(zoomBehavior.transform, transform)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    dimsRef.current = {
      width: rect.width || dimsRef.current.width,
      height: rect.height || dimsRef.current.height,
    }
    const { width, height } = dimsRef.current

    container.innerHTML = ''
    const svg = d3.select(container).append('svg').attr('width', width).attr('height', height)
    svgRef.current = svg

    const zoomG = svg.append('g')
    zoomGRef.current = zoomG
    linkGroupRef.current = zoomG.append('g').attr('class', 'links')
    nodeGroupRef.current = zoomG.append('g').attr('class', 'nodes')

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 4]).on('zoom', (event: any) => {
      zoomG.attr('transform', event.transform)
    })
    zoomBehaviorRef.current = zoomBehavior
    svg.call(zoomBehavior)

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        const r = container.getBoundingClientRect()
        if (r.width && r.height) {
          dimsRef.current = { width: r.width, height: r.height }
          svg.attr('width', r.width).attr('height', r.height)
          fit()
        }
      })
      observer.observe(container)
      resizeObserverRef.current = observer
    }

    return () => {
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect()
      if (simulationRef.current) simulationRef.current.stop()
    }
  }, [fit])

  const render = useCallback(
    (nodes: GraphNode[], links: GraphLink[], targetId: string | null) => {
      const svg = svgRef.current
      const linkGroup = linkGroupRef.current
      const nodeGroup = nodeGroupRef.current
      if (!svg || !linkGroup || !nodeGroup) return
      const { width, height } = dimsRef.current

      if (!nodes || nodes.length === 0) {
        linkGroup.selectAll('*').remove()
        nodeGroup.selectAll('*').remove()
        if (simulationRef.current) simulationRef.current.stop()
        return
      }

      nodes.forEach((d) => {
        if (d.id === targetId && targetId !== null) {
          d.fx = width * 0.1
          d.fy = height * 0.1
          d.isFixed = true
        } else {
          d.fx = null
          d.fy = null
        }
      })

      linkGroup.selectAll('*').remove()
      nodeGroup.selectAll('*').remove()
      if (simulationRef.current) {
        try {
          simulationRef.current.stop()
        } catch {
          /* ignore */
        }
      }

      const simulation = d3
        .forceSimulation<GraphNode>(nodes)
        .force(
          'link',
          d3
            .forceLink<GraphNode, GraphLink>(links)
            .id((d) => d.id)
            .distance(180)
            .strength(1),
        )
        .force('charge', d3.forceManyBody().strength(-600))
        .force('center', d3.forceCenter(width * 0.1, height * 0.1))
        .force('collide', d3.forceCollide().radius(Math.max(NODE_WIDTH, NODE_HEIGHT)))
      simulationRef.current = simulation

      svg.select('defs').remove()
      const defs = svg.append('defs')
      defs
        .append('marker')
        .attr('id', arrowMarkerId.current)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', NODE_WIDTH / 2 + 6)
        .attr('refY', 0)
        .attr('markerWidth', 8)
        .attr('markerHeight', 8)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', 'currentColor')

      const link = linkGroup
        .selectAll('path')
        .data(links, (d: GraphLink) => `${d.source}->${d.target}`)
        .enter()
        .append('path')
        .attr('class', 'link fk')
        .attr('fill', 'none')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.8)
        .attr('stroke-width', 1.6)
        .attr('marker-end', `url(#${arrowMarkerId.current})`)

      const node = nodeGroup
        .selectAll('.node')
        .data(nodes, (d: GraphNode) => d.id)
        .enter()
        .append('g')
        .attr('class', 'node')
        .style('cursor', 'grab')
        .call(
          d3
            .drag<SVGGElement, GraphNode>()
            .on('start', (event: any, d: GraphNode) => {
              const sim = simulationRef.current
              if (!event.active && sim) sim.alphaTarget(0.3).restart()
              d.fx = d.x
              d.fy = d.y
            })
            .on('drag', (event: any, d: GraphNode) => {
              d.fx = event.x
              d.fy = event.y
            })
            .on('end', (event: any, d: GraphNode) => {
              const sim = simulationRef.current
              if (!event.active && sim) sim.alphaTarget(0)
              if (isolated !== d.id) {
                d.fx = d.x
                d.fy = d.y
              }
            }),
        )

      node
        .append('rect')
        .attr('x', -NODE_WIDTH / 2)
        .attr('y', -NODE_HEIGHT / 2)
        .attr('width', NODE_WIDTH)
        .attr('height', NODE_HEIGHT)
        .attr('rx', 8)
        .attr('ry', 8)
        .attr('fill', (d: GraphNode) => (d.id === focusedTable ? '#ffdca6' : '#e6f2ff'))
        .attr('stroke', '#2b7cff')
        .attr('stroke-width', 1.2)

      node
        .append('text')
        .text((d: GraphNode) => truncate(d.id, 18))
        .attr('text-anchor', 'middle')
        .attr('dy', 4)
        .attr('fill', '#033')
        .style('font-size', '12px')
        .style('pointer-events', 'none')

      node.on('dblclick', (_event: any, d: GraphNode) => {
        setIsolated((current) => (current === d.id ? null : d.id))
      })

      node.on('mouseover', (event: any, d: GraphNode) => {
        showTooltip(event, `Table: ${d.id}`)
        d3.select(event.currentTarget as Element).select('rect').attr('stroke-width', 2.4)
      })

      node.on('mouseout', (event: any) => {
        hideTooltip()
        d3.select(event.currentTarget as Element).select('rect').attr('stroke-width', 1.2)
      })

      link.on('mouseover', (event: any, d: GraphLink) => {
        const s = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source
        const t = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target
        showTooltip(event, `${s}.${d.column || ''} → ${t}.${d.target_pk || ''}`)
        d3.select(event.currentTarget as Element)
          .attr('stroke-width', 2.6)
          .attr('stroke', '#d9534f')
          .attr('stroke-opacity', 1)
      })

      link.on('mouseout', (event: any) => {
        hideTooltip()
        d3.select(event.currentTarget as Element)
          .attr('stroke-width', 1.6)
          .attr('stroke', '#999')
          .attr('stroke-opacity', 0.8)
      })

      simulation.on('tick', () => {
        const resolveNode = (d: string | GraphNode): GraphNode | undefined =>
          typeof d === 'object' ? (d as GraphNode) : nodes.find((n) => n.id === d)

        link.attr('d', (d: GraphLink) => {
          const source = resolveNode(d.source)
          const target = resolveNode(d.target)
          if (
            !source ||
            !target ||
            source.x === undefined ||
            source.y === undefined ||
            target.x === undefined ||
            target.y === undefined
          ) {
            return ''
          }
          const sx = source.x
          const sy = source.y
          const tx = target.x
          const ty = target.y
          const dx = tx - sx
          const dy = ty - sy
          let dr = Math.sqrt(dx * dx + dy * dy)
          if (dr < 1) dr = 1
          const offset = Math.max(NODE_WIDTH / 2, NODE_HEIGHT / 2)
          const startX = sx + dx * (offset / dr)
          const startY = sy + dy * (offset / dr)
          const endX = tx - dx * (offset / dr)
          const endY = ty - dy * (offset / dr)
          const curveRadius = dr * 0.8
          return `M${startX},${startY}A${curveRadius},${curveRadius} 0 0,1 ${endX},${endY}`
        })

        nodeGroup
          .selectAll('.node')
          .attr('transform', (d: any) => `translate(${d.x},${d.y})`)
      })

      simulation.alpha(1).restart()
    },
    [focusedTable, isolated, showTooltip, hideTooltip],
  )

  useEffect(() => {
    const graphRelations = toGraphRelations(relations)
    const targetId = isolated ?? focusedTable ?? null
    const data = targetId ? filterGraph(graphRelations, targetId) : buildGraph(graphRelations)
    render(data.nodes, data.links, targetId)
  }, [relations, focusedTable, isolated, render])

  const zoomIn = useCallback(() => {
    if (svgRef.current && zoomBehaviorRef.current) {
      svgRef.current.transition().call(zoomBehaviorRef.current.scaleBy, 1.3)
    }
  }, [])

  const zoomOut = useCallback(() => {
    if (svgRef.current && zoomBehaviorRef.current) {
      svgRef.current.transition().call(zoomBehaviorRef.current.scaleBy, 1 / 1.3)
    }
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-gray-900">
          {tr('RelationsGraph.relations')} {focusedTable || 'Toutes tables'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <InlineButton onClick={zoomIn} aria-label={tr('RelationsGraph.zoom.avant')}>
            +
          </InlineButton>
          <InlineButton onClick={zoomOut} aria-label={tr('RelationsGraph.zoom.arriere')}>
            −
          </InlineButton>
          <InlineButton onClick={fit}>{tr('RelationsGraph.ajuster')}</InlineButton>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative min-h-[400px] h-[70vh] w-full overflow-hidden rounded-xl border border-gray-200 bg-white"
      >
        {tooltip.visible && (
          <div
            className="pointer-events-none absolute z-10 rounded bg-black/80 px-2 py-1 text-xs text-white"
            style={{ left: tooltip.left, top: tooltip.top }}
          >
            {tooltip.text}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm text-gray-600">
        <span className="flex items-center gap-1.5">
          <b>●</b> {tr('RelationsGraph.table')}
        </span>
        <span className="flex items-center gap-1.5 text-red-500">{tr('RelationsGraph.cle.etrangere')}</span>
      </div>
    </div>
  )
}
