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

export async function copySequenceFiles(
  parent: LocalDirectory, folderName: string, files: File[], onCopied: (count: number) => void,
): Promise<void> {
  if (!validCollectionName(folderName)) throw new Error('Enter a folder name without slashes or leading/trailing spaces.');
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
  for (const file of files) {
    const match = /^(.*?)(\.(?:fastq|fq)(?:\.gz)?)$/i.exec(file.name);
    const stem = match?.[1] || file.name;
    const extension = match?.[2] || '';
    let name = file.name;
    for (let suffix = 2; used.has(name.toLowerCase()); suffix++) name = `${stem} (${suffix})${extension}`;
    used.add(name.toLowerCase());
    const handle = await destination.getFileHandle(name, { create: true });
    // Stream the original bytes, including gzip, without loading whole FASTQs into memory.
    await file.stream().pipeTo(await handle.createWritable());
    onCopied(++count);
  }
}
