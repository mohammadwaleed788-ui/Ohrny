// App shell: sidebar, topbar, routing between sections

const { useState, useEffect, useMemo, useRef } = React;

const NAV = [
  { group: "Analytics", items: [
    { id:"overview",     label:"Overview",      icon:"dashboard" },
    { id:"matches",      label:"Matches",       icon:"heart" },
    { id:"revenue",      label:"Revenue",       icon:"dollar" },
    { id:"experiments",  label:"Experiments",   icon:"flask", badge:"4" },
  ]},
  { group: "Operations", items: [
    { id:"users",        label:"Users",         icon:"users" },
    { id:"trust",        label:"Trust & Safety",icon:"shield", badge:"342", hot:true },
    { id:"moderation",   label:"Content review",icon:"flag", badge:"87" },
    { id:"support",      label:"Support",       icon:"tickets", badge:"29" },
  ]},
  { group: "Product", items: [
    { id:"notifications",label:"Notifications", icon:"send" },
    { id:"algorithm",    label:"Algorithm",     icon:"sliders" },
    { id:"plans",        label:"Plans & limits",icon:"dollar" },
  ]},
  { group: "Organization", items: [
    { id:"team",         label:"Team",          icon:"users" },
  ]},
];

function WorkspaceSwitcher({ collapsed }){
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(()=>{
    function onDoc(e){ if(ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return ()=>document.removeEventListener("mousedown", onDoc);
  },[]);

  function openOperated(){
    setOpen(false);
    window.open(
      "Operated Profiles.html",
      "ohrny-operated-profiles",
      "width=1440,height=920,noopener,noreferrer"
    );
  }

  return (
    <div className="brand" ref={ref} style={{cursor:"pointer",position:"relative"}} onClick={()=>setOpen(v=>!v)}>
      <Icons.logo size={28}/>
      {!collapsed && <>
        <div style={{flex:1,minWidth:0}}>
          <div className="brand-text">Ohrny admin</div>
          <div className="brand-sub">switch workspace ↓</div>
        </div>
        <Icons.chevron size={12}/>
      </>}
      {open && (
        <div className="ws-menu" onClick={e=>e.stopPropagation()}>
          <div className="ws-head">Workspaces</div>
          <div className="ws-item on">
            <div className="ws-icon admin"><Icons.dashboard size={14}/></div>
            <div style={{flex:1,minWidth:0}}>
              <div className="ws-title">Admin console</div>
              <div className="ws-sub">Analytics · ops · users · trust</div>
            </div>
            <Icons.check size={13}/>
          </div>
          <div className="ws-item" onClick={openOperated}>
            <div className="ws-icon op"><Icons.heart size={14}/></div>
            <div style={{flex:1,minWidth:0}}>
              <div className="ws-title">Operated profiles</div>
              <div className="ws-sub">Company personas · engage with users</div>
            </div>
            <Icons.external size={12}/>
          </div>
          <div className="ws-foot">
            <span className="mono">Opens in a new window</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Sidebar({ current, onNav, collapsed, onToggleCollapse }){
  return (
    <aside className="sidebar">
      <WorkspaceSwitcher collapsed={collapsed}/>
      <nav className="nav">
        {NAV.map(group => (
          <div key={group.group}>
            <div className="nav-section-label">{group.group}</div>
            {group.items.map(it => {
              const Ico = Icons[it.icon];
              return (
                <div key={it.id}
                  className={"nav-item " + (current===it.id?"active":"")}
                  onClick={()=>onNav(it.id)}>
                  <span className="ico"><Ico/></span>
                  <span className="nav-label">{it.label}</span>
                  {it.badge && <span className={"nav-badge "+(it.hot?"hot":"")}>{it.badge}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="side-foot">
        <div className="avatar">EM</div>
        {!collapsed && (
          <div style={{flex:1, minWidth:0}}>
            <div className="who">Elena M.</div>
            <div className="role">founder · admin</div>
          </div>
        )}
        {!collapsed && <button className="top-btn" title="Collapse" onClick={onToggleCollapse}><Icons.chevL/></button>}
        {collapsed && <button className="top-btn" title="Expand" onClick={onToggleCollapse}><Icons.chevron/></button>}
      </div>
    </aside>
  );
}

function Topbar({ crumbs, onOpenTweaks, anon, onToggleAnon, onSignOut }){
  return (
    <div className="topbar">
      <div className="crumbs">
        {crumbs.map((c,i)=>(
          <React.Fragment key={i}>
            {i>0 && <span className="sep">/</span>}
            <span>{i===crumbs.length-1?<b>{c}</b>:c}</span>
          </React.Fragment>
        ))}
      </div>
      <span className="env-badge">production · us-east-1</span>
      <div className="topbar-spacer"/>
      <button className="btn" onClick={onToggleAnon} style={{fontSize:12.5}} title="Toggle PII anonymization">
        <Icons.shield size={13}/> {anon ? "Anon · on" : "Anon · off"}
      </button>
      <div className="search">
        <Icons.search/>
        <input placeholder="Search users, reports, tickets, IDs…"/>
        <kbd>⌘K</kbd>
      </div>
      <button className="top-btn" title="Notifications"><Icons.bell/><span className="dot"/></button>
      <button className="top-btn" title="Tweaks" onClick={onOpenTweaks}><Icons.tweak/></button>
      <button className="top-btn" title="Sign out" onClick={onSignOut}><Icons.ban size={14}/></button>
    </div>
  );
}

function PageHead({ title, sub, actions }){
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      <div className="page-actions">{actions}</div>
    </div>
  );
}

// Map "preset key" -> human label and a date-resolver
const PRESETS = [
  { k:"today",      label:"Today" },
  { k:"yesterday",  label:"Yesterday" },
  { k:"this_week",  label:"This week" },
  { k:"last_week",  label:"Last week" },
  { k:"7d",         label:"Last 7 days" },
  { k:"this_month", label:"This month" },
  { k:"last_month", label:"Last month" },
  { k:"30d",        label:"Last 30 days" },
  { k:"this_qtr",   label:"This quarter" },
  { k:"last_qtr",   label:"Last quarter" },
  { k:"90d",        label:"Last 90 days" },
  { k:"YTD",        label:"Year to date" },
];

function presetLabel(value){
  if(!value) return "Last 7 days";
  if(typeof value === "object" && value.kind === "custom"){
    const f = (d)=>d ? `${d.getMonth()+1}/${d.getDate()}` : "—";
    return `${f(value.from)} – ${f(value.to)}`;
  }
  const k = typeof value === "string" ? value : value.k;
  const m = PRESETS.find(p=>p.k===k);
  return m ? m.label : k;
}

function resolvePreset(k, today){
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const day = t.getDay(); // 0 Sun
  const monStart = new Date(t); monStart.setDate(t.getDate() - ((day+6)%7));
  const monthStart = new Date(t.getFullYear(), t.getMonth(), 1);
  const qStartMonth = Math.floor(t.getMonth()/3)*3;
  const qStart = new Date(t.getFullYear(), qStartMonth, 1);
  const yStart = new Date(t.getFullYear(),0,1);
  const minus = (n)=>{ const d=new Date(t); d.setDate(t.getDate()-n); return d; };
  switch(k){
    case "today":      return [t,t];
    case "yesterday":  return [minus(1), minus(1)];
    case "this_week":  return [monStart, t];
    case "last_week":  { const e=new Date(monStart); e.setDate(monStart.getDate()-1); const s=new Date(e); s.setDate(e.getDate()-6); return [s,e]; }
    case "7d":         return [minus(6), t];
    case "this_month": return [monthStart, t];
    case "last_month": { const e=new Date(monthStart); e.setDate(0); const s=new Date(e.getFullYear(),e.getMonth(),1); return [s,e]; }
    case "30d":        return [minus(29), t];
    case "this_qtr":   return [qStart, t];
    case "last_qtr":   { const e=new Date(qStart); e.setDate(0); const s=new Date(e.getFullYear(), Math.floor(e.getMonth()/3)*3, 1); return [s,e]; }
    case "90d":        return [minus(89), t];
    case "YTD":        return [yStart, t];
    default:           return [minus(6), t];
  }
}

function sameDay(a,b){ return a&&b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function inRange(d, a, b){
  if(!a||!b) return false;
  const t = d.getTime(), s = Math.min(a.getTime(),b.getTime()), e = Math.max(a.getTime(),b.getTime());
  return t>=s && t<=e;
}

function DateRange({ value, onChange }){
  const [open, setOpen] = useState(false);
  const [today] = useState(()=> new Date());
  const presetKey = (typeof value === "string") ? value : (value && value.k) || "7d";
  const initial = resolvePreset(presetKey, today);
  const [view, setView] = useState(()=> new Date(today.getFullYear(), today.getMonth(), 1));
  const [from, setFrom] = useState(initial[0]);
  const [to, setTo]     = useState(initial[1]);
  const [hover, setHover] = useState(null);
  const [activePreset, setActivePreset] = useState(presetKey);
  const ref = useRef(null);

  useEffect(()=>{
    function onDoc(e){
      if(!open) return;
      if(ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return ()=>document.removeEventListener("mousedown", onDoc);
  },[open]);

  function pickPreset(k){
    const [a,b] = resolvePreset(k, today);
    setFrom(a); setTo(b);
    setActivePreset(k);
    setView(new Date(a.getFullYear(), a.getMonth(), 1));
    onChange(k);
  }

  function pickDay(d){
    if(!from || (from && to && !sameDay(from,to))){
      setFrom(d); setTo(null); setActivePreset("custom");
    } else if(from && !to){
      let a=from, b=d;
      if(b<a){ [a,b]=[b,a]; }
      setFrom(a); setTo(b); setActivePreset("custom");
      onChange({ kind:"custom", k:"custom", from:a, to:b });
    } else {
      setFrom(d); setTo(null);
    }
  }

  function shiftMonth(n){
    setView(v => new Date(v.getFullYear(), v.getMonth()+n, 1));
  }

  // Build calendar cells
  const monthName = view.toLocaleString("en", { month:"long", year:"numeric" });
  const firstDow = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
  const daysInMonth = new Date(view.getFullYear(), view.getMonth()+1, 0).getDate();
  const prevDays = new Date(view.getFullYear(), view.getMonth(), 0).getDate();
  const cells = [];
  for(let i=0;i<firstDow;i++){
    cells.push({ d:new Date(view.getFullYear(), view.getMonth()-1, prevDays - firstDow + 1 + i), out:true });
  }
  for(let i=1;i<=daysInMonth;i++){
    cells.push({ d:new Date(view.getFullYear(), view.getMonth(), i), out:false });
  }
  while(cells.length % 7 !== 0 || cells.length < 42){
    const last = cells[cells.length-1].d;
    cells.push({ d:new Date(last.getFullYear(), last.getMonth(), last.getDate()+1), out:true });
    if(cells.length>=42) break;
  }

  const tentativeTo = (from && !to && hover) ? hover : to;

  return (
    <div className="dr-wrap" ref={ref}>
      <button type="button" className="btn" onClick={()=>setOpen(o=>!o)}>
        <Icons.cal size={13}/> {presetLabel(value)} <Icons.chevron size={11}/>
      </button>

      {open && (
        <div className="dr-pop" role="dialog">
          <div className="dr-presets">
            {PRESETS.map(p=>(
              <button key={p.k}
                className={"dr-preset "+(activePreset===p.k?"on":"")}
                onClick={()=>pickPreset(p.k)}>
                {activePreset===p.k && <Icons.check size={11}/>}
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          <div className="dr-cal">
            <div className="dr-cal-head">
              <div className="dr-month">{monthName}</div>
              <div style={{flex:1}}/>
              <button className="dr-arr" onClick={()=>shiftMonth(-1)} aria-label="Prev"><Icons.chevL size={13}/></button>
              <button className="dr-arr" onClick={()=>shiftMonth(1)}  aria-label="Next"><Icons.chevron size={13}/></button>
            </div>
            <div className="dr-grid dr-dow">
              {["SU","MO","TU","WE","TH","FR","SA"].map(d=><div key={d}>{d}</div>)}
            </div>
            <div className="dr-grid">
              {cells.map((c,i)=>{
                const isFrom = sameDay(c.d, from);
                const isTo   = sameDay(c.d, tentativeTo);
                const isEnd  = isFrom || isTo;
                const between = from && tentativeTo && inRange(c.d, from, tentativeTo) && !isEnd;
                const isToday = sameDay(c.d, today);
                let cls = "dr-cell";
                if(c.out) cls += " out";
                if(between) cls += " mid";
                if(isEnd) cls += " end";
                if(isToday) cls += " today";
                return (
                  <button key={i} className={cls}
                    onMouseEnter={()=>setHover(c.d)}
                    onMouseLeave={()=>setHover(null)}
                    onClick={()=>pickDay(c.d)}>
                    {c.d.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="dr-foot">
              <span className="mono">
                {from ? `${from.getMonth()+1}/${from.getDate()}` : "—"}
                {" – "}
                {to ? `${to.getMonth()+1}/${to.getDate()}` : "select end"}
              </span>
              <div style={{flex:1}}/>
              <button className="btn ghost" style={{fontSize:12}} onClick={()=>setOpen(false)}>Cancel</button>
              <button className="btn primary" style={{fontSize:12}}
                disabled={!from || !to}
                onClick={()=>{
                  if(from && to) onChange({ kind:"custom", k:"custom", from, to });
                  setOpen(false);
                }}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .dr-wrap{position:relative}
        .dr-pop{
          position:absolute;top:calc(100% + 6px);right:0;z-index:60;
          background:var(--bg-elev);border:1px solid var(--line);
          border-radius:12px;display:flex;gap:0;
          box-shadow:0 30px 70px -25px rgba(0,0,0,.85);
          min-width:540px;
        }
        .dr-presets{
          display:flex;flex-direction:column;gap:2px;padding:10px 8px;
          border-right:1px solid var(--line-soft);min-width:170px;
        }
        .dr-preset{
          display:flex;align-items:center;gap:8px;
          padding:7px 10px;border-radius:7px;
          color:var(--text-dim);font-size:13px;text-align:left;
          background:transparent;border:0;cursor:pointer;
        }
        .dr-preset:hover{background:var(--bg-hover);color:var(--text)}
        .dr-preset.on{color:var(--text);font-weight:500}
        .dr-preset .i,.dr-preset svg{flex:none;color:var(--accent)}
        .dr-preset:not(.on) > svg{visibility:hidden}
        .dr-cal{padding:14px 14px 12px;display:flex;flex-direction:column;gap:8px;min-width:340px}
        .dr-cal-head{display:flex;align-items:center;gap:6px}
        .dr-month{font-size:13px;font-weight:600}
        .dr-arr{
          width:26px;height:26px;border-radius:6px;
          background:var(--bg-elev-2);border:1px solid var(--line-soft);
          color:var(--text-dim);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;
        }
        .dr-arr:hover{background:var(--bg-hover);color:var(--text)}
        .dr-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
        .dr-dow > div{
          font-family:var(--font-mono);font-size:10.5px;color:var(--text-mute);
          text-align:center;padding:6px 0;letter-spacing:.04em;
        }
        .dr-cell{
          height:32px;border:0;background:transparent;color:var(--text-dim);
          font-family:var(--font-mono);font-size:12.5px;border-radius:6px;cursor:pointer;
          position:relative;
        }
        .dr-cell:hover{background:var(--bg-hover);color:var(--text)}
        .dr-cell.out{color:var(--text-mute);opacity:.45}
        .dr-cell.today{box-shadow:inset 0 0 0 1px var(--line)}
        .dr-cell.mid{background:var(--accent-soft);color:var(--text);border-radius:0}
        .dr-cell.end{background:var(--accent);color:oklch(0.18 0.04 25);font-weight:600}
        .dr-foot{
          display:flex;align-items:center;gap:8px;
          padding-top:10px;margin-top:4px;border-top:1px solid var(--line-soft);
          font-size:12px;color:var(--text-mute);
        }
      `}</style>
    </div>
  );
}

Object.assign(window, { Sidebar, Topbar, PageHead, DateRange, NAV });
