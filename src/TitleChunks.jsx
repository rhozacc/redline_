import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";

/* Low-poly shards tumbling around the REDLINE wordmark. */
const PALETTE = ["#5B7A99", "#C9942E", "#D23B3B", "#8A9099", "#B5642A"];

function Chunks() {
  const group = useRef();
  const refs = useRef([]);

  const chunks = useMemo(() => {
    const N = 17;
    return Array.from({ length: N }, (_, i) => ({
      pos: [(Math.random() * 2 - 1) * 5.6, (Math.random() * 2 - 1) * 1.9, (Math.random() * 2 - 1) * 2.6],
      scale: 0.11 + Math.random() * 0.3,
      geo: i % 4,
      color: PALETTE[i % PALETTE.length],
      rot: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
      spin: [(Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7],
      phase: Math.random() * Math.PI * 2,
      amp: 0.08 + Math.random() * 0.22,
    }));
  }, []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    chunks.forEach((c, i) => {
      const m = refs.current[i];
      if (!m) return;
      m.rotation.x += c.spin[0] * dt;
      m.rotation.y += c.spin[1] * dt;
      m.rotation.z += c.spin[2] * dt;
      m.position.y = c.pos[1] + Math.sin(t * 0.6 + c.phase) * c.amp;
    });
    if (group.current) {
      group.current.rotation.y = Math.sin(t * 0.1) * 0.14 + state.pointer.x * 0.26;
      group.current.rotation.x = -state.pointer.y * 0.16;
    }
  });

  const geoFor = (k) =>
    k === 0 ? <icosahedronGeometry args={[1, 0]} />
    : k === 1 ? <octahedronGeometry args={[1, 0]} />
    : k === 2 ? <tetrahedronGeometry args={[1, 0]} />
    : <dodecahedronGeometry args={[1, 0]} />;

  return (
    <group ref={group}>
      {chunks.map((c, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} position={c.pos} rotation={c.rot} scale={c.scale}>
          {geoFor(c.geo)}
          <meshStandardMaterial color={c.color} roughness={0.42} metalness={0.32} flatShading />
        </mesh>
      ))}
    </group>
  );
}

export default function TitleChunks() {
  return (
    <div style={{ position: "absolute", inset: "-22px -50px -22px -34px", zIndex: 0, pointerEvents: "none" }}>
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }} gl={{ antialias: true, alpha: true }} dpr={[1, 2]}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 4]} intensity={1.15} />
        <pointLight position={[-4, -2, 2]} color="#C9942E" intensity={0.5} />
        <Chunks />
      </Canvas>
    </div>
  );
}
