import crypto from 'crypto';

export interface DemoTokenPayload {
  sub: string;
  email: string;
  roles: string[];
  department_ids: string[];
  exp: number;
}

function secret(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error('Supabase service credentials are not configured');
  return value;
}

export function signDemoToken(
  payload: Omit<DemoTokenPayload, 'exp'>,
  ttlSeconds = 60 * 60 * 12
): string {
  const full: DemoTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(full)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `demo.${body}.${signature}`;
}

export function verifyDemoToken(token: string): DemoTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'demo') return null;
  const [, body, signature] = parts;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest();
  const received = Buffer.from(signature, 'base64url');
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as DemoTokenPayload;
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}
