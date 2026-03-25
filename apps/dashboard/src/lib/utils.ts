/**
 * Merge CSS class names, filtering out falsy values.
 * Lightweight alternative to clsx/classnames.
 */
export function cn(
  ...classes: (string | boolean | null | undefined)[]
): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Format a date for display in the dashboard.
 * Examples: "Today, 3:42 PM" | "Yesterday, 11:00 AM" | "Mar 24, 2026"
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const dayDiff = Math.floor(
    (now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) /
      (1000 * 60 * 60 * 24),
  );

  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Yesterday, ${time}`;
  if (dayDiff < 7) {
    const day = d.toLocaleDateString('en-US', { weekday: 'long' });
    return `${day}, ${time}`;
  }

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Convert any text into a URL-safe slug.
 * "Pipo House Susukino #2" → "pipo-house-susukino-2"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

type AccessLevel = 'PUBLIC' | 'AI_READABLE' | 'STAFF_ONLY' | 'ENCRYPTED';

interface AccessLevelBadge {
  emoji: string;
  label: string;
  color: string;
}

/**
 * Returns display metadata for a knowledge item access level.
 *
 * Visual convention:
 *  PUBLIC       → green globe     — visible to guests
 *  AI_READABLE  → yellow robot    — AI can use but not quoted to guests
 *  STAFF_ONLY   → grey lock       — staff dashboard only
 *  ENCRYPTED    → red key         — secret vault, only hints shown to guests
 */
export function getAccessLevelBadge(level: AccessLevel): AccessLevelBadge {
  const badges: Record<AccessLevel, AccessLevelBadge> = {
    PUBLIC: {
      emoji: '🟢',
      label: 'Public',
      color: '#22c55e',
    },
    AI_READABLE: {
      emoji: '🟡',
      label: 'AI Readable',
      color: '#f59e0b',
    },
    STAFF_ONLY: {
      emoji: '🔒',
      label: 'Staff Only',
      color: '#8892a4',
    },
    ENCRYPTED: {
      emoji: '🔐',
      label: 'Encrypted',
      color: '#ef4444',
    },
  };

  return badges[level] ?? badges.STAFF_ONLY;
}

/**
 * Truncate a string to a max length, appending ellipsis if needed.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format a number with locale-aware thousands separators.
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}
