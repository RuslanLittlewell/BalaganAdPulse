export interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
}

export type Block =
  | { kind: "paragraph"; runs: Run[] }
  | { kind: "list"; ordered: boolean; items: Block[][] };

interface Node {
  type?: string;
  text?: string;
  marks?: Array<{ type?: string }>;
  content?: Node[];
}

function runsOf(nodes: Node[] | undefined): Run[] {
  return (nodes ?? []).flatMap((node): Run[] => {
    if (node.type === "hardBreak") return [{ text: "\n", bold: false, italic: false }];
    if (node.type === "text") {
      const marks = new Set((node.marks ?? []).map((mark) => mark.type));
      return [{ text: node.text ?? "", bold: marks.has("bold"), italic: marks.has("italic") }];
    }
    return runsOf(node.content);
  });
}

function blocksOf(nodes: Node[] | undefined): Block[] {
  return (nodes ?? []).flatMap((node): Block[] => {
    if (node.type === "bulletList" || node.type === "orderedList") {
      return [{
        kind: "list",
        ordered: node.type === "orderedList",
        items: (node.content ?? []).map((item) => blocksOf(item.content)),
      }];
    }
    if (node.type === "paragraph" || node.type === "heading") return [{ kind: "paragraph", runs: runsOf(node.content) }];
    const runs = runsOf(node.content ?? [node]);
    return runs.length > 0 ? [{ kind: "paragraph", runs }] : blocksOf(node.content);
  });
}

export function toBlocks(document: unknown): Block[] {
  if (document == null || typeof document !== "object") return [];
  return blocksOf((document as Node).content);
}
