// Support tickets

const TICKETS = [
  {id:"T-88412", subj:"Can't upload photo — keeps failing",    user:"Maya K.",   uid:"u_8c2e1a9", sev:"low",  age:"4m",  status:"open",     agent:"unassigned"},
  {id:"T-88410", subj:"Charged twice for Gold",                 user:"Raj P.",    uid:"u_e21f7a0", sev:"high", age:"18m", status:"open",     agent:"Elena M."},
  {id:"T-88408", subj:"Verification not going through",         user:"Priya S.",  uid:"u_ff39a2b", sev:"med",  age:"31m", status:"waiting",  agent:"Marco T."},
  {id:"T-88401", subj:"Banned unfairly — please review",        user:"Kai L.",    uid:"u_b82a10c", sev:"med",  age:"1h",  status:"open",     agent:"unassigned"},
  {id:"T-88390", subj:"Delete my account and all data (GDPR)",  user:"Noa B.",    uid:"u_c99b4ef", sev:"high", age:"2h",  status:"open",     agent:"Sarah K."},
  {id:"T-88380", subj:"Match disappeared from inbox",           user:"Jordan R.", uid:"u_4d71f02", sev:"low",  age:"3h",  status:"open",     agent:"unassigned"},
  {id:"T-88365", subj:"Refund for Boost that didn't work",      user:"Diego F.",  uid:"u_77c1d89", sev:"med",  age:"5h",  status:"waiting",  agent:"Marco T."},
  {id:"T-88299", subj:"Feature request: see who liked me",      user:"Amelia P.", uid:"u_a19cc43", sev:"low",  age:"1d",  status:"closed",   agent:"Sarah K."},
];

const T_SEV_CHIP = {
  high:["bad","High"],med:["warn","Medium"],low:["","Low"]
};

function SupportSection(){
  const [status, setStatus] = useState("open");
  const rows = TICKETS.filter(t=>status==="all"?true: status===t.status);

  return (
    <div className="section active">
      <PageHead title="Support tickets"
        sub="29 open · median first response 14m · CSAT 4.6 / 5"
        actions={<>
          <button className="btn">Macros</button>
          <button className="btn"><Icons.download size={13}/> Weekly report</button>
          <button className="btn primary"><Icons.plus size={13}/> New ticket</button>
        </>}/>

      <div className="kpi-row">
        <KPI label="Open"           value="29"      delta="-4"     deltaKind="up" note="vs yesterday"/>
        <KPI label="First response" value="14m"     delta="-2m"    deltaKind="up" note="median"/>
        <KPI label="CSAT"           value="4.6"     delta="+0.1"   note="/5 · last 50"/>
        <KPI label="Agents online"  value="6 / 8"   delta=""       note="shift: US-East"/>
      </div>

      <div className="panel">
        <div className="filters">
          {[["all","All"],["open","Open"],["waiting","Waiting"],["closed","Closed"]].map(([k,l])=>(
            <button key={k} className={"filter-chip "+(status===k?"on":"")} onClick={()=>setStatus(k)}>{l}</button>
          ))}
          <span className="filter-chip">Severity: any</span>
          <span className="filter-chip">Agent: any</span>
          <div style={{flex:1}}/>
          <span className="muted" style={{fontSize:12}}>{rows.length} tickets</span>
        </div>
        <table className="tbl">
          <thead><tr>
            <th>ID</th><th>Subject</th><th>User</th><th>Severity</th>
            <th>Status</th><th>Agent</th><th>Age</th><th style={{width:120}}/>
          </tr></thead>
          <tbody>
            {rows.map(t=>{
              const [cls,label] = T_SEV_CHIP[t.sev];
              return (
                <tr key={t.id}>
                  <td className="mono">{t.id}</td>
                  <td style={{fontWeight:500}}>{t.subj}</td>
                  <td>
                    <div className="row">
                      <PhotoAvatar name={t.user} hue={(t.id.charCodeAt(3)*11)%360} size={26}/>
                      <div>
                        <div style={{fontSize:13}}>{t.user}</div>
                        <div className="mono muted" style={{fontSize:11}}>{t.uid}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={"chip "+cls}>{label}</span></td>
                  <td>
                    {t.status==="open" && <span className="chip bad">open</span>}
                    {t.status==="waiting" && <span className="chip warn">waiting</span>}
                    {t.status==="closed" && <span className="chip">closed</span>}
                  </td>
                  <td className="dim" style={{fontSize:13}}>{t.agent==="unassigned"?<span className="muted">—</span>:t.agent}</td>
                  <td className="mono muted">{t.age}</td>
                  <td>
                    <div className="row gap-sm">
                      <button className="btn" style={{padding:"4px 8px",fontSize:12}}>Open</button>
                      <button className="btn" style={{padding:"4px 8px",fontSize:12}}>Assign</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.SupportSection = SupportSection;
