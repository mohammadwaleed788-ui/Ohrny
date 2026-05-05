// Tiny inline icon set — single-stroke Feather-style, 16px default
const Ic = ({d, size=16, fill, sw=1.6, children}) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
       fill={fill||"none"} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {children || <path d={d}/>}
  </svg>
);

const Icons = {
  dashboard: (p)=><Ic {...p}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></Ic>,
  users:     (p)=><Ic {...p}><circle cx="9" cy="8" r="3.2"/><path d="M3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5"/><circle cx="17" cy="7" r="2.6"/><path d="M15 14.5c3.4 0 5.3 1.8 6 5"/></Ic>,
  heart:     (p)=><Ic {...p}><path d="M12 20s-7-4.3-7-10a4.2 4.2 0 0 1 7-3 4.2 4.2 0 0 1 7 3c0 5.7-7 10-7 10z"/></Ic>,
  shield:    (p)=><Ic {...p}><path d="M12 3 4.5 6v5c0 4.6 3.2 8.3 7.5 10 4.3-1.7 7.5-5.4 7.5-10V6L12 3z"/><path d="m9 12 2 2 4-4"/></Ic>,
  dollar:    (p)=><Ic {...p}><path d="M12 3v18"/><path d="M16 7.5c-.8-1.5-2.3-2.2-4-2.2-2.3 0-4 1.1-4 3 0 4 8 2.5 8 6.7 0 2-1.8 3.2-4 3.2-1.8 0-3.6-.8-4.3-2.3"/></Ic>,
  flag:      (p)=><Ic {...p}><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></Ic>,
  send:      (p)=><Ic {...p}><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></Ic>,
  flask:     (p)=><Ic {...p}><path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/><path d="M7.5 14h9"/></Ic>,
  sliders:   (p)=><Ic {...p}><path d="M4 6h10"/><path d="M18 6h2"/><circle cx="16" cy="6" r="2"/><path d="M4 12h4"/><path d="M12 12h8"/><circle cx="10" cy="12" r="2"/><path d="M4 18h13"/><path d="M21 18"/><circle cx="19" cy="18" r="2"/></Ic>,
  tickets:   (p)=><Ic {...p}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z"/><path d="M13 6v12" strokeDasharray="2 2"/></Ic>,
  search:    (p)=><Ic {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Ic>,
  bell:      (p)=><Ic {...p}><path d="M6 8a6 6 0 1 1 12 0c0 4 2 5 2 7H4c0-2 2-3 2-7z"/><path d="M10 20a2 2 0 0 0 4 0"/></Ic>,
  settings:  (p)=><Ic {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></Ic>,
  arrowUp:   (p)=><Ic {...p} sw={2}><path d="m6 9 6-6 6 6"/><path d="M12 3v18"/></Ic>,
  arrowDown: (p)=><Ic {...p} sw={2}><path d="m6 15 6 6 6-6"/><path d="M12 3v18"/></Ic>,
  chevron:   (p)=><Ic {...p}><path d="m9 6 6 6-6 6"/></Ic>,
  chevL:     (p)=><Ic {...p}><path d="m15 6-6 6 6 6"/></Ic>,
  download:  (p)=><Ic {...p}><path d="M12 3v13"/><path d="m6 11 6 6 6-6"/><path d="M4 21h16"/></Ic>,
  filter:    (p)=><Ic {...p}><path d="M3 5h18l-7 9v5l-4 2v-7L3 5z"/></Ic>,
  plus:      (p)=><Ic {...p}><path d="M12 5v14"/><path d="M5 12h14"/></Ic>,
  close:     (p)=><Ic {...p}><path d="M6 6l12 12"/><path d="M18 6 6 18"/></Ic>,
  check:     (p)=><Ic {...p}><path d="m5 12 5 5L20 7"/></Ic>,
  x:         (p)=><Ic {...p}><path d="M6 6l12 12"/><path d="M18 6 6 18"/></Ic>,
  more:      (p)=><Ic {...p}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></Ic>,
  sparkle:   (p)=><Ic {...p}><path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="m6 6 2 2"/><path d="m16 16 2 2"/><path d="m6 18 2-2"/><path d="m16 8 2-2"/></Ic>,
  cal:       (p)=><Ic {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 3v4"/><path d="M16 3v4"/></Ic>,
  pin:       (p)=><Ic {...p}><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></Ic>,
  lightning: (p)=><Ic {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></Ic>,
  tweak:     (p)=><Ic {...p}><circle cx="8" cy="8" r="3"/><circle cx="16" cy="16" r="3"/><path d="M3 8h2"/><path d="M11 8h10"/><path d="M3 16h10"/><path d="M19 16h2"/></Ic>,
  eye:       (p)=><Ic {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></Ic>,
  ban:       (p)=><Ic {...p}><circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></Ic>,
  mail:      (p)=><Ic {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></Ic>,
  star:      (p)=><Ic {...p}><path d="m12 3 2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.5l6.3-.7L12 3z"/></Ic>,
  external:  (p)=><Ic {...p}><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/></Ic>,
  camera:    (p)=><Ic {...p}><path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></Ic>,
  mic:       (p)=><Ic {...p}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v4"/><path d="M8 22h8"/></Ic>,
  image:     (p)=><Ic {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m3 18 5-5 4 4 3-3 6 6"/></Ic>,
  edit:      (p)=><Ic {...p}><path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="m13 7 4 4"/></Ic>,
  zap:       (p)=><Ic {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></Ic>,
  undo:      (p)=><Ic {...p}><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H8"/></Ic>,
  lightbulb: (p)=><Ic {...p}><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c1 1 1.5 2 1.5 3.5h5c0-1.5.5-2.5 1.5-3.5A6 6 0 0 0 12 3z"/></Ic>,
  dot:       (p)=><Ic {...p}><circle cx="12" cy="12" r="3"/></Ic>,
  logo:      ({size=28})=>(
    <svg width={size} height={size} viewBox="0 0 32 32">
      <defs>
        <linearGradient id="oh" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="oklch(0.82 0.17 25)"/>
          <stop offset="1" stopColor="oklch(0.55 0.17 25)"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#oh)"/>
      <path d="M10 18c0-3 2-5 5-5s5 2 5 5c0 2.5-2 4.5-5 6-3-1.5-5-3.5-5-6z" fill="oklch(0.96 0.03 25)" fillOpacity=".92"/>
    </svg>
  )
};

window.Icons = Icons;
