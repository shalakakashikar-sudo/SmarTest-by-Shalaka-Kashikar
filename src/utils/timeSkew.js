let skew = 0;
export async function initTimeSkew() {
  try {
    const r = await fetch('/api/time');
    const j = await r.json();
    skew = (j.serverTime || Date.now()) - Date.now();
  } catch (e) {
    skew = 0;
  }
}
export function nowWithSkew() { return Date.now() + skew; }
export function getSkewMs() { return skew; }
