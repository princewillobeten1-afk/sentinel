'use client';

import React, { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { Panel } from '@/components/ui/panel';
import type { WalletRelationshipEdge, OwnershipEntity } from '@/lib/ownership/types';

interface OwnershipGraphProps {
  entities: OwnershipEntity[];
  edges: WalletRelationshipEdge[];
}

export function OwnershipGraph({ entities, edges }: OwnershipGraphProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<WalletRelationshipEdge | null>(null);
  const [zoom, setZoom] = useState(1);

  // Layout node positions in a circle/radial layout
  const nodes = useMemo(() => {
    const allWallets = new Set<string>();
    entities.forEach(e => e.addresses.forEach(a => allWallets.add(a)));
    edges.forEach(e => {
      allWallets.add(e.source);
      allWallets.add(e.target);
    });

    const walletArray = Array.from(allWallets);
    const count = walletArray.length;
    const centerX = 300;
    const centerY = 200;
    const radius = Math.min(160, Math.max(80, count * 20));

    return walletArray.map((wallet, idx) => {
      const angle = (idx / count) * 2 * Math.PI - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      // Find entity matching this wallet
      const entity = entities.find(e => e.addresses.includes(wallet));

      return {
        address: wallet,
        x,
        y,
        type: entity?.type || 'WALLET',
        supplyPct: entity ? entity.supplyPercentage : 0,
      };
    });
  }, [entities, edges]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, { address: string; x: number; y: number; type: string; supplyPct: number }>();
    nodes.forEach(n => map.set(n.address, n));
    return map;
  }, [nodes]);

  const selectedEntity = selectedNode
    ? entities.find(e => e.addresses.includes(selectedNode))
    : null;

  return (
    <Panel
      title={
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-100">Wallet Relationship Graph</span>
          <span className="text-xs text-slate-400 font-mono">Interactive Topology</span>
        </div>
      }
      subtitle="Visualizing funding paths, cluster links, and transaction correlations"
      headerActions={
        <div className="flex items-center gap-1 bg-sentinel-950 rounded border border-sentinel-800 p-1 text-xs">
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}
            className="px-2 py-0.5 text-slate-400 hover:text-slate-200"
          >
            -
          </button>
          <span className="font-mono text-slate-300 px-1">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(2, z + 0.2))}
            className="px-2 py-0.5 text-slate-400 hover:text-slate-200"
          >
            +
          </button>
          <button
            onClick={() => { setZoom(1); setSelectedNode(null); }}
            className="px-2 py-0.5 text-slate-400 hover:text-slate-200 ml-1 border-l border-sentinel-800"
          >
            Reset
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* SVG Graph Viewport */}
        <div className="relative w-full h-[400px] bg-sentinel-950 rounded-xl border border-sentinel-800 overflow-hidden flex items-center justify-center">
          <svg
            viewBox="0 0 600 400"
            className="w-full h-full cursor-grab active:cursor-grabbing transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          >
            {/* Edges */}
            {edges.map(edge => {
              const sourceNode = nodeMap.get(edge.source);
              const targetNode = nodeMap.get(edge.target);
              if (!sourceNode || !targetNode) return null;

              const isHighlighted =
                selectedNode === edge.source || selectedNode === edge.target;

              const strokeWidth = Math.max(1, edge.strength * 4);
              const strokeColor = edge.strength >= 0.7
                ? '#E5A23D'
                : edge.strength >= 0.4
                ? '#60a5fa'
                : '#2B3542';

              return (
                <g key={edge.id}>
                  <line
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={strokeColor}
                    strokeWidth={isHighlighted ? strokeWidth + 2 : strokeWidth}
                    strokeOpacity={isHighlighted ? 1 : 0.6}
                    strokeDasharray={edge.type === 'TEMPORAL_CORRELATION' ? '4 2' : undefined}
                    className="transition-all duration-200 cursor-pointer"
                    onMouseEnter={() => setHoveredEdge(edge)}
                    onMouseLeave={() => setHoveredEdge(null)}
                  />
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map(node => {
              const isSelected = selectedNode === node.address;
              const nodeRadius = Math.max(8, Math.min(22, 8 + node.supplyPct * 0.3));

              const fillColor = node.type === 'CREATOR'
                ? '#A78BFA'
                : node.type === 'CLUSTER'
                ? '#E5A23D'
                : '#3b82f6';

              return (
                <g
                  key={node.address}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer group"
                  onClick={() => setSelectedNode(isSelected ? null : node.address)}
                >
                  <circle
                    r={nodeRadius}
                    fill={fillColor}
                    fillOpacity={isSelected ? 1 : 0.8}
                    stroke={isSelected ? '#ffffff' : '#12171F'}
                    strokeWidth={isSelected ? 3 : 2}
                    className="transition-all duration-200 group-hover:scale-110"
                  />
                  <text
                    y={nodeRadius + 12}
                    textAnchor="middle"
                    fill="#98A3B3"
                    fontSize="9"
                    fontFamily="monospace"
                    className="pointer-events-none"
                  >
                    {node.address.slice(0, 4)}...{node.address.slice(-4)}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Hovered Edge Tooltip */}
          {hoveredEdge && (
            <div className="absolute bottom-3 left-3 p-2.5 bg-sentinel-900/90 backdrop-blur rounded-lg border border-sentinel-700 text-xs max-w-sm space-y-1">
              <div className="font-semibold text-slate-100 flex items-center gap-2">
                <span>{hoveredEdge.type}</span>
                <span className="font-mono text-amber-400">({Math.round(hoveredEdge.strength * 100)}% strength)</span>
              </div>
              {hoveredEdge.evidence[0] && (
                <div className="text-slate-300 text-2xs">{hoveredEdge.evidence[0].fact}</div>
              )}
            </div>
          )}
        </div>

        {/* Legend & Details */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-sentinel-900/40 rounded-xl border border-sentinel-800 text-xs">
          <div className="flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-purple-500" /> Creator Entity
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-amber-500" /> Wallet Cluster
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-blue-500" /> Direct Wallet
            </span>
          </div>

          <div className="text-slate-400 font-mono">
            {nodes.length} nodes, {edges.length} edges
          </div>
        </div>

        {/* Node Detail View */}
        {selectedNode && (
          <div className="p-3 bg-sentinel-900/80 rounded-xl border border-sentinel-700 space-y-2 text-xs font-mono">
            <div className="flex justify-between items-center text-slate-200">
              <span>Selected Wallet: <strong className="text-emerald-400">{selectedNode}</strong></span>
              <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-200">Close</button>
            </div>
            {selectedEntity && (
              <div className="text-slate-400">
                Entity Type: {selectedEntity.type} | Supply: {selectedEntity.supplyPercentage.toFixed(2)}% | Layer: {selectedEntity.layer}
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
