import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* Slow-drifting particle shell — ambient depth behind the instrument.
   Tinted with the palette (weights-blue, kv-amber, redline-red).        */
function Field() {
  const ref = useRef();

  const { positions, colors, sizes } = useMemo(() => {
    const N = 1300;
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    const palette = [
      [0.36, 0.48, 0.60], // weights
      [0.79, 0.58, 0.18], // kv
      [0.82, 0.23, 0.23], // redline
      [0.55, 0.60, 0.68], // cool grey
    ];
    for (let i = 0; i < N; i++) {
      // distribute across a wide flattened shell
      const r = 7 + Math.random() * 20;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = r * Math.sin(ph) * Math.cos(th);
      positions[i * 3 + 1] = r * Math.cos(ph) * 0.55;
      positions[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      const c = palette[(Math.random() * palette.length) | 0];
      const k = 0.3 + Math.random() * 0.55;
      colors[i * 3]     = c[0] * k;
      colors[i * 3 + 1] = c[1] * k;
      colors[i * 3 + 2] = c[2] * k;
      sizes[i] = 0.03 + Math.random() * 0.09;
    }
    return { positions, colors, sizes };
  }, []);

  useFrame((state, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.018;
    const t = state.clock.elapsedTime;
    ref.current.rotation.x = Math.sin(t * 0.05) * 0.12;
    // gentle parallax toward the pointer
    ref.current.position.x += (state.pointer.x * 1.2 - ref.current.position.x) * 0.02;
    ref.current.position.y += (state.pointer.y * 0.8 - ref.current.position.y) * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        size={0.085}
        sizeAttenuation
        transparent
        opacity={0.62}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function Background() {
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }}>
        <Canvas camera={{ position: [0, 0, 20], fov: 60 }} gl={{ antialias: true, alpha: true }} dpr={[1, 2]}>
          <Field />
        </Canvas>
      </div>
      <div className="bg-scrim" />
    </>
  );
}
