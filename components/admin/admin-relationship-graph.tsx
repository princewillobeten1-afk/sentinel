'use client';

import React, { useState } from 'react';
import {
  Share2,
  AlertTriangle,
  Layers,
  Sparkles,
  Info,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { AdminGraphEngine } from '@/lib/admin/graph';
import { GraphNode, GraphEdge } from '@/lib/admin/types';

interface AdminRelationshipGraphProps {
  entityId: string;
  entityType: string;
}

export function AdminRelationshipGraph({ entityId, entityType }: AdminRelationshipGraphProps) {
  const graph = AdminGraphEngine.buildGraph(entityId, entityType);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(graph.nodes[0] || null);

  // Simple clean SVG circular/force layout coordinates generator
  const getCoordinates = (index: number, total: number, isCenter: boolean) => {
    if (isCenter) return { x: 300, y: 180 };
    const angle = (index / (total - 1)) * 2 * Math.PI - Math.PI / 2;
    const radius = 130;
    return {
      x: 300 + radius * Math.cos(angle),
      y: 180 + radius * Math.sin(angle),
    };
  };

  const nodePositions = new Map<string, { x: number; y: number }>();
  graph.nodes.forEach((n, idx) => {
    nodePositions.set(n.id, getCoordinates(idx, graph.nodes.length, idx === 0));
  });

  return (
    <div className="space-y-4">
      <Panel className="p-4 bg-sentinel-950/80 border-white/5 relative overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white">Entity Relationship & Syndicate Graph</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral" size="sm" className="font-mono text-2xs">
              {graph.nodes.length} Nodes • {graph.edges.length} Connections
            </Badge>
            {graph.clusterCount > 0 && (
              <Badge variant="danger" size="sm" className="font-mono text-2xs">
                {graph.clusterCount} Sybil Cluster Detected
              </Badge>
            )}
          </div>
        </div>

        {/* SVG Graph Canvas */}
        <div className="w-full h-[360px] bg-sentinel-950/60 rounded-xl border border-white/5 relative flex items-center justify-center overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 600 360">
            {/* Edges */}
            {graph.edges.map((edge) => {
              const p1 = nodePositions.get(edge.source);
              const p2 = nodePositions.get(edge.target);
              if (!p1 || !p2) return null;

              const isWash = edge.relationship === 'WASH_CYCLE';
              const isFunding = edge.relationship === 'SHARED_FUNDING';

              return (
                <g key={edge.id}>
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={isWash ? '#EC5A5F' : isFunding ? '#E5A23D' : '#3B8FF0'}
                    strokeWidth={isWash ? 2 : 1.5}
                    strokeDasharray={isWash ? '4 2' : undefined}
                    opacity={0.6}
                  />
                  <text
                    x={(p1.x + p2.x) / 2}
                    y={(p1.y + p2.y) / 2 - 4}
                    fill="#98A3B3"
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {edge.relationship}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {graph.nodes.map((node) => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;

              const isSelected = selectedNode?.id === node.id;
              const isHighRisk = (node.riskScore || 0) > 70;

              return (
                <g
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  className="cursor-pointer group"
                  transform={`translate(${pos.x}, ${pos.y})`}
                >
                  <circle
                    r={isSelected ? 22 : 18}
                    fill={isHighRisk ? '#881337' : '#0c4a6e'}
                    stroke={isSelected ? '#3B8FF0' : isHighRisk ? '#EC5A5F' : '#2B6FC4'}
                    strokeWidth={isSelected ? 3 : 1.5}
                    className="transition-all duration-200"
                  />
                  <text
                    y={4}
                    fill="#f8fafc"
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                    className="select-none"
                  >
                    {node.type.slice(0, 3)}
                  </text>
                  <text
                    y={32}
                    fill="#C6CEDA"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="middle"
                    className="select-none"
                  >
                    {node.label.length > 18 ? `${node.label.slice(0, 16)}...` : node.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Node Inspector Overlay */}
          {selectedNode && (
            <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-80 p-3 rounded-xl bg-sentinel-900/95 border border-white/10 backdrop-blur-md space-y-1.5 shadow-2xl">
              <div className="flex items-center justify-between">
                <Badge variant={selectedNode.isFlagged ? 'danger' : 'info'} size="sm" className="font-mono text-2xs">
                  {selectedNode.type}
                </Badge>
                {selectedNode.riskScore && (
                  <span className="text-2xs font-mono font-bold text-rose-400">
                    Risk: {selectedNode.riskScore}/100
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-white truncate">{selectedNode.label}</p>
              {selectedNode.metadata && (
                <div className="text-2xs text-slate-400 font-mono space-y-0.5 pt-1 border-t border-white/5">
                  {Object.entries(selectedNode.metadata).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-slate-500 uppercase">{k}:</span>
                      <span className="text-slate-200">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
