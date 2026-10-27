import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="landing" aria-labelledby="landing-title">
      <div class="landing-hero">
        <div class="hero-copy">
          <h1 id="landing-title">Cas<span>MANGO</span></h1>
          <p class="full-name">CRISPR Amplicon Sequencing with Multiplexed Assignment of NGS reads for Genotyping and Outcome analysis</p>
        </div>
        <img class="hero-mascot" src="guide-mascots/wave.png" alt="CasMango scientist mascot" />
      </div>
      <div class="tool-buttons">
        <button type="button" *ngFor="let tool of tools" [class.primary]="tool.tab === 'analysis'" (click)="openTool.emit(tool.tab)">
          <span>{{ tool.name }}</span><span class="arrow" aria-hidden="true">↗</span>
        </button>
      </div>
    </section>
  `,
  styles: [`
    :host { display: flex; flex: 1; }
    .landing { width: 100%; max-width: 1120px; margin: auto; padding: 70px 40px 95px; box-sizing: border-box; color: #202b3d; }
    .landing-hero { display: grid; grid-template-columns: minmax(0, 1fr) 210px; gap: 70px; align-items: center; padding-bottom: 65px; }
    h1 { margin: 0 0 24px; font-size: clamp(54px, 6vw, 78px); line-height: 1.1; letter-spacing: -.045em; font-weight: 650; }
    h1 span { color: #ed9b09; }
    .full-name { max-width: 680px; margin: 0; font-size: clamp(19px, 2.2vw, 25px); line-height: 1.65; color: #637080; letter-spacing: -.015em; }
    .hero-mascot { display: block; width: 100%; height: 205px; object-fit: contain; }
    .tool-buttons { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    button { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 23px 20px; border: 1px solid #dfe3e7; border-radius: 10px; background: #fff; color: #344154; font: inherit; font-size: 15px; font-weight: 600; text-align: left; cursor: pointer; transition: border-color .15s, background .15s; }
    button:hover { border-color: #e3ac45; background: #fffaf0; }
    button.primary { background: #fff7e6; border-color: #efc375; color: #9b6410; }
    button.primary:hover { background: #ffedc6; border-color: #e3ac45; }
    .arrow { color: #9b8c70; font-size: 18px; }
    button:focus-visible { outline: 2px solid #e79b0e; outline-offset: 4px; }
    @media(max-width: 900px) {
      .landing-hero { grid-template-columns: minmax(0, 1fr) 150px; gap: 30px; }
      .hero-mascot { height: 160px; }
      .tool-buttons { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media(max-width: 600px) {
      .landing { padding: 45px 24px; }
      .landing-hero { grid-template-columns: minmax(0, 1fr) 85px; gap: 16px; padding-bottom: 38px; }
      .hero-mascot { height: 100px; }
      h1 { font-size: 46px; margin-bottom: 18px; }
      .full-name { font-size: 17px; }
      button { font-size: 13px; padding: 20px 14px; gap: 8px; }
    }
    @media(max-width: 420px) {
      .landing-hero { grid-template-columns: 1fr; }
      .hero-mascot { display: none; }
    }
  `],
})
export class LandingPageComponent {
  @Output() openTool = new EventEmitter<'analysis' | 'viewer' | 'workspace' | 'benchmark'>();
  readonly tools = [
    { tab: 'analysis', name: 'CRISPR Analysis' },
    { tab: 'viewer', name: 'Result Viewer' },
    { tab: 'benchmark', name: 'Benchmark' },
    { tab: 'workspace', name: 'Sequence Viewer' },
  ] as const;
}
