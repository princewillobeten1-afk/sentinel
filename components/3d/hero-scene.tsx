'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const NUM_CANDLES = 300;
const SPACING = 0.3;
const CANDLE_WIDTH = 0.18;
const WICK_WIDTH = 0.04;

function CandlestickChart() {
  const bodyMeshRef = useRef<THREE.InstancedMesh>(null);
  const wickMeshRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  
  // Pre-calculate positions and colors
  const { bodyMatrices, wickMatrices, colors } = useMemo(() => {
    const dummy = new THREE.Object3D();
    const cols = new Float32Array(NUM_CANDLES * 3);
    
    const colorUp = new THREE.Color('#12B574'); // green-500
    const colorDown = new THREE.Color('#EC5A5F'); // red-500
    
    const bMatrices = [];
    const wMatrices = [];
    
    let currentPrice = 0;
    let trend = 0;
    
    for (let i = 0; i < NUM_CANDLES; i++) {
      // Random walk for realistic price action
      trend += (Math.random() - 0.5) * 0.4; 
      // Keep trend within bounds so it doesn't fly off screen
      if (currentPrice > 8) trend -= 0.1;
      if (currentPrice < -8) trend += 0.1;
      
      const volatility = 0.2 + Math.random() * 0.8;
      const open = currentPrice;
      const move = trend + (Math.random() - 0.5) * volatility;
      const close = open + move;
      const high = Math.max(open, close) + Math.random() * volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * 0.5;
      
      const isUp = close >= open;
      const bodyHeight = Math.max(0.05, Math.abs(close - open));
      const bodyY = Math.min(open, close) + bodyHeight / 2;
      
      // Calculate Body Matrix
      dummy.position.set(i * SPACING, bodyY, 0);
      dummy.scale.set(CANDLE_WIDTH, bodyHeight, CANDLE_WIDTH);
      dummy.updateMatrix();
      bMatrices.push(dummy.matrix.clone());
      
      // Calculate Wick Matrix
      const wickHeight = high - low;
      const wickY = low + wickHeight / 2;
      dummy.position.set(i * SPACING, wickY, 0);
      dummy.scale.set(WICK_WIDTH, wickHeight, WICK_WIDTH);
      dummy.updateMatrix();
      wMatrices.push(dummy.matrix.clone());
      
      // Color
      const c = isUp ? colorUp : colorDown;
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
      
      currentPrice = close;
    }
    
    return { bodyMatrices: bMatrices, wickMatrices: wMatrices, colors: cols };
  }, []);

  // Apply matrices and colors on mount
  useEffect(() => {
    if (bodyMeshRef.current && wickMeshRef.current) {
      for (let i = 0; i < NUM_CANDLES; i++) {
        bodyMeshRef.current.setMatrixAt(i, bodyMatrices[i]);
        wickMeshRef.current.setMatrixAt(i, wickMatrices[i]);
      }
      bodyMeshRef.current.instanceMatrix.needsUpdate = true;
      wickMeshRef.current.instanceMatrix.needsUpdate = true;
      
      const colorAttr = new THREE.InstancedBufferAttribute(colors, 3);
      bodyMeshRef.current.geometry.setAttribute('color', colorAttr);
      wickMeshRef.current.geometry.setAttribute('color', colorAttr);
    }
  }, [bodyMatrices, wickMatrices, colors]);

  // Slowly pan the chart to the left to simulate live market data
  useFrame((state) => {
    if (groupRef.current) {
      // Start in the middle and slowly pan
      const startX = - (NUM_CANDLES * SPACING) / 2 + 10;
      const time = state.clock.elapsedTime;
      groupRef.current.position.x = startX - time * 0.4;
      
      // Very subtle mouse parallax
      groupRef.current.rotation.x = Math.PI / 16 + (state.pointer.y * Math.PI) / 80;
      groupRef.current.rotation.y = -Math.PI / 12 + (state.pointer.x * Math.PI) / 60;
    }
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={bodyMeshRef} args={[undefined, undefined, NUM_CANDLES]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial 
          vertexColors 
          roughness={0.4}
          metalness={0.2}
          emissive="#000000"
        />
      </instancedMesh>
      
      <instancedMesh ref={wickMeshRef} args={[undefined, undefined, NUM_CANDLES]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial 
          vertexColors 
          roughness={0.4}
          metalness={0.2}
          emissive="#000000"
        />
      </instancedMesh>
    </group>
  );
}

export function HeroScene() {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none opacity-50">
      <Canvas camera={{ position: [0, 0, 12], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1.5} color="#ffffff" />
        <directionalLight position={[-5, 5, -5]} intensity={1} color="#ffffff" />
        <CandlestickChart />
      </Canvas>
    </div>
  );
}
