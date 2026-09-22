export function normalizeMarkdownResponse(value: string): string {
  const trimmed = value.trim();
  const match = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i.exec(trimmed);
  return (match?.[1] ?? trimmed).trim();
}
