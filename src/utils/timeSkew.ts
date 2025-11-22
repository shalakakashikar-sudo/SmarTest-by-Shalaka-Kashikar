// src/utils/timeSkew.ts
let skew = 0; // milliseconds (serverTime - clientTime)

export async function initTimeSkew() {
  try {
    const res = await fetch('/api/time');
    if (!res.ok) { skew = 0; return; }
    const j = await res.json();
    skew = (j.serverTime || Date.now()) - Date.now();
    // optional: console.log('time skew (ms):', skew);
  } catch (e) {
    skew = 0;
  }
}

export function nowWithSkew(): number {
  return Date.now() + skew;
}

export function getSkewMs(): number {
  return skew;
}
