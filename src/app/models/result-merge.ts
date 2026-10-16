/** Match a logical target without collapsing repeated guide sequences. */
export function findMergeTarget<T extends {
  target_id: string; sgrna_seq?: string; display_sgrna_seq?: string;
  ref_sequence?: string; cut_site_index?: number;
}>(existing: T[], incoming: T, incomingTargets: T[]): T | undefined {
  const normalized = (value: unknown) => String(value ?? '').replace(/\s+/g, '').toUpperCase();
  const context = (target: T) => JSON.stringify([
    normalized(target.sgrna_seq || target.display_sgrna_seq),
    normalized(target.ref_sequence), target.cut_site_index ?? null,
  ]);
  const identity = context(incoming);
  const candidates = existing.filter(target => context(target) === identity);
  const aliases = new Set(incoming.target_id.split('/').map(value => value.trim()));
  const named = candidates.filter(target => target.target_id.split('/').some(value => aliases.has(value.trim())));
  if (named.length === 1) return named[0];
  // Different names may describe the same guide/window, but only when that
  // context identifies a single target on both sides. Never guess among duplicates.
  const guide = normalized(incoming.sgrna_seq || incoming.display_sgrna_seq);
  if (guide && candidates.length === 1 && incomingTargets.filter(target => context(target) === identity).length === 1) {
    return candidates[0];
  }
  return undefined;
}
