// Content moderation — photos/bios

const MOD_ITEMS = [
  {id:"M-9821", type:"photo", user:"Jordan R.", uid:"u_4d71f02", reason:"AI flagged: shirtless + gym mirror · medium risk",
   flags:["shirtless","mirror-selfie"], ai:0.64, age:"2m"},
  {id:"M-9820", type:"photo", user:"??", uid:"u_c4e8801", reason:"AI flagged: multiple people, face ambiguity",
   flags:["multi-face","low-res"], ai:0.78, age:"5m"},
  {id:"M-9819", type:"bio",   user:"Alex B.", uid:"u_ff881cc", reason:"Bio contains external contact · Telegram handle",
   flags:["off-platform","external-link"], ai:0.92, age:"8m"},
  {id:"M-9818", type:"photo", user:"Priya S.", uid:"u_ff39a2b", reason:"Low confidence: face partially obscured",
   flags:["face-obscured"], ai:0.31, age:"14m"},
  {id:"M-9817", type:"bio",   user:"Raj P.",   uid:"u_e21f7a0", reason:"Possible hate speech · low confidence",
   flags:["slur-candidate"], ai:0.52, age:"19m"},
  {id:"M-9816", type:"photo", user:"Maya K.",  uid:"u_8c2e1a9", reason:"Copyrighted image match (stock photo)",
   flags:["stock-photo","DMCA"], ai:0.88, age:"26m"},
];

function ModerationSection(){
  const [queue, setQueue] = useState(MOD_ITEMS);
  const [type, setType] = useState("all");

  const rows = queue.filter(i => type==="all" ? true : i.type===type);

  function decide(id, action){
    setQueue(q => q.filter(i => i.id !== id));
  }

  return (
    <div className="section active">
      <PageHead title="Content moderation"
        sub="87 photos · 14 bios · 23 video intros pending"
        actions={<>
          <button className="btn"><Icons.sparkle size={13}/> Retrain AI filter</button>
          <button className="btn primary">Approve all low-risk (31)</button>
        </>}/>

      <div className="kpi-row">
        <KPI label="Queue depth"     value="124"   delta="-12"    deltaKind="up"   note="last 24h"/>
        <KPI label="AI auto-block"   value="4,218" delta="+6.2%"  note="today"/>
        <KPI label="Manual reviews"  value="821"   delta="-3.1%"  deltaKind="up"   note="today"/>
        <KPI label="False-positive"  value="2.4%"  delta="-0.1pp" note="moderator overrides"/>
      </div>

      <div className="panel">
        <div className="filters">
          {[["all","All"],["photo","Photos"],["bio","Bios"]].map(([k,l])=>(
            <button key={k} className={"filter-chip "+(type===k?"on":"")} onClick={()=>setType(k)}>{l}</button>
          ))}
          <span className="filter-chip">AI score: any</span>
          <span className="filter-chip">Sort: newest</span>
          <div style={{flex:1}}/>
          <span className="muted" style={{fontSize:12}}>{rows.length} items</span>
        </div>
        <div>
          {rows.map(item => (
            <div key={item.id} className="mod-card">
              {item.type==="photo"
                ? <div className="mod-thumb stripes" data-label={`photo · ${item.id}`}/>
                : <div className="mod-thumb" data-label={`bio · ${item.id}`} style={{
                    background:"var(--bg-elev-2)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    color:"var(--text-dim)",fontSize:11,padding:10,textAlign:"center",
                    fontFamily:"var(--font-mono)"
                  }}>
                    "{"…let's take this to telegram — @alex_b_travels"}"
                  </div>}
              <div>
                <div className="row gap-sm" style={{marginBottom:4}}>
                  <span className="mono muted" style={{fontSize:11}}>{item.id}</span>
                  <span className="chip">{item.type}</span>
                  <span className="chip" style={{color: item.ai>0.8?"var(--bad)":item.ai>0.5?"var(--warn)":"var(--text-dim)"}}>
                    AI · {item.ai.toFixed(2)}
                  </span>
                  <span className="muted mono" style={{fontSize:11}}>{item.age} ago</span>
                </div>
                <div style={{fontSize:14,fontWeight:500,marginBottom:2}}>{item.reason}</div>
                <div className="muted" style={{fontSize:12.5}}>
                  <span className="dim">{item.user}</span> · <span className="mono">{item.uid}</span>
                </div>
                <div className="mod-flags">
                  {item.flags.map(f=><span key={f} className="chip warn">#{f}</span>)}
                </div>
              </div>
              <div className="mod-actions">
                <button className="btn" style={{color:"var(--ok)",borderColor:"transparent",background:"var(--ok-soft)"}} onClick={()=>decide(item.id,"ok")}>
                  <Icons.check size={13}/> Approve
                </button>
                <button className="btn danger" onClick={()=>decide(item.id,"reject")}>
                  <Icons.x size={13}/> Reject
                </button>
                <button className="btn">Escalate</button>
              </div>
            </div>
          ))}
          {rows.length===0 && <div className="panel-body muted" style={{textAlign:"center",padding:40}}>Queue cleared. ✓</div>}
        </div>
      </div>
    </div>
  );
}

window.ModerationSection = ModerationSection;
