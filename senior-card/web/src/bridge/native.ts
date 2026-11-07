// Bridge to the TownPass App (window.flutterObject).
// Ported from ref/p0.html. One listener, requests serialized per name:
// concurrent calls with the same name supersede the previous one, so
// replies can never be mismatched.
import type { FlutterObject } from './types';

interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, PendingRequest>();
let attachedTo: FlutterObject | null = null;

export function isInApp(): boolean {
  const b = window.flutterObject;
  return !!b && typeof b.postMessage === 'function';
}

function bridge(): FlutterObject | null {
  const b = window.flutterObject;
  if (!b || typeof b.postMessage !== 'function') return null;
  if (attachedTo !== b) {
    b.addEventListener('message', (event: MessageEvent) => {
      try {
        const res = JSON.parse(event.data as string) as { name?: string; data?: unknown };
        if (typeof res.name !== 'string') return;
        const req = pending.get(res.name);
        if (req) {
          pending.delete(res.name);
          clearTimeout(req.timer);
          req.resolve(res.data);
        }
      } catch {
        // Ignore unexpected native replies.
      }
    });
    attachedTo = b;
  }
  return b;
}

export class BridgeError extends Error {}

/** Send a request and wait for the reply with the same name. */
export function callNative<T>(name: string, data: unknown, timeoutMs: number): Promise<T> {
  const b = bridge();
  if (!b) return Promise.reject(new BridgeError('not-in-app'));
  const prev = pending.get(name);
  if (prev) {
    clearTimeout(prev.timer);
    prev.reject(new BridgeError('superseded'));
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(name);
      reject(new BridgeError('timeout'));
    }, timeoutMs);
    pending.set(name, {
      resolve: (d) => resolve(d as T),
      reject,
      timer,
    });
    try {
      b.postMessage(JSON.stringify({ name, data }));
    } catch (e) {
      pending.delete(name);
      clearTimeout(timer);
      reject(e instanceof Error ? e : new BridgeError('post-failed'));
    }
  });
}

/** Fire-and-forget message (for handlers that never reply). */
export function postNative(name: string, data: unknown): void {
  const b = bridge();
  if (b) {
    try {
      b.postMessage(JSON.stringify({ name, data }));
    } catch {
      // Best effort only.
    }
  }
}
