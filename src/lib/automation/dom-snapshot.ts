import type { Page } from "playwright-core";
import type { DomNode } from "@/lib/integrations/yahoo/types";
import { AppError } from "@/lib/errors";

export const DOM_SNAPSHOT_MAX_NODES = 6000;

export function serializeDomScript(maxNodes: number): string {
  return `(() => {
    const MAX = ${maxNodes};
    let count = 0;
    const keep = new Set(["class", "id", "role", "aria-label", "data-testid", "data-player-id", "data-team-id", "data-pick", "href"]);
    const walk = (element) => {
      if (count >= MAX) { return null; }
      count += 1;
      if (element.nodeType === 3) {
        const text = (element.textContent || "").replace(/\\s+/g, " ").trim();
        return text ? { tag: "#text", text, attrs: {}, children: [] } : null;
      }
      if (element.nodeType !== 1) { return null; }
      const tag = element.tagName.toLowerCase();
      if (tag === "script" || tag === "style" || tag === "svg" || tag === "noscript") { return null; }
      const attrs = {};
      for (const attribute of element.attributes) {
        const name = attribute.name.toLowerCase();
        if (keep.has(name) || name.startsWith("data-")) { attrs[name] = attribute.value.slice(0, 200); }
      }
      const children = [];
      for (const child of element.childNodes) {
        const node = walk(child);
        if (node) { children.push(node); }
      }
      return { tag, text: "", attrs, children };
    };
    const root = walk(document.body) || { tag: "body", text: "", attrs: {}, children: [] };
    return { tag: "root", text: "", attrs: {}, children: [root] };
  })()`;
}

export async function captureDomTree(page: Page, maxNodes: number = DOM_SNAPSHOT_MAX_NODES): Promise<DomNode> {
  try {
    const tree = await page.evaluate(serializeDomScript(maxNodes));
    return tree as DomNode;
  } catch (error) {
    throw new AppError("SELECTOR_FAILURE", "Failed to serialize page DOM", { cause: error, retryable: true });
  }
}

export async function captureFrameTrees(page: Page): Promise<DomNode[]> {
  const trees: DomNode[] = [];
  for (const frame of page.frames()) {
    try {
      const tree = await frame.evaluate(serializeDomScript(DOM_SNAPSHOT_MAX_NODES));
      trees.push(tree as DomNode);
    } catch {
      // cross-origin or detached frames are skipped
    }
  }
  if (trees.length === 0) {
    trees.push(await captureDomTree(page));
  }
  return trees;
}
