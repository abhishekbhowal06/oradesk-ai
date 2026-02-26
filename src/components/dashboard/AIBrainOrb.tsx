import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const vertexShader = `
uniform float uTime;
uniform float uSpeed;
uniform float uActive;
attribute vec3 color;
varying vec3 vColor;

// Simplex 3D Noise
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 1.0/7.0;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}

void main() {
  vColor = color;
  float noise = snoise(position * 2.0 + uTime * uSpeed);
  
  // Create displacement based on active state to form wavy patterns
  vec3 newPosition = position + normal * (noise * 0.15 * max(0.2, uActive));
  
  vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
  
  // Points are generally larger to match the dots/squares look, scale with active
  float pSize = 5.0 + (uActive * 2.0);
  gl_PointSize = pSize * (15.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = `
varying vec3 vColor;
void main() {
  // Makes it square but slightly softer edges optionally
  gl_FragColor = vec4(vColor, 0.85);
}
`;

const ParticleOrb = ({ state }: { state: 'IDLE' | 'ACTIVE' | 'EMERGENCY' }) => {
    const meshRef = useRef<THREE.Points>(null);

    const [positions, colors] = useMemo(() => {
        // Generate uniform points on a sphere
        const geometry = new THREE.IcosahedronGeometry(2.5, 32);
        const count = geometry.attributes.position.count;
        const positions = geometry.attributes.position.array;
        const colors = new Float32Array(count * 3);

        // Gradient matching the image: Purple/Pink to Cyan/Teal
        const color1 = new THREE.Color('#d946ef'); // Pink/Purple
        const color2 = new THREE.Color('#06b6d4'); // Cyan
        const color3 = new THREE.Color('#0d5e5e'); // Deep Teal for branding tie-in

        for (let i = 0; i < count; i++) {
            const y = positions[i * 3 + 1];
            // y goes from -2.5 to 2.5 roughly
            const mixRatio = (y + 2.5) / 5;

            let mixedColor;
            if (state === 'EMERGENCY') {
                mixedColor = new THREE.Color('#ef4444').lerp(new THREE.Color('#fb923c'), mixRatio);
            } else {
                // Lerp between pink and cyan
                mixedColor = color1.clone().lerp(color2, mixRatio);
                // Blend a little teal for branding
                mixedColor.lerp(color3, 0.3);
            }

            colors[i * 3] = mixedColor.r;
            colors[i * 3 + 1] = mixedColor.g;
            colors[i * 3 + 2] = mixedColor.b;
        }

        return [positions, colors];
    }, [state]);

    const uniforms = useMemo(
        () => ({
            uTime: { value: 0 },
            uSpeed: { value: 0.15 },
            uActive: { value: 0.05 },
        }),
        []
    );

    useFrame((scene) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += 0.003;
            meshRef.current.rotation.x += 0.001;

            const mat = meshRef.current.material as THREE.ShaderMaterial;
            mat.uniforms.uTime.value = scene.clock.elapsedTime;

            // Smooth transitions for state changes
            const targetActive = state === 'ACTIVE' ? 1.5 : state === 'EMERGENCY' ? 2.5 : 0.05;
            const targetSpeed = state === 'ACTIVE' ? 0.6 : state === 'EMERGENCY' ? 1.2 : 0.15;

            mat.uniforms.uActive.value = THREE.MathUtils.lerp(mat.uniforms.uActive.value, targetActive, 0.05);
            mat.uniforms.uSpeed.value = THREE.MathUtils.lerp(mat.uniforms.uSpeed.value, targetSpeed, 0.05);
        }
    });

    return (
        <points ref={meshRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={positions.length / 3}
                    array={positions}
                    itemSize={3}
                />
                <bufferAttribute
                    attach="attributes-color"
                    count={colors.length / 3}
                    array={colors}
                    itemSize={3}
                />
            </bufferGeometry>
            <shaderMaterial
                blending={THREE.NormalBlending}
                depthWrite={false}
                fragmentShader={fragmentShader}
                vertexShader={vertexShader}
                uniforms={uniforms}
                vertexColors
                transparent
            />
        </points>
    );
};

export default function AIBrainOrb({ state = 'IDLE' }: { state?: 'IDLE' | 'ACTIVE' | 'EMERGENCY' }) {
    return (
        <div className="w-full h-full relative flex items-center justify-center">
            <Canvas camera={{ position: [0, 0, 7], fov: 45 }}>
                <ParticleOrb state={state} />
                <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
            </Canvas>
        </div>
    );
}
