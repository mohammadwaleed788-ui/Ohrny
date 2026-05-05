// Feed — swipe on real users as the operated persona

function Feed({ persona }){
  const feedSeed = useMemo(()=>makeFeed(persona.id), [persona.id]);
  const [stack, setStack] = useState(feedSeed);
  const [fb, setFb] = useState(null);
  const [matches, setMatches] = useState([]);
  const top = stack[0];

  function swipe(dir){
    if(!top) return;
    setFb({dir, id:top.id});
    setTimeout(()=>{
      setStack(s=>s.slice(1));
      setFb(null);
      if(dir==="like" && Math.random()>0.4){
        setMatches(m=>[{...top, t:"just now"}, ...m]);
      }
      if(dir==="super"){
        setMatches(m=>[{...top, t:"just now", sup:true}, ...m]);
      }
    },320);
  }

  function reload(){ setStack(feedSeed); setMatches([]); }

  return (
    <div className="feed">
      <div className="feed-stage">
        <div className="row" style={{gap:8}}>
          <span className="chip">acting as {persona.name}</span>
          <span className="chip info">live · real users</span>
          <span className="chip warn">engagement logged</span>
        </div>

        {top && (
          <div className="big-card" style={{
            background:`linear-gradient(160deg, oklch(0.55 0.12 ${top.hue}), oklch(0.30 0.10 ${(top.hue+70)%360}))`,
            transition:"transform .3s ease, opacity .3s ease",
            transform: fb?.id===top.id
              ? (fb.dir==="like" ? "translate(40%,-6%) rotate(12deg)"
                : fb.dir==="nope" ? "translate(-40%,-6%) rotate(-12deg)"
                : "translateY(-60%) scale(.96)")
              : "none",
            opacity: fb?.id===top.id ? 0.2 : 1,
          }}>
            <div className="stripes"/>
            <div className="info">
              <div className="nameline">{top.name}, {top.age}</div>
              <div className="subline">{top.distance} away · {top.neighborhood}</div>
              <div className="biobox">{top.bio}</div>
              <div className="pills">{top.pills.map(p=><span key={p}>{p}</span>)}</div>
            </div>
            {fb?.id===top.id && fb.dir==="like" && <div className="stamp like">LIKE</div>}
            {fb?.id===top.id && fb.dir==="nope" && <div className="stamp nope">NOPE</div>}
            {fb?.id===top.id && fb.dir==="super" && <div className="stamp super">SUPER</div>}
          </div>
        )}

        {!top && (
          <div className="big-card" style={{background:"var(--bg-elev)",color:"var(--text-dim)",textAlign:"center",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontSize:15}}>You've reached the end of the feed.</div>
            <button className="btn" style={{marginTop:14}} onClick={reload}>Reload</button>
          </div>
        )}

        {top && (
          <div className="feed-controls">
            <button className="fb nope" onClick={()=>swipe("nope")}><Icons.x size={22}/></button>
            <button className="fb super" onClick={()=>swipe("super")}><Icons.star size={18}/></button>
            <button className="fb like" onClick={()=>swipe("like")}><Icons.heart size={20}/></button>
          </div>
        )}
      </div>

      <div className="feed-side">
        <div className="section-card">
          <div className="section-title">Filters</div>
          <div className="col" style={{gap:10,fontSize:12.5}}>
            <div className="row" style={{justifyContent:"space-between"}}><span className="dim">Distance</span><span className="mono">25 mi</span></div>
            <div className="row" style={{justifyContent:"space-between"}}><span className="dim">Age</span><span className="mono">26 – 36</span></div>
            <div className="row" style={{justifyContent:"space-between"}}><span className="dim">Verified only</span><span className="chip ok">on</span></div>
            <div className="row" style={{justifyContent:"space-between"}}><span className="dim">Intent</span><span>Long-term</span></div>
            <hr className="div"/>
            <button className="btn"><Icons.filter size={13}/> Edit filters</button>
          </div>
        </div>

        <div className="section-card">
          <div className="section-title">New matches <span className="chip accent" style={{marginLeft:6}}>{matches.length}</span></div>
          {matches.length===0 && <div className="muted" style={{fontSize:12,padding:"10px 0"}}>Swipe right to match.</div>}
          <div className="col" style={{gap:8}}>
            {matches.map(m=>(
              <div key={m.id} className="row" style={{gap:10,padding:8,background:"var(--bg-elev-2)",borderRadius:8}}>
                <div className="pavatar" style={{width:36,height:36,background:`linear-gradient(135deg, oklch(0.60 0.14 ${m.hue}), oklch(0.35 0.12 ${(m.hue+70)%360}))`}}>
                  <span className="init">{m.name[0]}</span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:500}}>{m.name}{m.sup && <span className="chip info" style={{marginLeft:6}}>super</span>}</div>
                  <div className="muted" style={{fontSize:11}}>{m.t} · {m.neighborhood}</div>
                </div>
                <button className="btn" style={{fontSize:12,padding:"4px 8px"}}>Open chat</button>
              </div>
            ))}
          </div>
        </div>

        <div className="section-card">
          <div className="section-title">Session</div>
          <div className="col" style={{gap:6,fontSize:12.5}}>
            <div className="row" style={{justifyContent:"space-between"}}><span className="dim">Swiped</span><span className="mono">{feedSeed.length - stack.length} / {feedSeed.length}</span></div>
            <div className="row" style={{justifyContent:"space-between"}}><span className="dim">Right-swipe rate</span><span className="mono">38%</span></div>
            <div className="row" style={{justifyContent:"space-between"}}><span className="dim">Daily swipe cap</span><span className="mono">60 / 120</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Feed = Feed;
