import { ProjectItem } from '../../models/sequence.model';
import { findGrnaCutSite, reverseComplement } from '../../workers/core/classifier';

export const GUIDE_GRNA = 'AATATCTCTCTATCTCCTC';
export const GUIDE_REFERENCE = 'AAATTTGAAATTCCTAAGCAATTTTTTCTTCTTATATATATAGATAATTATACATTCCAAAATAGTAATTCAAGGACAGGTACATTTCCTTTTTTTCTTGTCTTGTGAATTAAGGAGAGGAAAATTTTCTTTTAATCCAAACAAAAAAAATCATTTCCTAAAAAAGTCTCTTCGTCTGTTGGCAAAAACGACGCCGTGTTTCATAAGCCAATATCTCTCTATCTCCTCCGGCGTCCGTCCCGGGATCCTTCCGGCGATCAACTCCCACCTACGCGCCACGTAGGATAGGCTAACAGTCAGTGTTGAGGAACTTACACTTAACCAAATACCTTTTATTCCGATAAAAACCGCATAAAGTTTGTAATTCGGTTAAAATTCTATGGAACCGAACCAAAATCGTAATTTACACTTTGACTTCATACAAACATGCTGTAATCAAAATTGAACCAA';
export const GUIDE_TRY_REFERENCE = 'GAATTAGGTGGGATTTGATAGCAGGAAGAGTTCCTGGAAGACAACCAGAGGAGATAGAGAGATATTGGATAATGAGAAACAGTGAAGGCTTTGCTGATAAACGACGCCAGCTTCACTCATCTTCCCACAAACATACCAAGCCTCACCGTCCTCGCTTTTCTATCTATCCTTCCTAG';

function fastq(name: string, reads: string[], idPrefix = name): File {
  return new File([reads.map((seq, i) => `@${idPrefix}_${i + 1}\n${seq}\n+\n${'I'.repeat(seq.length)}\n`).join('')], `${name}.fastq`, { type: 'text/plain' });
}

export function benchmarkExampleRows() {
  return [['CPC', GUIDE_REFERENCE], ['TRY', GUIDE_TRY_REFERENCE]].map(([gene, ref]) => {
    const cut = findGrnaCutSite(ref, GUIDE_GRNA).cut_site;
    const deletion = ref.slice(0, cut) + ref.slice(cut + 1);
    return { geneName: gene, referenceSequence: ref, targetName: 't1', grnaSequence: GUIDE_GRNA,
      file: fastq(`guide_${gene}`, [...Array(8).fill(ref), ...Array(4).fill(deletion)]), r1File: null, r2File: null };
  });
}

export function normalizationExampleMates() {
  // Pair 1 has a true 50-bp overlap. Pair 2 has separated reference ends.
  const overlap = GUIDE_REFERENCE.slice(160, 260);
  return {
    r1: fastq('guide_R1', [overlap.slice(0, 75), GUIDE_REFERENCE.slice(0, 75)], 'guide_pair'),
    r2: fastq('guide_R2', [reverseComplement(overlap.slice(25)), reverseComplement(GUIDE_REFERENCE.slice(-75))], 'guide_pair'),
  };
}

export function workspaceExampleItems(): ProjectItem[] {
  const info = findGrnaCutSite(GUIDE_REFERENCE, GUIDE_GRNA);
  const cut = info.cut_site;
  const sequences = [GUIDE_REFERENCE, GUIDE_REFERENCE.slice(0, cut) + GUIDE_REFERENCE.slice(cut + 1),
    GUIDE_REFERENCE.slice(0, cut) + 'A' + GUIDE_REFERENCE.slice(cut)];
  const lengths = sequences.map(s => s.length);
  return [{ type: 'sequence', id: 'guide-cpc-reference', name: 'Guide · CPC reference',
    description: 'Temporary annotated tutorial example; your saved workspace is restored when the tour ends.',
    sequence: GUIDE_REFERENCE, topology: 'linear', sourceFormat: 'tutorial', primers: [], createdTimestamp: 0, updatedTimestamp: 0,
    features: [{ id: 'guide-target', name: 'gRNA target', type: 'misc_feature', start: info.grna_start, end: info.grna_end, strand: 1, color: '#009E73' },
      { id: 'guide-pam', name: 'PAM', type: 'misc_feature', start: info.grna_end, end: info.grna_end + 3, strand: 1, color: '#E69F00' }] },
    { type: 'fastq', id: 'guide-cpc-reads', name: 'Guide · WT and edited reads.fastq', description: 'Three synthetic reads: WT, −1 bp and +1 bp.',
      createdTimestamp: 0, updatedTimestamp: 0,
      reads: sequences.map((seq, i) => ({ id: ['WT', 'Deletion_1bp', 'Insertion_1bp'][i], seq, qual: Array(seq.length).fill(40), qualString: 'I'.repeat(seq.length) })),
      stats: { readCount: 3, avgLength: GUIDE_REFERENCE.length, minLength: Math.min(...lengths), maxLength: Math.max(...lengths),
        avgGC: 100 * sequences.join('').replace(/[^GC]/g, '').length / lengths.reduce((a, b) => a + b), avgQuality: 40,
        lengthDistribution: Object.fromEntries(lengths.map(n => [n, 1])), qualityDistribution: { 40: 3 } },
      autoAlign: { windowSeq: GUIDE_REFERENCE.slice(cut - 45, cut + 45), refSeq: GUIDE_REFERENCE, grnaSeq: GUIDE_GRNA, winSize: 90 } }];
}
