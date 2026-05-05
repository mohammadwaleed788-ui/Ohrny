// Tweaks panel + Edit-mode handshake

function TweaksPanel({open, onClose, state, onChange}){
  const accents = [
    ["coral","oklch(0.72 0.15 25)"],
    ["violet","oklch(0.68 0.18 300)"],
    ["emerald","oklch(0.72 0.14 155)"],
    ["azure","oklch(0.72 0.14 240)"],
    ["amber","oklch(0.80 0.15 80)"],
  ];
  return (
    <div className={"tweaks "+(open?"open":"")}>
      <div className="tweaks-head">
        <span className="row gap-sm"><Icons.tweak size={14}/> Tweaks</span>
        <button className="top-btn" style={{width:26,height:26}} onClick={onClose}><Icons.close size={12}/></button>
      </div>
      <div className="tweaks-body">
        <div className="tweak-row">
          <span>Accent color</span>
          <div className="swatches">
            {accents.map(([k,c])=>(
              <div key={k} className={"sw "+(state.accent===k?"on":"")}
                style={{background:c}}
                onClick={()=>onChange({accent:k})}/>
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <span>Density</span>
          <div className="seg">
            <button className={state.density==="comfortable"?"on":""} onClick={()=>onChange({density:"comfortable"})}>Cozy</button>
            <button className={state.density==="compact"?"on":""} onClick={()=>onChange({density:"compact"})}>Dense</button>
          </div>
        </div>
        <div className="tweak-row">
          <span>Sidebar</span>
          <div className="seg">
            <button className={state.sidebar==="expanded"?"on":""} onClick={()=>onChange({sidebar:"expanded"})}>Expanded</button>
            <button className={state.sidebar==="collapsed"?"on":""} onClick={()=>onChange({sidebar:"collapsed"})}>Collapsed</button>
          </div>
        </div>
        <div className="tweak-row">
          <span>Default range</span>
          <div className="seg">
            {["24h","7d","30d"].map(r=>(
              <button key={r} className={state.range===r?"on":""} onClick={()=>onChange({range:r})}>{r}</button>
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <span>Show live stream</span>
          <div className={"switch "+(state.liveStream?"on":"")} onClick={()=>onChange({liveStream:!state.liveStream})}/>
        </div>
      </div>
    </div>
  );
}

window.TweaksPanel = TweaksPanel;
