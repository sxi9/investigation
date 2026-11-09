// TOTP (RFC 6238) for local accounts: base32 secrets, otpauth URIs, HMAC-SHA1 codes, ±1 step window.
import crypto from 'node:crypto';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(buf) { let bits = 0, val = 0, out = ''; for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) out += B32[(val << (5 - bits)) & 31]; return out; }
export function unbase32(s) { let bits = 0, val = 0; const out = []; for (const ch of String(s).toUpperCase().replace(/=+$/, '').replace(/\s/g, '')) { const i = B32.indexOf(ch); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }
export const newSecret = () => base32(crypto.randomBytes(20));
export function code(secret, step = Math.floor(Date.now() / 30000)) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', unbase32(secret)).update(msg).digest();
  const o = h[19] & 15; const n = ((h[o] & 127) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1000000;
  return String(n).padStart(6, '0');
}
export function verify(secret, input, window = 1) { const c = String(input || '').replace(/\s/g, ''); if (!/^\d{6}$/.test(c)) return false; const step = Math.floor(Date.now() / 30000); for (let d = -window; d <= window; d++) { const want = code(secret, step + d); if (want.length === c.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(c))) return true; } return false; }
export const uri = (secret, name, issuer = 'Investigation Board') => 'otpauth://totp/' + encodeURIComponent(issuer) + ':' + encodeURIComponent(name) + '?secret=' + secret + '&issuer=' + encodeURIComponent(issuer) + '&algorithm=SHA1&digits=6&period=30';
