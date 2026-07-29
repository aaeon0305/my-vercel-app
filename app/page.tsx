'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Float } from '@react-three/drei';
import * as THREE from 'three';

// A spinning 3D object component
function SpinningCube() {
  const meshRef = useRef<THREE.Mesh>(null!);

  // Rotate the cube on every frame render tick
  useFrame((_, delta) => {
    meshRef.current.rotation.x += delta * 0.4;
    meshRef.current.rotation.y += delta * 0.6;
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={1}>
      <mesh ref={meshRef}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.2} metalness={0.8} />
      </mesh>
    </Float>
  );
}

export default function Home() {
  return (
    <main style={{ width: '100vw', height: '100vh', background: '#090d16', margin: 0, overflow: 'hidden' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
        {/* Ambient & directional lighting for the 3D scene */}
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        
        {/* The 3D element */}
        <SpinningCube />

        {/* Environment reflection and smooth mouse-driven camera controls */}
        <Environment preset="city" />
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </main>
  );
}