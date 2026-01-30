export function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function prettyType(type?: string): string {
  if (!type) return '';
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function generateUserId(): string {
  const stored = localStorage.getItem('clip_user_id');
  if (stored) return stored;

  const newId = crypto.randomUUID();
  localStorage.setItem('clip_user_id', newId);
  return newId;
}
