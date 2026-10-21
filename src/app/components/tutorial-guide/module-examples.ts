import { ProjectItem } from '../../models/sequence.model';
import { findGrnaCutSite, reverseComplement } from '../../workers/core/classifier';

export const GUIDE_GRNA = 'AATATCTCTCTATCTCCTC';
export const GUIDE_REFERENCE = 'AAATTTGAAATTCCTAAGCAATTTTTTCTTCTTATATATATAGATAATTATACATTCCAAAATAGTAATTCAAGGACAGGTACATTTCCTTTTTTTCTTGTCTTGTGAATTAAGGAGAGGAAAATTTTCTTTTAATCCAAACAAAAAAAATCATTTCCTAAAAAAGTCTCTTCGTCTGTTGGCAAAAACGACGCCGTGTTTCATAAGCCAATATCTCTCTATCTCCTCCGGCGTCCGTCCCGGGATCCTTCCGGCGATCAACTCCCACCTACGCGCCACGTAGGATAGGCTAACAGTCAGTGTTGAGGAACTTACACTTAACCAAATACCTTTTATTCCGATAAAAACCGCATAAAGTTTGTAATTCGGTTAAAATTCTATGGAACCGAACCAAAATCGTAATTTACACTTTGACTTCATACAAACATGCTGTAATCAAAATTGAACCAA';
export const GUIDE_TRY_REFERENCE = 'GAATTAGGTGGGATTTGATAGCAGGAAGAGTTCCTGGAAGACAACCAGAGGAGATAGAGAGATATTGGATAATGAGAAACAGTGAAGGCTTTGCTGATAAACGACGCCAGCTTCACTCATCTTCCCACAAACATACCAAGCCTCACCGTCCTCGCTTTTCTATCTATCCTTCCTAG';
export const GUIDE_WORKSPACE_READ_COUNT = 96;
export const GUIDE_BENCHMARK_CLASS_READ_COUNT = 48;
export const GUIDE_NORMALIZATION_PAIR_COUNT = 48;

function fastq(name: string, reads: string[], idPrefix = name): File {
  return new File([reads.map((seq, i) => `@${idPrefix}_${i + 1}\n${seq}\n+\n${'I'.repeat(seq.length)}\n`).join('')], `${name}.fastq`, { type: 'text/plain' });
}

export function benchmarkExampleRows() {
  return [['CPC', GUIDE_REFERENCE], ['TRY', GUIDE_TRY_REFERENCE]].map(([gene, ref]) => {
    const cut = findGrnaCutSite(ref, GUIDE_GRNA).cut_site;
    const deletion = ref.slice(0, cut) + ref.slice(cut + 1);
    return { geneName: gene, referenceSequence: ref, targetName: 't1', grnaSequence: GUIDE_GRNA,
      file: fastq(`guide_${gene}`, Array.from({length: GUIDE_BENCHMARK_CLASS_READ_COUNT}, (_,i) => i % 3 === 2 ? deletion : ref)), r1File: null, r2File: null };
  });
}

export function normalizationExampleMates() {
  // Alternate true 50-bp overlaps and separated reference ends.
  const overlap = GUIDE_REFERENCE.slice(160, 260);
  return {
    r1: fastq('guide_R1', Array.from({length: GUIDE_NORMALIZATION_PAIR_COUNT}, (_,i) => i % 2 === 0 ? overlap.slice(0, 75) : GUIDE_REFERENCE.slice(0, 75)), 'guide_pair'),
    r2: fastq('guide_R2', Array.from({length: GUIDE_NORMALIZATION_PAIR_COUNT}, (_,i) => reverseComplement(i % 2 === 0 ? overlap.slice(25) : GUIDE_REFERENCE.slice(-75))), 'guide_pair'),
  };
}

export function workspaceExampleItems(): ProjectItem[] {
  const info = findGrnaCutSite(GUIDE_REFERENCE, GUIDE_GRNA);
  const cut = info.cut_site;
  const variants = [GUIDE_REFERENCE, GUIDE_REFERENCE.slice(0, cut) + GUIDE_REFERENCE.slice(cut + 1),
    GUIDE_REFERENCE.slice(0, cut) + 'A' + GUIDE_REFERENCE.slice(cut)];
  const sequences = Array.from({length: GUIDE_WORKSPACE_READ_COUNT}, (_,i) => variants[i % variants.length]);
  const lengths = sequences.map(s => s.length);
  const lengthDistribution = lengths.reduce<Record<number, number>>((bins,length) => { bins[length] = (bins[length] || 0) + 1; return bins; }, {});
  return [{ type: 'sequence', id: 'guide-cpc-reference', name: 'Guide · CPC reference',
    description: 'Temporary annotated tutorial example; your saved workspace is restored when the tour ends.',
    sequence: GUIDE_REFERENCE, topology: 'linear', sourceFormat: 'tutorial', primers: [], createdTimestamp: 0, updatedTimestamp: 0,
    features: [{ id: 'guide-target', name: 'gRNA target', type: 'misc_feature', start: info.grna_start, end: info.grna_end, strand: 1, color: '#009E73' },
      { id: 'guide-pam', name: 'PAM', type: 'misc_feature', start: info.grna_end, end: info.grna_end + 3, strand: 1, color: '#E69F00' }] },
    { type: 'fastq', id: 'guide-cpc-reads', name: 'Guide · WT and edited reads.fastq', description: 'Synthetic WT, −1 bp and +1 bp reads.',
      createdTimestamp: 0, updatedTimestamp: 0,
      reads: sequences.map((seq, i) => ({ id: ['WT', 'Deletion_1bp', 'Insertion_1bp'][i % 3] + (i < 3 ? '' : '_' + String(Math.floor(i / 3) + 1).padStart(3, '0')), seq, qual: Array(seq.length).fill(40), qualString: 'I'.repeat(seq.length) })),
      stats: { readCount: sequences.length, avgLength: lengths.reduce((a,b)=>a+b,0) / sequences.length, minLength: Math.min(...lengths), maxLength: Math.max(...lengths),
        avgGC: 100 * sequences.join('').replace(/[^GC]/g, '').length / lengths.reduce((a, b) => a + b), avgQuality: 40,
        lengthDistribution, qualityDistribution: { 40: sequences.length } },
      autoAlign: { windowSeq: GUIDE_REFERENCE.slice(cut - 45, cut + 45), refSeq: GUIDE_REFERENCE, grnaSeq: GUIDE_GRNA, winSize: 90 } }];
}

/** A genuine FASTQ import, sharing the full workspace example dataset. */
export function workspaceExampleFile(): File {
  const item = workspaceExampleItems().find(i => i.type === 'fastq') as any;
  return new File([item.reads.map((r: any) => `@${r.id}\n${r.seq}\n+\n${r.qualString}\n`).join('')],
    'guide_WT_and_edited_reads.fastq', { type: 'text/plain' });
}
