import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeneResult } from '../../models/analysis.model';
import { comparisonRows, comparisonSummary, FIGURE_COLORS, FigureSource } from './result-presentation';

@Component({
  selector: 'app-homoeolog-comparison', standalone: true, imports: [CommonModule, FormsModule],
  template: `
    <div class="comparison" id="guide-homeo-comparison" [attr.data-selection-count]="selectedNames.length">
      <div class="selectors"><label>Group<select aria-label="Homoeolog group" [ngModel]="activeGroup" (ngModelChange)="setGroup($event)"><option *ngFor="let name of groupNames" [value]="name">{{ name }}</option></select></label>
      <label>Target<select aria-label="Comparison target" [ngModel]="activeTarget" (ngModelChange)="target = $event"><option *ngFor="let id of targetIds" [value]="id">{{ id }}</option></select></label></div>
      <div class="selection-heading"><strong>Compare references</strong><div><button type="button" id="guide-homeo-select-all" (click)="chooseAll()">All</button><button type="button" (click)="selection = []">Clear</button></div></div>
      <div class="reference-picker" id="guide-homeo-reference-picker">
        <button type="button" *ngFor="let gene of groupGenes; let i = index" [attr.data-reference]="gene.gene"
          [attr.id]="i === 1 ? 'guide-homeo-second-reference' : null" [attr.aria-pressed]="selectedNames.includes(gene.gene)"
          [class.selected]="selectedNames.includes(gene.gene)" (click)="toggle(gene.gene)"><span>{{ selectedNames.includes(gene.gene) ? '✓' : '+' }}</span> {{ gene.gene }}</button>
      </div>
      <p class="context">{{ scopeLabel }} · {{ activeTarget || 'No target' }} · selected combination only</p>
      <ng-container *ngIf="rows.length; else empty">
        <div class="overview">
          <div><strong>{{ stats.withEvidence }}/{{ stats.selected }}</strong><small>With edit evidence</small></div>
          <div><strong>{{ stats.evaluated }}/{{ stats.selected }}</strong><small>Evaluated</small></div>
          <div><strong>{{ stats.reads | number }}</strong><small>Analysed reads</small></div>
        </div>
        <label class="threshold">Evidence ≥ <input aria-label="Edit evidence threshold percent" type="number" min="0" max="100" step="0.5" [ngModel]="threshold" (ngModelChange)="setThreshold($event)"> % non-WT reads</label>
        <p class="note">Screening threshold only; does not filter reads or alter analysis. Evidence across references does not establish joint editing in the same cell or complete knockout.</p>
        <section class="profile"><h3>WT remaining & editing profile</h3>
          <div class="legend"><span *ngFor="let name of labels; let i = index"><i [style.background]="colors[i]"></i>{{ name }}</span></div>
          <div *ngFor="let row of rows" class="profile-row">
            <div class="row-heading"><button type="button" (click)="inspect.emit(row.name)" title="Show this reference in Standard">{{ row.name }} ↗</button><small>n = {{ row.reads | number }}</small><strong>{{ row.wt === null ? 'Not evaluated' : (row.wt | number:'1.1-1') + '% WT' }}</strong></div>
            <div class="stack" [attr.aria-label]="row.name + ': ' + (row.wt === null ? 'not evaluated' : row.wt + ' percent WT')">
              <span *ngFor="let value of [row.wt, row.substitution, row.inFrame, row.outOfFrame]; let i = index" [style.width.%]="value ?? 0" [style.background]="colors[i]" [title]="labels[i] + ': ' + (value ?? 0).toFixed(2) + '%'"></span>
            </div>
          </div>
          <p class="note">Percentages use each target’s post-filter aligned reads. N/A is not WT. Reads are not cells or biological replicates.</p>
        </section>
        <section><h3>Selected combination summary</h3>
          <div class="summary-scroll"><table><thead><tr><th>Reference</th><th>WT</th><th>Sub.</th><th>In-frame</th><th>Out-of-frame</th></tr></thead>
          <tbody><tr *ngFor="let row of rows"><th>{{ row.name }}</th><td>{{ format(row.wt) }}</td><td>{{ format(row.substitution) }}</td><td>{{ format(row.inFrame) }}</td><td>{{ format(row.outOfFrame) }}</td></tr></tbody></table></div>
          <p class="note" *ngIf="stats.mostWt">Most WT remaining: <strong>{{ stats.mostWt.name }} ({{ format(stats.mostWt.wt) }})</strong>. This is a read-level comparison, not a prediction of phenotype.</p>
        </section>
        <details><summary>Major mutation groups by reference</summary>
          <div *ngFor="let row of rows" class="allele-summary"><strong>{{ row.name }}</strong>
            <div *ngFor="let group of row.target?.top_groups?.slice(0, 5)"><span>{{ group.classification }} · {{ group.net_indel > 0 ? '+' : '' }}{{ group.net_indel }} bp</span><span>{{ group.read_pct | number:'1.1-1' }}%</span></div>
            <small *ngIf="!row.target?.top_groups?.length">No groups available</small>
          </div><p class="note">Equal indel lengths do not establish a shared allele. Add cut-site sequences in Figure to compare the actual edits.</p>
        </details>
      </ng-container>
      <ng-template #empty><div class="empty">Select references to compare.<br><small>Any combination; no exhaustive combination list.</small></div></ng-template>
    </div>`,
  styles: [`
    :host{display:block;min-width:0}.comparison{padding:18px}.selectors{display:flex;gap:12px}label{display:grid;gap:5px;font-size:11px;color:var(--color-text-secondary,#64748b)}.selectors label{flex:1;min-width:0}
    button,input,select{font:inherit;color:inherit;border:1px solid var(--color-border,#dbe1e8);background:var(--color-surface,#fff);border-radius:7px;padding:7px 10px;font-size:12px}button{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #f59e0b;outline-offset:2px}select{width:100%;min-width:0}
    .selection-heading{display:flex;justify-content:space-between;align-items:center;margin:20px 0 10px;font-size:12px}.selection-heading button{border:0;padding:4px 7px;background:transparent}.reference-picker{display:flex;flex-wrap:wrap;gap:7px;max-height:150px;overflow:auto;padding:3px}.reference-picker .selected{border-color:#e9b34b;background:#fffbeb;color:#92400e}.context,.note{font-size:11px;line-height:1.6;color:var(--color-text-secondary,#64748b)}.context{margin:14px 0}
    .overview{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.overview>div{border:1px solid var(--color-border,#e2e8f0);border-radius:10px;padding:12px}.overview strong{font-size:23px;display:block}.overview small{font-size:10px;color:var(--color-text-secondary,#64748b)}.threshold{display:flex;align-items:center;margin:12px 0;gap:7px}.threshold input{width:65px}
    section{margin-top:22px}h3{font-size:14px;margin:0 0 14px}.legend{display:flex;flex-wrap:wrap;gap:10px;font-size:10px;color:var(--color-text-secondary,#64748b)}.legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px}.profile-row{margin-top:18px}.row-heading{display:flex;align-items:center;gap:10px;font-size:11px;flex-wrap:wrap}.row-heading button{border:0;padding:0;background:transparent;font-weight:700}.row-heading small{color:#64748b}.row-heading strong{margin-left:auto}.stack{height:24px;background:var(--color-surface-alt,#f1f5f9);display:flex;margin-top:7px;border-radius:4px;overflow:hidden}.stack>span{height:100%}
    .summary-scroll{overflow:auto}table{width:100%;font-size:11px;border-collapse:collapse}th,td{padding:10px 8px;border-bottom:1px solid var(--color-border,#e2e8f0);text-align:right;white-space:nowrap}th:first-child{text-align:left}thead{color:#64748b}details{margin-top:18px;border-top:1px solid var(--color-border,#e2e8f0);padding-top:13px}summary{font-size:12px;font-weight:600;cursor:pointer}.allele-summary{margin:15px 0;font-size:12px}.allele-summary>div{display:flex;justify-content:space-between;padding:6px 0;gap:12px;font-size:11px}.empty{padding:50px 12px;text-align:center;line-height:1.8;color:#64748b}
  `]
})
export class HomoeologComparisonComponent {
  @Input() genes: GeneResult[] = [];
  @Input() scopeLabel = '';
  @Output() inspect = new EventEmitter<string>();
  group = ''; target = ''; selection: string[] | null = null; threshold = 2;
  colors = FIGURE_COLORS.okabe;
  labels = ['WT', 'Substitution', 'In-frame indel', 'Out-of-frame indel'];
  get groupNames() { return [...new Set(this.genes.map(g => g.homoeolog_group || 'References'))]; }
  get activeGroup() { return this.groupNames.includes(this.group) ? this.group : this.groupNames[0] ?? ''; }
  get groupGenes() { return this.genes.filter(g => (g.homoeolog_group || 'References') === this.activeGroup); }
  get targetIds() { return [...new Set(this.groupGenes.flatMap(g => g.analysis_result.targets.map(t => t.target_id)))]; }
  get activeTarget() { return this.targetIds.includes(this.target) ? this.target : this.targetIds[0] ?? ''; }
  get selectedNames() { return this.groupGenes.filter(g => this.selection === null || this.selection.includes(g.gene)).map(g => g.gene); }
  get rows() { return comparisonRows(this.groupGenes, this.selectedNames, this.activeTarget); }
  get stats() { return comparisonSummary(this.rows, this.threshold); }
  get figureSource(): FigureSource { return { label: `${this.scopeLabel} · ${this.activeGroup} · ${this.activeTarget}`, rows: this.rows }; }
  setGroup(value: string) { this.group = value; this.target = ''; this.selection = null; }
  chooseAll() { this.selection = null; }
  toggle(name: string) { const selected = this.selectedNames; this.selection = selected.includes(name) ? selected.filter(n => n !== name) : [...selected, name]; }
  setThreshold(value: unknown) { const n = Number(value); this.threshold = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 2; }
  format(value: number | null) { return value === null ? 'N/A' : value.toFixed(1) + '%'; }
}
