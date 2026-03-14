import React from 'react';

// ─── Avatar data ──────────────────────────────────────────────────────────────

interface AvatarConfig {
  id: string;
  label: string;
  bg1: string;
  bg2: string;
  skin: string;
  hair: string;
  shirt: string;
  female?: boolean;
  hairStyle: 'short' | 'mohawk' | 'long' | 'bun' | 'braids' | 'silver';
  expr: 'determined' | 'grin' | 'smile';
}

export const AVATAR_OPTIONS: AvatarConfig[] = [
  { id: 'chad',   label: 'Chad',   bg1: '#0A1628', bg2: '#1B5FA8', skin: '#C68642', hair: '#3A1A00', shirt: '#1E5FA8', hairStyle: 'short',   expr: 'determined' },
  { id: 'rex',    label: 'Rex',    bg1: '#6B0A0A', bg2: '#C82020', skin: '#F0C080', hair: '#111111', shirt: '#C82020', hairStyle: 'mohawk',  expr: 'determined' },
  { id: 'zeus',   label: 'Zeus',   bg1: '#2A0A5A', bg2: '#6A2AC8', skin: '#D4A070', hair: '#C8C8D8', shirt: '#6A2AC8', hairStyle: 'silver',  expr: 'grin'       },
  { id: 'blaze',  label: 'Blaze',  bg1: '#5A2A00', bg2: '#E06000', skin: '#7A4020', hair: '#CC2200', shirt: '#E06000', hairStyle: 'mohawk',  expr: 'determined' },
  { id: 'russ',   label: 'Russ',   bg1: '#0A3A0A', bg2: '#2A8A2A', skin: '#FDBCB4', hair: '#D4A030', shirt: '#2A8A2A', hairStyle: 'short',   expr: 'smile'      },
  { id: 'iron',   label: 'Iron',   bg1: '#1A1A2A', bg2: '#4A4A7A', skin: '#8D5524', hair: '#222233', shirt: '#4A4A7A', hairStyle: 'short',   expr: 'determined' },
  { id: 'valky',  label: 'Valky',  bg1: '#4A0A5A', bg2: '#C840A8', skin: '#F4C8C0', hair: '#E840C0', shirt: '#C840A8', female: true, hairStyle: 'bun',    expr: 'determined' },
  { id: 'terra',  label: 'Terra',  bg1: '#0A3A4A', bg2: '#1A8A90', skin: '#C68642', hair: '#1A0A00', shirt: '#1A8A90', female: true, hairStyle: 'braids', expr: 'grin'       },
  { id: 'nyx',    label: 'Nyx',    bg1: '#050D1A', bg2: '#1A1A4A', skin: '#E8C8C0', hair: '#E8E8F8', shirt: '#1A2A6A', female: true, hairStyle: 'long',   expr: 'determined' },
  { id: 'sol',    label: 'Sol',    bg1: '#4A2A00', bg2: '#C8900A', skin: '#7A4520', hair: '#C8A010', shirt: '#C8900A', female: true, hairStyle: 'bun',    expr: 'smile'      },
  { id: 'flora',  label: 'Flora',  bg1: '#1A3A0A', bg2: '#4A8A2A', skin: '#D4A878', hair: '#C03010', shirt: '#4A8A2A', female: true, hairStyle: 'long',   expr: 'smile'      },
  { id: 'spark',  label: 'Spark',  bg1: '#3A0A0A', bg2: '#A83010', skin: '#FDBCB4', hair: '#D46000', shirt: '#A83010', female: true, hairStyle: 'braids', expr: 'grin'       },
];

// ─── SVG renderer ─────────────────────────────────────────────────────────────

function CartoonAvatar({ cfg, size = 80 }: { cfg: AvatarConfig; size?: number }) {
  const { id, bg1, bg2, skin, hair, shirt, female = false, hairStyle, expr } = cfg;
  const g   = `av-g-${id}`;
  const cp  = `av-cp-${id}`;

  // Body geometry
  const bx  = female ? 13 : 9;    // bicep centre x
  const brx = female ? 10 : 13;   // bicep rx
  const bry = female ? 9  : 12;   // bicep ry
  const tx  = female ? 18 : 14;   // torso top-left x
  const tw  = female ? 44 : 52;   // torso top width (2×half)
  const bodyPts = `${tx},80 ${tx+4},${female?52:50} ${tx+tw-4},${female?52:50} ${tx+tw},80`;

  // Hair
  const hairEl = (() => {
    switch (hairStyle) {
      case 'mohawk':
        return <path d="M37,14 Q40,3 43,14 L42,26 Q40,24 38,26Z" fill={hair}/>;
      case 'long':
        return <>
          <path d="M23,28 Q24,11 40,10 Q56,11 57,28 Q56,15 40,13 Q24,15 23,28Z" fill={hair}/>
          <path d="M23,28 Q20,42 22,54" stroke={hair} strokeWidth="7" fill="none" strokeLinecap="round"/>
          <path d="M57,28 Q60,42 58,54" stroke={hair} strokeWidth="7" fill="none" strokeLinecap="round"/>
        </>;
      case 'bun':
        return <>
          <path d="M23,25 Q24,11 40,10 Q56,11 57,25 Q56,14 40,12 Q24,14 23,25Z" fill={hair}/>
          <circle cx="40" cy="13" r="7" fill={hair}/>
        </>;
      case 'braids':
        return <>
          <path d="M23,26 Q24,11 40,10 Q56,11 57,26 Q56,14 40,13 Q24,14 23,26Z" fill={hair}/>
          <path d="M23,30 Q21,44 23,56" stroke={hair} strokeWidth="5" strokeDasharray="4,2" fill="none" strokeLinecap="round"/>
          <path d="M57,30 Q59,44 57,56" stroke={hair} strokeWidth="5" strokeDasharray="4,2" fill="none" strokeLinecap="round"/>
        </>;
      case 'silver':
        return <path d="M23,26 Q24,11 40,10 Q56,11 57,26 L55,27 Q44,18 40,17 Q36,18 25,27Z" fill="#C8C8DA"/>;
      default: // short
        return <path d="M23,26 Q24,11 40,10 Q56,11 57,26 L55,26 Q44,17 40,16 Q36,17 25,26Z" fill={hair}/>;
    }
  })();

  // Mouth
  const mouthEl = (() => {
    switch (expr) {
      case 'grin':
        return <path d="M33,37 Q40,44 47,37" stroke="#CC3333" strokeWidth="1.5" fill="rgba(200,60,60,0.25)" strokeLinecap="round"/>;
      case 'smile':
        return <path d="M35,37 Q40,42 45,37" stroke="#A05030" strokeWidth="1.8" fill="none" strokeLinecap="round"/>;
      default:
        return <path d="M36,38 Q40,39.5 44,38" stroke="#A05030" strokeWidth="1.8" fill="none" strokeLinecap="round"/>;
    }
  })();

  return (
    <svg viewBox="0 0 80 80" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={g} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor={bg1}/>
          <stop offset="100%" stopColor={bg2}/>
        </linearGradient>
        <clipPath id={cp}><circle cx="40" cy="40" r="40"/></clipPath>
      </defs>

      {/* Background */}
      <circle cx="40" cy="40" r="40" fill={`url(#${g})`}/>

      <g clipPath={`url(#${cp})`}>
        {/* Biceps */}
        <ellipse cx={bx} cy="58" rx={brx} ry={bry} fill={skin}/>
        <ellipse cx={80-bx} cy="58" rx={brx} ry={bry} fill={skin}/>
        {/* Vein detail on male biceps */}
        {!female && <>
          <path d={`M${bx-5},55 Q${bx-1},51 ${bx+4},54`} stroke="rgba(0,0,0,0.13)" strokeWidth="1.2" fill="none"/>
          <path d={`M${80-bx-4},54 Q${80-bx+1},51 ${80-bx+5},55`} stroke="rgba(0,0,0,0.13)" strokeWidth="1.2" fill="none"/>
        </>}

        {/* Torso */}
        <polygon points={bodyPts} fill={shirt}/>
        {/* Shirt highlight */}
        <polygon points={bodyPts} fill="rgba(255,255,255,0.07)"/>
        {/* V-collar */}
        <path d={`M${tx+4},${female?52:50} L40,${female?58:56} L${tx+tw-4},${female?52:50}`}
          stroke="rgba(0,0,0,0.14)" strokeWidth="1.5" fill="none"/>

        {/* Neck */}
        <rect x="35" y="39" width="10" height="13" rx="4" fill={skin}/>

        {/* Head */}
        <circle cx="40" cy="30" r="18" fill={skin}/>

        {/* Ears */}
        <ellipse cx="22" cy="31" rx="3" ry="4" fill={skin}/>
        <ellipse cx="58" cy="31" rx="3" ry="4" fill={skin}/>

        {/* Hair */}
        {hairEl}

        {/* Eyebrows — intense / angled */}
        <path d="M27,23 Q31,20 36,22" stroke={hair === '#C8C8D8' || hair === '#C8C8DA' ? '#8888AA' : hair} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M44,22 Q49,20 53,23" stroke={hair === '#C8C8D8' || hair === '#C8C8DA' ? '#8888AA' : hair} strokeWidth="2.5" fill="none" strokeLinecap="round"/>

        {/* Eyes */}
        <ellipse cx="33" cy="30" rx="3.5" ry="4" fill="white"/>
        <ellipse cx="47" cy="30" rx="3.5" ry="4" fill="white"/>
        <circle cx="33.8" cy="30.5" r="2.1" fill="#1A1A2E"/>
        <circle cx="47.8" cy="30.5" r="2.1" fill="#1A1A2E"/>
        {/* Shine */}
        <circle cx="34.6" cy="29.5" r="0.9" fill="white"/>
        <circle cx="48.6" cy="29.5" r="0.9" fill="white"/>

        {/* Female eyelashes */}
        {female && <>
          <path d="M29,26 L28,24 M33,25 L33,23 M37,26 L38,24" stroke={hair} strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M43,26 L42,24 M47,25 L47,23 M51,26 L52,24" stroke={hair} strokeWidth="1.2" strokeLinecap="round"/>
        </>}

        {/* Nose */}
        <path d="M38,33 Q40,36 42,33" stroke="rgba(0,0,0,0.12)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>

        {/* Mouth */}
        {mouthEl}
      </g>
    </svg>
  );
}

// ─── Public helpers ────────────────────────────────────────────────────────────

export function getAvatarById(id: string): AvatarConfig | undefined {
  return AVATAR_OPTIONS.find(a => a.id === id);
}

/** Renders a tiny avatar inline (e.g. in sidebar / topbar) */
export function AvatarDisplay({ avatarId, initials, size = 36 }: { avatarId?: string; initials?: string; size?: number }) {
  const cfg = avatarId ? getAvatarById(avatarId) : undefined;
  if (cfg) {
    return <CartoonAvatar cfg={cfg} size={size}/>;
  }
  return <span style={{ fontSize: size * 0.35, lineHeight: 1 }}>{initials ?? '?'}</span>;
}

// ─── Modal picker ─────────────────────────────────────────────────────────────

interface AvatarPickerProps {
  current?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export default function AvatarPicker({ current, onSelect, onClose }: AvatarPickerProps) {
  return (
    <div className="avatar-picker-overlay" onClick={onClose}>
      <div className="avatar-picker-modal" onClick={e => e.stopPropagation()}>
        <div className="avatar-picker-header">
          <span className="avatar-picker-title">Choose Your Avatar</span>
          <button className="avatar-picker-close" onClick={onClose}>✕</button>
        </div>
        <p className="avatar-picker-sub">Pick your gym alter ego</p>
        <div className="avatar-picker-grid">
          {AVATAR_OPTIONS.map(cfg => (
            <button
              key={cfg.id}
              className={`avatar-pick-btn ${current === cfg.id ? 'selected' : ''}`}
              onClick={() => { onSelect(cfg.id); onClose(); }}
              title={cfg.label}
            >
              <CartoonAvatar cfg={cfg} size={60}/>
              <span className="avatar-pick-label">{cfg.label}</span>
              {current === cfg.id && <span className="avatar-pick-check">✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
