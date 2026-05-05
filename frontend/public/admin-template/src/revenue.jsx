// Revenue & subscriptions

function RevenueSection(){
  const [range, setRange] = useState("30d");
  const mrr = Array.from({length:30},(_,i)=>1800000 + i*22000 + Math.sin(i/3)*30000);

  return (
    <div className="section active">
      <PageHead title="Revenue & subscriptions"
        sub="Subscriptions, consumables, and LTV"
        actions={<>
          <DateRange value={range} onChange={setRange}/>
          <button className="btn"><Icons.download size={13}/> Finance report</button>
        </>}/>

      <div className="kpi-row">
        <KPI label="MRR"             value="$2.46M"  delta="+6.1%" note="MoM"           series={mrr.map(v=>v/1000)}/>
        <KPI label="Net new MRR"     value="+$141k"  delta="+12.4%" note="this month"   series={[80,90,100,110,120,130,141]}/>
        <KPI label="Paying users"    value="82,304"  delta="+1,204" note="subscribers"  series={[78,79,79.5,80,81,81.5,82.3]}/>
        <KPI label="Churn (logo)"    value="3.8%"    delta="-0.2pp" note="monthly"      series={[4.3,4.2,4.1,4.0,3.9,3.8]}/>
      </div>

      <div className="grid-2" style={{marginBottom:14}}>
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">MRR over time</div>
            <div className="panel-sub">All subscription tiers · {range}</div>
          </div>
          <div className="panel-body">
            <AreaChart series={mrr} labels={["W1","W2","W3","W4"]}
              yFormat={n=>"$"+(n/1000).toFixed(0)+"k"} w={780} h={260}/>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Plan mix</div>
            <div className="panel-sub">Active subscribers</div>
          </div>
          <div className="panel-body">
            <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
              <Donut size={160} segments={[
                {label:"Platinum", value:9210,  color:"oklch(0.72 0.15 25)"},
                {label:"Gold",     value:41820, color:"oklch(0.82 0.14 80)"},
                {label:"Plus",     value:31274, color:"oklch(0.75 0.12 235)"},
              ]}/>
            </div>
            <div className="col" style={{gap:8,fontSize:13}}>
              <PlanRow color="oklch(0.72 0.15 25)"  name="Platinum · $29.99" count="9,210"  rev="$276,268" arpu="$29.99"/>
              <PlanRow color="oklch(0.82 0.14 80)"  name="Gold · $14.99"     count="41,820" rev="$626,886" arpu="$14.99"/>
              <PlanRow color="oklch(0.75 0.12 235)" name="Plus · $6.99"      count="31,274" rev="$218,605" arpu="$6.99"/>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Consumables revenue</div>
            <div className="panel-sub">Boosts, Super-likes, Read receipts</div>
          </div>
          <div className="panel-body barlist">
            {[
              ["Super-likes",   78420, "$184,287"],
              ["Boost 30-min",  41980, "$218,296"],
              ["Read receipts", 22115, "$77,402"],
              ["Rewind",        18200, "$41,860"],
              ["Incognito",     9840,  "$39,360"],
            ].map(r=>(
              <div key={r[0]} className="bar-row">
                <span className="dim">{r[0]}</span>
                <div className="bar-track"><div className="bar-fill" style={{width:(r[1]/85000*100)+"%"}}/></div>
                <span className="mono tnum right" style={{color:"var(--ok)"}}>{r[2]}</span>
              </div>
            ))}
            <hr className="div"/>
            <div className="row" style={{justifyContent:"space-between",fontSize:13}}>
              <span className="muted">Total this month</span>
              <span className="mono" style={{fontWeight:600}}>$561,205</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Cohort retention</div>
            <div className="panel-sub">% of subscribers still paying after N months</div>
          </div>
          <div className="panel-body">
            <div className="col" style={{gap:4,fontSize:11}}>
              <div style={{display:"grid",gridTemplateColumns:"80px repeat(6,1fr)",gap:4,color:"var(--text-mute)",fontFamily:"var(--font-mono)"}}>
                <span/><span>M1</span><span>M2</span><span>M3</span><span>M4</span><span>M5</span><span>M6</span>
              </div>
              {[
                ["Jan 26", [100,82,71,65,60,57,54]],
                ["Feb 26", [100,84,73,66,61,58,null]],
                ["Mar 26", [100,83,72,65,60,null,null]],
                ["Apr 26", [100,85,74,67,null,null,null]],
                ["May 26", [100,86,75,null,null,null,null]],
                ["Jun 26", [100,84,null,null,null,null,null]],
              ].map(([c,arr])=>(
                <div key={c} style={{display:"grid",gridTemplateColumns:"80px repeat(6,1fr)",gap:4}}>
                  <span className="mono muted">{c}</span>
                  {arr.slice(1).map((v,i)=>(
                    <span key={i} style={{
                      padding:"6px 0",textAlign:"center",borderRadius:4,
                      background: v==null ? "transparent" : `oklch(${0.3+v/100*0.45} ${0.05+v/100*0.12} 25 / ${0.3+v/100*0.65})`,
                      color: v==null ? "var(--text-mute)" : "var(--text)",
                      fontFamily:"var(--font-mono)",fontSize:11
                    }}>{v==null?"—":v+"%"}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanRow({color,name,count,rev,arpu}){
  return (
    <div className="row" style={{justifyContent:"space-between"}}>
      <span className="row gap-sm"><span style={{width:10,height:10,borderRadius:3,background:color}}/> {name}</span>
      <span className="mono muted" style={{fontSize:12}}>{count}</span>
      <span className="mono" style={{color:"var(--ok)"}}>{rev}</span>
    </div>
  );
}

window.RevenueSection = RevenueSection;
