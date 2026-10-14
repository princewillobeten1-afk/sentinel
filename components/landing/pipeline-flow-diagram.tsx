'use client';

import React from 'react';
import { motion } from 'framer-motion';

// Custom SVG Icons matching Photo 2

function MempoolIngestionIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Outer orbit connection lines */}
      <path
        d="M32 6L52 17V41L32 52L12 41V17L32 6Z"
        stroke="#4ADE80"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        opacity="0.55"
      />
      {/* Central 3D Cube */}
      <path
        d="M32 18L46 26V42L32 50L18 42V26L32 18Z"
        stroke="#4ADE80"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="#4ADE80"
        fillOpacity="0.08"
      />
      <path d="M32 18V50" stroke="#4ADE80" strokeWidth="1.75" />
      <path d="M32 34L46 26" stroke="#4ADE80" strokeWidth="1.75" />
      <path d="M32 34L18 26" stroke="#4ADE80" strokeWidth="1.75" />
      {/* Orbital circular nodes */}
      <circle cx="32" cy="6" r="3" fill="#4ADE80" />
      <circle cx="52" cy="17" r="3" fill="#4ADE80" />
      <circle cx="52" cy="41" r="3" fill="#4ADE80" />
      <circle cx="32" cy="52" r="3" fill="#4ADE80" />
      <circle cx="12" cy="41" r="3" fill="#4ADE80" />
      <circle cx="12" cy="17" r="3" fill="#4ADE80" />
      {/* Connecting extension leads */}
      <path d="M52 29H59" stroke="#4ADE80" strokeWidth="1.5" strokeDasharray="2 2" />
      <path d="M12 29H5" stroke="#4ADE80" strokeWidth="1.5" strokeDasharray="2 2" />
    </svg>
  );
}

function ForensicDecompilationIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Circular Magnifying Glass Lens */}
      <circle
        cx="27"
        cy="27"
        r="17"
        stroke="#4ADE80"
        strokeWidth="2.2"
        fill="#4ADE80"
        fillOpacity="0.08"
      />
      {/* Code Brackets </> inside lens */}
      <path
        d="M20 24L16 27L20 30"
        stroke="#4ADE80"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M26 32L29 22"
        stroke="#4ADE80"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M34 24L38 27L34 30"
        stroke="#4ADE80"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Handle */}
      <path
        d="M39 39L53 53"
        stroke="#4ADE80"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="53" cy="53" r="2.5" fill="#4ADE80" />
    </svg>
  );
}

function DecisionMatrixIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Rounded Frame */}
      <rect
        x="10"
        y="10"
        width="44"
        height="44"
        rx="10"
        stroke="#4ADE80"
        strokeWidth="1.8"
        fill="#4ADE80"
        fillOpacity="0.06"
      />
      {/* 3x3 Dot Grid */}
      <circle cx="21" cy="21" r="3.2" fill="#4ADE80" />
      <circle cx="32" cy="21" r="3.2" fill="#4ADE80" />
      <circle cx="43" cy="21" r="3.2" fill="#4ADE80" />

      <circle cx="21" cy="32" r="3.2" fill="#4ADE80" />
      <circle cx="32" cy="32" r="3.2" fill="#4ADE80" />
      <circle cx="43" cy="32" r="3.2" fill="#4ADE80" />

      <circle cx="21" cy="43" r="3.2" fill="#4ADE80" />
      <circle cx="32" cy="43" r="3.2" fill="#4ADE80" />
      <circle cx="43" cy="43" r="3.2" fill="#4ADE80" />
    </svg>
  );
}

function PrivateMEVExecutionIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Shield Silhouette */}
      <path
        d="M32 9L49 16V31C49 42 41.5 51.5 32 55C22.5 51.5 15 42 15 31V16L32 9Z"
        stroke="#4ADE80"
        strokeWidth="2.2"
        strokeLinejoin="round"
        fill="#4ADE80"
        fillOpacity="0.08"
      />
      {/* Lightning Bolt */}
      <path
        d="M34 19L24 33H33L29 45L42 29H34L34 19Z"
        fill="#4ADE80"
        stroke="#4ADE80"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const PIPELINE_STAGES = [
  {
    stage: 'STAGE 01',
    title: 'Mempool Ingestion',
    description: 'Real-time capture and normalization of pending transactions from mempool sources.',
    icon: MempoolIngestionIcon,
  },
  {
    stage: 'STAGE 02',
    title: 'Forensic Decompilation',
    description: 'Decompile and reconstruct transaction intent with symbolic analysis and behavioral tracing.',
    icon: ForensicDecompilationIcon,
  },
  {
    stage: 'STAGE 03',
    title: 'Decision Risk Matrix',
    description: 'Multi-dimensional risk scoring and scenario modeling to inform intelligent decisions.',
    icon: DecisionMatrixIcon,
  },
  {
    stage: 'STAGE 04',
    title: 'Private MEV Execution',
    description: 'Secure, private execution with MEV protection and optimized outcomes.',
    icon: PrivateMEVExecutionIcon,
  },
];

export function PipelineFlowDiagram() {
  return (
    <div className="w-full">
      {/* Left-Aligned Header Section (matching Photo 2) */}
      <div className="space-y-3 mb-10 text-left">
        <span className="text-xs font-mono font-bold tracking-widest uppercase text-emerald-400">
          INTELLIGENCE PIPELINE
        </span>
        <h2 className="font-heading text-3xl sm:text-5xl font-black tracking-tight leading-[1.1]">
          <span className="text-white block">The Sentinel</span>
          <span className="text-[#86EFAC] block">Intelligence Pipeline</span>
        </h2>
        <p className="text-sm sm:text-base text-neutral-400 max-w-2xl font-sans leading-relaxed pt-1">
          End-to-end intelligence processing for proactive threat detection, risk assessment, and secure execution.
        </p>
        <div className="w-16 h-0.5 bg-emerald-500/80 rounded-full mt-4" />
      </div>

      {/* 4-Card Horizontal Grid (matching Photo 2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
        {PIPELINE_STAGES.map((item, idx) => {
          const IconComponent = item.icon;

          return (
            <motion.div
              key={item.stage}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="relative flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-[#0B0F15] border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.6)] hover:border-emerald-500/40 hover:bg-[#0D141D] transition-all duration-300 group"
            >
              {/* Top-Left Stage Badge */}
              <div className="text-left mb-6">
                <span className="text-xs font-mono font-bold tracking-wider text-emerald-400">
                  {item.stage}
                </span>
              </div>

              {/* Centered Large Line-Art Graphic Icon */}
              <div className="my-4 flex items-center justify-center">
                <div className="p-3.5 rounded-2xl bg-emerald-500/5 group-hover:scale-105 group-hover:bg-emerald-500/10 transition-all duration-300">
                  <IconComponent className="h-16 w-16" />
                </div>
              </div>

              {/* Title, Pip & Description */}
              <div className="text-center space-y-3 mt-4">
                <h3 className="font-heading text-lg font-bold text-white tracking-tight">
                  {item.title}
                </h3>

                {/* Subtle Centered Green Pip */}
                <div className="flex justify-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
                </div>

                <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                  {item.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
