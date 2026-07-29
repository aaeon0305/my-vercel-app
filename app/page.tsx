"use client";

import Image from "next/image";
import React, { useMemo, useRef, useLayoutEffect, useEffect, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { Physics, RigidBody, InstancedRigidBodies, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { create } from 'zustand';

// ============================================================================
// 1. ENGINE CONFIGURATION & SCALE ADJUSTMENTS
// ============================================================================
const CHUNK_TILES = 16;         
const TILE_SIZE = 2;            
const WALL_HEIGHT = 4;          
const CHUNK_SIZE = CHUNK_TILES * TILE_SIZE; 

function hashString(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return h;
}

function createSeededRandom(seedInt: number) {
  return function() {
    seedInt |= 0; seedInt = seedInt + 0x9e3779b9 | 0;
    let t = seedInt ^ seedInt >>> 16; t = Math.imul(t, 0x21f0aaad);
    t = t ^ t >>> 15; t = Math.imul(t, 0x735a2d97);
    return ((t = t ^ t >>> 15) >>> 0) / 4294967296;
  }
}

// ============================================================================
// 2. GLOBAL STATE
// ============================================================================
const getNeighbors = (cx: number, cz: number) => {
  const neighbors = [];
  for (let x = -1; x <= 1; x++) {
    for (let z = -1; z <= 1; z++) {
      neighbors.push(`${cx + x},${cz + z}`);
    }
  }
  return neighbors; 
};

const useGameStore = create((set) => ({
  seed: "THE_DRONE", 
  lucidity: 60,
  vitality: 40,
  currentChunk: [0, 0],
  activeChunks: getNeighbors(0, 0),
  updateChunk: (newX: number, newZ: number) => set({ 
    currentChunk: [newX, newZ], 
    activeChunks: getNeighbors(newX, newZ) 
  })
}));

const keys: { [key: string]: boolean } = { w: false, a: false, s: false, d: false };
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => { if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', (e) => { if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; });
}

// Rotation offsets driven by touch lookaround
const touchLook = { yaw: 0, pitch: 0 };

// ============================================================================
// 3. BACKROOMS LEVEL 0 CHUNK GENERATOR
// ============================================================================
function MazeChunk({ chunkID, seedString }: { chunkID: string; seedString: string }) {
  const [cx, cz] = chunkID.split(',').map(Number);
  const fullWallMeshRef = useRef<any>(null);
  const halfWallMeshRef = useRef<any>(null);
  const lightMeshRef = useRef<any>(null);
  
  const { fullWalls, halfWalls, lights } = useMemo(() => {
    const localSeed = hashString(`${seedString}_${cx}_${cz}`);
    const random = createSeededRandom(localSeed);
    
    let grid = Array.from({ length: CHUNK_TILES }, () => Array(CHUNK_TILES).fill(0));
    
    for (let x = 0; x < CHUNK_TILES; x++) {
      for (let z = 0; z < CHUNK_TILES; z++) {
        const isBorder = (x === 0 || x === CHUNK_TILES - 1 || z === 0 || z === CHUNK_TILES - 1);
        if (isBorder) {
          grid[x][z] = (x === 8 || z === 8) ? 0 : (random() < 0.4 ? 1 : 0);
        } else {
          grid[x][z] = random() < 0.28 ? 1 : 0;
        }
      }
    }

    for (let iteration = 0; iteration < 2; iteration++) {
      let newGrid = grid.map(arr => [...arr]);
      for (let x = 1; x < CHUNK_TILES - 1; x++) {
        for (let z = 1; z < CHUNK_TILES - 1; z++) {
          let neighbors = 0;
          for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              if (dx !== 0 || dz !== 0) neighbors += grid[x + dx][z + dz];
            }
          }
          if (neighbors > 4) newGrid[x][z] = 1;
          else if (neighbors < 2) newGrid[x][z] = 0;
        }
      }
      grid = newGrid;
    }

    const fWalls: any[] = [];
    const hWalls: any[] = [];
    const chunkLights: any[] = [];

    for (let x = 0; x < CHUNK_TILES; x++) {
      for (let z = 0; z < CHUNK_TILES; z++) {
        if (cx === 0 && cz === 0 && x >= 7 && x <= 9 && z >= 7 && z <= 9) continue;

        if (grid[x][z] === 1) {
          const worldX = (cx * CHUNK_SIZE) + (x * TILE_SIZE);
          const worldZ = (cz * CHUNK_SIZE) + (z * TILE_SIZE);
          
          const isHalfWall = random() < 0.25;

          if (isHalfWall) {
            hWalls.push({
              key: `hwall-${cx}-${cz}-${x}-${z}`,
              position: [worldX, (WALL_HEIGHT * 0.5) / 2, worldZ] as [number, number, number],
              rotation: [0, 0, 0, 1] as [number, number, number, number],
              scale: [1, 1, 1] as [number, number, number]
            });
          } else {
            fWalls.push({
              key: `fwall-${cx}-${cz}-${x}-${z}`,
              position: [worldX, WALL_HEIGHT / 2, worldZ] as [number, number, number],
              rotation: [0, 0, 0, 1] as [number, number, number, number],
              scale: [1, 1, 1] as [number, number, number]
            });
          }
        }
      }
    }

    const isDarkRoom = random() < 0.15;

    if (!isDarkRoom) {
      for (let lx = 1; lx < CHUNK_TILES; lx += 3) {
        for (let lz = 1; lz < CHUNK_TILES; lz += 3) {
          chunkLights.push({
            key: `light-${cx}-${cz}-${lx}-${lz}`,
            position: [
              (cx * CHUNK_SIZE) + (lx * TILE_SIZE),
              WALL_HEIGHT - 0.01,
              (cz * CHUNK_SIZE) + (lz * TILE_SIZE)
            ] as [number, number, number],
            rotation: [-Math.PI / 2, 0, 0] as [number, number, number],
            scale: [1, 1, 1] as [number, number, number]
          });
        }
      }
    }

    return { fullWalls: fWalls, halfWalls: hWalls, lights: chunkLights };
  }, [chunkID, cx, cz, seedString]);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();

    if (fullWallMeshRef.current && fullWalls.length > 0) {
      fullWalls.forEach((inst: any, i: number) => {
        dummy.position.set(inst.position[0], inst.position[1], inst.position[2]);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        fullWallMeshRef.current.setMatrixAt(i, dummy.matrix);
      });
      fullWallMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (halfWallMeshRef.current && halfWalls.length > 0) {
      halfWalls.forEach((inst: any, i: number) => {
        dummy.position.set(inst.position[0], inst.position[1], inst.position[2]);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        halfWallMeshRef.current.setMatrixAt(i, dummy.matrix);
      });
      halfWallMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (lightMeshRef.current && lights.length > 0) {
      lights.forEach((inst: any, i: number) => {
        dummy.position.set(inst.position[0], inst.position[1], inst.position[2]);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        lightMeshRef.current.setMatrixAt(i, dummy.matrix);
      });
      lightMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [fullWalls, halfWalls, lights]);

  return (
    <group>
      {fullWalls.length > 0 && (
        <InstancedRigidBodies instances={fullWalls} type="fixed" colliders="cuboid">
          <instancedMesh ref={fullWallMeshRef} args={[undefined, undefined, fullWalls.length]}>
            <boxGeometry args={[TILE_SIZE, WALL_HEIGHT, TILE_SIZE]} />
            <meshStandardMaterial color="#dcd289" roughness={0.7} metalness={0.05} />
          </instancedMesh>
        </InstancedRigidBodies>
      )}

      {halfWalls.length > 0 && (
        <InstancedRigidBodies instances={halfWalls} type="fixed" colliders="cuboid">
          <instancedMesh ref={halfWallMeshRef} args={[undefined, undefined, halfWalls.length]}>
            <boxGeometry args={[TILE_SIZE, WALL_HEIGHT * 0.5, 0.3]} />
            <meshStandardMaterial color="#d4c980" roughness={0.7} metalness={0.05} />
          </instancedMesh>
        </InstancedRigidBodies>
      )}

      {lights.length > 0 && (
        <instancedMesh ref={lightMeshRef} args={[undefined, undefined, lights.length]}>
          <planeGeometry args={[1.4, 0.6]} />
          <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
        </instancedMesh>
      )}
    </group>
  );
}

// ============================================================================
// 4. PLAYER CONTROLLER WITH TOUCH LOOK & MOVE INTEGRATION
// ============================================================================
function PlayerController() {
  const playerRef = useRef<any>(null);
  const direction = new THREE.Vector3();
  const speed = 4.0;
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  useFrame(({ camera }) => {
    if (!playerRef.current) return;

    // Apply touch look rotation adjustments if active
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= touchLook.yaw;
    euler.x -= touchLook.pitch;
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
    camera.quaternion.setFromEuler(euler);

    // Reset delta look values after applying
    touchLook.yaw = 0;
    touchLook.pitch = 0;

    const currentVel = playerRef.current.linvel();
    const moveZ = Number(keys.s) - Number(keys.w);
    const moveX = Number(keys.d) - Number(keys.a);
    
    direction.set(moveX, 0, moveZ);
    direction.applyQuaternion(camera.quaternion);
    direction.y = 0; 
    direction.normalize().multiplyScalar(speed);
    
    playerRef.current.setLinvel({ x: direction.x, y: currentVel.y, z: direction.z }, true);

    const translation = playerRef.current.translation();
    camera.position.set(translation.x, translation.y + 0.5, translation.z);

    const playerChunkX = Math.floor(translation.x / CHUNK_SIZE);
    const playerChunkZ = Math.floor(translation.z / CHUNK_SIZE);

    const store: any = useGameStore.getState();
    if (playerChunkX !== store.currentChunk[0] || playerChunkZ !== store.currentChunk[1]) {
      store.updateChunk(playerChunkX, playerChunkZ);
    }
  });

  return (
    <RigidBody 
      ref={playerRef} 
      type="dynamic" 
      position={[16, 2, 16]} 
      enabledRotations={[false, false, false]} 
      mass={1}
      lockRotations={true}
      ccd={true}
    >
      <CapsuleCollider args={[0.4, 0.3]} />
    </RigidBody>
  );
}

// ============================================================================
// 5. MOBILE TOUCH CONTROLLER (JOYSTICK + SCREEN LOOK DRAG)
// ============================================================================
function MobileControls() {
  const [touchPos, setTouchPos] = useState({ x: 0, y: 0 });
  const [joystickActive, setJoystickActive] = useState(false);
  const joystickTouchIdRef = useRef<number | null>(null);
  const lookTouchIdRef = useRef<number | null>(null);
  const lastLookPos = useRef({ x: 0, y: 0 });
  const baseRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      // Left half of screen triggers joystick, right half triggers camera look
      if (touch.clientX < window.innerWidth / 2 && joystickTouchIdRef.current === null) {
        joystickTouchIdRef.current = touch.identifier;
        setJoystickActive(true);
        updateJoystick(touch.clientX, touch.clientY);
      } else if (touch.clientX >= window.innerWidth / 2 && lookTouchIdRef.current === null) {
        lookTouchIdRef.current = touch.identifier;
        lastLookPos.current = { x: touch.clientX, y: touch.clientY };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchIdRef.current) {
        updateJoystick(touch.clientX, touch.clientY);
      } else if (touch.identifier === lookTouchIdRef.current) {
        const dx = touch.clientX - lastLookPos.current.x;
        const dy = touch.clientY - lastLookPos.current.y;
        touchLook.yaw = dx * 0.005;
        touchLook.pitch = dy * 0.005;
        lastLookPos.current = { x: touch.clientX, y: touch.clientY };
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchIdRef.current) {
        joystickTouchIdRef.current = null;
        setJoystickActive(false);
        setTouchPos({ x: 0, y: 0 });
        keys.w = false;
        keys.s = false;
        keys.a = false;
        keys.d = false;
      } else if (touch.identifier === lookTouchIdRef.current) {
        lookTouchIdRef.current = null;
      }
    }
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    if (!baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = 40;

    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }

    setTouchPos({ x: dx, y: dy });

    const threshold = 10;
    keys.w = dy < -threshold;
    keys.s = dy > threshold;
    keys.a = dx < -threshold;
    keys.d = dx > threshold;
  };

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="absolute inset-0 z-20 touch-none pointer-events-auto"
    >
      {/* Visual representation of joystick container */}
      <div 
        ref={baseRef}
        className="absolute bottom-8 left-8 w-28 h-28 bg-black/20 border-2 border-white/30 rounded-full flex items-center justify-center backdrop-blur-sm pointer-events-none"
      >
        <div 
          className="w-12 h-12 bg-white/60 rounded-full shadow-md transition-transform duration-75"
          style={{ transform: `translate(${touchPos.x}px, ${touchPos.y}px)` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// 6. MAIN RENDER ENGINE
// ============================================================================
export default function GamePrototype() {
  const activeChunks = useGameStore((state: any) => state.activeChunks);
  const seed = useGameStore((state: any) => state.seed);

  return (
    <div className="w-screen h-screen bg-[#c7bd7b] select-none overflow-hidden relative">
      
      <div className="absolute top-6 left-6 z-10 text-zinc-700 font-mono pointer-events-none tracking-wider select-none">
        <p className="font-bold text-md text-zinc-800">LEVEL 0 - KINETIC CORE</p>
        <div className="mt-2 space-y-1 bg-white/60 p-4 rounded border border-yellow-600/20 backdrop-blur-md">
          <p>SEED: <span className="font-bold text-zinc-900">{seed}</span></p>
          <p>VITALITY: <span className="text-emerald-700 font-bold">40</span></p>
          <p>LUCIDITY: <span className="text-red-700 font-bold">60</span></p>
        </div>
      </div>
      
      <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-zinc-800/40 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"></div>

      {/* Responsive mobile controller layer (left joystick, right look-around drag) */}
      <MobileControls />

      <Canvas>
        <color attach="background" args={['#c7bd7b']} />
        
        <ambientLight intensity={1.1} color="#fff8c7" />
        <directionalLight position={[0, 10, 0]} intensity={0.4} color="#ffffff" />
        
        <Physics debug={false}>
          <group>
            {activeChunks.map((chunkID: string) => (
              <MazeChunk key={`chunk-${chunkID}`} chunkID={chunkID} seedString={seed} />
            ))}

            {/* Flat Mono Moist Carpet */}
            <RigidBody type="fixed" position={[16, -0.5, 16]}>
              <mesh>
                <boxGeometry args={[1000, 1, 1000]} />
                <meshStandardMaterial color="#c5b75b" roughness={0.9} />
              </mesh>
            </RigidBody>

            {/* Overhead Dropped Acoustic Ceiling */}
            <RigidBody type="fixed" position={[16, WALL_HEIGHT + 0.5, 16]}>
              <mesh>
                <boxGeometry args={[1000, 1, 1000]} />
                <meshStandardMaterial color="#bdae69" roughness={0.8} />
              </mesh>
            </RigidBody>
          </group>

          <PlayerController />
        </Physics>

        <PointerLockControls />
      </Canvas>
    </div>
  );
}