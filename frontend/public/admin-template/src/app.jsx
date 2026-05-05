// Root app — routing, drawer, tweaks wiring

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "coral",
  "density": "comfortable",
  "sidebar": "expanded",
  "range": "7d",
  "liveStream": true
}/*EDITMODE-END*/;

const ACCENT_MAP = {
  coral:   "oklch(0.72 0.15 25)",
  violet:  "oklch(0.68 0.18 300)",
  emerald: "oklch(0.72 0.14 155)",
  azure:   "oklch(0.72 0.14 240)",
  amber:   "oklch(0.80 0.15 80)",
};

const ROUTES = {
  overview:     ["Overview"],
  users:        ["Users"],
  matches:      ["Analytics","Matches"],
  trust:        ["Operations","Trust & Safety"],
  moderation:   ["Operations","Content review"],
  revenue:      ["Analytics","Revenue"],
  experiments:  ["Product","Experiments"],
  algorithm:    ["Product","Algorithm"],
  notifications:["Product","Notifications"],
  plans:        ["Product","Plans & limits"],
  support:      ["Operations","Support"],
  team:         ["Organization","Team"],
};

function App(){
  const [authed, setAuthed] = useState(()=>sessionStorage.getItem("ohrny.auth")==="1");
  const [anon, setAnon] = useState(ANON_DEFAULT);
  const [route, setRoute] = useState(()=>localStorage.getItem("ohrny.route") || "overview");
  const [user, setUser] = useState(null);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [tw, setTw] = useState(TWEAK_DEFAULTS);

  useEffect(()=>{localStorage.setItem("ohrny.route", route)},[route]);
  useEffect(()=>{localStorage.setItem("ohrny.anon", anon?"on":"off")},[anon]);

  // Apply tweaks to root
  useEffect(()=>{
    document.body.dataset.sidebar = tw.sidebar;
    document.body.dataset.density = tw.density;
    document.documentElement.style.setProperty("--accent", ACCENT_MAP[tw.accent]);
    document.documentElement.style.setProperty(
      "--accent-soft",
      ACCENT_MAP[tw.accent].replace(")", " / .14)")
    );
  },[tw]);

  // Edit-mode handshake
  useEffect(()=>{
    function onMsg(e){
      const d = e.data||{};
      if(d.type==="__activate_edit_mode") setTweaksOpen(true);
      if(d.type==="__deactivate_edit_mode") setTweaksOpen(false);
    }
    window.addEventListener("message", onMsg);
    window.parent.postMessage({type:"__edit_mode_available"}, "*");
    return ()=>window.removeEventListener("message", onMsg);
  },[]);

  function updateTw(patch){
    setTw(t=>{
      const next = {...t, ...patch};
      window.parent.postMessage({type:"__edit_mode_set_keys", edits: patch}, "*");
      return next;
    });
  }

  const crumbs = ["Ohrny admin", ...(ROUTES[route]||[route])];

  if(!authed){
    return <LoginScreen onAuth={()=>{sessionStorage.setItem("ohrny.auth","1"); setAuthed(true);}}/>;
  }

  return (
    <>
      <div className="app">
        <Sidebar current={route}
          collapsed={tw.sidebar==="collapsed"}
          onToggleCollapse={()=>updateTw({sidebar: tw.sidebar==="collapsed"?"expanded":"collapsed"})}
          onNav={setRoute}/>
        <main className="main" data-screen-label={"01 " + (ROUTES[route]||[route]).slice(-1)[0]}>
          <Topbar crumbs={crumbs}
            anon={anon}
            onToggleAnon={()=>setAnon(a=>!a)}
            onSignOut={()=>{sessionStorage.removeItem("ohrny.auth"); setAuthed(false);}}
            onOpenTweaks={()=>setTweaksOpen(v=>!v)}/>
          <div className="page">
            {route==="overview"      && <OverviewSection/>}
            {route==="users"         && <UsersSection anon={anon} onOpenUser={setUser}/>}
            {route==="matches"       && <MatchesSection/>}
            {route==="trust"         && <TrustSection/>}
            {route==="moderation"    && <ModerationSection/>}
            {route==="revenue"       && <RevenueSection/>}
            {route==="experiments"   && <ExperimentsSection/>}
            {route==="algorithm"     && <AlgorithmSection/>}
            {route==="notifications" && <NotificationsSection/>}
            {route==="plans"         && <PlansSection/>}
            {route==="support"       && <SupportSection/>}
            {route==="team"          && <TeamSection/>}
          </div>
        </main>
      </div>

      {user && <UserDrawer user={user} anon={anon} onClose={()=>setUser(null)}/>}
      <TweaksPanel open={tweaksOpen} onClose={()=>setTweaksOpen(false)}
        state={tw} onChange={updateTw}/>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
