import { Component, EventEmitter, Output } from "@angular/core";
import { CommonModule } from "@angular/common";
@Component({
  selector: "app-landing-page",
  standalone: true,
  imports: [CommonModule],
  template: ` <section class="landing">
    <div class="landing-hero">
      <div class="hero-copy">
        <span class="eyebrow">CASMANGO · LOCAL CRISPR ANALYSIS</span>
        <h1>From sequencing reads<br />to editing outcomes.</h1>
        <p>
          Analyse Nanopore and Illumina reads in your browser.<br />No account.
          No uploads.
        </p>
        <div class="hero-actions">
          <button
            type="button"
            class="start-button"
            (click)="openTool.emit('analysis')"
          >
            Start analysis <span>→</span></button
          ><button type="button" class="guide-link" (click)="openGuide.emit()">
            Explore the guide ↗
          </button>
        </div>
      </div>
      <div class="hero-mascot">
        <img
          src="guide-mascots/wave.png"
          alt="CasMango scientist mascot"
        /><span>Small tool. Clear outcomes.</span>
      </div>
    </div>
    <div class="quick-tools">
      <button
        type="button"
        *ngFor="let tool of tools"
        (click)="openTool.emit(tool.tab)"
      >
        <span class="tool-symbol">{{ tool.symbol }}</span>
        <div>
          <h2>{{ tool.name }}</h2>
          <p>{{ tool.description }}</p>
        </div>
        <span class="tool-arrow">↗</span>
      </button>
    </div>
  </section>`,
  styles: [
    `
      :host {
        display: block;
        flex: 1;
      }
      .landing {
        max-width: 1060px;
        margin: 0 auto;
        padding: 65px 30px 50px;
        color: #202b3d;
      }
      .landing-hero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 240px;
        align-items: center;
        gap: 50px;
        padding: 25px 0 70px;
      }
      .eyebrow {
        font-size: 10px;
        letter-spacing: 0.15em;
        font-weight: 700;
        color: #ad7a1a;
      }
      h1 {
        font-size: clamp(34px, 4.5vw, 52px);
        font-weight: 650;
        line-height: 1.14;
        letter-spacing: -1.8px;
        margin: 20px 0;
      }
      .hero-copy > p {
        font-size: 15px;
        line-height: 1.75;
        color: #7c8795;
      }
      .hero-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 24px;
        margin-top: 30px;
      }
      button {
        font: inherit;
        cursor: pointer;
      }
      .start-button {
        display: flex;
        gap: 32px;
        align-items: center;
        padding: 13px 19px;
        border: 1px solid #ed9f07;
        border-radius: 8px;
        background: #f59e0b;
        color: #fff;
        font-size: 13px;
        font-weight: 650;
      }
      .start-button:hover {
        background: #e99500;
      }
      .guide-link {
        padding: 8px 0;
        background: none;
        border: 0;
        font-size: 12px;
        color: #89909a;
      }
      .guide-link:hover {
        color: #9b6a12;
      }
      .hero-mascot {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 18px;
      }
      .hero-mascot img {
        display: block;
        height: 190px;
        max-width: 180px;
        object-fit: contain;
      }
      .hero-mascot > span {
        font-size: 10px;
        color: #a6a7a6;
        letter-spacing: 0.04em;
      }
      .quick-tools {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 15px;
        border-top: 1px solid #e8ebed;
        padding-top: 30px;
      }
      .quick-tools > button {
        display: flex;
        gap: 13px;
        align-items: flex-start;
        text-align: left;
        border: 1px solid #e6e9ed;
        background: #fff;
        border-radius: 11px;
        padding: 23px 18px;
        transition: border-color 0.15s;
      }
      .quick-tools > button:hover {
        border-color: #efc575;
      }
      .tool-symbol {
        width: 30px;
        flex-shrink: 0;
        font-size: 25px;
        line-height: 1;
        color: #b49a65;
      }
      .quick-tools h2 {
        font-size: 13px;
        font-weight: 650;
        margin: 0 0 8px;
      }
      .quick-tools p {
        font-size: 11px;
        line-height: 1.6;
        color: #9aa0aa;
        margin: 0;
      }
      .tool-arrow {
        margin-left: auto;
        font-size: 15px;
        color: #b1b5bc;
      }
      button:focus-visible {
        outline: 2px solid #e79b0e;
        outline-offset: 4px;
      }
      @media (max-width: 760px) {
        .landing {
          padding: 35px 22px;
        }
        .landing-hero {
          grid-template-columns: minmax(0, 1fr) 110px;
          gap: 15px;
          padding: 10px 0 42px;
        }
        .hero-mascot img {
          height: 110px;
          max-width: 100px;
        }
        .hero-mascot > span {
          display: none;
        }
        .quick-tools {
          grid-template-columns: 1fr;
        }
        .hero-copy > p {
          font-size: 13px;
        }
        h1 {
          font-size: 34px;
          letter-spacing: -1px;
        }
        .eyebrow {
          font-size: 8px;
        }
        .hero-actions {
          gap: 15px;
        }
      }
      @media (max-width: 420px) {
        .landing-hero {
          grid-template-columns: 1fr;
        }
        .hero-mascot {
          display: none;
        }
      }
    `,
  ],
})
export class LandingPageComponent {
  @Output() openTool = new EventEmitter<
    "analysis" | "viewer" | "workspace" | "benchmark"
  >();
  @Output() openGuide = new EventEmitter<void>();
  tools: [
    { tab: "viewer"; name: string; description: string; symbol: string },
    { tab: "workspace"; name: string; description: string; symbol: string },
    { tab: "benchmark"; name: string; description: string; symbol: string },
  ] = [
    {
      tab: "viewer",
      name: "Result Viewer",
      description: "Reopen exported results and explore editing profiles.",
      symbol: "▥",
    },
    {
      tab: "workspace",
      name: "Sequence Viewer",
      description: "Inspect sequences, reads and alignments.",
      symbol: "≋",
    },
    {
      tab: "benchmark",
      name: "Benchmark",
      description: "Explore analysis accuracy with example data.",
      symbol: "◷",
    },
  ];
}
