// Inbox — handles 1000+ threads with country/city filtering, sort by unread

function Inbox({ persona }){
  const threads = useMemo(()=>makeThreads(persona.id, persona.hue), [persona.id]);

  const [filter, setFilter]   = useState("all");      // all | unread | flagged
  const [sortBy, setSortBy]   = useState("unread");   // unread | recent | flagged
  const [search, setSearch]   = useState("");
  const [selected, setSelected] = useState(threads[0]?.id);
  const [draft, setDraft] = useState({});
  const [messages, setMessages] = useState({});
  const [shown, setShown] = useState(80); // pagination cap
  const scrollRef = useRef(null);
  const listRef = useRef(null);

  useEffect(()=>{
    setSelected(null);
    setShown(80);
  },[persona.id]);

  // Apply filters + sort. With 1000+ threads, recompute only when inputs change.
  const filtered = useMemo(()=>{
    let out = threads;
    if(filter==="unread")  out = out.filter(t=>t.unread>0);
    if(filter==="flagged") out = out.filter(t=>t.flagged);
    if(search){
      const q = search.toLowerCase();
      out = out.filter(t=>t.name.toLowerCase().includes(q) || t.handle.toLowerCase().includes(q) || t.preview.toLowerCase().includes(q));
    }
    out = [...out].sort((a,b)=>{
      if(sortBy==="unread")  return b.unread - a.unread || a.timeRank - b.timeRank;
      if(sortBy==="recent")  return a.timeRank - b.timeRank || b.unread - a.unread;
      if(sortBy==="flagged") return (b.flagged-a.flagged) || (b.unread - a.unread);
      return 0;
    });
    return out;
  },[threads, filter, search, sortBy]);

  // Auto-pick first visible thread when filter/sort changes
  useEffect(()=>{
    if(filtered.length>0 && (!selected || !filtered.find(t=>t.id===selected))){
      setSelected(filtered[0].id);
    }
    setShown(80);
    if(listRef.current) listRef.current.scrollTop = 0;
  },[filter, search, sortBy, persona.id]);

  // Lazy load more on scroll
  function onListScroll(e){
    const el = e.currentTarget;
    if(el.scrollTop + el.clientHeight > el.scrollHeight - 200){
      setShown(s=>Math.min(s+80, filtered.length));
    }
  }

  const visible = filtered.slice(0, shown);
  const current = threads.find(t=>t.id===selected);
  const msgs = messages[current?.id] || current?.messages || [];
  const d = draft[current?.id] || "";

  useEffect(()=>{
    if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  },[current?.id, msgs.length]);

  const totalUnread = useMemo(()=>threads.reduce((s,t)=>s+t.unread,0),[threads]);
  const totalFlagged = useMemo(()=>threads.filter(t=>t.flagged).length,[threads]);

  function send(){
    if(!d.trim() || !current) return;
    const newMsg = { id:Math.random().toString(36).slice(2,8), f:"mine", t:d, tt:"just now" };
    setMessages(m=>({...m, [current.id]: [...msgs, newMsg]}));
    setDraft(x=>({...x, [current.id]:""}));
    setTimeout(()=>{
      const replies = ["haha fair","love that","tell me more","okay sold","lol ok","wait really?","same","when are you free"];
      const r = replies[Math.floor(Math.random()*replies.length)];
      setMessages(m=>{
        const now = m[current.id] || msgs;
        return {...m, [current.id]: [...now, { id:Math.random().toString(36).slice(2,8), f:"them", t:r, tt:"just now" }]};
      });
    }, 1400 + Math.random()*1600);
  }

  function useSuggestion(kind){
    const user = current.name.split(" ")[0];
    const map = {
      "Keep it playful": `honestly that tracks`,
      "Ask a question": `okay real question — what's the last thing you got way too into?`,
      "Propose meeting up": `want to grab a coffee this weekend?`,
      "Check in after silence": `hey ${user}, you disappeared on me. still around?`,
      "Share a small story": `ok so I just spent 40 minutes picking out a pen. I'm a mess. how was your day`,
    };
    setDraft(x=>({...x, [current.id]: map[kind]}));
  }

  return (
    <div className="inbox">
      <div className="inbox-list">
        <div className="inbox-toolbar">
          <div className="inbox-search">
            <Icons.search size={13}/>
            <input placeholder="Search name, handle, message…" value={search} onChange={e=>setSearch(e.target.value)}/>
            {search && <span className="clearx" onClick={()=>setSearch("")}><Icons.close size={11}/></span>}
          </div>
          <div className="seg" style={{flexShrink:0}}>
            {[["all","All", threads.length],["unread","Unread", totalUnread],["flagged","Flagged", totalFlagged]].map(([k,l,n])=>(
              <button key={k} className={filter===k?"on":""} onClick={()=>setFilter(k)}>{l}<span className="seg-num">{n}</span></button>
            ))}
          </div>
          <select className="sortsel" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
            <option value="unread">Sort · Most unread</option>
            <option value="recent">Sort · Most recent</option>
            <option value="flagged">Sort · Flagged first</option>
          </select>
        </div>

        <div className="inbox-meta">
          <span className="mono">{filtered.length.toLocaleString()} of {threads.length.toLocaleString()} chats</span>
          <span>·</span>
          <span className="mono">{filtered.reduce((s,t)=>s+t.unread,0).toLocaleString()} unread</span>
        </div>

        <div className="inbox-scroll" ref={listRef} onScroll={onListScroll}>
          {visible.map(t=>(
            <div key={t.id} className={"thread-item "+(selected===t.id?"on":"")} onClick={()=>setSelected(t.id)}>
              <div className="pavatar" style={{width:40,height:40,background:`linear-gradient(135deg, oklch(0.60 0.14 ${t.hue}), oklch(0.35 0.12 ${(t.hue+70)%360}))`}}>
                <span className="init">{t.name[0]}</span>
              </div>
              <div style={{minWidth:0,flex:1}}>
                <div className="row" style={{gap:6}}>
                  <span className="tname">{t.name}</span>
                  {t.flagged && <span className="tflagdot" title="Flagged"/>}
                </div>
                <div className="tpreview">{t.preview}</div>
              </div>
              <div className="tmeta">
                <span className="ttime">{t.time}</span>
                {t.unread>0 && <span className={"tunread "+(t.unread>=7?"hot":t.unread>=3?"warm":"")}>{t.unread}</span>}
              </div>
            </div>
          ))}
          {filtered.length===0 && <div className="empty">No conversations match.</div>}
          {visible.length < filtered.length && (
            <div className="muted" style={{textAlign:"center",padding:"10px 0",fontSize:11}}>
              showing {visible.length.toLocaleString()} of {filtered.length.toLocaleString()} · scroll for more
            </div>
          )}
        </div>
      </div>

      <div className="chat-panel">
        {!current && <div className="empty">Pick a conversation.</div>}
        {current && <>
          <div className="chat-head">
            <div className="pavatar" style={{background:`linear-gradient(135deg, oklch(0.60 0.14 ${current.hue}), oklch(0.35 0.12 ${(current.hue+70)%360}))`}}>
              <span className="init">{current.name[0]}</span>
            </div>
            <div className="chat-head-info">
              <div className="chat-head-name">
                {current.name} <span className="muted mono" style={{fontSize:11,fontWeight:400}}>· {current.age}</span>
              </div>
              <div className="chat-head-sub">{current.handle} · matched {current.matchedOn}</div>
            </div>
            <div className="chat-meta">
              <span className="chip ok">verified</span>
              {current.flagged && <span className="chip warn">escalation</span>}
              <button className="top-btn" title="Open user in admin"><Icons.external size={13}/></button>
              <button className="top-btn" title="More"><Icons.more size={14}/></button>
            </div>
          </div>
          <div className="chat-context">
            <span><span className="k">Last active</span> · {current.time}</span>
            <span><span className="k">Matched</span> · {current.matchedOn}</span>
            <span><span className="k">Compat</span> · 82%</span>
          </div>
          <div className="chat-scroll" ref={scrollRef}>
            <div className="day-sep">Conversation start · matched {current.matchedOn}</div>
            {msgs.map(m=>(
              <div key={m.id} className={"msg-wrap "+(m.f==="mine"?"mine":"theirs")}>
                <div className={"msg "+(m.f==="mine"?"mine":"theirs")}>{m.t}</div>
                <div className="msg-meta">{m.f==="mine"?`${persona.name.split(" ")[0]} (${persona.team}) · `:""}{m.tt}</div>
              </div>
            ))}
          </div>
          <div className="composer">
            <div className="ai-chips">
              <span className="muted" style={{fontSize:11,marginRight:2}}>Suggest:</span>
              {AI_SUGGESTIONS.map(s=>(
                <span key={s} className="ai-chip" onClick={()=>useSuggestion(s)}>{s}</span>
              ))}
            </div>
            <div className="composer-input-row">
              <textarea className="composer-input"
                placeholder={`Reply as ${persona.name.split(" ")[0]}…`}
                value={d}
                onChange={e=>setDraft(x=>({...x, [current.id]: e.target.value}))}
                onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); send(); } }}
                rows={2}/>
              <button className="btn primary" onClick={send} disabled={!d.trim()}>
                <Icons.send size={13}/> Send
              </button>
            </div>
            <div className="composer-tools">
              <button className="btn ghost" title="Attach photo"><Icons.image size={13}/></button>
              <button className="btn ghost" title="GIF">GIF</button>
              <button className="btn ghost" title="Schedule"><Icons.cal size={13}/></button>
              <div style={{flex:1}}/>
              <span className="compose-bar-meta">
                <span>acting as <b style={{color:"var(--text)"}}>{persona.name}</b></span>
                <span>·</span>
                <span>keystrokes logged</span>
                <span>·</span>
                <span>⏎ send · ⇧⏎ newline</span>
              </span>
            </div>
          </div>
        </>}
      </div>
    </div>
  );
}

window.Inbox = Inbox;
