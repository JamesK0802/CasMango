export type CurationItemKind = 'file' | 'gene' | 'group';
export interface CurationItem { kind: CurationItemKind; key: string }

/** One idempotent action per gesture; repeated visits never toggle an item back. */
export class CurationSweep {
  readonly items = new Map<string, CurationItem>();
  constructor(readonly kind: CurationItemKind, readonly excluded: boolean) {}
  add(item: CurationItem): boolean {
    if (item.kind !== this.kind || this.items.has(item.key)) return false;
    this.items.set(item.key, item);
    return true;
  }
}

export function curationRange(keys: string[], from: string, to: string): string[] {
  const start = keys.indexOf(from), end = keys.indexOf(to);
  return start < 0 || end < 0 ? [to] : keys.slice(Math.min(start, end), Math.max(start, end) + 1);
}
