// Algorithm tuning — sliders + live preview

function AlgorithmSection(){
  const [weights, setWeights] = useState({
    distance: 70, attractiveness: 45, interests: 60, activity: 55,
    reciprocity: 75, age_similarity: 40, intent_match: 65, verified_boost: 50,
  });
  const [newUserBoost, setNewUserBoost] = useState(true);
  const [reciprocityLock, setReciprocityLock] = useState(true);
  const [safeMode, setSafeMode] = useState(false);

  function set(k,v){ setWeights(w=>({...w,[k]:v})); }

  // Preview: predicted match for a fake profile, influenced by weights
  const predictedRate = useMemo(()=>{
    const total = Object.values(weights).reduce((a,b)=>a+b,0);
    const norm = total/8;
    return Math.round(32 + norm*0.4);
  },[weights]);

  const previewCandidates = [
    {name:"Avery, 28",   fit:88, why:"4mi · 3 shared interests · active today"},
    {name:"Sasha, 31",   fit:81, why:"7mi · similar activity · reciprocated 2x"},
    {name:"Morgan, 26",  fit:73, why:"12mi · serious intent · verified"},
    {name:"River, 30",   fit:64, why:"18mi · different schedule · new"},
  ];

  return (
    <div className="section active">
      <PageHead title="Algorithm tuning"
        sub="Matching weights are applied in stages. Changes affect all users in the deployed region."
        actions={<>
          <button className="btn">Revert to default</button>
          <button className="btn">Save as preset</button>
          <button className="btn primary">Deploy changes</button>
        </>}/>

      <div className="grid-12">
        <div className="panel" style={{gridColumn:"span 8"}}>
          <div className="panel-head">
            <div className="panel-title">Ranking weights</div>
            <div className="panel-sub">Relative influence on match-queue ordering · must sum reasonably</div>
          </div>
          <div className="panel-body col" style={{gap:16}}>
            {[
              ["distance",       "Distance proximity",       "Closer candidates rank higher"],
              ["attractiveness", "Attractiveness signal",    "Blended photo + swipe ratio (regulated)"],
              ["interests",      "Shared interests",         "Tags, prompts, music taste"],
              ["activity",       "Activity level",           "Active last 48h > inactive"],
              ["reciprocity",    "Reciprocity prior",        "Likely to swipe back"],
              ["age_similarity", "Age similarity",           "Within ±5 years preferred"],
              ["intent_match",   "Intent match",             "Casual vs serious alignment"],
              ["verified_boost", "Verified boost",           "Surface verified profiles"],
            ].map(([k,l,sub])=>(
              <div key={k} style={{display:"grid",gridTemplateColumns:"220px 1fr 50px",alignItems:"center",gap:16}}>
                <div>
                  <div style={{fontSize:13,fontWeight:500}}>{l}</div>
                  <div className="muted" style={{fontSize:11.5}}>{sub}</div>
                </div>
                <input type="range" min="0" max="100" step="1" className="slider"
                  value={weights[k]} onChange={e=>set(k,+e.target.value)}/>
                <span className="mono right" style={{color:weights[k]>70?"var(--accent)":"var(--text)"}}>{weights[k]}</span>
              </div>
            ))}

            <hr className="div"/>

            <div className="row" style={{justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:13,fontWeight:500}}>New-user boost (first 48h)</div>
                <div className="muted" style={{fontSize:11.5}}>Surface fresh profiles to 3× more viewers</div>
              </div>
              <div className={"switch "+(newUserBoost?"on":"")} onClick={()=>setNewUserBoost(v=>!v)}/>
            </div>
            <div className="row" style={{justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:13,fontWeight:500}}>Reciprocity lock</div>
                <div className="muted" style={{fontSize:11.5}}>Prevent extreme-popularity one-way feeds</div>
              </div>
              <div className={"switch "+(reciprocityLock?"on":"")} onClick={()=>setReciprocityLock(v=>!v)}/>
            </div>
            <div className="row" style={{justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:13,fontWeight:500}}>Safe mode (manual approvals)</div>
                <div className="muted" style={{fontSize:11.5}}>Freeze auto-tuning · requires 2-person review</div>
              </div>
              <div className={"switch "+(safeMode?"on":"")} onClick={()=>setSafeMode(v=>!v)}/>
            </div>
          </div>
        </div>

        <div className="col" style={{gridColumn:"span 4",gap:14}}>
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Live simulation</div>
              <div className="panel-sub">Sample user · F, 28, Brooklyn</div>
            </div>
            <div className="panel-body">
              <div className="row" style={{justifyContent:"space-between",marginBottom:12}}>
                <div>
                  <div className="muted" style={{fontSize:11,letterSpacing:".06em",textTransform:"uppercase"}}>Predicted match / session</div>
                  <div className="mono" style={{fontSize:28,fontWeight:600,marginTop:4}}>{predictedRate}<span style={{fontSize:16,color:"var(--text-mute)"}}>%</span></div>
                </div>
                <Sparkline data={[28,30,31,33,34,35,predictedRate]} w={80} h={36}/>
              </div>
              <div className="col" style={{gap:8}}>
                {previewCandidates.map(c=>(
                  <div key={c.name} className="row" style={{gap:10,padding:"8px 10px",background:"var(--bg-elev-2)",borderRadius:8}}>
                    <PhotoAvatar name={c.name} hue={(c.name.charCodeAt(0)*13)%360} size={30}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:500}}>{c.name}</div>
                      <div className="muted" style={{fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.why}</div>
                    </div>
                    <span className="mono" style={{fontSize:13,color:c.fit>80?"var(--ok)":c.fit>65?"var(--warn)":"var(--text-dim)"}}>{c.fit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Guardrails</div>
            </div>
            <div className="panel-body col" style={{gap:10,fontSize:12.5}}>
              <div className="row" style={{justifyContent:"space-between"}}><span className="dim">Max queue skew</span><span className="mono">0.35</span></div>
              <div className="row" style={{justifyContent:"space-between"}}><span className="dim">Demographic parity Δ</span><span className="mono" style={{color:"var(--ok)"}}>±2.1%</span></div>
              <div className="row" style={{justifyContent:"space-between"}}><span className="dim">Protected-class audit</span><span className="chip ok"><Icons.check size={11}/> Passing</span></div>
              <div className="row" style={{justifyContent:"space-between"}}><span className="dim">Last A/B vs control</span><span className="mono" style={{color:"var(--ok)"}}>+4.8%</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.AlgorithmSection = AlgorithmSection;
