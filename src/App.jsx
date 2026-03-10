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

const STAGES = [
  { label: "Connecting to search",  pct: 8,  duration: 800  },
  { label: "Searching the web",     pct: 35, duration: 5000 },
  { label: "Reading results",       pct: 60, duration: 3000 },
  { label: "Analyzing programs",    pct: 80, duration: 2000 },
  { label: "Building summary",      pct: 93, duration: 1500 },
];

const CACHE = {};

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

function useProgress(isLoading) {
  const [pct, setPct] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const timerRef = useRef(null);
  const stageRef = useRef(0);

  useEffect(() => {
    if (!isLoading) {
      if (pct > 0) {
        setPct(100);
        setTimeout(() => { setPct(0); setStageIdx(0); stageRef.current = 0; },
