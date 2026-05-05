// Users section — filterable table + detail drawer

const USERS = [
  {id:"u_8c2e1a9", name:"Maya Kowalski", handle:"@maya", age:27, gender:"F", loc:"Brooklyn, NY", plan:"Gold",   status:"active",    joined:"Mar 14, 2025", lastActive:"2m ago",  matches:284, msgs:"2.1k", reports:0, score:92},
  {id:"u_4d71f02", name:"Jordan Rivera", handle:"@jord",  age:31, gender:"M", loc:"Austin, TX",    plan:"Free",   status:"active",    joined:"Jan 02, 2026", lastActive:"just now", matches:12,  msgs:"48",   reports:1, score:71},
  {id:"u_a19cc43", name:"Amelia Park",   handle:"@aparks",age:24, gender:"F", loc:"London, UK",    plan:"Plat",   status:"verified",  joined:"Nov 20, 2024", lastActive:"14m ago", matches:501, msgs:"6.2k", reports:0, score:98},
  {id:"u_b82a10c", name:"Kai Lindholm",  handle:"@kail",  age:29, gender:"NB",loc:"Berlin, DE",    plan:"Gold",   status:"shadow",    joined:"Aug 08, 2025", lastActive:"1h ago",  matches:67,  msgs:"312",  reports:4, score:48},
  {id:"u_ff39a2b", name:"Priya Shah",    handle:"@priya", age:26, gender:"F", loc:"Mumbai, IN",    plan:"Gold",   status:"active",    joined:"Feb 11, 2026", lastActive:"5m ago",  matches:143, msgs:"1.4k", reports:0, score:88},
  {id:"u_77c1d89", name:"Diego Flores",  handle:"@dfl",   age:34, gender:"M", loc:"Mexico City",   plan:"Free",   status:"paused",    joined:"Jun 30, 2024", lastActive:"3d ago",  matches:22,  msgs:"71",   reports:2, score:62},
  {id:"u_c99b4ef", name:"Noa Bergman",   handle:"@noa",   age:22, gender:"F", loc:"Tel Aviv",      plan:"Free",   status:"active",    joined:"Apr 01, 2026", lastActive:"22m ago", matches:38,  msgs:"104",  reports:0, score:77},
  {id:"u_e21f7a0", name:"Raj Patel",     handle:"@rajp",  age:38, gender:"M", loc:"Toronto, CA",   plan:"Plat",   status:"banned",    joined:"Dec 12, 2023", lastActive:"14d ago", matches:0,   msgs:"0",    reports:11,score:4 },
  {id:"u_1a8f62d", name:"Sofia Hernández",handle:"@sofi", age:28, gender:"F", loc:"Madrid, ES",    plan:"Gold",   status:"active",    joined:"Oct 05, 2025", lastActive:"1m ago",  matches:412, msgs:"3.9k", reports:0, score:94},
  {id:"u_9fdc05b", name:"Omar Al-Farsi", handle:"@omar",  age:33, gender:"M", loc:"Dubai, AE",     plan:"Plat",   status:"active",    joined:"Jul 19, 2025", lastActive:"12m ago", matches:87,  msgs:"902",  reports:1, score:84},
];

const STATUS_CHIP = {
  active:   ["ok","Active"],
  verified: ["info","Verified"],
  shadow:   ["warn","Shadow"],
  paused:   ["","Paused"],
  banned:   ["bad","Banned"],
};

function PhotoAvatar({name, hue, size=32}){
  const letters = name.split(" ").map(s=>s[0]).slice(0,2).join("");
  return <span className="photo" style={{
    width:size,height:size,fontSize:size*0.38,
    background:`linear-gradient(135deg, oklch(0.65 0.11 ${hue}), oklch(0.45 0.11 ${hue+60}))`
  }}>{letters}</span>;
}

function UsersSection({ onOpenUser, anon }){
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = USERS.filter(u=>{
    if(q && !(u.name.toLowerCase().includes(q.toLowerCase()) || u.handle.includes(q) || u.id.includes(q))) return false;
    if(filter!=="all" && u.status!==filter) return false;
    return true;
  });

  return (
    <div className="section active">
      <PageHead
        title="Users"
        sub="1,142,873 total · 284,119 active today"
        actions={<>
          <button className="btn"><Icons.download size={13}/> Export CSV</button>
          <button className="btn primary"><Icons.plus size={13}/> Create user</button>
        </>}
      />

      <div className="panel">
        <div className="filters">
          <div className="search" style={{minWidth:260, background:"var(--bg-elev-2)"}}>
            <Icons.search size={14}/>
            <input placeholder="Name, @handle, user id, email…" value={q} onChange={e=>setQ(e.target.value)}/>
          </div>
          {[
            ["all","All"],["active","Active"],["verified","Verified"],["shadow","Shadow-banned"],["paused","Paused"],["banned","Banned"],
          ].map(([k,l])=>(
            <button key={k} className={"filter-chip "+(filter===k?"on":"")} onClick={()=>setFilter(k)}>{l}</button>
          ))}
          <div style={{flex:1}}/>
          <button className="btn" style={{fontSize:12}}><Icons.filter size={13}/> More filters</button>
          <button className="btn" style={{fontSize:12}}>Sort: Last active</button>
        </div>
        <div style={{overflowX:"auto"}}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{width:28}}><input type="checkbox"/></th>
                <th>User</th>
                <th>Location</th>
                <th>Status</th>
                <th>Plan</th>
                <th className="right">Matches</th>
                <th className="right">Msgs</th>
                <th className="right">Reports</th>
                <th className="right">Trust</th>
                <th>Last active</th>
                <th style={{width:40}}/>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i)=>{
                const [cls, label] = STATUS_CHIP[u.status];
                const displayName = anon ? pseudonym(u.id) : u.name;
                const displayHandle = anon ? pseudoHandle(u.id) : u.handle;
                const displayId = anon ? maskId(u.id) : u.id;
                const displayLoc = anon ? u.loc.split(",")[1]?.trim() || "—" : u.loc;
                return (
                  <tr key={u.id} onClick={()=>onOpenUser(u)}>
                    <td onClick={e=>e.stopPropagation()}><input type="checkbox"/></td>
                    <td>
                      <div className="row">
                        <PhotoAvatar name={displayName} hue={(i*47)%360}/>
                        <div>
                          <div style={{fontWeight:500}}>{displayName} <span className="muted mono" style={{fontSize:11}}>{u.age}·{u.gender}</span></div>
                          <div className="mono muted" style={{fontSize:11}}>{displayHandle} · {displayId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="dim">{displayLoc}</td>
                    <td><span className={"chip "+cls}><span className="ddot"/>{label}</span></td>
                    <td>{u.plan==="Plat"?<span className="chip accent">Platinum</span>: u.plan==="Gold"?<span className="chip warn">Gold</span>: <span className="chip">Free</span>}</td>
                    <td className="right">{u.matches}</td>
                    <td className="right">{u.msgs}</td>
                    <td className="right" style={{color: u.reports>3?"var(--bad)":u.reports>0?"var(--warn)":"var(--text-mute)"}}>{u.reports}</td>
                    <td className="right">
                      <div className="row" style={{justifyContent:"flex-end",gap:6}}>
                        <div style={{width:40,height:4,background:"var(--bg-elev-2)",borderRadius:2,overflow:"hidden"}}>
                          <div style={{width:u.score+"%",height:"100%", background: u.score>80?"var(--ok)": u.score>50?"var(--warn)":"var(--bad)"}}/>
                        </div>
                        <span className="mono" style={{fontSize:12,width:22,textAlign:"right"}}>{u.score}</span>
                      </div>
                    </td>
                    <td className="mono muted" style={{fontSize:12}}>{u.lastActive}</td>
                    <td><button className="top-btn" style={{width:28,height:28}} onClick={e=>e.stopPropagation()}><Icons.more size={14}/></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="panel-foot">
          <div>Showing {filtered.length} of 1,142,873 · page 1 of 114,288</div>
          <div className="row">
            <button className="btn ghost"><Icons.chevL size={13}/></button>
            <button className="btn ghost"><Icons.chevron size={13}/></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserDrawer({ user, onClose, anon }){
  const [tab, setTab] = useState("profile");
  const [reveal, setReveal] = useState(false);
  if(!user) return <div className="drawer"/>;
  const [cls, label] = STATUS_CHIP[user.status];
  const showReal = !anon || reveal;
  const displayName = showReal ? user.name : pseudonym(user.id);
  const displayHandle = showReal ? user.handle : pseudoHandle(user.id);
  const displayId = showReal ? user.id : maskId(user.id);
  return (
    <>
      <div className={"drawer-backdrop "+(user?"open":"")} onClick={onClose}/>
      <aside className={"drawer "+(user?"open":"")}>
        <div className="drawer-head">
          <PhotoAvatar name={displayName} hue={180} size={40}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:600}}>{displayName}</div>
            <div className="mono muted" style={{fontSize:11}}>{displayId}</div>
          </div>
          <span className={"chip "+cls}>{label}</span>
          <button className="top-btn" onClick={onClose}><Icons.close size={14}/></button>
        </div>
        {anon && (
          <div style={{padding:"10px 20px",background:"var(--bg-elev-2)",borderBottom:"1px solid var(--line-soft)",display:"flex",alignItems:"center",gap:10,fontSize:12}}>
            <Icons.shield size={13}/>
            <span className="dim" style={{flex:1}}>
              {reveal
                ? <>PII revealed · action logged to audit trail</>
                : <>PII hidden · showing pseudonym</>}
            </span>
            <button className="btn" style={{fontSize:11.5,padding:"4px 8px"}} onClick={()=>setReveal(r=>!r)}>
              {reveal ? "Hide PII" : "Reveal PII…"}
            </button>
          </div>
        )}
        <div className="tabs">
          {[["profile","Profile"],["activity","Activity"],["reports","Reports"],["billing","Billing"],["notes","Notes"]].map(([k,l])=>(
            <div key={k} className={"tab "+(tab===k?"on":"")} onClick={()=>setTab(k)}>{l}</div>
          ))}
        </div>
        <div className="drawer-body">
          {tab==="profile" && <>
            <div className="row" style={{gap:6,flexWrap:"wrap",marginBottom:12}}>
              {[1,2,3,4].map(i=>(
                <div key={i} className="mod-thumb stripes" data-label={`photo ${i}`} style={{width:80,height:96}}/>
              ))}
            </div>
            <div className="col gap-sm">
              <DRow k="Handle"    v={<span className="mono">{displayHandle}</span>}/>
              <DRow k="Age"       v={`${user.age} (${user.gender})`}/>
              <DRow k="Location"  v={showReal ? user.loc : (user.loc.split(",")[1]?.trim() || "—")}/>
              <DRow k="Joined"    v={user.joined}/>
              <DRow k="Last active" v={user.lastActive}/>
              <DRow k="Plan"      v={user.plan==="Plat"?"Platinum":user.plan}/>
              <DRow k="Email"     v={<span className="mono" style={{fontSize:12}}>{showReal ? user.handle.slice(1)+"@proton.me" : maskEmail()}</span>}/>
              <DRow k="Device"    v="iPhone 16 Pro · iOS 18.4"/>
              <DRow k="IP (last)" v={<span className="mono" style={{fontSize:12}}>{showReal ? "74.102.214.88 · Brooklyn" : maskIP()+" · "+(user.loc.split(",")[1]?.trim() || "—")}</span>}/>
              <DRow k="Verification" v={<><span className="chip info"><Icons.check size={11}/> Selfie</span> <span className="chip info"><Icons.check size={11}/> Phone</span> <span className="chip">ID</span></>}/>
            </div>
            <hr className="div"/>
            <div className="panel-title mb-8">Bio</div>
            <div className="dim" style={{fontSize:13,lineHeight:1.5}}>
              Marketing at a climate startup. Picky about coffee, not about dogs. Looking for someone to steal fries from.
            </div>
            <hr className="div"/>
            <div className="panel-title mb-8">Admin actions</div>
            <div className="row" style={{flexWrap:"wrap",gap:6}}>
              <button className="btn"><Icons.mail size={13}/> Message</button>
              <button className="btn"><Icons.eye size={13}/> Impersonate</button>
              <button className="btn"><Icons.star size={13}/> Boost 24h</button>
              <button className="btn"><Icons.flag size={13}/> Shadow ban</button>
              <button className="btn danger"><Icons.ban size={13}/> Ban user</button>
            </div>
          </>}
          {tab==="activity" && <>
            <KPIRow items={[
              ["Matches", user.matches],
              ["Messages", user.msgs],
              ["Avg. response", "12m"],
              ["Trust", user.score],
            ]}/>
            <hr className="div"/>
            <div className="panel-title mb-8">Recent events</div>
            <div className="col" style={{gap:10}}>
              {[
                ["2m ago","Matched with Jordan R.","match"],
                ["1h ago","Sent 4 messages","msg"],
                ["3h ago","Upgraded to Gold","billing"],
                ["Yesterday","Changed photos (3)","profile"],
                ["Mar 14","Account created","signup"],
              ].map((e,i)=>(
                <div key={i} className="row" style={{justifyContent:"space-between",fontSize:12.5}}>
                  <span className="muted mono" style={{width:80}}>{e[0]}</span>
                  <span className="dim" style={{flex:1}}>{e[1]}</span>
                  <span className="chip">{e[2]}</span>
                </div>
              ))}
            </div>
          </>}
          {tab==="reports" && (user.reports>0
            ? <div className="col" style={{gap:10}}>
                {Array.from({length:user.reports}).map((_,i)=>(
                  <div key={i} className="panel" style={{padding:12}}>
                    <div className="row" style={{justifyContent:"space-between",marginBottom:6}}>
                      <span className="chip bad">#{1000+i}</span>
                      <span className="muted mono" style={{fontSize:11}}>{Math.floor(Math.random()*14)+1}d ago</span>
                    </div>
                    <div style={{fontSize:13}}>Reported for <b>{["inappropriate photos","spam messages","fake profile","harassment"][i%4]}</b></div>
                    <div className="muted" style={{fontSize:12,marginTop:4}}>by 2 different users · auto-score 0.{60+i*7}</div>
                  </div>
                ))}
              </div>
            : <div className="muted" style={{fontSize:13}}>No reports. ✓</div>)}
          {tab==="billing" && <div className="muted">Billing history mock…</div>}
          {tab==="notes" && <div className="muted">Internal notes mock…</div>}
        </div>
      </aside>
    </>
  );
}

function DRow({k,v}){
  return (
    <div className="row" style={{justifyContent:"space-between",fontSize:13,padding:"4px 0"}}>
      <span className="muted">{k}</span>
      <span>{v}</span>
    </div>
  );
}
function KPIRow({items}){
  return (
    <div style={{display:"grid",gridTemplateColumns:`repeat(${items.length},1fr)`,gap:8}}>
      {items.map((x,i)=>(
        <div key={i} className="panel" style={{padding:12}}>
          <div className="muted" style={{fontSize:10.5,letterSpacing:".06em",textTransform:"uppercase"}}>{x[0]}</div>
          <div className="mono" style={{fontSize:18,fontWeight:600,marginTop:4}}>{x[1]}</div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { UsersSection, UserDrawer, PhotoAvatar, USERS, STATUS_CHIP });
