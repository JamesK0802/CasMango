const filenameOrder = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Natural filename ordering: sample2 precedes sample10. Stable for equal names. */
export function compareSequenceNames(a: string, b: string): number {
  return filenameOrder.compare(a, b);
}

/** Move without cloning File objects or changing their associated reference keys. */
export function moveSequenceFile<T>(files: T[], source: T, target: T, after = false): T[] {
  if (source === target || !files.includes(source) || !files.includes(target)) return files;
  const reordered = [...files];
  reordered.splice(files.indexOf(source), 1);
  reordered.splice(reordered.indexOf(target) + (after ? 1 : 0), 0, source);
  return reordered;
}
