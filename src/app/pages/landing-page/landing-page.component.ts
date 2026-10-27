import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-landing-page', standalone: true, imports: [CommonModule],
  template: `
    <section class="landing" aria-labelledby="landing-title">
      <div class="landing-hero">
        <div class="hero-copy">
          <h1 id="landing-title"><span class="cas">Cas</span><span class="mango">MANGO</span></h1>
          <p class="full-name">
            <span class="phrase"><strong>C</strong>RISPR <strong>A</strong>mplicon <strong>S</strong>equencing</span>
            <span class="phrase">with <strong>M</strong>ultiplexed <strong>A</strong>ssignment of <strong>N</strong>GS reads</span>
            <span class="phrase">for <strong>G</strong>enotyping and <strong>O</strong>utcome analysis</span>
          </p>
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
    .landing { width: 100%; max-width: 1120px; margin: auto; padding: 64px 40px 90px; box-sizing: border-box; color: #202b3d; }
    .landing-hero { display: grid; grid-template-columns: minmax(0, 1fr) 190px; gap: 64px; align-items: center; padding-bottom: 56px; }
    h1 { margin: 0 0 25px; font-size: clamp(52px, 6vw, 72px); line-height: 1.1; letter-spacing: -.045em; font-weight: 600; }
    .cas { color: #445e57; }
    .mango { color: #eaa125; }
    .full-name { margin: 0; font-size: clamp(17px, 1.9vw, 21px); line-height: 1.9; color: #748079; letter-spacing: -.01em; }
    .phrase { display: block; }
    strong { color: #a46b16; font-weight: 750; }
    .phrase:first-child strong { color: #445e57; }
    .hero-mascot { display: block; width: 100%; height: 180px; object-fit: contain; }
    .tool-buttons { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    button { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 22px 20px; border: 1px solid #e2e7e2; border-radius: 10px; background: #fff; color: #40534d; font: inherit; font-size: 15px; font-weight: 600; text-align: left; cursor: pointer; transition: border-color .15s, background .15s; }
    button:hover { border-color: #d4b06c; background: #fffaf0; }
    button.primary { background: #fff6e4; border-color: #edc57e; color: #9b6410; }
    button.primary:hover { background: #ffedc6; }
    .arrow { color: #a89879; font-size: 18px; }
    button:focus-visible { outline: 2px solid #b48a39; outline-offset: 4px; }
    @media(max-width: 900px) {
      .landing-hero { grid-template-columns: minmax(0, 1fr) 130px; gap: 28px; }
      .hero-mascot { height: 140px; }
      .tool-buttons { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media(max-width: 600px) {
      .landing { padding: 42px 24px; }
      .landing-hero { grid-template-columns: 1fr; padding-bottom: 32px; }
      h1 { font-size: 48px; }
      .full-name { font-size: 16px; }
      .hero-mascot { display: none; }
      button { font-size: 13px; padding: 20px 14px; gap: 8px; }
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
