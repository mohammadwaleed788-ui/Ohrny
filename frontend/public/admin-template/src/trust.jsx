// Trust & Safety — queue + stats

const REPORTS = [
  {id:"R-48291",sev:"high",  reason:"Harassment",           reporter:"u_4d71f02", subject:"u_b82a10c", subjName:"Kai Lindholm", age:"4m",  evidence:3, ai:0.94, status:"new"},
  {id:"R-48290",sev:"high",  reason:"Nudity in photos",     reporter:"u_ff39a2b", subject:"u_e21f7a0", subjName:"Raj Patel",    age:"12m", evidence:5, ai:0.98, status:"new"},
  {id:"R-48288",sev:"crit",  reason:"Minor suspected",      reporter:"system",    subject:"u_2881fab", subjName:"—",            age:"18m", evidence:2, ai:0.88, status:"new"},
  {id:"R-48287",sev:"med",   reason:"Spam / off-platform",  reporter:"u_c99b4ef", subject:"u_77c1d89", subjName:"Diego Flores", age:"34m", evidence:4, ai:0.76, status:"review"},
  {id:"R-48283",sev:"med",   reason:"Fake / catfish",       reporter:"u_1a8f62d", subject:"u_c4e8801", subjName:"\"Isabella\"",  age:"1h",  evidence:6, ai:0.82, status:"review"},
  {id:"R-48280",sev:"low",   reason:"Rude messages",        reporter:"u_9fdc05b", subject:"u_4d71f02", subjName:"Jordan Rivera",age:"2h",  evidence:1, ai:0.41, status:"review"},
  {id:"R-48271",sev:"med",   reason:"Scam · crypto",        reporter:"u_c99b4ef", subject:"u_ff881cc", subjName:"\"Alex B\"",    age:"3h",  evidence:3, ai:0.91, status:"resolved"},
  {id:"R-48250",sev:"low",   reason:"Profile picture unclear",reporter:"u_8c2e1a9",subject:"u_10f2c3d",subjName:"—",            age:"6h",  evidence:1, ai:0.22, status:"resolved"},
];

const SEV_CHIP = {
  crit: ["bad","Critical"],
  high: ["bad","High"],
  med:  ["warn","Medium"],
  low:  ["","Low"],
};

function TrustSection(){
  const [tab, setTab] = useState("queue");
  const [filter, setFilter] = useState("all");
  const rows = REPORTS.filter(r=>filter==="all"?true: r.status===filter);

  return (
    <div className="section active">
      <PageHead title="Trust & Safety"
        sub="342 open reports · 18 critical · avg resolve 4h 12m"
        actions={<>
          <button className="btn"><Icons.download size={13}/> Export audit log</button>
          <button className="btn primary"><Icons.sparkle size={13}/> Auto-triage 127 low-risk</button>
        </>}/>

      <div className="kpi-row">
        <KPI label="Open reports"      value="342"   delta="-8.4%"  note="vs 7d"  series={[380,372,366,360,358,350,345,342]}/>
        <KPI label="SLA breaches"      value="7"     delta="+2"     deltaKind="down" note=">12h open" series={[3,4,3,5,6,7]}/>
        <KPI label="Auto-resolved"     value="61.2%" delta="+3.1pp" note="AI confidence ≥ .9" series={[58,59,59,60,61,61.2]}/>
        <KPI label="Bans today"        value="148"   delta="-4"     deltaKind="up" note="44 appealed" series={[160,155,150,148]}/>
      </div>

      <div className="panel">
        <div className="tabs">
          {[["queue","Queue (342)"],["appeals","Appeals (44)"],["bans","Bans"],["patterns","Patterns"]].map(([k,l])=>(
            <div key={k} className={"tab "+(tab===k?"on":"")} onClick={()=>setTab(k)}>{l}</div>
          ))}
        </div>
        {tab==="queue" && <>
          <div className="filters">
            {[["all","All"],["new","New"],["review","Under review"],["resolved","Resolved"]].map(([k,l])=>(
              <button key={k} className={"filter-chip "+(filter===k?"on":"")} onClick={()=>setFilter(k)}>{l}</button>
            ))}
            <span className="filter-chip">Severity: High+</span>
            <span className="filter-chip">AI: ≥ 0.7</span>
            <div style={{flex:1}}/>
            <button className="btn" style={{fontSize:12}}>Assign to moderator…</button>
          </div>
          <div style={{overflowX:"auto"}}>
            <table className="tbl">
              <thead><tr>
                <th style={{width:28}}><input type="checkbox"/></th>
                <th>ID</th><th>Severity</th><th>Reason</th><th>Subject</th>
                <th className="right">Evidence</th><th className="right">AI score</th>
                <th>Age</th><th>Status</th><th style={{width:180}}>Actions</th>
              </tr></thead>
              <tbody>
                {rows.map(r=>{
                  const [cls,label] = SEV_CHIP[r.sev];
                  return (
                    <tr key={r.id}>
                      <td><input type="checkbox"/></td>
                      <td className="mono">{r.id}</td>
                      <td><span className={"chip "+cls}><span className="ddot"/>{label}</span></td>
                      <td>{r.reason}</td>
                      <td>
                        <div className="row">
                          <PhotoAvatar name={r.subjName==="—"?"??":r.subjName} hue={((r.id.charCodeAt(4)||0)*31)%360} size={26}/>
                          <div>
                            <div style={{fontSize:13}}>{r.subjName}</div>
                            <div className="mono muted" style={{fontSize:11}}>{r.subject}</div>
                          </div>
                        </div>
                      </td>
                      <td className="right mono">{r.evidence} files</td>
                      <td className="right">
                        <span className="mono" style={{color: r.ai>0.85?"var(--bad)": r.ai>0.5?"var(--warn)":"var(--text-dim)"}}>
                          {r.ai.toFixed(2)}
                        </span>
                      </td>
                      <td className="mono muted">{r.age}</td>
                      <td>{r.status==="new"?<span className="chip bad">new</span>: r.status==="review"?<span className="chip warn">review</span>:<span className="chip ok">resolved</span>}</td>
                      <td>
                        <div className="row gap-sm">
                          <button className="btn" style={{padding:"4px 8px",fontSize:12}}><Icons.eye size={12}/> Open</button>
                          <button className="btn danger" style={{padding:"4px 8px",fontSize:12}}><Icons.ban size={12}/> Ban</button>
                          <button className="btn" style={{padding:"4px 8px",fontSize:12}}><Icons.check size={12}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="panel-foot">
            <div>Showing {rows.length} of 342 open reports</div>
            <div className="mono muted" style={{fontSize:12}}>auto-refreshing every 15s</div>
          </div>
        </>}
        {tab!=="queue" && (
          <div className="panel-body muted" style={{padding:40,textAlign:"center"}}>Placeholder · {tab} view</div>
        )}
      </div>
    </div>
  );
}

window.TrustSection = TrustSection;
