import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Html } from "@react-three/drei";
import * as THREE from "three";
import { C, MONO, SANS, DISPLAY } from "./constants.js";

/* ── surface domain ──────────────────────────────────────────────── */
const NX = 64, NY = 46;
const CTX_MIN = 1024, CTX_MAX = 1048576;
const W = 11, D = 11, H = 6;
const LOGMIN = Math.log(CTX_MIN), LOGMAX = Math.log(CTX_MAX);
const POP_CTX = [4096, 8192, 32768, 131072];
const RIB_SAMPLES = 38;
const FRONTIER_SAMPLES = 80;

const ktok = (n) =>
  n >= 1000000 ? (n / 1000000).toFixed(0) + "M"
  : n >= 1000 ? (n / 1000).toFixed(0) + "k"
  : String(Math.round(n));

/* memory-pressure colour ramp, keyed on (mem / ceiling) */
function ramp(r) {
  const stops = [
    [0.0, [0.16, 0.32, 0.50]],
    [0.6, [0.24, 0.52, 0.45]],
    [0.85, [0.79, 0.58, 0.18]],
    [1.0, [0.85, 0.42, 0.20]],
    [1.5, [0.86, 0.20, 0.20]],
  ];
  r = Math.max(0, Math.min(1.5, r));
  for (let i = 0; i < stops.length - 1; i++) {
    const [r0, c0] = stops[i], [r1, c1] = stops[i + 1];
    if (r <= r1) {
      const t = (r - r0) / (r1 - r0);
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    }
  }
  return stops[stops.length - 1][1];
}

function SurfaceMesh({ bpw, overhead, scratch, kvPerTokGB, ceiling, context, params, depthAxis, verdict }) {
  const isQuant = depthAxis === "quant";
  const DMIN = isQuant ? 4.25 : 0.5;
  const DMAX = isQuant ? 16 : 120;
  const slopeK = isQuant ? params / 8 : bpw / 8;
  const curDepth = isQuant ? bpw : params;
  const depthTitle = isQuant ? "quantization →" : "model size →";
  const depthRibs = isQuant
    ? [{ v: 4.25, l: "4-bit" }, { v: 6.25, l: "6-bit" }, { v: 8.5, l: "8-bit" }, { v: 16, l: "fp16" }]
    : [{ v: 7, l: "7B" }, { v: 13, l: "13B" }, { v: 30, l: "30B" }, { v: 70, l: "70B" }];

  const zClamp = ceiling * 2.4;
  const base = (ctx) => overhead + kvPerTokGB * ctx + scratch;
  const mem = (ctx, depth) => depth * slopeK + base(ctx);
  const hOf = (g) => (Math.min(g, zClamp) / zClamp) * H;
  const xOf = (ctx) => -W / 2 + W * ((Math.log(ctx) - LOGMIN) / (LOGMAX - LOGMIN));
  const zOf = (d) => -D / 2 + D * ((d - DMIN) / (DMAX - DMIN));
  const yOf = (ctx, d) => hOf(mem(ctx, d)) + 0.05;

  const planeY = hOf(ceiling); // always H/2.4 = 2.5

  /* geometry: cap surface at ceiling height, colour over-ceiling vertices red */
  const geom = useMemo(() => {
    const positions = new Float32Array(NX * NY * 3);
    const colors = new Float32Array(NX * NY * 3);
    const localPlaneY = (Math.min(ceiling, ceiling * 2.4) / (ceiling * 2.4)) * H;
    for (let j = 0; j < NY; j++) {
      const tz = j / (NY - 1);
      const d = DMIN + (DMAX - DMIN) * tz;
      for (let i = 0; i < NX; i++) {
        const tx = i / (NX - 1);
        const ctx = Math.exp(LOGMIN + (LOGMAX - LOGMIN) * tx);
        const g = mem(ctx, d);
        const idx = j * NX + i;
        positions[idx * 3] = -W / 2 + W * tx;
        // cap: over-ceiling vertices are flattened to planeY
        positions[idx * 3 + 1] = g > ceiling ? localPlaneY : (Math.min(g, zClamp) / zClamp) * H;
        positions[idx * 3 + 2] = -D / 2 + D * tz;
        // vivid red for over-ceiling, ramp for under
        const c = g > ceiling ? [0.92, 0.15, 0.15] : ramp(g / ceiling);
        colors[idx * 3] = c[0];
        colors[idx * 3 + 1] = c[1];
        colors[idx * 3 + 2] = c[2];
      }
    }
    const index = [];
    for (let j = 0; j < NY - 1; j++) {
      for (let i = 0; i < NX - 1; i++) {
        const a = j * NX + i, b = a + 1, c = a + NX, d2 = c + 1;
        index.push(a, c, b, b, c, d2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  }, [bpw, params, overhead, scratch, kvPerTokGB, ceiling, depthAxis]);

  const frontier = useMemo(() => {
    const pts = [];
    for (let i = 0; i < FRONTIER_SAMPLES; i++) {
      const ctx = Math.exp(LOGMIN + (LOGMAX - LOGMIN) * (i / (FRONTIER_SAMPLES - 1)));
      const dStar = (ceiling - base(ctx)) / slopeK;
      if (dStar >= DMIN && dStar <= DMAX) pts.push([xOf(ctx), planeY + 0.03, zOf(dStar)]);
    }
    return pts;
  }, [bpw, params, overhead, scratch, kvPerTokGB, ceiling, depthAxis]);

  const redlineRef = useRef(null);
  const glintRef = useRef(null);
  const ribRefs = useRef({});
  const frontierLineRef = useRef(null);
  const frontierGlowRef = useRef(null);
  const redPlaneRef = useRef(null);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;

    // more noticeable jiggle with a second harmonic for organic feel
    if (redlineRef.current) {
      const bob = Math.sin(t * (Math.PI * 2 / 1.6)) * (planeY * 0.028)
        + Math.sin(t * 0.73) * (planeY * 0.010);
      redlineRef.current.position.y = bob;
    }

    // red plane breathes in opacity
    if (redPlaneRef.current?.material) {
      redPlaneRef.current.material.opacity = 0.13 + 0.07 * Math.sin(t * 1.25);
    }

    // frontier line pulses in opacity
    if (frontierLineRef.current?.material) {
      frontierLineRef.current.material.opacity = 0.80 + 0.20 * Math.abs(Math.sin(t * 2.8));
    }

    // wide glow halo pulses and travels
    if (frontierGlowRef.current?.material) {
      frontierGlowRef.current.material.opacity = 0.12 + 0.14 * Math.abs(Math.sin(t * 1.9));
    }

    // travelling shimmer
    if (glintRef.current?.material) {
      glintRef.current.material.dashOffset -= dt * 1.2;
      glintRef.current.material.opacity = 0.30 + 0.18 * Math.sin(t * 2.2);
    }

    // phase-staggered rib pulse
    let i = 0;
    for (const key in ribRefs.current) {
      const el = ribRefs.current[key];
      if (el?.material) el.material.opacity = 0.6 + 0.08 * Math.sin(t * 2.2 - i * 0.6);
      i++;
    }
  });

  const mx = xOf(Math.max(CTX_MIN, Math.min(CTX_MAX, context)));
  const mz = zOf(Math.max(DMIN, Math.min(DMAX, curDepth)));
  const cur = mem(context, curDepth);
  const my = hOf(cur);
  const over = cur > ceiling;
  const dot = verdict
    ? (verdict.state === "green" ? C.ok : verdict.state === "amber" ? C.warn : C.oom)
    : (over ? C.oom : C.ok);
  const vMsg = verdict?.msg || "";
  const vHead = vMsg.split(/(?<=\.)\s+/)[0] || vMsg;
  const vBody = vMsg.slice(vHead.length).trim();

  return (
    <>
      {/* the surface */}
      <mesh geometry={geom}>
        <meshStandardMaterial vertexColors roughness={0.5} metalness={0.18} side={THREE.DoubleSide} envMapIntensity={0.4} />
      </mesh>
      {/* wireframe overlay */}
      <mesh geometry={geom}>
        <meshBasicMaterial wireframe color="#05070A" transparent opacity={0.12} />
      </mesh>

      {/* redline group — plane + frontier bob together */}
      <group ref={redlineRef}>
        <mesh ref={redPlaneRef} rotation-x={-Math.PI / 2} position-y={planeY}>
          <planeGeometry args={[W * 1.08, D * 1.08]} />
          <meshBasicMaterial color={C.oom} transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>

        {frontier.length > 1 && (
          <>
            {/* wide glow halo behind the frontier */}
            <Line ref={frontierGlowRef} points={frontier} color="#FF4444" lineWidth={14}
              transparent opacity={0.14} depthWrite={false} />
            {/* bold main frontier line */}
            <Line ref={frontierLineRef} points={frontier} color={C.oom} lineWidth={4.5} transparent opacity={0.90} />
            {/* travelling shimmer */}
            <Line ref={glintRef} points={frontier} color="#FFAAAA" lineWidth={2.0}
              dashed dashSize={0.45} gapSize={1.8} transparent opacity={0.3} />
          </>
        )}
      </group>

      {/* operating-point marker */}
      <Line points={[[mx, 0, mz], [mx, my, mz]]} color={dot} lineWidth={1.5} dashed dashScale={3} />
      <mesh position={[mx, my, mz]}>
        <sphereGeometry args={[0.17, 20, 20]} />
        <meshStandardMaterial color={dot} emissive={dot} emissiveIntensity={0.9} />
      </mesh>
      {vMsg && (
        <Html position={[mx, my, mz]} zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
          <div className="marker-callout" style={{
            transform: "translate(16px, -118%)", width: 198, pointerEvents: "auto",
            background: "rgba(12,15,20,0.5)", border: `1px solid ${dot}33`, borderLeft: `2px solid ${dot}`,
            borderRadius: 9, padding: "9px 11px",
            WebkitBackdropFilter: "blur(3px)", backdropFilter: "blur(3px)",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: 7, background: dot, boxShadow: `0 0 8px ${dot}`, flexShrink: 0, transform: "translateY(1px)" }} />
              <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, color: dot, lineHeight: 1.25 }}>
                {vHead}
              </span>
            </div>
            {vBody && (
              <div style={{ fontFamily: SANS, fontSize: 10.5, color: "#C9CDD4", marginTop: 5, lineHeight: 1.45 }}>
                {vBody}
              </div>
            )}
          </div>
        </Html>
      )}

      {/* popular context ribs */}
      {POP_CTX.map((c) => {
        const x = xOf(c);
        const pts = Array.from({ length: RIB_SAMPLES }, (_, k) => {
          const d = DMIN + (DMAX - DMIN) * (k / (RIB_SAMPLES - 1));
          return [x, yOf(c, d), zOf(d)];
        });
        return (
          <React.Fragment key={"cr" + c}>
            <Line ref={(el) => { if (el) ribRefs.current["c" + c] = el; }} points={pts} color={C.kv} lineWidth={1.3} transparent opacity={0.6} />
            <Html position={[x, yOf(c, DMAX) + 0.18, zOf(DMAX) + 0.2]} center distanceFactor={13} style={ribS(C.kv)}>
              {ktok(c)}
            </Html>
          </React.Fragment>
        );
      })}
      {/* popular depth ribs */}
      {depthRibs.map((r) => {
        const z = zOf(r.v);
        const pts = Array.from({ length: RIB_SAMPLES }, (_, k) => {
          const ctx = Math.exp(LOGMIN + (LOGMAX - LOGMIN) * (k / (RIB_SAMPLES - 1)));
          return [xOf(ctx), yOf(ctx, r.v), z];
        });
        return (
          <React.Fragment key={"dr" + r.v}>
            <Line ref={(el) => { if (el) ribRefs.current["d" + r.v] = el; }} points={pts} color={C.weights} lineWidth={1.3} transparent opacity={0.6} />
            <Html position={[xOf(CTX_MAX) + 0.25, yOf(CTX_MAX, r.v) + 0.18, z]} center distanceFactor={13} style={ribS(C.weights)}>
              {r.l}
            </Html>
          </React.Fragment>
        );
      })}

      {/* axis titles */}
      <Html position={[xOf(CTX_MIN) - 0.7, -0.55, D / 2 + 0.55]} center distanceFactor={13} style={labelS(C.kv)}>context →</Html>
      <Html position={[W / 2 + 0.7, -0.55, zOf(DMIN) - 0.55]} center distanceFactor={13} style={labelS(C.weights)}>{depthTitle}</Html>
      <Html position={[-W / 2 - 0.7, H * 0.62, -D / 2]} center distanceFactor={13} style={labelS(C.muted)}>GB ↑</Html>
      <Html position={[xOf(CTX_MIN), -0.25, D / 2 + 0.35]} center distanceFactor={15} style={tickS}>1k</Html>
      <Html position={[xOf(CTX_MAX), -0.25, D / 2 + 0.35]} center distanceFactor={15} style={tickS}>1M</Html>
      <Html position={[W / 2 * 1.08, planeY + 0.35, D / 2 * 1.08]} center distanceFactor={13} style={labelS(C.oom)}>
        redline {ceiling < 10 ? ceiling.toFixed(1) : ceiling.toFixed(0)}
      </Html>
    </>
  );
}

const labelS = (color) => ({
  fontFamily: MONO, fontSize: 11, color, letterSpacing: 1.5, textTransform: "uppercase",
  whiteSpace: "nowrap", pointerEvents: "none", textShadow: "0 1px 4px #000",
});
const tickS = {
  fontFamily: MONO, fontSize: 10, color: C.faint, whiteSpace: "nowrap",
  pointerEvents: "none", textShadow: "0 1px 4px #000",
};
const ribS = (color) => ({
  fontFamily: DISPLAY, fontWeight: 600, fontSize: 10.5, color, whiteSpace: "nowrap",
  pointerEvents: "none", letterSpacing: 0.5,
  textShadow: "0 1px 5px #000, 0 0 8px #000",
});

export default function Surface(props) {
  const cur = props.depthAxis === "quant" ? props.bpw : props.params;
  const slopeK = props.depthAxis === "quant" ? props.params / 8 : props.bpw / 8;
  const over = cur * slopeK + props.overhead + props.kvPerTokGB * props.context + props.scratch > props.ceiling;
  return (
    <div style={{ position: "relative", width: "100%", height: props.height || 380, zIndex: 30 }}>
      <div style={{ position: "absolute", inset: "0 -30px -30px -30px" }}>
        {/* camera starts at the low-context / low-depth diagonal corner */}
        <Canvas camera={{ position: [-11, 9.5, -12.5], fov: 36 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ width: "100%", height: "100%", overflow: "visible" }}>
          <ambientLight intensity={0.75} />
          <directionalLight position={[6, 13, 8]} intensity={0.95} />
          <pointLight position={[-9, 6, -7]} color={C.kv} intensity={0.45} />
          <group position={[0, -1.6, 0]}>
            <SurfaceMesh {...props} />
          </group>
          <OrbitControls
            enablePan={false} enableZoom
            autoRotate autoRotateSpeed={0.45}
            minDistance={10} maxDistance={28}
            minPolarAngle={0.25} maxPolarAngle={1.45}
            target={[0, 0.4, 0]} enableDamping dampingFactor={0.08}
          />
        </Canvas>
      </div>

      {/* overlay legend */}
      <div style={{ position: "absolute", left: 12, top: 12, display: "flex", alignItems: "center", gap: 8, pointerEvents: "none" }}>
        <div style={{ width: 64, height: 7, borderRadius: 4, background: "linear-gradient(90deg,#2A5280,#3E8572,#C9942E,#D9663A,#D23B3B)" }} />
        <span style={{ fontFamily: MONO, fontSize: 9.5, color: C.faint, letterSpacing: 0.5 }}>room → over</span>
      </div>
      <div style={{ position: "absolute", left: 12, top: 30, display: "flex", alignItems: "center", gap: 8, pointerEvents: "none" }}>
        <div style={{ width: 18, height: 2.5, background: C.oom, boxShadow: `0 0 6px ${C.oom}` }} />
        <span style={{ fontFamily: MONO, fontSize: 9.5, color: C.faint, letterSpacing: 0.5 }}>redline frontier</span>
      </div>
      <div style={{ position: "absolute", right: 12, bottom: 10, fontFamily: MONO, fontSize: 9.5, color: over ? C.oom : C.faint, letterSpacing: 0.5, pointerEvents: "none" }}>
        ● your build · drag to orbit
      </div>
    </div>
  );
}
