// Small drawings for empty screens. Colors come from the theme.

export function Campfire() {
  return (
    <svg className="illustration" viewBox="0 0 200 120" aria-hidden="true">
      <ellipse cx="100" cy="104" rx="70" ry="8" className="ill-ground" />
      <g className="ill-flame">
        <path d="M100 40c10 14 18 22 18 36a18 18 0 0 1-36 0c0-10 6-14 8-22 4 6 6 8 10 10-2-8-2-16 0-24z" className="ill-fire" />
        <path d="M100 64c5 7 8 10 8 16a8 8 0 0 1-16 0c0-5 4-8 8-16z" className="ill-fire-core" />
      </g>
      <path d="M72 100l56-14M72 86l56 14" className="ill-wood" />
      <circle cx="40" cy="78" r="9" className="ill-head" />
      <path d="M26 104c2-12 8-17 14-17s12 5 14 17" className="ill-body" />
      <circle cx="160" cy="78" r="9" className="ill-head ill-head-2" />
      <path d="M146 104c2-12 8-17 14-17s12 5 14 17" className="ill-body" />
      <circle cx="58" cy="30" r="1.6" className="ill-spark s1" />
      <circle cx="138" cy="22" r="1.4" className="ill-spark s2" />
      <circle cx="120" cy="12" r="1.2" className="ill-spark s3" />
    </svg>
  );
}

export function Party() {
  return (
    <svg className="illustration" viewBox="0 0 200 120" aria-hidden="true">
      <ellipse cx="100" cy="106" rx="72" ry="7" className="ill-ground" />
      <circle cx="64" cy="54" r="16" className="ill-head" />
      <path d="M36 104c3-20 14-30 28-30s25 10 28 30" className="ill-body" />
      <circle cx="136" cy="54" r="16" className="ill-head ill-head-2" />
      <path d="M108 104c3-20 14-30 28-30s25 10 28 30" className="ill-body" />
      <path d="M100 30l3.5 7 7.5 1-5.5 5.3 1.3 7.7-6.8-3.6-6.8 3.6 1.3-7.7-5.5-5.3 7.5-1z" className="ill-star" />
    </svg>
  );
}

export function StarSky() {
  return (
    <svg className="illustration" viewBox="0 0 200 120" aria-hidden="true">
      <path d="M100 26l9 18 20 3-14.5 14 3.4 20-17.9-9.4-17.9 9.4 3.4-20L71 47l20-3z" className="ill-star big" />
      <circle cx="44" cy="36" r="2" className="ill-spark s1" />
      <circle cx="158" cy="30" r="2.4" className="ill-spark s2" />
      <circle cx="150" cy="92" r="1.6" className="ill-spark s3" />
      <circle cx="52" cy="90" r="1.8" className="ill-spark s2" />
    </svg>
  );
}

export function Lens() {
  return (
    <svg className="illustration" viewBox="0 0 200 120" aria-hidden="true">
      <circle cx="92" cy="54" r="28" className="ill-body" />
      <path d="M112 74l26 26" className="ill-wood" />
      <path d="M80 48h24M80 60h16" className="ill-line" />
    </svg>
  );
}
