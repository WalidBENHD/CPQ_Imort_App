import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { EvolisDecryptorService } from '../../core/services/evolis-decryptor.service';
import { EvolisDecryptResponse, EvolisDecryptionMetrics, EvolisDecryptionRun, EvolisPresentation } from '../../core/models/evolis.models';
import { parseEvolisPresentation } from './evolis-parser';
import { AuthFacade } from '../../core/auth/auth.facade';
import { forkJoin } from 'rxjs';

type HistoryScope = 'mine' | 'all';
type DecryptionStatus = 'Successful' | 'Failed';

@Component({
  selector: 'app-evolis-decryptor',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <section class="page-shell evolis-decryptor-page">
      <header class="page-header decryptor-hero">
        <div class="hero-copy">
          <span class="hero-mark"><mat-icon>enhanced_encryption</mat-icon></span>
          <div>
            <div class="eyebrow">Secure operations / Internal tools</div>
            <h1>Evolis decryption workspace</h1>
            <p class="page-intro">
              Turn an encrypted Evolis pricing file into a clear, reviewable PDF report.
            </p>
          </div>
        </div>
        <div class="hero-signal">
          <span><i></i> Restricted tool</span>
          <strong>Every operation is recorded</strong>
        </div>
      </header>

      <div class="tool-context" aria-label="Decryption workflow">
        <div><span><mat-icon>description</mat-icon></span><p><small>Source</small><strong>Encrypted text file</strong></p></div>
        <mat-icon class="context-arrow">arrow_forward</mat-icon>
        <div><span><mat-icon>verified_user</mat-icon></span><p><small>Process</small><strong>Controlled decryption</strong></p></div>
        <mat-icon class="context-arrow">arrow_forward</mat-icon>
        <div><span><mat-icon>picture_as_pdf</mat-icon></span><p><small>Output</small><strong>Reviewable PDF</strong></p></div>
      </div>

      <button *ngIf="historyExpanded" class="history-backdrop" type="button" aria-label="Close full decryption history" (click)="historyExpanded = false"></button>
      <mat-card class="panel history-panel" id="decryption-history" [class.history-panel--expanded]="historyExpanded">
        <header class="history-head">
          <div class="history-title">
            <span class="history-mark"><mat-icon>manage_history</mat-icon></span>
            <div>
              <div class="eyebrow">Decryption records</div>
              <h2>{{ historyExpanded ? (historyScope === 'mine' ? 'My decryption history' : 'All decryptions') : 'Recent decryptions' }}</h2>
              <p>{{ historyScope === 'mine' ? 'Your recent Evolis operations, visible only to you.' : 'Administrative view across all authorised users.' }}</p>
            </div>
          </div>

          <button class="history-expand" type="button" (click)="historyExpanded = !historyExpanded">
            <mat-icon>{{ historyExpanded ? 'close' : 'open_in_full' }}</mat-icon>
            {{ historyExpanded ? 'Close' : 'View full history' }}
          </button>

          <div class="history-scope" *ngIf="canViewAllHistory">
            <button type="button" [class.active]="historyScope === 'mine'" (click)="setHistoryScope('mine')"><mat-icon>person</mat-icon> My history</button>
            <button type="button" [class.active]="historyScope === 'all'" (click)="setHistoryScope('all')"><mat-icon>admin_panel_settings</mat-icon> All decryptions</button>
          </div>
        </header>

        <div class="history-stats">
          <div><span class="stat-icon stat-icon--total"><mat-icon>lock_open</mat-icon></span><p><small>{{ historyScope === 'mine' ? 'My decryptions' : 'Total decryptions' }}</small><strong>{{ historyMetrics.total }}</strong></p></div>
          <div><span class="stat-icon stat-icon--month"><mat-icon>calendar_month</mat-icon></span><p><small>This month</small><strong>{{ monthCount }}</strong></p></div>
          <div><span class="stat-icon stat-icon--success"><mat-icon>check_circle</mat-icon></span><p><small>Successful</small><strong>{{ successCount }}</strong></p></div>
          <div><span class="stat-icon stat-icon--failed"><mat-icon>error</mat-icon></span><p><small>Failed</small><strong>{{ failedCount }}</strong></p></div>
        </div>

        <div class="history-toolbar">
          <label class="history-search"><mat-icon>search</mat-icon><input [(ngModel)]="historySearch" (ngModelChange)="onHistorySearch()" placeholder="Search file or user" aria-label="Search decryption history" /></label>
          <div class="history-filters" aria-label="Filter by status">
            <button type="button" [class.active]="historyStatus === 'All'" (click)="setHistoryStatus('All')">All</button>
            <button type="button" [class.active]="historyStatus === 'Successful'" (click)="setHistoryStatus('Successful')">Successful</button>
            <button type="button" [class.active]="historyStatus === 'Failed'" (click)="setHistoryStatus('Failed')">Failed</button>
          </div>
        </div>

        <div class="history-table-wrap" *ngIf="filteredHistory.length; else noHistory">
          <table class="history-table">
            <thead><tr><th>File</th><th *ngIf="historyScope === 'all'">User</th><th>Date and time</th><th>Size</th><th>Result</th><th>Output</th></tr></thead>
            <tbody>
              <tr *ngFor="let item of (historyExpanded ? filteredHistory : (filteredHistory | slice:0:5))">
                <td class="history-file" data-label="File"><span class="file-cell"><span><mat-icon>description</mat-icon></span><strong>{{ item.fileName }}</strong></span></td>
                <td class="history-user" data-label="User" *ngIf="historyScope === 'all'"><span class="user-cell"><i>{{ initials(item.userDisplayName) }}</i>{{ item.userDisplayName }}</span></td>
                <td class="history-date" data-label="Date"><time>{{ item.startedAtUtc | date:'dd MMM yyyy, HH:mm' }}</time></td>
                <td class="history-size" data-label="Size">{{ formatHistorySize(item.fileSize) }}</td>
                <td class="history-result" data-label="Result"><span class="history-status" [class.history-status--failed]="item.statusLabel === 'Failed'"><i></i>{{ item.statusLabel }}</span></td>
                <td class="history-output" data-label="Output"><span class="output-chip" [class.output-chip--empty]="!item.outputFormat"><mat-icon>{{ item.outputFormat ? 'picture_as_pdf' : 'remove' }}</mat-icon>{{ item.outputFormat ?? 'None' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <ng-template #noHistory><div class="history-empty"><mat-icon>history_toggle_off</mat-icon><strong>{{ historyLoading ? 'Loading history...' : 'No matching decryptions' }}</strong><span *ngIf="!historyLoading">Try changing the search or status filter.</span></div></ng-template>

        <footer class="history-pagination" *ngIf="historyExpanded && historyTotal > historyPageSize">
          <span>Page {{ historyPage }} of {{ historyPageCount }} &middot; {{ historyTotal }} records</span>
          <div><button type="button" [disabled]="historyPage === 1 || historyLoading" (click)="changeHistoryPage(-1)"><mat-icon>chevron_left</mat-icon> Previous</button><button type="button" [disabled]="historyPage === historyPageCount || historyLoading" (click)="changeHistoryPage(1)">Next <mat-icon>chevron_right</mat-icon></button></div>
        </footer>
      </mat-card>

      <div class="layout-grid layout-grid--summary">
        <mat-card class="panel upload-panel">
          <div
            class="dropzone"
            [class.dropzone--active]="dragActive"
            (dragover)="onDragOver($event)"
            (dragleave)="dragActive = false"
            (drop)="onDrop($event)"
          >
            <mat-icon class="dropzone-icon">upload_file</mat-icon>
            <div class="eyebrow">Start a decryption</div>
            <h2>Drop the encrypted file here</h2>
            <p>Choose one Evolis text file. We will process it and prepare the PDF report for review.</p>

            <input #fileInput type="file" accept=".txt,text/plain" class="file-input" (change)="onFileSelected($event)" />

            <div class="actions">
              <button mat-raised-button color="primary" type="button" (click)="fileInput.click()">
                <mat-icon>upload_file</mat-icon>
                Choose file
              </button>
              <button mat-stroked-button type="button" [disabled]="!selectedFile || processing" (click)="decrypt()">
                <mat-icon>security</mat-icon>
                {{ processing ? 'Decrypting...' : 'Decrypt file' }}
              </button>
              <button mat-button type="button" [disabled]="!selectedFile && !result" (click)="reset()">
                <mat-icon>restart_alt</mat-icon>
                Reset
              </button>
            </div>

            <div class="file-meta" *ngIf="selectedFile">
              <mat-icon>description</mat-icon>
              <div>
                <div class="file-name">{{ selectedFile.name }}</div>
                <div class="file-size">{{ selectedFile.size | number }} bytes</div>
              </div>
            </div>

            <div class="error-box" *ngIf="errorMessage">
              <mat-icon>error</mat-icon>
              <span>{{ errorMessage }}</span>
            </div>
          </div>
        </mat-card>

        <mat-card class="panel result-panel">
          <div class="result-head">
            <div>
              <div class="eyebrow">Result</div>
              <h2>Decrypted output</h2>
            </div>
            <button mat-raised-button color="primary" type="button" [disabled]="!result" (click)="downloadResult()">
              <mat-icon>picture_as_pdf</mat-icon>
              Download PDF
            </button>
          </div>

          <div class="result-state" *ngIf="!result && !processing">
            <mat-icon>info</mat-icon>
            <p>The result summary will appear here after processing.</p>
          </div>

          <div class="result-state result-state--loading" *ngIf="processing">
            <mat-icon>hourglass_top</mat-icon>
            <p>Decrypting the file now.</p>
          </div>

          <div class="result-summary" *ngIf="result">
            <div class="summary-item summary-item--source">
              <div class="summary-item__icon"><mat-icon>description</mat-icon></div>
              <span class="label">Source</span>
              <span class="value">{{ result.sourceFileName }}</span>
            </div>
            <div class="summary-item summary-item--total">
              <div class="summary-item__icon"><mat-icon>paid</mat-icon></div>
              <span class="label">Grand total</span>
              <span class="value">{{ presentation?.grandTotal ?? '0.0000' }}</span>
            </div>
            <div class="summary-item summary-item--output">
              <div class="summary-item__icon"><mat-icon>picture_as_pdf</mat-icon></div>
              <span class="label">Output</span>
              <span class="value">{{ result.downloadFileName }}</span>
            </div>
            <div class="summary-item summary-item--tables">
              <div class="summary-item__icon"><mat-icon>table_chart</mat-icon></div>
              <span class="label">Tables</span>
              <span class="value">{{ presentation?.tables?.length ?? 0 }}</span>
            </div>
          </div>

          <div class="result-overview" *ngIf="presentation && presentation.tables.length > 0">
            <div class="result-overview-head">
              <h3>Table overview</h3>
              <span>{{ presentation.tables.length }} tables</span>
            </div>

            <div class="result-overview-list">
              <div class="overview-item" *ngFor="let table of presentation.tables">
                <div class="overview-item-head">
                  <strong>{{ table.title }}</strong>
                  <span>{{ table.subtotal }}</span>
                </div>
                <div class="overview-item-meta">
                  <span>{{ table.idPanier }}</span>
                  <span>{{ formatTableDate(table.date) }}</span>
                </div>
                <div class="overview-item-stats">
                  <span>{{ table.lineRows.length }} standard</span>
                  <span>{{ table.configuredRows.length }} configured</span>
                </div>
              </div>
            </div>
          </div>

          <div class="result-empty-note" *ngIf="result && presentation && presentation.tables.length === 0">
            No table rows were detected in the uploaded file.
          </div>
        </mat-card>
      </div>

      <mat-card class="panel details-panel">
        <div class="details-head">
          <div>
            <div class="eyebrow">Detailed result</div>
            <h2>All table rows</h2>
            <p>Review the decrypted tables and row-level totals below.</p>
          </div>
          <div class="details-summary" *ngIf="presentation">
            <span>Grand total</span>
            <strong>{{ presentation.grandTotal }}</strong>
          </div>
        </div>

        <div class="result-state" *ngIf="!result && !processing">
          <mat-icon>info</mat-icon>
          <p>The detailed row breakdown will appear here after processing.</p>
        </div>

        <div class="result-state result-state--loading" *ngIf="processing">
          <mat-icon>hourglass_top</mat-icon>
          <p>Decrypting the file now.</p>
        </div>

        <ng-container *ngIf="presentation">
          <div class="table-section" *ngFor="let table of presentation.tables; let i = index">
            <div class="table-section-head">
              <div class="table-section-copy">
                <div class="eyebrow eyebrow--soft">{{ table.title }}</div>
                <h3>{{ table.idPanier }}</h3>
                <p>{{ formatTableDate(table.date) }}</p>
                <div class="table-section-metas">
                  <span>{{ table.lineRows.length }} standard</span>
                  <span>{{ table.configuredRows.length }} configured</span>
                </div>
              </div>
              <div class="table-section-actions">
                <div class="table-summary">
                  <span>Subtotal</span>
                  <strong>{{ table.subtotal }}</strong>
                </div>
                <button
                  mat-stroked-button
                  type="button"
                  class="table-toggle"
                  (click)="toggleTable(i)"
                  [attr.aria-expanded]="isTableExpanded(i)"
                  [attr.aria-controls]="'table-body-' + i">
                  <mat-icon>{{ isTableExpanded(i) ? 'expand_less' : 'expand_more' }}</mat-icon>
                  {{ isTableExpanded(i) ? 'Hide rows' : 'Show rows' }}
                </button>
              </div>
            </div>

            <div class="table-section-body" [class.expanded]="isTableExpanded(i)" [attr.id]="'table-body-' + i">
              <div class="table-section-body-inner">
                <div class="subtable" *ngIf="table.lineRows.length > 0">
                  <div class="subtable-head">
                    <h4>Standard rows</h4>
                    <span>{{ table.lineRows.length }} items</span>
                  </div>
                  <div class="table-scroll">
                    <table class="result-table result-table--standard">
                      <colgroup>
                        <col style="width: 6%" />
                        <col style="width: 58%" />
                        <col style="width: 36%" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>L</th>
                          <th>Generic part number</th>
                          <th>Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr *ngFor="let row of table.lineRows">
                          <td>{{ row.type }}</td>
                          <td>{{ row.quantity }}</td>
                          <td>{{ row.genericPartNumber }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div class="subtable" *ngIf="table.configuredRows.length > 0">
                  <div class="subtable-head">
                    <h4>Configured rows</h4>
                    <span>{{ table.configuredRows.length }} items</span>
                  </div>
                  <div class="table-scroll">
                    <table class="result-table result-table--configured">
                      <colgroup>
                        <col style="width: 4%" />
                        <col style="width: 16%" />
                        <col style="width: 8%" />
                        <col style="width: 50%" />
                        <col style="width: 11%" />
                        <col style="width: 11%" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>C</th>
                          <th>Generic part number</th>
                          <th>Quantity</th>
                          <th>Description</th>
                          <th>Unit price</th>
                          <th>Total price</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr *ngFor="let row of table.configuredRows">
                          <td>{{ row.type }}</td>
                          <td>{{ row.genericPartNumber }}</td>
                          <td>{{ row.quantity }}</td>
                          <td>{{ row.description }}</td>
                          <td>{{ row.unitPrice }}</td>
                          <td class="total-cell">{{ row.totalPrice }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div class="table-empty-note" *ngIf="table.lineRows.length === 0 && table.configuredRows.length === 0">
                  No detailed rows were detected for this table.
                </div>
              </div>
            </div>
          </div>
        </ng-container>
      </mat-card>
    </section>
  `,
  styles: [`
    .page-shell {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 390px;
      gap: 18px;
      align-items: start;
    }

    .page-header {
      grid-column: 1 / -1;
      grid-row: 1;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
    }

    .decryptor-hero {
      position: relative;
      overflow: hidden;
      min-height: 176px;
      padding: 28px 30px;
      border: 1px solid color-mix(in srgb, #0f766e 32%, var(--app-border));
      border-radius: 26px;
      background:
        radial-gradient(circle at 88% 18%, color-mix(in srgb, #f59e0b 22%, transparent) 0 12%, transparent 13%),
        linear-gradient(125deg, color-mix(in srgb, #0f766e 15%, var(--app-surface-elevated)), var(--app-surface-elevated) 58%);
      box-shadow: var(--app-shadow-soft);
    }

    .decryptor-hero::after {
      content: '';
      position: absolute;
      right: -54px;
      bottom: -88px;
      width: 250px;
      height: 250px;
      border: 34px solid color-mix(in srgb, #0f766e 9%, transparent);
      border-radius: 50%;
      pointer-events: none;
    }

    .hero-copy {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .hero-mark {
      display: grid;
      flex: 0 0 64px;
      width: 64px;
      height: 64px;
      place-items: center;
      border-radius: 20px;
      color: #fff;
      background: linear-gradient(145deg, #0f766e, #0d9488);
      box-shadow: 0 14px 30px color-mix(in srgb, #0f766e 30%, transparent);
    }

    .hero-mark mat-icon {
      width: 32px;
      height: 32px;
      font-size: 32px;
    }

    .hero-signal {
      position: relative;
      z-index: 1;
      display: grid;
      min-width: 220px;
      gap: 6px;
      padding: 14px 16px;
      border: 1px solid color-mix(in srgb, #0f766e 28%, var(--app-border));
      border-radius: 16px;
      background: color-mix(in srgb, var(--app-surface-elevated) 86%, transparent);
      backdrop-filter: blur(10px);
    }

    .hero-signal span {
      display: flex;
      align-items: center;
      gap: 7px;
      color: #0f766e;
      font-size: 11px;
      font-weight: 850;
      letter-spacing: .06em;
      text-transform: uppercase;
    }

    .hero-signal i {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #14b8a6;
      box-shadow: 0 0 0 5px color-mix(in srgb, #14b8a6 15%, transparent);
    }

    .hero-signal strong { color: var(--app-text); font-size: 13px; }

    .tool-context {
      grid-column: 1 / -1;
      grid-row: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 18px;
      padding: 14px 20px;
      border: 1px solid var(--app-border);
      border-radius: 18px;
      background: var(--app-surface-elevated);
      box-shadow: var(--app-shadow-soft);
    }

    .tool-context > div {
      display: flex;
      min-width: 180px;
      align-items: center;
      gap: 11px;
    }

    .tool-context > div > span {
      display: grid;
      width: 36px;
      height: 36px;
      flex: 0 0 36px;
      place-items: center;
      border-radius: 11px;
      color: #0f766e;
      background: color-mix(in srgb, #14b8a6 11%, var(--app-surface));
    }

    .tool-context mat-icon { width: 20px; height: 20px; font-size: 20px; }
    .tool-context p { display: grid; gap: 2px; margin: 0; }
    .tool-context small { color: var(--app-text-muted); font-size: 9px; font-weight: 850; letter-spacing: .07em; text-transform: uppercase; }
    .tool-context strong { color: var(--app-text); font-size: 12px; }
    .tool-context .context-arrow { color: color-mix(in srgb, var(--app-text-muted) 55%, transparent); }

    .eyebrow {
      color: var(--app-accent);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }

    h1, h2 {
      margin: 0;
      color: var(--app-text);
    }

    h1 {
      font-size: 30px;
      font-weight: 800;
    }

    h2 {
      font-size: 22px;
      font-weight: 750;
    }

    .page-intro {
      margin: 10px 0 0;
      color: var(--app-text-muted);
      line-height: 1.6;
      max-width: 820px;
    }

    .layout-grid {
      display: grid;
      grid-column: 1;
      grid-row: 3;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
      gap: 16px;
      align-items: stretch;
    }

    .layout-grid--summary {
      margin-bottom: 16px;
    }

    .panel {
      border: 1px solid var(--app-border);
      border-radius: 22px;
      background: var(--app-surface-elevated);
      box-shadow: 0 18px 40px rgba(2, 6, 23, 0.12);
    }

    .upload-panel,
    .result-panel {
      padding: 16px;
      display: flex;
      flex-direction: column;
    }

    .upload-panel {
      height: 100%;
      overflow: visible;
    }

    .result-panel {
      height: 100%;
    }

    .upload-panel .dropzone,
    .result-panel > .result-head,
    .result-panel > .result-summary,
    .result-panel > .result-empty-note {
      flex: 0 0 auto;
    }

    .upload-panel .dropzone {
      flex: 1 1 auto;
      min-height: 260px;
      justify-content: center;
      align-content: center;
      justify-items: center;
      text-align: center;
    }

    .dropzone {
      display: grid;
      gap: 14px;
      justify-items: start;
      border: 1px dashed color-mix(in srgb, #0f766e 42%, var(--app-border));
      border-radius: 20px;
      padding: 24px;
      background:
        radial-gradient(circle at 50% 12%, color-mix(in srgb, #14b8a6 10%, transparent), transparent 42%),
        color-mix(in srgb, #0f766e 3%, var(--app-surface));
    }

    .dropzone--active {
      border-color: var(--app-accent);
      background: linear-gradient(180deg, rgba(59, 130, 246, 0.12), rgba(59, 130, 246, 0.05));
    }

    .dropzone-icon {
      width: 44px;
      height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 14px;
      background: linear-gradient(145deg, #0f766e, #0d9488);
      color: #fff;
      box-shadow: 0 10px 24px color-mix(in srgb, #0f766e 24%, transparent);
    }

    .dropzone h2 {
      font-size: 20px;
    }

    .dropzone p {
      margin: 0;
      color: var(--app-text-muted);
      line-height: 1.55;
      max-width: 460px;
    }

    .file-input {
      display: none;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: center;
    }

    .actions button {
      border-radius: 999px;
      min-height: 42px;
      font-weight: 700;
    }

    .actions mat-icon {
      margin-right: 4px;
    }

    .file-meta {
      display: grid;
      grid-template-columns: 32px minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      width: min(100%, 420px);
      padding: 14px 16px;
      border-radius: 16px;
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      text-align: left;
    }

    .file-meta mat-icon {
      color: var(--app-accent);
    }

    .file-name {
      font-weight: 700;
      color: var(--app-text);
      word-break: break-word;
    }

    .file-size {
      color: var(--app-text-muted);
      font-size: 12px;
    }

    .error-box {
      display: flex;
      gap: 10px;
      align-items: center;
      width: min(100%, 420px);
      padding: 12px 14px;
      border-radius: 16px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.22);
      color: #b91c1c;
      font-weight: 600;
      text-align: left;
    }

    .result-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
      margin-bottom: 16px;
    }

    .result-head button {
      border-radius: 999px;
      min-height: 42px;
    }

    .result-state {
      display: grid;
      place-items: center;
      gap: 12px;
      min-height: 160px;
      text-align: center;
      border: 1px dashed var(--app-border);
      border-radius: 18px;
      color: var(--app-text-muted);
      background: var(--app-surface);
    }

    .result-state mat-icon {
      color: var(--app-accent);
      width: 36px;
      height: 36px;
      font-size: 36px;
    }

    .result-summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 14px;
    }

    .result-overview {
      margin-top: 8px;
      display: grid;
      gap: 12px;
      min-height: 0;
    }

    .result-overview-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .result-overview-head h3 {
      margin: 0;
      color: var(--app-text);
      font-size: 15px;
      font-weight: 800;
    }

    .result-overview-head span {
      color: var(--app-text-muted);
      font-size: 12px;
      font-weight: 700;
    }

    .result-overview-list {
      display: grid;
      gap: 10px;
      overflow: visible;
    }

    .overview-item {
      position: relative;
      overflow: hidden;
      padding: 12px 14px 11px;
      border-radius: 20px;
      border: 1px solid rgba(126, 162, 255, 0.18);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 250, 255, 0.96)),
        var(--app-surface);
    }

    .overview-item-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: baseline;
    }

    .overview-item-head strong {
      color: var(--app-text);
      font-size: 15px;
      line-height: 1.25;
      word-break: break-word;
    }

    .overview-item-head span {
      color: #1d4ed8;
      font-weight: 900;
      white-space: nowrap;
    }

    .overview-item-meta,
    .overview-item-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      color: var(--app-text-muted);
      font-size: 11px;
      line-height: 1.25;
    }

    .overview-item-meta {
      align-self: center;
    }

    .overview-item-stats {
      align-self: center;
      justify-content: flex-end;
      margin-top: 0;
    }

    .overview-item-stats span {
      padding: 4px 9px;
      border-radius: 999px;
      font-weight: 800;
      white-space: nowrap;
    }

    .summary-item {
      position: relative;
      overflow: hidden;
      padding: 14px 14px 13px;
      border-radius: 20px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(249, 251, 255, 0.94)),
        var(--app-surface);
      border: 1px solid rgba(126, 162, 255, 0.18);
      display: grid;
      gap: 5px;
    }

    .summary-item__icon {
      width: 40px;
      height: 40px;
      border-radius: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(37, 99, 235, 0.1);
      color: #2563eb;
      margin-bottom: 3px;
    }

    .summary-item .label {
      color: #64748b;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .summary-item .value {
      color: #0f172a;
      font-weight: 800;
      font-size: 15px;
      line-height: 1.35;
      word-break: break-word;
    }

    .result-empty-note {
      margin-top: 8px;
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(59, 130, 246, 0.08);
      color: var(--app-text-muted);
      font-size: 13px;
      border: 1px solid rgba(59, 130, 246, 0.14);
    }

    .details-panel {
      grid-column: 1;
      grid-row: 4;
      padding: 20px;
    }

    .history-panel { position: sticky; top: 78px; grid-column: 2; grid-row: 3 / span 2; max-height: calc(100vh - 96px); overflow: auto; }
    .history-head { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 22px 24px; border-bottom: 1px solid var(--app-border); }
    .history-title { display: flex; align-items: center; gap: 14px; }
    .history-title h2 { margin: 3px 0 4px; font-size: 22px; }
    .history-title p { margin: 0; color: var(--app-text-muted); font-size: 13px; }
    .history-mark { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 15px; color: #0f766e; background: color-mix(in srgb, #14b8a6 13%, var(--app-surface)); }
    .history-mark mat-icon { width: 27px; height: 27px; font-size: 27px; }
    .history-scope, .history-filters { display: inline-flex; gap: 4px; padding: 4px; border: 1px solid var(--app-border); border-radius: 12px; background: var(--app-surface); }
    .history-scope button, .history-filters button { display: inline-flex; align-items: center; gap: 6px; min-height: 35px; padding: 0 11px; color: var(--app-text-muted); border: 0; border-radius: 9px; background: transparent; font: inherit; font-size: 12px; font-weight: 800; cursor: pointer; }
    .history-scope button.active, .history-filters button.active { color: var(--app-accent); background: color-mix(in srgb, var(--app-accent) 11%, var(--app-surface)); box-shadow: 0 1px 4px rgba(15, 23, 42, .08); }
    .history-scope mat-icon { width: 17px; height: 17px; font-size: 17px; }
    .history-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 18px 24px 8px; }
    .history-stats > div { display: flex; align-items: center; gap: 11px; padding: 13px; border: 1px solid var(--app-border); border-radius: 14px; background: var(--app-surface); }
    .history-stats p { display: flex; flex-direction: column; gap: 2px; margin: 0; }
    .history-stats small { color: var(--app-text-muted); font-size: 10px; font-weight: 850; text-transform: uppercase; }
    .history-stats strong { font-size: 22px; }
    .stat-icon { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 11px; color: #2563eb; background: color-mix(in srgb, #2563eb 11%, transparent); }
    .stat-icon--month { color: #7c3aed; background: color-mix(in srgb, #7c3aed 11%, transparent); }
    .stat-icon--success { color: #15803d; background: color-mix(in srgb, #16a34a 11%, transparent); }
    .stat-icon--failed { color: #dc2626; background: color-mix(in srgb, #dc2626 10%, transparent); }
    .history-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 24px; }
    .history-search { display: flex; align-items: center; gap: 8px; width: min(420px, 100%); min-height: 42px; padding: 0 12px; border: 1px solid var(--app-border); border-radius: 12px; background: var(--app-surface); color: var(--app-text-muted); }
    .history-search:focus-within { border-color: var(--app-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-accent) 12%, transparent); }
    .history-search input { width: 100%; color: var(--app-text); border: 0; outline: 0; background: transparent; font: inherit; }
    .history-search input::placeholder { color: var(--app-text-muted); }
    .history-table-wrap { overflow-x: auto; margin: 0 24px 20px; border: 1px solid var(--app-border); border-radius: 14px; }
    .history-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .history-table th { padding: 11px 14px; color: var(--app-text-muted); background: var(--app-surface); font-size: 10px; letter-spacing: .06em; text-align: left; text-transform: uppercase; }
    .history-table td { padding: 12px 14px; color: var(--app-text-muted); border-top: 1px solid var(--app-border); }
    .history-table tbody tr:hover { background: color-mix(in srgb, var(--app-accent) 4%, transparent); }
    .file-cell, .user-cell { display: flex; align-items: center; gap: 9px; color: var(--app-text); white-space: nowrap; }
    .file-cell > span { display: grid; place-items: center; width: 31px; height: 31px; border-radius: 9px; color: var(--app-accent); background: color-mix(in srgb, var(--app-accent) 10%, transparent); }
    .file-cell mat-icon { width: 17px; height: 17px; font-size: 17px; }
    .user-cell i { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; color: var(--app-accent); background: color-mix(in srgb, var(--app-accent) 11%, transparent); font-size: 9px; font-style: normal; font-weight: 900; }
    .history-status { display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 999px; color: #15803d; background: color-mix(in srgb, #16a34a 10%, transparent); font-weight: 800; }
    .history-status i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .history-status--failed { color: #dc2626; background: color-mix(in srgb, #dc2626 9%, transparent); }
    .output-chip { display: inline-flex; align-items: center; gap: 5px; color: #b45309; font-weight: 800; }
    .output-chip mat-icon { width: 16px; height: 16px; font-size: 16px; }
    .output-chip--empty { color: var(--app-text-muted); font-weight: 600; }
    .history-empty { display: flex; min-height: 160px; align-items: center; justify-content: center; flex-direction: column; gap: 5px; color: var(--app-text-muted); }
    .history-empty mat-icon { color: var(--app-accent); }
    .history-empty strong { color: var(--app-text); }
    .history-pagination { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 24px; color: var(--app-text-muted); border-top: 1px solid var(--app-border); font-size: 11px; }
    .history-pagination div { display: flex; gap: 7px; }
    .history-pagination button { display: inline-flex; align-items: center; gap: 4px; min-height: 34px; padding: 0 10px; color: var(--app-accent); border: 1px solid var(--app-border); border-radius: 9px; background: var(--app-surface); font: inherit; font-weight: 800; cursor: pointer; }
    .history-pagination button:disabled { opacity: .45; cursor: default; }
    .history-pagination mat-icon { width: 17px; height: 17px; font-size: 17px; }
    .history-expand { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; padding: 0 11px; color: var(--app-accent); border: 1px solid color-mix(in srgb, var(--app-accent) 24%, var(--app-border)); border-radius: 10px; background: color-mix(in srgb, var(--app-accent) 7%, var(--app-surface)); font: inherit; font-size: 11px; font-weight: 850; cursor: pointer; }
    .history-expand mat-icon { width: 17px; height: 17px; font-size: 17px; }
    .history-expand:hover { background: color-mix(in srgb, var(--app-accent) 13%, var(--app-surface)); }
    .history-backdrop { position: fixed; inset: 0; z-index: 1200; border: 0; background: rgba(2, 6, 23, .58); backdrop-filter: blur(4px); }

    .history-panel:not(.history-panel--expanded) .history-head { align-items: stretch; flex-direction: column; gap: 13px; padding: 18px; }
    .history-panel:not(.history-panel--expanded) .history-title { align-items: flex-start; }
    .history-panel:not(.history-panel--expanded) .history-title p { font-size: 11px; }
    .history-panel:not(.history-panel--expanded) .history-mark { width: 42px; height: 42px; flex: 0 0 auto; }
    .history-panel:not(.history-panel--expanded) .history-expand { order: 3; width: 100%; }
    .history-panel:not(.history-panel--expanded) .history-scope { order: 2; width: 100%; }
    .history-panel:not(.history-panel--expanded) .history-scope button { flex: 1; justify-content: center; padding: 0 7px; }
    .history-panel:not(.history-panel--expanded) .history-stats { grid-template-columns: 1fr 1fr; gap: 8px; padding: 14px 18px 6px; }
    .history-panel:not(.history-panel--expanded) .history-stats > div { gap: 8px; padding: 10px; }
    .history-panel:not(.history-panel--expanded) .history-stats small { font-size: 8px; }
    .history-panel:not(.history-panel--expanded) .history-stats strong { font-size: 18px; }
    .history-panel:not(.history-panel--expanded) .stat-icon { width: 32px; height: 32px; }
    .history-panel:not(.history-panel--expanded) .stat-icon mat-icon { width: 18px; height: 18px; font-size: 18px; }
    .history-panel:not(.history-panel--expanded) .history-toolbar { padding: 12px 18px; }
    .history-panel:not(.history-panel--expanded) .history-search { display: none; }
    .history-panel:not(.history-panel--expanded) .history-filters { width: 100%; }
    .history-panel:not(.history-panel--expanded) .history-filters button { flex: 1; justify-content: center; padding: 0 6px; }
    .history-panel:not(.history-panel--expanded) .history-table-wrap { margin: 0 18px 15px; border: 0; overflow: visible; }
    .history-panel:not(.history-panel--expanded) .history-table,
    .history-panel:not(.history-panel--expanded) .history-table tbody { display: block; }
    .history-panel:not(.history-panel--expanded) .history-table thead { display: none; }
    .history-panel:not(.history-panel--expanded) .history-table tr { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px 10px; margin-bottom: 8px; padding: 11px; border: 1px solid var(--app-border); border-radius: 13px; background: var(--app-surface); }
    .history-panel:not(.history-panel--expanded) .history-table td { padding: 0; border: 0; }
    .history-panel:not(.history-panel--expanded) .history-file { grid-column: 1 / -1; padding-bottom: 8px; border-bottom: 1px solid var(--app-border); }
    .history-panel:not(.history-panel--expanded) .history-file strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .history-panel:not(.history-panel--expanded) .history-user { grid-column: 1 / -1; }
    .history-panel:not(.history-panel--expanded) .history-size,
    .history-panel:not(.history-panel--expanded) .history-output { display: none; }
    .history-panel:not(.history-panel--expanded) .history-date { align-self: center; font-size: 10px; }
    .history-panel:not(.history-panel--expanded) .history-result { justify-self: end; }

    .history-panel--expanded { position: fixed; z-index: 1201; inset: 5vh auto auto 50%; width: min(1120px, calc(100vw - 36px)); max-height: 90vh; transform: translateX(-50%); overflow: auto; box-shadow: 0 30px 90px rgba(2, 6, 23, .42); }
    .history-panel--expanded .history-head { position: sticky; top: 0; z-index: 2; background: var(--app-surface-elevated); }
    .history-panel--expanded .history-title { flex: 1; }
    .history-panel--expanded .history-expand { order: 2; }
    .history-panel--expanded .history-scope { order: 3; }
    .history-panel--expanded .history-table-wrap { max-height: 42vh; overflow: auto; }

    .details-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 18px;
    }

    .details-head h2 {
      font-size: 22px;
      margin-top: 0;
    }

    .details-head p {
      margin: 8px 0 0;
      color: var(--app-text-muted);
      line-height: 1.55;
      max-width: 900px;
    }

    .details-summary {
      min-width: 180px;
      padding: 12px 14px;
      border-radius: 16px;
      border: 1px solid var(--app-border);
      background: var(--app-surface);
      display: grid;
      gap: 4px;
      justify-items: start;
    }

    .details-summary span {
      color: var(--app-text-muted);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .details-summary strong {
      color: #0f172a;
      font-size: 20px;
    }

    .table-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--app-border);
      display: grid;
      gap: 14px;
    }

    .table-section-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
    }

    .table-section-head h3 {
      margin: 0;
      font-size: 18px;
      color: var(--app-text);
    }

    .table-section-head p {
      margin: 4px 0 0;
      color: var(--app-text-muted);
      font-size: 13px;
    }

    .eyebrow--soft {
      margin-bottom: 4px;
      color: #60a5fa;
    }

    .table-summary {
      min-width: 140px;
      padding: 12px 14px;
      border-radius: 16px;
      border: 1px solid var(--app-border);
      background: var(--app-surface);
      display: grid;
      gap: 4px;
      justify-items: start;
    }

    .table-summary span {
      color: var(--app-text-muted);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .table-summary strong {
      color: var(--app-text);
      font-size: 18px;
    }

    .subtable {
      display: grid;
      gap: 10px;
    }

    .table-scroll {
      width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
      border-radius: 16px;
      border: 1px solid var(--app-border);
      background: var(--app-surface);
    }

    .subtable-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .subtable-head h4 {
      margin: 0;
      color: var(--app-text);
      font-size: 15px;
    }

    .subtable-head span {
      color: var(--app-text-muted);
      font-size: 12px;
    }

    .result-table {
      width: 100%;
      min-width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      background: var(--app-surface);
    }

    .result-table--standard {
      min-width: 100%;
    }

    .result-table--configured {
      min-width: 100%;
    }

    .result-table thead th {
      background: rgba(59, 130, 246, 0.08);
      color: var(--app-text);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      text-align: left;
      padding: 12px 14px;
      white-space: nowrap;
    }

    .result-table tbody td {
      padding: 12px 14px;
      border-top: 1px solid var(--app-border);
      color: var(--app-text);
      vertical-align: top;
      font-size: 13px;
      line-height: 1.45;
    }

    .result-table tbody tr:hover td {
      background: rgba(59, 130, 246, 0.03);
    }

    .total-cell {
      font-weight: 800;
      color: var(--app-accent);
    }

    :host-context(html.theme-dark) .hero-signal span { color: #5eead4; }
    :host-context(html.theme-dark) .overview-item,
    :host-context(html.theme-dark) .summary-item {
      background: linear-gradient(180deg, color-mix(in srgb, #0f766e 8%, var(--app-surface-elevated)), var(--app-surface));
      border-color: var(--app-border);
    }
    :host-context(html.theme-dark) .overview-item-head span,
    :host-context(html.theme-dark) .summary-item .value,
    :host-context(html.theme-dark) .details-summary strong { color: var(--app-text); }
    :host-context(html.theme-dark) .summary-item .label { color: var(--app-text-muted); }
    :host-context(html.theme-dark) .error-box { color: #fca5a5; }

    @media (max-width: 1350px) {
      .page-shell { grid-template-columns: 1fr; }
      .page-header { grid-column: 1; grid-row: 1; }
      .tool-context { grid-column: 1; grid-row: 2; }
      .layout-grid {
        grid-column: 1;
        grid-row: 3;
      }
      .history-panel { position: relative; top: auto; grid-column: 1; grid-row: 4; max-height: none; }
      .details-panel { grid-column: 1; grid-row: 5; }
      .history-panel--expanded { position: fixed; top: 5vh; }
    }

    @media (max-width: 1024px) {
      .layout-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 768px) {
      .decryptor-hero {
        min-height: 0;
        padding: 20px;
        border-radius: 20px;
      }

      .page-header,
      .result-head {
        align-items: flex-start;
        flex-direction: column;
      }

      .hero-copy { align-items: flex-start; gap: 14px; }
      .hero-mark { width: 48px; height: 48px; flex-basis: 48px; border-radius: 15px; }
      .hero-mark mat-icon { width: 25px; height: 25px; font-size: 25px; }
      h1 { font-size: clamp(25px, 8vw, 34px); line-height: 1.08; }
      .hero-signal { width: 100%; min-width: 0; box-sizing: border-box; }

      .tool-context {
        display: grid;
        grid-template-columns: 1fr;
        justify-items: stretch;
        gap: 8px;
        padding: 12px;
      }

      .tool-context > div {
        width: 100%;
        min-width: 0;
        padding: 8px;
        box-sizing: border-box;
      }

      .tool-context .context-arrow { display: none; }

      .details-head {
        align-items: flex-start;
        flex-direction: column;
      }

      .upload-panel,
      .result-panel {
        padding: 14px;
        height: 100%;
        overflow: visible;
      }

      .details-panel {
        padding: 16px;
      }
      .history-head, .history-toolbar { align-items: stretch; flex-direction: column; }
      .history-scope { width: 100%; }
      .history-scope button { flex: 1; justify-content: center; }
      .history-stats { grid-template-columns: 1fr 1fr; padding: 15px; }
      .history-toolbar { padding: 10px 15px 14px; }
      .history-search { width: auto; }
      .history-table-wrap { margin: 0 15px 15px; border: 0; overflow: visible; }
      .history-table, .history-table tbody { display: block; }
      .history-table thead { display: none; }
      .history-table tr { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-bottom: 10px; padding: 13px; border: 1px solid var(--app-border); border-radius: 14px; background: var(--app-surface); }
      .history-table td { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0; border: 0; }
      .history-table td:first-child { grid-column: 1 / -1; padding-bottom: 9px; border-bottom: 1px solid var(--app-border); }
      .history-table td::before { content: attr(data-label); color: var(--app-text-muted); font-size: 9px; font-weight: 850; text-transform: uppercase; }
      .history-table td:first-child::before { display: none; }
      .history-pagination { align-items: stretch; flex-direction: column; padding: 11px 15px; }

      .dropzone {
        padding: 18px;
      }

      .actions { width: 100%; }
      .actions button { flex: 1 1 100%; }

      .result-summary {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .summary-item {
        min-height: 112px;
      }

      .overview-item {
        padding: 13px 14px 12px;
      }

      .table-section-head,
      .subtable-head {
        flex-direction: column;
        align-items: flex-start;
      }

      .table-scroll {
        border-radius: 14px;
      }

      .result-table--standard {
        min-width: 520px;
      }

      .result-table--configured {
        min-width: 860px;
      }
    }
  `]
})
export class EvolisDecryptorComponent implements OnInit {
  readonly auth = inject(AuthFacade);
  private readonly decryptorService = inject(EvolisDecryptorService);
  private readonly route = inject(ActivatedRoute);
  selectedFile: File | null = null;
  dragActive = false;
  processing = false;
  errorMessage = '';
  result: EvolisDecryptResponse | null = null;
  presentation: EvolisPresentation | null = null;
  historyScope: HistoryScope = this.route.snapshot.queryParamMap.get('history') === 'all'
    && this.auth.hasCapability('tools.evolis.audit') ? 'all' : 'mine';
  historySearch = '';
  historyStatus: 'All' | DecryptionStatus = 'All';
  historyExpanded = false;
  historyItems: EvolisDecryptionRun[] = [];
  historyMetrics: EvolisDecryptionMetrics = { total: 0, thisMonth: 0, successful: 0, failed: 0, failedThisMonth: 0 };
  historyPage = 1;
  readonly historyPageSize = 20;
  historyTotal = 0;
  historyLoading = false;
  private historySearchTimer: number | null = null;

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  private readonly expandedTables = new Set<number>();

  ngOnInit(): void {
    this.loadHistory();
  }

  get canViewAllHistory(): boolean {
    return this.auth.hasCapability('tools.evolis.audit');
  }

  get visibleHistory(): EvolisDecryptionRun[] {
    return this.historyItems;
  }

  get filteredHistory(): EvolisDecryptionRun[] {
    return this.historyItems;
  }

  get monthCount(): number {
    return this.historyMetrics.thisMonth;
  }

  get successCount(): number {
    return this.historyMetrics.successful;
  }

  get failedCount(): number {
    return this.historyMetrics.failed;
  }

  get historyPageCount(): number {
    return Math.max(1, Math.ceil(this.historyTotal / this.historyPageSize));
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.setFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragActive = true;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive = false;
    const file = event.dataTransfer?.files?.[0] ?? null;
    this.setFile(file);
  }

  decrypt(): void {
    if (!this.selectedFile || this.processing) {
      return;
    }

    this.processing = true;
    this.errorMessage = '';

    this.decryptorService.decrypt(this.selectedFile).subscribe({
      next: (response) => {
        this.result = response;
        this.presentation = parseEvolisPresentation(response.content);
        this.expandedTables.clear();
        this.processing = false;
        this.loadHistory();
      },
      error: (error) => {
        const status = error?.status as number | undefined;
        const backendMessage = error?.error?.error ?? error?.error?.message ?? error?.message;

        if (status === 401 || status === 403) {
          this.errorMessage = 'This tool is restricted to admins and the cpq-internal-tools role.';
        }
        else if (backendMessage) {
          this.errorMessage = backendMessage;
        }
        else if (status) {
          this.errorMessage = `Unable to decrypt the selected file. Server returned ${status}.`;
        }
        else {
          this.errorMessage = 'Unable to decrypt the selected file.';
        }

        this.processing = false;
        this.loadHistory();
      }
    });
  }

  downloadResult(): void {
    if (!this.result) {
      return;
    }

    this.decryptorService.downloadPdf(this.selectedFile!).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = this.result!.downloadFileName;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      error: (error) => {
        const status = error?.status as number | undefined;
        const backendMessage = error?.error?.error ?? error?.error?.message ?? error?.message;

        if (status === 401 || status === 403) {
          this.errorMessage = 'This tool is restricted to admins and the cpq-internal-tools role.';
        }
        else if (backendMessage) {
          this.errorMessage = backendMessage;
        }
        else if (status) {
          this.errorMessage = `Unable to generate the PDF document. Server returned ${status}.`;
        }
        else {
          this.errorMessage = 'Unable to generate the PDF document.';
        }
      }
    });
  }

  reset(): void {
    this.selectedFile = null;
    this.result = null;
    this.presentation = null;
    this.errorMessage = '';
    this.processing = false;
    this.expandedTables.clear();

    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  initials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('');
  }

  formatHistorySize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(bytes >= 102400 ? 0 : 1)} KB`;
  }

  setHistoryScope(scope: HistoryScope): void {
    if (scope === 'all' && !this.canViewAllHistory) return;
    this.historyScope = scope;
    this.historyPage = 1;
    this.loadHistory();
  }

  setHistoryStatus(status: 'All' | DecryptionStatus): void {
    this.historyStatus = status;
    this.historyPage = 1;
    this.loadHistory();
  }

  onHistorySearch(): void {
    if (this.historySearchTimer !== null) window.clearTimeout(this.historySearchTimer);
    this.historySearchTimer = window.setTimeout(() => {
      this.historyPage = 1;
      this.loadHistory();
    }, 250);
  }

  changeHistoryPage(direction: -1 | 1): void {
    const target = this.historyPage + direction;
    if (target < 1 || target > this.historyPageCount) return;
    this.historyPage = target;
    this.loadHistory();
  }

  private loadHistory(): void {
    this.historyLoading = true;
    const allUsers = this.historyScope === 'all' && this.canViewAllHistory;
    forkJoin({
      history: this.decryptorService.getHistory(allUsers, this.historyPage, this.historyPageSize, this.historySearch, this.historyStatus),
      metrics: this.decryptorService.getMetrics(allUsers)
    }).subscribe({
      next: result => {
        this.historyItems = result.history.items;
        this.historyTotal = result.history.total;
        this.historyMetrics = result.metrics;
        this.historyLoading = false;
      },
      error: () => {
        this.historyItems = [];
        this.historyTotal = 0;
        this.historyLoading = false;
      }
    });
  }

  private setFile(file: File | null): void {
    if (!file) {
      return;
    }

    this.selectedFile = file;
    this.result = null;
    this.presentation = null;
    this.errorMessage = '';
    this.expandedTables.clear();
  }

  isTableExpanded(index: number): boolean {
    return this.expandedTables.has(index);
  }

  toggleTable(index: number): void {
    if (this.expandedTables.has(index)) {
      this.expandedTables.delete(index);
      return;
    }

    this.expandedTables.add(index);
  }

  formatTableDate(value: string): string {
    if (value.length !== 8) {
      return value;
    }

    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
}
