/**
 * Knowledge Base File Sync
 *
 * Automatically mirrors every published/updated KB item as a Markdown file at:
 *   ~/Documents/PipoHouse/{property-slug}/{CATEGORY}/{item-title}.md
 *
 * Format uses YAML frontmatter so the files are human-readable and easy to
 * edit in any text editor.  Deleting an item removes the file too.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const ROOT = path.join(os.homedir(), 'Documents', 'PipoHouse');

function safe(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function itemPath(propertySlug: string, category: string, title: string): string {
  return path.join(ROOT, safe(propertySlug), category, `${safe(title)}.md`);
}

function toMarkdown(item: {
  title: string;
  content: string;
  category: string;
  accessLevel: string;
  language: string;
  isPublished: boolean;
  updatedAt: Date;
}): string {
  return [
    '---',
    `title: "${item.title.replace(/"/g, '\\"')}"`,
    `category: ${item.category}`,
    `accessLevel: ${item.accessLevel}`,
    `language: ${item.language}`,
    `published: ${item.isPublished}`,
    `updatedAt: ${item.updatedAt.toISOString()}`,
    '---',
    '',
    item.content,
    '',
  ].join('\n');
}

export function syncKbItem(
  propertySlug: string,
  item: {
    title: string;
    content: string;
    category: string;
    accessLevel: string;
    language: string;
    isPublished: boolean;
    updatedAt: Date;
  },
): void {
  try {
    const filePath = itemPath(propertySlug, item.category, item.title);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, toMarkdown(item), 'utf-8');
  } catch {
    // Non-fatal — don't block the API response
  }
}

export function deleteKbFile(
  propertySlug: string,
  category: string,
  title: string,
): void {
  try {
    const filePath = itemPath(propertySlug, category, title);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Non-fatal
  }
}
