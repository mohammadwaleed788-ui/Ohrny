// Experiments / A/B

const EXPERIMENTS = [
  {id:"EXP-44", name:"New onboarding order (interests before photos)", status:"running", traffic:50, days:12,
   variants:[{k:"control",v:"42.1%"},{k:"test",v:"47.9%"}], metric:"D1 retention", lift:"+5.8pp", conf:96},
  {id:"EXP-43", name:"Super-like button pulse animation",              status:"running", traffic:25, days:5,
   variants:[{k:"control",v:"3.2%"},{k:"test",v:"3.6%"}],  metric:"Super-like CVR", lift:"+0.4pp", conf:72},
  {id:"EXP-42", name:"AI-assisted opener suggestions",                 status:"running", traffic:10, days:18,
   variants:[{k:"control",v:"24.1%"},{k:"test",v:"28.8%"}],metric:"First reply rate", lift:"+4.7pp", conf:99},
  {id:"EXP-41", name:"Distance radius default (25mi → 15mi)",          status:"running", traffic:20, days:7,
   variants:[{k:"control",v:"67.4%"},{k:"test",v:"66.1%"}],metric:"Swipe→match", lift:"-1.3pp", conf:58},
  {id:"EXP-40", name:"Verification prompt D3 vs D7",                   status:"shipped", traffic:100, days:28,
   variants:[{k:"control",v:"18%"},{k:"test",v:"26%"}],metric:"Verified within 14d", lift:"+8pp", conf:99},
  {id:"EXP-39", name:"Gold paywall copy · \"skip the queue\"",          status:"concluded",traffic:50, days:21,
   variants:[{k:"control",v:"4.1%"},{k:"test",v:"4.2%"}],metric:"Free→Gold", lift:"+0.1pp", conf:41},
];

const FLAGS = [
  {k:"video_intros_v2",     desc:"Profile video intros with AI captioning", env:"prod", pct:35, on:true},
  {k:"ai_opener_assist",    desc:"Suggest openers in empty chats",          env:"prod", pct:10, on:true},
  {k:"audio_messages",      desc:"Voice notes in chat",                     env:"beta", pct:100,on:true},
  {k:"reveal_after_match",  desc:"Show full photo only after match",        env:"prod", pct:0,  on:false},
  {k:"weekly_roundup_email",desc:"Sun 7pm weekly digest",                   env:"prod", pct:50, on:true},
  {k:"nsfw_lax_markets",    desc:"Loosen rule-set in FR/BR/NL",             env:"prod", pct:100,on:false},
];

function ExperimentsSection(){
  const [flags, setFlags] = useState(FLAGS);
  const [tab, setTab] = useState("exps");

  function toggleFlag(k){
    setFlags(f=>f.map(x=>x.k===k?{...x,on:!x.on}:x));
  }

  return (
    <div className="section active">
      <PageHead title="Experiments & feature flags"
        sub="4 running · 2 concluded · 1 awaiting review"
        actions={<>
          <button className="btn"><Icons.download size={13}/> Experiment log</button>
          <button className="btn primary"><Icons.plus size={13}/> New experiment</button>
        </>}/>

      <div className="panel">
        <div className="tabs">
          {[["exps","Experiments (6)"],["flags","Feature flags (6)"]].map(([k,l])=>(
            <div key={k} className={"tab "+(tab===k?"on":"")} onClick={()=>setTab(k)}>{l}</div>
          ))}
        </div>

        {tab==="exps" && (
          <table className="tbl">
            <thead><tr>
              <th>Experiment</th><th>Status</th><th className="right">Traffic</th>
              <th>Primary metric</th><th className="right">Control → Test</th>
              <th className="right">Lift</th><th className="right">Confidence</th><th>Days</th>
            </tr></thead>
            <tbody>
              {EXPERIMENTS.map(e=>{
                const up = e.lift.startsWith("+");
                return (
                  <tr key={e.id}>
                    <td>
                      <div style={{fontWeight:500}}>{e.name}</div>
                      <div className="mono muted" style={{fontSize:11}}>{e.id}</div>
                    </td>
                    <td>
                      {e.status==="running" && <span className="chip ok"><span className="ddot"/> Running</span>}
                      {e.status==="shipped" && <span className="chip accent">Shipped</span>}
                      {e.status==="concluded" && <span className="chip">Concluded</span>}
                    </td>
                    <td className="right mono">{e.traffic}%</td>
                    <td className="dim">{e.metric}</td>
                    <td className="right mono">{e.variants[0].v} → <span style={{color:up?"var(--ok)":"var(--bad)"}}>{e.variants[1].v}</span></td>
                    <td className="right mono" style={{color:up?"var(--ok)":"var(--bad)",fontWeight:600}}>{e.lift}</td>
                    <td className="right">
                      <div className="row" style={{justifyContent:"flex-end",gap:6}}>
                        <div style={{width:52,height:4,background:"var(--bg-elev-2)",borderRadius:2,overflow:"hidden"}}>
                          <div style={{width:e.conf+"%",height:"100%",background:e.conf>=95?"var(--ok)":e.conf>=80?"var(--warn)":"var(--text-mute)"}}/>
                        </div>
                        <span className="mono" style={{width:30,textAlign:"right",fontSize:12}}>{e.conf}%</span>
                      </div>
                    </td>
                    <td className="mono muted">{e.days}d</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab==="flags" && (
          <div style={{padding:"6px 0"}}>
            {flags.map(f=>(
              <div key={f.k} className="row" style={{padding:"14px 18px",borderBottom:"1px solid var(--line-soft)",gap:16}}>
                <div className={"switch "+(f.on?"on":"")} onClick={()=>toggleFlag(f.k)}/>
                <div style={{flex:1}}>
                  <div className="row gap-sm">
                    <span className="mono" style={{fontWeight:600}}>{f.k}</span>
                    <span className={"chip "+(f.env==="beta"?"warn":"")}>{f.env}</span>
                  </div>
                  <div className="muted" style={{fontSize:12.5,marginTop:2}}>{f.desc}</div>
                </div>
                <div className="col" style={{alignItems:"flex-end",minWidth:140}}>
                  <div className="muted" style={{fontSize:11}}>Rollout</div>
                  <div className="row gap-sm" style={{marginTop:4}}>
                    <div style={{width:100,height:4,background:"var(--bg-elev-2)",borderRadius:2,overflow:"hidden"}}>
                      <div style={{width:f.pct+"%",height:"100%",background:"var(--accent)"}}/>
                    </div>
                    <span className="mono" style={{fontSize:12,width:34,textAlign:"right"}}>{f.pct}%</span>
                  </div>
                </div>
                <button className="btn">Edit</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

window.ExperimentsSection = ExperimentsSection;
