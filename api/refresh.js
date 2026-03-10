// api/refresh.js — Vercel serverless refresh endpoint
// Visit /api/refresh to trigger a weekly intel update

export const config = { maxDuration: 60 };

const COMPANIES = [
  { id: "notion",   name: "Notion" },
  { id: "airtable", name: "Airtable" },
  { id: "canva",    name: "Canva" },
  { id: "figma",    name: "Figma" },
  { id: "miro",     name: "Miro" },
  { id: "asana",    name: "Asana" },
  { id: "monday",   name: "Monday.com" },
  { id: "hubspot",  name: "HubSpot" },
];

const FOCUS_AREAS = [
  { id: "advocacy",     label: "Customer Advocacy" },
  { id: "champion",     label: "Champion & Ambassador Programs" },
  { id: "case_studies", label: "Case Studies" },
  { id: "events",       label: "Customer & Brand Events" },
  { id: "clg",          label: "Customer-Led Growth" },
  { id: "ugc",          label: "User-Generated Content & Social Proof" },
  { id: "peer",         label: "Peer Advisory & Customer Councils" },
  { id: "retention",    label: "Retention & Expansion Marketing" },
];

async function fetchIntel(company, focusArea) {
  const systemPrompt = `You are a customer marketing intelligence analyst for B2B SaaS. Search the web thoroughly then respond. End your response with a JSON block in <json> tags:
<json>{"summary":"3-4 sentence overview","highlights":["finding 1","finding 2","finding 3","finding 4","finding 5"],"trend":"one sharp forward-looking strategic insight","programs":[{"name":"actual program name","description":"what it does","status":"active"}],"takeaway":"so-what for a Dropbox customer marketing leader","maturity":"emerging"}</json>
maturity must be exactly: emerging, growing, or mature`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "web-search-2025-03-05",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: systemPrompt,
      messages: [{
        role: "user",
        content: `Research ${company.name}'s "${focusArea.label}" programs in depth. Find real program names and recent launches. Provide analysis in the required JSON format.`,
      }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = await res.json();

  const sources = [];
  for (const block of (data.content || [])) {
    if (block.type === "tool_result") {
      for (const inner of (block.content || [])) {
        if (inner.type === "document" && inner.document?.url) {
          if (!sources.find(s => s.url === inner.document.url)) {
            sources.push({ url: inner.document.url, title: inner.document?.title || inner.document.url });
          }
        }
      }
    }
  }

  const allText = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
  const tagged = allText.match(/<json>([\s\S]*?)<\/json>/);
  if (tagged) return { ...JSON.parse(tagged[1].trim()), sources };

  const lb = allText.lastIndexOf("}"), fb = allText.lastIndexOf("{", lb);
  if (fb !== -1 && lb !== -1) return { ...JSON.parse(allText.slice(fb, lb + 1)), sources };
  throw new Error("No JSON found");
}

async function supabaseRequest(path, method, body) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": process.env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      "Prefer": method === "POST" ? "resolution=merge-duplicates" : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${res.status}: ${err}`);
  }
  return res.status === 204 ? null : res.json();
}

function detectChanges(current, previous) {
  const changes = [];
  if (!previous) return [{ change_type: "new", change_detail: "First time tracking this area" }];

  const maturityRank = { emerging: 0, growing: 1, mature: 2 };
  if (maturityRank[current.maturity] > maturityRank[previous.maturity]) {
    changes.push({ change_type: "maturity_up", change_detail: `Maturity moved from ${previous.maturity} → ${current.maturity}` });
  }

  const prevPrograms = (previous.programs || []).map(p => p.name?.toLowerCase());
  for (const p of (current.programs || [])) {
    if (p.name && !prevPrograms.includes(p.name.toLowerCase())) {
      changes.push({ change_type: "new_program", change_detail: `New program: "${p.name}" — ${p.description}` });
    }
  }

  if (previous.trend && current.trend && previous.trend !== current.trend) {
    changes.push({ change_type: "new_trend", change_detail: `Strategic direction shifted: ${current.trend}` });
  }

  const prevWords = new Set((previous.summary || "").toLowerCase().split(/\s+/));
  const currWords = (current.summary || "").toLowerCase().split(/\s+/);
  const overlap = currWords.filter(w => prevWords.has(w)).length;
  if (overlap / Math.max(currWords.length, 1) < 0.6) {
    changes.push({ change_type: "updated", change_detail: "Summary meaningfully updated" });
  }

  return changes;
}

async function sendDigest(allChanges, weekOf) {
  if (!allChanges.length || !process.env.RESEND_API_KEY) return;

  const focusLabel = id => FOCUS_AREAS.find(f => f.id === id)?.label || id;
  const changeIcon = type => ({ new: "🆕", maturity_up: "📈", new_program: "✦", new_trend: "◈", updated: "✏️" }[type] || "·");

  const byCompany = {};
  for (const c of allChanges) {
    if (!byCompany[c.company_id]) byCompany[c.company_id] = [];
    byCompany[c.company_id].push(c);
  }

  let html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
    <h1 style="font-size:20px;margin:0 0 6px;">Customer Marketing Intel</h1>
    <p style="color:#888;font-size:12px;margin:0 0 24px;text-transform:uppercase;letter-spacing:0.1em;">Weekly digest — ${weekOf}</p>
    <p style="color:#555;font-size:14px;">${allChanges.length} change${allChanges.length !== 1 ? "s" : ""} detected this week.</p>`;

  for (const [companyId, changes] of Object.entries(byCompany)) {
    const company = COMPANIES.find(c => c.id === companyId);
    html += `<div style="margin:20px 0;border-left:3px solid #E8FF47;padding-left:14px;">
      <h2 style="font-size:15px;margin:0 0 10px;">${company.name}</h2>`;
    for (const c of changes) {
      html += `<p style="margin:4px 0;font-size:13px;color:#333;">
        <span style="color:#888;font-size:11px;">${focusLabel(c.focus_area_id)}</span><br/>
        ${changeIcon(c.change_type)} ${c.change_detail}
      </p>`;
    }
    html += `</div>`;
  }
  html += `</div>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: "onboarding@resend.dev",
      to: process.env.DIGEST_EMAIL,
      subject: `📊 Customer Marketing Intel — ${allChanges.length} updates this week`,
      html,
    }),
  });
}

export default async function handler(req, res) {
  const secret = process.env.REFRESH_SECRET;
  if (secret && req.query.key !== secret) {
    return res.status(401).json({ error: "Unauthorized — add ?key=YOUR_SECRET to the URL" });
  }

  const weekOf = new Date().toISOString().split("T")[0];
  const allChanges = [];
  const results = [];

  const { company: companyId, focus: focusId } = req.query;

  let pairs = [];
  if (companyId && focusId) {
    const company = COMPANIES.find(c => c.id === companyId);
    const focusArea = FOCUS_AREAS.find(f => f.id === focusId);
    if (company && focusArea) pairs = [{ company, focusArea }];
  } else {
    for (const company of COMPANIES) {
      for (const focusArea of FOCUS_AREAS) {
        pairs.push({ company, focusArea });
      }
    }
  }

  for (const { company, focusArea } of pairs) {
    try {
      const prev = await supabaseRequest(
        `intel_snapshots?company_id=eq.${company.id}&focus_area_id=eq.${focusArea.id}&order=snapshot_date.desc&limit=1`,
        "GET"
      );
      const previous = prev?.[0] || null;

      const result = await fetchIntel(company, focusArea);

      await supabaseRequest("intel_results", "POST", {
        company_id: company.id,
        focus_area_id: focusArea.id,
        summary: result.summary,
        highlights: result.highlights,
        trend: result.trend,
        programs: result.programs,
        takeaway: result.takeaway,
        maturity: result.maturity,
        sources: result.sources,
        fetched_at: new Date().toISOString(),
      });

      await supabaseRequest("intel_snapshots", "POST", {
        company_id: company.id,
        focus_area_id: focusArea.id,
        summary: result.summary,
        highlights: result.highlights,
        trend: result.trend,
        programs: result.programs,
        maturity: result.maturity,
        snapshot_date: weekOf,
      });

      const changes = detectChanges(result, previous);
      if (changes.length) {
        await supabaseRequest("intel_changes", "POST",
          changes.map(c => ({
            company_id: company.id,
            focus_area_id: focusArea.id,
            change_type: c.change_type,
            change_detail: c.change_detail,
            week_of: weekOf,
          }))
        );
        allChanges.push(...changes.map(c => ({ ...c, company_id: company.id, focus_area_id: focusArea.id })));
      }

      results.push({ company: company.id, focus: focusArea.id, status: "ok", changes: changes.length });

    } catch (err) {
      results.push({ company: company.id, focus: focusArea.id, status: "error", error: err.message });
    }
  }

  if (!companyId && !focusId) {
    await sendDigest(allChanges, weekOf);
  }

  return res.status(200).json({
    week: weekOf,
    processed: results.length,
    changes: allChanges.length,
    results,
  });
}
