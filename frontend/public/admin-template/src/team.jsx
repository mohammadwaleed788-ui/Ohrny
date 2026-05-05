// Team members — admin, moderator, support, finance

const TEAM = [
  {id:"t_01",name:"Elena Marchetti",    role:"owner",    status:"active",  twofa:"totp",    last:"just now",  ip_loc:"Brooklyn",     sessions:2, invited:"Oct 2023"},
  {id:"t_02",name:"Marco Tanaka",       role:"admin",    status:"active",  twofa:"passkey", last:"4m ago",    ip_loc:"Lisbon",       sessions:1, invited:"Jan 2024"},
  {id:"t_03",name:"Sarah Kowalczyk",    role:"moderator",status:"active",  twofa:"totp",    last:"12m ago",   ip_loc:"Berlin",       sessions:1, invited:"Mar 2024"},
  {id:"t_04",name:"Dev Patel",          role:"moderator",status:"active",  twofa:"totp",    last:"28m ago",   ip_loc:"Bengaluru",    sessions:1, invited:"May 2024"},
  {id:"t_05",name:"Noah Ackermann",     role:"support",  status:"active",  twofa:"sms",     last:"1h ago",    ip_loc:"Austin",       sessions:1, invited:"Aug 2024"},
  {id:"t_06",name:"Yara Abad",          role:"support",  status:"active",  twofa:"totp",    last:"2h ago",    ip_loc:"Madrid",       sessions:1, invited:"Sep 2024"},
  {id:"t_07",name:"Priyanka Rao",       role:"finance",  status:"active",  twofa:"passkey", last:"yesterday", ip_loc:"Mumbai",       sessions:0, invited:"Nov 2024"},
  {id:"t_08",name:"Jules Okafor",       role:"analyst",  status:"active",  twofa:"totp",    last:"yesterday", ip_loc:"Lagos",        sessions:0, invited:"Feb 2025"},
  {id:"t_09",name:"Finn Arvidsson",     role:"engineer", status:"active",  twofa:"passkey", last:"3d ago",    ip_loc:"Stockholm",    sessions:0, invited:"Mar 2025"},
  {id:"t_10",name:"Chen Wei",           role:"moderator",status:"suspended",twofa:"none",   last:"14d ago",   ip_loc:"Taipei",       sessions:0, invited:"Jan 2025"},
  {id:"t_11",name:"—",                   role:"moderator",status:"invited", twofa:"—",      last:"invite sent", ip_loc:"—",          sessions:0, invited:"Apr 19"},
];

const ROLE_DESC = {
  owner:    ["accent","Owner",     "Full access, billing, delete org"],
  admin:    ["accent","Admin",     "Full product access, manage team"],
  moderator:["info",  "Moderator", "Trust & Safety + content review"],
  support:  ["info",  "Support",   "Tickets, user detail, refunds (capped)"],
  finance:  ["warn",  "Finance",   "Revenue, payouts, billing only"],
  analyst:  ["",      "Analyst",   "Read-only analytics"],
  engineer: ["",      "Engineer",  "Experiments, flags, algorithm"],
};

const ROLE_PERMS = [
  ["View dashboards",       ["owner","admin","moderator","support","finance","analyst","engineer"]],
  ["Manage users",          ["owner","admin","support"]],
  ["Ban / shadow-ban",      ["owner","admin","moderator"]],
  ["Refund transactions",   ["owner","admin","finance","support"]],
  ["Change algorithm",      ["owner","admin","engineer"]],
  ["Toggle feature flags",  ["owner","admin","engineer"]],
  ["Send campaigns",        ["owner","admin"]],
  ["Reveal PII (temp)",     ["owner","admin"]],
  ["Manage team",           ["owner","admin"]],
  ["Billing & payouts",     ["owner","finance"]],
];

function TeamSection(){
  const [tab, setTab] = useState("members");
  const [filter, setFilter] = useState("all");
  const [inviteOpen, setInviteOpen] = useState(false);

  const rows = TEAM.filter(t=>filter==="all"?true:t.role===filter);

  return (
    <div className="section active">
      <PageHead title="Team"
        sub="11 members · 8 active sessions · 2FA required for all roles"
        actions={<>
          <button className="btn"><Icons.download size={13}/> Audit log</button>
          <button className="btn primary" onClick={()=>setInviteOpen(true)}><Icons.plus size={13}/> Invite member</button>
        </>}/>

      <div className="kpi-row">
        <KPI label="Members"         value="11"   delta="+1"  note="this month"/>
        <KPI label="2FA enforced"    value="100%" delta=""    note="policy · required"/>
        <KPI label="Active sessions" value="6"    delta=""    note="live now"/>
        <KPI label="Pending invites" value="1"    delta=""    note="Apr 19"/>
      </div>

      <div className="panel">
        <div className="tabs">
          {[["members","Members (11)"],["roles","Roles & permissions"],["policy","Policy"],["log","Audit log"]].map(([k,l])=>(
            <div key={k} className={"tab "+(tab===k?"on":"")} onClick={()=>setTab(k)}>{l}</div>
          ))}
        </div>

        {tab==="members" && <>
          <div className="filters">
            {[["all","All"],["owner","Owners"],["admin","Admins"],["moderator","Moderators"],["support","Support"],["finance","Finance"],["analyst","Analysts"],["engineer","Engineers"]].map(([k,l])=>(
              <button key={k} className={"filter-chip "+(filter===k?"on":"")} onClick={()=>setFilter(k)}>{l}</button>
            ))}
            <div style={{flex:1}}/>
            <button className="btn" style={{fontSize:12}}>Bulk · suspend</button>
          </div>
          <table className="tbl">
            <thead><tr>
              <th style={{width:28}}><input type="checkbox"/></th>
              <th>Member</th><th>Role</th><th>Status</th><th>2FA</th>
              <th>Last active</th><th>Location</th><th className="right">Sessions</th>
              <th style={{width:80}}/>
            </tr></thead>
            <tbody>
              {rows.map((m,i)=>{
                const [rcls, rlabel] = ROLE_DESC[m.role] || ["", m.role];
                return (
                  <tr key={m.id}>
                    <td><input type="checkbox"/></td>
                    <td>
                      <div className="row">
                        {m.status==="invited"
                          ? <div style={{width:30,height:30,borderRadius:"50%",background:"var(--bg-elev-2)",display:"flex",alignItems:"center",justifyContent:"center",border:"1px dashed var(--line)"}}><Icons.mail size={13}/></div>
                          : <PhotoAvatar name={m.name} hue={(fnvHash(m.id)%360)} size={30}/>}
                        <div>
                          <div style={{fontWeight:500}}>{m.status==="invited"?<span className="muted">pending invite</span>:m.name}</div>
                          <div className="mono muted" style={{fontSize:11}}>{m.status==="invited"?"…@•••":maskEmail()}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={"chip "+rcls}>{rlabel}</span></td>
                    <td>
                      {m.status==="active"    && <span className="chip ok"><span className="ddot"/>Active</span>}
                      {m.status==="suspended" && <span className="chip bad">Suspended</span>}
                      {m.status==="invited"   && <span className="chip warn">Invited</span>}
                    </td>
                    <td>
                      {m.twofa==="totp"     && <span className="chip ok"><Icons.check size={11}/> TOTP</span>}
                      {m.twofa==="passkey"  && <span className="chip accent"><Icons.check size={11}/> Passkey</span>}
                      {m.twofa==="sms"      && <span className="chip warn">SMS</span>}
                      {m.twofa==="none"     && <span className="chip bad">Off</span>}
                      {m.twofa==="—"        && <span className="muted">—</span>}
                    </td>
                    <td className="mono muted" style={{fontSize:12}}>{m.last}</td>
                    <td className="dim">{m.ip_loc}</td>
                    <td className="right mono">{m.sessions}</td>
                    <td><button className="top-btn" style={{width:28,height:28}}><Icons.more size={14}/></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>}

        {tab==="roles" && (
          <div className="panel-body">
            <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:10,marginBottom:18}}>
              {Object.entries(ROLE_DESC).map(([k,v])=>(
                <div key={k} style={{padding:12,border:"1px solid var(--line-soft)",borderRadius:8,background:"var(--bg-elev-2)"}}>
                  <div className="row" style={{justifyContent:"space-between"}}>
                    <span className={"chip "+v[0]}>{v[1]}</span>
                    <span className="mono muted" style={{fontSize:11}}>{TEAM.filter(t=>t.role===k).length}</span>
                  </div>
                  <div className="muted" style={{fontSize:12,marginTop:6}}>{v[2]}</div>
                </div>
              ))}
            </div>

            <div className="panel-title mb-8">Permission matrix</div>
            <div style={{overflow:"auto"}}>
              <table className="tbl">
                <thead><tr>
                  <th>Permission</th>
                  {Object.keys(ROLE_DESC).map(r=><th key={r} className="right">{ROLE_DESC[r][1]}</th>)}
                </tr></thead>
                <tbody>
                  {ROLE_PERMS.map(([p, roles])=>(
                    <tr key={p}>
                      <td>{p}</td>
                      {Object.keys(ROLE_DESC).map(r=>(
                        <td key={r} className="right">
                          {roles.includes(r)
                            ? <span style={{color:"var(--ok)"}}><Icons.check size={14}/></span>
                            : <span className="muted">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==="policy" && (
          <div className="panel-body col" style={{gap:14,maxWidth:640}}>
            <PolicyRow on={true}  title="Require 2FA for all roles" sub="Members must register TOTP or passkey within 7 days of invite."/>
            <PolicyRow on={true}  title="Enforce passkey for admins" sub="Owners and admins cannot rely on SMS alone."/>
            <PolicyRow on={true}  title="SSO · Google Workspace"     sub="Domain-locked to ohrny.com. Falls back to password on outage."/>
            <PolicyRow on={true}  title="Auto-logout after 30 min idle" sub="Session refresh requires re-auth."/>
            <PolicyRow on={true}  title="Hide user PII by default"   sub="Emails, phone, IP masked. Reveal requires a reason and is audited."/>
            <PolicyRow on={false} title="Allow member-initiated exports" sub="Export user-level data to CSV."/>
            <PolicyRow on={true}  title="IP allowlist for admin access" sub="Office IPs + VPN range only."/>
          </div>
        )}

        {tab==="log" && (
          <table className="tbl">
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>IP</th></tr></thead>
            <tbody>
              {[
                ["2m ago",  "Elena M.",  "Banned user",          "user "+maskId("u_b82a10c"), maskIP()],
                ["18m ago", "Marco T.",  "Revealed email",       "user "+maskId("u_ff39a2b"), maskIP()],
                ["42m ago", "Sarah K.",  "Resolved report R-48271", "",                       maskIP()],
                ["1h ago",  "Elena M.",  "Invited member",       "moderator · pending",       maskIP()],
                ["3h ago",  "Priyanka R.","Exported revenue CSV","range 30d",                 maskIP()],
                ["5h ago",  "Finn A.",   "Deployed algorithm change", "weights v214",         maskIP()],
                ["Yesterday","Chen W.",  "Account suspended by Elena M.",   "",               maskIP()],
              ].map((r,i)=>(
                <tr key={i}>
                  <td className="mono muted">{r[0]}</td>
                  <td style={{fontWeight:500}}>{r[1]}</td>
                  <td>{r[2]}</td>
                  <td className="dim mono" style={{fontSize:12}}>{r[3]}</td>
                  <td className="mono muted">{r[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {inviteOpen && <InviteModal onClose={()=>setInviteOpen(false)}/>}
    </div>
  );
}

function PolicyRow({on, title, sub}){
  const [v,setV] = useState(on);
  return (
    <div className="row" style={{justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--line-soft)"}}>
      <div>
        <div style={{fontSize:13,fontWeight:500}}>{title}</div>
        <div className="muted" style={{fontSize:12,marginTop:2}}>{sub}</div>
      </div>
      <div className={"switch "+(v?"on":"")} onClick={()=>setV(x=>!x)}/>
    </div>
  );
}

function InviteModal({onClose}){
  const [role, setRole] = useState("moderator");
  return (
    <>
      <div className="drawer-backdrop open" onClick={onClose}/>
      <div style={{
        position:"fixed",left:"50%",top:"50%",transform:"translate(-50%,-50%)",zIndex:42,
        width:480,maxWidth:"92vw",background:"var(--bg-elev)",border:"1px solid var(--line)",
        borderRadius:12,boxShadow:"0 40px 80px -40px rgba(0,0,0,.8)"
      }}>
        <div className="row" style={{padding:"14px 18px",borderBottom:"1px solid var(--line-soft)",justifyContent:"space-between"}}>
          <span style={{fontWeight:600}}>Invite a team member</span>
          <button className="top-btn" onClick={onClose}><Icons.close size={14}/></button>
        </div>
        <div className="col" style={{padding:18,gap:14}}>
          <label className="login-field">
            <span>Work email</span>
            <input type="email" placeholder="name@ohrny.com"/>
          </label>
          <div>
            <div className="muted" style={{fontSize:11,letterSpacing:".06em",textTransform:"uppercase",marginBottom:8,fontWeight:600}}>Role</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {Object.entries(ROLE_DESC).map(([k,v])=>(
                <div key={k}
                  onClick={()=>setRole(k)}
                  className={"twofa-method "+(role===k?"on":"")}
                  style={{cursor:"pointer"}}>
                  <div className="twofa-radio">{role===k && <span/>}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500}}>{v[1]}</div>
                    <div className="muted" style={{fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v[2]}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{padding:10,border:"1px solid var(--line-soft)",borderRadius:8,background:"var(--bg-elev-2)",fontSize:12,color:"var(--text-dim)"}}>
            <div className="row gap-sm" style={{marginBottom:4}}><Icons.shield size={13}/> <span style={{fontWeight:600,color:"var(--text)"}}>2FA required</span></div>
            Invite email will include a single-use setup link. The member must register TOTP or a passkey before their first session.
          </div>
          <div className="row" style={{justifyContent:"flex-end",gap:8}}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary"><Icons.send size={13}/> Send invite</button>
          </div>
        </div>
      </div>
    </>
  );
}

window.TeamSection = TeamSection;
