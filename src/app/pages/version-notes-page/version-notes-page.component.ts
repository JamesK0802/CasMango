import { Component } from '@angular/core';
import { LATEST_RELEASE } from '../../models/release-notes';

@Component({
  selector: 'app-version-notes-page', standalone: true,
  template: `
    <section class="version-notes" aria-labelledby="version-notes-title">
      <h1 id="version-notes-title">Version notes</h1>
      <article>
        <header><h2>v{{ latestRelease.version }}</h2><time [attr.datetime]="latestRelease.date">{{ latestRelease.displayDate }}</time></header>
        <p>{{ latestRelease.text }}</p>
      </article>
    </section>
  `,
  styles: [`
    :host { display: flex; flex: 1; }
    .version-notes { width: 100%; max-width: 900px; margin: 0 auto; padding: 80px 40px; color: #26382f; box-sizing: border-box; }
    h1 { margin: 0 0 50px; font-size: clamp(30px, 4vw, 42px); font-weight: 600; letter-spacing: -.035em; }
    article { padding-top: 28px; border-top: 1px solid #dfe5df; }
    header { display: flex; align-items: baseline; flex-wrap: wrap; gap: 20px; }
    h2 { margin: 0; font-size: 23px; font-weight: 600; }
    time { color: #7d887f; font-size: 14px; }
    p { margin: 18px 0 0; font-size: 16px; line-height: 1.7; color: #637168; }
    @media(max-width: 600px) { .version-notes { padding: 45px 24px; } }
  `],
})
export class VersionNotesPageComponent {
  readonly latestRelease = LATEST_RELEASE;
}
