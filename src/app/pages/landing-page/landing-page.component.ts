import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="landing" aria-labelledby="landing-title">
      <header class="identity">
        <h1 id="landing-title">Cas<span>MANGO</span></h1>
        <p class="full-name">CRISPR Amplicon Sequencing with Multiplexed Assignment of NGS reads for Genotyping and Outcome analysis</p>
      </header>
      <div class="tools">
        <button type="button" *ngFor="let tool of tools" [class.primary]="tool.tab === 'analysis'" (click)="openTool.emit(tool.tab)">
          <svg class="tool-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path *ngFor="let path of tool.paths" [attr.d]="path" />
          </svg>
          <span class="tool-name">{{ tool.name }}</span>
          <svg class="arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
        </button>
      </div>
    </section>
  `,
  styles: [`
    :host { display: flex; flex: 1; }
    .landing { width: 100%; max-width: 1040px; margin: auto; padding: 64px 48px 96px; color: #252d31; box-sizing: border-box; }
    .identity { display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 64px; padding-bottom: 50px; border-bottom: 1px solid #d9ddda; }
    h1 { margin: 0; white-space: nowrap; font-size: clamp(45px, 5.2vw, 64px); line-height: 1.1; letter-spacing: -.055em; font-weight: 350; }
    h1 span { font-weight: 600; }
    .full-name { margin: 0; font-size: 17px; line-height: 1.8; font-weight: 400; color: #747b7c; text-wrap: pretty; }
    .tools { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 64px; padding-top: 17px; }
    button { display: flex; align-items: center; gap: 22px; width: 100%; min-width: 0; min-height: 108px; padding: 28px 0; border: 0; border-bottom: 1px solid #e1e4e0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
    .tool-icon { width: 30px; height: 30px; flex-shrink: 0; color: #7b8983; stroke: currentColor; stroke-width: 1.35; stroke-linecap: round; stroke-linejoin: round; transition: color .18s; }
    .tool-name { font-size: 18px; font-weight: 500; letter-spacing: -.025em; }
    .arrow { width: 22px; height: 22px; margin-left: auto; flex-shrink: 0; color: #9ca6a0; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; transition: transform .18s, color .18s; }
    button.primary .tool-icon { color: #b48a39; }
    button:hover .tool-name { color: #8b682b; }
    button:hover .tool-icon, button:hover .arrow { color: #a6803b; }
    button:hover .arrow { transform: translateX(4px); }
    button:focus-visible { outline: 2px solid #b48a39; outline-offset: 5px; border-radius: 2px; }
    @media(max-width: 760px) {
      .landing { padding: 48px 28px 60px; }
      .identity { grid-template-columns: 1fr; gap: 22px; padding-bottom: 34px; }
      h1 { font-size: 54px; }
      .full-name { max-width: 490px; font-size: 16px; }
      .tools { column-gap: 28px; padding-top: 8px; }
      button { gap: 14px; min-height: 92px; padding: 23px 0; }
      .tool-name { font-size: 15px; }
      .tool-icon { width: 25px; height: 25px; }
      .arrow { width: 18px; height: 18px; }
    }
    @media(max-width: 480px) {
      .landing { padding: 42px 24px 48px; }
      h1 { font-size: 48px; }
      .tools { grid-template-columns: 1fr; }
      button { min-height: 79px; }
      .tool-name { font-size: 17px; }
    }
    @media(prefers-reduced-motion: reduce) { .arrow, .tool-icon { transition: none; } }
  `],
})
export class LandingPageComponent {
  @Output() openTool = new EventEmitter<'analysis' | 'viewer' | 'workspace' | 'benchmark'>();
  readonly tools: ReadonlyArray<{ tab: 'analysis' | 'viewer' | 'workspace' | 'benchmark'; name: string; paths: readonly string[] }> = [
    { tab: 'analysis', name: 'CRISPR Analysis', paths: ['M10 4c0 10 12 14 12 24M22 4c0 10-12 14-12 24', 'M11 7h10M12 12h8M12 20h8M11 25h10'] },
    { tab: 'viewer', name: 'Result Viewer', paths: ['M5 5v22h23', 'M11 21v-6m6 6V9m6 12V5'] },
    { tab: 'benchmark', name: 'Benchmark', paths: ['M5 9h9m6 0h7M5 23h3m6 0h13', 'M14 5v8h6V5h-6ZM8 19v8h6v-8H8Z'] },
    { tab: 'workspace', name: 'Sequence Viewer', paths: ['M4 8h5m5 0h3m5 0h6M4 16h3m5 0h8m5 0h3M4 24h7m5 0h3m5 0h4'] },
  ];
}
