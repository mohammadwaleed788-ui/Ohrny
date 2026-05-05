// Overview dashboard — KPI grid, DAU chart, funnel, geo split, live activity

function KPI({ label, value, delta, note, series, deltaKind }){
  const up = (delta||"").startsWith("+") || (delta||"").startsWith("↑");
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className={"kpi-delta "+(deltaKind||(up?"up":"down"))}>
        {up ? <Icons.arrowUp size={12}/> : <Icons.arrowDown size={12}/>}
        {delta} <span className="muted" style={{marginLeft:4}}>{note}</span>
      </div>
      {series && <div className="kpi-spark"><Sparkline data={series} w={80} h={24}/></div>}
    </div>
  );
}

function OverviewSection(){
  const [range, setRange] = useState("7d");
  const seed = JSON.parse(document.getElementById("seed-data").textContent).kpis;

  // Build DAU series + a true prior-period comparison (same window, shifted back)
  const { dauSeries, compareSeries, dauLabels, dauStats } = useMemo(()=>{
    const len = range==="24h"?24: range==="7d"?7: range==="30d"?30: range==="90d"?90: 12;
    // Deterministic, slightly trending generator; seedable by absolute index so prior period is a true offset
    const sample = (i)=>{
      const trend = 218000 + i*180;            // slow growth over time
      const weekly = Math.sin((i % 7) / 7 * Math.PI*2) * 11000; // weekly cycle
      const noise  = Math.sin(i*1.7)*4200 + Math.cos(i*0.6)*3100;
      return Math.max(0, Math.round(trend + weekly + noise));
    };
    // Anchor "today" so the current window ends at index N-1
    const N = 240;
    const curr = Array.from({length:len}, (_,i)=> sample(N - len + i));
    const prev = Array.from({length:len}, (_,i)=> sample(N - len*2 + i));

    const labels = range==="24h"
      ? ["12a","4a","8a","12p","4p","8p","12a"]
      : range==="7d"
      ? ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
      : range==="30d"
      ? ["W-4","W-3","W-2","W-1","Now"]
      : range==="90d"
      ? ["−90d","−60d","−30d","Now"]
      : ["Q1","Q2","Q3","Q4"];

    const sum = a => a.reduce((s,v)=>s+v,0);
    const avg = a => Math.round(sum(a)/a.length);
    const peak = a => Math.max(...a);
    const currAvg = avg(curr), prevAvg = avg(prev);
    const delta = ((currAvg - prevAvg)/prevAvg)*100;

    return {
      dauSeries: curr,
      compareSeries: prev,
      dauLabels: labels,
      dauStats: {
        currAvg, prevAvg, delta,
        currPeak: peak(curr), prevPeak: peak(prev),
        currLast: curr[curr.length-1], prevLast: prev[prev.length-1],
      }
    };
  },[range]);

  const funnel = [
    { label:"App opens",       v:284119, base:284119 },
    { label:"Swipes started",  v:241540, base:284119 },
    { label:"≥1 match",        v:96231,  base:284119 },
    { label:"Sent first msg",  v:58107,  base:284119 },
    { label:"Got a reply",     v:41782,  base:284119 },
    { label:"Planned a date",  v:9214,   base:284119 },
  ];

  const geoData = [
    { label:"United States",   value:412310, pct:36.1 },
    { label:"United Kingdom",  value:142883, pct:12.5 },
    { label:"Germany",         value:98742,  pct:8.6  },
    { label:"Brazil",          value:89120,  pct:7.8  },
    { label:"Canada",          value:67209,  pct:5.9  },
    { label:"Australia",       value:52190,  pct:4.6  },
    { label:"Netherlands",     value:41008,  pct:3.6  },
  ];

  // Demographic breakdowns — MAU distribution
  const ageBuckets = [
    { label:"18–20", pct: 6.2,  n: 70820,   dir:"+0.3" },
    { label:"21–24", pct: 23.4, n: 267330,  dir:"+1.1" },
    { label:"25–29", pct: 31.8, n: 363160,  dir:"+0.4" },
    { label:"30–34", pct: 19.7, n: 225050,  dir:"−0.2" },
    { label:"35–39", pct: 10.6, n: 121080,  dir:"+0.1" },
    { label:"40–44", pct: 4.8,  n: 54850,   dir:"+0.5" },
    { label:"45+",   pct: 3.5,  n: 39990,   dir:"+0.8" },
  ];
  const genderSplit = [
    { label:"Women",      pct:46.1, n:526670, color:"oklch(0.72 0.15 25)" },
    { label:"Men",        pct:48.7, n:556240, color:"oklch(0.70 0.14 235)" },
    { label:"Different",  pct:5.2,  n:59400,  color:"oklch(0.72 0.14 300)" },
  ];
  const orientation = [
    { label:"Straight",  pct:78.4 },
    { label:"Different", pct:21.6 },
  ];
  const relIntent = [
    { label:"Long-term",       pct:38.4 },
    { label:"Short-term open", pct:22.1 },
    { label:"Figuring it out", pct:19.7 },
    { label:"Casual",          pct:12.8 },
    { label:"Marriage",        pct:4.3  },
    { label:"Hookups",         pct:2.7  },
  ];
  const cityTop = [
    { label:"New York",  n:48210, pct:4.2 },
    { label:"Los Angeles", n:39780, pct:3.5 },
    { label:"London",    n:36120, pct:3.2 },
    { label:"Berlin",    n:27450, pct:2.4 },
    { label:"São Paulo", n:24890, pct:2.2 },
    { label:"Toronto",   n:19330, pct:1.7 },
  ];
  const allCities = [
    ...cityTop,
    { label:"Paris",       n:18420, pct:1.6 },
    { label:"Sydney",      n:17110, pct:1.5 },
    { label:"Amsterdam",   n:15980, pct:1.4 },
    { label:"Madrid",      n:14720, pct:1.3 },
    { label:"Mexico City", n:14010, pct:1.2 },
    { label:"Chicago",     n:13570, pct:1.2 },
    { label:"Miami",       n:12940, pct:1.1 },
    { label:"Dublin",      n:11860, pct:1.0 },
    { label:"Stockholm",   n:10920, pct:1.0 },
    { label:"Copenhagen",  n:10330, pct:0.9 },
    { label:"Barcelona",   n:9740,  pct:0.9 },
    { label:"Lisbon",      n:9180,  pct:0.8 },
    { label:"Munich",      n:8640,  pct:0.8 },
    { label:"Vienna",      n:8210,  pct:0.7 },
    { label:"Zurich",      n:7820,  pct:0.7 },
    { label:"Tokyo",       n:7460,  pct:0.7 },
    { label:"Singapore",   n:7110,  pct:0.6 },
    { label:"Buenos Aires",n:6890,  pct:0.6 },
    { label:"Bogotá",      n:6420,  pct:0.6 },
    { label:"Auckland",    n:6080,  pct:0.5 },
    { label:"Manchester",  n:5910,  pct:0.5 },
    { label:"Hamburg",     n:5730,  pct:0.5 },
    { label:"Brussels",    n:5520,  pct:0.5 },
    { label:"Rome",        n:5310,  pct:0.5 },
    { label:"Milan",       n:5040,  pct:0.4 },
    { label:"Vancouver",   n:4880,  pct:0.4 },
    { label:"Seattle",     n:4710,  pct:0.4 },
    { label:"Austin",      n:4520,  pct:0.4 },
    { label:"Boston",      n:4380,  pct:0.4 },
    { label:"Philadelphia",n:4140,  pct:0.4 },
    { label:"Atlanta",     n:3980,  pct:0.35 },
    { label:"San Francisco",n:3870, pct:0.34 },
    { label:"Denver",      n:3720,  pct:0.33 },
    { label:"Portland",    n:3580,  pct:0.31 },
    { label:"San Diego",   n:3440,  pct:0.30 },
    { label:"Houston",     n:3310,  pct:0.29 },
    { label:"Dallas",      n:3220,  pct:0.28 },
    { label:"Phoenix",     n:3110,  pct:0.27 },
    { label:"Minneapolis", n:2980,  pct:0.26 },
    { label:"Nashville",   n:2860,  pct:0.25 },
    { label:"Detroit",     n:2710,  pct:0.24 },
    { label:"Charlotte",   n:2580,  pct:0.23 },
    { label:"Edinburgh",   n:2450,  pct:0.22 },
    { label:"Bristol",     n:2320,  pct:0.20 },
    { label:"Glasgow",     n:2240,  pct:0.20 },
    { label:"Cologne",     n:2160,  pct:0.19 },
    { label:"Frankfurt",   n:2080,  pct:0.18 },
    { label:"Düsseldorf",  n:1990,  pct:0.17 },
    { label:"Leipzig",     n:1910,  pct:0.17 },
    { label:"Rotterdam",   n:1860,  pct:0.16 },
    { label:"The Hague",   n:1740,  pct:0.15 },
    { label:"Antwerp",     n:1680,  pct:0.15 },
    { label:"Helsinki",    n:1620,  pct:0.14 },
    { label:"Oslo",        n:1580,  pct:0.14 },
    { label:"Gothenburg",  n:1520,  pct:0.13 },
    { label:"Warsaw",      n:1470,  pct:0.13 },
    { label:"Kraków",      n:1380,  pct:0.12 },
    { label:"Prague",      n:1320,  pct:0.12 },
    { label:"Budapest",    n:1260,  pct:0.11 },
    { label:"Athens",      n:1190,  pct:0.10 },
    { label:"Istanbul",    n:1140,  pct:0.10 },
    { label:"Tel Aviv",    n:1080,  pct:0.10 },
    { label:"Dubai",       n:1020,  pct:0.09 },
    { label:"Cape Town",   n:970,   pct:0.09 },
    { label:"Johannesburg",n:920,   pct:0.08 },
    { label:"Nairobi",     n:870,   pct:0.08 },
    { label:"Lagos",       n:820,   pct:0.07 },
    { label:"Cairo",       n:780,   pct:0.07 },
    { label:"Mumbai",      n:740,   pct:0.07 },
    { label:"Bangalore",   n:710,   pct:0.06 },
    { label:"Delhi",       n:680,   pct:0.06 },
    { label:"Bangkok",     n:640,   pct:0.06 },
    { label:"Kuala Lumpur",n:610,   pct:0.05 },
    { label:"Jakarta",     n:580,   pct:0.05 },
    { label:"Manila",      n:550,   pct:0.05 },
    { label:"Hong Kong",   n:520,   pct:0.05 },
    { label:"Seoul",       n:490,   pct:0.04 },
    { label:"Taipei",      n:460,   pct:0.04 },
    { label:"Osaka",       n:430,   pct:0.04 },
    { label:"Melbourne",   n:410,   pct:0.04 },
    { label:"Brisbane",    n:380,   pct:0.03 },
    { label:"Perth",       n:360,   pct:0.03 },
    { label:"Wellington",  n:330,   pct:0.03 },
    { label:"Lima",        n:310,   pct:0.03 },
    { label:"Santiago",    n:290,   pct:0.03 },
    { label:"Quito",       n:270,   pct:0.02 },
    { label:"Caracas",     n:250,   pct:0.02 },
    { label:"Montevideo",  n:230,   pct:0.02 },
    { label:"Guadalajara", n:220,   pct:0.02 },
    { label:"Monterrey",   n:210,   pct:0.02 },
    { label:"Reykjavík",   n:190,   pct:0.02 },
    { label:"Tallinn",     n:170,   pct:0.02 },
    { label:"Riga",        n:160,   pct:0.01 },
    { label:"Vilnius",     n:150,   pct:0.01 },
  ];
  const [showAllCities, setShowAllCities] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const avgAge = 27.4;
  const medAge = 26;

  const relStatus = [
    { label:"Single",            pct:58.3, n:666180 },
    { label:"In a relationship", pct:14.2, n:162250 },
    { label:"Dating around",     pct:11.6, n:132540 },
    { label:"Separated",         pct:6.1,  n:69710  },
    { label:"Divorced",          pct:5.4,  n:61700  },
    { label:"Married · open",    pct:2.8,  n:31990  },
    { label:"Widowed",           pct:1.1,  n:12570  },
    { label:"It's complicated",  pct:0.5,  n:5710   },
  ];

  return (
    <div className="section active">
      <PageHead
        title="Overview"
        sub="Wednesday, April 22 · all times UTC"
        actions={<>
          <DateRange value={range} onChange={setRange}/>
        </>}
      />

      <div className="kpi-row">
        <KPI label="Daily active users"  value={seed.dau.v}  delta={seed.dau.d}  note={seed.dau.t}  series={seed.dau.series}/>
        <KPI label="Monthly active"      value={seed.mau.v}  delta={seed.mau.d}  note={seed.mau.t}  series={seed.mau.series}/>
        <KPI label="Matches today"       value={seed.matches_today.v} delta={seed.matches_today.d} note={seed.matches_today.t} series={seed.matches_today.series}/>
        <KPI label="Monthly recurring"   value={seed.mrr.v}  delta={seed.mrr.d}  note={seed.mrr.t}  series={seed.mrr.series}/>
      </div>

      <div className="grid-2 mb-8" style={{marginBottom:14}}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Daily active users</div>
              <div className="panel-sub">
                {range==="24h"?"Last 24 hours":range==="7d"?"Last 7 days":range==="30d"?"Last 30 days":range==="90d"?"Last 90 days":"Last 12 months"}
                {" · vs prior "}
                {range==="24h"?"24h":range==="7d"?"7d":range==="30d"?"30d":range==="90d"?"90d":"12m"}
              </div>
            </div>
            <div style={{flex:1}}/>
            <div className="row" style={{fontSize:12, gap:14}}>
              <span className="row gap-sm"><span style={{display:"inline-block",width:14,height:2,background:"var(--accent)",borderRadius:2}}/> Current</span>
              <span className="row gap-sm"><span style={{display:"inline-block",width:14,height:0,borderTop:"1px dashed oklch(0.75 0.06 235)"}}/> Prior</span>
            </div>
          </div>
          <div className="panel-body">
            <div className="row" style={{alignItems:"baseline", gap:18, marginBottom:6}}>
              <div className="mono" style={{fontSize:30, fontWeight:600, letterSpacing:"-.02em"}}>
                {(dauStats.currAvg/1000).toFixed(1)}k
              </div>
              <div className="muted" style={{fontSize:12, letterSpacing:".06em", textTransform:"uppercase"}}>avg / {range==="24h"?"hour":"day"}</div>
              <div className={"chip " + (dauStats.delta>=0?"ok":"bad")} style={{marginLeft:"auto"}}>
                {dauStats.delta>=0?"▲":"▼"} {Math.abs(dauStats.delta).toFixed(1)}% vs prior
              </div>
            </div>
            <AreaChart series={dauSeries} secondary={compareSeries} labels={dauLabels}
              yFormat={n=>n>=1000?(n/1000).toFixed(0)+"k":n} w={780} h={240}/>
            <div className="row" style={{gap:0, marginTop:14, borderTop:"1px solid var(--line-soft)", paddingTop:12}}>
              <div style={{flex:1, paddingRight:14, borderRight:"1px solid var(--line-soft)"}}>
                <div className="muted" style={{fontSize:11, letterSpacing:".08em", textTransform:"uppercase"}}>Current avg</div>
                <div className="mono" style={{fontSize:16, fontWeight:600, marginTop:2}}>{dauStats.currAvg.toLocaleString()}</div>
              </div>
              <div style={{flex:1, padding:"0 14px", borderRight:"1px solid var(--line-soft)"}}>
                <div className="muted" style={{fontSize:11, letterSpacing:".08em", textTransform:"uppercase"}}>Prior avg</div>
                <div className="mono" style={{fontSize:16, fontWeight:600, marginTop:2, color:"var(--text-mute)"}}>{dauStats.prevAvg.toLocaleString()}</div>
              </div>
              <div style={{flex:1, padding:"0 14px", borderRight:"1px solid var(--line-soft)"}}>
                <div className="muted" style={{fontSize:11, letterSpacing:".08em", textTransform:"uppercase"}}>Peak</div>
                <div className="mono" style={{fontSize:16, fontWeight:600, marginTop:2}}>{dauStats.currPeak.toLocaleString()}</div>
              </div>
              <div style={{flex:1, paddingLeft:14}}>
                <div className="muted" style={{fontSize:11, letterSpacing:".08em", textTransform:"uppercase"}}>Δ vs prior peak</div>
                <div className="mono" style={{fontSize:16, fontWeight:600, marginTop:2, color: dauStats.currPeak>=dauStats.prevPeak ? "var(--ok)" : "var(--bad)"}}>
                  {dauStats.currPeak>=dauStats.prevPeak?"+":""}{(((dauStats.currPeak-dauStats.prevPeak)/dauStats.prevPeak)*100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Now on Ohrny</div>
            <div className="panel-sub">live · updated 2s ago</div>
            <div style={{flex:1}}/>
            <span className="chip ok"><span className="ddot" style={{animation:"pulse 1.4s infinite"}}/> LIVE</span>
          </div>
          <div className="panel-body" style={{display:"flex",flexDirection:"column",gap:18}}>
            <div>
              <div className="mono" style={{fontSize:36, fontWeight:600, letterSpacing:"-.02em"}}>41,207</div>
              <div className="muted" style={{fontSize:12}}>users active in last 5 min</div>
            </div>
            <div className="col gap-sm" style={{gap:10}}>
              {[
                {l:"iOS",      v:72, n:"29,669"},
                {l:"Android",  v:25, n:"10,302"},
                {l:"Web",      v:3,  n:"1,236"},
              ].map(r=>(
                <div key={r.l} className="barlist">
                  <div className="bar-row">
                    <span className="dim">{r.l}</span>
                    <div className="bar-track"><div className="bar-fill" style={{width:r.v+"%"}}/></div>
                    <span className="mono tnum right">{r.n}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-3" style={{marginBottom:14}}>
        <KPI label="LTV (blended)"  value={seed.ltv.v} delta={seed.ltv.d} note={seed.ltv.t}/>
        <KPI label="ARPU (7d)"      value={seed.arpu.v} delta={seed.arpu.d} deltaKind="down" note={seed.arpu.t}/>
        <KPI label="Open reports"   value={seed.reports.v} delta={seed.reports.d} deltaKind="up" note={seed.reports.t}/>
      </div>

      <div className="grid-2" style={{marginBottom:14}}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Engagement funnel</div>
              <div className="panel-sub">Today · from app open to planned date</div>
            </div>
            <div style={{flex:1}}/>
            <span className="chip">{range}</span>
          </div>
          <div className="panel-body">
            <div className="funnel">
              {funnel.map((s,i)=>{
                const w = (s.v/s.base)*100;
                const prev = i===0?s.base:funnel[i-1].v;
                const conv = (s.v/prev)*100;
                return (
                  <div key={s.label} className="step" style={{"--w":w+"%"}}>
                    <div className="row">
                      <span className="lbl">{s.label}</span>
                      <span className="pct">{conv.toFixed(1)}% ↓</span>
                    </div>
                    <span className="num">{s.v.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Geographic split</div>
            <div className="panel-sub">MAU by country</div>
            <div style={{flex:1}}/>
            <button className="btn ghost" style={{fontSize:12}}>View all 47 →</button>
          </div>
          <div className="panel-body">
            <div className="barlist">
              {geoData.map(g=>(
                <div key={g.label} className="bar-row">
                  <span className="dim">{g.label}</span>
                  <div className="bar-track"><div className="bar-fill" style={{width:g.pct*2.4+"%"}}/></div>
                  <span className="mono tnum right">{(g.value/1000).toFixed(0)}k</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Age distribution</div>
              <div className="panel-sub">MAU by age bucket · avg {avgAge} · median {medAge}</div>
            </div>
            <div style={{flex:1}}/>
            <span className="chip">{range}</span>
          </div>
          <div className="panel-body">
            <div className="barlist">
              {ageBuckets.map(a=>{
                const up = a.dir.startsWith("+");
                return (
                  <div key={a.label} className="bar-row">
                    <span className="dim mono" style={{width:52}}>{a.label}</span>
                    <div className="bar-track"><div className="bar-fill" style={{width:(a.pct/35*100)+"%"}}/></div>
                    <span className="mono tnum" style={{width:64,textAlign:"right"}}>{(a.n/1000).toFixed(0)}k</span>
                    <span className="mono tnum" style={{width:44,textAlign:"right",color:"var(--text-mute)"}}>{a.pct.toFixed(1)}%</span>
                    <span className="mono" style={{width:40,textAlign:"right",fontSize:11,color:up?"var(--ok)":"var(--bad)"}}>{a.dir}</span>
                  </div>
                );
              })}
            </div>
            <div className="row" style={{gap:10,marginTop:14,paddingTop:12,borderTop:"1px solid var(--line-soft)",fontSize:11.5,color:"var(--text-mute)"}}>
              <span>55% of users are 25–34 · the core dating cohort</span>
              <div style={{flex:1}}/>
              <span className="mono">± mo/mo in right col</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Gender</div>
              <div className="panel-sub">Self-reported · MAU</div>
            </div>
          </div>
          <div className="panel-body">
            <div style={{display:"flex",gap:14,marginBottom:14}}>
              {genderSplit.map(g=>(
                <div key={g.label} style={{flex:g.pct,minWidth:60}}>
                  <div style={{height:8,borderRadius:4,background:g.color}}/>
                  <div style={{fontSize:11.5,marginTop:6,fontWeight:500}}>{g.label}</div>
                  <div className="mono muted" style={{fontSize:11}}>{g.pct}% · {(g.n/1000).toFixed(0)}k</div>
                </div>
              ))}
            </div>
            <div className="muted" style={{fontSize:11,letterSpacing:".08em",textTransform:"uppercase",margin:"4px 0 8px"}}>Orientation</div>
            <div className="barlist">
              {orientation.map(o=>(
                <div key={o.label} className="bar-row">
                  <span className="dim" style={{width:110}}>{o.label}</span>
                  <div className="bar-track"><div className="bar-fill" style={{width:(o.pct/70*100)+"%"}}/></div>
                  <span className="mono tnum right">{o.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{marginTop:14,marginBottom:14}}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Relationship status</div>
              <div className="panel-sub">Self-reported · MAU</div>
            </div>
          </div>
          <div className="panel-body">
            <div className="barlist">
              {relStatus.map(r=>(
                <div key={r.label} className="bar-row">
                  <span className="dim" style={{width:140}}>{r.label}</span>
                  <div className="bar-track"><div className="bar-fill" style={{width:(r.pct/60*100)+"%"}}/></div>
                  <span className="mono tnum" style={{width:60,textAlign:"right"}}>{(r.n/1000).toFixed(0)}k</span>
                  <span className="mono tnum right" style={{color:"var(--text-mute)"}}>{r.pct}%</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid var(--line-soft)",fontSize:11.5,color:"var(--text-mute)"}}>
              Flagged: 2.8% married-open users require ethical-non-monogamy badge compliance check.
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">What people are here for</div>
              <div className="panel-sub">Relationship intent · self-selected at onboarding</div>
            </div>
          </div>
          <div className="panel-body">
            <div className="barlist">
              {relIntent.map(r=>(
                <div key={r.label} className="bar-row">
                  <span className="dim" style={{width:140}}>{r.label}</span>
                  <div className="bar-track"><div className="bar-fill" style={{width:(r.pct/45*100)+"%"}}/></div>
                  <span className="mono tnum right">{r.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Top cities</div>
              <div className="panel-sub">MAU concentration</div>
            </div>
            <div style={{flex:1}}/>
            <button className="btn ghost" style={{fontSize:12}} onClick={()=>setShowAllCities(true)}>All cities →</button>
          </div>
          <div className="panel-body">
            <div className="barlist">
              {cityTop.map(c=>(
                <div key={c.label} className="bar-row">
                  <span className="dim" style={{width:110}}>{c.label}</span>
                  <div className="bar-track"><div className="bar-fill" style={{width:(c.pct/5*100)+"%"}}/></div>
                  <span className="mono tnum" style={{width:60,textAlign:"right"}}>{(c.n/1000).toFixed(1)}k</span>
                  <span className="mono tnum right" style={{color:"var(--text-mute)"}}>{c.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showAllCities && (
        <div className="ac-backdrop" onClick={()=>setShowAllCities(false)}>
          <div className="ac-modal" onClick={e=>e.stopPropagation()}>
            <div className="ac-head">
              <div>
                <div style={{fontSize:15,fontWeight:600}}>All cities</div>
                <div className="muted" style={{fontSize:12,marginTop:2}}>{allCities.length} cities · MAU concentration</div>
              </div>
              <div style={{flex:1}}/>
              <div className="search" style={{minWidth:220}}>
                <Icons.search size={13}/>
                <input placeholder="Search city" value={citySearch} onChange={e=>setCitySearch(e.target.value)} autoFocus/>
              </div>
              <button className="top-btn" onClick={()=>setShowAllCities(false)} aria-label="Close"><Icons.close size={14}/></button>
            </div>
            <div className="ac-body">
              <div className="barlist">
                {allCities
                  .filter(c=>!citySearch || c.label.toLowerCase().includes(citySearch.toLowerCase()))
                  .map(c=>(
                  <div key={c.label} className="bar-row">
                    <span className="dim" style={{width:140}}>{c.label}</span>
                    <div className="bar-track"><div className="bar-fill" style={{width:(c.pct/5*100)+"%"}}/></div>
                    <span className="mono tnum" style={{width:64,textAlign:"right"}}>{(c.n/1000).toFixed(1)}k</span>
                    <span className="mono tnum right" style={{color:"var(--text-mute)",width:48}}>{c.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="ac-foot">
              <span className="muted" style={{fontSize:12}}>Last refresh: 2 min ago</span>
              <div style={{flex:1}}/>
              <button className="btn primary" onClick={()=>setShowAllCities(false)}>Done</button>
            </div>
          </div>
          <style>{`
            .ac-backdrop{position:fixed;inset:0;background:oklch(0.12 0.01 260 / .6);z-index:80;display:flex;align-items:center;justify-content:center;padding:32px}
            .ac-modal{background:var(--bg-elev);border:1px solid var(--line);border-radius:12px;width:680px;max-width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 40px 80px -30px rgba(0,0,0,.8)}
            .ac-head{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--line-soft)}
            .ac-body{padding:14px 18px;overflow-y:auto;flex:1}
            .ac-foot{display:flex;align-items:center;gap:8px;padding:12px 18px;border-top:1px solid var(--line-soft)}
          `}</style>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%,100% { opacity: 1 }
          50% { opacity: .3 }
        }
      `}</style>
    </div>
  );
}

window.OverviewSection = OverviewSection;
