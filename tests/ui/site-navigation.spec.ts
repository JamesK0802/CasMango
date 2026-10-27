import "@angular/compiler";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BehaviorSubject } from "rxjs";
import { App } from "../../src/app/app";
let app: App, state: any, location: { hash: string };
beforeEach(() => {
  location = { hash: "" };
  const change = vi.fn((_state: any, _title: string, hash: string) => {
    location.hash = hash;
  });
  vi.stubGlobal("window", {
    location,
    history: { pushState: change, replaceState: change },
  });
  const tab$ = new BehaviorSubject<any>("analysis");
  state = {
    isAnalysisRunning: false,
    activeMainTab$: tab$,
    activateSlot: vi.fn(),
    collapseAnalysisPanels: vi.fn(),
    switchMainTab: vi.fn((tab: any) => tab$.next(tab)),
  };
  app = new App(state);
  app.ngOnInit();
});
afterEach(() => {
  app.ngOnDestroy();
  vi.unstubAllGlobals();
});
describe("CasMango public pages and existing tools", () => {
  it("opens on the landing page without opening an analysis page", () => {
    expect(app.page).toBe("home");
    expect(location.hash).toBe("#/");
    expect(state.switchMainTab).not.toHaveBeenCalled();
  });
  it("opens every existing tool with a static-host-safe deep link", () => {
    for (const [tab, hash] of [
      ["analysis", "#/analysis"],
      ["viewer", "#/results"],
      ["workspace", "#/sequence-viewer"],
      ["benchmark", "#/benchmark"],
    ] as const) {
      app.switchTab(tab);
      expect(app.page).toBe("tool");
      expect(app.activeTab).toBe(tab);
      expect(location.hash).toBe(hash);
    }
  });
  it("does not reset analysis/results when visiting Contact and Home", () => {
    app.switchTab("viewer");
    state.activateSlot.mockClear();
    app.showPage("contact");
    expect(app.page).toBe("contact");
    expect(location.hash).toBe("#/contact");
    app.showPage("home");
    expect(app.activeTab).toBe("viewer");
    expect(state.activateSlot).not.toHaveBeenCalled();
  });
  it("restores direct Contact and tool URLs on browser navigation", () => {
    location.hash = "#/contact";
    app.readRoute();
    expect(app.page).toBe("contact");
    location.hash = "#/results";
    app.readRoute();
    expect(app.page).toBe("tool");
    expect(app.activeTab).toBe("viewer");
  });
  it("guards navigation away from a running analysis, including browser Back", () => {
    app.switchTab("analysis");
    state.isAnalysisRunning = true;
    location.hash = "#/contact";
    app.readRoute();
    expect(app.page).toBe("tool");
    expect(location.hash).toBe("#/analysis");
    app.switchTab("workspace");
    expect(app.activeTab).toBe("analysis");
    app.openGuide();
    expect(app.isGuideOpen).toBe(false);
  });
  it("opens guides inside the tool shell and preserves mode selection", () => {
    app.openGuide("workspace");
    expect(app.page).toBe("tool");
    expect(app.activeTab).toBe("workspace");
    expect(app.isGuideOpen).toBe(true);
    app.openGuide("analysis");
    expect(state.collapseAnalysisPanels).toHaveBeenCalledOnce();
  });
  it("keeps cross-tool requests reflected in the URL without forcing Home open", () => {
    state.activeMainTab$.next("workspace");
    expect(app.page).toBe("home");
    app.switchTab("viewer");
    state.activeMainTab$.next("workspace");
    expect(location.hash).toBe("#/sequence-viewer");
  });
  it("opens version notes from the Contact dropdown and restores its deep link", () => {
    app.contactMenuOpen = true;
    app.showPage('versions');
    expect(app.page).toBe('versions');
    expect(location.hash).toBe('#/version-notes');
    expect(app.contactMenuOpen).toBe(false);
    app.showPage('home');
    location.hash = '#/version-notes';
    app.readRoute();
    expect(app.page).toBe('versions');
    app.showPage('contact');
    expect(location.hash).toBe('#/contact');
  });
  it("closes the Contact dropdown on dismissal and tool navigation", () => {
    app.contactMenuOpen = true;
    app.closeContactMenu();
    expect(app.contactMenuOpen).toBe(false);
    app.contactMenuOpen = true;
    app.switchTab('analysis');
    expect(app.contactMenuOpen).toBe(false);
  });
});
