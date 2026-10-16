import { describe, expect, it } from 'vitest';
import { collectDroppedEntries, copySequenceFiles, DroppedEntry, isSequenceFile, LocalDirectory } from './sequence-file-io';
import { addFilesToIlluminaPairs } from './illumina.model';

const fileEntry = (name: string): DroppedEntry => ({ name, isFile: true, isDirectory: false, file: resolve => resolve(new File(['abc'], name)) });
function directory(name: string, batches: DroppedEntry[][]): DroppedEntry {
  return { name, isDirectory: true, isFile: false, createReader: () => {
    let index = 0;
    return { readEntries: resolve => resolve(batches[index++] || []) };
  } };
}
describe('sequence folder input', () => {
  it('includes all four supported extensions, case-insensitively, but not unrelated gzip files', () => {
    for (const name of ['a.fq', 'a.fastq', 'a.FQ.GZ', 'a.fastq.gz']) expect(isSequenceFile(name)).toBe(true);
    for (const name of ['a.gz', 'a.fastq.txt', 'a.fasta']) expect(isSequenceFile(name)).toBe(false);
  });
  it('reads every directory batch and multiple nested roots', async () => {
    const files = await collectDroppedEntries([
      directory('one', [Array.from({ length: 100 }, (_, i) => fileEntry(`${i}.fq`)), [directory('nested', [[fileEntry('deep.fastq.gz'), fileEntry('notes.txt')]])]]),
      directory('two', [[fileEntry('other.fq.gz')]]),
    ]);
    expect(files).toHaveLength(102);
    expect(files.map(item => item.path)).toContain('one/nested/deep.fastq.gz');
    expect(files.map(item => item.path)).toContain('two/other.fq.gz');
  });
  it('rejects unreadable entries instead of silently returning a partial collection', async () => {
    const bad = { ...fileEntry('bad.fq'), file: (_: unknown, reject: (error: DOMException) => void) => reject(new DOMException('denied', 'NotAllowedError')) };
    await expect(collectDroppedEntries([fileEntry('good.fq'), bad])).rejects.toThrow('denied');
  });
  it('does not pair identical sample names across different folders', () => {
    const a = new File(['a'], 'sample_R1.fq'), b = new File(['b'], 'sample_R2.fq');
    const paths = new Map([[a, 'one/sample_R1.fq'], [b, 'two/sample_R2.fq']]);
    const pairs = addFilesToIlluminaPairs([], [a, b], file => paths.get(file)!);
    expect(pairs).toHaveLength(2);
    const c = new File(['c'], 'sample_R2.fq'); paths.set(c, 'one/sample_R2.fq');
    expect(addFilesToIlluminaPairs(pairs, [c], file => paths.get(file)!)[0].r2).toBe(c);
  });
});

describe('local input collection', () => {
  function destination(exists = false, failAt = '') {
    const bytes = new Map<string, Uint8Array[]>();
    const folder: LocalDirectory = { name: 'collection', getDirectoryHandle: async () => { throw new Error('unused'); },
      getFileHandle: async name => ({ createWritable: async () => new WritableStream<Uint8Array>({ write(chunk) {
        if (name === failAt) throw new Error('Disk full');
        if (!bytes.has(name)) bytes.set(name, []);
        bytes.get(name)!.push(chunk);
      } }) }),
    };
    const parent: LocalDirectory = { ...folder, name: 'parent', getDirectoryHandle: async (_name, options) => {
      if (!options?.create && !exists) throw new DOMException('missing', 'NotFoundError');
      return folder;
    } };
    return { parent, bytes };
  }
  it('streams byte-identical gzip copies and preserves duplicate filenames with suffixes', async () => {
    const { parent, bytes } = destination();
    const payload = new Uint8Array([31, 139, 0, 255, 10]);
    const files = [new File([payload], 'read.fq.gz'), new File(['second'], 'read.fq.gz')];
    const progress: number[] = [];
    await copySequenceFiles(parent, 'new', files, count => progress.push(count));
    expect([...bytes.keys()]).toEqual(['read.fq.gz', 'read (2).fq.gz']);
    expect([...bytes.get('read.fq.gz')![0]]).toEqual([...payload]);
    expect(progress).toEqual([1, 2]);
    expect(new Uint8Array(await files[0].arrayBuffer())).toEqual(payload);
  });
  it('refuses an existing output folder and unsafe folder names', async () => {
    const { parent, bytes } = destination(true);
    await expect(copySequenceFiles(parent, 'existing', [], () => {})).rejects.toThrow('already exists');
    await expect(copySequenceFiles(parent, '../outside', [], () => {})).rejects.toThrow('folder name');
    expect(bytes.size).toBe(0);
  });
  it('only credits completed copies when a write fails', async () => {
    const { parent } = destination(false, 'bad.fastq'); const progress: number[] = [];
    await expect(copySequenceFiles(parent, 'new', [new File(['a'], 'good.fq'), new File(['b'], 'bad.fastq')], n => progress.push(n))).rejects.toThrow('Disk full');
    expect(progress).toEqual([1]);
  });
});
