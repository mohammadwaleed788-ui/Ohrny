// Lightweight SVG charts — no external deps
const { useMemo } = React;

function Sparkline({ data=[], w=72, h=20, color="oklch(0.72 0.15 25)" }){
  const max = Math.max(...data), min = Math.min(...data);
  const range = max-min || 1;
  const step = w / (data.length-1);
  const pts = data.map((v,i)=>`${i*step},${h - ((v-min)/range)*h}`).join(" ");
  return (
    <svg width={w} height={h} className="chart-spark">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function AreaChart({ series, w=640, h=220, labels=[], yFormat=(n)=>n, color="oklch(0.72 0.15 25)", accentArea=true, secondary }){
  // series: array of numbers
  const pad = {t:16,r:16,b:24,l:40};
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const max = Math.max(...series, ...(secondary||[])) * 1.08;
  const min = 0;
  const step = iw / (series.length-1 || 1);
  const toPts = (s)=>s.map((v,i)=>[pad.l + i*step, pad.t + ih - ((v-min)/(max-min))*ih]);
  const pts = toPts(series);
  const path = pts.map((p,i)=>`${i?"L":"M"}${p[0]},${p[1]}`).join(" ");
  const area = `${path} L${pts[pts.length-1][0]},${pad.t+ih} L${pts[0][0]},${pad.t+ih} Z`;

  const grid = [0,0.25,0.5,0.75,1].map(f=>pad.t + ih*(1-f));
  const gridVals = [0,0.25,0.5,0.75,1].map(f=>max*f);

  return (
    <svg width={w} height={h} className="chart">
      <defs>
        <linearGradient id="areaG" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".35"/>
          <stop offset="1" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {grid.map((y,i)=>(
        <line key={i} x1={pad.l} x2={w-pad.r} y1={y} y2={y} className="grid-line"/>
      ))}
      <g className="y-axis">
        {gridVals.map((v,i)=>(
          <text key={i} x={pad.l-6} y={grid[i]+3} textAnchor="end">{yFormat(v)}</text>
        ))}
      </g>
      {secondary && (
        <path d={toPts(secondary).map((p,i)=>`${i?"L":"M"}${p[0]},${p[1]}`).join(" ")}
          fill="none" stroke="oklch(0.75 0.12 235)" strokeWidth="1.3" strokeDasharray="4 3" opacity=".8"/>
      )}
      {accentArea && <path d={area} fill="url(#areaG)"/>}
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p,i)=>(
        i%Math.ceil(pts.length/8)===0 && <circle key={i} cx={p[0]} cy={p[1]} r="2.4" fill={color} stroke="var(--bg-elev)" strokeWidth="1.5"/>
      ))}
      <g className="x-axis">
        {labels.map((l,i)=>{
          const idx = Math.round((labels.length-1) * (i/(labels.length-1)));
          return <text key={i} x={pad.l + idx*step} y={h-6} textAnchor="middle">{l}</text>;
        })}
      </g>
    </svg>
  );
}

function BarChart({ data, w=640, h=220, color="oklch(0.72 0.15 25)" }){
  // data: [{label, value}]
  const pad = {t:16,r:12,b:30,l:40};
  const iw = w-pad.l-pad.r, ih=h-pad.t-pad.b;
  const max = Math.max(...data.map(d=>d.value))*1.1;
  const bw = iw / data.length;
  const grid=[0,.33,.66,1].map(f=>pad.t+ih*(1-f));
  return (
    <svg width={w} height={h} className="chart">
      {grid.map((y,i)=>(
        <line key={i} x1={pad.l} x2={w-pad.r} y1={y} y2={y} className="grid-line"/>
      ))}
      <g className="y-axis">
        {[0,.33,.66,1].map((f,i)=>(
          <text key={i} x={pad.l-6} y={grid[i]+3} textAnchor="end">{Math.round(max*f)}</text>
        ))}
      </g>
      {data.map((d,i)=>{
        const bh = (d.value/max)*ih;
        return (
          <g key={i}>
            <rect x={pad.l+i*bw+bw*0.2} y={pad.t+ih-bh} width={bw*0.6} height={bh}
              fill={color} opacity=".85" rx="2"/>
            <text x={pad.l+i*bw+bw/2} y={h-10} textAnchor="middle" className="x-axis">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Donut({ segments, w=140, size=140 }){
  // segments: [{label, value, color}]
  const total = segments.reduce((a,b)=>a+b.value,0);
  const r = size/2 - 10, cx=size/2, cy=size/2;
  let ang = -Math.PI/2;
  const arcs = segments.map((s,i)=>{
    const frac = s.value/total;
    const a2 = ang + frac*Math.PI*2;
    const large = frac>0.5?1:0;
    const x1 = cx + Math.cos(ang)*r, y1 = cy + Math.sin(ang)*r;
    const x2 = cx + Math.cos(a2)*r,  y2 = cy + Math.sin(a2)*r;
    const ir = r-14;
    const ix1 = cx + Math.cos(a2)*ir, iy1 = cy + Math.sin(a2)*ir;
    const ix2 = cx + Math.cos(ang)*ir, iy2 = cy + Math.sin(ang)*ir;
    const d = `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${ix1},${iy1} A${ir},${ir} 0 ${large} 0 ${ix2},${iy2} Z`;
    ang=a2;
    return <path key={i} d={d} fill={s.color}/>;
  });
  return (
    <svg width={size} height={size}>
      {arcs}
      <text x={cx} y={cy-2} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="18" fill="var(--text)">{total.toLocaleString()}</text>
      <text x={cx} y={cy+14} textAnchor="middle" fontFamily="var(--font-sans)" fontSize="10" fill="var(--text-mute)" letterSpacing=".05em">TOTAL</text>
    </svg>
  );
}

function Heatmap({ rows=7, cols=24, seed=1, cellSize=14, gap=3 }){
  // Pseudo-random activity heatmap
  function rand(i){ return Math.abs(Math.sin((i+seed)*12.9898)*43758.5453 % 1); }
  const cells = [];
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const i=r*cols+c;
      const peak = 1 - Math.abs(c-19)/14; // peak ~ 7pm
      const base = Math.max(0, peak) * (r===5||r===6?1.25:1);
      const v = Math.max(0, Math.min(1, base*0.8 + rand(i)*0.4 - 0.1));
      cells.push(v);
    }
  }
  const dayLabels=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const w = 40 + cols*(cellSize+gap);
  const h = rows*(cellSize+gap) + 18;
  return (
    <svg width={w} height={h}>
      {cells.map((v,i)=>{
        const r=Math.floor(i/cols), c=i%cols;
        return <rect key={i} x={40+c*(cellSize+gap)} y={r*(cellSize+gap)}
          width={cellSize} height={cellSize} rx="2"
          fill={`oklch(${0.3 + v*0.35} ${0.05 + v*0.12} 25 / ${0.3 + v*0.7})`}/>;
      })}
      {dayLabels.map((d,i)=>(
        <text key={d} x={0} y={i*(cellSize+gap)+cellSize-2} fontSize="10" fontFamily="var(--font-mono)" fill="var(--text-mute)">{d}</text>
      ))}
      {[0,6,12,18,23].map(h=>(
        <text key={h} x={40+h*(cellSize+gap)+cellSize/2} y={rows*(cellSize+gap)+12} fontSize="10" textAnchor="middle" fontFamily="var(--font-mono)" fill="var(--text-mute)">{h}:00</text>
      ))}
    </svg>
  );
}

Object.assign(window, { Sparkline, AreaChart, BarChart, Donut, Heatmap });
