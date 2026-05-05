// Matches analytics

function MatchesSection(){
  const [range, setRange] = useState("30d");

  const matchesDaily = Array.from({length:30},(_,i)=>42000 + i*500 + Math.sin(i/2)*6000);
  const msgsDaily = matchesDaily.map(v=>v*3.1 + Math.sin(v/9000)*4000);

  const cohort = [
    {age:"18–24", m:34, f:41, pct:38},
    {age:"25–29", m:48, f:52, pct:27},
    {age:"30–34", m:41, f:44, pct:19},
    {age:"35–44", m:28, f:32, pct:11},
    {age:"45+",   m:12, f:14, pct:5},
  ];

  return (
    <div className="section active">
      <PageHead title="Matches & conversations"
        sub="How users meet, reply, and actually talk"
        actions={<>
          <DateRange value={range} onChange={setRange}/>
          <button className="btn"><Icons.download size={13}/> Export</button>
        </>}/>

      <div className="kpi-row">
        <KPI label="Matches / day"     value="61,204" delta="+11.6%" note="vs 7d avg" series={matchesDaily.slice(-14).map(v=>v/1000)}/>
        <KPI label="Reply rate"        value="68.4%"  delta="+1.2pp" note="vs 30d"    series={[60,61,62,63,64,64,65,66,67,68,68,67,68,68.4]}/>
        <KPI label="Msgs / match"      value="14.2"   delta="-0.3"   deltaKind="down" note="median"  series={[15,15,15,14.8,14.6,14.5,14.3,14.2]}/>
        <KPI label="→ off-platform"    value="4.7%"   delta="+0.4pp" note="est. from “let's meet”" series={[3.9,4.1,4.2,4.4,4.5,4.6,4.7]}/>
      </div>

      <div className="grid-2" style={{marginBottom:14}}>
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Matches vs messages</div>
            <div className="panel-sub">Daily totals · {range}</div>
          </div>
          <div className="panel-body">
            <AreaChart series={matchesDaily} secondary={msgsDaily.map(v=>v/3)} labels={["Wk1","Wk2","Wk3","Wk4"]}
              yFormat={n=>n>=1000?(n/1000).toFixed(0)+"k":n} w={780} h={260}/>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Match quality distribution</div>
            <div className="panel-sub">By predicted compatibility score</div>
          </div>
          <div className="panel-body" style={{display:"flex",justifyContent:"center"}}>
            <Donut size={180} segments={[
              {label:"Excellent", value:22,  color:"oklch(0.78 0.14 155)"},
              {label:"Good",      value:41,  color:"oklch(0.72 0.15 25)"},
              {label:"Fair",      value:27,  color:"oklch(0.82 0.14 80)"},
              {label:"Low",       value:10,  color:"oklch(0.55 0.06 260)"},
            ]}/>
            <div className="col" style={{justifyContent:"center",marginLeft:20,gap:8,fontSize:12.5}}>
              {[
                ["Excellent (>85)", "oklch(0.78 0.14 155)", "22%"],
                ["Good (65–85)",    "oklch(0.72 0.15 25)",  "41%"],
                ["Fair (45–65)",    "oklch(0.82 0.14 80)",  "27%"],
                ["Low (<45)",       "oklch(0.55 0.06 260)", "10%"],
              ].map(r=>(
                <div key={r[0]} className="row">
                  <span style={{width:10,height:10,borderRadius:3,background:r[1]}}/>
                  <span className="dim" style={{width:130}}>{r[0]}</span>
                  <span className="mono">{r[2]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Cohort breakdown</div>
            <div className="panel-sub">Match rate by age bucket</div>
          </div>
          <div className="panel-body barlist">
            {cohort.map(c=>(
              <div key={c.age} className="bar-row">
                <span className="dim">{c.age}</span>
                <div className="bar-track" style={{display:"flex",gap:1}}>
                  <div style={{width:c.m+"%",height:"100%",background:"oklch(0.65 0.11 235)",borderRadius:"3px 0 0 3px"}}/>
                  <div style={{width:c.f+"%",height:"100%",background:"oklch(0.72 0.15 25)",borderRadius:"0 3px 3px 0"}}/>
                </div>
                <span className="mono tnum right">{c.pct}%</span>
              </div>
            ))}
            <div className="row" style={{fontSize:11,color:"var(--text-mute)",justifyContent:"flex-end",gap:12,marginTop:6}}>
              <span className="row gap-sm"><span style={{width:10,height:10,borderRadius:2,background:"oklch(0.65 0.11 235)"}}/> Men</span>
              <span className="row gap-sm"><span style={{width:10,height:10,borderRadius:2,background:"oklch(0.72 0.15 25)"}}/> Women</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Conversation outcomes</div>
            <div className="panel-sub">Of 61k matches today</div>
          </div>
          <div className="panel-body funnel">
            {[
              ["Any message sent",     47210, 61204, "ok"],
              ["≥3 back-and-forth",    28815, 61204, "ok"],
              ["Phone/social shared",  11490, 61204, "info"],
              ["Date planned",         4314,  61204, "accent"],
              ["Reported unmatched",   892,   61204, "bad"],
            ].map(([l,v,b,c])=>(
              <div key={l} className="step" style={{"--w":(v/b*100)+"%"}}>
                <div className="row">
                  <span className="lbl">{l}</span>
                  <span className="pct">{(v/b*100).toFixed(1)}%</span>
                </div>
                <span className="num">{v.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.MatchesSection = MatchesSection;
