// Root app for Operated Profiles workspace

function StatusDot({ s }){
  const col = s==="active" ? "var(--ok)" : s==="paused" ? "var(--warn)" : "var(--text-mute)";
  return <span style={{width:7,height:7,borderRadius:"50%",background:col,display:"inline-block",flex:"none"}}/>;
}

function NewPersonaModal({ onClose, onCreate }){
  const [name, setName] = useState("");
  const [age, setAge] = useState(28);
  const [gender, setGender] = useState("Woman");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const hue = Math.floor(Math.random()*360);
  return (
    <div className="m-backdrop" onClick={onClose}>
      <div className="m-card" onClick={e=>e.stopPropagation()}>
        <div className="m-head">
          <div style={{fontWeight:600}}>New operated persona</div>
          <button className="top-btn" onClick={onClose}><Icons.close size={14}/></button>
        </div>
        <div className="m-body col" style={{gap:12}}>
          <div className="muted" style={{fontSize:12}}>Creates a new company-operated profile. Bio disclosure and verified badge are added automatically.</div>
          <div className="field"><label>Display name</label><input value={name} onChange={e=>setName(e.target.value)}/></div>
          <div className="field-row">
            <div className="field"><label>Age</label><input type="number" value={age} onChange={e=>setAge(+e.target.value)}/></div>
            <div className="field"><label>Gender</label>
              <select value={gender} onChange={e=>setGender(e.target.value)}>
                <option>Woman</option><option>Man</option><option>Non-binary</option>
              </select>
            </div>
          </div>
          <div className="field"><label>City</label><input value={city} onChange={e=>setCity(e.target.value)} placeholder="Brooklyn, NY"/></div>
          <div className="field"><label>Bio</label><textarea rows="3" value={bio} onChange={e=>setBio(e.target.value)}/></div>
        </div>
        <div className="m-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!name||!city}
            onClick={()=>onCreate({name,age,gender,city,bio,hue})}>
            <Icons.plus size={13}/> Create persona
          </button>
        </div>
      </div>
    </div>
  );
}

function App(){
  const [personas, setPersonas] = useState(PERSONAS_SEED);
  const [selectedId, setSelectedId] = useState(PERSONAS_SEED[0].id);
  const [tab, setTab] = useState("inbox");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const persona = personas.find(p=>p.id===selectedId);
  const filtered = personas.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()) || p.city.toLowerCase().includes(search.toLowerCase()));

  function updatePersona(next){
    setPersonas(ps=>ps.map(p=>p.id===next.id?next:p));
  }

  const unread = useMemo(()=>{
    const out = {};
    personas.forEach(p=>{
      out[p.id] = makeThreads(p.id, p.hue).filter(t=>t.unread>0).length;
    });
    return out;
  },[personas.map(p=>p.id).join(",")]);

  const totalUnread = Object.values(unread).reduce((a,b)=>a+b,0);
  const threadsCount = persona ? makeThreads(persona.id, persona.hue).length : 0;

  return (
    <div className="op-shell">
      <div className="op-top">
        <div className="op-brand">
          <div style={{width:28,height:28,borderRadius:8,background:"radial-gradient(circle at 30% 30%, oklch(0.80 0.17 25), oklch(0.55 0.17 25))"}}/>
          <div>
            <div><b>Ohrny</b> <span className="muted">· operated profiles</span></div>
            <div className="sub">workspace · separate from admin console</div>
          </div>
        </div>
        <div className="op-warn">
          <Icons.shield size={13}/> live engagement with real users · every action is attributable and audited
        </div>
        <div className="op-spacer"/>
        <span className="chip">Elena M. · founder</span>
        <button className="btn" onClick={()=>window.close()}><Icons.close size={13}/> Close</button>
      </div>

      <div className="op-main">
        <aside className="op-rail">
          <div className="op-rail-head">
            <div style={{flex:1,fontWeight:600,fontSize:13}}>Personas <span className="muted" style={{fontWeight:400}}>· {personas.length}</span></div>
            <button className="btn" onClick={()=>setNewOpen(true)} style={{padding:"4px 9px",fontSize:12}}><Icons.plus size={12}/> New</button>
          </div>
          <div className="op-rail-search">
            <input placeholder="Search name, city…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <div className="op-rail-list">
            {filtered.map(p=>(
              <div key={p.id} className={"persona-card "+(selectedId===p.id?"on":"")} onClick={()=>setSelectedId(p.id)}>
                <div className="pavatar" style={{background:`linear-gradient(135deg, oklch(0.60 0.14 ${p.hue}), oklch(0.35 0.12 ${(p.hue+70)%360}))`}}>
                  <span className="init">{p.name.split(" ").map(n=>n[0]).join("")}</span>
                </div>
                <div style={{minWidth:0}}>
                  <div className="row" style={{gap:6}}>
                    <StatusDot s={p.status}/>
                    <span className="pname">{p.name}</span>
                    <span className="muted" style={{fontSize:11}}>{p.age}</span>
                  </div>
                  <div className="psub">{p.city} · {p.team}</div>
                </div>
                {unread[p.id]>0 && <span className="punread">{unread[p.id]}</span>}
              </div>
            ))}
          </div>
          <div className="op-rail-foot">
            <div className="row" style={{gap:8,fontSize:11.5,color:"var(--text-mute)"}}>
              <span className="row gap-sm"><span style={{width:6,height:6,borderRadius:"50%",background:"var(--ok)"}}/>{personas.filter(p=>p.status==="active").length} active</span>
              <span>·</span>
              <span>{totalUnread} unread</span>
            </div>
          </div>
        </aside>

        <section className="op-content">
          <div className="op-tabs">
            {[
              ["inbox","Inbox", threadsCount],
              ["editor","Profile", null],
              ["feed","Feed", null],
              ["dashboard","Dashboard", null],
            ].map(([k,l,c])=>(
              <div key={k} className={"op-tab "+(tab===k?"on":"")} onClick={()=>setTab(k)}>
                {l}{c!==null && <span className="count">{c}</span>}
              </div>
            ))}
            <div className="op-header-spacer"/>
            <div className="op-header-actions">
              <span className="chip"><StatusDot s={persona.status}/> {persona.status}</span>
              <button className="btn" onClick={()=>{
                updatePersona({...persona, status: persona.status==="active" ? "paused" : "active"});
              }}>
                {persona.status==="active" ? "Pause persona" : "Activate persona"}
              </button>
            </div>
          </div>
          <div className="op-body">
            {tab==="inbox" && <Inbox persona={persona}/>}
            {tab==="editor" && <Editor persona={persona} onChange={updatePersona}/>}
            {tab==="feed" && <Feed persona={persona}/>}
            {tab==="dashboard" && <Dashboard persona={persona}/>}
          </div>
        </section>
      </div>

      {newOpen && <NewPersonaModal onClose={()=>setNewOpen(false)} onCreate={(p)=>{
        const np = {
          id:"op_"+(personas.length+1),
          name:p.name, age:p.age, gender:p.gender, orientation:"Straight",
          city:p.city, country:"US", hue:p.hue, status:"active",
          bio:p.bio || "New persona bio.", work:"", edu:"", height:"",
          relStatus:"Single", intent:"Long-term", drinks:"Socially", smokes:"No", kids:"Open",
          interests:[], photos:0, verified:false, plan:"Free",
          createdBy:"Elena M.", team:"Seed · New",
          stats:{matches:0,active:0,msgsToday:0,replyRate:0,lastActive:"just now"}
        };
        setPersonas(ps=>[...ps, np]);
        setSelectedId(np.id);
        setNewOpen(false);
        setTab("editor");
      }}/>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
