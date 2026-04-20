export const DEFAULT_SUPER_AGENT_PROMPT = 'Wake up, review the latest conversation context and repository state, then continue the most valuable autonomous work you can do without waiting for a human.';

export const DEFAULT_SUPER_AGENT_HEARTBEAT_MINUTES = 15;

export const DEFAULT_SUPER_AGENT_MODEL = 'ona-hands-off';

export function getNextHeartbeatAt(heartbeatMinutes: number, now = new Date()) {
  return new Date(now.getTime() + (heartbeatMinutes * 60 * 1000));
}

export function buildSuperAgentHeartbeatMessage(wakePrompt: string, now = new Date()) {
  return `${wakePrompt.trim()}\n\n[Heartbeat wake-up]\nUTC time: ${now.toISOString()}\nRe-read the conversation, inspect the latest repo state, decide what proactive work matters most right now, and do it.`;
}
