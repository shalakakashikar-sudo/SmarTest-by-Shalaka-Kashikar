// api/time.js  (Next.js / Vercel Serverless API)
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ serverTime: Date.now() });
}
