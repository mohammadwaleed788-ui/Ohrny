// Login screen with 3-step security: credentials → authenticator app → SMS code

function LoginScreen({ onAuth }){
  const [step, setStep] = useState("credentials"); // credentials | totp | sms | success
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [sms, setSms] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [smsCooldown, setSmsCooldown] = useState(0);

  function submitCredentials(e){
    e.preventDefault();
    setErr("");
    if(!email || !password){ setErr("Enter your email and password."); return; }
    setLoading(true);
    setTimeout(()=>{ setLoading(false); setStep("totp"); setTotp(""); },650);
  }

  function submitTotp(e){
    e && e.preventDefault();
    if(totp.length !== 6){ setErr("Enter the 6-digit code from your authenticator."); return; }
    setErr("");
    setLoading(true);
    setTimeout(()=>{
      setLoading(false);
      setStep("sms");
      setSms("");
      setSmsCooldown(30);
    },700);
  }

  function submitSms(e){
    e && e.preventDefault();
    if(sms.length !== 6){ setErr("Enter the 6-digit SMS code."); return; }
    setErr("");
    setLoading(true);
    setTimeout(()=>{ setLoading(false); setStep("success"); setTimeout(onAuth, 600); },700);
  }

  // sms resend cooldown
  useEffect(()=>{
    if(smsCooldown<=0) return;
    const t = setTimeout(()=>setSmsCooldown(c=>c-1), 1000);
    return ()=>clearTimeout(t);
  },[smsCooldown]);

  const stepIdx = step==="credentials"?0 : step==="totp"?1 : step==="sms"?2 : 3;

  return (
    <div className="login-root">
      <div className="login-gradient"/>
      <div className="login-grid"/>

      <div className="login-brand">
        <Icons.logo size={32}/>
        <div>
          <div style={{fontWeight:700, letterSpacing:"-.01em"}}>Ohrny</div>
          <div className="mono" style={{fontSize:11,color:"var(--text-mute)"}}>admin · secure area</div>
        </div>
      </div>

      <div className="login-card-wrap">
        <div className="login-card">
          {/* 3-step meter */}
          <div className="login-steps">
            {[
              ["Credentials", 0],
              ["Authenticator", 1],
              ["SMS code", 2],
            ].map(([label, i], idx)=>(
              <React.Fragment key={label}>
                {idx>0 && <div className="login-step-bar"/>}
                <div className={"login-step "+(stepIdx===i?"on": stepIdx>i?"done":"")}>
                  <span className="login-step-dot">{stepIdx>i?<Icons.check size={11}/>:(i+1)}</span>
                  <span>{label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {step==="credentials" && (
            <form onSubmit={submitCredentials} className="col" style={{gap:18,marginTop:22}}>
              <div>
                <div className="login-title">Sign in to the admin console</div>
                <div className="muted" style={{fontSize:13,marginTop:4}}>
                  Restricted access. All sessions are logged and attributable.
                </div>
              </div>

              <label className="login-field">
                <span>Work email</span>
                <input type="email" placeholder="you@ohrny.com" value={email}
                  onChange={e=>setEmail(e.target.value)} autoFocus/>
              </label>
              <label className="login-field">
                <span>Password</span>
                <input type="password" placeholder="••••••••••••" value={password}
                  onChange={e=>setPassword(e.target.value)}/>
              </label>

              <div className="row" style={{justifyContent:"space-between"}}>
                <label className="row gap-sm" style={{fontSize:12.5,color:"var(--text-dim)",cursor:"pointer"}}>
                  <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>
                  Trust this device for 7 days
                </label>
              </div>

              {err && <div className="login-err"><Icons.ban size={13}/> {err}</div>}

              <button className="btn primary" style={{justifyContent:"center",padding:"10px 14px"}} disabled={loading}>
                {loading ? <span className="spinner"/> : <>Continue <Icons.chevron size={13}/></>}
              </button>

              <div className="login-foot">
                <span className="row gap-sm"><Icons.shield size={13}/> SOC 2 · GDPR · HIPAA-aligned</span>
                <span className="mono" style={{fontSize:11,color:"var(--text-mute)"}}>prod-us-east-1</span>
              </div>
            </form>
          )}

          {step==="totp" && (
            <form onSubmit={submitTotp} className="col" style={{gap:18,marginTop:22}}>
              <div>
                <div className="login-title">Authenticator code</div>
                <div className="muted" style={{fontSize:13,marginTop:4}}>
                  Signed in as <span className="mono">{email || "you@ohrny.com"}</span>. Enter the 6-digit
                  code from your authenticator app.
                </div>
              </div>

              <div className="twofa-context">
                <div className="twofa-context-icon"><Icons.shield size={18}/></div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:500,fontSize:13}}>Ohrny Authenticator · TOTP</div>
                  <div className="muted" style={{fontSize:11.5}}>Code refreshes every 30s</div>
                </div>
                <span className="chip accent">step 2 of 3</span>
              </div>

              <OtpField value={totp} onChange={setTotp} onComplete={()=>setTimeout(submitTotp, 120)}/>

              {err && <div className="login-err"><Icons.ban size={13}/> {err}</div>}

              <button className="btn primary" style={{justifyContent:"center",padding:"10px 14px"}} disabled={loading}>
                {loading ? <span className="spinner"/> : <>Verify <Icons.chevron size={13}/></>}
              </button>
              <button type="button" className="btn ghost" style={{justifyContent:"center"}} onClick={()=>{setStep("credentials");setErr("")}}>
                <Icons.chevL size={12}/> Back
              </button>

              <div className="login-foot">
                <span className="row gap-sm"><Icons.shield size={13}/> Required by admin policy</span>
                <a href="#" className="login-link">Lost your device?</a>
              </div>
            </form>
          )}

          {step==="sms" && (
            <form onSubmit={submitSms} className="col" style={{gap:18,marginTop:22}}>
              <div>
                <div className="login-title">SMS verification</div>
                <div className="muted" style={{fontSize:13,marginTop:4}}>
                  Final step. We sent a code to <span className="mono">+1 ••• ••• 4912</span>.
                </div>
              </div>

              <div className="twofa-context">
                <div className="twofa-context-icon"><Icons.send size={16}/></div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:500,fontSize:13}}>SMS to •••• 4912</div>
                  <div className="muted" style={{fontSize:11.5}}>
                    {smsCooldown>0
                      ? `Resend available in ${smsCooldown}s`
                      : "Didn't get it? Resend now."}
                  </div>
                </div>
                <span className="chip accent">step 3 of 3</span>
              </div>

              <OtpField value={sms} onChange={setSms} onComplete={()=>setTimeout(submitSms, 120)}/>

              {err && <div className="login-err"><Icons.ban size={13}/> {err}</div>}

              <button className="btn primary" style={{justifyContent:"center",padding:"10px 14px"}} disabled={loading}>
                {loading ? <span className="spinner"/> : <>Verify and sign in <Icons.chevron size={13}/></>}
              </button>
              <div className="row" style={{justifyContent:"space-between"}}>
                <button type="button" className="btn ghost" style={{fontSize:12}} onClick={()=>{setStep("totp");setErr("")}}>
                  <Icons.chevL size={12}/> Back
                </button>
                <button type="button" className="btn ghost" style={{fontSize:12}}
                  disabled={smsCooldown>0}
                  onClick={()=>{setSmsCooldown(30); setErr("")}}>
                  Resend SMS
                </button>
              </div>

              <div className="login-foot">
                <span className="row gap-sm"><Icons.shield size={13}/> 3-step verification required</span>
              </div>
            </form>
          )}

          {step==="success" && (
            <div className="col" style={{gap:14,alignItems:"center",padding:"30px 0"}}>
              <div className="login-check">
                <Icons.check size={28}/>
              </div>
              <div className="login-title" style={{textAlign:"center"}}>Welcome back</div>
              <div className="muted" style={{textAlign:"center",fontSize:13}}>
                Opening the admin console…
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .login-root{
          position:fixed;inset:0;background:var(--bg);
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          padding:32px;overflow:auto;
        }
        .login-gradient{
          position:absolute;inset:-10%;pointer-events:none;z-index:0;
          background:
            radial-gradient(60% 40% at 70% 20%, oklch(0.72 0.15 25 / .12), transparent 60%),
            radial-gradient(40% 30% at 15% 80%, oklch(0.72 0.14 240 / .10), transparent 60%);
          filter:blur(10px);
        }
        .login-grid{
          position:absolute;inset:0;pointer-events:none;z-index:0;opacity:.5;
          background-image:
            linear-gradient(var(--line-soft) 1px, transparent 1px),
            linear-gradient(90deg, var(--line-soft) 1px, transparent 1px);
          background-size:48px 48px;
          mask-image: radial-gradient(closest-side at center, black 30%, transparent 75%);
        }
        .login-brand{
          position:absolute;top:24px;left:28px;display:flex;align-items:center;gap:10px;z-index:2;
        }
        .login-card-wrap{position:relative;z-index:2;width:100%;max-width:460px;display:flex;flex-direction:column;align-items:center;gap:12px}
        .login-card{
          width:100%;background:var(--bg-elev);border:1px solid var(--line);
          border-radius:14px;padding:28px;box-shadow:0 40px 80px -40px rgba(0,0,0,.8);
        }
        .login-title{font-size:20px;font-weight:700;letter-spacing:-.015em}
        .login-steps{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--text-mute)}
        .login-step{display:flex;align-items:center;gap:8px;white-space:nowrap}
        .login-step.on{color:var(--text)}
        .login-step.done{color:var(--ok)}
        .login-step-dot{
          width:22px;height:22px;border-radius:50%;
          background:var(--bg-elev-2);border:1px solid var(--line);
          display:inline-flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:11px;font-weight:600;flex:none;
        }
        .login-step.on .login-step-dot{background:var(--accent-soft);color:var(--accent);border-color:transparent}
        .login-step.done .login-step-dot{background:var(--ok-soft);color:var(--ok);border-color:transparent}
        .login-step-bar{flex:1;height:1px;background:var(--line-soft);min-width:10px}
        .login-field{display:flex;flex-direction:column;gap:6px}
        .login-field > span{font-size:11.5px;color:var(--text-mute);letter-spacing:.06em;text-transform:uppercase;font-weight:600}
        .login-field input{
          background:var(--bg-elev-2);border:1px solid var(--line-soft);color:var(--text);
          padding:11px 12px;border-radius:8px;font-size:14px;outline:0;transition:border-color .15s, box-shadow .15s;
        }
        .login-field input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
        .login-link{color:var(--accent);font-size:12.5px}
        .login-link:hover{text-decoration:underline}
        .login-err{
          display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;
          background:var(--bad-soft);color:var(--bad);font-size:12.5px;
        }
        .login-foot{
          margin-top:4px;display:flex;justify-content:space-between;color:var(--text-mute);
          font-size:11.5px;padding-top:14px;border-top:1px solid var(--line-soft);
        }
        .twofa-context{
          display:flex;align-items:center;gap:10px;
          padding:10px 12px;border:1px solid var(--line-soft);border-radius:8px;
          background:var(--bg-elev-2);
        }
        .twofa-context-icon{
          width:32px;height:32px;border-radius:8px;flex:none;
          background:var(--accent-soft);color:var(--accent);
          display:inline-flex;align-items:center;justify-content:center;
        }
        .otp-row{display:flex;gap:8px;justify-content:flex-start}
        .otp-input{
          width:48px;height:56px;text-align:center;font-size:22px;font-family:var(--font-mono);font-weight:600;
          background:var(--bg-elev-2);border:1px solid var(--line-soft);border-radius:8px;color:var(--text);
          outline:0;transition:border-color .15s, box-shadow .15s;padding:0;flex:none;
        }
        .otp-input::-webkit-outer-spin-button,
        .otp-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
        .otp-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
        .login-check{
          width:64px;height:64px;border-radius:50%;
          background:var(--ok-soft);color:var(--ok);
          display:flex;align-items:center;justify-content:center;
        }
        .spinner{
          width:14px;height:14px;border-radius:50%;
          border:2px solid rgba(255,255,255,.4);border-top-color:#111;animation:spin .7s linear infinite;
        }
        @keyframes spin { to { transform:rotate(360deg) } }
      `}</style>
    </div>
  );
}

// Isolated OTP field — uses a single controlled string to avoid per-cell state races
function OtpField({ value, onChange, onComplete }){
  const refs = useRef([]);
  const digits = Array.from({length:6}, (_,i)=>value[i] || "");

  function setAt(i, ch){
    ch = ch.replace(/\D/g,"").slice(0,1);
    const arr = digits.slice();
    arr[i] = ch;
    const next = arr.join("").slice(0,6);
    onChange(next);
    if(ch && i<5) refs.current[i+1]?.focus();
    if(next.length===6 && onComplete) onComplete();
  }
  function handleKey(i, e){
    if(e.key==="Backspace"){
      if(!digits[i] && i>0){
        e.preventDefault();
        const arr = digits.slice();
        arr[i-1] = "";
        onChange(arr.join(""));
        refs.current[i-1]?.focus();
      }
    } else if(e.key==="ArrowLeft" && i>0){ refs.current[i-1]?.focus(); }
    else if(e.key==="ArrowRight" && i<5){ refs.current[i+1]?.focus(); }
  }
  function handlePaste(e){
    const raw = (e.clipboardData.getData("text")||"").replace(/\D/g,"").slice(0,6);
    if(!raw) return;
    e.preventDefault();
    onChange(raw);
    refs.current[Math.min(raw.length,5)]?.focus();
    if(raw.length===6 && onComplete) onComplete();
  }

  return (
    <div>
      <div className="muted" style={{fontSize:11,letterSpacing:".08em",textTransform:"uppercase",marginBottom:8}}>
        One-time code
      </div>
      <div className="otp-row" onPaste={handlePaste}>
        {digits.map((v,i)=>(
          <input key={i} ref={el=>refs.current[i]=el}
            className="otp-input" maxLength="1" inputMode="numeric" autoComplete="one-time-code"
            value={v}
            onChange={e=>setAt(i, e.target.value.slice(-1))}
            onFocus={e=>e.target.select()}
            onKeyDown={e=>handleKey(i,e)}
            autoFocus={i===0 && !value}
          />
        ))}
      </div>
    </div>
  );
}

window.LoginScreen = LoginScreen;
