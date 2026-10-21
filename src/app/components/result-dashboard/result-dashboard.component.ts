import { Component, ChangeDetectorRef, ElementRef, HostListener, NgZone, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AppStateService } from '../../services/app-state.service';
import { Chart } from 'chart.js/auto';

import { FigureComposerComponent } from './figure-composer.component';
import { HomoeologComparisonComponent } from './homoeolog-comparison.component';
import { comparisonRows, FigureSource, withoutExcludedGroups } from './result-presentation';
import { GeneResult, MutationGroup } from '../../models/analysis.model';
import { resolveAnnotationCutSite } from './annotation-cut-site';
import { groupKey } from '../../models/curation.model';
import { CurationItem, CurationItemKind, CurationSweep, curationRange } from '../../models/curation-sweep';

@Component({
  selector: 'app-result-dashboard',
  standalone: true,
  imports: [CommonModule, FigureComposerComponent, HomoeologComparisonComponent],
  templateUrl: './result-dashboard.component.html',
  styleUrl: './result-dashboard.component.css'
})
export class ResultDashboardComponent implements OnInit, OnDestroy {
  isSaving = false;
  mobileActionsOpen = false;
  mobileGeneInfoOpen = false;
  mobileChartsOpen = false;
  homoeologOpen = false;
  standardFigureOpen = false;
  homoeologFigureOpen = false;
  activeWorkspacePane = 'standard';
  @ViewChild('workspaceTrack') workspaceTrack?: ElementRef<HTMLElement>;
  @ViewChild(HomoeologComparisonComponent) comparison?: HomoeologComparisonComponent;
  private workspaceSwipe: { x: number; pointerId: number } | null = null;
  private chartTimer?: ReturnType<typeof setTimeout>;
  private dashboardDestroyed = false;
  private presentationCache?: { genes: GeneResult[]; exclusions: string; projected: GeneResult[] };

  get hasHomoeologResults(): boolean {
    return this.state.normalGenes.length > 1 || Boolean(this.state.lastRunParams?.homoeologMode);
  }
  get showHomoeolog(): boolean { return this.homoeologOpen && this.hasHomoeologResults; }
  get showFigure(): boolean { return this.standardFigureOpen || this.homoeologFigureOpen; }
  get presentationGenes() {
    const genes = this.state.genes;
    const excluded = this.state.isCuratedView ? this.state.curationConfig?.excludedGroups ?? [] : [];
    const key = JSON.stringify(excluded);
    if (this.presentationCache?.genes !== genes || this.presentationCache.exclusions !== key) {
      this.presentationCache = { genes, exclusions: key, projected: withoutExcludedGroups(genes.filter(g => !g.is_ambiguous_derived && !g.is_rescued_derived), excluded) };
    }
    return this.presentationCache.projected;
  }
  get workspacePanes(): string[] { return ['standard', ...(this.showHomoeolog ? ['homoeolog'] : []), ...(this.showFigure ? ['figure'] : [])]; }
  get scopeLabel(): string {
    const file = this.state.allFileResults[this.state.selectedScopeIndex];
    const name = this.state.selectedScopeIndex === -1 ? 'All merged' : (file?.fastq_file?.split('/').pop() || 'Results');
    return name + (this.state.isCuratedView ? ' · Curated' : '');
  }
  get standardFigureSource(): FigureSource {
    const current = this.state.currentGene;
    const gene = current ? withoutExcludedGroups([current], this.state.isCuratedView ? this.state.curationConfig?.excludedGroups : [])[0] : null;
    const target = this.state.selectedTarget;
    return { label: this.scopeLabel + ' · ' + (gene?.gene || '') + ' · ' + (target?.target_id || ''),
      rows: gene && target ? comparisonRows([gene], [gene.gene], target.target_id) : [] };
  }
  get homoeologFigureSource(): FigureSource { return this.comparison?.figureSource ?? { label: '', rows: [] }; }
  toggleHomoeolog(): void {
    this.homoeologOpen = !this.showHomoeolog;
    if (!this.homoeologOpen) this.homoeologFigureOpen = false;
    this.cdr.detectChanges(); this.focusWorkspace(this.homoeologOpen ? 'homoeolog' : 'standard');
  }
  toggleFigure(origin: 'standard' | 'homoeolog'): void {
    if (origin === 'standard') this.standardFigureOpen = !this.standardFigureOpen;
    else this.homoeologFigureOpen = !this.homoeologFigureOpen;
    this.cdr.detectChanges(); this.focusWorkspace(this.showFigure ? 'figure' : (this.showHomoeolog ? 'homoeolog' : 'standard'));
  }
  focusWorkspace(pane: string): void {
    const track = this.workspaceTrack?.nativeElement;
    const panels = track ? (Array.from(track.children) as HTMLElement[]).filter(element => !element.hidden) : [];
    const index = Math.max(0, this.workspacePanes.indexOf(pane));
    const twoVisible = !!track && panels.length > 1 && panels[0].clientWidth < track.clientWidth * .75;
    const start = Math.min(index, Math.max(0, panels.length - (twoVisible ? 2 : 1)));
    if (track && panels[start]) track.scrollTo({ left: panels[start].offsetLeft - panels[0].offsetLeft, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    this.activeWorkspacePane = pane;
    setTimeout(() => this.resizeStandardCharts(), 250);
  }
  onWorkspaceScroll(): void {
    const track = this.workspaceTrack?.nativeElement;
    const first = track?.firstElementChild as HTMLElement | null;
    if (!track || !first) return;
    const index = Math.round(track.scrollLeft / (first.clientWidth + 16));
    this.activeWorkspacePane = this.workspacePanes[Math.min(index, this.workspacePanes.length - 1)];
  }
  beginWorkspaceSwipe(event: PointerEvent): void {
    if ((event.target as HTMLElement).closest('button, input, select, a') || event.button !== 0) return;
    this.workspaceSwipe = { x: event.clientX, pointerId: event.pointerId };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }
  endWorkspaceSwipe(event: PointerEvent): void {
    if (!this.workspaceSwipe || event.pointerId !== this.workspaceSwipe.pointerId) return;
    const delta = event.clientX - this.workspaceSwipe.x; this.workspaceSwipe = null;
    if (Math.abs(delta) < 50) return;
    // Navigate the visible pair, not the last rail button clicked. At the right
    // edge, Homeo + Figure must return to Standard + Homeo in one gesture.
    const track = this.workspaceTrack?.nativeElement;
    const first = track?.firstElementChild as HTMLElement | null;
    const current = track && first ? Math.round(track.scrollLeft / (first.clientWidth + 16)) : 0;
    this.focusWorkspace(this.workspacePanes[Math.max(0, Math.min(this.workspacePanes.length - 1, current + (delta < 0 ? 1 : -1)))]);
  }
  cancelWorkspaceSwipe(): void { this.workspaceSwipe = null; }
  inspectHomoeolog(name: string): void {
    const index = this.state.genes.findIndex(g => g.gene === name);
    if (index < 0) return;
    this.state.selectedGeneIndex = index;
    const targetId = this.comparison?.activeTarget;
    this.state.selectedRowIndex = Math.max(0, this.state.genes[index].analysis_result.targets.findIndex(t => t.target_id === targetId));
    this.refreshDashboard(); this.focusWorkspace('standard');
  }
  @HostListener('window:resize')
  resizeStandardCharts(): void {
    if (this.dashboardDestroyed) return;
    for (const id of ['mutationPieChart', 'indelChart', 'donutChart']) Chart.getChart(id)?.resize();
  }

  isDraggingScroll = false;
  startX = 0;
  scrollLeft = 0;

  visibleGroupCount = 10;
  @ViewChild('excludeBelowMenu') excludeBelowMenu?: ElementRef<HTMLDivElement>;
  bulkMenuPosition = { x: 0, y: 0 };
  bulkGroupExclusion: { keys: string[]; context: string; config: unknown } | null = null;

  openExcludeBelow(event: MouseEvent, group: MutationGroup): void {
    event.preventDefault(); event.stopPropagation();
    if (!this.state.isCuratedView) return;
    this.cancelCurationSweep();
    const groups: MutationGroup[] = this.state.selectedTarget?.top_groups || [];
    const index = groups.findIndex(item => item.read_inner === group.read_inner);
    if (index < 0) return;
    // Use the complete ordered dataset, not the paginated DOM rows.
    this.bulkGroupExclusion = {
      keys: groups.slice(index).filter(item => !this.isGroupExcludedObj(item)).map(item => this.groupCurationKey(item)),
      context: this.curationContext('group'), config: this.state.curationConfig
    };
    this.bulkMenuPosition = {
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 278)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 54))
    };
    this.cdr.detectChanges();
    this.excludeBelowMenu?.nativeElement.showPopover();
    this.excludeBelowMenu?.nativeElement.querySelector<HTMLButtonElement>('button')?.focus();
  }

  closeExcludeBelow(): void {
    this.excludeBelowMenu?.nativeElement.hidePopover();
    this.bulkGroupExclusion = null;
  }

  confirmExcludeBelow(): void {
    const pending = this.bulkGroupExclusion;
    this.closeExcludeBelow();
    if (!pending || !this.state.isCuratedView || pending.config !== this.state.curationConfig || pending.context !== this.curationContext('group')) return;
    this.applyCurationItems(pending.keys.map(key => ({ kind: 'group', key })), true);
  }
  curationSweep: CurationSweep | null = null;
  private sweepPointer: { x: number; y: number; id: number } | null = null;
  private sweepFrame = 0;
  private suppressCurationClickUntil = 0;
  private curationAnchor: { kind: CurationItemKind; key: string; context: string; order: string[] } | null = null;

  groupCurationKey(group: MutationGroup): string {
    return groupKey(this.state.currentGene?.gene || '', this.state.selectedTarget?.target_id || '', group.read_inner);
  }

  isCurationPending(kind: CurationItemKind, key: string): boolean {
    return this.curationSweep?.kind === kind && !!this.curationSweep.items.has(key);
  }

  private curationContext(kind: CurationItemKind): string {
    return `${this.state.activeMode}:${this.state.activeTabId}:${kind === 'file' ? '' : this.state.selectedScopeIndex}:${kind === 'group' ? this.state.currentGene?.gene + ':' + this.state.selectedTarget?.target_id : ''}`;
  }

  private curationOrder(kind: CurationItemKind): string[] {
    return [...new Set(Array.from(document.querySelectorAll<HTMLElement>(`[data-curation-kind="${kind}"]`))
      .filter(element => element.getClientRects().length > 0).map(element => element.dataset['curationKey']!))];
  }

  beginCurationSweep(event: PointerEvent, kind: CurationItemKind, key: string, currentlyExcluded: boolean): void {
    if (!this.state.isCuratedView || event.button !== 0 || event.shiftKey) return;
    event.preventDefault(); event.stopPropagation();
    this.curationSweep = new CurationSweep(kind, !currentlyExcluded);
    this.curationSweep.add({ kind, key });
    this.curationAnchor = { kind, key, context: this.curationContext(kind), order: this.curationOrder(kind) };
    this.sweepPointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
    this.ngZone.runOutsideAngular(() => this.sweepFrame = requestAnimationFrame(() => this.advanceCurationSweep()));
  }

  @HostListener('document:pointermove', ['$event'])
  moveCurationSweep(event: PointerEvent): void {
    if (!this.sweepPointer || event.pointerId !== this.sweepPointer.id) return;
    const previous = { ...this.sweepPointer };
    const steps = Math.min(200, Math.max(1, Math.ceil(Math.hypot(event.clientX - previous.x, event.clientY - previous.y) / 12)));
    for (let i = 1; i <= steps; i++) {
      this.sweepPointer.x = previous.x + (event.clientX - previous.x) * i / steps;
      this.sweepPointer.y = previous.y + (event.clientY - previous.y) * i / steps;
      this.visitCurationItem();
    }
  }

  private visitCurationItem(): void {
    if (!this.curationSweep || !this.sweepPointer) return;
    const element = document.elementFromPoint(this.sweepPointer.x, this.sweepPointer.y)?.closest<HTMLElement>('[data-curation-kind]');
    const kind = element?.dataset['curationKind'] as CurationItemKind | undefined;
    const key = element?.dataset['curationKey'];
    if (kind && key !== undefined && this.curationSweep.add({ kind, key })) this.ngZone.run(() => this.cdr.detectChanges());
  }

  private advanceCurationSweep(): void {
    if (!this.curationSweep || !this.sweepPointer) return;
    const { x, y } = this.sweepPointer;
    const underPointer = document.elementFromPoint(x, y);
    const strip = underPointer?.closest<HTMLElement>('.scope-tabs, .gene-tabs');
    if (strip && strip.scrollWidth > strip.clientWidth) {
      const rect = strip.getBoundingClientRect();
      if (x > rect.right - 28) strip.scrollLeft += 9;
      else if (x < rect.left + 28) strip.scrollLeft -= 9;
    }
    if (y > window.innerHeight - 35) window.scrollBy(0, 9);
    else if (y < 35) window.scrollBy(0, -9);
    // Hit-test continuously, including while trackpad scrolling without pointer movement.
    this.visitCurationItem();
    this.sweepFrame = requestAnimationFrame(() => this.advanceCurationSweep());
  }

  @HostListener('document:pointerup', ['$event'])
  finishCurationSweep(event: PointerEvent): void {
    if (!this.curationSweep || event.pointerId !== this.sweepPointer?.id) return;
    const sweep = this.curationSweep;
    this.cancelCurationSweep();
    this.suppressCurationClickUntil = Date.now() + 500;
    this.applyCurationItems([...sweep.items.values()], sweep.excluded);
  }

  @HostListener('document:pointercancel')
  @HostListener('window:blur')
  cancelCurationSweep(): void {
    if (this.curationSweep) this.suppressCurationClickUntil = Date.now() + 500;
    if (this.sweepFrame) cancelAnimationFrame(this.sweepFrame);
    this.sweepFrame = 0; this.sweepPointer = null; this.curationSweep = null;
  }

  @HostListener('document:keydown.escape')
  escapeCurationSweep(): void { this.cancelCurationSweep(); this.closeExcludeBelow(); }

  onCurationClick(event: MouseEvent, kind: CurationItemKind, key: string, currentlyExcluded: boolean): void {
    event.preventDefault(); event.stopPropagation();
    if (!this.state.isCuratedView || (event.detail > 0 && Date.now() < this.suppressCurationClickUntil)) return;
    let keys = [key];
    const context = this.curationContext(kind);
    if (event.shiftKey && this.curationAnchor?.kind === kind && this.curationAnchor.context === context) {
      const order = this.curationAnchor.order.includes(key) ? this.curationAnchor.order : this.curationOrder(kind);
      keys = curationRange(order, this.curationAnchor.key, key);
    }
    if (!event.shiftKey) this.curationAnchor = { kind, key, context, order: this.curationOrder(kind) };
    this.applyCurationItems(keys.map(value => ({ kind, key: value })), !currentlyExcluded);
  }

  private applyCurationItems(items: CurationItem[], excluded: boolean): void {
    this.state.setCurationExclusions(items, excluded);
    this.state.destroyCharts();
    this.cdr.detectChanges();
    this.refreshDashboard();
  }

  get visibleTopGroups(): MutationGroup[] {
    const all = this.state.selectedTarget?.top_groups || [];
    return all.slice(0, this.visibleGroupCount);
  }

  get hasMoreGroups(): boolean {
    const all = this.state.selectedTarget?.top_groups || [];
    return all.length > this.visibleGroupCount;
  }

  get remainingGroupCount(): number {
    const all = this.state.selectedTarget?.top_groups || [];
    return Math.max(0, all.length - this.visibleGroupCount);
  }

  loadMoreGroups(): void {
    this.visibleGroupCount += 10;
    this.cdr.detectChanges();
  }

  get annotationCutSiteIndex(): number | null {
    return resolveAnnotationCutSite(this.state.selectedTarget);
  }

  startDragScroll(e: MouseEvent, element: HTMLElement) {
    const targetEl = e.target as HTMLElement;
    if (targetEl.tagName === 'BUTTON' || targetEl.tagName === 'INPUT' || targetEl.closest('.exclude-btn-group') || targetEl.closest('button')) {
      return;
    }
    this.isDraggingScroll = true;
    element.classList.add('dragging-scroll');
    this.startX = e.pageX - element.offsetLeft;
    this.scrollLeft = element.scrollLeft;
  }

  stopDragScroll(element: HTMLElement) {
    this.isDraggingScroll = false;
    element.classList.remove('dragging-scroll');
  }

  onDragScroll(e: MouseEvent, element: HTMLElement) {
    if (!this.isDraggingScroll) return;
    e.preventDefault();
    const x = e.pageX - element.offsetLeft;
    const walk = (x - this.startX) * 1.5;
    element.scrollLeft = this.scrollLeft - walk;
  }

  constructor(
    public state: AppStateService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}


  ngOnInit() {
    this.homoeologOpen = Boolean(this.state.lastRunParams?.homoeologMode);
    this.state.resultsUpdated$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.refreshDashboard();
    });

    if (this.state.genes.length > 0) {
      this.refreshDashboard();
    }
  }

  private destroy$ = new Subject<void>();

  ngOnDestroy() {
    this.dashboardDestroyed = true;
    clearTimeout(this.chartTimer);
    this.cancelCurationSweep();
    this.destroy$.next();
    this.destroy$.complete();
    this.state.destroyCharts();
  }

  selectGene(index: number) {
    this.state.selectedGeneIndex = index;
    this.state.selectedRowIndex = 0;
    this.state.destroyCharts();
    this.refreshDashboard();
  }

  selectScope(index: number) {
    this.state.selectedScopeIndex = index;
    this.state.updateVisibleGenes();
    this.refreshDashboard();
  }

  onMobileScopeChange(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    this.selectScope(value);
  }

  runMobileResultAction(action: string) {
    this.mobileActionsOpen = false;
    switch (action) {
      case 'curate':
        this.enterCuratedView();
        break;
      case 'original':
        this.exitCuratedView();
        break;
      case 'new-analysis':
        this.state.newAnalysis();
        break;
      case 'new-view':
        this.state.newViewer();
        break;
      case 'export':
        this.state.exportToExcel();
        break;
      case 'export-curated':
        this.state.exportCuratedToExcel();
        break;
    }
  }

  selectRow(index: number) {
    this.state.selectedRowIndex = index;
    this.refreshDashboard();
  }

  get flatTargets() {
    if (!this.state.currentGene) return [];
    return (this.state.currentGene.analysis_result.targets || []).map(t => ({
      file: { fastq_file: '', sample_name: this.state.currentGene!.gene, target_results: [] as any[] },
      target: t
    }));
  }

  get summaryTableData() {
    return this.flatTargets.map((item, index) => ({
      index,
      sample: this.state.currentGene?.gene ?? 'Gene',
      target: item.target.target_id,
      total: item.target.summary?.total_reads ?? 0,
      matched: item.target.summary?.aligned_reads ?? 0,
      outOfFrame: item.target.summary?.out_of_frame_pct ?? 0,
      inFrame: item.target.summary?.in_frame_pct ?? 0,
      noIndel: comparisonRows([this.state.currentGene!], [this.state.currentGene!.gene], item.target.target_id)[0]?.wt ?? 0,
      substitution: item.target.summary?.substitution_pct ?? 0
    }));
  }

  refreshDashboard() {
    this.ngZone.run(() => {
      const gene = this.state.currentGene;
      if (!gene?.analysis_result?.targets?.length) return;
      const targets = gene.analysis_result.targets;
      const idx = Math.min(this.state.selectedRowIndex, targets.length - 1);
      const previousTargetId = this.state.selectedTarget?.target_id;
      this.state.selectedTarget = targets[idx];
      if (previousTargetId !== this.state.selectedTarget?.target_id) {
        this.visibleGroupCount = 10;
      }

      if (!this.state.selectedTarget) {
        this.cdr.detectChanges();
        return;
      }

      this.state.metrics = {
        totalReads: this.state.selectedTarget.summary?.total_reads ?? 0,
        alignedReads: this.state.selectedTarget.summary?.aligned_reads ?? 0,
        avgOutOfFrame: this.state.selectedTarget.summary?.out_of_frame_pct ?? 0,
        avgInFrame: this.state.selectedTarget.summary?.in_frame_pct ?? 0,
        avgNoIndel: this.state.selectedTarget.summary?.no_indel_pct ?? 0,
        avgSubstitution: this.state.selectedTarget.summary?.substitution_pct ?? 0,
      };

      this.cdr.detectChanges();

      clearTimeout(this.chartTimer);
      this.chartTimer = setTimeout(() => {
        if (this.dashboardDestroyed) return;
        this.ngZone.run(() => {
          this.updateChartsForSelected();
          this.centerAnnotation();
          this.cdr.detectChanges();
        });
      }, 64);
    });
  }

  private centerAnnotation() {
    const container = document.querySelector('.unified-anno-container');
    if (!container || !this.state.selectedTarget) return;
    const cutIdx = this.annotationCutSiteIndex ?? 0;
    const stickyLeftWidth = 150;
    const baseWidth = 13;
    const padding = 15;
    const xPos = stickyLeftWidth + (cutIdx * baseWidth) + padding;
    const viewportWidth = container.clientWidth;
    const targetScroll = xPos - (viewportWidth / 2);
    container.scrollLeft = Math.max(0, targetScroll);
  }

  private updateChartsForSelected() {
    this.state.destroyCharts();
    const flat = this.flatTargets;
    if (!flat.length || !this.state.selectedTarget) return;
    const safeIdx = Math.min(this.state.selectedRowIndex, flat.length - 1);
    const selectedData = flat[safeIdx].target;

    const indelCtx = document.getElementById('indelChart') as HTMLCanvasElement;
    if (indelCtx) {
      this.state.addChart(new Chart(indelCtx, {
        type: 'bar',
        data: {
          labels: flat.map(item => this.state.isMultiReference ? item.target.target_id : `${item.file.sample_name || item.file.fastq_file.split('/').pop()} (${item.target.target_id})`),
          datasets: [
            { label: 'No Indel %', data: flat.map(item => item.target.summary?.no_indel_pct ?? 0), backgroundColor: '#009E73' },
            { label: 'Substitution %', data: flat.map(item => item.target.summary?.substitution_pct ?? 0), backgroundColor: '#CC79A7' },
            { label: 'In-frame %', data: flat.map(item => item.target.summary?.in_frame_pct ?? 0), backgroundColor: '#0072B2' },
            { label: 'Out-of-frame %', data: flat.map(item => item.target.summary?.out_of_frame_pct ?? 0), backgroundColor: '#E69F00' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { stacked: true }, y: { stacked: true, min: 0, max: 100, title: { display: true, text: 'Percentage (%)' } } },
          plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Mutation Distribution per Target' } }
        }
      }));
    }

    const pieCtx = document.getElementById('mutationPieChart') as HTMLCanvasElement;
    if (pieCtx && selectedData?.breakdown) {
      this.state.addChart(new Chart(pieCtx, {
        type: 'pie',
        data: {
          labels: ['No Indel', 'Substitution', 'In-frame Indel', 'Out-of-frame Indel'],
          datasets: [{
            data: [selectedData.breakdown.no_indel ?? 0, selectedData.breakdown.substitution ?? 0, selectedData.breakdown.in_frame ?? 0, selectedData.breakdown.out_of_frame ?? 0],
            backgroundColor: ['#009E73', '#CC79A7', '#0072B2', '#E69F00']
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, title: { display: true, text: `Mutation Distribution (${selectedData.target_id})` } } }
      }));
    }

    const donutCtx = document.getElementById('donutChart') as HTMLCanvasElement;
    if (donutCtx && selectedData?.summary) {
      this.state.addChart(new Chart(donutCtx, {
        type: 'doughnut',
        data: {
          labels: ['Indel edited', 'No indel', 'Substitution'],
          datasets: [{
            data: [selectedData.summary.modified ?? 0, selectedData.summary.unmodified ?? 0, selectedData.breakdown?.substitution ?? selectedData.summary.substitution_reads ?? 0],
            backgroundColor: ['#E69F00', '#009E73', '#CC79A7']
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: `Indel Editing (${selectedData.target_id})` } } }
      }));
    }
  }

  // ── Curation UI Methods ──────────────────────────────────────────────────────

  enterCuratedView() {
    this.state.enterCuratedView();
    this.cdr.detectChanges();
    this.refreshDashboard();
  }

  exitCuratedView() {
    this.state.exitCuratedView();
    this.state.destroyCharts();
    this.cdr.detectChanges();
    this.refreshDashboard();
  }

  /** Original file results from the snapshot (for file-level curation display) */
  get originalFileResults(): string[] {
    if (!this.state.originalSlotSnapshot) return [];
    return this.state.originalSlotSnapshot.allFileResults.map(
      (fr: any) => ((fr.fastq_file as string) || '').split('/').pop() || fr.fastq_file || ''
    );
  }

  /** Original gene names from the snapshot (for excluded gene display) */
  get originalGenes(): string[] {
    if (!this.state.originalSlotSnapshot) return [];
    return this.state.originalSlotSnapshot.mergedGenes.map(g => g.gene);
  }

  /** List of gene names that are currently excluded */
  get excludedGeneNames(): string[] {
    return this.state.curationConfig?.excludedGenes ?? [];
  }

  extractFileName(path: string): string {
    return (path || '').split('/').pop() || path || '';
  }

  // ── File toggle ──
  isFileExcluded(fileResult: any): boolean {
    const path = typeof fileResult === 'string' ? fileResult : (fileResult?.fastq_file || '');
    return this.state.isFileExcluded(this.extractFileName(path));
  }

  toggleFile(fileResult: any) {
    if (!this.state.isCuratedView) return;
    const path = typeof fileResult === 'string' ? fileResult : (fileResult?.fastq_file || '');
    const fileName = this.extractFileName(path);
    this.state.toggleFileExclusion(fileName);
    this.state.destroyCharts();
    this.cdr.detectChanges();
    this.refreshDashboard();
  }

  toggleGene(geneName: string) {
    if (!this.state.isCuratedView) return;
    this.state.toggleGeneExclusion(geneName);
    this.state.destroyCharts();
    this.cdr.detectChanges();
    this.refreshDashboard();
  }

  toggleTarget(geneName: string, targetId: string) {
    if (!this.state.isCuratedView) return;
    this.state.toggleTargetExclusion(geneName, targetId);
    this.state.destroyCharts();
    this.cdr.detectChanges();
    this.refreshDashboard();
  }

  toggleGroup(group: MutationGroup) {
    if (!this.state.isCuratedView) return;
    const gene = this.state.currentGene?.gene;
    const target = this.state.selectedTarget?.target_id;
    if (!gene || !target) return;
    this.state.toggleGroupExclusion(gene, target, group.read_inner);
    this.state.destroyCharts();
    this.cdr.detectChanges();
    this.refreshDashboard();
  }

  isTargetExcluded(geneName: string, targetId: string): boolean {
    return this.state.isTargetExcluded(geneName, targetId);
  }

  isGroupExcludedObj(group: MutationGroup): boolean {
    const gene = this.state.currentGene?.gene;
    const target = this.state.selectedTarget?.target_id;
    if (!gene || !target) return false;
    return this.state.isGroupExcluded(gene, target, group.read_inner);
  }
}
