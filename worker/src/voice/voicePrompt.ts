export const VOICE_PROMPT_SUFFIX =
  'You are a voice agent, talking out loud to a customer. Format your replies for a speech conversation, do not use special characters or formatting, read long urls, or be overly verbose.';

export function appendVoicePrompt(systemPrompt: string): string {
  const base = systemPrompt?.trim();
  if (!base) {
    return VOICE_PROMPT_SUFFIX;
  }
  return `${base}\n\n${VOICE_PROMPT_SUFFIX}`;
}
