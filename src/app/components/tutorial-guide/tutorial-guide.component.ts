import { Component, EventEmitter, Input, Output, OnDestroy, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormArray } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AppStateService } from '../../services/app-state.service';
import { ExcelExportService } from '../../services/excel-export.service';
import { addTryExample } from './guide-demo';
import { GUIDE_MASCOT_ASSETS, guideMascotPose, GuideMascotPose } from './guide-mascot';
import { SequenceWorkspaceService } from '../../services/sequence-workspace.service';
import { parseFastqFile } from '../../utils/parsers.utils';
import { workspaceExampleFile, workspaceExampleItems } from './module-examples';

export interface AdvantageCard {
  title: string;
  desc: string;
  badge?: string;
}

export interface GuideStep {
  id: string;
  stageName: string;
  headline: string;
  introLine?: string;
  cards?: AdvantageCard[];
  comparisonColumns?: Array<{
    colTitle: string;
    items: Array<{ label: string; desc: string }>;
  }>;
  paramItems?: Array<{ name: string; desc: string }>;
  textLines?: string[];
  targetSelector?: string;
  isIntro?: boolean;
  isPrereq?: boolean;
  isFinal?: boolean;
  nextButtonText?: string;
  interactiveAction?: 'create_guide_tab' | 'load_demo_files' | 'open_autofill' | 'load_demo_targets' | 'open_window_check' | 'test_curation' | 'exclude_group' | 'restore_group' | 'switch_reference' | 'click_export' | 'switch_to_viewer' | 'workspace_align' | 'workspace_search' | 'workspace_reads' | 'bench_load' | 'bench_run' | 'bench_normalization' | 'bench_mates' | 'bench_normalize' | 'homeo_open' | 'homeo_select' | 'figure_homeo' | 'figure_both';
  actionPromptText?: string;
  actionSuccessText?: string;
}

@Component({
  selector: 'app-tutorial-guide',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="guide-root" [class.figure-tour]="currentStep.id === 'result-figure-homeo'" [class.workspace-tour]="guideMode === 'workspace' && !currentStep.isIntro" [class.no-target]="!targetRect" tabindex="-1">

      <!-- ── Top-Left Fixed Previous Button ── -->
      <button type="button"
              class="btn-top-prev"
              *ngIf="currentStepIndex > 0"
              (click)="prevStep()"
              title="Previous Step (←)">
        ◀ Previous
      </button>

      <!-- ── Top-Right Fixed Exit Guide Button ── -->
      <button type="button" class="btn-top-exit" (click)="closeGuide()" title="Exit Guide (Esc)">
        Exit Guide ✕
      </button>

      <!-- ── Spotlight Cutout with 0% Tint Inside (Clean border without text label) ── -->
      <div class="spotlight-hole"
           *ngIf="targetRect && targetRect.height > 0 && targetRect.width > 0"
           [style.top.px]="targetRect.top - 6"
           [style.left.px]="targetRect.left - 6"
           [style.width.px]="targetRect.width + 12"
           [style.height.px]="targetRect.height + 12">
      </div>

      <!-- ── Character on Left + Speech Bubble on Right ── -->
      <div class="guide-dialog-wrapper"
           [class.is-centered]="!targetRect"
           [class.is-large-dialog]="currentStep.isIntro || currentStep.isPrereq"
           [ngStyle]="targetRect ? cardStyle : {}">

        <!-- Character Column (Left) -->
        <div class="mascot-col">
          <div class="mascot-avatar-frame"
               [attr.data-mascot-pose]="mascotPose"
               [class.is-celebrating]="mascotPose === 'success'">
            <img [src]="mascotSrc"
                 alt="" aria-hidden="true" decoding="async" draggable="false"
                 class="mascot-avatar-img" />
          </div>
          <span class="mascot-tag">CasMANGO</span>
        </div>

        <!-- Speech Bubble (Right) -->
        <div class="bubble-content">
          <h2 class="bubble-headline">{{ currentStep.headline }}</h2>

          <!-- Acronym Breakdown (Single line sentence with C, A, S, M, A, N, G, O highlighted) -->
          <div class="acronym-sentence" *ngIf="currentStep.isIntro && guideMode === 'analysis'">
            <span class="acro-letter">C</span>RISPR
            <span class="acro-letter">A</span>mplicon
            <span class="acro-letter">S</span>equencing with
            <span class="acro-letter">M</span>ultiplexed
            <span class="acro-letter">A</span>ssignment of
            <span class="acro-letter">N</span>GS reads for
            <span class="acro-letter">G</span>enotyping and
            <span class="acro-letter">O</span>utcome analysis
          </div>

          <!-- 1-line tool explanation -->
          <p class="bubble-intro-line" *ngIf="currentStep.introLine && guideMode !== 'hub'">
            {{ currentStep.introLine }}
          </p>

          <!-- Interactive 4-Card Selection Grid for Guide Hub -->
          <div class="hub-cards-grid" *ngIf="guideMode === 'hub'">
            <button type="button" class="hub-card"
                 *ngFor="let card of currentStep.cards; let i = index"
                 (click)="selectGuideFromHub(card.title)">
              <div class="hub-card-header">
                <span class="hub-card-badge">{{ card.badge }}</span>
                <span class="hub-card-arrow">▶</span>
              </div>
              <h3 class="hub-card-title">{{ card.title }}</h3>
            </button>
          </div>

          <!-- 3 Advantage Cards (Intro & Prereq) -->
          <div class="cards-grid" *ngIf="guideMode !== 'hub' && currentStep.cards && currentStep.cards.length > 0">
            <div class="grid-card" *ngFor="let card of currentStep.cards">
              <span class="grid-card-badge" *ngIf="card.badge">{{ card.badge }}</span>
              <h3 class="grid-card-title">{{ card.title }}</h3>
              <p class="grid-card-desc">{{ card.desc }}</p>
            </div>
          </div>

          <!-- Side-by-Side Comparison Columns (Platform / Mode / 3 Charts) -->
          <div class="comparison-grid"
               [class.three-cols]="currentStep.comparisonColumns.length === 3"
               *ngIf="currentStep.comparisonColumns">
            <div class="comp-col" *ngFor="let col of currentStep.comparisonColumns">
              <h4 class="comp-col-title">{{ col.colTitle }}</h4>
              <div class="comp-item" *ngFor="let item of col.items">
                <span class="comp-item-label">{{ item.label }}</span>
                <p class="comp-item-desc">{{ item.desc }}</p>
              </div>
            </div>
          </div>

          <!-- Parameter Specific Items List (Clean, not bulky) -->
          <div class="params-list" *ngIf="currentStep.paramItems">
            <div class="param-row" *ngFor="let p of currentStep.paramItems">
              <strong class="param-name">{{ p.name }}:</strong>
              <span class="param-desc">{{ p.desc }}</span>
            </div>
          </div>

          <!-- Text lines with Markdown bold support -->
          <div class="text-lines-block" *ngIf="currentStep.textLines && currentStep.textLines.length > 0">
            <p class="text-line" *ngFor="let line of currentStep.textLines" [innerHTML]="formatMarkdown(line)"></p>
          </div>

          <!-- Interactive Action Status Prompt (Clean yellow box without emojis) -->
          <div class="interactive-status-row" *ngIf="currentStep.interactiveAction">
            <div class="status-pill status-prompt" *ngIf="!isCurrentActionCompleted">
              <span class="pulse-indicator"></span>
              <span>{{ currentStep.actionPromptText }}</span>
            </div>
            <div class="status-pill status-success" *ngIf="isCurrentActionCompleted">
              <span class="check-mark">✓</span>
              <span>{{ currentStep.actionSuccessText }}</span>
            </div>
          </div>

          <p *ngIf="guideImportError" class="guide-import-error" role="alert">{{ guideImportError }}</p>

          <!-- Footer Actions -->
          <div class="bubble-footer">
            <button type="button"
                    class="btn-hub-return"
                    *ngIf="guideMode !== 'hub'"
                    (click)="returnToHub()"
                    title="Return to Guide Selection Hub">
              All Guides Hub
            </button>

            <ng-container *ngIf="guideMode === 'hub'">
              <button type="button" class="btn-secondary-action" (click)="closeGuide()">
                Close ✕
              </button>
            </ng-container>

            <ng-container *ngIf="guideMode !== 'hub' && !currentStep.isFinal">
              <button type="button"
                      class="btn-guide-next"
                      [disabled]="!isNextButtonEnabled"
                      (click)="nextStep()">
                {{ currentStep.nextButtonText || 'Next ▶' }}
              </button>
            </ng-container>

            <!-- Final Step of Any Tour: Hub, Next Tour, or Exit -->
            <ng-container *ngIf="guideMode !== 'hub' && currentStep.isFinal">
              <div class="final-actions-group">
                <button type="button"
                        class="btn-secondary-action"
                        (click)="closeGuide()">
                  Exit Guide ✕
                </button>
                <button type="button"
                        class="btn-guide-next"
                        *ngIf="guideMode === 'analysis'"
                        (click)="startResultsGuide()">
                  Next: Results Guide ▶
                </button>
                <button type="button"
                        class="btn-guide-next"
                        *ngIf="guideMode === 'result'"
                        (click)="startSequenceWorkspaceGuide()">
                  Next: Sequence Viewer Guide ▶
                </button>
                <button type="button"
                        class="btn-guide-next"
                        *ngIf="guideMode === 'workspace'"
                        (click)="startBenchmarkGuide()">
                  Next: Benchmark Guide ▶
                </button>
                <button type="button"
                        class="btn-guide-next"
                        *ngIf="guideMode === 'benchmark'"
                        (click)="returnToHub()">
                  Back to Hub ▶
                </button>
              </div>
            </ng-container>
          </div>
        </div>
      </div>

      <!-- ── Screen Bottom Overall Progress Bar ── -->
      <div class="screen-progress-track">
        <div class="screen-progress-fill" [style.width.%]="progressPercent"></div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    /* ── Fullscreen Overlay (Higher than all page elements, lets clicks pass through) ── */
    .guide-root {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      min-height: 100%;
      z-index: 99990;
      outline: none;
      pointer-events: none;
      user-select: none;
    }

    /* Backdrop when on Intro / Prereq without target spotlight */
    .guide-root.no-target {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* ── Top-Left Fixed Previous Button ── */
    .btn-top-prev {
      position: fixed;
      top: 18px;
      left: 24px;
      z-index: 99999;
      pointer-events: auto;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.25);
      color: #ffffff;
      padding: 8px 18px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.04em;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      backdrop-filter: blur(4px);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
      transition: all 0.2s ease;
    }

    .btn-top-prev:hover {
      background: #f59e0b;
      color: #0f172a;
      border-color: #f59e0b;
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(245, 158, 11, 0.4);
    }

    /* ── Top-Right Fixed Exit Guide Button ── */
    .btn-top-exit {
      position: fixed;
      top: 18px;
      right: 24px;
      z-index: 99999;
      pointer-events: auto;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.25);
      color: #ffffff;
      padding: 8px 18px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.04em;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      backdrop-filter: blur(4px);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
      transition: all 0.2s ease;
    }

    .btn-top-exit:hover {
      background: #ef4444;
      border-color: #ef4444;
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(239, 68, 68, 0.4);
    }

    /* ── Spotlight Cutout with 0% Tint Inside (Clean border without label) ── */
    .spotlight-hole {
      position: absolute;
      border-radius: 12px;
      box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.52);
      border: 2px solid #f59e0b;
      pointer-events: none;
      z-index: 99995;
      animation: pulseBorder 2.5s infinite ease-in-out;
      background: transparent !important;
    }

    @keyframes pulseBorder {
      0%, 100% { border-color: #f59e0b; box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.52), 0 0 15px rgba(245, 158, 11, 0.45); }
      50% { border-color: #fbbf24; box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.52), 0 0 25px rgba(251, 191, 36, 0.65); }
    }

    /* ── SVG Arrow Layer ── */
    .arrow-svg-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 99997;
    }

    .animated-dashed-arrow {
      animation: dashFlow 1.2s linear infinite;
    }

    @keyframes dashFlow {
      from { stroke-dashoffset: 20; }
      to { stroke-dashoffset: 0; }
    }

    .pulse-ring {
      animation: ringExpand 2s infinite ease-out;
      transform-origin: center;
    }

    @keyframes ringExpand {
      0% { r: 5; opacity: 1; }
      100% { r: 12; opacity: 0; }
    }

    /* ── Dialog Wrapper: Highest z-index on page, placed once in document flow ── */
    .guide-dialog-wrapper {
      position: absolute;
      z-index: 100000;
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      gap: 18px;
      pointer-events: auto;
      max-width: 90vw;
      animation: dialogPop 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .workspace-tour .guide-dialog-wrapper,
    .workspace-tour .guide-dialog-wrapper.is-centered {
      position: fixed; top: auto !important; bottom: 12px; left: 50% !important;
      width: min(1100px, calc(100vw - 48px)) !important; max-width: calc(100vw - 48px); margin: 0; gap: 12px;
      transform: translateX(-50%); animation: none;
      max-height: 188px; overflow-y: auto;
    }
    .workspace-tour .mascot-col { width: 64px; min-width: 64px; flex: 0 0 64px; }
    .workspace-tour .mascot-tag { max-width: 64px; box-sizing: border-box; font-size: 8px; padding: 3px 5px; }
    .workspace-tour .mascot-avatar-frame { width: 60px; height: 72px; }
    .workspace-tour .bubble-content { padding: 12px 16px; }
    .workspace-tour .bubble-headline { font-size: 17px; margin-bottom: 6px; }
    .workspace-tour .text-line { margin: 4px 0; }
    .workspace-tour .text-lines-block { margin-bottom: 4px; }
    .workspace-tour .interactive-status-row { margin: 4px 0; }
    .workspace-tour .status-pill { padding: 6px 10px; font-size: 11.5px; }
    .workspace-tour .guide-dialog-wrapper { flex-direction: row; }
    .workspace-tour .bubble-footer { margin-top: 8px; padding-top: 8px; }
    .workspace-tour .arrow-svg-layer { display: none; }
    .figure-tour .mascot-col{width:64px;flex:0 0 64px}
    .figure-tour .guide-dialog-wrapper{flex-direction:row;gap:12px}
    .figure-tour .mascot-col{flex-direction:column;align-items:center}
    .figure-tour .mascot-avatar-frame{width:60px;height:72px}
    .figure-tour .mascot-tag{max-width:64px;font-size:8px;box-sizing:border-box;padding:3px 5px}
    .figure-tour .bubble-content{padding:12px 16px}
    .figure-tour .bubble-headline{font-size:17px;margin-bottom:6px}
    .figure-tour .text-line{margin:4px 0;font-size:12px}
    .figure-tour .text-lines-block{margin-bottom:4px}
    .figure-tour .bubble-footer{margin-top:8px;padding-top:8px}

    .guide-dialog-wrapper.is-centered {
      position: relative;
      margin: auto;
      max-width: 820px;
      width: 90%;
      max-height: calc(100dvh - 100px);
      overflow-y: auto;
    }

    .guide-dialog-wrapper.is-large-dialog {
      max-width: 860px;
    }

    @keyframes dialogPop {
      from { transform: scale(0.97); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    /* ── Character Mascot Column (Left) ── */
    .mascot-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      margin-top: 4px;
    }

    .mascot-avatar-frame {
      position: relative;
      width: 100px;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .mascot-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.22));
    }
    .mascot-avatar-frame[data-mascot-pose="success"] .mascot-avatar-img {
      transform: scale(1.14);
      transform-origin: center bottom;
    }
    .guide-report-file { display: grid; gap: 8px; margin: 12px 0; }
    .guide-report-file [role="button"] { padding: 12px; border: 1px dashed #d97706; border-radius: 10px; background: #fffbeb; color: #78350f; cursor: grab; overflow-wrap: anywhere; text-align: center; }
    .guide-report-file [role="button"][aria-pressed="true"] { border-style: solid; background: #fef3c7; }
    .guide-report-file small { color: #64748b; line-height: 1.5; }
    .guide-import-error { color: #b91c1c; }

    /* One small acknowledgement, not a looping distraction while reading. */
    .mascot-avatar-frame.is-celebrating {
      animation: mascotCelebrate 520ms ease-out 1;
    }

    @keyframes mascotCelebrate {
      0%, 100% { transform: translateY(0) rotate(0); }
      40% { transform: translateY(-4px) rotate(-3deg); }
      70% { transform: translateY(-1px) rotate(1deg); }
    }

    @media (prefers-reduced-motion: reduce) {
      .mascot-avatar-frame.is-celebrating { animation: none; }
    }

    .mascot-tag {
      font-size: 11px;
      font-weight: 800;
      color: #ffffff;
      background: rgba(15, 23, 42, 0.85);
      padding: 3px 10px;
      border-radius: 999px;
      letter-spacing: 0.04em;
    }

    /* ── Speech Bubble (Right) ── */
    .bubble-content {
      position: relative;
      background: #ffffff;
      color: #1e293b;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      box-shadow: 0 20px 45px -8px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.06);
      padding: 24px 28px 20px 28px;
      flex: 1;
      min-width: 0;
    }

    .bubble-headline {
      margin: 0 0 10px 0;
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.02em;
    }

    /* ── Acronym Single-Line Sentence ── */
    .acronym-sentence {
      margin: 0 0 14px 0;
      font-size: 13.5px;
      font-weight: 600;
      color: #334155;
      line-height: 1.55;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 9px 15px;
      text-align: center;
    }

    .acro-letter {
      color: #ea580c;
      font-weight: 900;
      font-size: 15px;
    }

    .bubble-intro-line {
      margin: 0 0 16px 0;
      font-size: 14px;
      color: #475569;
      line-height: 1.55;
    }

    /* ── 3 Cards Grid (Intro & Prereq) ── */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-bottom: 16px;
    }

    .grid-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 14px 12px 14px;
      display: flex;
      flex-direction: column;
    }

    .grid-card-badge {
      font-size: 10px;
      font-weight: 900;
      color: #ea580c;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 4px;
    }

    .grid-card-title {
      margin: 0 0 4px 0;
      font-size: 14.5px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.35;
    }

    .grid-card-desc {
      margin: 0;
      font-size: 12px;
      color: #475569;
      line-height: 1.45;
    }

    /* ── 4 Hub Cards Grid (Guide Selection) ── */
    .hub-cards-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
      margin-bottom: 18px;
    }

    .hub-card {
      text-align: left;
      min-height: 140px;
      background: #f8fafc;
      border: 2px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    }

    .hub-card:hover {
      background: #ffffff;
      border-color: #f59e0b;
      box-shadow: 0 8px 24px rgba(245, 158, 11, 0.18);
      transform: translateY(-2px);
    }

    .hub-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .hub-card-badge {
      font-size: 11px;
      font-weight: 900;
      color: #ea580c;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: #fff7ed;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid #ffedd5;
    }

    .hub-card-arrow {
      color: #f59e0b;
      font-size: 13px;
      font-weight: 800;
      transition: transform 0.2s ease;
    }

    .hub-card:hover .hub-card-arrow {
      transform: translateX(3px);
    }

    .hub-card-title {
      margin: 0 0 6px 0;
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.35;
    }

    .hub-card-desc {
      margin: 0 0 14px 0;
      font-size: 12.5px;
      color: #475569;
      line-height: 1.48;
      flex: 1;
    }

    .btn-hub-start {
      background: linear-gradient(135deg, #f59e0b, #ea580c);
      color: #ffffff;
      border: none;
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      align-self: flex-start;
      box-shadow: 0 3px 10px rgba(234, 88, 12, 0.25);
      pointer-events: none;
    }

    /* ── Comparison Columns (Platform / Mode / 3 Charts) ── */
    .comparison-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 16px;
    }

    .comparison-grid.three-cols {
      grid-template-columns: repeat(3, 1fr);
    }

    .comp-col {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .comp-col-title {
      margin: 0;
      font-size: 13px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 6px;
    }

    .comp-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .comp-item-label {
      font-size: 13px;
      font-weight: 800;
      color: #ea580c;
    }

    .comp-item-desc {
      margin: 0;
      font-size: 12px;
      color: #475569;
      line-height: 1.4;
    }

    /* ── Parameters Clean List ── */
    .params-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
    }

    .param-row {
      font-size: 12.5px;
      line-height: 1.45;
    }

    .param-name {
      color: #0f172a;
      margin-right: 6px;
    }

    .param-desc {
      color: #475569;
    }

    /* ── Text lines ── */
    .text-lines-block {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 14px;
    }

    .text-line {
      margin: 0;
      font-size: 13.5px;
      color: #334155;
      line-height: 1.5;
    }

    /* ── Interactive Action Status Prompt (Yellow / Amber Highlight Box) ── */
    .interactive-status-row {
      margin-top: 12px;
      margin-bottom: 6px;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 16px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.01em;
    }

    .status-pill.status-prompt {
      background: #fef3c7;
      border: 1px solid #fde68a;
      color: #92400e;
    }

    .pulse-indicator {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #d97706;
      box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.7);
      animation: pulseDot 1.5s infinite;
      flex-shrink: 0;
    }

    @keyframes pulseDot {
      0% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.7); }
      70% { box-shadow: 0 0 0 8px rgba(217, 119, 6, 0); }
      100% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0); }
    }

    .status-pill.status-success {
      background: #dcfce7;
      border: 1px solid #bbf7d0;
      color: #15803d;
    }

    .check-mark {
      font-weight: 900;
    }

    /* ── Footer Actions ── */
    .bubble-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 10px;
      border-top: 1px solid #f1f5f9;
      padding-top: 14px;
    }

    .btn-guide-next {
      background: linear-gradient(135deg, #f59e0b, #ea580c);
      color: #ffffff;
      border: none;
      padding: 9px 22px;
      border-radius: 10px;
      font-size: 13.5px;
      font-weight: 800;
      letter-spacing: 0.02em;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);
      transition: all 0.15s ease;
    }

    .btn-guide-next:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(234, 88, 12, 0.45);
    }

    .btn-guide-next:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      box-shadow: none;
    }

    .btn-hub-return {
      background: #f8fafc;
      color: #64748b;
      border: 1px solid #cbd5e1;
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
      margin-right: auto;
      transition: all 0.15s ease;
    }

    .btn-hub-return:hover {
      background: #f1f5f9;
      color: #0f172a;
      border-color: #94a3b8;
    }

    .final-actions-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn-secondary-action {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #cbd5e1;
      padding: 9px 18px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-secondary-action:hover {
      background: #e2e8f0;
      color: #0f172a;
    }

    /* ── Bottom Progress Bar ── */
    .screen-progress-track {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 5px;
      background: rgba(255, 255, 255, 0.15);
      z-index: 100009;
    }

    .screen-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #f59e0b, #ea580c);
      transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 0 10px rgba(245, 158, 11, 0.8);
    }

    @media (max-width: 768px) {
      .cards-grid, .comparison-grid {
        grid-template-columns: 1fr;
      }
      .guide-dialog-wrapper {
        flex-direction: column;
        align-items: stretch;
      }
      .mascot-col {
        flex-direction: row;
        align-items: center;
      }
      .bubble-content {
        padding: 18px;
      }
    }
  `]
})
export class TutorialGuideComponent implements OnInit, OnDestroy {
  @Input() initialMode: 'hub' | 'analysis' | 'result' | 'workspace' | 'benchmark' = 'hub';
  @Output() close = new EventEmitter<void>();
  @Output() requestTab = new EventEmitter<'analysis' | 'viewer' | 'benchmark' | 'workspace'>();

  guideMode: 'hub' | 'analysis' | 'result' | 'workspace' | 'benchmark' = 'hub';
  currentStepIndex = 0;

  targetRect: { top: number; left: number; width: number; height: number; bottom: number; right: number } | null = null;
  cardStyle: { [key: string]: string } = {};

  arrowStartX = 0;
  arrowStartY = 0;
  arrowEndX = 0;
  arrowEndY = 0;
  pathD = '';

  guideTabId: string | null = null;
  guideTabCreated = false;
  demoFilesLoaded = false;
  demoTargetsLoaded = false;
  isAutofillOpen = false;
  windowCheckOpened = false;

  // Result Guide specific interactive flags
  curationTested = false;
  exportTested = false;
  viewerLoaded = false;
  reportArmed = false;
  guideImportError = '';
  private viewerPrepared = false;
  private restorePreview?: { slot: AppStateService['viewerSlot']; config: AppStateService['curationConfig']; curated: boolean; original: AppStateService['originalSlotSnapshot'] };
  private savedBenchmark?: Record<string, any>;
  private benchmarkUpdates?: Subscription;
  benchmarkUnavailable = false;
  private readonly benchmarkKeys = ['benchPlatform', 'benchPhred', 'benchWindow', 'benchMargin', 'benchDistanceWeight', 'benchExclusionFlank', 'benchCustomWindow', 'benchWindowLeft', 'benchWindowRight', 'benchRows', 'benchmarkResult', 'benchError'];

  private rafId: number | null = null;
  private destroyed = false;
  private internalAction = false;
  private pendingAction = false;
  private actionRevision = 0;
  private targetObserver?: ResizeObserver;
  private observedTarget?: Element;
  private excludedExample = false;
  private restoredExample = false;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private savedViewer?: AppStateService['viewerSlot'];
  private savedCuration?: { config: AppStateService['curationConfig']; curated: boolean; original: AppStateService['originalSlotSnapshot']; exported: File | null };
  // Block activation, not native touch scrolling through a long highlighted panel.
  private readonly guardedEvents = ['pointerdown', 'mousedown', 'click', 'dblclick', 'contextmenu', 'dragstart', 'dragover', 'drop', 'keydown', 'focusin'];
  private boundScroll = () => {
    if (this.destroyed || this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => { this.rafId = null; if (!this.destroyed) this.updateLayoutInstant(); });
  };
  private boundInteraction = (event: Event) => this.guardInteraction(event);

  steps: GuideStep[] = [
    // ── 0. Intro (Overview with Acronym) ──
    {
      id: 'intro',
      stageName: 'Introduction',
      headline: "Hi! I'm CasMANGO",
      introLine: 'CasMANGO is a 100% client-side web application built to accurately assign reads and analyze multiplexed CRISPR editing outcomes directly in your browser with zero server uploads.',
      cards: [
        {
          badge: 'Security & Privacy',
          title: '100% Client-Side Engine',
          desc: 'All sequencing reads are processed locally in your browser via Web Workers—zero files uploaded to external servers.'
        },
        {
          badge: 'Platform Agnostic',
          title: 'Illumina & Nanopore',
          desc: 'Supports short-read Illumina single/paired-end (with automated mate linking & gap X-padding) and long-read Oxford Nanopore amplicons.'
        },
        {
          badge: 'Polyploid Specialty',
          title: 'Ambiguity-Aware Assignment',
          desc: 'Retains uncertain reads in an explicit ambiguous group to prevent cross-misassignment among near-identical homeologs.'
        }
      ],
      nextButtonText: 'Next ▶',
      isIntro: true
    },

    // ── 1. Prerequisites ──
    {
      id: 'prerequisites',
      stageName: 'Prerequisites',
      headline: 'What You Need to Prepare',
      introLine: 'You only need 3 core inputs to begin analyzing your CRISPR editing outcomes:',
      cards: [
        {
          badge: 'Input 1',
          title: 'FASTQ File(s)',
          desc: 'Supported formats: .fastq, .fq, .fastq.gz, .fq.gz (from Illumina single/paired-end or Oxford Nanopore).'
        },
        {
          badge: 'Input 2',
          title: 'Gene Reference Sequence(s)',
          desc: 'The wild-type genomic sequence(s) against which sequencing reads are aligned and compared.'
        },
        {
          badge: 'Input 3',
          title: 'gRNA Target Sequence(s)',
          desc: 'Guide spacer sequence(s) used to define double-strand cleavage cut sites and target loci.'
        }
      ],
      nextButtonText: 'Start Interactive Tour ▶',
      isPrereq: true
    },

    // ── 2. Analysis Tabs ──
    {
      id: 'analysis-tabs',
      stageName: 'Analysis Tabs',
      headline: 'Open a Guide Analysis Tab',
      textLines: [
        'Keep independent analyses in separate tabs. In results, hover over Analyses or tap it to switch sessions.'
      ],
      targetSelector: '#guide-tabs-bar',
      interactiveAction: 'create_guide_tab',
      actionPromptText: 'Click the (+) button on the tabs bar to create a tab and proceed',
      actionSuccessText: 'Guide Analysis tab created! Click Next to continue.',
      nextButtonText: 'Next: Platform & Mode ▶'
    },

    // ── 3. Platform & Reference Mode ──
    {
      id: 'platform-mode',
      stageName: 'Platform & Mode',
      headline: 'Platform & Reference Mode',
      comparisonColumns: [
        {
          colTitle: 'Sequencing Platform',
          items: [
            { label: 'Nanopore', desc: 'Long-read amplicon alignment with terminal anchor checks.' },
            { label: 'Illumina', desc: 'Short-read single & paired-end sequencing with automated R1/R2 linking and gap X-padding.' }
          ]
        },
        {
          colTitle: 'Reference Mode',
          items: [
            { label: 'Standard', desc: 'Independent locus analysis (default for single-gene experiments).' },
            { label: 'Homeolog', desc: 'Same core analysis, plus additionally computes inter-subgenome relationships in the result dashboard.' }
          ]
        }
      ],
      targetSelector: '#guide-platform-section',
      nextButtonText: 'Next ▶'
    },

    // ── 4. File Upload ──
    {
      id: 'file-upload',
      stageName: 'File Upload',
      headline: 'Upload FASTQ Sequencing Files',
      textLines: [
        '• Supports .fastq and .gz files (Illumina pairs link automatically by name).'
      ],
      targetSelector: '#guide-upload-zone',
      interactiveAction: 'load_demo_files',
      actionPromptText: 'Click the upload zone to load the demo dataset (CPC, TRY, Pooled)',
      actionSuccessText: 'Demo files loaded (CPC, TRY, Pooled)! Click Next to continue.',
      nextButtonText: 'Next: Targets ▶'
    },

    // ── 5. Reference Sequence(s) & Target(s) ──
    {
      id: 'ref-config',
      stageName: 'Ref & Targets',
      headline: 'Reference Sequence(s) & Target(s)',
      textLines: [
        '• Enter wild-type amplicon sequence(s) and gRNA spacer(s). Cut sites and PAM coordinates are determined automatically.',
        '• Supports multiple guide RNAs per amplicon as well as separate gene loci.'
      ],
      targetSelector: '#guide-targets-section',
      nextButtonText: 'Next ▶'
    },

    // ── 6. Reference Configuration Actions ──
    {
      id: 'ref-configuration-actions',
      stageName: 'Config Options',
      headline: 'Batch Setup & Auto Fill',
      textLines: [
        '• Config per File assigns distinct reference amplicons to individual FASTQ libraries in pooled runs.'
      ],
      targetSelector: '#guide-autofill-btn',
      interactiveAction: 'open_autofill',
      actionPromptText: 'Click Auto Fill to expand the batch Excel configuration toolset',
      actionSuccessText: 'Auto Fill toolset opened! Click Next to view tools.',
      nextButtonText: 'Next: Auto Fill Tools ▶'
    },

    // ── 7. Auto Fill Toolset & Demo Reference Loading ──
    {
      id: 'autofill-panel',
      stageName: 'Auto Fill (Excel)',
      headline: 'Batch Configuration via Excel',
      paramItems: [
        { name: '1. Download Template', desc: 'Get an empty pre-formatted Excel template for batch target entry.' },
        { name: '2. Download Current Config', desc: 'Export your currently active gene & guide setups to an Excel workbook.' },
        { name: '3. Upload Sequence (Excel)', desc: 'Batch-import references and gRNAs to configure all defaults at once.' },
        { name: '4. Apply to Current File', desc: 'Apply an Excel sheet override only to the currently selected FASTQ library.' }
      ],
      targetSelector: '#guide-autofill-upload-btn',
      interactiveAction: 'load_demo_targets',
      actionPromptText: 'Click Upload Sequence (Excel) to load demo references and proceed',
      actionSuccessText: 'Demo CPC & TRY references loaded! Click Next to continue.',
      nextButtonText: 'Next ▶'
    },

    // ── 8. Window Check ──
    {
      id: 'window-check',
      stageName: 'Window Check',
      headline: 'Window Check: Compare Locus Windows',
      textLines: [
        '• Window Check compares extracted cut-site windows across amplicons to measure sequence similarity.'
      ],
      targetSelector: '#guide-window-check-btn',
      interactiveAction: 'open_window_check',
      actionPromptText: 'Click Window Check to view comparison and proceed',
      actionSuccessText: 'Adjust the window or click a similarity cell to compare the sequences.',
      nextButtonText: 'Next ▶'
    },

    // ── 9. Core Parameters ──
    {
      id: 'core-parameters',
      stageName: 'Core Parameters',
      headline: 'Core Alignment Thresholds',
      paramItems: [
        { name: 'Window Size (bp)', desc: 'Total analyzed sequence width centered around the cleavage site (default: 30 bp).' },
        { name: 'Data Filtering (Phred)', desc: 'Minimum Phred base-calling score to filter out low-confidence reads.' },
        { name: 'Assignment Margin (%)', desc: 'Score advantage required to assign a read and eliminate cross-calling.' },
        { name: 'Indel Threshold (%)', desc: 'Noise floor filter to exclude background sequencing errors.' }
      ],
      targetSelector: '#guide-controls-grid',
      nextButtonText: 'Next: Advanced ▶'
    },

    // ── 10. Advanced Parameters (Auto-expanded) ──
    {
      id: 'advanced-parameters',
      stageName: 'Advanced Settings',
      headline: 'Mutation Resilience & Custom Window',
      paramItems: [
        { name: 'Cut Site Exclusion Window', desc: 'Excludes mutations within cut site ±N bp from similarity calculations to prevent large deletions from distorting reference assignment.' },
        { name: 'Distance Weight', desc: 'Assigns higher weight to sequence differences (e.g. SNVs) located further from the cut site.' },
        { name: 'Custom Window', desc: 'Configures independent asymmetric Left and Right flank window boundaries around the cut site.' }
      ],
      targetSelector: '#guide-advanced-panel',
      nextButtonText: 'Next ▶'
    },

    // ── 11. Run Analysis & Viewers ──
    {
      id: 'run-and-view',
      stageName: 'Execution',
      headline: 'Start Analysis & View Outcomes',
      textLines: [
        '• In normal use, Start Local Analysis runs Web Workers with live progress bars. This walkthrough keeps execution locked; use Next: Results Guide to explore the prepared example.',
        '• Export comprehensive results to Excel (.xlsx) and drop them into Result Viewer anytime, or inspect accuracy in the Benchmark tab.',
        '• When you exit the guide, the "Guide Analysis" tab will be closed automatically, restoring your original workspace cleanly.'
      ],
      targetSelector: '#guide-run-btn',
      isFinal: true
    }
  ];

  hubSteps: GuideStep[] = [
    {
      id: 'hub',
      stageName: 'Guide Selection Hub',
      headline: 'Choose a guide',
      introLine: 'Select a guide below to explore the end-to-end interactive tutorial for that module:',
      cards: [
        {
          badge: 'Tour 1',
          title: 'CRISPR Analysis',
          desc: 'End-to-end pipeline setup: file upload, reference amplicons & gRNAs, auto fill, window check, and alignment parameters.'
        },
        {
          badge: 'Tour 2',
          title: 'Results & Result Viewer',
          desc: 'Explore editing profiles, mutation groups, curation and result reports.'
        },
        {
          badge: 'Tour 3',
          title: 'Sequence Viewer',
          desc: 'Load FASTQ reads from Results or Benchmark, align them, and search by read ID or motif.'
        },
        {
          badge: 'Tour 4',
          title: 'Benchmark',
          desc: 'In-browser labeled read ground truth evaluation and Illumina paired-end overlap mate normalization.'
        }
      ],
      isIntro: true
    }
  ];

  workspaceSteps: GuideStep[] = [
    {
      id: 'workspace-overview', stageName: 'Sequence Viewer', headline: 'Inspect reads in Sequence Viewer',
      introLine: 'Import FASTQ files, or bring reads directly from Benchmark or a mutation group after analysis. Saved result reports do not include the original FASTQ reads.',
      nextButtonText: 'Try it ▶', isIntro: true
    },
    {
      id: 'workspace-reads', stageName: 'Load FASTQ', headline: 'A workspace for your FASTQ reads',
      textLines: ['Click IMPORT to open a FASTQ file.'],
      targetSelector: '#guide-workspace-import', interactiveAction: 'workspace_reads',
      actionPromptText: 'Click IMPORT to load the example FASTQ',
      actionSuccessText: 'FASTQ loaded. Next, align the reads.',
      nextButtonText: 'Next: Align ▶'
    },
    {
      id: 'workspace-align', stageName: 'Align reads', headline: 'Align against a reference window',
      textLines: ['Align reads against a window sequence, or supply a reference and gRNA.'],
      targetSelector: '#guide-workspace-align-config', interactiveAction: 'workspace_align',
      actionPromptText: 'Click Run Alignment & Center Cut Sites',
      actionSuccessText: 'Reads aligned around the cut site.',
      nextButtonText: 'Next: Search ▶'
    },
    {
      id: 'workspace-search', stageName: 'Search reads', headline: 'Find a read by ID or sequence',
      textLines: ['Open ? to explore ID, edit-type and motif searches. Try NGG: N matches any DNA base.'],
      targetSelector: '#guide-workspace-search', interactiveAction: 'workspace_search',
      actionPromptText: 'Open ?, then search for NGG',
      actionSuccessText: 'Matching reads found.',
      nextButtonText: 'Finish ▶'
    },
    {
      id: 'workspace-final', stageName: 'Workspace Complete', headline: 'Load → align → search',
      textLines: ['Import reads, align them and search by ID or sequence.'],
      isFinal: true
    }
  ];

  benchmarkSteps: GuideStep[] = [
    {
      id: 'benchmark-overview',
      stageName: 'Benchmark Module',
      headline: 'Deterministic Benchmark & Normalization',
      introLine: 'CasMANGO includes built-in benchmarking utilities to evaluate classification accuracy against labelled datasets and inspect Illumina paired-end normalization.',
      cards: [
        {
          badge: 'Classification',
          title: 'Ground Truth Verification',
          desc: 'Validate assignment precision, cross-calling prevention, and ambiguity handling.'
        },
        {
          badge: 'Illumina',
          title: 'Overlap-Aware Normalization',
          desc: 'Form high-confidence consensus from qualifying mate overlaps or apply window-sized X-guards.'
        }
      ],
      nextButtonText: 'Next: Parameters & Platform ▶',
      isIntro: true
    },
    {
      id: 'benchmark-params',
      stageName: 'Benchmark Parameters',
      headline: 'Analysis Parameters for Benchmark',
      textLines: [
        '• Configure window size, Phred quality filter, and Assignment Margin for benchmark validation.',
        '• Toggle between Nanopore long-read amplicons and Illumina paired-end libraries.'
      ],
      targetSelector: '#guide-bench-params-card',
      nextButtonText: 'Next: Load a Small Example ▶'
    },
    {
      id: 'benchmark-dataset',
      stageName: 'Dataset Setup',
      headline: 'Labelled Classes & Expected References',
      textLines: [
        'Provide FASTQ reads and their expected reference for each class.'
      ],
      targetSelector: '#guide-bench-dataset-card',
      interactiveAction: 'bench_load', actionPromptText: 'Click Load CPC + TRY example', actionSuccessText: 'Both labelled FASTQ classes are loaded.',
      nextButtonText: 'Next: Run the Benchmark ▶'
    },
    {
      id: 'benchmark-run', stageName: 'Run Classification', headline: 'Run the real classification pipeline',
      textLines: ['Run Benchmark to compare assignments against the expected references.'],
      targetSelector: '#guide-bench-run', interactiveAction: 'bench_run',
      actionPromptText: 'Click Run Benchmark and wait for completion', actionSuccessText: 'Classification finished. Continue to the calculated metrics.',
      nextButtonText: 'Next: Classification Results ▶'
    },
    {
      id: 'benchmark-results', stageName: 'Calculated Metrics', headline: 'Read the classification results',
      textLines: ['Correct, Wrong and Ambiguous summarize assignment among usable reads. The table also reports filtered reads for each class.'],
      targetSelector: '#guide-bench-results', nextButtonText: 'Next: Illumina Normalization ▶'
    },
    {
      id: 'benchmark-normalization-mode', stageName: 'Illumina Normalization', headline: 'Switch to the normalization bench',
      textLines: ['The second benchmark utility inspects paired-end read preparation independently of reference assignment.'],
      targetSelector: '#guide-bench-normalization-btn', interactiveAction: 'bench_normalization',
      actionPromptText: 'Click Illumina Normalization', actionSuccessText: 'Normalization bench opened.', nextButtonText: 'Next: Load Example Mates ▶'
    },
    {
      id: 'benchmark-mates', stageName: 'Example Mate Pairs', headline: 'Load overlapping and separated mates',
      textLines: ['Load paired R1/R2 reads to inspect overlaps and separated mates.'],
      targetSelector: '#guide-bench-mates', interactiveAction: 'bench_mates', actionPromptText: 'Click Load example R1 + R2',
      actionSuccessText: 'Both mate files are loaded.', nextButtonText: 'Next: Normalize Reads ▶'
    },
    {
      id: 'benchmark-normalize', stageName: 'Run Normalization', headline: 'Normalize the example mates locally',
      textLines: ['Normalize the pairs to build consensus or X-padded reads.'],
      targetSelector: '#guide-bench-normalize-run', interactiveAction: 'bench_normalize', actionPromptText: 'Click Normalize Illumina Reads',
      actionSuccessText: 'Normalization complete.', nextButtonText: 'Next: Normalized Output ▶'
    },
    {
      id: 'benchmark-normalization-results', stageName: 'Normalized Output', headline: 'Consensus and X-padded output',
      textLines: ['Overlapping mates form a consensus; separated mates retain an X guard. The normalized FASTQ can be downloaded or opened in Sequence Viewer.'],
      targetSelector: '#guide-bench-normalization-results', nextButtonText: 'Finish Benchmark Tour ▶'
    },
    {
      id: 'benchmark-final',
      stageName: 'Benchmark Complete',
      headline: 'Benchmark Tour Complete!',
      introLine: 'You have explored all core modules of CasMANGO! Return to the Guide Hub or start analyzing your CRISPR experiments.',
      cards: [
        {
          badge: 'Ready to Run',
          title: 'Start Analyzing',
          desc: 'Load your FASTQ sequencing reads and discover accurate CRISPR outcomes with 100% client-side privacy.'
        }
      ],
      isFinal: true
    }
  ];

  resultSteps: GuideStep[] = [
    // ── R0. Result Introduction (Figure 2 Synthetic Benchmark) ──
    {
      id: 'result-welcome',
      stageName: 'Results Dashboard',
      headline: 'Results & Outcome Analysis',
      introLine: 'Explore editing profiles and mutation groups, then try curation.',
      cards: [
        {
          badge: 'References',
          title: 'Reference Results',
          desc: 'Switch between references to compare their editing profiles.'
        },
        {
          badge: 'Filter Transparency',
          title: 'Traceable Read Filtering',
          desc: 'Transparent stage-by-stage tracking: Raw Reads → Phred Passed → Usable for Assignment → Assigned Reads.'
        },
        {
          badge: 'Live Exploration',
          title: 'Interactive Curation',
          desc: 'Exclude or restore individual sequencing files, gene references, targets, or specific mutation groups on the fly.'
        }
      ],
      nextButtonText: 'Next: Read Filtering Flow ▶',
      isIntro: true
    },

    {
      id: 'result-references', stageName: 'Reference Results', headline: 'Switch from CPC to TRY',
      textLines: ['Select TRY to view its own read counts, editing charts and mutation groups. Each reference has a separate profile.'],
      targetSelector: '.gene-tabs-wrapper', interactiveAction: 'switch_reference',
      actionPromptText: 'Click the TRY reference tab', actionSuccessText: 'TRY selected. Continue to its read-filtering flow.',
      nextButtonText: 'Next: Read Filtering Flow ▶'
    },

    // ── R1. Read Flow & Margin Filter ──
    {
      id: 'result-read-flow',
      stageName: 'Read Flow Analytics',
      headline: 'Read Filtering & Ambiguity Exclusion',
      textLines: [
        '• **Raw Reads**: Initial total sequencing reads read from the FASTQ input file(s).',
        '• **Phred Passed**: Reads passing your minimum Phred average quality threshold.',
        '• **Usable for Assignment**: Filtered reads successfully matching outer flanking amplicon primers/anchors.',
        '• **Assigned Reads**: Reads unambiguously assigned to this target gene reference.',
        '• **Ambiguous Excluded**: Reads where alignment score difference was within your configured **Assignment Margin**—safely segregated to prevent cross-assignment false positives.'
      ],
      targetSelector: '#guide-read-flow-stripe',
      nextButtonText: 'Next: Summary Metrics ▶'
    },

    // ── R2. Summary Metrics Grid ──
    {
      id: 'result-metrics',
      stageName: 'Summary Metrics',
      headline: 'Summary Metrics Cards',
      textLines: [
        '• **Total & Aligned Reads**: Overall read count and percentage successfully assigned to this locus window.',
        '• **Out-of-frame %**: Frame-shifting indel rate (disruptive knockout mutations).',
        '• **In-frame %**: In-frame indels (multiples of 3 bp preserving reading frame).',
        '• **Unmodified %**: Wild-type unedited reads.',
        '• **Substitution %**: Base substitutions tracked in a distinct category according to policy.'
      ],
      targetSelector: '#guide-metrics-grid',
      nextButtonText: 'Next: 3 Visual Charts ▶'
    },

    // ── R3. 3 Visual Charts: Left - Center - Right Breakdown ──
    {
      id: 'result-charts',
      stageName: 'Visual Charts',
      headline: 'Mutation Outcome Charts (Left · Center · Right)',
      comparisonColumns: [
        {
          colTitle: 'Left: Mutation Pie Chart',
          items: [
            { label: 'Classification Ratio', desc: 'Visual proportion of Unmodified (WT), In-frame indels, Out-of-frame frame-shifts, and Substitutions.' },
            { label: 'Instant Focus', desc: 'Identifies dominant genotype class at a glance.' }
          ]
        },
        {
          colTitle: 'Center: Indel Distribution',
          items: [
            { label: 'Indel Size Spectrum', desc: 'High-resolution bar chart showing exact deletion (-) and insertion (+) sizes in nucleotides.' },
            { label: 'Frameshift Detection', desc: 'Colors highlight frameshifting indels vs 3bp-multiple in-frame alterations.' }
          ]
        },
        {
          colTitle: 'Right: Donut Summary',
          items: [
            { label: 'Total Efficiency', desc: 'Total editing efficiency summarizing modified vs unmodified amplicons.' },
            { label: 'Knockout Ratio', desc: 'Fast benchmark gauge for experimental knockout success.' }
          ]
        }
      ],
      targetSelector: '#guide-charts-section',
      nextButtonText: 'Next: Mutation Annotation Track ▶'
    },

    // ── R3. Mutation Annotation Track ──
    {
      id: 'result-annotation',
      stageName: 'Sequence Annotation',
      headline: 'Mutation Annotation Track',
      textLines: [
        '• REFERENCE 5\'→3\': Wild-type genomic reference sequence with the 20nt gRNA track highlighted.',
        '• Cut Site Indicator: Vertical marker marking the predicted Cas9 double-strand break (3 bp upstream of PAM).',
        '• Group Alignment Rows: Sequenced reads grouped by identical variant genotypes.',
        '• Variant Tokens: Hyphen (-) represents deletion, colored bases represent substitutions, and insertions are pinned at position.'
      ],
      targetSelector: '#guide-annotation-panel',
      nextButtonText: 'Next: FASTQ Export & Sequence Viewer ▶'
    },

    // ── R4. Actions in Annotation: FASTQ Download & Sequence Workspace ──
    {
      id: 'result-export-workspace',
      stageName: 'Target Actions',
      headline: 'Read FASTQ Export & Sequence Viewer',
      textLines: [
        '• Download FASTQ exports all target reads or one mutation group. Sequence Viewer opens them for inspection.',
        '• Read exports and direct transfer require the original FASTQ files from the current analysis.'
      ],
      targetSelector: '#guide-annotation-panel',
      nextButtonText: 'Next: Test Curation View ▶'
    },

    // ── R5. Interactive Curation: Free Exploration ──
    {
      id: 'result-curation',
      stageName: 'Data Curation',
      headline: 'Interactive Curation View',
      textLines: [
        'Create a separate curated view. Exclude and restore a group to update counts. Indel threshold is also adjustable here without rerunning alignment.'
      ],
      targetSelector: '#guide-curate-btn',
      interactiveAction: 'test_curation',
      actionPromptText: 'Click "Create Curated View" to continue',
      actionSuccessText: 'Curated view ready. Next, try excluding a group.',
      nextButtonText: 'Next: Exclude a Group ▶'
    },
    {
      id: 'result-exclude-group', stageName: 'Try Curation', headline: 'Exclude the last mutation group',
      textLines: ['Click × beside Group 5 to exclude it and update the summary.'],
      targetSelector: '#guide-annotation-panel', interactiveAction: 'exclude_group',
      actionPromptText: 'Click × beside Group 5', actionSuccessText: 'Group excluded. Notice its crossed-out row and the updated counts.',
      nextButtonText: 'Next: Restore the Group ▶'
    },
    {
      id: 'result-restore-group', stageName: 'Restore Curation', headline: 'Restore the excluded group',
      textLines: ['Click ↩ to restore the group and its reads.'],
      targetSelector: '#guide-annotation-panel', interactiveAction: 'restore_group',
      actionPromptText: 'Click ↩ beside the excluded group', actionSuccessText: 'Group restored. The original counts are back.',
      nextButtonText: 'Next: Compare References ▶'
    },

    {
      id: 'result-homeo-open', stageName: 'Optional Analysis', headline: 'Explore Homeolog analysis',
      textLines: ['Available in Homeolog mode. Choose a combination to compare editing balance. Explore the co-editing model if useful: it assumes independent editing, not measured same-cell editing.'],
      targetSelector: '#guide-open-homeo', nextButtonText: 'Next: Figure workspace ▶'
    },
    {
      id: 'result-figure-homeo', stageName: 'Optional Figures', headline: 'Explore the figure workspace',
      textLines: ['Open Figure beside Curate. Choose references or a Homeolog combination in Setup; arrange panels and view the figure alongside. On a small screen, switch between Setup and Figure.'],
      targetSelector: '#guide-figure-btn', nextButtonText: 'Next: Export reports ▶'
    },

    // ── R6. Export Excel Reports ──
    {
      id: 'result-export-report',
      stageName: 'Export Reports',
      headline: 'Export Multi-Sheet Excel Reports',
      textLines: [
        '• Excel reports contain per-file results, read-flow summaries and charts.',
        '• Export Curated includes the adjusted results and exclusion record.'
      ],
      targetSelector: '#guide-export-excel-btn',
      interactiveAction: 'click_export',
      actionPromptText: 'Click Export to preview the report workflow. No file will be saved during this guide.',
      actionSuccessText: 'Report ready.',
      nextButtonText: 'Next: Reproduce in Result Viewer ▶'
    },

    // ── R7. Result Viewer Reproducibility ──
    {
      id: 'result-viewer-reproduce',
      stageName: 'Result Viewer',
      headline: 'Reproduce Results in Result Viewer',
      textLines: [
        'Click the drop zone to open the result report.'
      ],
      targetSelector: '#guide-viewer-dropzone',
      interactiveAction: 'switch_to_viewer',
      actionPromptText: 'Click the empty drop zone',
      actionSuccessText: 'Result loaded into Result Viewer! Complete dashboard restored.',
      nextButtonText: 'Next: Sequence Viewer Guide ▶'
    },
    {
      id: 'result-final-hub',
      stageName: 'Results Complete',
      headline: 'Results Guide Complete!',
      introLine: 'You have explored all outcome analytics, annotation tracks, curation options, and Excel reports. What would you like to explore next?',
      cards: [
        {
          badge: 'Next Guide',
          title: 'Sequence Viewer Guide',
          desc: 'Load, align and search FASTQ reads.'
        },
        {
          badge: 'Next Guide',
          title: 'Benchmark Guide',
          desc: 'Explore labeled dataset validation and Illumina paired-end normalization.'
        }
      ],
      isFinal: true
    }
  ];

  constructor(
    public state: AppStateService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private excel: ExcelExportService,
    private workspace?: SequenceWorkspaceService
  ) {}

  get currentSteps(): GuideStep[] {
    switch (this.guideMode) {
      case 'hub':
        return this.hubSteps;
      case 'result':
        return this.resultSteps;
      case 'workspace':
        return this.workspaceSteps;
      case 'benchmark':
        return this.benchmarkSteps;
      case 'analysis':
      default:
        return this.steps;
    }
  }

  get currentStep(): GuideStep {
    return this.currentSteps[this.currentStepIndex];
  }

  get mascotPose(): GuideMascotPose {
    return guideMascotPose(this.currentStep, this.isCurrentActionCompleted, this.pendingAction);
  }

  get mascotSrc(): string {
    return GUIDE_MASCOT_ASSETS[this.mascotPose];
  }

  get isLastStep(): boolean {
    return this.currentStepIndex === this.currentSteps.length - 1;
  }

  get progressPercent(): number {
    return Math.round(((this.currentStepIndex + 1) / this.currentSteps.length) * 100);
  }

  get currentStepTargetSelector(): string | undefined {
    const step = this.currentStep;
    if (step.id === 'workspace-search' && document.querySelector('#guide-workspace-search-help-panel')) return '#guide-workspace-find-region';
    if (step.id === 'result-homeo-open' && document.querySelector('#guide-open-homeo[aria-pressed="true"]')) return '#guide-homeo-result-pane';
    if (step.id === 'result-figure-homeo') {
      return document.querySelector('#guide-figure-btn[aria-pressed="true"]') ? '#guide-figure-workspace' : '#guide-figure-btn';
    }
    if (step.id === 'result-viewer-reproduce' && this.viewerLoaded) return '#resultsSection';
    if (['workspace-align', 'workspace-reads'].includes(step.id) && this.isCurrentActionCompleted) return '#guide-workspace-viewer';
    if (step.id === 'benchmark-run' && this.isCurrentActionCompleted) return '#guide-bench-results';
    if (step.id === 'benchmark-normalization-mode' && this.isCurrentActionCompleted) return '#guide-bench-normalization-params';
    if (step.id === 'benchmark-normalize' && this.isCurrentActionCompleted) return '#guide-bench-normalization-results';
    if (step.id === 'result-curation' && this.state.isCuratedView) return '#guide-exit-curate-btn';
    if (step.id === 'result-export-report' && this.state.isCuratedView) return '#guide-export-curated-btn';
    if (step.id === 'file-upload' && this.demoFilesLoaded) {
      return '#guide-upload-section';
    }
    if (step.id === 'window-check' && this.windowCheckOpened) {
      return document.querySelector('#guide-pair-comparison') ? '#guide-pair-comparison' : '#guide-window-check-panel';
    }
    return step.targetSelector;
  }

  get isCurrentActionCompleted(): boolean {
    const step = this.currentStep;
    if (!step.interactiveAction) return true;
    switch (step.interactiveAction) {
      case 'create_guide_tab':
        return this.guideTabCreated;
      case 'load_demo_files':
        return this.demoFilesLoaded;
      case 'open_autofill':
        return this.isAutofillOpen || document.querySelector('#guide-autofill-panel') !== null;
      case 'load_demo_targets':
        return this.demoTargetsLoaded;
      case 'open_window_check':
        return this.windowCheckOpened && document.querySelector('#guide-window-check-panel') !== null;
      case 'test_curation':
        return this.state.isCuratedView;
      case 'switch_reference': return this.state.currentGene?.gene === 'TRY';
      case 'homeo_open': return !!document.querySelector('#guide-open-homeo[aria-pressed="true"]');
      case 'homeo_select': return !!document.querySelector('#guide-homeo-comparison[data-selection-count="1"] #guide-homeo-second-reference[aria-pressed="false"]');
      case 'figure_homeo':
      case 'figure_both': return !!document.querySelector('#guide-figure-btn[aria-pressed="true"]') && Number(document.querySelector('[data-figure-source="standard"]')?.getAttribute('data-panel-count') || 0) >= 4;
      case 'exclude_group': return this.excludedExample;
      case 'restore_group': return this.restoredExample;
      case 'click_export':
        return this.exportTested || this.state.lastExportedFile !== null;
      case 'switch_to_viewer':
        return this.viewerLoaded;
      case 'workspace_align': return !!document.querySelector('#guide-workspace-reads[data-aligned="true"]');
      case 'workspace_search': return !!document.querySelector('#guide-workspace-reads[data-guide-search-complete="true"]');
      case 'workspace_reads': return this.workspace?.getSelectedItem()?.type === 'fastq';
      case 'bench_load': return !!this.state.benchRows?.length && this.state.benchRows.every(r => r.file?.name.startsWith('guide_'));
      case 'bench_run': return !!this.state.benchmarkResult && !this.state.benchIsLoading;
      case 'bench_normalization': return !!document.querySelector('#guide-bench-normalization-params');
      case 'bench_mates': return !!document.querySelector('#guide-bench-mates[data-guide-loaded="true"]');
      case 'bench_normalize': return !!document.querySelector('#guide-bench-normalization-results[data-guide-complete="true"]');
      default:
        return true;
    }
  }

  get isNextButtonEnabled(): boolean {
    if (this.pendingAction) return false;
    if (this.guideMode === 'benchmark' && this.benchmarkUnavailable) return false;
    const step = this.currentStep;
    if (step.targetSelector && !document.querySelector(this.currentStepTargetSelector!)) return false;
    if (step.isIntro || step.isPrereq) return true;
    if (step.interactiveAction) {
      return this.isCurrentActionCompleted;
    }
    return true;
  }

  ngOnInit() {
    this.benchmarkUpdates = this.state.benchmarkUpdated$?.subscribe(() => {
      if (this.guideMode === 'benchmark' && !this.destroyed) {
        // Refresh the parent/sibling page as well as this overlay in zoneless Angular.
        this.requestTab.emit('benchmark');
        this.later(() => { this.cdr.detectChanges(); this.updateLayoutInstant(); }, 50);
      }
    });
    // Preload the small transparent assets so success feedback does not flash.
    if (typeof Image !== 'undefined') {
      for (const src of Object.values(GUIDE_MASCOT_ASSETS)) {
        const image = new Image();
        image.src = src;
      }
    }
    document.body?.classList.add('casmango-guide-active');
    this.guideMode = this.initialMode;
    if (this.guideMode === 'result') {
      this.requestTab.emit('viewer');
      this.ensureFigure2SyntheticDataLoaded();
    } else {
      this.state.collapseAnalysisPanels();
      if (this.guideMode === 'workspace') this.startSequenceWorkspaceGuide();
      if (this.guideMode === 'benchmark') this.startBenchmarkGuide();
    }
    for (const type of this.guardedEvents) window.addEventListener(type, this.boundInteraction, { capture: true, passive: false });
    window.addEventListener('scroll', this.boundScroll, true);
    (document.activeElement as HTMLElement | null)?.blur();
    this.handleStepSideEffects();
    this.updateLayoutInstant();
  }

  ngOnDestroy() {
    window.removeEventListener('scroll', this.boundScroll, true);
    this.benchmarkUpdates?.unsubscribe();
    document.body?.classList.remove('casmango-guide-active');
    this.destroyed = true;
    this.clearPendingActions();
    this.targetObserver?.disconnect();
    for (const type of this.guardedEvents) window.removeEventListener(type, this.boundInteraction, true);
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    this.removeGuideTab();
    this.restoreViewer();
    this.restoreModuleExamples();
  }

  // The spotlight is visual only. Enforce interaction rules at capture phase,
  // before Angular handlers, including keyboard activation and drag/drop.
  private get isOptionalExploration(): boolean {
    return this.guideMode === 'result' && ['result-homeo-open', 'result-figure-homeo'].includes(this.currentStep.id);
  }

  private allowedSelectors(): string[] {
    if (this.pendingAction) return [];
    if (this.isOptionalExploration) return [
      '#guide-open-homeo', '.homeo-pane', '.figure-workspace', '.workspace-rail',
      '#guide-figure-btn', '.gene-tab-btn', '.scope-tab-btn'
    ];
    switch (this.currentStep.id) {
      case 'analysis-tabs': return this.guideTabCreated ? [] : ['#guide-add-tab-btn'];
      case 'file-upload': return this.demoFilesLoaded ? [] : ['#guide-upload-zone'];
      case 'ref-configuration-actions': return ['#guide-autofill-btn'];
      case 'autofill-panel': return this.demoTargetsLoaded ? [] : ['#guide-autofill-upload-btn'];
      case 'window-check': return this.windowCheckOpened
        ? ['#guide-window-check-panel input', '#guide-window-check-panel .similarity-table td',
           '#guide-pair-comparison .btn-close-comparison', '#guide-pair-comparison .alignment-box']
        : ['#guide-window-check-btn'];
      case 'result-references': return ['.gene-tab-btn[data-curation-key="TRY"]'];
      case 'result-homeo-open': return this.isCurrentActionCompleted ? [] : ['#guide-open-homeo'];
      case 'result-homeo-select': return this.isCurrentActionCompleted ? [] : ['#guide-homeo-second-reference'];
      case 'result-figure-homeo':
      case 'result-figure-both': return ['#guide-figure-btn', '#guide-figure-workspace'];
      case 'result-curation': return this.state.isCuratedView ? [] : ['#guide-curate-btn'];
      case 'result-exclude-group': return this.excludedExample ? [] : ['#guide-annotation-panel [data-guide-group-rank="5"] .exclude-btn-group'];
      case 'result-restore-group': return this.restoredExample ? [] : ['#guide-annotation-panel [data-guide-group-rank="5"] .exclude-btn-group'];
      case 'result-export-report': return this.exportTested ? [] : [this.state.isCuratedView ? '#guide-export-curated-btn' : '#guide-export-excel-btn'];
      case 'result-viewer-reproduce': return this.viewerLoaded ? [] : ['#guide-viewer-dropzone'];
      case 'workspace-reads': return this.isCurrentActionCompleted ? [] : ['#guide-workspace-import'];
      case 'workspace-align': return this.isCurrentActionCompleted ? [] : ['#guide-workspace-run-align'];
      case 'workspace-search': return ['#guide-workspace-search input', '#guide-workspace-search button', '#guide-workspace-search-help', '#guide-workspace-search-help-panel button'];
      case 'benchmark-dataset': return this.isCurrentActionCompleted ? [] : ['#guide-bench-load-classes'];
      case 'benchmark-run': return this.isCurrentActionCompleted ? [] : ['#guide-bench-run'];
      case 'benchmark-normalization-mode': return ['#guide-bench-normalization-btn'];
      case 'benchmark-mates': return this.isCurrentActionCompleted ? [] : ['#guide-bench-load-mates'];
      case 'benchmark-normalize': return this.isCurrentActionCompleted ? [] : ['#guide-bench-normalize-run'];
      default: return []; // Explanatory steps are read-only, even inside the spotlight.
    }
  }

  private guardInteraction(event: Event) {
    if (this.internalAction || this.destroyed) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    // Excel export creates its own temporary download link outside the tour.
    if (event.type === 'click' && !event.isTrusted && target.tagName === 'A'
        && (target as HTMLAnchorElement).download && (target as HTMLAnchorElement).href.startsWith('blob:')) return;
    if (event.type === 'keydown' && (event as KeyboardEvent).key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation(); this.closeGuide(); return;
    }
    if (target.closest('app-tutorial-guide')) return;
    if (this.currentStep.id === 'workspace-reads' && target.closest('.item-actions')) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (this.currentStep.id === 'result-viewer-reproduce' && target.closest('#guide-viewer-dropzone')
        && !this.viewerLoaded && !this.pendingAction && ['dragover', 'drop'].includes(event.type)) {
      event.preventDefault(); event.stopImmediatePropagation();
      const transfer = (event as DragEvent).dataTransfer;
      if (event.type === 'dragover') { if (transfer) transfer.dropEffect = 'copy'; return; }
      const file = transfer?.getData('application/x-casmango-guide-report') === 'example'
        ? this.state.lastExportedFile : transfer?.files?.[0];
      if (file?.name?.toLowerCase().endsWith('.xlsx')) void this.importGuideResult(file);
      else this.guideImportError = 'Drop the exported .xlsx report here.';
      this.cdr.detectChanges();
      return;
    }
    if (['result-exclude-group', 'result-restore-group'].includes(this.currentStep.id)
        && ['pointerdown', 'mousedown', 'touchstart'].includes(event.type)) {
      // A tutorial click must not start the normal drag-to-delete sweep.
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    const permitted = (!['contextmenu', 'dblclick', 'dragstart', 'dragover', 'drop'].includes(event.type)
      || (this.isOptionalExploration && ['dragstart', 'dragover', 'drop'].includes(event.type) && !!target.closest('.panel-item')))
      && this.allowedSelectors().some(selector => target.closest(selector));
    if (!permitted) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.type === 'focusin') (document.querySelector('.btn-top-exit') as HTMLElement | null)?.focus();
      return;
    }
    const groupKey = ['result-exclude-group', 'result-restore-group'].includes(this.currentStep.id)
      && event.type === 'keydown' && ['Enter', ' '].includes((event as KeyboardEvent).key);
    if (event.type === 'click' || groupKey) this.onCaptureClick(event as MouseEvent);
  }

  private later(callback: () => void, delay: number) {
    const mode = this.guideMode, step = this.currentStepIndex;
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (!this.destroyed && this.guideMode === mode && this.currentStepIndex === step) callback();
    }, delay);
    this.timers.add(timer);
  }

  private clearPendingActions() {
    this.actionRevision++;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.pendingAction = false;
  }

  private clickInternally(selector: string) {
    this.internalAction = true;
    try { (document.querySelector(selector) as HTMLElement | null)?.click(); }
    finally { this.internalAction = false; }
  }

  private onCaptureClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target) return;

    if (this.isOptionalExploration) {
      this.later(() => {
        this.revealResultTarget();
        this.cdr.detectChanges(); this.updateLayoutInstant();
      }, 300);
    }

    if (['result-exclude-group', 'result-restore-group'].includes(this.currentStep.id)) {
      event.preventDefault(); event.stopImmediatePropagation();
      const gene = this.state.currentGene?.gene;
      const targetResult = this.state.selectedTarget;
      const group = targetResult?.top_groups?.find((g: any) => g.group_rank === 5);
      if (gene && group) {
        this.state.toggleGroupExclusion(gene, targetResult.target_id, group.read_inner);
        const excluded = this.state.isGroupExcluded(gene, targetResult.target_id, group.read_inner);
        if (this.currentStep.id === 'result-exclude-group') this.excludedExample = excluded;
        else this.restoredExample = !excluded;
        this.cdr.detectChanges(); this.updateLayoutInstant();
      }
      return;
    }

    if (this.currentStep.id === 'workspace-reads' && target.closest('#guide-workspace-import')) {
      event.preventDefault(); event.stopImmediatePropagation();
      void this.loadWorkspaceExample();
      return;
    }
    if (this.currentStep.id === 'window-check' && target.closest('.similarity-table td, #guide-pair-comparison .btn-close-comparison')) {
      this.later(() => {
        document.querySelector('#guide-pair-comparison')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        this.updateLayoutInstant();
      }, 100);
    }

    // 1. Step: Analysis Tabs - user clicks (+) button
    if (this.currentStep.id === 'analysis-tabs') {
      if (target.closest('#guide-add-tab-btn')) {
        event.preventDefault(); event.stopImmediatePropagation();
        this.state.addTab('Guide Analysis');
        this.onTabCreatedByClick();
      }
    }

    // 2. Step: File Upload - user clicks upload dropzone
    if (this.currentStep.id === 'file-upload') {
      if (target.closest('#guide-upload-zone')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.loadDemoFiles();
      }
    }

    // 3. Step: Reference Configuration Actions - user clicks Auto Fill button
    if (this.currentStep.id === 'ref-configuration-actions') {
      if (target.closest('#guide-autofill-btn')) {
        this.isAutofillOpen = true;
        this.pendingAction = true;
        this.cdr.detectChanges();
        this.later(() => {
          this.pendingAction = false;
          this.nextStep();
        }, 220);
      }
    }

    // 4. Step: Auto Fill Panel - user clicks specifically Upload Sequence (Excel)
    if (this.currentStep.id === 'autofill-panel') {
      if (target.closest('#guide-autofill-upload-btn') || target.closest('.btn-template-upload')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.loadDemoTargets();
      }
    }

    // 5. Step: Window Check - user clicks Window Check button
    if (this.currentStep.id === 'window-check') {
      if (target.closest('#guide-window-check-btn')) {
        this.windowCheckOpened = true;
        this.cdr.detectChanges();
        this.later(() => {
          document.querySelector('#guide-window-check-panel')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
          this.updateLayoutInstant();
        }, 200);
      }
    }

    // 6. Result Guide Step: Test Curation (click curate button or toggle exclusions)
    if (this.currentStep.id === 'result-curation') {
      if (target.closest('#guide-curate-btn') || target.closest('#guide-exit-curate-btn') || target.closest('.exclude-toggle') || target.closest('.exclude-btn-sm') || target.closest('.exclude-btn-group')) {
        this.curationTested = true;
        this.cdr.detectChanges();
        this.later(() => {
          if (this.state.isCuratedView) this.nextStep();
          else this.updateLayoutInstant();
        }, 80);
      }
    }

    // 7. Result Guide Step: Export Excel / Curated
    if (this.currentStep.id === 'result-export-report') {
      if (target.closest('#guide-export-excel-btn') || target.closest('#guide-export-curated-btn')) {
        event.preventDefault(); event.stopImmediatePropagation();
        void this.exportGuideResult();
      }
    }

    // Restore the exported guide example with one drop-zone click.
    if (this.currentStep.id === 'result-viewer-reproduce') {
      if (target.closest('#guide-viewer-dropzone')) {
        event.preventDefault(); event.stopImmediatePropagation();
        void this.importGuideResult();
      }
    }
    if (['workspace-align', 'workspace-search', 'benchmark-dataset', 'benchmark-run', 'benchmark-normalization-mode', 'benchmark-mates', 'benchmark-normalize'].includes(this.currentStep.id)) {
      this.later(() => {
        if (this.currentStep.id === 'workspace-align' && this.isCurrentActionCompleted) this.clickInternally('#guide-workspace-align-toggle');
        this.cdr.detectChanges(); this.updateLayoutInstant();
      }, 100);
    }
  }

  private onTabCreatedByClick() {
    this.state.collapseAnalysisPanels();
    const activeTab = this.state.currentTab;
    if (activeTab) {
      this.state.renameTab(activeTab.id, 'Guide Analysis');
      this.guideTabId = activeTab.id;
      this.guideTabCreated = true;
      this.cdr.detectChanges();
    }
  }

  private removeGuideTab() {
    this.closeWindowCheckPanel();
    this.state.collapseAnalysisPanels();
    if (this.guideTabId) {
      const exists = this.state.tabs.some(t => t.id === this.guideTabId);
      if (exists) {
        this.state.closeTab(this.guideTabId);
      }
      this.guideTabId = null;
      this.guideTabCreated = false;
    }
  }

  private closeWindowCheckPanel() {
    this.clickInternally('.btn-close-window-check');
    this.windowCheckOpened = false;
  }

  @HostListener('window:resize')
  onResize() {
    this.updateLayoutInstant();
  }

  @HostListener('window:input')
  onGuideInput() {
    if (['workspace-search', 'window-check'].includes(this.currentStep.id)) {
      this.later(() => { this.cdr.detectChanges(); this.updateLayoutInstant(); }, 100);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    // Enter/Space belong to the focused control, not to global guide navigation.
    if ((e.target as Element | null)?.closest('button, input, select, textarea, [contenteditable="true"]')) return;
    if (e.key === 'ArrowRight') {
      if (!this.currentStep.isFinal && this.isNextButtonEnabled) {
        this.nextStep();
      }
    } else if (e.key === 'ArrowLeft') {
      if (this.currentStepIndex > 0) {
        this.prevStep();
      }
    }
  }

  prevStep() {
    if (this.currentStepIndex > 0) {
      this.clearPendingActions();
      this.currentStepIndex--;
      this.handleStepSideEffects();
      this.onStepChanged();
    }
  }

  nextStep() {
    if (this.isLastStep) {
      this.closeGuide();
      return;
    }

    if (!this.isNextButtonEnabled) {
      return;
    }

    this.clearPendingActions();
    if (this.currentStep.id === 'window-check') this.closeWindowCheckPanel();
    this.currentStepIndex++;
    this.handleStepSideEffects();
    this.onStepChanged();
  }

  closeGuide() {
    this.clearPendingActions();
    this.closeWindowCheckPanel();
    this.state.collapseAnalysisPanels();
    this.removeGuideTab();
    this.restoreModuleExamples();
    this.restoreViewer();
    this.close.emit();
  }

  openResultsGuideComingSoon() {
    this.startResultsGuide();
  }

  /**
   * Converts markdown bolding syntax `**text**` to safe HTML strong tags.
   */
  formatMarkdown(text: string): SafeHtml {
    if (!text) return '';
    const formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return this.sanitizer.bypassSecurityTrustHtml(formatted);
  }

  /**
   * Handler when a user clicks one of the 4 cards on the Guide Hub.
   */
  selectGuideFromHub(cardTitle: string) {
    if (cardTitle.includes('CRISPR Analysis')) {
      this.startAnalysisGuide();
    } else if (cardTitle.includes('Result')) {
      this.startResultsGuide();
    } else if (cardTitle.includes('Sequence Viewer')) {
      this.startSequenceWorkspaceGuide();
    } else if (cardTitle.includes('Benchmark')) {
      this.startBenchmarkGuide();
    }
  }

  /**
   * Return back to the Guide Selection Hub from any guide.
   */
  returnToHub() {
    this.clearPendingActions();
    this.restoreModuleExamples();
    this.closeWindowCheckPanel();
    this.state.collapseAnalysisPanels();
    this.guideMode = 'hub';
    this.currentStepIndex = 0;
    this.targetRect = null;
    this.pathD = '';
    this.cardStyle = {};
    this.cdr.detectChanges();
    this.later(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.updateLayoutInstant();
    }, 120);
  }

  /**
   * Starts the CRISPR Analysis Tour.
   */
  startAnalysisGuide() {
    this.clearPendingActions();
    this.restoreModuleExamples();
    this.removeGuideTab();
    this.restoreViewer();
    this.demoFilesLoaded = false;
    this.demoTargetsLoaded = false;
    this.isAutofillOpen = false;
    this.guideMode = 'analysis';
    this.currentStepIndex = 0;
    this.requestTab.emit('analysis');
    this.state.collapseAnalysisPanels();
    this.cdr.detectChanges();
    this.later(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.handleStepSideEffects();
      this.updateLayoutInstant();
    }, 200);
  }

  /**
   * Switch Tutorial Guide to Results Guide mode and load synthetic Figure 2 dataset if needed.
   */
  startResultsGuide() {
    this.clearPendingActions();
    this.restoreModuleExamples();
    this.closeWindowCheckPanel();
    this.guideMode = 'result';
    this.currentStepIndex = 0;
    this.requestTab.emit('viewer');
    this.ensureFigure2SyntheticDataLoaded();
    this.cdr.detectChanges();
    this.later(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.handleStepSideEffects();
      this.updateLayoutInstant();
    }, 250);
  }

  /**
   * Starts the Sequence Workspace Tour.
   */
  startSequenceWorkspaceGuide() {
    this.clearPendingActions();
    this.restoreModuleExamples();
    this.restoreViewer();
    this.workspace?.beginGuideExample([]);
    this.guideMode = 'workspace';
    document.body?.classList.add('casmango-workspace-guide');
    this.currentStepIndex = 0;
    this.requestTab.emit('workspace');
    this.cdr.detectChanges();
    this.later(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.handleStepSideEffects();
      this.updateLayoutInstant();
    }, 250);
  }

  /**
   * Starts the Benchmark Tour.
   */
  startBenchmarkGuide() {
    this.clearPendingActions();
    this.restoreModuleExamples();
    this.restoreViewer();
    this.benchmarkUnavailable = !!this.state.benchIsLoading || !!document.querySelector('#guide-bench-normalize-run[data-guide-running="true"]');
    if (!this.benchmarkUnavailable) {
      this.savedBenchmark = Object.fromEntries(this.benchmarkKeys.map(k => [k, (this.state as any)[k]]));
      Object.assign(this.state, { guideBenchmarkActive: true, benchPlatform: 'nanopore', benchWindow: 90, benchPhred: 20,
        benchMargin: 10, benchDistanceWeight: 0, benchExclusionFlank: 0, benchCustomWindow: false,
        benchWindowLeft: 45, benchWindowRight: 45, benchRows: [], benchmarkResult: null, benchError: null });
    }
    this.guideImportError = this.benchmarkUnavailable ? 'A benchmark is already running. Exit this guide and let it finish before starting the example.' : '';
    this.guideMode = 'benchmark';
    this.currentStepIndex = 0;
    this.requestTab.emit('benchmark');
    this.cdr.detectChanges();
    this.later(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.handleStepSideEffects();
      this.updateLayoutInstant();
    }, 250);
  }

  /**
   * Loads realistic Figure 2 synthetic data for the single-target CPC locus.
   */
  private ensureFigure2SyntheticDataLoaded() {
    // Always tour a deterministic example in the visible Viewer, never a user's
    // analysis result. Keep the original Viewer object untouched for restoration.
    if (!this.savedViewer) {
      this.savedViewer = this.state.viewerSlot;
      this.savedCuration = { config: this.state.curationConfig, curated: this.state.isCuratedView,
        original: this.state.originalSlotSnapshot, exported: this.state.lastExportedFile };
      this.state.viewerSlot = structuredClone(this.state.viewerSlot);
    }
    this.curationTested = false; this.exportTested = false; this.viewerLoaded = false;
    this.viewerPrepared = false; this.restorePreview = undefined; this.reportArmed = false; this.guideImportError = '';
    this.excludedExample = false; this.restoredExample = false;
    this.state.lastExportedFile = null;
    this.state.guideReadActionsPreview = true;
    this.state.activateSlot('viewer');
    this.state.loadResultData(this.generateSyntheticFigure2Result());
  }

  private restoreViewer() {
    this.restorePreview = undefined; this.viewerPrepared = false; this.reportArmed = false; this.guideImportError = '';
    this.state.guideReadActionsPreview = false;
    if (!this.savedViewer) return;
    this.state.viewerSlot = this.savedViewer;
    this.savedViewer = undefined;
    if (this.savedCuration) {
      this.state.curationConfig = this.savedCuration.config;
      this.state.isCuratedView = this.savedCuration.curated;
      this.state.originalSlotSnapshot = this.savedCuration.original;
      this.state.lastExportedFile = this.savedCuration.exported;
      this.savedCuration = undefined;
    }
    this.state.resultsUpdated$.next();
  }

  private async exportGuideResult() {
    this.pendingAction = true;
    const revision = this.actionRevision;
    const originalExport = this.savedCuration?.exported ?? null;
    const mode = this.guideMode, step = this.currentStepIndex;
    try {
      const file = await (this.state.isCuratedView ? this.state.exportCuratedToExcel(false) : this.state.exportToExcel(false));
      if (this.destroyed || this.actionRevision !== revision || this.guideMode !== mode || this.currentStepIndex !== step) {
        if (this.state.lastExportedFile === file) this.state.lastExportedFile = originalExport;
        return;
      }
      this.exportTested = !!file;
    } finally {
      if (!this.destroyed && this.actionRevision === revision && this.guideMode === mode && this.currentStepIndex === step) {
        this.pendingAction = false; this.cdr.detectChanges(); this.updateLayoutInstant();
      }
    }
  }

  private async loadWorkspaceExample() {
    this.pendingAction = true;
    this.guideImportError = '';
    const revision = this.actionRevision;
    try {
      const doc = await parseFastqFile(workspaceExampleFile());
      if (this.destroyed || revision !== this.actionRevision || this.guideMode !== 'workspace') return;
      const example = workspaceExampleItems().find(item => item.type === 'fastq');
      if (example?.type === 'fastq') doc.alignmentPreset = example.autoAlign;
      await this.workspace?.saveItem(doc);
      if (this.destroyed || revision !== this.actionRevision || this.guideMode !== 'workspace') return;
      this.workspace?.selectItem(doc.id);
      window.dispatchEvent(new CustomEvent('casmango:guide-workspace-panel', { detail: { panel: 'viewer' } }));
      this.requestTab.emit('workspace');
    } catch {
      if (revision === this.actionRevision) this.guideImportError = 'Could not load the example FASTQ. Click IMPORT to retry.';
    } finally {
      if (revision === this.actionRevision) {
        this.pendingAction = false;
        this.cdr.detectChanges(); this.updateLayoutInstant();
      }
    }
  }

  dragGuideReport(event: DragEvent) {
    if (!this.state.lastExportedFile) { event.preventDefault(); return; }
    this.reportArmed = true;
    event.dataTransfer?.setData('application/x-casmango-guide-report', 'example');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }

  armGuideReport() {
    this.reportArmed = !!this.state.lastExportedFile;
  }

  /** Called only after the user drops/selects a report in the empty viewer. */
  private async importGuideResult(file: File | null = this.state.lastExportedFile) {
    if (!file) return;
    this.guideImportError = '';
    this.pendingAction = true;
    const revision = this.actionRevision;
    const step = this.currentStepIndex;
    try {
      const data = await this.excel.importFromExcel(file);
      if (this.destroyed || this.actionRevision !== revision || this.guideMode !== 'result' || this.currentStepIndex !== step) return;
      this.state.activateSlot('viewer');
      this.state.loadResultData(data);
      this.state.guideReadActionsPreview = true;
      this.viewerLoaded = true;
      this.requestTab.emit('viewer');
      this.later(() => { this.cdr.detectChanges(); this.updateLayoutInstant(); }, 50);
    } catch {
      if (this.actionRevision === revision) {
        this.viewerLoaded = false;
        this.guideImportError = 'The report could not be imported. Drop a valid CasMANGO .xlsx export and try again.';
      }
    } finally {
      if (!this.destroyed && this.actionRevision === revision && this.guideMode === 'result' && this.currentStepIndex === step) {
        this.pendingAction = false; this.cdr.detectChanges(); this.updateLayoutInstant();
      }
    }
  }

  /**
   * Generates synthetic Figure 2 single-target Cas9 outcome dataset (CPC amplicon).
   */
  private generateSyntheticFigure2Result(): { params: any; scopes: any[] } {
    const cpcAmplicon = 'AAATTTGAAATTCCTAAGCAATTTTTTCTTCTTATATATATAGATAATTATACATTCCAAAATAGTAATTCAAGGACAGGTACATTTCCTTTTTTTCTTGTCTTGTGAATTAAGGAGAGGAAAATTTTCTTTTAATCCAAACAAAAAAAATCATTTCCTAAAAAAGTCTCTTCGTCTGTTGGCAAAAACGACGCCGTGTTTCATAAGCCAATATCTCTCTATCTCCTCCGGCGTCCGTCCCGGGATCCTTCCGGCGATCAACTCCCACCTACGCGCCACGTAGGATAGGCTAACAGTCAGTGTTGAGGAACTTACACTTAACCAAATACCTTTTATTCCGATAAAAACCGCATAAAGTTTGTAATTCGGTTAAAATTCTATGGAACCGAACCAAAATCGTAATTTACACTTTGACTTCATACAAACATGCTGTAATCAAAATTGAACCAA';
    const grna = 'AATATCTCTCTATCTCCTC';
    
    // 90bp analyzed window centered around cut site 225 (window indices 180..270)
    // Cut site is at index 45 within this 90bp window (3bp upstream of PAM CGG at 48..51)
    const refWindow90 = 'GGCAAAAACGACGCCGTGTTTCATAAGCCAATATCTCTCTATCTCCTCCGGCGTCCGTCCCGGGATCCTTCCGGCGATCAACTCCCACCT';
    const grnaStartInWindow = 29;
    const cutPosInWindow = 45;

    const rawReads = 2500;
    const phredPassed = 2420;
    const usableForAssignment = 2350;
    const assignedReads = 2210;
    const ambiguousReads = 140;

    const topGroups = [
      {
        group_rank: 1,
        read_inner: 'WT_CPC_UNMODIFIED',
        read_count: 1094,
        read_pct: 49.5,
        classification: 'WT / No Indel',
        net_indel: 0,
        tokens: [
          { type: 'equal', val: refWindow90 }
        ]
      },
      {
        group_rank: 2,
        read_inner: 'DEL_1BP_OUT_OF_FRAME',
        read_count: 628,
        read_pct: 28.4,
        classification: 'Out-of-frame Deletion',
        net_indel: -1,
        tokens: [
          { type: 'equal', val: refWindow90.slice(0, 44) },
          { type: 'delete', val: refWindow90.slice(44, 45) },
          { type: 'equal', val: refWindow90.slice(45) }
        ]
      },
      {
        group_rank: 3,
        read_inner: 'INS_1BP_A_OUT_OF_FRAME',
        read_count: 283,
        read_pct: 12.8,
        classification: 'Out-of-frame Insertion',
        net_indel: 1,
        tokens: [
          { type: 'equal', val: refWindow90.slice(0, 45) },
          { type: 'insert', val: 'A' },
          { type: 'equal', val: refWindow90.slice(45) }
        ]
      },
      {
        group_rank: 4,
        read_inner: 'DEL_3BP_IN_FRAME',
        read_count: 150,
        read_pct: 6.8,
        classification: 'In-frame Deletion',
        net_indel: -3,
        tokens: [
          { type: 'equal', val: refWindow90.slice(0, 43) },
          { type: 'delete', val: refWindow90.slice(43, 46) },
          { type: 'equal', val: refWindow90.slice(46) }
        ]
      },
      {
        group_rank: 5,
        read_inner: 'SUB_1BP_T_TO_A',
        read_count: 55,
        read_pct: 2.5,
        classification: 'Substitution',
        net_indel: 0,
        tokens: [
          { type: 'equal', val: refWindow90.slice(0, 44) },
          { type: 'substitute', val: 'T' },
          { type: 'equal', val: refWindow90.slice(45) }
        ]
      }
    ];

    const targetResult = {
      target_id: 't1',
      summary: {
        total_reads: assignedReads,
        matched_reads: assignedReads,
        aligned_reads: assignedReads,
        unmodified: 1094,
        modified: 1061,
        editing_efficiency: 48.0,
        out_of_frame_pct: 41.2,
        in_frame_pct: 6.8,
        no_indel_pct: 52.0,
        substitution_pct: 2.5,
        substitution_reads: 55,
        indel_editing_efficiency: 48.0,
        substitution_policy: 'separate_category_indel_editing_excludes_substitutions',
        failed_reads: 0
      },
      breakdown: {
        no_indel: 1094,
        substitution: 55,
        in_frame: 150,
        out_of_frame: 911,
        failed: 0
      },
      read_details: [],
      ref_sequence: refWindow90,
      cut_site_index: cutPosInWindow,
      sgrna_seq: grna,
      display_sgrna_seq: grna,
      grna_start_index: grnaStartInWindow,
      strand: '+',
      top_groups: topGroups
    };

    const geneResult = {
      gene: 'CPC',
      reference_sequence: cpcAmplicon,
      assigned_read_count: assignedReads,
      ambiguous_excluded: true,
      analysis_result: {
        targets: [targetResult]
      }
    };

    const scopes = [
      {
        sheetName: 'Merged',
        readFlow: {
          rawReads,
          phredPassed,
          anchorMatched: usableForAssignment,
          usableForAssignment,
          assignedReads,
          ambiguousReads
        },
        genes: [geneResult]
      },
      {
        sheetName: 'cpc_sample.fastq.gz',
        readFlow: {
          rawReads,
          phredPassed,
          anchorMatched: usableForAssignment,
          usableForAssignment,
          assignedReads,
          ambiguousReads
        },
        genes: [geneResult]
      }
    ];

    const params = {
      windowSize: 90,
      phredThreshold: 20,
      indelThreshold: 30,
      assignmentMargin: 10,
      rescueThreshold: 0,
      cutSiteDistanceWeight: 0,
      cutSiteExclusionFlank: 0,
      analyzeAmbiguous: false,
      rescueAmbiguous: false,
      dataType: 'Single-Target CPC Amplicon (Figure 2)',
      fileCount: 1,
      sequencingPlatform: 'nanopore', homoeologMode: true
    };

    return addTryExample({ params, scopes });
  }

  /**
   * Automatically expand panels or prepare UI states required for each step.
   */
  private handleStepSideEffects() {
    const step = this.currentStep;
    if (step.id === 'result-homeo-open') {
      this.clickInternally('#guide-merged-results');
    }
    if (step.id === 'result-homeo-select') {
      if (!document.querySelector('#guide-open-homeo[aria-pressed="true"]')) this.clickInternally('#guide-open-homeo');
      this.clickInternally('#guide-homeo-select-all');
    }
    if (step.id === 'result-export-report') {
      if (document.querySelector('#guide-figure-btn[aria-pressed="true"]')) this.clickInternally('#guide-figure-btn');
      if (document.querySelector('#guide-open-homeo[aria-pressed="true"]')) this.clickInternally('#guide-open-homeo');
    }
    if (['result-homeo-open', 'result-homeo-select', 'result-figure-homeo', 'result-figure-both'].includes(step.id)) {
      this.later(() => this.revealResultTarget(), 100);
    }
    if (step.id === 'result-viewer-reproduce' && !this.viewerPrepared) {
      this.restorePreview = { slot: this.state.viewerSlot, config: this.state.curationConfig,
        curated: this.state.isCuratedView, original: this.state.originalSlotSnapshot };
      this.state.newViewer();
      this.viewerLoaded = false; this.reportArmed = false; this.guideImportError = ''; this.viewerPrepared = true;
      this.requestTab.emit('viewer');
    } else if (this.guideMode === 'result' && !step.isFinal && step.id !== 'result-viewer-reproduce' && this.restorePreview) {
      this.state.viewerSlot = this.restorePreview.slot;
      this.state.curationConfig = this.restorePreview.config;
      this.state.isCuratedView = this.restorePreview.curated;
      this.state.originalSlotSnapshot = this.restorePreview.original;
      this.restorePreview = undefined; this.viewerPrepared = false; this.viewerLoaded = false;
      this.guideImportError = ''; this.state.resultsUpdated$.next();
    }
    if (this.guideMode === 'workspace') {
      if (step.id === 'workspace-search') this.later(() => window.dispatchEvent(new CustomEvent('casmango:guide-search-preset')), 50);
      const panel = step.id === 'workspace-reads' && !this.isCurrentActionCompleted ? 'files' : 'viewer';
      if (step.id === 'workspace-align') this.later(() => {
        if (!document.querySelector('#guide-workspace-align-config')) this.clickInternally('#guide-workspace-align-toggle');
      }, 80);
      this.later(() => window.dispatchEvent(new CustomEvent('casmango:guide-workspace-panel', { detail: { panel } })), 50);
    }
    if (this.guideMode === 'benchmark' && ['benchmark-params', 'benchmark-dataset', 'benchmark-run', 'benchmark-results'].includes(step.id)) {
      this.clickInternally('#guide-bench-classification-btn');
    }

    // Step: Auto Fill - ensure Auto Fill panel is opened
    if (step.id === 'autofill-panel') {
      const autofillPanel = document.querySelector('#guide-autofill-panel');
      if (!autofillPanel) {
        const autofillBtn = document.querySelector('#guide-autofill-btn') as HTMLElement;
        if (autofillBtn) this.clickInternally('#guide-autofill-btn');
      }
      this.isAutofillOpen = true;
    }

    // Step: Advanced Parameters - ensure Advanced panel is expanded
    if (step.id === 'advanced-parameters') {
      const advPanel = document.querySelector('#guide-advanced-panel');
      if (!advPanel) {
        const advBtn = document.querySelector('#guide-advanced-btn') as HTMLElement;
        if (advBtn) this.clickInternally('#guide-advanced-btn');
      }
    }
  }

  private restoreModuleExamples() {
    document.body?.classList.remove('casmango-workspace-guide');
    this.workspace?.endGuideExample();
    if (this.savedBenchmark) {
      if (this.state.benchIsLoading || document.querySelector('#guide-bench-normalize-run[data-guide-running="true"]')) this.state.cancelBenchmark();
      Object.assign(this.state, this.savedBenchmark);
      this.savedBenchmark = undefined;
      this.state.guideBenchmarkActive = false;
    }
    this.benchmarkUnavailable = false;
  }

  /**
   * Interactive Demo Action: Load synthetic FASTQ files (cpc, try, pooled).
   */
  loadDemoFiles() {
    const cpcRead = "@cpc_sample_1\nAAATTTGAAATTCCTAAGCAATTTTTTCTTCTTATATATATAGATAATTATACATTCCAAAATAGTAATTCAAGGACAGGTACATTTCCTTTTTTTCTTGTCTTGTGAATTAAGGAGAGGAAAATTTTCTTTTAATCCAAACAAAAAAAATCATTTCCTAAAAAAGTCTCTTCGTCTGTTGGCAAAAACGACGCCGTGTTTCATAAGCCAATATCTCTCTATCTCCTCCGGCGTCCGTCCCGGGATCCTTCCGGCGATCAACTCCCACCTACGCGCCACGTAGGATAGGCTAACAGTCAGTGTTGAGGAACTTACACTTAACCAAATACCTTTTATTCCGATAAAAACCGCATAAAGTTTGTAATTCGGTTAAAATTCTATGGAACCGAACCAAAATCGTAATTTACACTTTGACTTCATACAAACATGCTGTAATCAAAATTGAACCAA\n+\nBEEECACEBEFGDEC@CEGDEFDDBDBDEEEEDEAEEDFEEE?FDEDFEFDEGCFCFDGECEFEDHECEEEED@EEGGBDFGCFCCDAGEFDCBCDFABDECCECGGF@FCCAEAEFDDBDEDFCDECF@BFCCFADEFEBCCDEE?BDDBDDGDFCCEDDDFCCGCFFADCGDE?ADFEBBCBECGFGEDCEACEFFFCCFHEECDCDFEIBBCEEFDFEEEDDCEGEGDCEEF@CC@@CDCEBF?HECBDBEDCAECIEEFDABDEG@DBBEE?FCEEBFDAHHDHEBFFEGDD>CCCCGEGDCHEGDEGEDBGEBDEFBFDACCIEAADBCCDGGFCCBGBFDFEFDAGEFDDD@EAFECCBHEFGFBDHDFDCGDDBFDCICBBCFGBCGDGADGDFFAEECBFEHC=AFFDEFDFBCGBEEBGCDIE@FDFCD?FDCGGDFDEFE\n";
    const tryRead = "@try_sample_1\nGTCTACACAAAGGGTAAGAGGTCAACAAGACCACACAACACTTCTTACTATTAGTTTTGCAAAGGCCGTTCGTTGGACATTTCCTTCTCTCTCCTCCCCTCTTCTTCTTCTTGTTCGCTCTATAAACTCTCATCTCTCACGTCTTTTTTTCCTTACATTCTCCAAACTCAAAATTTCATCACATTAATTTCTCTCTATTTTTCTTTTCTTACTTCAATAGTAATGGATAACACTGACCGTCGTCGCCGTCGTAAGCAACACAAAATCGCCCTCCATGACTCTGAAGAAGTGAGCAGTATCGAATGGGAGTTTATCAACATGACTGAACAAGAAGAAGATCTCATCTTTCGAATGTACAGACTTGTCGGTGATAGGTGGGATTTGATAGCAGGAAGAGTTCCTGGAAGACAACCAGAGGAGATAGAGAGATATTGGATAATGAG\n+\nIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII\n";
    const pooledRead = cpcRead + tryRead;

    const file1 = new File([cpcRead], 'cpc_sample.fastq.gz', { type: 'application/gzip', lastModified: Date.now() });
    const file2 = new File([tryRead], 'try_sample.fastq.gz', { type: 'application/gzip', lastModified: Date.now() });
    const file3 = new File([pooledRead], 'cpc_try_pooled.fastq.gz', { type: 'application/gzip', lastModified: Date.now() });

    if (this.state.analysisForm.get('sequencingPlatform')?.value === 'illumina') {
      const r1 = new File([cpcRead], 'cpc_sample_R1.fastq.gz', { type: 'application/gzip', lastModified: Date.now() });
      const r2 = new File([cpcRead], 'cpc_sample_R2.fastq.gz', { type: 'application/gzip', lastModified: Date.now() });
      this.state.illuminaPairs = [
        { id: 'cpc_sample', name: 'cpc_sample', r1, r2 }
      ];
    } else {
      this.state.selectedFiles = [file1, file2, file3];
    }
    this.demoFilesLoaded = true;
    this.cdr.detectChanges();
    this.later(() => {
      this.updateLayoutInstant();
    }, 120);
  }

  /**
   * Interactive Demo Action: Auto-fill actual synthetic CPC and TRY reference amplicons & gRNAs.
   */
  loadDemoTargets() {
    const cpcSeq = 'gctactattaatccttcccctcgtgaggaaatcatttcttcttgtttctcgagatttattctctttctctctctctttctctgtgtgtttcgtgtcttcagattagttcgATGTTTCGTTCAGACAAGGCGGAAAAAATGGATAAACGACGACGGAGACAGAGCAAAGCCAAGGCTTCTTGTTCCGAAGgtctgatttctctttgtttctctctatatctttttgatcggtttgagtctgattttgtatgtttgtttcgcagAGGTGAGTAGTATCGAATGGGAAGCTGTGAAGATGTCAGAAGAAGAAGAAGATCTCATTTCTCGGATGTATAAACTCGTTGGCGACAGgttagagactctttctctctcgatccatcttgttgctttctcttttttttggtctttcatgttttgtcgaatctgcttagattttgatctcaaagtcggtcgtttatttatgcattttcttggtttttctattatattattgggtctaacttaccgagctgtcaatgactgtgttcagcctgatttttgatcttgttattattctctgttttttgttttagttgttcaaatagcaaaacctaatcaagatttcgttttcagtttctttttttatatatgattctttagcaaaacatattcttaatttatgtcagaactcactttggctagtttggttcaattttgattacagcatgtttgtatgaagtcaaagtgtaaattacgattttggttcggttccatagaattttaaccgaattacaaactttatgcggtttttatcggaataaaaggtatttggttaagtgtaagttcctcaacactgactgttagcctatcctacgtggcgcgtagGTGGGAGTTGATCGCCGGAAGGATCCCGGGACGGACGCCGGAGGAGATAGAGAGATATTGGCTTATGAAACACGGCGTCGTTTTTGCCAACAGACGAAGAGACTTTTTTAGGAAATGAttttttttgtttggattaaaagaaaattttcctctccttaattcacaagacaagaaaaaaaggaaatgtacctgtccttgaattactattttggaatgtataattatctatatatataagaagaaaaaattgcttaggaatttcaaatttttaccagcctccatcgacacatgatatatc';
    const trySeq = 'gtctacacaaagggtaagaggtcaacaagaccacacaacacttcttactattagttttgcaaaggccgttcgttggacatttccttctctctcctcccctcttcttcttcttgttcgctctataaactctcatctctcacgtctttttttccttacattctccaaactcaaaatttcatcacattaatttctctctatttttcttttcttacttcaatagtaATGGATAACACTGACCGTCGTCGCCGTCGTAAGCAACACAAAATCGCCCTCCATGACTCTGAAGgtacctctctattctctatatattttctatttcctaaatccaattttattaaacatcttgaaaataaatttagttcctagctaggatcatattctctttgtatatattcgttaaaacgagggatacgtttaattacttctaaattagttacacctcgtgctgactaaaagacttatcaagattagtttctagttttaacaaaaattaatatctttttaaaaagtttatatttgtctttttttgttagtttaatattgttttgagtttaattggtttaatattgttatttgcagAAGTGAGCAGTATCGAATGGGAGTTTATCAACATGACTGAACAAGAAGAAGATCTCATCTTTCGAATGTACAGACTTGTCGGTGATAGgtaacaatttcttcttcttctactttttctaagattatcccagcataaaataaattttatattttagacatgtctagctaaaacaatttaatatgcaggtatatacaattttacatacgttaatttaagcatatgtactttataacatatgtacagtgtaccatgttgtaggggaagcacatggtgtccactaattttctaaaaaaagacatttaattaaagctatcacgttcattaaattatatatgtacacacatatatatagagataaaaataagaacctaatttactattcttatcagtacgtactcatgtatataaatgcttggctggctcaaaaatggaaatttttgaactgacaaattatattttattatgaaaatataaatgctaatgcttgggataaaaatgtttttttttttcttttgaattagGTGGGATTTGATAGCAGGAAGAGTTCCTGGAAGACAACCAGAGGAGATAGAGAGATATTGGATAATGAGAAACAGTGAAGGCTTTGCTGATAAACGACGCCAGCTTCACTCATCTTCCCACAAACATACCAAGCCTCACCGTCCTCGCTTTTCTATCTATCCTTCCTAGtgtttttgtttttaagccaacgaaaaaagaaaataaaaaaattataatagatgtatagtagtggttcttgttagtttgaagaattcatcatctattgttttctttttgttgttatttcatttataatttttatagtataggtttcatttggtaatcaactttaatccatgc';
    const grna = 'AATATCTCTCTATCTCCTC';

    // Clear existing genes
    while (this.state.geneBlocks.length > 0) {
      this.state.geneBlocks.removeAt(0);
    }

    // Add Gene 1: CPC
    this.state.addGene('CPC');
    const gene0 = this.state.geneBlocks.at(0);
    gene0.get('gene_name')?.setValue('CPC');
    gene0.get('gene_reference')?.setValue(cpcSeq);
    const targets0 = gene0.get('geneTargets') as FormArray;
    if (targets0 && targets0.length > 0) {
      targets0.at(0).get('target_id')?.setValue('t1');
      targets0.at(0).get('gRNA')?.setValue(grna);
    }

    // Add Gene 2: TRY
    this.state.addGene('TRY');
    const gene1 = this.state.geneBlocks.at(1);
    gene1.get('gene_name')?.setValue('TRY');
    gene1.get('gene_reference')?.setValue(trySeq);
    const targets1 = gene1.get('geneTargets') as FormArray;
    if (targets1 && targets1.length > 0) {
      targets1.at(0).get('target_id')?.setValue('t1');
      targets1.at(0).get('gRNA')?.setValue(grna);
    }

    this.demoTargetsLoaded = true;
    this.cdr.detectChanges();
    this.later(() => {
      this.updateLayoutInstant();
    }, 120);
  }

  /**
   * Smoothly scroll target into view if needed, and place guide dialog.
   */
  private revealResultTarget() {
    const el = document.querySelector(this.currentStepTargetSelector || '') as HTMLElement | null;
    if (!el) return;
    const pane = el.closest('.workspace-pane') as HTMLElement | null;
    const track = pane?.parentElement;
    if (pane && track) {
      const panes = Array.from(track.children).filter((p: any) => !p.hidden) as HTMLElement[];
      const visible = pane.clientWidth < track.clientWidth * .75 ? 2 : 1;
      const index = Math.min(panes.indexOf(pane), Math.max(0, panes.length - visible));
      track.scrollTo({ left: panes[index].offsetLeft - panes[0].offsetLeft, top: 0, behavior: 'auto' });
      const body = el.closest('.workspace-pane-body, .figure-editor-scroll') as HTMLElement | null;
      if (body && body !== el) {
        const bounds = body.getBoundingClientRect(), target = el.getBoundingClientRect();
        body.scrollTop += target.top - bounds.top - Math.max(0, (bounds.height - target.height) / 2);
      }
    }
    const dialog = document.querySelector('.guide-dialog-wrapper') as HTMLElement | null;
    if (dialog) dialog.scrollTop = 0;
    this.updateLayoutInstant();
  }

  private onStepChanged() {
    this.cdr.detectChanges();

    const sel = this.currentStepTargetSelector;
    if (sel) {
      const el = document.querySelector(sel) as HTMLElement;
      if (el) {
        if (this.guideMode === 'result') {
          this.revealResultTarget();
          this.updateLayoutInstant();
          this.later(() => this.updateLayoutInstant(), 320);
          return;
        }
        const dialogEl = document.querySelector('.guide-dialog-wrapper') as HTMLElement;
        const dialogHeight = dialogEl ? dialogEl.offsetHeight : 280;
        const rect = el.getBoundingClientRect();
        const absoluteTop = window.scrollY + rect.top;
        const vh = window.innerHeight;

        const preferAbove = (rect.bottom > vh * 0.55 || el.offsetHeight > 220);
        if (preferAbove) {
          const desiredScroll = Math.max(0, absoluteTop - (dialogHeight + 50));
          window.scrollTo({ top: desiredScroll, behavior: 'smooth' });
        } else {
          const desiredScroll = Math.max(0, absoluteTop - 80);
          window.scrollTo({ top: desiredScroll, behavior: 'smooth' });
        }
      }
    }

    // Update layout once immediately
    this.updateLayoutInstant();

    // Re-verify once after smooth scroll settles
    this.later(() => {
      this.updateLayoutInstant();
    }, 320);
  }

  /**
   * Calculate document-absolute coordinates so the guide stays anchored to the page
   * without continuously following the viewport when the user scrolls.
   */
  private updateLayoutInstant() {
    const sel = this.currentStepTargetSelector;
    if (!sel) {
      this.targetObserver?.disconnect();
      this.observedTarget = undefined;
      this.targetRect = null;
      this.pathD = '';
      this.cardStyle = {};
      this.cdr.detectChanges();
      return;
    }

    const el = document.querySelector(sel) as HTMLElement;
    if (!el) {
      this.targetRect = null;
      this.pathD = '';
      this.cardStyle = {};
      this.cdr.detectChanges();
      return;
    }

    // Window Check grows after its worker finishes; curation and reference
    // switches also change panel height. Measure the final DOM, not a timeout snapshot.
    if (typeof ResizeObserver !== 'undefined' && this.observedTarget !== el) {
      this.targetObserver?.disconnect();
      this.observedTarget = el;
      this.targetObserver = new ResizeObserver(() => {
        if (this.destroyed || this.rafId !== null) return;
        this.rafId = requestAnimationFrame(() => {
          this.rafId = null;
          if (!this.destroyed) this.updateLayoutInstant();
        });
      });
      this.targetObserver.observe(el, { box: 'border-box' });
    }

    const clientRect = el.getBoundingClientRect();
    let visibleTop = clientRect.top, visibleBottom = clientRect.bottom;
    let visibleLeft = clientRect.left, visibleRight = clientRect.right;
    for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const bounds = parent.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { visibleTop = Math.max(visibleTop, bounds.top); visibleBottom = Math.min(visibleBottom, bounds.bottom); }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { visibleLeft = Math.max(visibleLeft, bounds.left); visibleRight = Math.min(visibleRight, bounds.right); }
    }
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const scrollX = window.scrollX || window.pageXOffset || 0;

    // Convert target rect to document-absolute coordinates
    const docTop = visibleTop + scrollY;
    const docLeft = visibleLeft + scrollX;
    const rect = {
      top: docTop,
      left: docLeft,
      width: Math.max(0, visibleRight - visibleLeft),
      height: Math.max(0, visibleBottom - visibleTop),
      bottom: Math.max(docTop, visibleBottom + scrollY),
      right: Math.max(docLeft, visibleRight + scrollX)
    };
    this.targetRect = rect;

    const dialogEl = document.querySelector('.guide-dialog-wrapper') as HTMLElement;
    const dialogHeight = dialogEl ? dialogEl.offsetHeight : 280;
    const docWidth = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    let cardWidth = Math.min(800, Math.max(0, docWidth - 32));
    const gap = 24;

    let cTop = 0;
    let cLeft = rect.left + (rect.width - cardWidth) / 2;

    let sX = rect.left + rect.width / 2;
    let sY = 0;
    let eX = 0;
    let eY = 0;

    // Use viewport-relative position at the moment of calculation to decide above vs below
    const spaceBelow = vh - clientRect.bottom;
    const spaceAbove = clientRect.top;
    const preferAbove = (clientRect.bottom > vh * 0.55 || clientRect.height > 220);

    // Anchor large-panel explanations above the panel in document coordinates.
    // Otherwise scrolling to a group can flip the bubble below it mid-click.
    if (preferAbove && rect.top >= dialogHeight + gap + 72) {
      cTop = rect.top - dialogHeight - gap;
      sY = rect.top - 6;
      eY = cTop + dialogHeight;
    } else if (spaceBelow >= dialogHeight + gap) {
      cTop = rect.bottom + gap;
      sY = rect.bottom + 6;
      eY = cTop;
    } else if (spaceAbove >= dialogHeight + gap) {
      cTop = rect.top - dialogHeight - gap;
      sY = rect.top - 6;
      eY = cTop + dialogHeight;
    } else {
      if (spaceBelow >= spaceAbove) {
        cTop = rect.bottom + gap;
        sY = rect.bottom + 6;
        eY = cTop;
      } else {
        cTop = Math.max(10, rect.top - dialogHeight - gap);
        sY = rect.top - 6;
        eY = cTop + dialogHeight;
      }
    }

    if (this.guideMode === 'result') {
      // Bubble follows nested card scrolling and stays immediately beside the focus.
      const topRoom = visibleTop - 72, bottomRoom = vh - visibleBottom - 12;
      cTop = topRoom >= dialogHeight + 12
        ? visibleTop + scrollY - dialogHeight - 12
        : bottomRoom >= dialogHeight + 12 ? visibleBottom + scrollY + 12
        : scrollY + Math.max(72, Math.min(vh - dialogHeight - 12, visibleTop - dialogHeight - 12));
      sY = topRoom >= dialogHeight + 12 ? rect.top : rect.bottom;
      eY = topRoom >= dialogHeight + 12 ? cTop + dialogHeight : cTop;
    }

    if (this.isOptionalExploration && el.matches('.workspace-pane')) {
      const leftRoom = clientRect.left - 32;
      const rightRoom = docWidth - clientRect.right - 32;
      if (Math.max(leftRoom, rightRoom) >= 300) {
        cardWidth = Math.min(640, Math.max(leftRoom, rightRoom));
        cLeft = leftRoom >= rightRoom ? 16 : clientRect.right + 16;
        cTop = scrollY + Math.max(72, Math.min(vh - dialogHeight - 16, clientRect.top + 24));
      }
    }
    // Clamp horizontally to page bounds
    cLeft = Math.max(16, Math.min(docWidth - cardWidth - 16, cLeft));
    eX = Math.max(cLeft + 60, Math.min(cLeft + cardWidth - 60, sX));

    this.cardStyle = {
      top: `${Math.round(cTop)}px`,
      left: `${Math.round(cLeft)}px`,
      width: `${Math.round(cardWidth)}px`
    };

    this.arrowStartX = Math.round(sX);
    this.arrowStartY = Math.round(sY);
    this.arrowEndX = Math.round(eX);
    this.arrowEndY = Math.round(eY);

    const dy = this.arrowEndY - this.arrowStartY;
    const cp1X = this.arrowStartX;
    const cp1Y = Math.round(this.arrowStartY + dy * 0.55);
    const cp2X = this.arrowEndX;
    const cp2Y = Math.round(this.arrowEndY - dy * 0.15);

    this.pathD = `M ${this.arrowStartX} ${this.arrowStartY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${this.arrowEndX} ${this.arrowEndY}`;

    this.cdr.detectChanges();
  }
}
