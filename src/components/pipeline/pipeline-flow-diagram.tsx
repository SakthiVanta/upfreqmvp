'use client';

import React, { useMemo } from 'react';
import {
  ReactFlow, Background, BackgroundVariant, Controls, Position, MarkerType, Handle,
  type Node, type Edge, type NodeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { DataFlowNode, DataFlowEdge } from '@/lib/andino-data';
import { Radio, Cpu, Layers, Activity, Navigation, Zap } from 'lucide-react';

const STAGE_ORDER: DataFlowNode['type'][] = ['sensor', 'driver', 'preprocessing', 'estimation', 'autonomy_module', 'control'];
const COL_WIDTH = 260;
const ROW_HEIGHT = 96;

const STAGE_STYLES: Record<DataFlowNode['type'], { icon: any; label: string; border: string; text: string }> = {
  sensor: { icon: Radio, label: 'Sensor', border: 'border-sand-600', text: 'text-sand-400' },
  driver: { icon: Cpu, label: 'Driver / Plugin', border: 'border-emerald-800', text: 'text-emerald-600' },
  preprocessing: { icon: Layers, label: 'Pre-processing', border: 'border-amber-700', text: 'text-amber-500' },
  estimation: { icon: Activity, label: 'Estimation', border: 'border-amber-600', text: 'text-amber-400' },
  autonomy_module: { icon: Navigation, label: 'Autonomy Module', border: 'border-emerald-400', text: 'text-emerald-primary' },
  control: { icon: Zap, label: 'Control', border: 'border-emerald-600', text: 'text-emerald-400' },
};

function StageNode({ data }: NodeProps) {
  const stageType = data.stageType as DataFlowNode['type'];
  const cfg = STAGE_STYLES[stageType];
  const Icon = cfg.icon;
  const rosTopic = data.rosTopic as string | undefined;
  const rosMessageType = data.rosMessageType as string | undefined;

  return (
    <div className={`px-3 py-2.5 rounded-xl border-2 bg-sand-925 shadow-lg min-w-[190px] ${cfg.border}`}>
      <Handle type="target" position={Position.Left} className="!bg-sand-600 !border-sand-900 !w-2 !h-2" />
      <div className={`flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wide ${cfg.text}`}>
        <Icon className="h-3 w-3" />
        {cfg.label}
      </div>
      <div className="text-xs font-bold text-sand-50 mt-1 font-sans leading-tight">{data.label as string}</div>
      {rosTopic && (
        <div className="text-[10px] text-sand-500 font-mono mt-1 truncate">
          {rosTopic}{rosMessageType ? ` [${rosMessageType.split('/').pop()}]` : ''}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-emerald-500 !border-sand-900 !w-2 !h-2" />
    </div>
  );
}

const NODE_TYPES = { stage: StageNode };

function layoutNodes(nodes: DataFlowNode[]): Node[] {
  const byStage = STAGE_ORDER.map(type => nodes.filter(n => n.type === type));
  const maxRows = Math.max(...byStage.map(g => g.length), 1);
  const flowNodes: Node[] = [];
  byStage.forEach((group, colIdx) => {
    const startY = ((maxRows - group.length) / 2) * ROW_HEIGHT;
    group.forEach((n, rowIdx) => {
      flowNodes.push({
        id: n.id,
        type: 'stage',
        position: { x: colIdx * COL_WIDTH, y: startY + rowIdx * ROW_HEIGHT },
        data: { label: n.label, stageType: n.type, rosTopic: n.rosTopic, rosMessageType: n.rosMessageType },
        draggable: true,
      });
    });
  });
  return flowNodes;
}

function buildEdges(edges: DataFlowEdge[]): Edge[] {
  return edges.map((e, idx) => ({
    id: `e-${idx}-${e.from}-${e.to}`,
    source: e.from,
    target: e.to,
    label: e.label,
    type: 'smoothstep',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981', width: 16, height: 16 },
    style: { stroke: '#10b981', strokeWidth: 1.5 },
    labelStyle: { fill: '#f6f3ec', fontSize: 10 },
    labelBgStyle: { fill: '#15110f', fillOpacity: 0.92 },
    labelBgPadding: [5, 3] as [number, number],
    labelBgBorderRadius: 4,
  }));
}

export function PipelineFlowDiagram({ nodes, edges }: { nodes: DataFlowNode[]; edges: DataFlowEdge[] }) {
  const flowNodes = useMemo(() => layoutNodes(nodes), [nodes]);
  const flowEdges = useMemo(() => buildEdges(edges), [edges]);

  return (
    <div className="h-105 sm:h-120 w-full rounded-2xl overflow-hidden border border-sand-800 bg-sand-950">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.4}
        maxZoom={1.5}
        nodesConnectable={false}
        edgesReconnectable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#463d34" />
        <Controls
          showInteractive={false}
          className="!bg-sand-925 !border-sand-800 !shadow-none [&>button]:!bg-sand-925 [&>button]:!border-sand-800 [&>button]:!text-sand-300 [&>button:hover]:!bg-sand-800 [&>button]:!fill-sand-300"
        />
      </ReactFlow>
    </div>
  );
}
