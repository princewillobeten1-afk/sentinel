'use client';

import React from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  isPositive?: boolean;
}

export function Sparkline({
  data,
  width = 100,
  height = 30,
  isPositive = true,
}: SparklineProps) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="bg-white/[0.02] rounded" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const strokeColor = isPositive ? '#22C489' : '#EC5A5F';
  const fillColor = isPositive ? 'rgba(52, 211, 153, 0.15)' : 'rgba(244, 63, 94, 0.15)';

  const firstX = 0;
  const lastX = width;
  const areaPoints = `${firstX},${height} ${points} ${lastX},${height}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${isPositive ? 'pos' : 'neg'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${isPositive ? 'pos' : 'neg'})`} />
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
