import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Float, Environment } from '@react-three/drei';
import * as THREE from 'three';

interface MorphingSphereProps {
  isListening: boolean;
  isSpeaking: boolean;
  isConnecting: boolean;
  audioLevel?: number;
}

function MorphingSphere({ isListening, isSpeaking, isConnecting, audioLevel = 0 }: MorphingSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);
  
  // Color palette - Midnight Teal to Champagne Gold
  const baseColor = useMemo(() => new THREE.Color('#0d3a4a'), []);
  const activeColor = useMemo(() => new THREE.Color('#1a5a6a'), []);
  const goldColor = useMemo(() => new THREE.Color('#c9a227'), []);
  
  useFrame((state) => {
    if (!meshRef.current || !materialRef.current) return;
    
    const time = state.clock.getElapsedTime();
    
    // Rotation - slow spin, faster when speaking
    const rotationSpeed = isSpeaking ? 0.8 : isListening ? 0.4 : 0.2;
    meshRef.current.rotation.y = time * rotationSpeed;
    meshRef.current.rotation.x = Math.sin(time * 0.3) * 0.1;
    
    // Scale breathing effect
    const baseScale = 1;
    const breathingAmplitude = isListening ? 0.03 : isSpeaking ? 0.08 + audioLevel * 0.1 : 0.02;
    const breathingSpeed = isSpeaking ? 4 : isListening ? 3 : 1.5;
    const scale = baseScale + Math.sin(time * breathingSpeed) * breathingAmplitude;
    meshRef.current.scale.setScalar(scale);
    
    // Distortion - more organic when speaking
    if (materialRef.current) {
      const baseDistort = isConnecting ? 0.6 : isListening ? 0.25 : isSpeaking ? 0.4 + audioLevel * 0.3 : 0.3;
      materialRef.current.distort = baseDistort + Math.sin(time * 2) * 0.05;
      
      // Color transition
      let targetColor = baseColor;
      if (isConnecting) {
        // Flickering between colors
        const flicker = Math.sin(time * 10) > 0;
        targetColor = flicker ? activeColor : goldColor;
      } else if (isSpeaking) {
        targetColor = goldColor;
      } else if (isListening) {
        targetColor = activeColor;
      }
      
      materialRef.current.color.lerp(targetColor, 0.1);
    }
  });
  
  return (
    <Float
      speed={isConnecting ? 4 : 2}
      rotationIntensity={isConnecting ? 0.5 : 0.2}
      floatIntensity={isConnecting ? 1.5 : 0.5}
    >
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1, 4]} />
        <MeshDistortMaterial
          ref={materialRef}
          color="#0d3a4a"
          roughness={0.2}
          metalness={0.8}
          distort={0.3}
          speed={2}
          envMapIntensity={1}
        />
      </mesh>
      
      {/* Inner glow */}
      <mesh scale={0.85}>
        <icosahedronGeometry args={[1, 3]} />
        <meshBasicMaterial 
          color="#c9a227" 
          transparent 
          opacity={isSpeaking ? 0.3 : isListening ? 0.15 : 0.08}
        />
      </mesh>
    </Float>
  );
}

function ParticleRing({ isActive }: { isActive: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  
  const particles = useMemo(() => {
    const count = 100;
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 1.8 + Math.random() * 0.3;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    
    return positions;
  }, []);
  
  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.getElapsedTime() * (isActive ? 0.5 : 0.1);
  });
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.length / 3}
          array={particles}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#c9a227"
        size={0.03}
        transparent
        opacity={isActive ? 0.8 : 0.3}
        sizeAttenuation
      />
    </points>
  );
}

interface AIAvatarOrbProps {
  isListening?: boolean;
  isSpeaking?: boolean;
  isConnecting?: boolean;
  audioLevel?: number;
  className?: string;
}

export function AIAvatarOrb({
  isListening = false,
  isSpeaking = false,
  isConnecting = false,
  audioLevel = 0,
  className = '',
}: AIAvatarOrbProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Glow effect background */}
      <div 
        className="absolute inset-0 rounded-full blur-3xl transition-all duration-500"
        style={{
          background: isSpeaking 
            ? 'radial-gradient(circle, hsl(43 67% 52% / 0.3) 0%, transparent 70%)'
            : isListening
            ? 'radial-gradient(circle, hsl(195 100% 30% / 0.3) 0%, transparent 70%)'
            : 'radial-gradient(circle, hsl(195 100% 20% / 0.2) 0%, transparent 70%)',
        }}
      />
      
      <Canvas
        camera={{ position: [0, 0, 4], fov: 45 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1} color="#ffffff" />
        <pointLight position={[-5, -5, 5]} intensity={0.5} color="#c9a227" />
        
        <MorphingSphere
          isListening={isListening}
          isSpeaking={isSpeaking}
          isConnecting={isConnecting}
          audioLevel={audioLevel}
        />
        
        <ParticleRing isActive={isListening || isSpeaking || isConnecting} />
        
        <Environment preset="city" />
      </Canvas>
      
      {/* Status indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <span 
          className={`h-2 w-2 rounded-full transition-all duration-300 ${
            isConnecting 
              ? 'bg-warning animate-pulse' 
              : isSpeaking 
              ? 'bg-primary animate-pulse' 
              : isListening 
              ? 'bg-info animate-pulse' 
              : 'bg-muted-foreground/50'
          }`}
        />
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          {isConnecting ? 'Connecting...' : isSpeaking ? 'Speaking' : isListening ? 'Listening' : 'Idle'}
        </span>
      </div>
    </div>
  );
}
