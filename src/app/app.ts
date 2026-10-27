import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ViewEncapsulation,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { AppStateService } from "./services/app-state.service";
import { AnalysisPageComponent } from "./pages/analysis-page/analysis-page.component";
import { ResultViewerPageComponent } from "./pages/result-viewer-page/result-viewer-page.component";
import { BenchmarkPageComponent } from "./pages/benchmark-page/benchmark-page.component";
import { SequenceWorkspacePageComponent } from "./pages/sequence-workspace-page/sequence-workspace-page.component";
import { LandingPageComponent } from "./pages/landing-page/landing-page.component";
import { ContactPageComponent } from "./pages/contact-page/contact-page.component";
import { VersionNotesPageComponent } from "./pages/version-notes-page/version-notes-page.component";
import { LATEST_RELEASE } from "./models/release-notes";
import { Subscription } from "rxjs";
import { TutorialGuideComponent } from "./components/tutorial-guide/tutorial-guide.component";

type MainTab = "analysis" | "viewer" | "benchmark" | "workspace";
type SitePage = "home" | "tool" | "contact" | "versions";
const TAB_ROUTES: Record<MainTab, string> = {
  analysis: "/analysis",
  viewer: "/results",
  benchmark: "/benchmark",
  workspace: "/sequence-viewer",
};

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    AnalysisPageComponent,
    ResultViewerPageComponent,
    BenchmarkPageComponent,
    SequenceWorkspacePageComponent,
    TutorialGuideComponent,
    LandingPageComponent,
    ContactPageComponent,
    VersionNotesPageComponent,
  ],
  template: `
    <div class="app-shell">
      <!-- ── Top Navigation ── -->
      <nav class="top-nav">
        <div class="nav-left">
          <button
            type="button"
            class="nav-brand"
            id="guide-brand-logo"
            aria-label="CasMango home"
            [disabled]="state.isAnalysisRunning"
            (click)="showPage('home')"
          >
            <img
              src="casmango-logo.jpg"
              alt="CasMango"
              class="nav-brand-logo"
            />
          </button>

          <div
            class="desktop-nav-links"
            id="guide-nav-links"
          >
            <button
              class="nav-tab btn-tab"
              [class.active]="page === 'tool' && activeTab === 'analysis'"
              (click)="switchTab('analysis')"
            >
              CRISPR Analysis
            </button>
            <button
              class="nav-tab btn-tab"
              id="guide-viewer-tab-btn"
              [class.active]="page === 'tool' && activeTab === 'viewer'"
              [class.locked]="state.isAnalysisRunning"
              [disabled]="state.isAnalysisRunning"
              title="{{
                state.isAnalysisRunning
                  ? 'Finish or cancel the current analysis first'
                  : ''
              }}"
              (click)="switchTab('viewer')"
            >
              Result Viewer
            </button>
            <button
              class="nav-tab btn-tab"
              [class.active]="page === 'tool' && activeTab === 'benchmark'"
              [class.locked]="state.isAnalysisRunning"
              [disabled]="state.isAnalysisRunning"
              title="{{
                state.isAnalysisRunning
                  ? 'Finish or cancel the current analysis first'
                  : ''
              }}"
              (click)="switchTab('benchmark')"
            >
              Benchmark
            </button>
            <button
              class="nav-tab btn-tab"
              [class.active]="page === 'tool' && activeTab === 'workspace'"
              [class.locked]="state.isAnalysisRunning"
              [disabled]="state.isAnalysisRunning"
              title="{{
                state.isAnalysisRunning
                  ? 'Finish or cancel the current analysis first'
                  : ''
              }}"
              (click)="switchTab('workspace')"
            >
              Sequence Viewer
            </button>
          </div>
        </div>

        <div class="nav-right">
          <div class="contact-nav-group" (click)="$event.stopPropagation()">
          <button
            type="button"
            class="contact-nav-link"
            [class.active]="page === 'contact'"
            [disabled]="state.isAnalysisRunning"
            (click)="showPage('contact')"
          >
            Contact
          </button>
          <button type="button" class="contact-menu-toggle" aria-label="Contact menu" aria-controls="contact-menu" [attr.aria-expanded]="contactMenuOpen" [disabled]="state.isAnalysisRunning" (click)="contactMenuOpen = !contactMenuOpen">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
          </button>
          <div id="contact-menu" class="contact-dropdown" *ngIf="contactMenuOpen">
            <button type="button" (click)="showPage('versions')">Version notes <span>v{{ latestRelease.version }}</span></button>
          </div>
          </div>
          <button
            type="button"
            class="btn-guide-trigger"
            (click)="openGuide()"
            [disabled]="state.isAnalysisRunning"
            title="Interactive Tutorial Guide"
          >
            <span class="guide-btn-text">Guide</span>
          </button>
          <span class="version-tag">v{{ latestRelease.version }}</span>
        </div>

        <span class="mobile-active-section">{{ activeTabLabel }}</span>
        <button
          type="button"
          class="mobile-hamburger-btn"
          [class.open]="mobileMenuOpen"
          (click)="mobileMenuOpen = !mobileMenuOpen"
          [attr.aria-expanded]="mobileMenuOpen"
          aria-controls="mobile-navigation"
          aria-label="Toggle navigation menu"
        >
          <span class="bar bar-1"></span>
          <span class="bar bar-2"></span>
          <span class="bar bar-3"></span>
        </button>
      </nav>

      <button
        *ngIf="mobileMenuOpen"
        type="button"
        class="mobile-drawer-backdrop"
        (click)="mobileMenuOpen = false"
        aria-label="Close navigation menu"
      ></button>
      <aside
        *ngIf="mobileMenuOpen"
        id="mobile-navigation"
        class="mobile-nav-drawer open"
      >
        <div class="drawer-header">
          <img src="casmango-logo.jpg" alt="CasMango" class="drawer-logo" />
          <div class="drawer-header-actions">
            <span class="version-tag">v{{ latestRelease.version }}</span>
            <button
              type="button"
              class="drawer-close"
              (click)="mobileMenuOpen = false"
              aria-label="Close navigation menu"
            >
              ×
            </button>
          </div>
        </div>
        <div class="drawer-links" aria-label="CasMango tools">
          <button
            type="button"
            class="drawer-link"
            [disabled]="state.isAnalysisRunning"
            (click)="showPage('home')"
          >
            Home</button
          ><span class="drawer-section-title">Tools</span>
          <button
            type="button"
            class="drawer-link"
            [class.active]="page === 'tool' && activeTab === 'analysis'"
            (click)="switchTab('analysis')"
          >
            CRISPR Analysis
          </button>
          <button
            type="button"
            class="drawer-link"
            [class.active]="page === 'tool' && activeTab === 'viewer'"
            [disabled]="state.isAnalysisRunning"
            (click)="switchTab('viewer')"
          >
            Result Viewer
          </button>
          <button
            type="button"
            class="drawer-link"
            [class.active]="page === 'tool' && activeTab === 'benchmark'"
            [disabled]="state.isAnalysisRunning"
            (click)="switchTab('benchmark')"
          >
            Benchmark
          </button>
          <button
            type="button"
            class="drawer-link"
            [class.active]="page === 'tool' && activeTab === 'workspace'"
            [disabled]="state.isAnalysisRunning"
            (click)="switchTab('workspace')"
          >
            Sequence Viewer
          </button>
          <button
            type="button"
            class="drawer-link"
            [disabled]="state.isAnalysisRunning"
            (click)="showPage('contact')"
          >
            Contact
          </button>
          <button type="button" class="drawer-link" [class.active]="page === 'versions'" [disabled]="state.isAnalysisRunning" (click)="showPage('versions')">Version notes</button>
          <button
            type="button"
            class="drawer-link drawer-guide-btn"
            [disabled]="state.isAnalysisRunning"
            (click)="openGuide()"
          >
            Interactive Guide
          </button>
        </div>
        <div class="drawer-footer">All analysis stays on this device.</div>
      </aside>

      <!-- ── Main Content ── -->
      <main class="app-content">
        <div class="crispr-shell">
          <div class="public-screen" *ngIf="page !== 'tool'">
            <app-landing-page
              *ngIf="page === 'home'"
              (openTool)="switchTab($event)"
            />
            <app-contact-page
              *ngIf="page === 'contact'"
              (goHome)="showPage('home')"
            />
            <app-version-notes-page *ngIf="page === 'versions'" />
          </div>
          <div
            class="crispr-body"
            *ngIf="page === 'tool'"
            [class.full-width]="activeTab === 'workspace'"
          >
            <app-analysis-page
              *ngIf="activeTab === 'analysis'"
            ></app-analysis-page>
            <app-result-viewer-page
              *ngIf="activeTab === 'viewer'"
            ></app-result-viewer-page>
            <app-benchmark-page
              *ngIf="activeTab === 'benchmark'"
            ></app-benchmark-page>

            <ng-container *ngIf="activeTab === 'workspace'">
              <app-sequence-workspace-page></app-sequence-workspace-page>
            </ng-container>
          </div>

          <!-- Footer Notice -->
          <footer class="app-footer" *ngIf="page === 'tool'">
            <div class="footer-content">
              <p>
                CasMango runs CRISPR analysis entirely in your browser.
                Sequencing files remain on this device and are never uploaded to
                a server.
              </p>
            </div>
          </footer>

          <!-- ── Interactive Mascot Tutorial Guide ── -->
          <app-tutorial-guide
            *ngIf="isGuideOpen"
            [initialMode]="guideInitialMode"
            (close)="isGuideOpen = false"
            (requestTab)="switchTab($event)"
          ></app-tutorial-guide>
          <!-- ── Global Export Loading Overlay ── -->
          <div
            class="global-export-overlay"
            *ngIf="state.exportStatus$ | async as status"
          >
            <div class="export-loading-card">
              <div class="export-spinner-ring"></div>
              <div class="export-loading-content">
                <h4>{{ status.title }}</h4>
                <p>{{ status.stage }}</p>
                <div class="export-progress-track">
                  <div
                    class="export-progress-bar"
                    [style.width.%]="status.percent"
                  ></div>
                </div>
                <span class="export-percent-num">{{ status.percent }}%</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
  styleUrl: "./app.css",
  encapsulation: ViewEncapsulation.None,
  styles: [
    `
      .btn-tab {
        background: none;
        border: none;
        font-size: var(--text-base);
        font-weight: var(--fw-bold);
        color: var(--color-text-secondary);
        cursor: pointer;
        padding: var(--space-2) var(--space-4);
        border-radius: var(--radius-sm);
        transition: var(--transition-fast);
      }
      .btn-tab:hover {
        color: var(--color-text-primary);
        background: var(--color-surface-alt);
      }
      .btn-tab.active {
        color: var(--color-primary);
        background: var(--color-primary-light);
      }
      .btn-tab.locked,
      .btn-tab.locked:hover {
        color: var(--color-text-tertiary);
        background: transparent;
        cursor: not-allowed;
        opacity: 0.5;
      }
      .crispr-shell {
        display: flex;
        flex-direction: column;
        min-height: calc(100vh - 56px);
      }
      .crispr-body {
        flex: 1;
        padding: 24px 28px;
        background: #f7f8fa;
        max-width: 1100px;
        width: 100%;
        margin: 0 auto;
      }
      .crispr-body.full-width {
        max-width: 100%;
        padding: 0;
      }
      .app-footer {
        background: var(--color-surface);
        border-top: 1px solid var(--color-border);
        padding: var(--space-4) var(--space-6);
        text-align: center;
        margin-top: auto;
      }
      .footer-content p {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        margin: 0;
        line-height: 1.5;
      }
      @media (max-width: 760px) {
        .crispr-body {
          padding: 18px 20px;
        }
      }
    `,
  ],
})
export class App implements OnInit, OnDestroy {
  readonly latestRelease = LATEST_RELEASE;
  page: SitePage = "home";
  activeTab: MainTab = "analysis";
  mobileMenuOpen = false;
  contactMenuOpen = false;
  isGuideOpen = false;
  guideInitialMode: "hub" | "analysis" | "result" | "workspace" | "benchmark" =
    "hub";
  private subscription?: Subscription;
  private routing = false;
  constructor(public state: AppStateService) {}
  openGuide(
    mode: "hub" | "analysis" | "result" | "workspace" | "benchmark" = "hub",
  ) {
    if (this.state.isAnalysisRunning) return;
    this.guideInitialMode = mode;
    const tab: MainTab =
      mode === "result" ? "viewer" : mode === "hub" ? this.activeTab : mode;
    this.switchTab(tab);
    if (mode === "analysis") this.state.collapseAnalysisPanels();
    this.isGuideOpen = true;
    this.mobileMenuOpen = false;
  }
  switchTab(tab: MainTab, replace = false) {
    this.contactMenuOpen = false;
    if (
      this.state.isAnalysisRunning &&
      (tab !== this.activeTab || this.page !== "tool")
    ) {
      this.writeRoute(true);
      return;
    }
    this.routing = true;
    try {
      this.page = "tool";
      this.state.switchMainTab(tab);
      this.activeTab = tab;
    } finally {
      this.routing = false;
    }
    this.mobileMenuOpen = false;
    this.writeRoute(replace);
  }
  showPage(page: Exclude<SitePage, "tool">, replace = false) {
    this.contactMenuOpen = false;
    if (this.state.isAnalysisRunning) {
      this.writeRoute(true);
      return;
    }
    this.isGuideOpen = false;
    this.page = page;
    this.mobileMenuOpen = false;
    this.writeRoute(replace);
  }
  private writeRoute(replace = false) {
    const hash =
      "#" +
      (this.page === "home"
        ? "/"
        : this.page === "contact"
          ? "/contact"
          : this.page === "versions"
            ? "/version-notes"
          : TAB_ROUTES[this.activeTab]);
    if (window.location.hash !== hash)
      window.history[replace ? "replaceState" : "pushState"](null, "", hash);
  }
  @HostListener("window:popstate")
  @HostListener("window:hashchange")
  readRoute() {
    const route = window.location.hash.replace(/^#/, "") || "/";
    const tab = (Object.keys(TAB_ROUTES) as MainTab[]).find(
      (tab) => TAB_ROUTES[tab] === route,
    );
    if (tab) this.switchTab(tab, true);
    else this.showPage(route === "/contact" ? "contact" : route === "/version-notes" ? "versions" : "home", true);
  }
  @HostListener("document:click")
  @HostListener("window:keydown.escape")
  closeContactMenu() { this.contactMenuOpen = false; }
  get activeTabLabel(): string {
    if (this.page !== "tool") return this.page === "home" ? "Home" : this.page === "versions" ? "Version notes" : "Contact";
    return {
      analysis: "Analysis",
      viewer: "Results",
      benchmark: "Benchmark",
      workspace: "Sequences",
    }[this.activeTab];
  }
  ngOnInit() {
    this.state.activateSlot("analysis");
    this.subscription = this.state.activeMainTab$.subscribe((tab) => {
      this.activeTab = tab;
      if (this.page === "tool" && !this.routing) this.writeRoute(true);
    });
    this.readRoute();
  }
  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }
}
