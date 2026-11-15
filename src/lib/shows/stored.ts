import type { TitleData } from './index';

/** What a project stores for the on-screen title. */
export interface StoredTitle {
  data: TitleData;
  /** Guest name sticker. */
  guest?: string;
  /** Show the show badge (default true). */
  showBadge?: boolean;
  /** Recurring show label, drawn small top-right: "NAME · EP 3". */
  series?: { name: string; episode: number };
}

/** Accepts the current shape and the older `{ take, guest, badge }` shape saved by earlier versions. */
export function resolveTitle(raw: unknown): StoredTitle | null {
  const t = raw as { data?: TitleData; take?: string; guest?: string; badge?: boolean; showBadge?: boolean; series?: { name: string; episode: number } } | undefined;
  if (!t) return null;
  if (t.data) return { data: t.data, guest: t.guest, showBadge: t.showBadge, series: t.series };
  if (typeof t.take === 'string') {
    return { data: { variant: 'take', badge: 'HOT TAKE', badgeBg: '#ffd21f', badgeFg: '#111', headline: t.take }, guest: t.guest, showBadge: t.badge };
  }
  return null;
}
