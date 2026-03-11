import { useState, useEffect } from "react";

const EUR_TO_RON = 4.97;
const VAT_RO = 0.19;
const DUTY = { "8518300000": 0.00, "3926909090": 0.065, "9405409090": 0.044, "8471300000": 0.00, "6110200000": 0.12 };
const FREIGHT = { air: 5.8, sea_lcl: 1.2, sea_fcl: 0.38 };
const BROKER_FEE = 95;
const WAREHOUSE_FEE = 120;

const API_BASE = "http://127.0.0.1:8000";

function calcLanded(p, qty, method) {
  const prod = p.priceEUR * qty;
  const freight = p.kg * qty * FREIGHT[method];
  const dutyRate = DUTY[p.hs] ?? 0.05;
  const duties = (prod + freight) * dutyRate;
  const vat = (prod + freight + duties) * VAT_RO;
  const ins = prod * 0.005;
  const total = prod + freight + duties + vat + ins + BROKER_FEE;
  return { prod, freight, duties, vat, ins, broker: BROKER_FEE, total, unit: total / qty, dutyRate };
}

const fEur = (v) => `€${v.toFixed(2)}`;
const fRon = (v) => `${(v * EUR_TO_RON).toFixed(0)} RON`;
const fBoth = (v) => `€${v.toFixed(2)} · ${(v * EUR_TO_RON).toFixed(0)} RON`;

const PlatBadge = ({ p }) => (
  <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.05em", padding:"2px 8px", borderRadius:4,
    background: p==="alibaba"?"#fff3e8":"#fff0f0", color: p==="alibaba"?"#c2500a":"#b91c1c",
    border:`1px solid ${p==="alibaba"?"#fcd9b0":"#fca5a5"}` }}>
    {p==="alibaba"?"Alibaba B2B":"AliExpress"}
  </span>
);

const Trust = ({ label, color, bg }) => (
  <span style={{ fontSize:10, fontWeight:600, padding:"2px 7px", borderRadius:4, color, background:bg, border:`1px solid ${color}40` }}>{label}</span>
);

const Section = ({ title }) => (
  <div style={{ fontSize:11, fontWeight:700, color:"#6b7280", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>{title}</div>
);

function Card({ children, style={}, color }) {
  return (
    <div style={{ background:"#fff", border:`1px solid ${color||"#e5e7eb"}`, borderRadius:10,
      padding:20, boxShadow: color?"0 0 0 3px "+color+"30":"0 1px 3px rgba(0,0,0,0.06)", ...style }}>
      {children}
    </div>
  );
}

function Empty({ icon, title, sub }) {
  return (
    <div style={{ textAlign:"center", padding:"72px 24px" }}>
      <div style={{ fontSize:44, marginBottom:16 }}>{icon}</div>
      <div style={{ fontSize:16, fontWeight:700, color:"#1f2937", marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:13, color:"#9ca3af" }}>{sub}</div>
    </div>
  );
}

function Bar({ pct, color="#2563eb", height=5 }) {
  return (
    <div style={{ height, background:"#f3f4f6", borderRadius:99, overflow:"hidden", marginTop:6 }}>
      <div style={{ height:"100%", width:`${Math.min(100,pct)}%`, background:color, borderRadius:99, transition:"width 0.5s ease" }} />
    </div>
  );
}

export default function SourceWise() {
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [compared, setCompared] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartQtys, setCartQtys] = useState({});
  const [lcProduct, setLcProduct] = useState(null);
  const [lcQty, setLcQty] = useState(500);
  const [lcMethod, setLcMethod] = useState("sea_lcl");
  const [lcData, setLcData] = useState(null);
  const [lcLoading, setLcLoading] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterVerified, setFilterVerified] = useState(false);
  const [sortKey, setSortKey] = useState("priceEUR");
  const [consMode, setConsMode] = useState("multi_supplier");
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", content: "Spune-mi într-un singur mesaj ce vrei: căutare, comparație, consolidare și/sau calcul cost." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const doSearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setSearched(false);
    try {
      const params = new URLSearchParams({
        q: query,
        platform: filterPlatform,
        verified: String(filterVerified),
        sort: sortKey,
      });
      const res = await fetch(`${API_BASE}/search?${params.toString()}`);
      if (!res.ok) throw new Error("search_failed");
      const data = await res.json();
      const mapped = (data.results || []).map((p) => ({
        ...p,
        priceEUR: p.price_eur,
        leadDays: p.lead_days,
      }));
      setResults(mapped);
    } catch (e) {
      console.error("Search error", e);
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const applyChatResponse = (data) => {
    // Search results
    if (Array.isArray(data.search_results)) {
      const mapped = data.search_results.map((p) => ({
        ...p,
        priceEUR: p.price_eur,
        leadDays: p.lead_days,
      }));
      setResults(mapped);
      setSearched(true);
    }

    // Compared
    if (Array.isArray(data.compared)) {
      const mapped = data.compared.map((p) => ({
        ...p,
        priceEUR: p.price_eur,
        leadDays: p.lead_days,
      }));
      setCompared(mapped);
    }

    // Cart (needs product objects)
    if (Array.isArray(data.cart) && Array.isArray(data.search_results)) {
      const productsById = new Map(data.search_results.map((p) => [p.id, p]));
      const cartProducts = data.cart
        .map((it) => productsById.get(it.product_id))
        .filter(Boolean)
        .map((p) => ({ ...p, priceEUR: p.price_eur, leadDays: p.lead_days }));
      setCart(cartProducts);
      const qtys = {};
      data.cart.forEach((it) => {
        qtys[it.product_id] = it.quantity;
      });
      setCartQtys(qtys);
    }

    // Consolidation plan
    if (data.consolidation_plan) {
      setPlan(data.consolidation_plan);
    }

    // Landed cost
    if (data.landed_cost_product && data.landed_cost) {
      const p = data.landed_cost_product;
      const mappedP = { ...p, priceEUR: p.price_eur, leadDays: p.lead_days };
      setLcProduct(mappedP);
      setLcData(data.landed_cost);
      if (data.transport_method) setLcMethod(data.transport_method);
      // Best-effort: infer qty from total/unit if we can
      if (data.landed_cost.total && data.landed_cost.unit) {
        const qty = Math.max(1, Math.round(data.landed_cost.total / data.landed_cost.unit));
        setLcQty(qty);
      }
    }
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput("");
    setChatMessages((m) => [...m, { role: "user", content: text }]);
    setChatLoading(true);
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, platform: filterPlatform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "chat_failed");
      setChatMessages((m) => [...m, { role: "assistant", content: data.message || "OK" }]);
      applyChatResponse(data);

      // Navigate to most relevant tab based on response
      if (data.landed_cost) setTab(3);
      else if (data.consolidation_plan || (data.cart && data.cart.length)) setTab(2);
      else if (data.compared && data.compared.length) setTab(1);
      else if (data.search_results && data.search_results.length) setTab(0);
    } catch (e) {
      console.error("Chat error", e);
      setChatMessages((m) => [...m, { role: "assistant", content: "Nu am putut procesa cererea. Încearcă din nou." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const fetchLanded = async (productId, qty, method) => {
    if (!productId || !qty) return;
    setLcLoading(true);
    try {
      const res = await fetch(`${API_BASE}/landed-cost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          quantity: qty,
          transport_method: method,
        }),
      });
      if (!res.ok) throw new Error("landed_failed");
      const data = await res.json();
      setLcData(data);
    } catch (e) {
      console.error("Landed cost error", e);
      setLcData(null);
    } finally {
      setLcLoading(false);
    }
  };

  const toggleCompare = (p) => setCompared(prev =>
    prev.find(x => x.id === p.id) ? prev.filter(x => x.id !== p.id) : prev.length < 3 ? [...prev, p] : prev
  );

  const addToCart = (p) => {
    if (!cart.find(x => x.id === p.id)) {
      setCart(c => [...c, p]);
      setCartQtys(q => ({ ...q, [p.id]: p.moq || 100 }));
    }
    setTab(2);
  };

  const openLC = (p) => {
    const qty = p.moq || 100;
    setLcProduct(p);
    setLcQty(qty);
    setLcMethod("sea_lcl");
    fetchLanded(p.id, qty, "sea_lcl");
    setTab(3);
  };
  const lc = lcData;

  const cartItems = cart.map(p => ({ p, qty: cartQtys[p.id] || 100 }));
  const totalWeight = cartItems.reduce((s, { p, qty }) => s + p.kg * qty, 0);
  const totalValue = cartItems.reduce((s, { p, qty }) => s + p.priceEUR * qty, 0);
  const seaMethod = totalWeight > 2000 ? "sea_fcl" : "sea_lcl";
  const seaFreight = totalWeight * FREIGHT[seaMethod];
  const airFreight = totalWeight * FREIGHT.air;
  const savings = airFreight - seaFreight;

  useEffect(() => {
    if (!cartItems.length) {
      setPlan(null);
      return;
    }
    const payload = {
      items: cartItems.map(({ p, qty }) => ({
        product_id: p.id,
        quantity: qty,
      })),
      mode: consMode,
    };
    setPlanLoading(true);
    fetch(`${API_BASE}/consolidation/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error("plan_failed");
        return res.json();
      })
      .then((data) => setPlan(data))
      .catch((e) => {
        console.error("Consolidation plan error", e);
        setPlan(null);
      })
      .finally(() => setPlanLoading(false));
  }, [cartItems.map(({ p, qty }) => `${p.id}:${qty}`).join("|"), consMode]);

  const NAV = [
    { label:"Căutare Produse", icon:"🔍" },
    { label:"Compară Furnizori", icon:"⚖️", badge: compared.length },
    { label:"Consolidare", icon:"📦", badge: cart.length },
    { label:"Calculator Cost", icon:"🧮" },
    { label:"AI Copilot", icon:"🤖" },
  ];

  const suggestions = ["casti wireless","huse telefon","becuri led","laptop","tricouri"];

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    html,body,#root{height:100%}
    body{font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
    ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#f8fafc}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
    @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    .fade{animation:fadeUp 0.25s ease both}
    button{font-family:'Inter',system-ui,sans-serif;cursor:pointer}
    input,select{font-family:'Inter',system-ui,sans-serif}
    input:focus,select:focus{outline:2px solid #2563eb;outline-offset:-1px}
    .nav-btn{display:flex;align-items:center;justify-content:space-between;width:100%;padding:10px 12px;border-radius:8px;border:none;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.15s;text-align:left;background:transparent;color:#94a3b8}
    .nav-btn:hover{background:#263348;color:#cbd5e1}
    .nav-active{background:#2563eb!important;color:#fff!important}
    .btn-pri{background:#2563eb;color:#fff;border:none;border-radius:7px;padding:9px 18px;font-size:13px;font-weight:600;transition:background 0.15s}
    .btn-pri:hover{background:#1d4ed8}
    .btn-sec{background:#fff;color:#374151;border:1px solid #d1d5db;border-radius:7px;padding:8px 14px;font-size:13px;font-weight:500;transition:all 0.15s}
    .btn-sec:hover{border-color:#9ca3af;background:#f9fafb}
    .btn-grn{background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:7px;padding:8px 14px;font-size:13px;font-weight:600;transition:all 0.15s}
    .btn-grn:hover{background:#dcfce7}
    .filter{background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:500;color:#6b7280;transition:all 0.15s}
    .filter:hover{border-color:#9ca3af;color:#374151}
    .filter-on{background:#eff6ff!important;border-color:#93c5fd!important;color:#2563eb!important;font-weight:600!important}
    .prow{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px 18px;display:grid;grid-template-columns:48px 1fr 130px 150px 175px;align-items:center;gap:14px;transition:all 0.15s}
    .prow:hover{border-color:#93c5fd;box-shadow:0 2px 8px rgba(37,99,235,0.07)}
    .prow-sel{border-color:#2563eb!important;box-shadow:0 0 0 3px #dbeafe!important}
    .method-btn{width:100%;padding:10px 12px;border-radius:7px;border:1px solid #e5e7eb;background:#fff;cursor:pointer;transition:all 0.15s;text-align:left;display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
    .method-btn:hover{border-color:#93c5fd;background:#f8fafc}
    .method-on{border-color:#93c5fd!important;background:#eff6ff!important}
  `;

  return (
    <div style={{ minHeight:"100vh", background:"#f1f5f9", fontFamily:"'Inter',system-ui,sans-serif", color:"#111827", display:"flex" }}>
      <style>{css}</style>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside style={{ width:220, background:"#1e293b", display:"flex", flexDirection:"column", flexShrink:0, position:"sticky", top:0, height:"100vh" }}>
        <div style={{ padding:"20px 16px 18px", borderBottom:"1px solid #334155" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
            <div style={{ width:34, height:34, background:"#2563eb", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 }}>⛵</div>
            <span style={{ fontSize:17, fontWeight:800, color:"#fff" }}>SourceWise</span>
          </div>
          <div style={{ fontSize:10, color:"#475569", letterSpacing:"0.1em", paddingLeft:44 }}>IMPORT CHINA · ROMÂNIA</div>
        </div>

        <nav style={{ padding:"14px 10px", flex:1 }}>
          <div style={{ fontSize:10, color:"#475569", fontWeight:700, letterSpacing:"0.1em", padding:"0 8px", marginBottom:6 }}>MENIU</div>
          {NAV.map((n, i) => (
            <button key={i} className={`nav-btn ${tab===i?"nav-active":""}`} onClick={() => setTab(i)}>
              <span style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:15 }}>{n.icon}</span>
                <span style={{ fontSize:13 }}>{n.label}</span>
              </span>
              {n.badge > 0 && (
                <span style={{ background: tab===i?"rgba(255,255,255,0.25)":"#2563eb", color:"#fff", borderRadius:20, padding:"1px 7px", fontSize:10, fontWeight:700 }}>
                  {n.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div style={{ padding:"14px 16px", borderTop:"1px solid #334155" }}>
          <div style={{ fontSize:11, color:"#64748b", lineHeight:1.9 }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}><span>1 EUR</span><span style={{ color:"#94a3b8" }}>4.97 RON</span></div>
            <div style={{ display:"flex", justifyContent:"space-between" }}><span>TVA RO</span><span style={{ color:"#94a3b8" }}>19%</span></div>
            <div style={{ display:"flex", justifyContent:"space-between" }}><span>Broker vamal</span><span style={{ color:"#94a3b8" }}>€95</span></div>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>

        {/* Top bar */}
        <header style={{ background:"#fff", borderBottom:"1px solid #e5e7eb", padding:"0 28px", height:58, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:"#111827" }}>{NAV[tab].label}</div>
            <div style={{ fontSize:11, color:"#9ca3af", marginTop:1 }}>
              {tab===0 && "Caută simultan pe Alibaba B2B și AliExpress"}
              {tab===1 && (compared.length ? `${compared.length} produse selectate` : "Adaugă produse din Căutare pentru comparație")}
              {tab===2 && (cart.length ? `${cart.length} produse · ${totalWeight.toFixed(1)} kg total` : "Coș de consolidare gol")}
              {tab===3 && (lcProduct ? lcProduct.name : "Selectează un produs pentru calcul")}
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {compared.length > 0 && tab !== 1 && (
              <button className="btn-sec" onClick={() => setTab(1)} style={{ fontSize:12 }}>⚖️ Compară ({compared.length})</button>
            )}
            {cart.length > 0 && tab !== 2 && (
              <button className="btn-grn" onClick={() => setTab(2)} style={{ fontSize:12 }}>📦 Consolidare ({cart.length})</button>
            )}
          </div>
        </header>

        {/* Content */}
        <main style={{ flex:1, overflowY:"auto", padding:24 }}>

          {/* ═══ TAB 0: CĂUTARE ═══════════════════════════════════════════ */}
          {tab === 0 && (
            <div className="fade">
              <Card style={{ marginBottom:18, padding:"18px 22px" }}>
                <div style={{ display:"flex", gap:10, marginBottom:12 }}>
                  <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key==="Enter" && doSearch()}
                    placeholder="Caută produse: ex. casti wireless, huse telefon, laptop..."
                    style={{ flex:1, padding:"10px 15px", fontSize:14, border:"1px solid #d1d5db", borderRadius:7, color:"#111827" }} />
                  <button className="btn-pri" onClick={doSearch} style={{ padding:"10px 26px", fontSize:14 }}>
                    {loading ? "Se caută…" : "Caută"}
                  </button>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
                  <span style={{ fontSize:12, color:"#9ca3af" }}>Sugestii:</span>
                  {suggestions.map(s => (
                    <button key={s} className="filter" style={{ borderRadius:20 }} onClick={() => setQuery(s)}>{s}</button>
                  ))}
                  <div style={{ marginLeft:"auto", display:"flex", gap:6, flexWrap:"wrap" }}>
                    {[["all","Toate"],["alibaba","Alibaba B2B"],["aliexpress","AliExpress"]].map(([v,l]) => (
                      <button key={v} className={`filter ${filterPlatform===v?"filter-on":""}`} onClick={() => setFilterPlatform(v)}>{l}</button>
                    ))}
                    <button className={`filter ${filterVerified?"filter-on":""}`} onClick={() => setFilterVerified(x=>!x)}>✓ Verificați</button>
                    <select value={sortKey} onChange={e => setSortKey(e.target.value)}
                      style={{ padding:"6px 10px", fontSize:12, border:"1px solid #e5e7eb", borderRadius:6, color:"#374151", background:"#fff" }}>
                      <option value="priceEUR">Sortare: Preț ↑</option>
                      <option value="rating">Sortare: Rating ↓</option>
                      <option value="leadDays">Sortare: Livrare ↑</option>
                      <option value="moq">Sortare: MOQ ↑</option>
                    </select>
                  </div>
                </div>
              </Card>

              {loading && (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {[1,2,3].map(i => <div key={i} style={{ height:100, borderRadius:10, background:"#e2e8f0" }} />)}
                </div>
              )}

              {!loading && searched && (
                <div>
                  <div style={{ fontSize:13, color:"#6b7280", marginBottom:10 }}>
                    <strong style={{ color:"#374151" }}>{results.length} rezultate</strong> — selectați max. 3 pentru comparație
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {results.map((p, i) => {
                      const lcEst = calcLanded(p, p.moq||100, "sea_lcl");
                      const isComp = !!compared.find(x => x.id===p.id);
                      const inCart2 = !!cart.find(x => x.id===p.id);
                      return (
                        <div key={p.id} className={`prow fade ${isComp?"prow-sel":""}`} style={{ animationDelay:`${i*0.04}s` }}>
                          <div style={{ width:44, height:44, background:"#f1f5f9", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{p.img}</div>
                          <div>
                            <div style={{ fontWeight:600, fontSize:13, color:"#111827", marginBottom:3 }}>{p.name}</div>
                            <div style={{ fontSize:11, color:"#6b7280", marginBottom:6 }}>{p.supplier}</div>
                            <div style={{ display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
                              <PlatBadge p={p.platform} />
                              {p.verified && <Trust label="✓ Verificat" color="#15803d" bg="#f0fdf4" />}
                              {p.audited && <Trust label="Auditat" color="#1d4ed8" bg="#eff6ff" />}
                              {p.ta && <Trust label="🛡 Trade Assurance" color="#b45309" bg="#fffbeb" />}
                              <span style={{ fontSize:10, color:"#d1d5db" }}>HS {p.hs}</span>
                            </div>
                          </div>
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontSize:17, fontWeight:800, color:"#111827" }}>€{p.priceEUR.toFixed(2)}</div>
                            <div style={{ fontSize:11, color:"#9ca3af" }}>{fRon(p.priceEUR)} / buc.</div>
                            <div style={{ fontSize:11, color:"#6b7280", marginTop:4 }}>MOQ: {p.moq.toLocaleString()}</div>
                          </div>
                          <div style={{ borderLeft:"1px solid #f3f4f6", paddingLeft:14, textAlign:"right" }}>
                            <div style={{ fontSize:10, color:"#9ca3af", marginBottom:2 }}>Cost total / buc.*</div>
                            <div style={{ fontSize:15, fontWeight:700, color:"#2563eb" }}>€{lcEst.unit.toFixed(2)}</div>
                            <div style={{ fontSize:11, color:"#9ca3af" }}>{fRon(lcEst.unit)}</div>
                            <div style={{ display:"flex", gap:8, marginTop:3, justifyContent:"flex-end" }}>
                              <span style={{ fontSize:11, color:"#f59e0b" }}>★ {p.rating}</span>
                              <span style={{ fontSize:11, color:"#9ca3af" }}>🕐 {p.leadDays}z</span>
                            </div>
                          </div>
                          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                            <button className="btn-pri" style={{ fontSize:12, padding:"8px 12px" }} onClick={() => openLC(p)}>Calculator cost →</button>
                            <button className="btn-grn" style={{ fontSize:11, padding:"7px 12px" }} onClick={() => addToCart(p)}>
                              {inCart2 ? "✓ În consolidare" : "+ Consolidare"}
                            </button>
                            <button className={`btn-sec ${isComp?"filter-on":""}`} style={{ fontSize:11, padding:"7px 12px" }} onClick={() => toggleCompare(p)}>
                              {isComp ? "✓ Selectat" : "+ Compară"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop:10, padding:"8px 12px", background:"#f8fafc", borderRadius:6, fontSize:11, color:"#9ca3af", border:"1px solid #f1f5f9" }}>
                    * Estimare: produs + freight sea LCL + taxe vamale UE (cod HS) + TVA 19% RO + asigurare + broker €95 — pentru MOQ bucăți, destinație România.
                  </div>
                </div>
              )}

              {!loading && !searched && (
                <Empty icon="🔍" title="Caută produse din China" sub="Introduceți un produs pentru a căuta pe Alibaba B2B și AliExpress" />
              )}
            </div>
          )}

          {/* ═══ TAB 1: COMPARĂ ═══════════════════════════════════════════ */}
          {tab === 1 && (
            <div className="fade">
              {compared.length === 0 ? (
                <Empty icon="⚖️" title="Niciun produs selectat" sub='Mergi la Căutare și apasă "+ Compară" (max. 3 produse)' />
              ) : (
                <div>
                  {/* Header cards */}
                  <div style={{ display:"grid", gridTemplateColumns:`200px repeat(${compared.length},1fr)`, gap:12, marginBottom:16 }}>
                    <div />
                    {compared.map(p => (
                      <Card key={p.id} style={{ padding:16, borderTop:`3px solid ${p.platform==="alibaba"?"#c2500a":"#b91c1c"}` }}>
                        <div style={{ fontSize:26, marginBottom:8 }}>{p.img}</div>
                        <div style={{ fontSize:13, fontWeight:700, color:"#111827", lineHeight:1.3, marginBottom:3 }}>{p.name}</div>
                        <div style={{ fontSize:11, color:"#6b7280", marginBottom:8 }}>{p.supplier}</div>
                        <PlatBadge p={p.platform} />
                        <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:3 }}>
                          {p.verified && <div style={{ fontSize:11, color:"#16a34a" }}>✓ Verificat</div>}
                          {p.audited && <div style={{ fontSize:11, color:"#2563eb" }}>✓ Auditat</div>}
                          {p.ta && <div style={{ fontSize:11, color:"#d97706" }}>🛡 Trade Assurance</div>}
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Rows */}
                  {[
                    { lbl:"Preț unitar", fmt:p=>`€${p.priceEUR.toFixed(2)}`, sub:p=>fRon(p.priceEUR), num:p=>p.priceEUR, good:"low" },
                    { lbl:"MOQ (buc.)", fmt:p=>p.moq.toLocaleString(), num:p=>p.moq, good:"low" },
                    { lbl:"Termen livrare", fmt:p=>`${p.leadDays} zile`, num:p=>p.leadDays, good:"low" },
                    { lbl:"Rating", fmt:p=>`★ ${p.rating}/5`, num:p=>p.rating, good:"high" },
                    { lbl:"Nr. recenzii", fmt:p=>p.reviews.toLocaleString(), num:p=>p.reviews, good:"high" },
                    { lbl:"Greutate/buc.", fmt:p=>`${p.kg} kg`, num:p=>p.kg, good:"low" },
                    { lbl:"Cost total/buc.*", fmt:p=>`€${calcLanded(p,p.moq||100,"sea_lcl").unit.toFixed(2)}`, sub:p=>fRon(calcLanded(p,p.moq||100,"sea_lcl").unit), num:p=>calcLanded(p,p.moq||100,"sea_lcl").unit, good:"low" },
                  ].map(({ lbl, fmt, sub, num, good }) => {
                    const vals = compared.map(num);
                    const best = good==="low" ? Math.min(...vals) : Math.max(...vals);
                    return (
                      <div key={lbl} style={{ display:"grid", gridTemplateColumns:`200px repeat(${compared.length},1fr)`, gap:12, marginBottom:8 }}>
                        <div style={{ display:"flex", alignItems:"center", fontSize:12, fontWeight:600, color:"#6b7280" }}>{lbl}</div>
                        {compared.map(p => {
                          const v = num(p), isBest = v===best;
                          const pct = good==="low" ? (best/v)*100 : (v/Math.max(...vals))*100;
                          return (
                            <div key={p.id} style={{ background:isBest?"#eff6ff":"#fff", border:`1px solid ${isBest?"#bfdbfe":"#e5e7eb"}`, borderRadius:8, padding:"11px 14px" }}>
                              <div style={{ fontSize:14, fontWeight:isBest?700:500, color:isBest?"#1d4ed8":"#374151" }}>{fmt(p)}</div>
                              {sub && <div style={{ fontSize:11, color:"#9ca3af", marginTop:1 }}>{sub(p)}</div>}
                              <Bar pct={pct} color={isBest?"#2563eb":"#e5e7eb"} />
                              {isBest && <div style={{ fontSize:10, color:"#2563eb", fontWeight:700, marginTop:4 }}>✓ Cel mai bun</div>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  <div style={{ fontSize:11, color:"#9ca3af", marginTop:4 }}>* Cost total calculat pentru MOQ, sea LCL, destinație România (taxe + TVA incluse)</div>

                  <div style={{ display:"grid", gridTemplateColumns:`200px repeat(${compared.length},1fr)`, gap:12, marginTop:14 }}>
                    <div />
                    {compared.map(p => (
                      <div key={p.id} style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        <button className="btn-pri" style={{ fontSize:12 }} onClick={() => openLC(p)}>Calculator cost →</button>
                        <button className="btn-grn" style={{ fontSize:12 }} onClick={() => addToCart(p)}>+ Consolidare</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ TAB 2: CONSOLIDARE ════════════════════════════════════════ */}
          {tab === 2 && (
            <div className="fade">
              {cart.length === 0 ? (
                <Empty icon="📦" title="Coș de consolidare gol" sub='Adaugă produse din Căutare sau Compară cu butonul "+ Consolidare"' />
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 310px", gap:20, alignItems:"start" }}>
                  <div>
                    {/* Mode */}
                    <Card style={{ padding:"14px 18px", marginBottom:16 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:"#374151", marginBottom:10 }}>Tip consolidare</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {[["multi_supplier","📦 Furnizori multipli"],["air_sea","✈🚢 Split Aer/Mare"],["warehouse_cn","🏭 Depozit China"],["group_buyers","👥 Grupat"]].map(([v,l]) => (
                          <button key={v} className={`filter ${consMode===v?"filter-on":""}`} style={{ borderRadius:6 }} onClick={() => setConsMode(v)}>{l}</button>
                        ))}
                      </div>
                    </Card>

                    {/* Items */}
                    <Section title="Produse în consolidare" />
                    <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
                      {cartItems.map(({ p, qty }) => (
                        <Card key={p.id} style={{ padding:"13px 16px" }}>
                          <div style={{ display:"grid", gridTemplateColumns:"40px 1fr 110px 110px 36px", alignItems:"center", gap:12 }}>
                            <div style={{ width:40, height:40, background:"#f1f5f9", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{p.img}</div>
                            <div>
                              <div style={{ fontSize:13, fontWeight:600, color:"#111827", marginBottom:2 }}>{p.name}</div>
                              <div style={{ fontSize:11, color:"#6b7280", marginBottom:4 }}>{p.supplier}</div>
                              <PlatBadge p={p.platform} />
                            </div>
                            <div>
                              <div style={{ fontSize:11, color:"#9ca3af", marginBottom:4 }}>Cantitate</div>
                              <input type="number" value={qty}
                                onChange={e => setCartQtys(q => ({ ...q, [p.id]: parseInt(e.target.value)||0 }))}
                                style={{ width:"100%", padding:"6px 9px", fontSize:13, border:"1px solid #d1d5db", borderRadius:6, textAlign:"right" }} />
                              {qty < p.moq && <div style={{ fontSize:10, color:"#dc2626", marginTop:2 }}>Sub MOQ ({p.moq})</div>}
                            </div>
                            <div style={{ textAlign:"right" }}>
                              <div style={{ fontSize:13, fontWeight:700 }}>€{(p.priceEUR*qty).toFixed(0)}</div>
                              <div style={{ fontSize:11, color:"#9ca3af" }}>{(p.kg*qty).toFixed(1)} kg</div>
                            </div>
                            <button onClick={() => { setCart(c=>c.filter(x=>x.id!==p.id)); setCartQtys(q=>{const n={...q};delete n[p.id];return n;}); }}
                              style={{ width:36, height:36, background:"#fef2f2", border:"1px solid #fecaca", borderRadius:6, fontSize:14, color:"#dc2626", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
                          </div>
                        </Card>
                      ))}
                    </div>

                    {/* Mode insights */}
                    {consMode==="air_sea" && (
                      <Card style={{ background:"#eff6ff", borderColor:"#bfdbfe", padding:16 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"#1d4ed8", marginBottom:8 }}>Recomandare Split Aer / Mare</div>
                        {cartItems.filter(({p})=>p.leadDays<=10).length>0 && <div style={{ fontSize:12, color:"#374151", marginBottom:4 }}>✈ <strong>Aerian:</strong> {cartItems.filter(({p})=>p.leadDays<=10).map(({p})=>p.name).join(", ")}</div>}
                        {cartItems.filter(({p})=>p.leadDays>10).length>0 && <div style={{ fontSize:12, color:"#374151" }}>🚢 <strong>Maritim:</strong> {cartItems.filter(({p})=>p.leadDays>10).map(({p})=>p.name).join(", ")}</div>}
                      </Card>
                    )}
                    {consMode==="warehouse_cn" && (
                      <Card style={{ background:"#f0fdf4", borderColor:"#bbf7d0", padding:16 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"#15803d", marginBottom:6 }}>Depozit Intermediar China</div>
                        <div style={{ fontSize:12, color:"#374151", lineHeight:1.7 }}>
                          Colectare la depozit Shenzhen/Guangzhou până la completarea containerului.<br/>
                          Taxă depozitare: <strong>€{WAREHOUSE_FEE}/lună</strong> · Economie netă estimată: <strong style={{ color:"#15803d" }}>€{Math.max(0,savings-WAREHOUSE_FEE).toFixed(0)}</strong>
                        </div>
                      </Card>
                    )}
                    {consMode==="group_buyers" && (
                      <Card style={{ background:"#fdf4ff", borderColor:"#e9d5ff", padding:16 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"#7e22ce", marginBottom:6 }}>Container Comun — Importatori Grupați</div>
                        <div style={{ fontSize:12, color:"#374151", lineHeight:1.7 }}>
                          Împărțiți costul unui FCL cu alți importatori.<br/>
                          Cost FCL total: <strong>€{(totalWeight*FREIGHT.sea_fcl).toFixed(0)}</strong> · Economie per buyer (×2): <strong style={{ color:"#7e22ce" }}>€{(savings/2).toFixed(0)}</strong>
                        </div>
                      </Card>
                    )}
                  </div>

                  {/* Summary */}
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    <Card color="#93c5fd" style={{ background:"#eff6ff" }}>
                      <Section title="Rezumat expediere" />
                      {[
                        ["Greutate totală", `${(plan?.total_weight ?? totalWeight).toFixed(1)} kg`],
                        ["Valoare produse", fBoth(plan?.total_value ?? totalValue)],
                        ["Transport recomandat", `🚢 ${(plan?.recommended_method ?? (totalWeight>2000?"sea_fcl":"sea_lcl")).toUpperCase()}`],
                        ["Cost freight estimat", fBoth(plan?.sea_freight_cost ?? seaFreight)],
                      ].map(([l,v]) => (
                        <div key={l} style={{ display:"flex", justifyContent:"space-between", paddingBottom:9, marginBottom:9, borderBottom:"1px solid #dbeafe" }}>
                          <span style={{ fontSize:12, color:"#6b7280" }}>{l}</span>
                          <span style={{ fontSize:12, fontWeight:600, color:"#1e40af" }}>{v}</span>
                        </div>
                      ))}
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:13, fontWeight:700, color:"#16a34a" }}>Economie vs. aerian</span>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:18, fontWeight:800, color:"#15803d" }}>€{(plan?.savings_vs_air ?? savings).toFixed(0)}</div>
                          <div style={{ fontSize:11, color:"#16a34a" }}>{fRon(plan?.savings_vs_air ?? savings)}</div>
                        </div>
                      </div>
                    </Card>

                    <Card>
                      <Section title="Recomandare" />
                      <div style={{ fontSize:12, color:"#374151", lineHeight:1.7, padding:"10px 12px", background:"#f8fafc", borderRadius:6 }}>
                        {totalWeight>2000 ? "✅ Greutate suficientă pentru FCL. Cost per kg minim disponibil."
                          : totalWeight>200 ? `📦 ${totalWeight.toFixed(0)} kg — LCL optim. Acumulați până la 2.000 kg pentru FCL.`
                          : "✈ Sub 200 kg — considerați aerian dacă marfa este urgentă."}
                      </div>
                    </Card>

                    <Card>
                      <Section title="Cost per produs (sea)" />
                      {cartItems.map(({ p, qty }) => {
                        const backendCost = plan?.per_product_costs?.find(c => c.product_id === p.id);
                        const unit = backendCost ? backendCost.unit_cost : calcLanded(p, qty, seaMethod).unit;
                        return (
                          <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:9, marginBottom:9, borderBottom:"1px solid #f3f4f6" }}>
                            <div>
                              <div style={{ fontSize:12, fontWeight:600 }}>{p.img} {p.name.length>26?p.name.slice(0,26)+"…":p.name}</div>
                              <div style={{ fontSize:11, color:"#9ca3af" }}>{qty.toLocaleString()} buc.</div>
                            </div>
                            <div style={{ textAlign:"right" }}>
                              <div style={{ fontSize:13, fontWeight:700, color:"#2563eb" }}>€{unit.toFixed(2)}</div>
                              <div style={{ fontSize:11, color:"#9ca3af" }}>{fRon(unit)}</div>
                            </div>
                          </div>
                        );
                      })}
                      <button className="btn-pri" style={{ width:"100%", fontSize:12, marginTop:4 }} onClick={() => setTab(3)}>
                        Calculator detaliat →
                      </button>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ TAB 3: CALCULATOR COST ════════════════════════════════════ */}
          {tab === 3 && (
            <div className="fade">
              {!lcProduct ? (
                <Empty icon="🧮" title="Niciun produs selectat" sub='Apasă "Calculator cost" pe orice produs din Căutare sau Compară' />
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"270px 1fr", gap:20, alignItems:"start" }}>
                  {/* Config */}
                  <Card>
                    <Section title="Produs" />
                    <div style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:16, paddingBottom:16, borderBottom:"1px solid #f3f4f6" }}>
                      <div style={{ width:44, height:44, background:"#f1f5f9", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>{lcProduct.img}</div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:"#111827", lineHeight:1.3, marginBottom:4 }}>{lcProduct.name}</div>
                        <div style={{ fontSize:11, color:"#6b7280", marginBottom:6 }}>{lcProduct.supplier}</div>
                        <PlatBadge p={lcProduct.platform} />
                      </div>
                    </div>
                    <div style={{ marginBottom:16 }}>
                      <label style={{ fontSize:12, fontWeight:600, color:"#374151", display:"block", marginBottom:6 }}>Cantitate (bucăți)</label>
                      <input type="number" value={lcQty} onChange={e => setLcQty(parseInt(e.target.value)||1)}
                        style={{ width:"100%", padding:"9px 12px", fontSize:14, border:"1px solid #d1d5db", borderRadius:7 }} />
                      <div style={{ marginTop:6, padding:"6px 10px", borderRadius:5, fontSize:11,
                        background: lcQty<lcProduct.moq?"#fef2f2":"#f0fdf4",
                        border: `1px solid ${lcQty<lcProduct.moq?"#fecaca":"#bbf7d0"}`,
                        color: lcQty<lcProduct.moq?"#dc2626":"#16a34a" }}>
                        {lcQty<lcProduct.moq ? `⚠ Sub MOQ minim (${lcProduct.moq.toLocaleString()} buc.)` : `✓ Cantitate validă (MOQ: ${lcProduct.moq.toLocaleString()})`}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:"#374151", display:"block", marginBottom:8 }}>Metodă transport</label>
                      {[["air","✈ Transport Aerian","2–5 zile","Recomandat sub 200 kg"],
                        ["sea_lcl","🚢 Maritim LCL","30–40 zile","200 – 2.000 kg"],
                        ["sea_fcl","🚢 Maritim FCL","30–40 zile","Peste 2.000 kg"]].map(([v,l,t,tip]) => (
                        <button key={v} className={`method-btn ${lcMethod===v?"method-on":""}`} onClick={() => setLcMethod(v)}>
                          <div>
                            <div style={{ fontSize:12, fontWeight:600, color:lcMethod===v?"#1d4ed8":"#374151" }}>{l}</div>
                            <div style={{ fontSize:10, color:"#9ca3af" }}>{t} · {tip}</div>
                          </div>
                          {lcMethod===v && <span style={{ color:"#2563eb", fontSize:16 }}>✓</span>}
                        </button>
                      ))}
                    </div>
                  </Card>

                  {/* Results */}
                  {lc && (
                    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                      {/* KPI */}
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
                        <div style={{ background:"#1e293b", borderRadius:10, padding:22, textAlign:"center" }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"#64748b", letterSpacing:"0.08em", marginBottom:10 }}>COST TOTAL COMANDĂ</div>
                          <div style={{ fontSize:30, fontWeight:800, color:"#fff", marginBottom:4 }}>€{lc.total.toFixed(0)}</div>
                          <div style={{ fontSize:13, color:"#94a3b8" }}>{fRon(lc.total)}</div>
                          <div style={{ fontSize:11, color:"#475569", marginTop:6 }}>{lcQty.toLocaleString()} bucăți</div>
                        </div>
                        <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:10, padding:22, textAlign:"center" }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"#3b82f6", letterSpacing:"0.08em", marginBottom:10 }}>COST PER UNITATE</div>
                          <div style={{ fontSize:30, fontWeight:800, color:"#1d4ed8", marginBottom:4 }}>€{lc.unit.toFixed(2)}</div>
                          <div style={{ fontSize:13, color:"#3b82f6" }}>{fRon(lc.unit)}</div>
                          <div style={{ fontSize:11, color:"#6b7280", marginTop:6 }}>vs. €{lcProduct.priceEUR.toFixed(2)} ex-factory</div>
                        </div>
                        <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:10, padding:22, textAlign:"center" }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"#d97706", letterSpacing:"0.08em", marginBottom:10 }}>OVERHEAD LOGISTIC</div>
                          <div style={{ fontSize:30, fontWeight:800, color:"#b45309", marginBottom:4 }}>+{(((lc.unit/lcProduct.priceEUR)-1)*100).toFixed(0)}%</div>
                          <div style={{ fontSize:12, color:"#92400e" }}>Vamă: {(lc.dutyRate*100).toFixed(1)}%</div>
                          <div style={{ fontSize:12, color:"#92400e" }}>TVA RO: 19%</div>
                        </div>
                      </div>

                      {/* Breakdown */}
                      <Card>
                        <Section title="Detaliu costuri" />
                        {[
                          { lbl:"Cost produse (ex-factory)", v:lc.prod, color:"#2563eb" },
                          { lbl:"Transport internațional", v:lc.freight, color:"#7c3aed" },
                          { lbl:"Taxe vamale UE", v:lc.duties, color:"#d97706" },
                          { lbl:"TVA România (19%)", v:lc.vat, color:"#dc2626" },
                          { lbl:"Asigurare marfă (0.5%)", v:lc.ins, color:"#6b7280" },
                          { lbl:"Broker vamal (fix)", v:lc.broker, color:"#9ca3af" },
                        ].map(({ lbl, v, color }) => {
                          const pct = (v/lc.total)*100;
                          return (
                            <div key={lbl} style={{ marginBottom:13 }}>
                              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                                <span style={{ fontSize:13, color:"#374151" }}>{lbl}</span>
                                <div>
                                  <span style={{ fontSize:13, fontWeight:600, color:"#111827" }}>€{v.toFixed(2)}</span>
                                  <span style={{ fontSize:11, color:"#9ca3af", marginLeft:8 }}>{pct.toFixed(1)}%</span>
                                </div>
                              </div>
                              <Bar pct={pct} color={color} height={6} />
                            </div>
                          );
                        })}
                        <div style={{ borderTop:"2px solid #e5e7eb", paddingTop:12, display:"flex", justifyContent:"space-between" }}>
                          <span style={{ fontSize:14, fontWeight:700, color:"#111827" }}>TOTAL</span>
                          <span style={{ fontSize:15, fontWeight:800, color:"#111827" }}>€{lc.total.toFixed(2)} · {fRon(lc.total)}</span>
                        </div>
                      </Card>

                      {/* Method compare */}
                      <Card>
                        <Section title="Comparație metode transport" />
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                          {[["air","✈ Aerian","2–5 zile"],["sea_lcl","🚢 LCL","30–40 zile"],["sea_fcl","🚢 FCL","30–40 zile"]].map(([m,l,t]) => {
                            const est = calcLanded(lcProduct, lcQty, m);
                            const active = lcMethod===m;
                            return (
                              <div key={m} onClick={() => setLcMethod(m)}
                                style={{ padding:16, borderRadius:8, border:`1px solid ${active?"#93c5fd":"#e5e7eb"}`, background:active?"#eff6ff":"#fafafa", cursor:"pointer", transition:"all 0.15s", textAlign:"center" }}>
                                <div style={{ fontSize:13, fontWeight:600, color:active?"#1d4ed8":"#6b7280", marginBottom:6 }}>{l}</div>
                                <div style={{ fontSize:22, fontWeight:800, color:active?"#1d4ed8":"#374151" }}>€{est.unit.toFixed(2)}</div>
                                <div style={{ fontSize:11, color:active?"#3b82f6":"#9ca3af", marginBottom:4 }}>{fRon(est.unit)} / buc.</div>
                                <div style={{ fontSize:10, color:"#9ca3af" }}>{t}</div>
                                {active && <div style={{ marginTop:5, fontSize:10, fontWeight:700, color:"#2563eb" }}>✓ SELECTAT</div>}
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ TAB 4: AI COPILOT ════════════════════════════════════════ */}
          {tab === 4 && (
            <div className="fade">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", gap:18, alignItems:"start" }}>
                <Card>
                  <Section title="Chat" />
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    <div style={{ height:420, overflowY:"auto", border:"1px solid #e5e7eb", borderRadius:10, padding:12, background:"#fff" }}>
                      {chatMessages.map((m, idx) => (
                        <div key={idx} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start", marginBottom:10 }}>
                          <div style={{
                            maxWidth:"78%",
                            padding:"10px 12px",
                            borderRadius:12,
                            fontSize:13,
                            lineHeight:1.45,
                            background: m.role==="user" ? "#2563eb" : "#f1f5f9",
                            color: m.role==="user" ? "#fff" : "#0f172a",
                            border: m.role==="user" ? "1px solid #1d4ed8" : "1px solid #e5e7eb",
                            whiteSpace:"pre-wrap",
                          }}>
                            {m.content}
                          </div>
                        </div>
                      ))}
                      {chatLoading && (
                        <div style={{ fontSize:12, color:"#64748b" }}>Se procesează…</div>
                      )}
                    </div>
                    <div style={{ display:"flex", gap:10 }}>
                      <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key==="Enter" && sendChat()}
                        placeholder='Ex: "Caută casti wireless, compară top 3, consolidează și calculează cost pentru 500 buc LCL"'
                        style={{ flex:1, padding:"10px 12px", fontSize:13, border:"1px solid #d1d5db", borderRadius:9 }}
                      />
                      <button className="btn-pri" onClick={sendChat} disabled={chatLoading} style={{ padding:"10px 14px", fontSize:13, opacity:chatLoading?0.7:1 }}>
                        Trimite
                      </button>
                    </div>
                  </div>
                </Card>

                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <Card>
                    <Section title="Scurtături" />
                    <div style={{ display:"flex", flexDirection:"column", gap:8, fontSize:12, color:"#334155", lineHeight:1.6 }}>
                      <div><strong>• Căutare:</strong> „caută casti wireless pe alibaba”</div>
                      <div><strong>• Comparație:</strong> „compară top 3”</div>
                      <div><strong>• Consolidare:</strong> „consolidare pentru 2 produse, qty 500”</div>
                      <div><strong>• Cost:</strong> „calculează cost landed 500 buc LCL”</div>
                    </div>
                  </Card>

                  <Card style={{ background:"#eff6ff", borderColor:"#bfdbfe" }}>
                    <Section title="Rezultate aplicate" />
                    <div style={{ fontSize:12, color:"#1e40af", lineHeight:1.7 }}>
                      <div>Rezultate căutare: <strong>{results.length}</strong></div>
                      <div>Comparate: <strong>{compared.length}</strong></div>
                      <div>În consolidare: <strong>{cart.length}</strong></div>
                      <div>Calculator: <strong>{lcProduct ? "selectat" : "—"}</strong></div>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
