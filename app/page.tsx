"use client";

import { useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, BarChart3, Bell, BookOpen, ChevronRight, CircleHelp,
  Filter, LayoutDashboard, ListFilter, Search, Settings2, ShieldCheck, Star,
  TrendingUp, Zap
} from "lucide-react";

type Status = "Forming" | "Ready" | "Triggered" | "Failed";
type Setup = "First GFS + CIP" | "Small Candle GFS" | "Regular GFS" | "Double Bottom GFS" | "Breakout";

type Stock = {
  symbol: string; company: string; sector: string; price: number; change: number;
  monthly: number; weekly: number; daily: number; setup: Setup; volume: number;
  cip: boolean; rr: number; score: number; status: Status; entry: number; sl: number;
  target: number; reason: string;
};

const stocks: Stock[] = [
  { symbol: "INFY", company: "Infosys", sector: "IT", price: 1548.4, change: 1.84, monthly: 63.8, weekly: 65.1, daily: 41.2, setup: "First GFS + CIP", volume: 1.82, cip: true, rr: 4.2, score: 9.4, status: "Ready", entry: 1554, sl: 1512, target: 1730, reason: "Monthly and weekly RSI are above 60; daily RSI has returned to the 40 zone and turned upward. Prior resistance is acting as support with above-average volume." },
  { symbol: "BEL", company: "Bharat Electronics", sector: "Defence", price: 392.8, change: 2.31, monthly: 68.2, weekly: 64.7, daily: 40.4, setup: "Small Candle GFS", volume: 2.14, cip: true, rr: 3.7, score: 9.1, status: "Ready", entry: 395.2, sl: 387.1, target: 425.1, reason: "Higher-timeframe trend is strong. Daily RSI is near 40 with a compact setup candle; polarity has changed around the prior breakout level." },
  { symbol: "SBIN", company: "State Bank of India", sector: "Banking", price: 846.2, change: 1.18, monthly: 62.1, weekly: 63.6, daily: 42.1, setup: "Double Bottom GFS", volume: 1.46, cip: false, rr: 3.1, score: 8.8, status: "Ready", entry: 850.5, sl: 837.2, target: 891.7, reason: "Monthly and weekly RSI remain above 60. Daily RSI has tested the 40 area twice and is recovering above the setup trigger." },
  { symbol: "TCS", company: "Tata Consultancy Services", sector: "IT", price: 3388.5, change: 0.74, monthly: 61.7, weekly: 62.8, daily: 44.1, setup: "Regular GFS", volume: 1.21, cip: false, rr: 2.8, score: 8.2, status: "Forming", entry: 3412, sl: 3340, target: 3614, reason: "Higher-timeframe RSI is constructive and daily RSI is approaching the GFS zone. Confirmation is not complete yet." },
  { symbol: "HDFCBANK", company: "HDFC Bank", sector: "Banking", price: 1784.1, change: -0.22, monthly: 59.8, weekly: 61.4, daily: 43.7, setup: "Regular GFS", volume: 0.94, cip: false, rr: 2.1, score: 6.9, status: "Forming", entry: 1802, sl: 1760, target: 1889, reason: "Weekly trend is constructive but monthly RSI has not cleared 60. Treat as watch-only until the higher-timeframe condition improves." },
  { symbol: "RELIANCE", company: "Reliance Industries", sector: "Energy", price: 1422.6, change: -1.02, monthly: 57.2, weekly: 58.9, daily: 37.8, setup: "Breakout", volume: 0.72, cip: false, rr: 1.6, score: 5.7, status: "Failed", entry: 1450, sl: 1410, target: 1514, reason: "The attempted move lost momentum and volume confirmation is weak. Higher-timeframe RSI is also below the preferred 60 threshold." },
  { symbol: "M&M", company: "Mahindra & Mahindra", sector: "Auto", price: 3281.3, change: 2.76, monthly: 64.5, weekly: 66.2, daily: 39.6, setup: "First GFS + CIP", volume: 1.69, cip: true, rr: 4.0, score: 9.0, status: "Triggered", entry: 3268, sl: 3195, target: 3560, reason: "Strong higher-timeframe RSI alignment, daily RSI recovery from the 40 zone, polarity confirmation and a volume-backed trigger." },
  { symbol: "TRENT", company: "Trent", sector: "Retail", price: 5246.2, change: 1.05, monthly: 66.1, weekly: 62.2, daily: 45.3, setup: "Regular GFS", volume: 1.03, cip: false, rr: 2.4, score: 7.5, status: "Forming", entry: 5292, sl: 5190, target: 5537, reason: "Trend is positive, but daily RSI has not reached the preferred pullback zone. Keep on watch." },
];

const nav = [
  ["Dashboard", LayoutDashboard], ["GFS Scanner", Zap], ["Breakouts", TrendingUp],
  ["Watchlist", Star], ["Backtest", BarChart3], ["Signal History", BookOpen]
] as const;

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "green" | "amber" | "red" | "blue" | "neutral" }) {
  return <span className={`badge badge-${tone}`}><span className="badge-dot" />{children}</span>;
}

function StatusBadge({ status }: { status: Status }) {
  const tone = status === "Triggered" ? "green" : status === "Ready" ? "blue" : status === "Failed" ? "red" : "amber";
  return <Badge tone={tone}>{status}</Badge>;
}

function MiniChart({ positive = true }: { positive?: boolean }) {
  const points = positive ? "0,50 22,45 44,52 66,38 88,41 110,27 132,32 154,19 176,25 198,10" : "0,14 22,21 44,16 66,31 88,28 110,38 132,34 154,47 176,41 198,52";
  return <svg className="mini-chart" viewBox="0 0 198 60" preserveAspectRatio="none"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function RsiBars({ stock }: { stock: Stock }) {
  return <div className="rsi-stack">
    {["Monthly", "Weekly", "Daily"].map((label) => {
      const value = label === "Monthly" ? stock.monthly : label === "Weekly" ? stock.weekly : stock.daily;
      return <div className="rsi-row" key={label}><span>{label}</span><div className="rsi-track"><div className="rsi-fill" style={{ width: `${Math.min(value, 100)}%` }} /><i style={{ left: `${Math.min(value, 100)}%` }} /></div><b>{value.toFixed(1)}</b></div>;
    })}
  </div>;
}

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | Status>("All");
  const [sector, setSector] = useState("All sectors");
  const [selected, setSelected] = useState<Stock | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(["INFY", "M&M"]);

  const filtered = useMemo(() => stocks.filter((s) =>
    (s.symbol.toLowerCase().includes(query.toLowerCase()) || s.company.toLowerCase().includes(query.toLowerCase())) &&
    (status === "All" || s.status === status) && (sector === "All sectors" || s.sector === sector)
  ), [query, status, sector]);

  const ready = stocks.filter(s => s.status === "Ready").length;
  const forming = stocks.filter(s => s.status === "Forming").length;
  const triggered = stocks.filter(s => s.status === "Triggered").length;
  const avgScore = stocks.reduce((a, s) => a + s.score, 0) / stocks.length;

  const toggleWatch = (symbol: string) => setWatchlist(w => w.includes(symbol) ? w.filter(x => x !== symbol) : [...w, symbol]);

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">M</div><div><strong>Malkan</strong><span>Strategy Lab</span></div></div>
      <div className="live-pill"><span /> Market engine online</div>
      <nav>{nav.map(([label, Icon]) => <button key={label} className={active === label ? "nav-item active" : "nav-item"} onClick={() => setActive(label)}><Icon size={18} /><span>{label}</span>{label === "GFS Scanner" && <em>8</em>}</button>)}</nav>
      <div className="sidebar-bottom"><button className="nav-item"><Settings2 size={18} />Settings</button><div className="data-status"><ShieldCheck size={16} /><div><b>Research mode</b><span>Signals are rule-based<br />and not recommendations.</span></div></div></div>
    </aside>

    <section className="main-area">
      <header className="topbar"><div><span className="eyebrow">Tuesday · 01 September 2026</span><h1>{active === "Dashboard" ? "Market intelligence" : active}</h1></div><div className="top-actions"><button className="icon-btn"><Bell size={18} /><i /></button><button className="profile">AR</button></div></header>

      <div className="content">
        {active === "Dashboard" && <>
          <section className="hero-row"><div className="hero-copy"><Badge tone="green">Scanner ready</Badge><h2>Find the strongest<br /><span>setups before the move.</span></h2><p>A transparent, rule-based workspace for GFS, breakouts, CIP, volume and volatility. Every signal explains its own evidence.</p></div><div className="market-card"><div className="card-head"><span>NIFTY 50</span><Badge tone="green">Bullish</Badge></div><div className="market-price">24,734.30 <strong>+0.84%</strong></div><MiniChart /><div className="market-meta"><span>RSI <b>63.8</b></span><span>Trend <b>Up</b></span><span>Breadth <b>71%</b></span></div></div></section>

          <section className="metrics-grid">
            <div className="metric"><span>Ready setups</span><strong>{ready}</strong><small><ArrowUpRight size={13} /> high-conviction queue</small></div>
            <div className="metric"><span>Forming</span><strong>{forming}</strong><small>watch for confirmation</small></div>
            <div className="metric"><span>Triggered today</span><strong>{triggered}</strong><small>entry condition met</small></div>
            <div className="metric"><span>Average score</span><strong>{avgScore.toFixed(1)}<small>/10</small></strong><small>across tracked setups</small></div>
          </section>

          <section className="section-head"><div><span className="eyebrow">Signal queue</span><h3>Top Malkan setups</h3></div><button className="text-btn" onClick={() => setActive("GFS Scanner")}>Open full scanner <ChevronRight size={15} /></button></section>
          <div className="setup-grid">{stocks.filter(s => s.score >= 8.8).sort((a,b) => b.score-a.score).map((s, i) => <article className="setup-card" key={s.symbol} onClick={() => setSelected(s)}><div className="setup-top"><div className="ticker"><div>{s.symbol.slice(0,2)}</div><span><b>{s.symbol}</b><small>{s.company}</small></span></div><button className={watchlist.includes(s.symbol) ? "star active" : "star"} onClick={(e) => { e.stopPropagation(); toggleWatch(s.symbol); }}><Star size={16} fill="currentColor" /></button></div><div className="setup-name"><span>{i === 0 ? "01" : `0${i+1}`}</span>{s.setup}</div><div className="score-line"><div><span>Setup score</span><b>{s.score.toFixed(1)}</b></div><div className="score-track"><div style={{ width: `${s.score*10}%` }} /></div></div><RsiBars stock={s} /><div className="setup-foot"><StatusBadge status={s.status} /><span>R:R <b>1:{s.rr}</b></span></div></article>)}</div>

          <section className="section-head sector-head"><div><span className="eyebrow">Top-down view</span><h3>Sector strength</h3></div></section>
          <div className="sector-grid">{["IT","Banking","Defence","Auto","Energy","Retail"].map((name, i) => <div className="sector" key={name}><div><b>{name}</b><span>{["Strong","Strong","Strong","Strong","Neutral","Neutral"][i]}</span></div><strong>{[92,88,86,84,62,58][i]}</strong><div className="sector-track"><div style={{ width: `${[92,88,86,84,62,58][i]}%` }} /></div></div>)}</div>
        </>}

        {active !== "Dashboard" && <>
          <section className="scanner-intro"><div><Badge tone="blue">Rule engine</Badge><h2>{active === "GFS Scanner" ? "GFS scanner" : active === "Breakouts" ? "Breakout scanner" : active}</h2><p>{active === "GFS Scanner" ? "Grandfather (Monthly) → Father (Weekly) → Son (Daily). The preferred 60/40 RSI framework is shown explicitly for every candidate." : "Explore the same signal engine through a focused workflow. Historical/live market-data connectors can be attached without changing the UI contract."}</p></div><div className="rule-box"><span>Framework</span><b>RSI 60 / 40</b><small>Configurable thresholds</small></div></section>
          <section className="toolbar"><div className="search"><Search size={17} /><input placeholder="Search stock or company" value={query} onChange={e => setQuery(e.target.value)} /></div><div className="select"><ListFilter size={16} /><select value={status} onChange={e => setStatus(e.target.value as "All" | Status)}><option>All</option><option>Ready</option><option>Triggered</option><option>Forming</option><option>Failed</option></select></div><div className="select"><Filter size={16} /><select value={sector} onChange={e => setSector(e.target.value)}><option>All sectors</option>{Array.from(new Set(stocks.map(s => s.sector))).map(x => <option key={x}>{x}</option>)}</select></div></section>
          <div className="table-wrap"><table><thead><tr><th>Stock</th><th>Setup</th><th>Monthly</th><th>Weekly</th><th>Daily</th><th>Volume</th><th>CIP</th><th>R:R</th><th>Score</th><th>Status</th></tr></thead><tbody>{filtered.map(s => <tr key={s.symbol} onClick={() => setSelected(s)}><td><div className="table-stock"><span>{s.symbol.slice(0,2)}</span><div><b>{s.symbol}</b><small>{s.sector}</small></div></div></td><td><b className="setup-type">{s.setup}</b></td><td><RsiValue value={s.monthly} /></td><td><RsiValue value={s.weekly} /></td><td><RsiValue value={s.daily} daily /></td><td>{s.volume.toFixed(2)}x</td><td>{s.cip ? <Badge tone="green">Confirmed</Badge> : <span className="muted">—</span>}</td><td><b>1:{s.rr}</b></td><td><strong className="score-number">{s.score.toFixed(1)}</strong></td><td><StatusBadge status={s.status} /></td></tr>)}</tbody></table></div>
          <div className="disclaimer"><CircleHelp size={15} /><span><b>Research mode:</b> these displayed candidates use seeded demo data until a licensed market-data provider is connected. The rule engine is designed to show evidence, not financial advice.</span></div>
        </>}
      </div>
    </section>

    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="detail-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setSelected(null)}>×</button><div className="detail-title"><div className="big-ticker">{selected.symbol.slice(0,2)}</div><div><span className="eyebrow">{selected.sector} · {selected.company}</span><h2>{selected.symbol}</h2><Badge tone={selected.status === "Failed" ? "red" : selected.status === "Forming" ? "amber" : "green"}>{selected.setup}</Badge></div><div className="detail-score"><span>Score</span><b>{selected.score.toFixed(1)}</b><small>/10</small></div></div><div className="detail-chart"><div className="chart-label">Price structure · illustrative</div><svg viewBox="0 0 700 220" preserveAspectRatio="none"><path d="M0 174 L48 160 L90 170 L130 148 L170 151 L210 125 L250 132 L290 111 L330 124 L370 92 L410 99 L450 72 L490 86 L530 58 L570 64 L610 34 L650 45 L700 18" fill="none" stroke="currentColor" strokeWidth="3" /><line x1="0" y1="124" x2="700" y2="124" stroke="currentColor" strokeDasharray="5 6" opacity=".25" /></svg><div className="chart-levels"><span>SL ₹{selected.sl.toLocaleString()}</span><span>Entry ₹{selected.entry.toLocaleString()}</span><span>Target ₹{selected.target.toLocaleString()}</span></div></div><div className="detail-grid"><div className="detail-panel"><span className="panel-title">GFS evidence</span><RsiBars stock={selected} /><div className="evidence-list"><p>✓ Monthly RSI {selected.monthly.toFixed(1)} &gt; 60</p><p>✓ Weekly RSI {selected.weekly.toFixed(1)} &gt; 60</p><p>{selected.daily <= 45 ? "✓" : "○"} Daily RSI {selected.daily.toFixed(1)} near the 40 zone</p><p>{selected.cip ? "✓" : "○"} Change in Polarity</p><p>{selected.volume >= 1.5 ? "✓" : "○"} Relative volume {selected.volume.toFixed(2)}x</p></div></div><div className="detail-panel"><span className="panel-title">Trade plan</span><div className="plan-grid"><div><span>Current</span><b>₹{selected.price.toLocaleString()}</b></div><div><span>Entry</span><b>₹{selected.entry.toLocaleString()}</b></div><div><span>Stop loss</span><b>₹{selected.sl.toLocaleString()}</b></div><div><span>Target</span><b>₹{selected.target.toLocaleString()}</b></div><div><span>Risk / share</span><b>₹{(selected.entry-selected.sl).toFixed(0)}</b></div><div><span>Reward / risk</span><b>1:{selected.rr}</b></div></div></div></div><div className="why"><b>Why this setup?</b><p>{selected.reason}</p></div></div></div>}
  </main>;
}

function RsiValue({ value, daily = false }: { value: number; daily?: boolean }) {
  const tone = value > 60 ? "green" : value >= 38 && value <= 45 ? "blue" : "neutral";
  return <span className={`rsi-value ${tone}`}>{value.toFixed(1)}{daily && value >= 38 && value <= 45 ? " ↗" : ""}</span>;
}
