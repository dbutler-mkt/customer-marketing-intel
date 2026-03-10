import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

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
  { id: "champion",     label: "Champion & Ambassador Programs" },
  { id: "case_studies", label: "Case Studies" },
  { id: "events",       label: "Customer & Brand Events" },
  { id: "clg",          label: "Customer-Led Growth" },
  { id: "ugc",          label: "UGC & Social Proof" },
  { id: "peer",         label: "Peer Advisory & Councils" },
  { id: "retention",    label: "Retention & Expansion" },
];

function matColor(m) { return m === "mature" ? "#E8FF47" : m === "growing" ? "#88ffcc" : "#ff9944"; }
function accent(c) { return ["#000000","#888","#111"].includes(c.color) ? "#E8FF47" : c.color; }

const CHANGE_META = {
  new:         { icon: "🆕", label: "New",          color: "#E8FF47" },
  new_program: { icon: "✦",  label: "New Program",  color: "#88ffcc" },
  maturity_up: { icon: "📈", label: "Rising",        color: "#88ffcc" },
  new_trend:   { icon: "◈",  label: "Trend Shift",  color: "#ff9944" },
  updated:     { icon: "✏️", label: "Updated",       color: "#aaaaaa" },
};

function Badge({ label, color, small }) {
  return (
    <span style={{
      background: color, color: "#000", fontSize: small ? "8px" : "9px",
      fontFamily: "'DM Mono',monospace", padding: small ? "2px 5px" : "3px 8px",
      borderRadius: "3px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: "700",
      whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

function ChangePill({ changeType }) {
  const meta = CHANGE_META[changeType] || CHANGE_META.updated;
  return (
    <span style={{
      background: `${meta.color}18`, border: `1px solid ${meta.color}44`,
      color: meta.color, fontSize: "9px", fontFamily: "'DM Mono',monospace",
      padding: "2px 7px", borderRadius: "20px", letterSpacing: "0.08em",
      display: "inline-flex", alignItems: "center", gap: "4px",
    }}>
      {meta.icon} {meta.label}
    </span>
  );
}

function Sources({ sources }) {
  if (!sources?.length) return null;
  return (
    <div style={{ borderTop: "1px solid #141414", paddingTop: "10px", marginTop: "10px" }}>
      <div style={{ color: "#2a2a2a", fontSize: "9px", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>Sources</div>
      {sources.map((s, i) => {
        let domain = s.url;
        try { domain = new URL(s.url).hostname.replace("www.", ""); } catch {}
        return (
          <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
            style={{ display: "block", color: "#333", fontSize: "10px", fontFamily: "'DM Mono',monospace", textDecoration: "none", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            onMouseEnter={e => e.currentTarget.style.color = "#666"}
            onMouseLeave={e => e.currentTarget.style.color = "#333"}
          >↗ {domain}</a>
        );
      })}
    </div>
  );
}

function IntelCard({ company, result, changes, onClick }) {
  const ac = accent(company);
  const cardChanges = changes.filter(c => c.company_id === company.id && c.focus_area_id === result?.focus_area_id);
  const hasChanges = cardChanges.length > 0;

  if (!result) return (
    <div style={{ ...card, borderColor: "#141414", opacity: 0.4 }}>
      <div style={{ color: "#222", fontSize: "10px", fontFamily: "'DM Mono',monospace" }}>No data yet — run refresh</div>
    </div>
  );

  return (
    <div style={{ ...card, borderColor: hasChanges ? `${ac}44` : "#191919", cursor: "pointer" }}
      onClick={onClick}
      onMouseEnter={e => e.currentTarget.style.borderColor = hasChanges ? `${ac}88` : "#2a2a2a"}
      onMouseLeave={e => e.currentTarget.style.borderColor = hasChanges ? `${ac}44` : "#191919"}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "13px" }}>{company.emoji}</span>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: "14px", color: "#e8e8e8", fontWeight: 600 }}>{company.name}</div>
        </div>
        <Badge label={result.maturity} color={matColor(result.maturity)} small />
      </div>

      {hasChanges && (
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginBottom: "10px" }}>
          {cardChanges.slice(0, 3).map((c, i) => <ChangePill key={i} changeType={c.change_type} />)}
        </div>
      )}

      <p style={{ color: "#777", fontSize: "11px", lineHeight: "1.6", fontFamily: "'DM Sans',sans-serif", marginBottom: "10px" }}>
        {result.summary?.slice(0, 160)}{result.summary?.length > 160 ? "…" : ""}
      </p>

      {result.trend && (
        <div style={{ display: "flex", gap: "6px", borderTop: "1px solid #181818", paddingTop: "8px" }}>
          <span style={{ color: "#E8FF47", fontSize: "9px", marginTop: "2px" }}>◈</span>
          <span style={{ color: "#E8FF47", fontSize: "10px", fontFamily: "'DM Mono',monospace", lineHeight: "1.5", fontStyle: "italic" }}>{result.trend}</span>
        </div>
      )}

      <div style={{ marginTop: "10px", color: "#2a2a2a", fontSize: "9px", fontFamily: "'DM Mono',monospace" }}>↳ click for deep dive</div>
    </div>
  );
}

const card = { background: "#0d0d0d", border: "1px solid #191919", borderRadius: "8px", padding: "15px", transition: "border-color 0.15s" };

function DeepModal({ company, focusArea, result, changes, onClose }) {
  const ac = accent(company);
  const cardChanges = changes.filter(c => c.company_id === company.id && c.focus_area_id === focusArea.id);
  const sl = { color: "#333", fontSize: "9px", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "9px" };
  const lastUpdated = result?.fetched_at ? new Date(result.fetched_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: "24px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0c0c0c", border: "1px solid #222", borderRadius: "10px", padding: "28px", maxWidth: "640px", width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: `0 0 80px ${ac}12` }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: "19px", color: "#fff", fontWeight: 600 }}>{company.emoji} {company.name}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "#444", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "3px" }}>{focusArea.label}</div>
            {lastUpdated && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "#2a2a2a", marginTop: "3px" }}>Last refreshed {lastUpdated}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Badge label={result.maturity} color={matColor(result.maturity)} />
            <button onClick={onClose} style={{ background: "none", border: "1px solid #222", color: "#444", width: "28px", height: "28px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>✕</button>
          </div>
        </div>

        {cardChanges.length > 0 && (
          <div style={{ background: "#111", borderRadius: "6px", padding: "12px 14px", marginBottom: "18px", border: "1px solid #1e1e1e" }}>
            <div style={{ ...sl, color: "#E8FF47" }}>This Week</div>
            {cardChanges.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "6px", alignItems: "flex-start" }}>
                <ChangePill changeType={c.change_type} />
                <span style={{ color: "#888", fontSize: "11px", fontFamily: "'DM Sans',sans-serif", lineHeight: "1.5" }}>{c.change_detail}</span>
              </div>
            ))}
          </div>
        )}

        <p style={{ color: "#bbb", fontSize: "13px", lineHeight: "1.7", fontFamily: "'DM Sans',sans-serif", marginBottom: "18px" }}>{result.summary}</p>

        <div style={{ marginBottom: "18px" }}>
          <div style={sl}>Key Findings</div>
          {(result.highlights || []).map((h, i) => (
            <div key={i} style={{ display: "flex", gap: "9px", marginBottom: "7px" }}>
              <span style={{ color: ac, fontSize: "9px", marginTop: "3px", flexShrink: 0 }}>▸</span>
              <span style={{ color: "#999", fontSize: "12px", fontFamily: "'DM Sans',sans-serif", lineHeight: "1.5" }}>{h}</span>
            </div>
          ))}
        </div>

        {(result.programs || []).length > 0 && (
          <div style={{ marginBottom: "18px" }}>
            <div style={sl}>Named Programs</div>
            {result.programs.map((p, i) => (
              <div key={i} style={{ borderLeft: `2px solid ${ac}44`, paddingLeft: "13px", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                  <span style={{ color: "#fff", fontSize: "12px", fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>{p.name}</span>
                  <span style={{ fontSize: "9px", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", color: p.status === "active" ? "#88ffcc" : p.status === "planned" ? "#ff9944" : "#555" }}>{p.status}</span>
                </div>
                <div style={{ color: "#555", fontSize: "11px", fontFamily: "'DM Sans',sans-serif", lineHeight: "1.5" }}>{p.description}</div>
              </div>
            ))}
          </div>
        )}

        {result.trend && (
          <div style={{ background: "#111", borderRadius: "6px", padding: "12px 14px", marginBottom: "12px" }}>
            <div style={sl}>Strategic Direction</div>
            <div style={{ color: ac, fontSize: "11px", fontFamily: "'DM Mono',monospace", lineHeight: "1.6", fontStyle: "italic" }}>{result.trend}</div>
          </div>
        )}

        {result.takeaway && (
          <div style={{ background: `${ac}0a`, border: `1px solid ${ac}2a`, borderRadius: "6px", padding: "13px 15px", marginBottom: "18px" }}>
            <div style={{ ...sl, color: ac }}>◈ So What for Dropbox</div>
            <div style={{ color: "#ccc", fontSize: "12px", fontFamily: "'DM Sans',sans-serif", lineHeight: "1.65" }}>{result.takeaway}</div>
          </div>
        )}

        <Sources sources={result.sources} />
      </div>
    </div>
  );
}

function ChangesBar({ changes }) {
  if (!changes.length) return null;
  const newPrograms = changes.filter(c => c.change_type === "new_program").length;
  const maturityUps = changes.filter(c => c.change_type === "maturity_up").length;
  const trendShifts = changes.filter(c => c.change_type === "new_trend").length;
  const weekOf = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div style={{ background: "#0a0a0a", borderBottom: "1px solid #141414", padding: "10px 34px", display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "#333", textTransform: "uppercase", letterSpacing: "0.1em" }}>This week</span>
      {newPrograms > 0 && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#88ffcc" }}>✦ {newPrograms} new program{newPrograms !== 1 ? "s" : ""}</span>}
      {maturityUps > 0 && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#88ffcc" }}>📈 {maturityUps} rising</span>}
      {trendShifts > 0 && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#ff9944" }}>◈ {trendShifts} trend shift{trendShifts !== 1 ? "s" : ""}</span>}
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "#222", marginLeft: "auto" }}>{weekOf}</span>
    </div>
  );
}

export default function App() {
  const [results, setResults]     = useState([]);
  const [changes, setChanges]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selectedCompanies, setSelectedCompanies] = useState(COMPANIES.map(c => c.id));
  const [selectedFocus, setSelectedFocus] = useState("advocacy");
  const [modal, setModal]         = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: resultsData }, { data: changesData }] = await Promise.all([
        supabase.from("intel_results").select("*"),
        supabase.from("intel_changes").select("*").gte("detected_at", new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()),
      ]);
      setResults(resultsData || []);
      setChanges(changesData || []);
      if (resultsData?.length) {
        const latest = resultsData.reduce((a, b) => a.fetched_at > b.fetched_at ? a : b);
        setLastRefresh(new Date(latest.fetched_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }));
      }
      setLoading(false);
    }
    load();
  }, []);

  const focusArea = FOCUS_AREAS.find(f => f.id === selectedFocus);
  const toggleCompany = id => setSelectedCompanies(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  const visibleCompanies = COMPANIES.filter(c => selectedCompanies.includes(c.id));
  const getResult = (companyId, focusId) => results.find(r => r.company_id === companyId && r.focus_area_id === focusId);

  return (
    <div style={{ minHeight: "100vh", background: "#080808", fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        .ic{animation:fadeUp .25s ease both}
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-track{background:#0d0d0d} ::-webkit-scrollbar-thumb{background:#1e1e1e;border-radius:4px}
      `}</style>

      <div style={{ borderBottom: "1px solid #131313", padding: "20px 34px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: "20px", color: "#f0f0f0", fontWeight: 600, margin: 0, letterSpacing: "-0.02em" }}>Customer Marketing Intel</h1>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "#E8FF47", textTransform: "uppercase", letterSpacing: "0.14em", border: "1px solid #E8FF47", padding: "2px 6px", borderRadius: "3px" }}>Weekly</span>
          </div>
          <p style={{ color: "#2a2a2a", fontSize: "10px", fontFamily: "'DM Mono',monospace", margin: "4px 0 0" }}>8 companies · 8 focus areas · updated weekly</p>
        </div>
        <div style={{ textAlign: "right" }}>
          {lastRefresh && <div style={{ color: "#2a2a2a", fontSize: "10px", fontFamily: "'DM Mono',monospace" }}>refreshed {lastRefresh}</div>}
          {loading && <div style={{ color: "#333", fontSize: "10px", fontFamily: "'DM Mono',monospace" }}>loading…</div>}
        </div>
      </div>

      <ChangesBar changes={changes} />

      <div style={{ padding: "14px 34px 16px", borderBottom: "1px solid #0e0e0e", background: "#090909" }}>
        <div style={{ marginBottom: "12px" }}>
          <div style={{ color: "#2a2a2a", fontSize: "9px", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "7px" }}>Companies</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {COMPANIES.map(c => {
              const sel = selectedCompanies.includes(c.id);
              const hasChange = changes.some(ch => ch.company_id === c.id);
              return (
                <button key={c.id} onClick={() => toggleCompany(c.id)} style={{
                  background: sel ? c.color : "transparent",
                  border: `1.5px solid ${sel ? c.color : hasChange ? "#2a2a2a" : "#191919"}`,
                  color: sel ? (c.color === "#FFD02F" ? "#000" : "#fff") : hasChange ? "#4a4a4a" : "#2a2a2a",
                  padding: "3px 11px", borderRadius: "20px", fontSize: "11px",
                  fontFamily: "'DM Mono',monospace", cursor: "pointer", transition: "all 0.15s", position: "relative",
                }}>
                  {c.emoji} {c.name}
                  {hasChange && !sel && <span style={{ position: "absolute", top: "-3px", right: "-3px", width: "6px", height: "6px", background: "#E8FF47", borderRadius: "50%" }} />}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ color: "#2a2a2a", fontSize: "9px", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "7px" }}>Focus Area</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {FOCUS_AREAS.map(a => {
              const hasChange = changes.some(c => c.focus_area_id === a.id);
              return (
                <button key={a.id} onClick={() => setSelectedFocus(a.id)} style={{
                  background: selectedFocus === a.id ? "#E8FF47" : "transparent",
                  border: `1px solid ${selectedFocus === a.id ? "#E8FF47" : hasChange ? "#2a2a2a" : "#191919"}`,
                  color: selectedFocus === a.id ? "#000" : hasChange ? "#4a4a4a" : "#2e2e2e",
                  padding: "3px 9px", borderRadius: "4px", fontSize: "9px",
                  fontFamily: "'DM Mono',monospace", cursor: "pointer",
                  textTransform: "uppercase", letterSpacing: "0.08em", transition: "all 0.15s",
                }}>{a.label}{hasChange && selectedFocus !== a.id ? " ·" : ""}</button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ padding: "22px 34px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#1a1a1a" }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading…</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "10px" }}>
            {visibleCompanies.map((company, i) => {
              const result = getResult(company.id, selectedFocus);
              return (
                <div key={company.id} className="ic" style={{ animationDelay: `${i * 0.03}s` }}>
                  <IntelCard
                    company={company}
                    result={result}
                    changes={changes}
                    onClick={() => result && setModal({ company, focusArea, result })}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && <DeepModal company={modal.company} focusArea={modal.focusArea} result={modal.result} changes={changes} onClose={() => setModal(null)} />}
    </div>
  );
}
