// Dashboard — stats & audit log per persona

function Dashboard({ persona }){
  const activity = useMemo(()=>makeActivity(persona.id), [persona.id]);
  const s = persona.stats;
  return (
    <div className="col" style={{gap:16}}>
      <div className="dash-grid">
        <div className="stat">
          <div className="stat-label">Matches (lifetime)</div>
          <div className="stat-val">{s.matches}</div>
          <div className="stat-delta up">+12 this week</div>
        </div>
        <div className="stat">
          <div className="stat-label">Active conversations</div>
          <div className="stat-val">{s.active}</div>
          <div className="stat-delta up">+3 today</div>
        </div>
        <div className="stat">
          <div className="stat-label">Messages sent today</div>
          <div className="stat-val">{s.msgsToday}</div>
          <div className="stat-delta up">pace · on track</div>
        </div>
        <div className="stat">
          <div className="stat-label">Reply rate</div>
          <div className="stat-val">{s.replyRate}%</div>
          <div className="stat-delta up">+2.3pp vs 7d</div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-title">Recent activity</div>
        <div className="section-sub">Every action on this persona is attributable.</div>
        <table className="tbl">
          <thead>
            <tr><th>Time</th><th>Actor</th><th>Kind</th><th>Detail</th></tr>
          </thead>
          <tbody>
            {activity.map((a,i)=>(
              <tr key={i}>
                <td className="mono muted">{a.t}</td>
                <td>{a.a}</td>
                <td><span className={"chip "+(a.k==="flag"?"warn":a.k==="sent"?"accent":a.k==="match"?"info":"")}>{a.k}</span></td>
                <td className="dim">{a.txt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-card">
        <div className="section-title">Team access</div>
        <div className="row" style={{gap:8,flexWrap:"wrap"}}>
          {["Elena M.","Jordan P.","Priya V.","Kai L."].map(n=>(
            <div key={n} className="row" style={{gap:8,background:"var(--bg-elev-2)",padding:"6px 10px",borderRadius:999,fontSize:12.5}}>
              <div className="pavatar" style={{width:22,height:22,fontSize:10,background:"linear-gradient(135deg, oklch(0.60 0.12 25), oklch(0.45 0.10 260))"}}>
                <span className="init">{n[0]}</span>
              </div>
              {n}
            </div>
          ))}
          <button className="btn"><Icons.plus size={12}/> Add teammate</button>
        </div>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
