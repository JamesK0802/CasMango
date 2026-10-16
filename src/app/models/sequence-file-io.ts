/** Folder traversal and byte-preserving local copies; no analysis or server upload. */
export const isSequenceFile = (name: string): boolean => /\.(?:fastq|fq)(?:\.gz)?$/i.test(name);

export interface DroppedEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?(success: (file: File) => void, failure: (error: DOMException) => void): void;
  createReader?(): { readEntries(success: (entries: DroppedEntry[]) => void, failure: (error: DOMException) => void): void };
}

export interface CollectedSequenceFile { file: File; path: string }

export async function collectDroppedEntries(entries: DroppedEntry[]): Promise<CollectedSequenceFile[]> {
  const files: CollectedSequenceFile[] = [];
  // Iterative traversal also handles deeply nested folders without recursive stack growth.
  const pending = entries.map(entry => ({ entry, parent: '' }));
  for (let index = 0; index < pending.length; index++) {
    const { entry, parent } = pending[index];
    const path = parent ? `${parent}/${entry.name}` : entry.name;
    if (entry.isFile && isSequenceFile(entry.name)) {
      const file = await new Promise<File>((resolve, reject) => entry.file!(resolve, reject));
      files.push({ file, path });
    } else if (entry.isDirectory) {
      const reader = entry.createReader!();
      // Chromium returns directory entries in batches; read until an empty batch.
      for (;;) {
        const batch = await new Promise<DroppedEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        if (!batch.length) break;
        pending.push(...batch.map(child => ({ entry: child, parent: path })));
      }
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export interface LocalDirectory {
  name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<LocalDirectory>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{
    createWritable(): Promise<WritableStream<Uint8Array>>;
  }>;
}

export function validCollectionName(name: string): boolean {
  return !!name.trim() && name === name.trim() && name !== '.' && name !== '..' && !/[\\/\x00-\x1f]/.test(name);
}

export function sequenceFilenameParts(name: string): { stem: string; extension: string } {
  const match = /^(.*?)(\.(?:fastq|fq)(?:\.gz)?)$/i.exec(name);
  return { stem: match?.[1] || name, extension: match?.[2] || '' };
}

export function validFileStem(name: string): boolean {
  return validCollectionName(name) && !/[<>:"|?*]/.test(name) && !/[. ]$/.test(name);
}

/** Excel may provide one column of new names or both current/new-name columns. */
export function pastedFileStems(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map(row => {
    const cells = row.split('\t');
    return cells.length > 1 ? cells[1] : cells[0];
  });
}

export async function copySequenceFiles(
  parent: LocalDirectory, folderName: string, files: File[], onCopied: (count: number) => void, newStems?: string[],
): Promise<void> {
  if (!validCollectionName(folderName)) throw new Error('Enter a folder name without slashes or leading/trailing spaces.');
  if (newStems) {
    if (newStems.length !== files.length || newStems.some(name => !validFileStem(name))) throw new Error('Enter a valid new name for every file.');
    const names = newStems.map((name, i) => (name + sequenceFilenameParts(files[i].name).extension).toLowerCase());
    if (new Set(names).size !== names.length) throw new Error('New file names must be unique.');
  }
  // Require a new folder: never overwrite an existing destination or a source file.
  try {
    await parent.getDirectoryHandle(folderName);
    throw new Error('That folder already exists. Choose a new folder name.');
  } catch (error) {
    if ((error as DOMException).name !== 'NotFoundError') throw error;
  }
  const destination = await parent.getDirectoryHandle(folderName, { create: true });
  const used = new Set<string>();
  let count = 0;
  for (const [index, file] of files.entries()) {
    const parts = sequenceFilenameParts(file.name);
    const stem = newStems?.[index] ?? parts.stem;
    const extension = parts.extension;
    let name = stem + extension;
    for (let suffix = 2; used.has(name.toLowerCase()); suffix++) name = `${stem} (${suffix})${extension}`;
    used.add(name.toLowerCase());
    const handle = await destination.getFileHandle(name, { create: true });
    // Stream the original bytes, including gzip, without loading whole FASTQs into memory.
    await file.stream().pipeTo(await handle.createWritable());
    onCopied(++count);
  }
}
