import React, { createContext, useContext, useState, useEffect } from "react";
import { C, MONO, SANS, DISPLAY } from "./constants.js";
import { EXPLAINERS } from "./explainers.js";

const Ctx = createContext(() => {});
export const useExplain = () => useContext(Ctx);

export function ExplainerProvider({ children }) {
  const [key, setKey] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setKey(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const item = key ? EXPLAINERS[key] : null;

  return (
    <Ctx.Provider value={setKey}>
      {children}
      {item && (
        <div
          onClick={() => setKey(null)}
          className="explain-backdrop"
          style={{
            position: "fixed", inset: 0, zIndex: 60, display: "flex",
            alignItems: "center", justifyContent: "center", padding: 24,
            background: "rgba(5,7,10,0.62)",
            WebkitBackdropFilter: "blur(7px)", backdropFilter: "blur(7px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="explain-card"
            style={{
              maxWidth: 460, width: "100%", background: "#10141A",
              border: `1px solid ${C.line}`, borderRadius: 14, padding: "22px 24px 24px",
              boxShadow: "0 24px 70px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <h3 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 20, color: C.text, letterSpacing: 0.3 }}>
                {item.title}
              </h3>
              <button
                onClick={() => setKey(null)}
                aria-label="Close"
                style={{
                  flexShrink: 0, width: 26, height: 26, borderRadius: 7, cursor: "pointer",
                  border: `1px solid ${C.line}`, background: "transparent", color: C.muted,
                  fontFamily: MONO, fontSize: 13, lineHeight: 1,
                }}
              >✕</button>
            </div>
            <div style={{ marginTop: 14, fontFamily: SANS, fontSize: 13.5, color: C.muted, lineHeight: 1.65 }}>
              {(Array.isArray(item.body) ? item.body : [item.body]).map((p, i) => (
                <p key={i} style={{ marginTop: i ? 12 : 0 }}>{p}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function InfoDot({ k, style }) {
  const open = useExplain();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); open(k); }}
      title="What's this?"
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 15, height: 15, marginLeft: 5, padding: 0, borderRadius: "50%",
        border: `1px solid ${C.faint}`, background: "transparent", color: C.faint,
        fontFamily: MONO, fontSize: 9.5, lineHeight: 1, cursor: "pointer",
        verticalAlign: "middle", transition: "color 0.15s, border-color 0.15s",
        ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.text; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = C.faint; e.currentTarget.style.borderColor = C.faint; }}
    >?</button>
  );
}
