// Profile editor — all persona fields, photo slots, live preview

function TagInput({ tags, onChange }){
  const [v, setV] = useState("");
  function add(){
    const t = v.trim();
    if(!t) return;
    if(!tags.includes(t)) onChange([...tags, t]);
    setV("");
  }
  return (
    <div className="tag-input">
      {tags.map(t=>(
        <span key={t} className="tag">{t}<span className="x" onClick={()=>onChange(tags.filter(x=>x!==t))}><Icons.close size={10}/></span></span>
      ))}
      <input placeholder="add interest + Enter" value={v}
        onChange={e=>setV(e.target.value)}
        onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();add();}}}/>
    </div>
  );
}

function Editor({ persona, onChange }){
  const set = (k,v)=>onChange({...persona, [k]:v});
  return (
    <div className="editor">
      <div className="editor-main">
        <div className="section-card">
          <div className="section-title"><Icons.users size={14}/> Identity</div>
          <div className="section-sub">Publicly visible on the profile. Users see exactly what you enter here.</div>
          <div className="field-row">
            <div className="field">
              <label>Display name</label>
              <input value={persona.name} onChange={e=>set("name",e.target.value)}/>
            </div>
            <div className="field">
              <label>Age</label>
              <input type="number" min="18" max="99" value={persona.age} onChange={e=>set("age",+e.target.value)}/>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Gender</label>
              <select value={persona.gender} onChange={e=>set("gender",e.target.value)}>
                <option>Woman</option><option>Man</option><option>Non-binary</option><option>Trans woman</option><option>Trans man</option>
              </select>
            </div>
            <div className="field">
              <label>Orientation</label>
              <select value={persona.orientation} onChange={e=>set("orientation",e.target.value)}>
                <option>Straight</option><option>Gay</option><option>Lesbian</option><option>Bi</option><option>Pan</option><option>Queer</option><option>Asexual</option>
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field"><label>City</label><input value={persona.city} onChange={e=>set("city",e.target.value)}/></div>
            <div className="field"><label>Height</label><input value={persona.height} onChange={e=>set("height",e.target.value)}/></div>
          </div>
        </div>

        <div className="section-card">
          <div className="section-title"><Icons.image size={14}/> Photos <span className="muted" style={{fontWeight:400,fontSize:11}}>· {persona.photos} of 6</span></div>
          <div className="section-sub">Drag to reorder. First photo is the cover. Upload real licensed assets only — no stock, no AI-generated faces.</div>
          <div className="photos">
            {[0,1,2,3,4,5].map(i=>{
              const filled = i < persona.photos;
              return (
                <div key={i} className={"photo-slot "+(filled?"filled":"")} style={filled?{
                  background:`linear-gradient(${135+i*30}deg, oklch(0.55 0.13 ${(persona.hue+i*25)%360}), oklch(0.30 0.10 ${(persona.hue+i*25+60)%360}))`
                }:{}}>
                  {filled && <div className="stripes"/>}
                  {filled && <span className="num">{i+1}</span>}
                  {filled
                    ? <span className="rm" onClick={()=>set("photos",Math.max(1,persona.photos-1))}><Icons.close size={10}/></span>
                    : <span className="row gap-sm"><Icons.plus size={12}/> upload</span>}
                </div>
              );
            })}
          </div>
          <div className="row" style={{marginTop:10,gap:8}}>
            <button className="btn" onClick={()=>set("photos",Math.min(6,persona.photos+1))}><Icons.camera size={13}/> Add photo</button>
            <button className="btn ghost"><Icons.sparkle size={13}/> AI alt-text</button>
            <div style={{flex:1}}/>
            <span className="chip ok">no face-match conflicts</span>
          </div>
        </div>

        <div className="section-card">
          <div className="section-title"><Icons.edit size={14}/> Bio & prompts</div>
          <div className="field">
            <label>Bio</label>
            <textarea rows="3" value={persona.bio} onChange={e=>set("bio",e.target.value)} maxLength="280"/>
            <div className="muted" style={{fontSize:11,alignSelf:"flex-end"}}>{persona.bio.length}/280</div>
          </div>
          <div className="field-row">
            <div className="field"><label>Work</label><input value={persona.work} onChange={e=>set("work",e.target.value)}/></div>
            <div className="field"><label>Education</label><input value={persona.edu} onChange={e=>set("edu",e.target.value)}/></div>
          </div>
          <div className="field">
            <label>Interests</label>
            <TagInput tags={persona.interests} onChange={v=>set("interests",v)}/>
          </div>
        </div>

        <div className="section-card">
          <div className="section-title"><Icons.heart size={14}/> Relationship & lifestyle</div>
          <div className="field-row">
            <div className="field"><label>Relationship status</label>
              <select value={persona.relStatus} onChange={e=>set("relStatus",e.target.value)}>
                <option>Single</option><option>In a relationship</option><option>Dating around</option><option>Separated</option><option>Divorced</option><option>Married · open</option><option>Widowed</option><option>It's complicated</option>
              </select>
            </div>
            <div className="field"><label>Intent</label>
              <select value={persona.intent} onChange={e=>set("intent",e.target.value)}>
                <option>Long-term</option><option>Short-term open</option><option>Figuring it out</option><option>Casual</option><option>Marriage</option><option>Hookups</option>
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field"><label>Drinks</label>
              <select value={persona.drinks} onChange={e=>set("drinks",e.target.value)}>
                <option>Yes</option><option>Socially</option><option>Sometimes</option><option>Rarely</option><option>No</option>
              </select>
            </div>
            <div className="field"><label>Smokes</label>
              <select value={persona.smokes} onChange={e=>set("smokes",e.target.value)}>
                <option>No</option><option>Socially</option><option>Yes</option>
              </select>
            </div>
          </div>
          <div className="field"><label>Kids</label>
            <select value={persona.kids} onChange={e=>set("kids",e.target.value)}>
              <option>Wants</option><option>Wants someday</option><option>Open</option><option>Has kids</option><option>Has two</option><option>Doesn't want</option>
            </select>
          </div>
        </div>

        <div className="section-card">
          <div className="section-title"><Icons.sliders size={14}/> Matching preferences</div>
          <div className="field-row">
            <div className="field"><label>Interested in</label>
              <select defaultValue="Men"><option>Men</option><option>Women</option><option>Everyone</option></select>
            </div>
            <div className="field"><label>Age range</label><input defaultValue="26 – 36"/></div>
          </div>
          <div className="field-row">
            <div className="field"><label>Distance</label><input defaultValue="25 mi"/></div>
            <div className="field"><label>Boost schedule</label>
              <select defaultValue="Thu 8pm, Sun 10am"><option>Off</option><option>Thu 8pm, Sun 10am</option><option>Daily 7pm</option><option>Custom…</option></select>
            </div>
          </div>
        </div>

        <div className="row" style={{gap:8,marginTop:4}}>
          <button className="btn primary"><Icons.check size={13}/> Save changes</button>
          <button className="btn"><Icons.eye size={13}/> Preview as user</button>
          <div style={{flex:1}}/>
          <button className="btn danger"><Icons.ban size={13}/> Archive persona</button>
        </div>
      </div>

      <div className="editor-side">
        <div className="section-card">
          <div className="section-title">Live preview</div>
          <div className="section-sub">What users see in the feed.</div>
          <div className="preview-phone">
            <div className="notch"/>
            <div className="ph-photo" style={{background:`linear-gradient(160deg, oklch(0.55 0.13 ${persona.hue}), oklch(0.30 0.10 ${(persona.hue+70)%360}))`}}>
              <div className="stripes"/>
              <div className="meta">
                <div className="name">{persona.name}, {persona.age}</div>
                <div className="loc">{persona.city}</div>
              </div>
            </div>
            <div className="ph-body">
              <div className="bio">{persona.bio}</div>
              <div className="pills">
                {persona.interests.slice(0,6).map(t=><span key={t}>{t}</span>)}
              </div>
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="section-title">Governance</div>
          <div className="col" style={{gap:8,fontSize:12.5}}>
            <div className="row" style={{justifyContent:"space-between"}}><span className="dim">Created by</span><span>{persona.createdBy}</span></div>
            <div className="row" style={{justifyContent:"space-between"}}><span className="dim">Team</span><span>{persona.team}</span></div>
            <div className="row" style={{justifyContent:"space-between"}}><span className="dim">Verified badge</span><span className="chip ok">on</span></div>
            <div className="row" style={{justifyContent:"space-between"}}><span className="dim">Plan</span><span>{persona.plan}</span></div>
            <div className="row" style={{justifyContent:"space-between"}}><span className="dim">Disclosure in bio</span><span className="chip warn">required</span></div>
          </div>
          <hr className="div"/>
          <div className="muted" style={{fontSize:11.5,lineHeight:1.5}}>
            Operated profiles engage with real users. Every message is attributed to the team member who sent it. Required disclosure in profile footer per Ohrny policy v2.4.
          </div>
        </div>
      </div>
    </div>
  );
}

window.Editor = Editor;
