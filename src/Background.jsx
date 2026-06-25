import React, { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { glitchBus } from "./glitchBus.js";

/* Slow-drifting white particle shell — ambient depth behind the instrument.
   Reacts to the title's glitch bursts (shared via glitchBus).            */
function Field() {
  const ref = useRef();      // parent group (white cloud + RGB ghosts)
  const cyanRef = useRef();
  const magRef = useRef();
  const glitchUntil = useRef(0);
  const nextStep = useRef(0); // next time to re-randomize (matches the title's cadence)

  useEffect(() => glitchBus.subscribe((d) => { glitchUntil.current = performance.now() + d; }), []);

  const geom = useMemo(() => {
    const N = 1300;
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 7 + Math.random() * 20;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = r * Math.sin(ph) * Math.cos(th);
      positions[i * 3 + 1] = r * Math.cos(ph) * 0.55;
      positions[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      const k = 0.55 + Math.random() * 0.45; // white, slight brightness variance
      colors[i * 3] = k; colors[i * 3 + 1] = k; colors[i * 3 + 2] = k;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);

  useFrame((state, dt) => {
    if (!ref.current) return;
    const now = performance.now();
    const burst = now < glitchUntil.current;
    const t = state.clock.elapsedTime;

    // constant base drift + parallax (no spin-up, no shake)
    ref.current.rotation.y += dt * 0.018;
    ref.current.rotation.x = Math.sin(t * 0.05) * 0.12;
    ref.current.position.x += (state.pointer.x * 1.2 - ref.current.position.x) * 0.02;
    ref.current.position.y += (state.pointer.y * 0.8 - ref.current.position.y) * 0.02;

    const cy = cyanRef.current, mg = magRef.current;
    if (!cy || !mg) return;

    if (burst) {
      // EXACT title behaviour: re-randomize on a jittery 16–50ms cadence, full
      // cyan/magenta colour, random dropouts. amplitude small (~10%) so it's subtle.
      if (now >= nextStep.current) {
        nextStep.current = now + (16 + Math.random() * 34);
        const amp = 0.03;
        const r = () => (Math.random() * 2 - 1) * amp;
        cy.position.set(r(), r() * 0.6, r()); cy.material.opacity = Math.random() < 0.82 ? 0.9 : 0;
        mg.position.set(r(), r() * 0.6, r()); mg.material.opacity = Math.random() < 0.82 ? 0.9 : 0;
      }
    } else if (cy.material.opacity !== 0) {
      cy.material.opacity = 0; mg.material.opacity = 0;
      cy.position.set(0, 0, 0); mg.position.set(0, 0, 0);
      nextStep.current = 0;
    }
  });

  return (
    <group ref={ref}>
      <points geometry={geom}>
        <pointsMaterial vertexColors size={0.085} sizeAttenuation transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <points ref={cyanRef} geometry={geom}>
        <pointsMaterial color="#2AD4D4" size={0.085} sizeAttenuation transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <points ref={magRef} geometry={geom}>
        <pointsMaterial color="#E84BD0" size={0.085} sizeAttenuation transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
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
