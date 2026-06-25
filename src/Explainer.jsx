import React, { createContext, useContext, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { C, MONO, SANS, DISPLAY } from "./constants.js";
import { EXPLAINERS } from "./explainers.js";

/* markdown → styled elements matching the dark explainer card */
export const MD_COMPONENTS = {
  p:      ({ node, ...p }) => <p style={{ margin: "10px 0 0", lineHeight: 1.65 }} {...p} />,
  strong: ({ node, ...p }) => <strong style={{ color: C.text, fontWeight: 600 }} {...p} />,
  h3:     ({ node, ...p }) => <h4 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, letterSpacing: 0.5, textTransform: "uppercase", color: C.muted, margin: "18px 0 2px" }} {...p} />,
  h4:     ({ node, ...p }) => <h4 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, letterSpacing: 0.5, textTransform: "uppercase", color: C.muted, margin: "18px 0 2px" }} {...p} />,
  ul:     ({ node, ...p }) => <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.6 }} {...p} />,
  li:     ({ node, ...p }) => <li style={{ margin: "4px 0" }} {...p} />,
  code:   ({ node, ...p }) => <code style={{ fontFamily: MONO, fontSize: 12, color: C.kv, background: "rgba(201,148,46,0.10)", padding: "1px 5px", borderRadius: 4 }} {...p} />,
  a:      ({ node, ...p }) => <a style={{ color: C.weights }} target="_blank" rel="noopener noreferrer" {...p} />,
  blockquote: ({ node, ...p }) => <blockquote style={{ margin: "12px 0 0", paddingLeft: 12, borderLeft: `2px solid ${C.line}`, color: C.faint, fontSize: 12.5 }} {...p} />,
  table:  ({ node, ...p }) => <table style={{ width: "100%", borderCollapse: "collapse", margin: "12px 0 0", fontSize: 12.5 }} {...p} />,
  th:     ({ node, ...p }) => <th style={{ textAlign: "left", padding: "5px 8px", borderBottom: `1px solid ${C.line}`, color: C.muted, fontFamily: MONO, fontWeight: 500 }} {...p} />,
  td:     ({ node, ...p }) => <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.line}11` }} {...p} />,
};

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
            <div style={{ marginTop: 8, fontFamily: SANS, fontSize: 13.5, color: C.muted, lineHeight: 1.65, maxHeight: "62vh", overflowY: "auto" }}>
              <ReactMarkdown components={MD_COMPONENTS}>{item.body}</ReactMarkdown>
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
