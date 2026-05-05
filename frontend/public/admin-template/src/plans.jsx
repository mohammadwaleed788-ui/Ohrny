// Plans & Limits — configure tiers, message caps, simultaneous matches, gates

function PlansSection(){
  const [tab, setTab] = useState("limits"); // limits | gates | revenue | rollout
  const [savedAt, setSavedAt] = useState("Apr 22 · 14:08 UTC");
  const [dirty, setDirty] = useState(false);

  // Tier configuration — smart defaults for a dating app
  const [tiers, setTiers] = useState([
    {
      id:"free", name:"Free", price:0, color:"oklch(0.65 0.02 260)",
      tagline:"On-ramp · friction by design",
      users: 1124822, paying:false,
      limits:{
        likesPerDay: 20,
        matchesVisible: 8,         // simultaneous active matches in the deck
        messagesPerNewMatch: 3,    // before they reply you can only send N
        messagesPerDay: 30,        // total outbound across all matches
        superLikesPerWeek: 1,
        boostsPerMonth: 0,
        rewindLast: 0,
        photosOnProfile: 4,
        advancedFilters: false,
        seeWhoLikedYou: "blurred", // none | blurred | clear
        readReceipts: false,
        incognitoMode: false,
        priorityInDeck: false,
        messageBeforeMatch: false,
        passport: false,
        adsShown: true,
      }
    },
    {
      id:"plus", name:"Plus", price:6.99, color:"oklch(0.75 0.12 235)",
      tagline:"Casual upgrade · entry tier",
      users: 31274, paying:true,
      limits:{
        likesPerDay: 100,
        matchesVisible: 25,
        messagesPerNewMatch: 10,
        messagesPerDay: 150,
        superLikesPerWeek: 3,
        boostsPerMonth: 0,
        rewindLast: 5,
        photosOnProfile: 6,
        advancedFilters: false,
        seeWhoLikedYou: "blurred",
        readReceipts: false,
        incognitoMode: false,
        priorityInDeck: false,
        messageBeforeMatch: false,
        passport: false,
        adsShown: false,
      }
    },
    {
      id:"gold", name:"Gold", price:14.99, color:"oklch(0.82 0.14 80)",
      tagline:"Most popular · 51% of revenue",
      users: 41820, paying:true,
      limits:{
        likesPerDay: -1, // unlimited
        matchesVisible: 100,
        messagesPerNewMatch: -1,
        messagesPerDay: 500,
        superLikesPerWeek: 5,
        boostsPerMonth: 1,
        rewindLast: 20,
        photosOnProfile: 9,
        advancedFilters: true,
        seeWhoLikedYou: "clear",
        readReceipts: true,
        incognitoMode: false,
        priorityInDeck: false,
        messageBeforeMatch: false,
        passport: true,
        adsShown: false,
      }
    },
    {
      id:"platinum", name:"Platinum", price:29.99, color:"oklch(0.72 0.15 25)",
      tagline:"Power users · highest LTV",
      users: 9210, paying:true,
      limits:{
        likesPerDay: -1,
        matchesVisible: -1,
        messagesPerNewMatch: -1,
        messagesPerDay: -1,
        superLikesPerWeek: 10,
        boostsPerMonth: 2,
        rewindLast: -1,
        photosOnProfile: 12,
        advancedFilters: true,
        seeWhoLikedYou: "clear",
        readReceipts: true,
        incognitoMode: true,
        priorityInDeck: true,
        messageBeforeMatch: true,
        passport: true,
        adsShown: false,
      }
    },
  ]);

  function updateLimit(tierId, key, value){
    setTiers(ts=>ts.map(t=>t.id===tierId ? {...t, limits:{...t.limits, [key]: value}} : t));
    setDirty(true);
  }
  function updateTier(tierId, patch){
    setTiers(ts=>ts.map(t=>t.id===tierId ? {...t, ...patch} : t));
    setDirty(true);
  }

  function save(){
    setSavedAt(new Date().toUTCString().slice(5,22) + " UTC");
    setDirty(false);
  }

  return (
    <div className="section active">
      <PageHead title="Plans & limits"
        sub="Subscription tiers, match & message caps, paywalled gates"
        actions={<>
          <span className="muted mono" style={{fontSize:11.5}}>
            {dirty ? <span style={{color:"var(--warn)"}}>● unsaved changes</span> : <>last saved {savedAt}</>}
          </span>
          <button className="btn" disabled={!dirty} onClick={()=>{setTiers(ts=>ts);setDirty(false);}}>Discard</button>
          <button className="btn primary" disabled={!dirty} onClick={save}>
            <Icons.check size={13}/> Save & roll out
          </button>
        </>}/>

      <div className="plan-tabs">
        {[
          ["limits","Match & message limits"],
          ["gates","Feature gates"],
          ["revenue","Pricing & monetization"],
          ["rollout","Rollout & overrides"],
        ].map(([k,l])=>(
          <div key={k} className={"plan-tab "+(tab===k?"on":"")} onClick={()=>setTab(k)}>{l}</div>
        ))}
      </div>

      {tab==="limits"   && <LimitsTab tiers={tiers} update={updateLimit}/>}
      {tab==="gates"    && <GatesTab tiers={tiers} update={updateLimit}/>}
      {tab==="revenue"  && <RevenueTab tiers={tiers} update={updateTier}/>}
      {tab==="rollout"  && <RolloutTab tiers={tiers}/>}
    </div>
  );
}

/* -------- LIMITS TAB -------- */

function LimitsTab({ tiers, update }){
  const rows = [
    { key:"likesPerDay",         label:"Likes per day",
      sub:"Right-swipes allowed in 24h. Resets at midnight local.",
      icon:"heart", min:5, max:200, allowUnlimited:true,
      note:"Free is the dam — keep tight to push upgrades." },
    { key:"matchesVisible",      label:"Active matches in the deck",
      sub:"How many matches appear at once before older matches expire from view.",
      icon:"users", min:3, max:200, allowUnlimited:true,
      note:"Caps choice paralysis. Free users force-curated to the freshest." },
    { key:"messagesPerNewMatch", label:"Messages to a non-replier",
      sub:"How many messages a user can send to a new match before that match replies.",
      icon:"send", min:1, max:50, allowUnlimited:true,
      note:"Anti-pestering gate. Hard cap on Free: hooks them on the wait." },
    { key:"messagesPerDay",      label:"Outbound messages per day",
      sub:"Total messages sent across all matches in a 24h window.",
      icon:"send", min:5, max:1000, allowUnlimited:true,
      note:"Stops bot-like behavior; nudges power users to Plus+." },
    { key:"superLikesPerWeek",   label:"Super-likes per week",
      sub:"Granted weekly. Unused don't carry over.",
      icon:"star", min:0, max:30, allowUnlimited:false },
    { key:"boostsPerMonth",      label:"Boosts per month",
      sub:"30-min top-of-deck spotlight. Granted monthly.",
      icon:"zap", min:0, max:10, allowUnlimited:false },
    { key:"rewindLast",          label:"Rewind last N swipes",
      sub:"Undo accidental left-swipes within the session.",
      icon:"undo", min:0, max:50, allowUnlimited:true },
    { key:"photosOnProfile",     label:"Photos on profile",
      sub:"Hard cap on uploaded photos.",
      icon:"image", min:1, max:20, allowUnlimited:false },
  ];

  return (
    <>
      <div className="tier-strip">
        {tiers.map(t=>(
          <div key={t.id} className="tier-pill">
            <span style={{width:8,height:8,borderRadius:"50%",background:t.color,display:"inline-block"}}/>
            <span style={{fontWeight:600}}>{t.name}</span>
            <span className="muted mono" style={{fontSize:11}}>
              {t.price===0 ? "free" : "$"+t.price.toFixed(2)+"/mo"}
            </span>
            <span className="muted" style={{fontSize:11}}>· {t.users.toLocaleString()} users</span>
          </div>
        ))}
      </div>

      <div className="limits-table">
        <div className="lt-head">
          <div>Limit</div>
          {tiers.map(t=>(
            <div key={t.id} className="lt-tier-head">
              <span style={{width:8,height:8,borderRadius:"50%",background:t.color,display:"inline-block",marginRight:6}}/>
              {t.name}
            </div>
          ))}
        </div>

        {rows.map(r=>{
          const Ico = Icons[r.icon] || Icons.dot;
          return (
            <div key={r.key} className="lt-row">
              <div className="lt-meta">
                <div className="row" style={{gap:8,alignItems:"center"}}>
                  <span className="lt-icon"><Ico size={14}/></span>
                  <span style={{fontWeight:500,fontSize:13}}>{r.label}</span>
                </div>
                <div className="muted" style={{fontSize:11.5,marginTop:4,lineHeight:1.45}}>{r.sub}</div>
                {r.note && <div className="lt-note">↳ {r.note}</div>}
              </div>
              {tiers.map(t=>{
                const v = t.limits[r.key];
                return (
                  <LimitCell key={t.id} tier={t} row={r} value={v}
                    onChange={nv=>update(t.id, r.key, nv)}/>
                );
              })}
            </div>
          );
        })}

        {/* Compatibility / smart-match summary */}
        <div className="lt-summary">
          <Icons.lightbulb size={13}/>
          <div>
            <b>Reading the funnel:</b> Free's 3-msg-to-non-replier cap is the #1 paywall trigger —
            users hit it within 38h on average. Gold's "unlimited" actually averages 47/day; the real
            difference vs Plus is unblurred Likes-You.
          </div>
        </div>
      </div>
    </>
  );
}

function LimitCell({ tier, row, value, onChange }){
  const isUnlimited = value === -1;
  const display = isUnlimited ? "∞" : value;

  return (
    <div className="lt-cell">
      <div className="lt-val">
        <span className="lt-num" style={{color: isUnlimited ? tier.color : "var(--text)"}}>{display}</span>
        <span className="lt-unit">{row.key.includes("PerDay")?"/day":row.key.includes("PerWeek")?"/wk":row.key.includes("PerMonth")?"/mo":""}</span>
      </div>
      <input type="range"
        min={row.min} max={row.max}
        value={isUnlimited ? row.max : value}
        onChange={e=>onChange(+e.target.value)}
        className="lt-slider"
        style={{accentColor: tier.color}}
        disabled={isUnlimited}
      />
      <div className="lt-foot">
        <span className="mono muted" style={{fontSize:10}}>{row.min}</span>
        {row.allowUnlimited ? (
          <label className="lt-unl">
            <input type="checkbox" checked={isUnlimited}
              onChange={e=>onChange(e.target.checked ? -1 : Math.floor((row.min+row.max)/2))}/>
            <span>unlimited</span>
          </label>
        ) : <span/>}
        <span className="mono muted" style={{fontSize:10}}>{row.max}</span>
      </div>
    </div>
  );
}

/* -------- GATES TAB -------- */

function GatesTab({ tiers, update }){
  const features = [
    { key:"seeWhoLikedYou",     label:"See who liked you",
      sub:"The hero gate. Blurred shows the count; clear shows the photo.",
      kind:"select", options:[
        {v:"none", l:"Hidden"},
        {v:"blurred", l:"Blurred + count"},
        {v:"clear", l:"Clear photo"},
      ]},
    { key:"advancedFilters",    label:"Advanced filters",
      sub:"Filter by height, education, kids, intent, religion, etc.", kind:"toggle" },
    { key:"readReceipts",       label:"Read receipts",
      sub:"Show users when their messages have been read.", kind:"toggle" },
    { key:"incognitoMode",      label:"Incognito mode",
      sub:"Browse without appearing in others' decks unless you've liked them.", kind:"toggle" },
    { key:"priorityInDeck",     label:"Priority placement in deck",
      sub:"Profile shown to more potential matches per session.", kind:"toggle" },
    { key:"messageBeforeMatch", label:"Message before matching",
      sub:"Send a note alongside a Super-like so it stands out.", kind:"toggle" },
    { key:"passport",           label:"Passport (location swap)",
      sub:"Browse and match in any city without travelling there.", kind:"toggle" },
    { key:"adsShown",           label:"Show in-app ads",
      sub:"Inverted — when ON, this tier sees ads. Free typically true.", kind:"toggle", inverse:true },
  ];

  return (
    <div className="gates">
      {features.map(f=>(
        <div key={f.key} className="gate-row">
          <div className="gate-meta">
            <div style={{fontWeight:500,fontSize:13.5}}>{f.label}</div>
            <div className="muted" style={{fontSize:12,marginTop:3,lineHeight:1.5}}>{f.sub}</div>
          </div>
          {tiers.map(t=>(
            <div key={t.id} className="gate-cell">
              <div className="gate-tier-label" style={{color:t.color}}>{t.name}</div>
              {f.kind==="toggle" ? (
                <ToggleSwitch
                  on={t.limits[f.key]}
                  onChange={v=>update(t.id, f.key, v)}
                  color={t.color}
                  inverse={f.inverse}
                />
              ) : (
                <select value={t.limits[f.key]}
                  className="gate-select"
                  onChange={e=>update(t.id, f.key, e.target.value)}>
                  {f.options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ToggleSwitch({ on, onChange, color, inverse }){
  // Visual: green = "user gets the perk" by convention. inverse flips it.
  const isOn = !!on;
  const visualOn = inverse ? !isOn : isOn;
  return (
    <button
      className={"toggle "+(visualOn?"on":"")}
      style={{ background: visualOn ? color : "var(--bg-elev-2)" }}
      onClick={()=>onChange(!isOn)}
      title={inverse ? (isOn?"Yes, ads shown":"No ads") : (isOn?"Enabled":"Disabled")}>
      <span className="toggle-dot"/>
    </button>
  );
}

/* -------- REVENUE TAB -------- */

function RevenueTab({ tiers, update }){
  const paying = tiers.filter(t=>t.paying);
  const totalUsers = tiers.reduce((s,t)=>s+t.users,0);
  const monthlyRev = paying.reduce((s,t)=>s + t.users * t.price, 0);

  return (
    <>
      <div className="rev-summary">
        <div className="rev-tile">
          <div className="rev-label">Monthly subscription revenue</div>
          <div className="rev-val mono">${(monthlyRev/1000).toFixed(0)}k</div>
          <div className="muted" style={{fontSize:11.5}}>
            {paying.reduce((s,t)=>s+t.users,0).toLocaleString()} paying of {totalUsers.toLocaleString()} total
          </div>
        </div>
        <div className="rev-tile">
          <div className="rev-label">Free → paid conversion</div>
          <div className="rev-val mono">{((paying.reduce((s,t)=>s+t.users,0)/totalUsers)*100).toFixed(1)}%</div>
          <div className="muted" style={{fontSize:11.5}}>industry median ~5–7%</div>
        </div>
        <div className="rev-tile">
          <div className="rev-label">Blended ARPPU</div>
          <div className="rev-val mono">${(monthlyRev/paying.reduce((s,t)=>s+t.users,0)).toFixed(2)}</div>
          <div className="muted" style={{fontSize:11.5}}>per paying user / month</div>
        </div>
      </div>

      <div className="price-grid">
        {tiers.map(t=>(
          <div key={t.id} className="price-card" style={{borderTop:"3px solid "+t.color}}>
            <div className="row" style={{justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div className="muted" style={{fontSize:11,letterSpacing:".06em",textTransform:"uppercase"}}>{t.tagline}</div>
                <div style={{fontSize:18,fontWeight:600,marginTop:4}}>{t.name}</div>
              </div>
              <div className="price-badge mono">
                {t.users.toLocaleString()} users
              </div>
            </div>

            <div className="price-edit">
              <label className="muted" style={{fontSize:11}}>Price · USD / month</label>
              <div className="price-input-row">
                <span className="price-currency">$</span>
                <input type="number" step="0.01" min="0"
                  value={t.price}
                  onChange={e=>update(t.id, { price: +e.target.value })}
                  disabled={!t.paying}/>
                <span className="muted" style={{fontSize:11}}>/mo</span>
              </div>
            </div>

            {t.paying && (
              <>
                <div className="price-row">
                  <span className="muted">Annual price (2mo free)</span>
                  <span className="mono">${(t.price * 10).toFixed(2)}</span>
                </div>
                <div className="price-row">
                  <span className="muted">MRR contribution</span>
                  <span className="mono" style={{color:"var(--ok)"}}>
                    ${((t.users * t.price)/1000).toFixed(0)}k
                  </span>
                </div>
                <div className="price-row">
                  <span className="muted">Share of revenue</span>
                  <span className="mono">{((t.users*t.price)/monthlyRev*100).toFixed(1)}%</span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="panel" style={{marginTop:14}}>
        <div className="panel-head">
          <div className="panel-title">Consumables · à la carte</div>
          <div className="panel-sub">Pay-per-use for free + paying users</div>
        </div>
        <div className="panel-body">
          <table className="tbl">
            <thead>
              <tr><th>Item</th><th>Single</th><th>5-pack</th><th>20-pack</th><th>Free can buy</th><th>Margin</th></tr>
            </thead>
            <tbody>
              <tr><td>Super-like</td><td className="mono">$1.99</td><td className="mono">$7.99</td><td className="mono">$24.99</td><td><span className="chip ok">yes</span></td><td className="mono" style={{color:"var(--ok)"}}>92%</td></tr>
              <tr><td>30-min Boost</td><td className="mono">$5.99</td><td className="mono">$22.99</td><td className="mono">$74.99</td><td><span className="chip ok">yes</span></td><td className="mono" style={{color:"var(--ok)"}}>96%</td></tr>
              <tr><td>Read receipts (10)</td><td className="mono">$3.99</td><td className="mono">—</td><td className="mono">—</td><td><span className="chip ok">yes</span></td><td className="mono" style={{color:"var(--ok)"}}>98%</td></tr>
              <tr><td>Rewind pack (10)</td><td className="mono">$2.99</td><td className="mono">$11.99</td><td className="mono">—</td><td><span className="chip ok">yes</span></td><td className="mono" style={{color:"var(--ok)"}}>97%</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* -------- ROLLOUT TAB -------- */

function RolloutTab({ tiers }){
  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Limit changes — rollout strategy</div>
          <div className="panel-sub">When you save, decide who gets the new caps.</div>
        </div>
        <div className="panel-body col" style={{gap:10}}>
          {[
            { id:"all", title:"All users immediately", sub:"Active sessions inherit new caps on next request.", risk:"high"},
            { id:"new", title:"New signups only", sub:"Existing users keep current caps until next billing cycle.", risk:"low"},
            { id:"shadow", title:"Shadow rollout · 5%", sub:"Apply to 5% bucket; compare metrics before broad rollout.", risk:"medium", recommended:true},
            { id:"region", title:"Region-by-region", sub:"Start with one country/state, then expand weekly.", risk:"low"},
          ].map(s=>(
            <label key={s.id} className="rollout-row">
              <input type="radio" name="rollout" defaultChecked={s.recommended}/>
              <div>
                <div className="row" style={{gap:8}}>
                  <span style={{fontWeight:500}}>{s.title}</span>
                  {s.recommended && <span className="chip ok">recommended</span>}
                  <span className={"chip "+(s.risk==="high"?"warn":s.risk==="medium"?"":"ok")}>{s.risk} risk</span>
                </div>
                <div className="muted" style={{fontSize:12,marginTop:2}}>{s.sub}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="panel" style={{marginTop:14}}>
        <div className="panel-head">
          <div className="panel-title">Per-user overrides</div>
          <div className="panel-sub">Manually grant or restrict limits for individual accounts.</div>
        </div>
        <div className="panel-body">
          <table className="tbl">
            <thead>
              <tr><th>User</th><th>Override</th><th>Reason</th><th>Granted by</th><th>Expires</th><th></th></tr>
            </thead>
            <tbody>
              <tr><td>@maya_r · u_8821</td><td><span className="chip">unlimited likes</span></td><td>Influencer partnership Q2</td><td>Jordan P.</td><td className="mono muted">Jun 30</td><td><button className="btn ghost">revoke</button></td></tr>
              <tr><td>@kareem_b · u_3308</td><td><span className="chip warn">message rate-limited</span></td><td>Trust & safety · soft sanction</td><td>auto</td><td className="mono muted">7d remaining</td><td><button className="btn ghost">revoke</button></td></tr>
              <tr><td>@tara_w · u_5512</td><td><span className="chip">platinum (free)</span></td><td>Beta tester</td><td>Elena M.</td><td className="mono muted">no expiry</td><td><button className="btn ghost">revoke</button></td></tr>
              <tr><td>@niko_v · u_9991</td><td><span className="chip warn">match cap · 2</span></td><td>Reported behavior · monitoring</td><td>Priya V.</td><td className="mono muted">14d remaining</td><td><button className="btn ghost">revoke</button></td></tr>
            </tbody>
          </table>
          <div style={{padding:"12px 0 0 0"}}>
            <button className="btn"><Icons.plus size={13}/> Add override</button>
          </div>
        </div>
      </div>

      <div className="panel" style={{marginTop:14}}>
        <div className="panel-head">
          <div className="panel-title">Recent limit changes</div>
          <div className="panel-sub">Audit trail · last 30 days</div>
        </div>
        <div className="panel-body">
          <div className="audit-list">
            {[
              { d:"Apr 22 14:08", who:"Elena M.", what:"Free · likes-per-day", from:"15", to:"20", reason:"Q2 funnel test"},
              { d:"Apr 19 09:12", who:"Jordan P.", what:"Gold · super-likes/wk", from:"3", to:"5", reason:"Match competitor parity"},
              { d:"Apr 14 17:44", who:"Elena M.", what:"Plus · price", from:"$5.99", to:"$6.99", reason:"Price test cohort A"},
              { d:"Apr 09 11:30", who:"system", what:"All tiers · ads", from:"on", to:"on", reason:"weekly health check"},
              { d:"Apr 03 16:22", who:"Priya V.", what:"Free · messages/day", from:"50", to:"30", reason:"reduce spam volume"},
            ].map((e,i)=>(
              <div key={i} className="audit-row">
                <span className="mono muted" style={{fontSize:11.5,width:110}}>{e.d}</span>
                <span style={{width:90}}>{e.who}</span>
                <span style={{flex:1,fontWeight:500}}>{e.what}</span>
                <span className="mono muted" style={{fontSize:12}}>{e.from}</span>
                <span className="muted">→</span>
                <span className="mono" style={{fontSize:12,color:"var(--ok)"}}>{e.to}</span>
                <span className="muted" style={{fontSize:11.5,width:200,textAlign:"right"}}>{e.reason}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

window.PlansSection = PlansSection;
