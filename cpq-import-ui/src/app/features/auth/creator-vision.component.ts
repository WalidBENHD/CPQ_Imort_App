import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-creator-vision',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section id="creator-vision" class="creator-section reveal-section" aria-labelledby="creator-title">
      <div class="creator-edition"><span>Creator's note</span><i></i><span>Product vision / 2026</span></div>

      <figure class="creator-portrait">
        <img src="assets/walid-benhamed.png" alt="Portrait of Walid Benhamed" loading="lazy">
        <span class="creator-portrait__note"><mat-icon>architecture</mat-icon> Built from CPQ experience</span>
        <figcaption>
          <span class="creator-monogram">WB</span>
          <span><strong>Walid Benhamed</strong><small>CPQ Specialist &middot; Legrand</small></span>
          <span class="creator-status"><i></i> Creator of the platform</span>
        </figcaption>
      </figure>

      <div class="creator-story">
        <span class="creator-kicker">The conviction behind the platform</span>
        <h2 id="creator-title">Clean data is where <em>every</em> transformation begins.</h2>
        <p class="creator-lead">
          I did not create this platform because governance needed another dashboard. I created it because every faster
          quote, safer automation and better customer decision begins long before the screen, with data people can trust.
        </p>

        <div class="creator-insight">
          <span>From experience to product</span>
          <p>
            My experience as a CPQ specialist at Legrand made one truth impossible to ignore: the quality of a commercial
            process is inseparable from the quality of the data beneath it. An article without a price, a change without
            context, or a publication without ownership is never just a data issue. It becomes a business issue.
          </p>
        </div>

        <blockquote>
          <span>&ldquo;</span>
          <p>When data is governed with clarity, improvement stops being a promise and becomes a repeatable capability.</p>
        </blockquote>

        <footer class="creator-footer">
          <div><small>My product vision</small><strong>Make governance operational, clear and human.</strong></div>
          <a href="https://www.linkedin.com/in/walid-benhamed-26214914b/" target="_blank" rel="noopener noreferrer">
            Connect on LinkedIn <mat-icon>north_east</mat-icon>
          </a>
        </footer>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; margin-bottom: 88px; }
    * { box-sizing: border-box; }
    .creator-section { position: relative; isolation: isolate; overflow: hidden; display: grid; grid-template-columns: minmax(340px, .72fr) minmax(0, 1.28fr); gap: clamp(44px, 7vw, 105px); min-height: 720px; padding: 68px 24px 24px; scroll-margin-top: 112px; border: 1px solid rgba(94,234,212,.2); border-radius: 30px; color: #f8fafc; background: linear-gradient(125deg,#07111f 0%,#101d32 53%,#071518 100%); box-shadow: 0 32px 84px rgba(2,6,23,.27); opacity: 0; transform: translateY(42px); transition: opacity 700ms ease, transform 700ms cubic-bezier(.22,1,.36,1); }
    .creator-section.is-visible { opacity: 1; transform: none; }
    .creator-section::before { content: 'CREATE'; position: absolute; top: -32px; right: -12px; z-index: -1; color: rgba(148,163,184,.035); font-family: "Bahnschrift",sans-serif; font-size: clamp(120px,16vw,230px); font-weight: 900; letter-spacing: -.07em; line-height: 1; }
    .creator-section::after { content: ''; position: absolute; inset: 0; z-index: -2; opacity: .16; background-image: linear-gradient(rgba(148,163,184,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.15) 1px,transparent 1px); background-size: 48px 48px; mask-image: linear-gradient(90deg,transparent,#000 55%,transparent); }
    .creator-edition { position: absolute; top: 25px; left: 28px; display: flex; align-items: center; gap: 10px; color: #5eead4; font-size: 9px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    .creator-edition i { width: 38px; height: 1px; background: rgba(94,234,212,.5); }
    .creator-portrait { position: relative; overflow: hidden; min-height: 650px; margin: 0; border: 1px solid rgba(255,255,255,.14); border-radius: 23px; background: #111; box-shadow: 0 24px 60px rgba(0,0,0,.24); }
    .creator-portrait::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg,transparent 55%,rgba(2,6,23,.72)); }
    .creator-portrait img { width: 100%; height: 100%; display: block; object-fit: cover; object-position: center 28%; filter: saturate(.92) contrast(1.03); transition: transform 900ms cubic-bezier(.22,1,.36,1); }
    .creator-section.is-visible .creator-portrait img { transform: scale(1.02); }
    .creator-portrait__note { position: absolute; z-index: 2; top: 18px; left: 18px; display: inline-flex; align-items: center; gap: 7px; padding: 8px 10px; border: 1px solid rgba(255,255,255,.18); border-radius: 999px; color: #d9fffa; background: rgba(8,17,31,.58); font-size: 8px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; backdrop-filter: blur(14px); }
    .creator-portrait__note mat-icon { width: 15px; height: 15px; font-size: 15px; }
    .creator-portrait figcaption { position: absolute; z-index: 2; right: 18px; bottom: 18px; left: 18px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; padding: 14px; border: 1px solid rgba(255,255,255,.18); border-radius: 15px; background: rgba(8,17,31,.76); backdrop-filter: blur(16px); }
    .creator-portrait figcaption > span:nth-child(2) { display: grid; gap: 2px; }
    .creator-portrait figcaption strong { font-size: 13px; }
    .creator-portrait figcaption small { color: #94a3b8; font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .creator-monogram { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 12px; color: #042f2e; background: #5eead4; font-size: 12px; font-weight: 950; }
    .creator-status { display: flex; align-items: center; gap: 7px; color: #99f6e4; font-size: 8px; font-weight: 900; text-transform: uppercase; }
    .creator-status i { width: 7px; height: 7px; border-radius: 50%; background: #2dd4bf; box-shadow: 0 0 0 5px rgba(45,212,191,.12); }
    .creator-story { align-self: center; max-width: 840px; padding-right: 42px; }
    .creator-kicker,.creator-insight > span { color: #5eead4; font-size: 9px; font-weight: 900; letter-spacing: .11em; text-transform: uppercase; }
    .creator-story h2 { max-width: 820px; margin: 20px 0 24px; color: #fff; font-family: Georgia,'Times New Roman',serif; font-size: clamp(48px,4.7vw,72px); font-weight: 500; letter-spacing: -.05em; line-height: .98; }
    .creator-story h2 em { color: #5eead4; font-weight: 500; }
    .creator-lead { max-width: 780px; margin: 0; color: #d7e0ec; font-size: 17px; line-height: 1.72; }
    .creator-insight { max-width: 780px; margin-top: 28px; padding: 19px 20px; border: 1px solid rgba(148,163,184,.16); border-radius: 15px; background: rgba(15,23,42,.3); }
    .creator-insight p { margin: 10px 0 0; color: #aebbd0; font-size: 12px; line-height: 1.65; }
    blockquote { display: grid; grid-template-columns: auto 1fr; gap: 12px; max-width: 780px; margin: 14px 0 0; padding: 18px 20px; border-left: 3px solid #2dd4bf; border-radius: 0 15px 15px 0; background: linear-gradient(135deg,rgba(15,118,110,.17),rgba(15,82,96,.08)); }
    blockquote > span { color: #5eead4; font-family: Georgia,serif; font-size: 42px; line-height: .8; }
    blockquote p { margin: 0; color: #f1f5f9; font-family: Georgia,'Times New Roman',serif; font-size: 15px; font-style: italic; line-height: 1.5; }
    .creator-footer { display: flex; align-items: center; justify-content: space-between; gap: 18px; max-width: 780px; margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(148,163,184,.2); }
    .creator-footer > div { display: grid; gap: 3px; }
    .creator-footer small { color: #5eead4; font-size: 8px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    .creator-footer strong { color: #f8fafc; font-size: 12px; }
    .creator-footer a { min-height: 42px; display: inline-flex; align-items: center; gap: 8px; padding: 0 15px; border: 1px solid rgba(226,232,240,.28); border-radius: 11px; color: #e2e8f0; font-size: 11px; font-weight: 850; text-decoration: none; transition: border-color 180ms ease,background-color 180ms ease,transform 180ms ease; }
    .creator-footer a:hover { transform: translateY(-2px); border-color: #5eead4; background: rgba(45,212,191,.08); }
    .creator-footer mat-icon { width: 17px; height: 17px; font-size: 17px; }
    @media(max-width:1050px) {
      .creator-section { grid-template-columns: 1fr; gap: 36px; }
      .creator-portrait { min-height: 720px; }
      .creator-story { max-width: none; padding: 12px 24px 34px; }
    }
    @media(max-width:720px) {
      :host { margin-bottom: 64px; }
      .creator-section { min-height: 0; gap: 26px; padding: 58px 14px 14px; scroll-margin-top: 126px; border-radius: 22px; }
      .creator-edition { left: 20px; }
      .creator-portrait { min-height: 500px; }
      .creator-portrait figcaption { grid-template-columns: auto 1fr; }
      .creator-status { grid-column: 1 / -1; justify-self: start; }
      .creator-story { padding: 6px 9px 26px; }
      .creator-story h2 { font-size: 42px; }
      .creator-lead { font-size: 15px; }
      .creator-footer { align-items: stretch; flex-direction: column; }
      .creator-footer a { justify-content: center; }
    }
    @media(prefers-reduced-motion:reduce) {
      .creator-section,.creator-portrait img { opacity: 1; transform: none; transition: none; }
    }
  `]
})
export class CreatorVisionComponent {}
