/**
 * Content block utilities for parsing and building
 * exam content templates across all module types.
 */

export interface ContentBlock {
  type: string;
  content?: string;
}

const ALLOWED_BLOCK_TYPES = new Set([
  "header",
  "instruction",
  "title",
  "subtitle",
  "box",
  "text",
  "image",
]);

/**
 * Parse a content template into renderable blocks.
 * Used by listening, reading, and writing test clients.
 */
export function buildBlocks(
  template?: string | null,
  subType?: string | null,
  instruction?: string | null,
): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  // Add instruction as first block if it exists
  if (instruction) {
    blocks.push({ type: "instruction", content: instruction });
  }

  if (!template) return blocks;

  try {
    const parsed = JSON.parse(template);
    if (Array.isArray(parsed)) return [...blocks, ...parsed];
    if (parsed?.type) return [...blocks, parsed];
  } catch {
    // fall through
  }

  // Detect image URLs
  if (
    template.startsWith("http") &&
    (template.includes("/image/") ||
      template.match(/\.(jpg|jpeg|png|gif|webp)$/i))
  ) {
    blocks.push({ type: "image", content: template });
    return blocks;
  }

  const type = subType && ALLOWED_BLOCK_TYPES.has(subType) ? subType : "text";
  blocks.push({ type, content: template });
  return blocks;
}

/**
 * Convert raw passage content (plain text or HTML) into renderable blocks.
 * Used by reading test client for the passage panel.
 */
export function buildPassageBlocks(content?: string | null): ContentBlock[] {
  if (!content) return [];
  const normalized = content.includes("<")
    ? content
    : content.replace(/\n/g, "<br />");
  return [{ type: "html", content: normalized }];
}
