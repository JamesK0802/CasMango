import { Component, Input, OnChanges, ChangeDetectorRef } from '@angular/core';
import { GeneResult } from '../../models/analysis.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FigureKind, FigureOptions, FigurePanel, FigureSource, comparisonRows, captureFigureSource, moveFigurePanel, renderFigure } from './result-presentation';

@Component({
  selector: 'app-figure-composer', standalone: true, imports: [CommonModule, FormsModule],
  template: `
    <section class="composer" [attr.data-figure-source]="origin" [attr.data-panel-count]="panels.length">
      <header><div><h3>{{ origin === 'standard' ? 'Standard' : 'Homeolog' }} figure</h3><small>Independent figure draft · source data stays unchanged</small></div></header>
      <div class="source-picker">
        <label>Source<select aria-label="Figure source" [(ngModel)]="sourceChoice" (ngModelChange)="chooseSource()">
          <option value="">Choose a reference or Homeo</option>
          <option *ngFor="let gene of genes" [value]="'ref:' + gene.gene">{{ gene.gene }}</option>
          <option value="homeo">Homeolog combination</option>
        </select></label>
        <label>Target<select aria-label="Figure target" [(ngModel)]="targetChoice" (ngModelChange)="chooseSource()">
          <option *ngFor="let target of targetChoices" [value]="target">{{ target }}</option>
        </select></label>
        <div *ngIf="sourceChoice === 'homeo'" class="reference-picker">
          <button type="button" *ngFor="let gene of genes" [attr.aria-pressed]="selectedRefs.includes(gene.gene)" (click)="toggleReference(gene.gene)">{{ selectedRefs.includes(gene.gene) ? '✓ ' : '' }}{{ gene.gene }}</button>
        </div>
      </div>
      <div class="source-line">Selected source: {{ selectedSource.label || 'Choose a source' }} · new panels only</div>
      <div class="add-row">
        <label class="sr-only" [for]="origin + '-figure-kind'">Panel type</label>
        <select [id]="origin + '-figure-kind'" [(ngModel)]="kind">
          <option value="profile">Mutation profile</option><option value="editing">Non-WT reads</option>
          <option value="alleles">Cut-site sequences</option><option value="summary">Summary table</option>
        </select>
        <button type="button" class="primary" [attr.id]="origin === 'standard' ? 'guide-add-standard-panel' : 'guide-add-homeo-panel'"
          [disabled]="!selectedSource.rows.length || panels.length >= 12" (click)="addPanel()">+ Add panel</button>
      </div>
      <details class="figure-settings"><summary>Title & layout</summary>
        <label>Figure title<input [(ngModel)]="options.title" maxlength="120" (ngModelChange)="refresh()"></label>
        <div class="settings-grid">
          <label>Columns<select [(ngModel)]="options.columns" (ngModelChange)="refresh()"><option [ngValue]="1">1</option><option [ngValue]="2">2</option></select></label>
          <label>Text size<input type="number" min="10" max="22" [(ngModel)]="options.fontSize" (change)="refresh()"></label>
          <label>Palette<select [(ngModel)]="options.palette" (ngModelChange)="refresh()"><option value="okabe">Okabe–Ito</option><option value="muted">Muted</option></select></label>
          <label>Sequence flank (bp)<input type="number" min="10" max="60" [(ngModel)]="options.radius" (change)="refresh()"></label>
          <label>Groups / reference<input type="number" min="1" max="12" [(ngModel)]="options.groupLimit" (change)="refresh()"></label>
          <label>Display ≥ (%)<input type="number" min="0" max="100" step="0.5" [(ngModel)]="options.minFrequency" (change)="refresh()"></label>
        </div>
        <small>Display filters never recalculate read percentages. Grey sequence = unobserved; not a deletion.</small>
      </details>
      <div class="panel-list" *ngIf="panels.length">
        <div class="panel-item" *ngFor="let panel of panels; let i = index" draggable="true"
          (dragstart)="startDrag($event, i)" (dragover)="$event.preventDefault()" (drop)="dropPanel($event, i)" (dragend)="dragIndex = null">
          <span class="panel-letter">{{ letter(i) }}</span>
          <label class="sr-only" [for]="origin + '-panel-' + panel.id">Panel title</label>
          <input [id]="origin + '-panel-' + panel.id" [(ngModel)]="panel.title" maxlength="90" (ngModelChange)="refresh()">
          <button type="button" (click)="move(i, i - 1)" [disabled]="i === 0" aria-label="Move panel up">↑</button>
          <button type="button" (click)="move(i, i + 1)" [disabled]="i === panels.length - 1" aria-label="Move panel down">↓</button>
          <button type="button" (click)="remove(i)" aria-label="Remove panel">×</button>
        </div>
      </div>
      <div class="figure-preview" *ngIf="panels.length; else empty" [innerHTML]="preview"></div>
      <ng-template #empty><div class="figure-empty">Add a chart, summary or sequence panel.<br><small>Switch results to add panels from another reference or combination.</small></div></ng-template>
      <footer>
        <small>{{ panels.length }}/12 panels · source captured when added</small>
        <div><button type="button" [disabled]="!panels.length || exporting" (click)="downloadSvg()">SVG</button>
        <button type="button" [disabled]="!panels.length || exporting" (click)="downloadPng()">{{ exporting ? 'Rendering…' : 'PNG 2×' }}</button></div>
      </footer><p *ngIf="exportPreviewMessage" role="status">{{ exportPreviewMessage }}</p><p class="error" *ngIf="error" role="alert">{{ error }}</p>
    </section>`,
  styles: [`
    :host{display:block;min-width:0}*{box-sizing:border-box}.composer{padding:18px;background:var(--color-surface,#fff);color:var(--color-text-primary,#1e293b)}
    h3{margin:0 0 4px;font-size:16px}small,.source-line{font-size:11px;color:var(--color-text-secondary,#64748b);line-height:1.5}.source-line{margin:15px 0 8px;overflow-wrap:anywhere}
    .source-picker{display:grid;grid-template-columns:1fr 1fr;gap:8px}.reference-picker{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:5px}.reference-picker button[aria-pressed="true"]{background:#fffbeb;border-color:#e9b34b}
    .add-row,footer,footer>div,.panel-item{display:flex;align-items:center;gap:7px}.add-row select{flex:1;min-width:0}
    button,input,select{font:inherit;font-size:12px;border:1px solid var(--color-border,#dbe1e8);border-radius:7px;padding:8px;background:var(--color-surface,#fff);color:inherit}
    button{cursor:pointer;white-space:nowrap}button:disabled{opacity:.4;cursor:default}button.primary{background:#f59e0b;border-color:#f59e0b;color:#1e293b;font-weight:600}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #f59e0b;outline-offset:2px}
    details{border-block:1px solid var(--color-border,#e2e8f0);margin:14px 0;padding:10px 0}summary{cursor:pointer;font-size:12px;font-weight:600}label{display:grid;gap:5px;font-size:11px;margin:10px 0}.settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}input,select{width:100%;min-width:0}.panel-list{display:grid;gap:7px;margin-bottom:14px}.panel-letter{font-weight:700;width:12px;flex-shrink:0}.panel-item>input{flex:1;min-width:0}.panel-item>button{padding:6px 8px}.panel-item{cursor:grab}
    .figure-preview{border:1px solid #e2e8f0;background:#fff;overflow:auto}.figure-preview ::ng-deep svg{display:block;width:100%;height:auto;min-width:320px}.figure-empty{padding:45px 15px;text-align:center;background:var(--color-surface-alt,#f8fafc);border:1px dashed var(--color-border,#dbe1e8);border-radius:9px;font-size:13px;line-height:1.8}
    footer{justify-content:space-between;margin-top:14px;flex-wrap:wrap}.error{color:#b45309;font-size:12px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
  `]
})
export class FigureComposerComponent implements OnChanges {
  @Input() origin: 'standard' | 'homoeolog' = 'standard';
  @Input() source: FigureSource = { label: '', rows: [] };
  @Input() genes: GeneResult[] = [];
  @Input() active = false;
  @Input() previewOnly = false;
  exportPreviewMessage = '';
  sourceChoice = '';
  targetChoice = '';
  selectedRefs: string[] = [];
  private initialized = false;
  private sourceChosen = false;
  get targetChoices(): string[] { return [...new Set(this.genes.flatMap(g => g.analysis_result.targets.map(t => t.target_id)))]; }
  get selectedSource(): FigureSource {
    if (!this.sourceChosen) return this.source;
    const names = this.sourceChoice === 'homeo' ? this.selectedRefs : [this.sourceChoice.slice(4)];
    return { label: names.join(' + ') + ' · ' + this.targetChoice, rows: comparisonRows(this.genes, names, this.targetChoice) };
  }
  chooseSource() {
    if (!this.sourceChoice) return;
    this.sourceChosen = true;
    if (!this.initialized) this.seedPanels();
  }
  toggleReference(name: string) {
    this.selectedRefs = this.selectedRefs.includes(name) ? this.selectedRefs.filter(n => n !== name) : [...this.selectedRefs, name];
    this.chooseSource();
  }
  private seedPanels() {
    if (!this.selectedSource.rows.length) return;
    this.initialized = true;
    for (const kind of ['profile', 'editing', 'alleles', 'summary'] as FigureKind[]) { this.kind = kind; this.addPanel(); }
    this.kind = 'profile';
  }
  panels: FigurePanel[] = [];
  kind: FigureKind = 'profile';
  options: FigureOptions = { title: 'Editing outcomes', columns: 1, fontSize: 14, radius: 30, groupLimit: 5, minFrequency: 2, palette: 'okabe' };
  preview: SafeHtml = '';
  svg = '';
  exporting = false;
  error = '';
  dragIndex: number | null = null;
  private nextId = 0;
  constructor(private sanitizer: DomSanitizer, private cdr: ChangeDetectorRef) {}
  ngOnChanges() {
    if (this.active && !this.initialized && this.source.rows.length) {
      this.selectedRefs = this.source.rows.map(r => r.name);
      this.sourceChoice = this.origin === 'homoeolog' ? 'homeo' : 'ref:' + this.selectedRefs[0];
      this.targetChoice = this.source.rows[0]?.target?.target_id || this.targetChoices[0] || '';
      // The clicked result supplies the initial snapshot; later picker changes affect additions only.
      this.seedPanels();
    }
  }
  letter(i: number) { return String.fromCharCode(97 + i); }
  addPanel() {
    if (!this.selectedSource.rows.length || this.panels.length >= 12) return;
    const titles = { profile: 'Mutation profile', editing: 'Non-WT reads', alleles: 'Cut-site sequences', summary: 'Read summary' };
    this.panels = [...this.panels, { id: ++this.nextId, kind: this.kind, title: titles[this.kind], source: captureFigureSource(this.selectedSource.label, this.selectedSource.rows) }];
    this.refresh();
  }
  refresh() {
    // Clamp control input before rendering/export; NaN from a temporarily blank field is not valid SVG.
    for (const [key, fallback, min, max] of [['fontSize',14,10,22],['radius',30,10,60],['groupLimit',5,1,12],['minFrequency',2,0,100]] as const) {
      const value = Number(this.options[key]); this.options[key] = Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
    }
    this.svg = renderFigure(this.panels, this.options);
    // Only our escaped, locally generated SVG is trusted; raw user markup is never accepted.
    this.preview = this.sanitizer.bypassSecurityTrustHtml(this.svg);
  }
  move(from: number, to: number) { this.panels = moveFigurePanel(this.panels, from, to); this.refresh(); }
  remove(index: number) { this.panels = this.panels.filter((_, i) => i !== index); this.refresh(); }
  startDrag(event: DragEvent, index: number) { this.dragIndex = index; event.dataTransfer?.setData('text/plain', String(index)); }
  dropPanel(event: DragEvent, index: number) { event.preventDefault(); if (this.dragIndex !== null) this.move(this.dragIndex, index); this.dragIndex = null; }
  private save(blob: Blob, extension: string) {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `CasMANGO-${this.origin}-figure.${extension}`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  downloadSvg() { if (this.previewOnly) { this.exportPreviewMessage = 'Export preview only — no file downloaded.'; return; } if (this.panels.length) this.save(new Blob([this.svg], { type: 'image/svg+xml;charset=utf-8' }), 'svg'); }
  async downloadPng() {
    if (this.previewOnly) { this.exportPreviewMessage = 'Export preview only — no file downloaded.'; return; }
    if (!this.panels.length || this.exporting) return;
    this.exporting = true; this.error = '';
    const url = URL.createObjectURL(new Blob([this.svg], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not render figure. Try SVG export.')); image.src = url; });
      const width = image.naturalWidth * 2, height = image.naturalHeight * 2;
      if (width * height > 50_000_000) throw new Error('Figure is too large for PNG. Reduce panels/groups or export SVG.');
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d'); if (!context) throw new Error('PNG is unavailable. Export SVG instead.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('PNG is unavailable. Export SVG instead.'); this.save(blob, 'png');
    } catch (error) { this.error = error instanceof Error ? error.message : 'PNG export failed. Try SVG.'; }
    finally { URL.revokeObjectURL(url); this.exporting = false; this.cdr.detectChanges(); }
  }
}
