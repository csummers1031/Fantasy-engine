import type { DomDraftPick, DomDraftSnapshot, DomNode } from "./types";

const POSITION_PATTERN = /\b(QB|RB|WR|TE|K|DEF|DST|D\/ST)\b/i;
const CLOCK_PATTERN = /(\d{1,2}):(\d{2})/;
const PICK_PATTERN = /(?:pick|#)\s*(\d{1,3})/i;
const ATTR_PATTERN = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

export function parseHtmlToTree(html: string): DomNode {
  const root: DomNode = { tag: "root", text: "", attrs: {}, children: [] };
  const stack: DomNode[] = [root];
  const tokenizer = /<!--[\s\S]*?-->|<\/([a-zA-Z][^\s>/]*)\s*>|<([a-zA-Z][^\s>/]*)([^>]*?)(\/?)>|([^<]+)/g;
  let match: RegExpExecArray | null = tokenizer.exec(html);
  while (match !== null) {
    const closing = match[1];
    const opening = match[2];
    const attrText = match[3] ?? "";
    const selfClosing = match[4] === "/";
    const text = match[5];
    const current = stack[stack.length - 1] ?? root;
    if (closing) {
      const tag = closing.toLowerCase();
      for (let index = stack.length - 1; index > 0; index -= 1) {
        const candidate = stack[index];
        if (candidate && candidate.tag === tag) {
          stack.splice(index);
          break;
        }
      }
    } else if (opening) {
      const tag = opening.toLowerCase();
      if (tag === "script" || tag === "style") {
        const closeIndex = html.indexOf(`</${tag}`, tokenizer.lastIndex);
        tokenizer.lastIndex = closeIndex >= 0 ? closeIndex : html.length;
      } else {
        const attrs: Record<string, string> = {};
        let attrMatch: RegExpExecArray | null = ATTR_PATTERN.exec(attrText);
        while (attrMatch !== null) {
          const name = attrMatch[1];
          if (name) {
            attrs[name.toLowerCase()] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
          }
          attrMatch = ATTR_PATTERN.exec(attrText);
        }
        ATTR_PATTERN.lastIndex = 0;
        const node: DomNode = { tag, text: "", attrs, children: [] };
        current.children.push(node);
        if (!selfClosing && !VOID_TAGS.has(tag)) {
          stack.push(node);
        }
      }
    } else if (text !== undefined) {
      const trimmed = text.replace(/\s+/g, " ").trim();
      if (trimmed !== "") {
        current.children.push({ tag: "#text", text: trimmed, attrs: {}, children: [] });
      }
    }
    match = tokenizer.exec(html);
  }
  return root;
}

export function textContent(node: DomNode): string {
  if (node.tag === "#text") {
    return node.text;
  }
  return node.children.map(textContent).filter((part) => part !== "").join(" ").replace(/\s+/g, " ").trim();
}

export function walk(node: DomNode, visit: (node: DomNode, depth: number) => void, depth: number = 0): void {
  visit(node, depth);
  for (const child of node.children) {
    walk(child, visit, depth + 1);
  }
}

export function attrIncludes(node: DomNode, needle: string): boolean {
  const lowered = needle.toLowerCase();
  for (const [key, value] of Object.entries(node.attrs)) {
    if (key === "class" || key === "id" || key.startsWith("data-")) {
      if (value.toLowerCase().includes(lowered)) {
        return true;
      }
    }
  }
  return false;
}

export function findAll(node: DomNode, predicate: (node: DomNode) => boolean): DomNode[] {
  const matches: DomNode[] = [];
  walk(node, (candidate) => {
    if (predicate(candidate)) {
      matches.push(candidate);
    }
  });
  return matches;
}

function extractPosition(text: string): { position: string; team: string } {
  const match = POSITION_PATTERN.exec(text);
  const position = match ? match[1]?.toUpperCase() ?? "" : "";
  const normalized = position === "DST" || position === "D/ST" ? "DEF" : position;
  const teamMatch = /\b([A-Z]{2,3})\s*[-–]\s*(?:QB|RB|WR|TE|K|DEF|DST)\b/i.exec(text) ?? /\(([A-Z]{2,3})\)/.exec(text);
  return { position: normalized, team: teamMatch ? (teamMatch[1] ?? "").toUpperCase() : "" };
}

const TRAILING_TEAM_PATTERN = /\s+[A-Z]{2,3}$/;

function cleanName(text: string): string {
  return text.replace(PICK_PATTERN, "").replace(POSITION_PATTERN, "").replace(/[-–(].*$/, "").replace(TRAILING_TEAM_PATTERN, "").replace(/\s+/g, " ").trim();
}

function descendants(node: DomNode): DomNode[] {
  const nodes: DomNode[] = [];
  for (const child of node.children) {
    walk(child, (candidate) => {
      nodes.push(candidate);
    });
  }
  return nodes;
}

function extractPlayerName(node: DomNode): string {
  const inner = descendants(node);
  const preferred = [...inner.filter((candidate) => attrIncludes(candidate, "name")), ...inner.filter((candidate) => attrIncludes(candidate, "player"))];
  for (const nameNode of preferred) {
    const text = cleanName(textContent(nameNode));
    if (text.length >= 3) {
      return text;
    }
  }
  return cleanName(textContent(node));
}

export function extractDraftPicks(root: DomNode): DomDraftPick[] {
  const pickNodes = findAll(root, (node) => (node.tag === "li" || node.tag === "tr" || node.tag === "div") && attrIncludes(node, "pick") && !attrIncludes(node, "picks"));
  const picks: DomDraftPick[] = [];
  let sequential = 0;
  for (const node of pickNodes) {
    const text = textContent(node);
    if (text === "") {
      continue;
    }
    const pickMatch = PICK_PATTERN.exec(text);
    sequential += 1;
    const overall = pickMatch ? Number(pickMatch[1]) : sequential;
    const { position, team } = extractPosition(text);
    const teamNodes = findAll(node, (candidate) => attrIncludes(candidate, "team") && !attrIncludes(candidate, "player"));
    const teamName = teamNodes.length > 0 ? textContent(teamNodes[0] as DomNode) : "";
    const playerName = extractPlayerName(node);
    if (playerName === "") {
      continue;
    }
    picks.push({ overall, teamName, playerName, position, team });
  }
  const unique = new Map<number, DomDraftPick>();
  for (const pick of picks) {
    if (!unique.has(pick.overall)) {
      unique.set(pick.overall, pick);
    }
  }
  return [...unique.values()].sort((a, b) => a.overall - b.overall);
}

export function extractClockSeconds(root: DomNode): number {
  const clockNodes = findAll(root, (node) => attrIncludes(node, "timer") || attrIncludes(node, "clock") || attrIncludes(node, "countdown"));
  for (const node of clockNodes) {
    const text = textContent(node);
    const match = CLOCK_PATTERN.exec(text);
    if (match) {
      return Number(match[1]) * 60 + Number(match[2]);
    }
    const seconds = /(\d{1,3})\s*s(?:ec)?\b/i.exec(text);
    if (seconds) {
      return Number(seconds[1]);
    }
  }
  return -1;
}

export function extractOnClockTeam(root: DomNode): string {
  const nodes = findAll(root, (node) => attrIncludes(node, "on-clock") || attrIncludes(node, "onclock") || attrIncludes(node, "current-pick") || attrIncludes(node, "now-picking"));
  for (const node of nodes) {
    const text = textContent(node);
    if (text !== "") {
      return text.replace(/on the clock/i, "").replace(/now picking/i, "").trim();
    }
  }
  return "";
}

export function extractUserTeam(root: DomNode): string {
  const nodes = findAll(root, (node) => attrIncludes(node, "my-team") || attrIncludes(node, "myteam") || attrIncludes(node, "user-team"));
  for (const node of nodes) {
    const text = textContent(node);
    if (text !== "") {
      return text;
    }
  }
  return "";
}

export function extractAvailablePlayers(root: DomNode): Array<{ playerName: string; position: string; team: string }> {
  const rows = findAll(root, (node) => (node.tag === "tr" || node.tag === "li" || node.tag === "div") && (attrIncludes(node, "available") || attrIncludes(node, "player-row") || attrIncludes(node, "playerrow")));
  const players: Array<{ playerName: string; position: string; team: string }> = [];
  for (const row of rows) {
    const text = textContent(row);
    const { position, team } = extractPosition(text);
    const playerName = extractPlayerName(row);
    if (playerName !== "" && position !== "") {
      players.push({ playerName, position, team });
    }
  }
  return players;
}

export function parseDraftDom(root: DomNode): DomDraftSnapshot {
  return {
    picks: extractDraftPicks(root),
    onClockTeamName: extractOnClockTeam(root),
    secondsRemaining: extractClockSeconds(root),
    userTeamName: extractUserTeam(root),
    available: extractAvailablePlayers(root),
  };
}

export function parseDraftHtml(html: string): DomDraftSnapshot {
  return parseDraftDom(parseHtmlToTree(html));
}
