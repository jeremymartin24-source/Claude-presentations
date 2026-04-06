export interface SessionMeta {
  sessionId: number;
  gameType: string;
  bankId: number;
  courseId?: number;
}

const activeSessions = new Map<string, SessionMeta>();

export function registerPin(pin: string, data: SessionMeta): void {
  activeSessions.set(pin, data);
}

export function resolvePin(pin: string): SessionMeta | undefined {
  return activeSessions.get(pin);
}

export function removePin(pin: string): void {
  activeSessions.delete(pin);
}

export function isActivePin(pin: string): boolean {
  return activeSessions.has(pin);
}

export function getAllActivePins(): string[] {
  return Array.from(activeSessions.keys());
}
