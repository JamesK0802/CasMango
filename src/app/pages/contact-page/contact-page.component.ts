import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-contact-page',
  standalone: true,
  template: `
    <section class="contact-page" aria-labelledby="contact-title">
      <div class="contact-intro">
        <span class="eyebrow">GET IN TOUCH</span>
        <h1 id="contact-title">Contact me.</h1>
        <p class="invitation">Something to add?<br />Something not working?</p>
        <p class="description">Feature ideas, bug reports, questions, or feedback — feel free to reach out. I’d love to hear how CasMango can work better for you.</p>
        <button type="button" class="back-link" (click)="goHome.emit()">← Back to home</button>
      </div>
      <div class="contact-details">
        <span class="eyebrow">CASMANGO DEVELOPER</span>
        <h2>James Kim</h2>
        <a class="email-link" href="mailto:James.Kim@anu.edu.au?subject=CasMango%20feedback">James.Kim&#64;anu.edu.au <span aria-hidden="true">↗</span></a>
        <p class="affiliation">Research School of Biology<br />The Australian National University</p>
        <a class="issue-link" href="https://github.com/JamesK0802/CasMango/issues" target="_blank" rel="noopener noreferrer">Prefer GitHub? Open an issue <span aria-hidden="true">↗</span></a>
      </div>
    </section>
  `,
  styles: [`
    :host { display: flex; flex: 1; }
    .contact-page { width: 100%; max-width: 1120px; margin: auto; padding: clamp(60px, 10vh, 120px) 40px; display: grid; grid-template-columns: 1.15fr 1fr; align-items: center; gap: clamp(48px, 8vw, 120px); color: #202b3d; box-sizing: border-box; }
    .eyebrow { display: block; color: #997331; font-size: 11px; font-weight: 700; letter-spacing: .13em; }
    h1 { margin: 20px 0 28px; font-size: clamp(42px, 5vw, 64px); line-height: 1.05; letter-spacing: -.045em; font-weight: 650; }
    .invitation { margin: 0 0 18px; font-size: clamp(21px, 2.3vw, 28px); line-height: 1.45; letter-spacing: -.02em; }
    .description { max-width: 440px; margin: 0; color: #687381; font-size: 16px; line-height: 1.85; }
    .back-link { margin-top: 40px; padding: 5px 0; border: 0; background: transparent; color: #6d7580; font: inherit; font-size: 13px; cursor: pointer; }
    .contact-details { border-left: 1px solid #e3e5e5; padding: 40px 0 40px clamp(30px, 4vw, 60px); }
    h2 { margin: 20px 0 14px; font-size: 30px; font-weight: 600; letter-spacing: -.025em; }
    a { text-decoration: none; }
    .email-link { display: inline-flex; align-items: center; gap: 18px; color: #a06f16; font-size: clamp(16px, 1.8vw, 21px); line-height: 1.5; overflow-wrap: anywhere; }
    .affiliation { margin: 24px 0 44px; color: #78828d; font-size: 14px; line-height: 1.8; }
    .issue-link { color: #586473; font-size: 13px; line-height: 1.7; }
    .issue-link span { margin-left: 10px; }
    a:hover, .back-link:hover { color: #a06f16; text-decoration: underline; text-underline-offset: 5px; }
    a:focus-visible, button:focus-visible { outline: 2px solid #e79b0e; outline-offset: 5px; }
    @media(max-width: 760px) {
      .contact-page { grid-template-columns: 1fr; gap: 40px; padding: 45px 24px; margin: 0 auto; }
      .contact-details { border-left: 0; border-top: 1px solid #e3e5e5; padding: 32px 0 0; }
      h1 { margin: 16px 0 24px; }
      .back-link { margin-top: 24px; }
      .affiliation { margin-bottom: 24px; }
    }
  `],
})
export class ContactPageComponent {
  @Output() goHome = new EventEmitter<void>();
}
