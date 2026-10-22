import { GeneResult, TargetResult } from '../../models/analysis.model';
import { resolveAnnotationCutSite } from './annotation-cut-site';
import { groupKey } from '../../models/curation.model';

/** Curation retains excluded rows for restoration. Do not include those in figure snapshots. */
export function withoutExcludedGroups(genes: GeneResult[], exclusions: readonly string[] = []): GeneResult[] {
  if (!exclusions.length) return genes;
  const excluded = new Set(exclusions);
  return genes.map(gene => ({ ...gene, analysis_result: { ...gene.analysis_result,
    targets: gene.analysis_result.targets.map(target => ({ ...target,
      top_groups: target.top_groups?.filter(group => !excluded.has(groupKey(gene.gene, target.target_id, group.read_inner))) }))
  } }));
}

/** Presentation-only projections. Never mutate results or infer joint genotypes. */
export interface ComparisonRow {
  name: string;
  target?: TargetResult;
  reads: number;
  wt: number | null;
  substitution: number | null;
  inFrame: number | null;
  outOfFrame: number | null;
  edited: number | null;
}
const finite = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const pct = (value: unknown): number => Math.max(0, Math.min(100, finite(value)));
export function comparisonRows(genes: GeneResult[], names: readonly string[], targetId: string): ComparisonRow[] {
  return genes.filter(g => names.includes(g.gene)).map(g => {
    const target = g.analysis_result.targets.find(t => t.target_id === targetId);
    const summary = target?.summary;
    // The engine percentages use post-filter aligned_reads, not pre-filter matched_reads.
    const reads = Math.max(0, finite(summary?.aligned_reads ?? summary?.matched_reads));
    const available = !!summary && reads > 0;
    const rate = (count: unknown, fallback: unknown): number | null => !available ? null
      : typeof count === 'number' && Number.isFinite(count) ? pct(count * 100 / reads) : pct(fallback);
    const wt = rate(target?.breakdown?.no_indel, summary?.no_indel_pct);
    const substitution = rate(target?.breakdown?.substitution, summary?.substitution_pct);
    const inFrame = rate(target?.breakdown?.in_frame, summary?.in_frame_pct);
    const outOfFrame = rate(target?.breakdown?.out_of_frame, summary?.out_of_frame_pct);
    return { name: g.gene, target, reads, wt,
      substitution, inFrame, outOfFrame,
      edited: wt === null ? null : pct(substitution! + inFrame! + outOfFrame!) };
  });
}

export function comparisonSummary(rows: ComparisonRow[], threshold: number) {
  const evaluated = rows.filter(r => r.edited !== null);
  const rates = evaluated.map(r => r.edited!);
  return { selected: rows.length, evaluated: evaluated.length,
    withEvidence: evaluated.filter(r => r.edited! >= threshold && r.edited! > 0).length,
    reads: evaluated.reduce((n, r) => n + r.reads, 0),
    range: rates.length ? Math.max(...rates) - Math.min(...rates) : null,
    mostWt: [...evaluated].sort((a, b) => b.wt! - a.wt!)[0] ?? null };
}

export interface FigureSource { label: string; rows: ComparisonRow[]; }

/** A sensitivity model, NOT a measurement of co-editing or cell/plant genotypes.
 * Assumes each read fraction is a locus-event probability in the same population,
 * with independence between loci. Bulk amplicons cannot establish either premise.
 * Missing loci invalidate the whole selected combination; never drop them silently.
 */
export type CoeditingCategory = 'wt' | 'inFrame' | 'outOfFrame';
export type CoeditingMetric = readonly CoeditingCategory[];
export const COEDITING_METRICS: { value: CoeditingCategory; label: string }[] = [
  { value: 'wt', label: 'WT' },
  { value: 'inFrame', label: 'In-frame' },
  { value: 'outOfFrame', label: 'Out-of-frame' }
];
export function coeditingMetricLabel(metric: CoeditingMetric = ['inFrame', 'outOfFrame']): string {
  return COEDITING_METRICS.filter(item => metric.includes(item.value)).map(item => item.label).join(' + ') || '—';
}
function coeditingRates(rows: ComparisonRow[], metric: CoeditingMetric) {
  const categories = [...new Set(metric)];
  if (!categories.length || rows.length < 2 || rows.some(row => row.edited === null || categories.some(category => row[category] === null))) return null;
  return rows.map(row => ({name:row.name, rate:Math.max(0,Math.min(100,categories.reduce((sum,category)=>sum+row[category]!,0)))}));
}
export interface CoeditingSubset { names: string[]; percent: number; }
export function homeologSubset(rows: ComparisonRow[], metric: CoeditingMetric, names: readonly string[]): CoeditingSubset | null {
  const rates = coeditingRates(rows,metric), selected = new Set(names);
  if (!rates || !selected.size || selected.size >= rows.length || selected.size !== names.length || names.some(name=>!rates.some(row=>row.name===name))) return null;
  return { names:rates.filter(row=>selected.has(row.name)).map(row=>row.name), percent:rates.reduce((p,row)=>p*(selected.has(row.name) ? row.rate/100 : 1-row.rate/100),1)*100 };
}
export function homeologSubsets(rows: ComparisonRow[], metric: CoeditingMetric, count: number, limit = 50) {
  const items: CoeditingSubset[] = [];
  if (!coeditingRates(rows,metric) || count < 1 || count >= rows.length) return {items,hasMore:false};
  const visit = (start:number, names:string[]) => {
    if (items.length > limit) return;
    if (names.length === count) { const item=homeologSubset(rows,metric,names); if(item) items.push(item); return; }
    for(let i=start;i<=rows.length-(count-names.length);i++) { visit(i+1,[...names,rows[i].name]); if(items.length>limit) break; }
  };
  visit(0,[]);
  return {items:items.slice(0,limit),hasMore:items.length>limit};
}
export function homeologCombination(rows: ComparisonRow[], metric: CoeditingMetric = ['inFrame', 'outOfFrame']) {
  const values = coeditingRates(rows,metric);
  if (!values) return null;
  const rates = values.map(value => Math.max(0, Math.min(1, value.rate! / 100)));
  let distribution = [1];
  for (const p of rates) {
    const next = Array(distribution.length + 1).fill(0);
    distribution.forEach((value, k) => { next[k] += value * (1 - p); next[k + 1] += value * p; });
    distribution = next;
  }
  const ordered = [...values].sort((a, b) => a.rate! - b.rate!);
  return { weakest: ordered[0], strongest: ordered[ordered.length - 1],
    gap: ordered[ordered.length - 1].rate! - ordered[0].rate!,
    all: distribution[distribution.length - 1] * 100, any: (1 - distribution[0]) * 100,
    distribution: distribution.map((p, count) => ({ count, percent: p * 100 })) };
}
export type FigureKind = 'profile' | 'editing' | 'alleles' | 'summary' | 'coediting';
export interface FigurePanel { id: number; kind: FigureKind; title: string; source: FigureSource; coeditingMetric?: CoeditingMetric; coeditingSubsets?: readonly string[][]; }
function figureCoeditingSubsets(panel: FigurePanel): CoeditingSubset[] {
  return (panel.coeditingSubsets ?? []).map(names=>homeologSubset(panel.source.rows,panel.coeditingMetric ?? ['inFrame','outOfFrame'],names)).filter((item):item is CoeditingSubset=>!!item);
}
export interface FigureOptions { title: string; columns: number; layout?: string; fontSize: number; radius: number; groupLimit: number; minFrequency: number; palette: 'okabe' | 'muted'; }

export function figureRows(count: number, options: Pick<FigureOptions, 'columns' | 'layout'>): number[] {
  const n = Math.max(0, Math.min(12, Math.floor(count)));
  if (!n) return [];
  if (options.layout?.startsWith('rows:')) {
    const rows = options.layout.slice(5).split('+').map(Number);
    if (rows.every(value => Number.isInteger(value) && value >= 1 && value <= 4) && rows.reduce((sum,value)=>sum+value,0) === n) return rows;
  }
  const requested = options.layout?.startsWith('columns:') ? Number(options.layout.slice(8)) : !options.layout ? options.columns : 0;
  if (Number.isInteger(requested) && requested >= 1 && requested <= 4) {
    const rows: number[] = []; for (let left=n;left>0;left-=requested) rows.push(Math.min(left,requested)); return rows;
  }
  return [[],[1],[2],[3],[2,2],[3,2],[3,3],[4,3],[4,4],[3,3,3],[4,3,3],[4,4,3],[4,4,4]][n];
}

export function figureRowChoices(count: number): string[] {
  const choices: string[] = [];
  const visit = (left:number, max:number, rows:number[]) => {
    if (!left) { choices.push('rows:'+rows.join('+')); return; }
    for(let value=Math.min(left,max,4);value>=1;value--) visit(left-value,value,[...rows,value]);
  };
  if(count>0 && count<=12) visit(count,4,[]);
  return choices;
}
export const FIGURE_COLORS = {
  okabe: ['#009E73', '#CC79A7', '#0072B2', '#E69F00'],
  muted: ['#648984', '#A07798', '#567EA3', '#C29146']
};
export function captureFigureSource(label: string, rows: ComparisonRow[]): FigureSource {
  // A figure needs grouped outcomes and sequences, never one object per read.
  // Keep large Nanopore datasets out of each independent panel snapshot.
  return structuredClone({ label, rows: rows.map(row => ({ ...row,
    target: row.target ? { ...row.target, read_details: [], unfiltered_top_groups: undefined } : undefined })) });
}
export function moveFigurePanel(panels: FigurePanel[], from: number, to: number): FigurePanel[] {
  if (from < 0 || to < 0 || from >= panels.length || to >= panels.length || from === to) return [...panels];
  const result = [...panels]; const [panel] = result.splice(from, 1); result.splice(to, 0, panel); return result;
}
export function escapeSvg(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
}
const fmt = (value: number | null) => value === null ? 'N/A' : `${value.toFixed(1)}%`;
const short = (value: string, n: number) => value.length > n ? value.slice(0, n - 1) + '…' : value;

/** Reference coordinates consume all tokens except insertions; X is not an edit. */
export function sequenceCells(target: TargetResult, groupIndex: number, radius: number): { text: string; type: string }[] {
  const cut = resolveAnnotationCutSite(target);
  if (cut === null) return [];
  const start = Math.max(0, cut - radius), end = Math.min(target.ref_sequence?.length ?? cut + radius, cut + radius);
  const cells: { text: string; type: string }[] = [];
  let position = 0;
  for (const token of target.top_groups?.[groupIndex]?.tokens ?? []) {
    if (token.type === 'insert') {
      if (position >= start && position < end) cells.push({ text: `+${short(token.val, 8)}`, type: 'insert' });
      continue;
    }
    for (const base of token.val) {
      if (position >= start && position < end) cells.push({ text: token.type === 'delete' ? '−' : base, type: token.type });
      position++;
    }
  }
  return cells;
}

export interface FigureSlot { index: number; row: number; col: number; span: number; x: number; y: number; width: number; height: number; }
export function figurePanelLayout(panels: FigurePanel[], options: FigureOptions): { width: number; height: number; slots: FigureSlot[] } {
  const gap = 24, margin = 28;
  const panelHeight = (panel: FigurePanel) => panel.kind === 'coediting' ? 156 + (panel.source.rows.length + 1 + figureCoeditingSubsets(panel).length) * 34 : panel.kind === 'alleles'
    ? 90 + panel.source.rows.reduce((height, row) => height + 56 + Math.min(options.groupLimit, (row.target?.top_groups ?? []).filter(g => g.read_pct >= options.minFrequency).length) * 30, 0)
    : 112 + panel.source.rows.length * (panel.kind === 'summary' ? 38 : 56);
  const rows = figureRows(panels.length, options);
  const fixed = options.layout?.startsWith('columns:') ? Number(options.layout.slice(8)) : !options.layout ? options.columns : 0;
  const fixedColumns = fixed >= 1 && fixed <= 4 ? fixed : 0;
  if (!panels.some(panel => panel.kind === 'alleles')) {
    const width = Math.max(...rows, fixedColumns || 1) > 1 ? 1440 : 780;
    const slots: FigureSlot[] = []; let index = 0, y = 108;
    for (const [row, count] of rows.entries()) {
      const height = Math.max(...panels.slice(index, index + count).map(panelHeight));
      const columns = fixedColumns || count, panelWidth = (width - margin * 2 - gap * (columns - 1)) / columns;
      for (let col = 0; col < count; col++) slots.push({ index: index++, row, col, span: 1, x: margin + col * (panelWidth + gap), y, width: panelWidth, height });
      y += height + gap;
    }
    return { width, height: y + 28 - (slots.length ? gap : 0), slots };
  }
  const cells = panels.reduce((sum, panel) => sum + (panel.kind === 'alleles' ? 2 : 1), 0);
  const requested = options.layout?.startsWith('rows:') ? options.layout.slice(5).split('+').map(Number) : [];
  const rowPattern = requested.every(n => Number.isInteger(n) && n >= 1 && n <= 4) && requested.reduce((a,b) => a+b,0) === cells ? requested : [];
  const columns = fixedColumns || (rowPattern.length ? Math.max(...rowPattern) : Math.min(panels.length, cells > 12 ? 4 : Math.max(...figureRows(cells, { columns: 0, layout: 'auto' }))));
  const width = columns > 1 ? 1440 : 780, panelWidth = (width - margin * 2 - gap * (columns - 1)) / columns;
  const cellHeight = Math.max(180, ...panels.map(panel => panel.kind === 'alleles' ? (panelHeight(panel) - gap) / 2 : panelHeight(panel)));
  const occupied = new Set<string>(), slots: FigureSlot[] = [];
  const capacity = (row: number) => rowPattern[row] ?? columns;
  panels.forEach((panel, index) => {
    const span = panel.kind === 'alleles' ? 2 : 1;
    for (let row = 0; ; row++) {
      let placed = false;
      for (let col = 0; col < columns; col++) {
        if (Array.from({length:span}, (_,i) => row+i).some(r => col >= capacity(r) || occupied.has(`${r}:${col}`))) continue;
        for (let i = 0; i < span; i++) occupied.add(`${row+i}:${col}`);
        slots.push({ index, row, col, span, x: margin + col * (panelWidth + gap), y: 108 + row * (cellHeight + gap), width: panelWidth, height: span * cellHeight + (span - 1) * gap });
        placed = true; break;
      }
      if (placed) break;
    }
  });
  const rowCount = Math.max(...slots.map(slot => slot.row + slot.span));
  return { width, height: 136 + rowCount * cellHeight + Math.max(0, rowCount - 1) * gap, slots };
}

/** Standalone SVG (no DOM screenshots, HTML, external fonts, or scripts). */
export function renderFigure(panels: FigurePanel[], input: FigureOptions): string {
  const options = { ...input,
    fontSize: Math.max(10, Math.min(22, input.fontSize)), radius: Math.max(10, Math.min(60, input.radius)),
    groupLimit: Math.max(1, Math.min(12, input.groupLimit)), minFrequency: pct(input.minFrequency) };
  const colors = FIGURE_COLORS[options.palette] ?? FIGURE_COLORS.okabe;
  const layout = figurePanelLayout(panels, options);
  const width = layout.width, margin = 28;
  const font = options.fontSize;
  const text = (x: number, y: number, content: unknown, size = font, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" ${extra}>${escapeSvg(content)}</text>`;
  const legend = colors.map((color, i) => `<rect x="${margin + i * 155}" y="65" width="11" height="11" fill="${color}"/>${text(margin + 17 + i * 155, 75, ['WT', 'Substitution', 'In-frame indel', 'Out-of-frame indel'][i], 12)}`).join('');
  let body = '';
  panels.forEach((panel, index) => {
    const {row,col,x,y,width:panelWidth,span} = layout.slots[index];
    const font = Math.max(10, Math.min(options.fontSize, panelWidth / 30));
    const inner = panelWidth - 40;
    body += `<g data-figure-panel="${index}" data-row="${row}" data-column="${col}" data-row-span="${span}" transform="translate(${x},${y})">`;
    body += text(0, 22, `${String.fromCharCode(97 + index)}  ${short(panel.title, Math.floor(panelWidth / ((font + 3) * .65)) - 4)}`, font + 3, 'font-weight="700"');
    body += text(0, 44, short(panel.source.label, Math.floor(panelWidth / 7)), 11, 'fill="#64748b"');
    if (panel.kind === 'profile' || panel.kind === 'editing') {
      const barX = 112, barWidth = inner - barX - 48;
      for (const [i, row] of panel.source.rows.entries()) {
        const top = 65 + i * 56;
        body += text(0, top + 15, short(row.name, 15), font, 'font-weight="600"');
        body += text(0, top + 31, `n=${row.reads.toLocaleString('en-US')}`, 11, 'fill="#64748b"');
        if (row.wt === null) { body += text(barX, top + 18, 'Not evaluated', font, 'fill="#94a3b8"'); continue; }
        body += `<rect x="${barX}" y="${top}" width="${barWidth}" height="24" rx="3" fill="#f1f5f9"/>`;
        let offset = 0;
        const values = panel.kind === 'editing' ? [row.edited!] : [row.wt, row.substitution!, row.inFrame!, row.outOfFrame!];
        values.forEach((value, j) => {
          const w = Math.max(0, Math.min(value, 100 - offset)) * barWidth / 100;
          body += `<rect x="${barX + offset * barWidth / 100}" y="${top}" width="${w}" height="24" fill="${panel.kind === 'editing' ? colors[2] : colors[j]}"/>`;
          offset += value;
        });
        body += text(barX + barWidth + 6, top + 17, fmt(panel.kind === 'editing' ? row.edited : row.wt), 12);
      }
      body += text(112, 85 + panel.source.rows.length * 56, panel.kind === 'editing' ? 'Non-WT reads (%) · indels + substitutions' : 'Read composition (%) · label = WT', 11, 'fill="#64748b"');
    } else if (panel.kind === 'coediting') {
      body += text(0, 66, coeditingMetricLabel(panel.coeditingMetric) + ' · independence assumed', 11, 'fill="#64748b"');
      const model = homeologCombination(panel.source.rows, panel.coeditingMetric);
      if (!model) body += text(0, 94, 'Select at least two references with aligned reads.', 12);
      else {
        body += text(0, 90, `All ${panel.source.rows.length}: ${fmt(model.all)}     At least one: ${fmt(model.any)}`, font);
        const barX = 65, barWidth = inner - barX - 65;
        for (const item of model.distribution) {
          const top = 112 + item.count * 34;
          body += text(0, top + 15, `${item.count} / ${panel.source.rows.length}`, 12);
          body += `<rect x="${barX}" y="${top}" width="${barWidth}" height="20" rx="3" fill="#f1f5f9"/><rect x="${barX}" y="${top}" width="${barWidth * item.percent / 100}" height="20" rx="3" fill="${colors[2]}"/>`;
          body += text(barX + barWidth + 8, top + 15, fmt(item.percent), 12);
        }
        const subsets = figureCoeditingSubsets(panel);
        for (const [i,item] of subsets.entries()) {
          const top = 112 + (model.distribution.length+i)*34;
          body += text(0,top+15,short(item.names.join(' + '),Math.floor(inner/8)),11);
          body += text(inner-40,top+15,fmt(item.percent),11);
        }
        body += text(0, 142 + (model.distribution.length + subsets.length) * 34, 'Model, not measured same-cell editing.', 11, 'fill="#64748b"');
      }
    } else if (panel.kind === 'summary') {
      const columns = [0, inner * .26, inner * .43, inner * .60, inner * .77];
      ['Reference', 'Reads', 'WT', 'In-frame', 'Out-of-frame'].forEach((v, j) => body += text(columns[j], 76, v, 12, 'font-weight="600"'));
      panel.source.rows.forEach((row, i) => {
        const top = 108 + i * 38;
        [short(row.name, Math.min(18,Math.floor(inner * .26 / (font * .65)))), row.reads, fmt(row.wt), fmt(row.inFrame), fmt(row.outOfFrame)].forEach((v, j) => body += text(columns[j], top, v, font));
        body += `<path d="M0 ${top + 12}H${inner}" stroke="#e2e8f0"/>`;
      });
    } else {
      let top = 72;
      for (const row of panel.source.rows) {
        body += text(0, top, row.name, font, 'font-weight="700"'); top += 24;
        const target = row.target, cut = resolveAnnotationCutSite(target);
        if (!target || cut === null || !target.ref_sequence) { body += text(0, top, 'Sequence / cut-site unavailable', 12, 'fill="#64748b"'); top += 32; continue; }
        const start = Math.max(0, cut - options.radius), end = Math.min(target.ref_sequence.length, cut + options.radius);
        const seqX = 145, baseWidth = (inner - seqX) / Math.max(1, end - start);
        const seqSize = Math.min(12, baseWidth * 1.1);
        const sequence = (bases: { text: string; type: string }[], at: number) => {
          // Insertions have a separate marker at their reference coordinate.
          let pos = 0;
          for (const cell of bases) {
            const xx = seqX + pos * baseWidth;
            if (cell.type === 'insert') { body += text(xx, at - 9, cell.text, 8, `fill="${colors[2]}"`); continue; }
            if (cell.type === 'delete' || cell.type === 'substitute') body += `<rect x="${xx - 1}" y="${at - 11}" width="${baseWidth}" height="15" fill="${cell.type === 'delete' ? '#fde8d7' : '#f6edb8'}"/>`;
            body += text(xx, at, cell.text, seqSize, `font-family="monospace" fill="${cell.type === 'unobserved' ? '#94a3b8' : '#334155'}"`); pos++;
          }
        };
        body += text(0, top, 'Reference', 11);
        sequence([...target.ref_sequence.slice(start, end)].map(base => ({ text: base, type: 'equal' })), top);
        const selected = (target.top_groups ?? []).map((g, i) => ({ g, i })).filter(({g}) => g.read_pct >= options.minFrequency).slice(0, options.groupLimit);
        body += `<path d="M${seqX + (cut - start) * baseWidth} ${top - 15}v${selected.length * 30 + 18}" stroke="#CC79A7" stroke-dasharray="3 3"/>`;
        for (const { g, i } of selected) {
          top += 30; body += text(0, top, `${g.net_indel > 0 ? '+' : ''}${g.net_indel} bp · ${g.read_pct.toFixed(1)}%`, 11);
          sequence(sequenceCells(target, i, options.radius), top);
        }
        if (!selected.length) { top += 25; body += text(0, top, 'No groups above display threshold', 11, 'fill="#64748b"'); }
        top += 32;
      }
    }
    body += '</g>';
  });
  const height = layout.height;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeSvg(options.title)}"><rect width="100%" height="100%" fill="white"/><g font-family="Arial, sans-serif" fill="#1e293b">${text(margin, 38, options.title, font + 8, 'font-weight="700"')}${legend}${body}</g></svg>`;
}
