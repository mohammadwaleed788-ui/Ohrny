// Notifications / campaigns

const CAMPAIGNS = [
  {id:"C-1041", name:"Weekend Boost",         status:"scheduled", aud:"Active · 7d inactive", size:412908, sent:0,        open:null,  tap:null,  when:"Fri 5:00 PM local"},
  {id:"C-1040", name:"You have 3 new matches",status:"running",   aud:"All match-pending",    size:148221, sent:98421,    open:"42.1%",tap:"12.8%",when:"rolling"},
  {id:"C-1039", name:"Gold · weekend 30% off",status:"sent",      aud:"Free users · lapsed",  size:48200,  sent:48200,    open:"38.4%",tap:"7.1%", when:"Tue 10:00 AM"},
  {id:"C-1038", name:"Profile photo tips",     status:"sent",      aud:"New users · D3",      size:21440,  sent:21440,    open:"62.9%",tap:"22.4%",when:"Mon 9:00 AM"},
  {id:"C-1037", name:"Re-verify selfie",        status:"draft",    aud:"Unverified 60d+",     size:81204,  sent:0,        open:null,   tap:null,   when:"—"},
];

function NotificationsSection(){
  return (
    <div className="section active">
      <PageHead title="Notifications & campaigns"
        sub="Push, email, and in-app"
        actions={<>
          <button className="btn">Segment builder</button>
          <button className="btn primary"><Icons.plus size={13}/> New campaign</button>
        </>}/>

      <div className="kpi-row">
        <KPI label="Push sent · 7d"  value="14.2M"  delta="+8%"    note="all channels"/>
        <KPI label="Avg open rate"   value="41.8%"  delta="+2.1pp" note="push"/>
        <KPI label="Avg tap-through" value="11.3%"  delta="+0.4pp" note="to relevant screen"/>
        <KPI label="Unsubscribes"    value="0.12%"  delta="-0.02pp" note="weekly"/>
      </div>

      <div className="grid-12">
        <div className="panel" style={{gridColumn:"span 8"}}>
          <div className="panel-head">
            <div className="panel-title">Campaigns</div>
            <div style={{flex:1}}/>
            <div className="seg">
              <button className="on">All</button><button>Running</button><button>Scheduled</button><button>Draft</button>
            </div>
          </div>
          <table className="tbl">
            <thead><tr>
              <th>Campaign</th><th>Audience</th><th className="right">Size</th>
              <th className="right">Open</th><th className="right">Tap</th>
              <th>Status</th><th>When</th><th style={{width:40}}/>
            </tr></thead>
            <tbody>
              {CAMPAIGNS.map(c=>(
                <tr key={c.id}>
                  <td>
                    <div style={{fontWeight:500}}>{c.name}</div>
                    <div className="mono muted" style={{fontSize:11}}>{c.id}</div>
                  </td>
                  <td className="dim">{c.aud}</td>
                  <td className="right">{c.size.toLocaleString()}</td>
                  <td className="right">{c.open||"—"}</td>
                  <td className="right">{c.tap||"—"}</td>
                  <td>
                    {c.status==="running" && <span className="chip ok"><span className="ddot"/> Running</span>}
                    {c.status==="scheduled" && <span className="chip info">Scheduled</span>}
                    {c.status==="sent" && <span className="chip">Sent</span>}
                    {c.status==="draft" && <span className="chip warn">Draft</span>}
                  </td>
                  <td className="mono muted" style={{fontSize:12}}>{c.when}</td>
                  <td><button className="top-btn" style={{width:28,height:28}}><Icons.more size={14}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel" style={{gridColumn:"span 4"}}>
          <div className="panel-head">
            <div className="panel-title">Push preview</div>
          </div>
          <div className="panel-body" style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
            <div style={{
              width:280,background:"oklch(0.25 0.01 260)",borderRadius:16,padding:14,
              border:"1px solid var(--line)",boxShadow:"0 10px 30px -10px rgba(0,0,0,.6)"
            }}>
              <div className="row" style={{gap:10}}>
                <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,oklch(0.82 0.17 25),oklch(0.55 0.17 25))"}}/>
                <div style={{flex:1}}>
                  <div className="row" style={{justifyContent:"space-between"}}>
                    <span style={{fontSize:12,fontWeight:600}}>OHRNY</span>
                    <span className="mono muted" style={{fontSize:10}}>now</span>
                  </div>
                  <div style={{fontSize:13,fontWeight:600,marginTop:2}}>You have 3 new matches ✨</div>
                  <div style={{fontSize:12,color:"var(--text-dim)",marginTop:2}}>Open to see who liked you back — two of them messaged you.</div>
                </div>
              </div>
            </div>
            <div className="col gap-sm mt-16" style={{width:"100%",fontSize:12}}>
              <DRow k="Deeplink" v={<span className="mono">ohrny://matches</span>}/>
              <DRow k="Locale"   v="en-US · 7 translations"/>
              <DRow k="Quiet hrs"v="Respect user pref"/>
              <DRow k="A/B test" v={<span className="chip accent">2 variants</span>}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.NotificationsSection = NotificationsSection;
