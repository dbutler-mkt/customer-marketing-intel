import { useState, useEffect, useRef, useCallback } from "react";

const COMPANIES = [
  { id: "notion",   name: "Notion",      color: "#888",    emoji: "◼" },
  { id: "airtable", name: "Airtable",    color: "#F82B60", emoji: "◈" },
  { id: "canva",    name: "Canva",       color: "#00C4CC", emoji: "◉" },
  { id: "figma",    name: "Figma",       color: "#A259FF", emoji: "◐" },
  { id: "miro",     name: "Miro",        color: "#FFD02F", emoji: "◑" },
  { id: "asana",    name: "Asana",       color: "#F06A6A", emoji: "◍" },
  { id: "monday",   name: "Monday.com",  color: "#FF3D57", emoji: "◎" },
  { id: "hubspot",  name: "HubSpot",     color: "#FF7A59", emoji: "◆" },
];

const FOCUS_AREAS = [
  { id: "advocacy",     label: "Customer Advocacy" },
  { id: "champion",     label: "Champion Programs" },
  { id: "case_studies", label: "Case Studies" },
  { id: "community",    label: "Community Programs" },
  { id: "events",       label: "Customer Events" },
  { id: "ambassador",   label: "Ambassador Programs" },
];

// Stages with realistic timing weights (total ~12s)
const STAGES = [
  { label: "Connecting to search",  pct: 8,  duration: 800  },
  { label: "Searching the web",     pct: 35, duration: 5000 },
  { label: "Reading results",       pct: 60, duration: 3000 },
  { label: "Analyzing programs",    pct: 80, duration: 2000 },
  { label: "Building summary",      pct: 93, duration: 1500 },
];

const CACHE = {};

// ── API ─────────────────────────────────────────────────────────────────────
async function fetchIntel(company, focusArea, deep = false) {
  const systemPrompt = deep
    ? `You are a customer marketing intelligence analyst for B2B SaaS. Search the web then respond. End your response with a JSON block in <json> tags:
<json>{"summary":"3-4 sentence overview","highlights":["finding 1","finding 2","finding 3","finding 4","finding 5"],"trend":"sharp strategic insight","programs":[{"name":"name","description":"what it does","status":"active"}],"takeaway":"so-what for a competitor's customer marketing leader","maturity":"emerging"}</json>
maturity must be: emerging, growing, or mature`
    : `You are a customer marketing intelligence analyst for B2B SaaS. Search the web then respond. End your response with a JSON block in <json> tags:
<json>{"summary":"2-3 sentence overview","highlights":["finding 1","finding 2","finding 3"],"trend":"one sharp strategic insight","maturity":"emerging"}</json>
maturity must be: emerging, growing, or mature`;

  const res = await fetch("/api/anthropic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: deep ? 2000 : 1200,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: systemPrompt,
      messages: [{
        role: "user",
        content: `Research ${company.name}'s "${focusArea.label}" customer marketing programs. Find real program names, how they work, and recent announcements. Provide your analysis in the required JSON format.`,
      }],
    }),
  });

  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  const allText = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
  if (!allText) throw new Error("No text in response");

  const tagged = allText.match(/<json>([\s\S]*?)<\/json>/);
  if (tagged) return JSON.parse(tagged[1].trim());

  const lb = allText.lastIndexOf("}"), fb = allText.lastIndexOf("{", lb);
  if (fb !== -1 && lb !== -1) return JSON.parse(allText.slice(fb, lb + 1));
  throw new Error("No JSON found");
}

// ── Progress bar hook ────────────────────────────────────────────────────────
function useProgress(isLoading, accentColor) {
  const [pct, setPct]       = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const timerRef = useRef(null);
  const stageRef = useRef(0);

  useEffect(() => {
    if (!isLoading) {
      if (pct > 0) {
        setPct(100);
        setTimeout(() => { setPct(0); setStageIdx(0); stageRef.current = 0; }, 500);
      }
      return;
    }
    setPct(0); setStageIdx(0); stageRef.current = 0;

    const advance = () => {
      const idx = stageRef.current;
      if (idx >= STAGES.length) return;
      const stage = STAGES[idx];
      setPct(stage.pct);
      setStageIdx(idx);
      stageRef.current = idx + 1;
      timerRef.current = setTimeout(advance, stage.duration);
    };
    timerRef.current = setTimeout(advance, 100);
    return () => clearTimeout(timerRef.current);
  }, [isLoading]);

  return { pct, stageLabel: STAGES[stageIdx]?.label || "" };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function matColor(m) {
  return m === "mature" ? "#E8FF47" : m === "growing" ? "#88ffcc" : "#ff9944";
}
function accent(c) {
  return ["#000000","#888","#111"].includes(c.color) ? "#E8FF47" : c.color;
}

function Badge({ label, color }) {
  return (
    <span style={{
      background: color, color: "#000", fontSize: "9px",
      fontFamily: "'DM Mono',monospace", padding: "3px 8px",
      borderRadius: "3px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: "700",
    }}>{label}</span>
  );
}

// ── Loading card with staged progress bar ────────────────────────────────────
function LoadingCard({ company, focusArea }) {
  const ac = accent(company);
  const { pct, stageLabel } = useProgress(true, ac);

  return (
    <div style={card}>
      <div style={{ display:"flex", alignItems:"center", gap:"9px", marginBottom:"20px" }}>
        <span style={{ fontSize:"14px" }}>{company.emoji}</span>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"15px", color:"#e0e0e0", fontWeight:600 }}>
            {company.name}
          </div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", color:"#383838", textTransform:"uppercase", letterSpacing:"0.1em", marginTop:"1px" }}>
            {focusArea.label}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom:"10px" }}>
        <div style={{ height:"2px", background:"#181818", borderRadius:"2px", overflow:"hidden", marginBottom:"8px" }}>
          <div style={{
            height:"100%", width:`${pct}%`,
            background: `linear-gradient(90deg, ${ac}88, ${ac})`,
            borderRadius:"2px",
            transition:"width 0.8s cubic-bezier(0.4,0,0.2,1)",
            boxShadow:`0 0 8px ${ac}66`,
          }}/>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ color:"#333", fontSize:"10px", fontFamily:"'DM Mono',monospace" }}>{stageLabel}</span>
          <span style={{ color:"#2a2a2a", fontSize:"10px", fontFamily:"'DM Mono',monospace" }}>{pct}%</span>
        </div>
      </div>

      {/* Shimmer lines */}
      <div style={{ marginTop:"18px" }}>
        {[80, 60, 70, 45].map((w, i) => (
          <div key={i} style={{
            height:"9px", width:`${w}%`, background:"#141414",
            borderRadius:"3px", marginBottom:"8px",
            animation:`shimmer 1.8s ease-in-out ${i*0.15}s infinite`,
          }}/>
        ))}
      </div>
    </div>
  );
}

// ── Intel card ───────────────────────────────────────────────────────────────
function IntelCard({ company, focusArea, data, error, onDrillDown }) {
  const ac = accent(company);

  if (error) return (
    <div style={{ ...card, borderColor:"#220e0e" }}>
      <div style={{ color:"#ff4444", fontSize:"11px", fontFamily:"'DM Mono',monospace" }}>✕ Could not retrieve intel</div>
    </div>
  );

  if (!data) return null;

  return (
    <div style={card}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"13px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"9px" }}>
          <span style={{ fontSize:"14px" }}>{company.emoji}</span>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"15px", color:"#e8e8e8", fontWeight:600 }}>{company.name}</div>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", color:"#383838", textTransform:"uppercase", letterSpacing:"0.1em", marginTop:"1px" }}>{focusArea.label}</div>
          </div>
        </div>
        <Badge label={data.maturity} color={matColor(data.maturity)} />
      </div>

      <p style={{ color:"#888", fontSize:"12px", lineHeight:"1.65", fontFamily:"'DM Sans',sans-serif", marginBottom:"13px" }}>{data.summary}</p>

      <div style={{ marginBottom:"13px" }}>
        {(data.highlights||[]).slice(0,3).map((h,i) => (
          <div key={i} style={{ display:"flex", gap:"8px", marginBottom:"6px" }}>
            <span style={{ color:ac, fontSize:"9px", marginTop:"3px", flexShrink:0 }}>▸</span>
            <span style={{ color:"#666", fontSize:"11px", fontFamily:"'DM Sans',sans-serif", lineHeight:"1.5" }}>{h}</span>
          </div>
        ))}
      </div>

      {data.trend && (
        <div style={{ borderTop:"1px solid #181818", paddingTop:"10px", marginBottom:"13px", display:"flex", gap:"7px" }}>
          <span style={{ color:"#E8FF47", fontSize:"9px", marginTop:"2px" }}>◈</span>
          <span style={{ color:"#E8FF47", fontSize:"10px", fontFamily:"'DM Mono',monospace", lineHeight:"1.5", fontStyle:"italic" }}>{data.trend}</span>
        </div>
      )}

      <button onClick={onDrillDown}
        style={{
          width:"100%", background:"transparent", border:`1px solid ${ac}2a`, color:ac,
          padding:"7px", borderRadius:"4px", fontSize:"9px", fontFamily:"'DM Mono',monospace",
          textTransform:"uppercase", letterSpacing:"0.1em", cursor:"pointer", transition:"all 0.15s",
        }}
        onMouseEnter={e=>{ e.currentTarget.style.background=`${ac}12`; e.currentTarget.style.borderColor=`${ac}88`; }}
        onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor=`${ac}2a`; }}
      >↳ Deep Dive</button>
    </div>
  );
}

const card = {
  background:"#0d0d0d", border:"1px solid #191919",
  borderRadius:"8px", padding:"17px", transition:"border-color 0.2s",
};

// ── Deep modal ───────────────────────────────────────────────────────────────
function DeepModal({ company, focusArea, onClose }) {
  const [state, setState] = useState("loading");
  const [data, setData]   = useState(null);
  const [errMsg, setErr]  = useState("");
  const ckey = `deep-${company.id}-${focusArea.id}`;
  const ac = accent(company);
  const { pct, stageLabel } = useProgress(state === "loading", ac);

  useEffect(() => {
    if (CACHE[ckey]) { setData(CACHE[ckey]); setState("done"); return; }
    fetchIntel(company, focusArea, true)
      .then(d => { CACHE[ckey] = d; setData(d); setState("done"); })
      .catch(e => { setErr(e.message); setState("error"); });
  }, []);

  const sl = { color:"#333", fontSize:"9px", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:"9px" };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999, padding:"24px" }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"#0c0c0c", border:"1px solid #222", borderRadius:"10px",
        padding:"28px", maxWidth:"600px", width:"100%", maxHeight:"82vh",
        overflowY:"auto", boxShadow:`0 0 80px ${ac}12`,
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"20px" }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"19px", color:"#fff", fontWeight:600 }}>{company.emoji} {company.name}</div>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", color:"#444", textTransform:"uppercase", letterSpacing:"0.1em", marginTop:"3px" }}>Deep Dive — {focusArea.label}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"1px solid #222", color:"#444", width:"28px", height:"28px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" }}>✕</button>
        </div>

        {state === "loading" && (
          <div>
            <div style={{ height:"2px", background:"#181818", borderRadius:"2px", overflow:"hidden", marginBottom:"10px" }}>
              <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${ac}88,${ac})`, borderRadius:"2px", transition:"width 0.8s cubic-bezier(0.4,0,0.2,1)", boxShadow:`0 0 8px ${ac}66` }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ color:"#333", fontSize:"10px", fontFamily:"'DM Mono',monospace" }}>{stageLabel}</span>
              <span style={{ color:"#2a2a2a", fontSize:"10px", fontFamily:"'DM Mono',monospace" }}>{pct}%</span>
            </div>
            <div style={{ marginTop:"20px" }}>
              {[90,70,80,55,65].map((w,i) => (
                <div key={i} style={{ height:"9px", width:`${w}%`, background:"#141414", borderRadius:"3px", marginBottom:"8px", animation:`shimmer 1.8s ease-in-out ${i*0.15}s infinite` }}/>
              ))}
            </div>
          </div>
        )}

        {state === "error" && (
          <div>
            <div style={{ color:"#ff4444", fontSize:"12px", fontFamily:"'DM Mono',monospace", marginBottom:"6px" }}>✕ Could not load deep intel</div>
            <div style={{ color:"#444", fontSize:"10px", fontFamily:"'DM Mono',monospace", wordBreak:"break-all" }}>{errMsg}</div>
          </div>
        )}

        {state === "done" && data && <>
          <p style={{ color:"#bbb", fontSize:"13px", lineHeight:"1.7", fontFamily:"'DM Sans',sans-serif", marginBottom:"18px" }}>{data.summary}</p>

          <div style={{ marginBottom:"18px" }}>
            <div style={sl}>Key Findings</div>
            {(data.highlights||[]).map((h,i) => (
              <div key={i} style={{ display:"flex", gap:"9px", marginBottom:"7px" }}>
                <span style={{ color:ac, fontSize:"9px", marginTop:"3px", flexShrink:0 }}>▸</span>
                <span style={{ color:"#999", fontSize:"12px", fontFamily:"'DM Sans',sans-serif", lineHeight:"1.5" }}>{h}</span>
              </div>
            ))}
          </div>

          {(data.programs||[]).length > 0 && (
            <div style={{ marginBottom:"18px" }}>
              <div style={sl}>Named Programs</div>
              {data.programs.map((p,i) => (
                <div key={i} style={{ borderLeft:`2px solid ${ac}44`, paddingLeft:"13px", marginBottom:"10px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"3px" }}>
                    <span style={{ color:"#fff", fontSize:"12px", fontFamily:"'DM Mono',monospace", fontWeight:500 }}>{p.name}</span>
                    <span style={{ fontSize:"9px", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", color:p.status==="active"?"#88ffcc":p.status==="planned"?"#ff9944":"#555" }}>{p.status}</span>
                  </div>
                  <div style={{ color:"#555", fontSize:"11px", fontFamily:"'DM Sans',sans-serif", lineHeight:"1.5" }}>{p.description}</div>
                </div>
              ))}
            </div>
          )}

          {data.trend && (
            <div style={{ background:"#111", borderRadius:"6px", padding:"12px 14px", marginBottom:"12px" }}>
              <div style={sl}>Strategic Direction</div>
              <div style={{ color:ac, fontSize:"11px", fontFamily:"'DM Mono',monospace", lineHeight:"1.6", fontStyle:"italic" }}>{data.trend}</div>
            </div>
          )}

          {data.takeaway && (
            <div style={{ background:`${ac}0a`, border:`1px solid ${ac}2a`, borderRadius:"6px", padding:"13px 15px", marginBottom:"18px" }}>
              <div style={{ ...sl, color:ac }}>◈ So What</div>
              <div style={{ color:"#ccc", fontSize:"12px", fontFamily:"'DM Sans',sans-serif", lineHeight:"1.65" }}>{data.takeaway}</div>
            </div>
          )}

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:"14px", borderTop:"1px solid #181818" }}>
            <Badge label={data.maturity} color={matColor(data.maturity)} />
            <span style={{ color:"#252525", fontSize:"9px", fontFamily:"'DM Mono',monospace" }}>cached for session</span>
          </div>
        </>}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [selectedCompanies, setSelectedCompanies] = useState(["notion","airtable","canva"]);
  const [selectedFocus, setSelectedFocus]         = useState("advocacy");
  const [results, setResults]                     = useState({});
  const [loadingSet, setLoadingSet]               = useState(new Set());
  const [hasSearched, setHasSearched]             = useState(false);
  const [lastUpdated, setLastUpdated]             = useState(null);
  const [modal, setModal]                         = useState(null);

  const focusArea = FOCUS_AREAS.find(f => f.id === selectedFocus);
  const isRunning = loadingSet.size > 0;

  const toggleCompany = id =>
    setSelectedCompanies(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const runSearch = async () => {
    setHasSearched(true);
    const toFetch = selectedCompanies.filter(id => !CACHE[`${id}-${selectedFocus}`]);
    const cached  = selectedCompanies.filter(id =>  CACHE[`${id}-${selectedFocus}`]);

    if (cached.length) {
      const patch = {};
      cached.forEach(id => { patch[`${id}-${selectedFocus}`] = { data: CACHE[`${id}-${selectedFocus}`] }; });
      setResults(prev => ({ ...prev, ...patch }));
    }

    if (!toFetch.length) {
      setLastUpdated(new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) + " (cached)");
      return;
    }

    setLoadingSet(new Set(toFetch.map(id => `${id}-${selectedFocus}`)));

    await Promise.all(toFetch.map(async id => {
      const company = COMPANIES.find(c => c.id === id);
      const key = `${id}-${selectedFocus}`;
      try {
        const data = await fetchIntel(company, focusArea, false);
        CACHE[key] = data;
        setResults(prev => ({ ...prev, [key]: { data } }));
      } catch {
        setResults(prev => ({ ...prev, [key]: { error: true } }));
      }
      setLoadingSet(prev => { const n = new Set(prev); n.delete(key); return n; });
    }));

    setLastUpdated(new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }));
  };

  const selectedObjs = COMPANIES.filter(c => selectedCompanies.includes(c.id));
  const cacheCount   = Object.keys(CACHE).length;

  return (
    <div style={{ minHeight:"100vh", background:"#080808", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes shimmer{0%,100%{opacity:.4}50%{opacity:.7}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        .ic{animation:fadeUp .3s ease both}
        .rbtn:hover:not(:disabled){background:#d4f03d!important;transform:translateY(-1px)}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:#0d0d0d}
        ::-webkit-scrollbar-thumb{background:#1e1e1e;border-radius:4px}
      `}</style>

      {/* Header */}
      <div style={{ borderBottom:"1px solid #131313", padding:"22px 34px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ display:"flex", alignItems:"baseline", gap:"10px" }}>
            <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:"21px", color:"#f0f0f0", fontWeight:600, margin:0, letterSpacing:"-0.02em" }}>
              Customer Marketing Intel
            </h1>
            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", color:"#E8FF47", textTransform:"uppercase", letterSpacing:"0.14em", border:"1px solid #E8FF47", padding:"2px 6px", borderRadius:"3px" }}>Live</span>
          </div>
          <p style={{ color:"#2e2e2e", fontSize:"10px", fontFamily:"'DM Mono',monospace", margin:"4px 0 0", letterSpacing:"0.04em" }}>
            Best-in-class SaaS customer marketing — advocacy · champions · community
          </p>
        </div>
        <div style={{ textAlign:"right" }}>
          {lastUpdated && <div style={{ color:"#282828", fontSize:"10px", fontFamily:"'DM Mono',monospace" }}>last run {lastUpdated}</div>}
          {cacheCount > 0 && <div style={{ color:"#222", fontSize:"9px", fontFamily:"'DM Mono',monospace", marginTop:"2px" }}>{cacheCount} cached</div>}
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding:"18px 34px 20px", borderBottom:"1px solid #0e0e0e", background:"#090909" }}>
        <div style={{ marginBottom:"14px" }}>
          <div style={{ color:"#2e2e2e", fontSize:"9px", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:"8px" }}>Companies</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
            {COMPANIES.map(c => {
              const sel    = selectedCompanies.includes(c.id);
              const isCached = !!CACHE[`${c.id}-${selectedFocus}`];
              return (
                <button key={c.id} onClick={() => toggleCompany(c.id)} style={{
                  background: sel ? c.color : "transparent",
                  border: `1.5px solid ${sel ? c.color : isCached ? "#242424" : "#191919"}`,
                  color: sel ? (c.color === "#FFD02F" ? "#000":"#fff") : isCached ? "#484848":"#303030",
                  padding:"4px 12px", borderRadius:"20px", fontSize:"11px",
                  fontFamily:"'DM Mono',monospace", cursor:"pointer", transition:"all 0.15s",
                }}>{c.emoji} {c.name}</button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom:"18px" }}>
          <div style={{ color:"#2e2e2e", fontSize:"9px", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:"8px" }}>Focus Area</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"5px" }}>
            {FOCUS_AREAS.map(a => (
              <button key={a.id} onClick={() => setSelectedFocus(a.id)} style={{
                background: selectedFocus === a.id ? "#E8FF47":"transparent",
                border: `1px solid ${selectedFocus === a.id ? "#E8FF47":"#191919"}`,
                color: selectedFocus === a.id ? "#000":"#383838",
                padding:"4px 10px", borderRadius:"4px", fontSize:"9px",
                fontFamily:"'DM Mono',monospace", cursor:"pointer",
                textTransform:"uppercase", letterSpacing:"0.08em", transition:"all 0.15s",
              }}>{a.label}</button>
            ))}
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
          <button className="rbtn" onClick={runSearch} disabled={!selectedCompanies.length || isRunning} style={{
            background:"#E8FF47", color:"#000", border:"none", padding:"9px 22px",
            borderRadius:"5px", fontSize:"10px", fontFamily:"'DM Mono',monospace", fontWeight:500,
            textTransform:"uppercase", letterSpacing:"0.1em",
            cursor:(!selectedCompanies.length || isRunning) ? "not-allowed":"pointer",
            opacity:!selectedCompanies.length ? 0.25 : isRunning ? 0.55 : 1,
            transition:"all 0.15s",
          }}>
            {isRunning ? `⟳ Searching (${loadingSet.size} left)…` : `⟳ Run Search — ${selectedCompanies.length} companies`}
          </button>
          {isRunning && (
            <span style={{ color:"#2a2a2a", fontSize:"9px", fontFamily:"'DM Mono',monospace" }}>
              ~8–15s per card · running in parallel
            </span>
          )}
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding:"26px 34px" }}>
        {!hasSearched ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#1a1a1a" }}>
            <div style={{ fontSize:"32px", marginBottom:"12px" }}>◈</div>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", letterSpacing:"0.1em", textTransform:"uppercase" }}>
              Select companies &amp; focus area, then run search
            </div>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", marginTop:"6px", color:"#141414" }}>
              First run ~8–15s · repeat searches load instantly from cache
            </div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:"12px" }}>
            {selectedObjs.map((company, i) => {
              const key = `${company.id}-${selectedFocus}`;
              const isLoading = loadingSet.has(key);
              const result = results[key];
              return (
                <div key={key} className="ic" style={{ animationDelay:`${i*0.04}s` }}>
                  {isLoading
                    ? <LoadingCard company={company} focusArea={focusArea} />
                    : <IntelCard
                        company={company}
                        focusArea={focusArea}
                        data={result?.data}
                        error={result?.error}
                        onDrillDown={() => result?.data && setModal({ company, focusArea })}
                      />
                  }
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && <DeepModal company={modal.company} focusArea={modal.focusArea} onClose={() => setModal(null)} />}
    </div>
  );
}
