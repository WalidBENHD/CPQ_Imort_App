import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DATASET_CATALOG, DatasetDefinition, DatasetRequirement, EntityType, PILOT_SCOPE } from '../../core/models/import.models';
import { ImportService } from '../../core/services/import.service';

@Component({
  selector: 'app-datasets',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">Dataset governance</div>
        <h1>Pilot Dataset Management</h1>
        <p class="page-intro">
          Manage the pilot dataset portfolio, ownership, template standards and current version for Saint-Marcellin PDU.
        </p>
      </div>
      <button mat-raised-button color="primary" routerLink="/import/new">
        <mat-icon>add</mat-icon> New Annual Submission
      </button>
    </div>

    <mat-card class="pilot-scope-card">
      <div>
        <div class="eyebrow">Pilot scope</div>
        <h2>{{ pilotScope.site }} - {{ pilotScope.productFamily }}</h2>
        <p>
          Two logical datasets are in scope: {{ pilotScope.dataDomains.join(' + ') }}.
          The process stays focused on one annual full snapshot, one category, and a required currency.
        </p>
      </div>
      <div class="pilot-scope-badges">
        <span class="pilot-chip" *ngFor="let chip of pilotChips">{{ chip }}</span>
      </div>
    </mat-card>

    <section class="portfolio-grid">
      <mat-card class="dataset-card" *ngFor="let dataset of datasetCatalog">
        <div class="dataset-top">
          <div class="dataset-icon">
            <mat-icon>{{ dataset.icon }}</mat-icon>
          </div>
          <div class="dataset-copy">
            <div class="dataset-name">{{ dataset.name }}</div>
            <div class="dataset-description">{{ dataset.description }}</div>
          </div>
          <span class="dataset-status" [class.dataset-status--active]="dataset.status === 'Active'">
            {{ dataset.status }}
          </span>
        </div>

        <div class="dataset-meta">
          <div class="dataset-meta-item">
            <span>Owner</span>
            <strong>{{ dataset.owner }}</strong>
          </div>
          <div class="dataset-meta-item">
            <span>Template</span>
            <strong>{{ dataset.template }}</strong>
          </div>
          <div class="dataset-meta-item">
            <span>Current version</span>
            <strong>{{ dataset.currentVersion }}</strong>
          </div>
        </div>

        <div class="dataset-actions">
          <button mat-stroked-button (click)="startImport(dataset)">
            <mat-icon>publish</mat-icon> Import version
          </button>
          <button mat-button color="primary" (click)="downloadTemplate(dataset)">
            <mat-icon>download</mat-icon> Download template
          </button>
        </div>

        <details class="dataset-details" *ngIf="getRequirement(dataset.key) as requirement">
          <summary>
            <span>View structure</span>
            <mat-icon>expand_more</mat-icon>
          </summary>

          <div class="dataset-details-copy">
            The field dictionary below shows the governed structure, validation expectation and rule severity for this dataset.
          </div>

          <div class="dataset-field-list">
            <div class="dataset-field-card" *ngFor="let row of structureRows(dataset.key)">
              <div class="dataset-field-card-head">
                <div>
                  <div class="dataset-field-name">
                    {{ row.name }}
                    <span class="badge" [class.badge-optional]="!row.required">
                      {{ row.required ? 'Required' : 'Optional' }}
                    </span>
                  </div>
                  <div class="dataset-example" *ngIf="row.example">Example: {{ row.example }}</div>
                </div>

                <div class="dataset-field-pills">
                  <span class="dataset-type">{{ row.dataType }}</span>
                  <span class="badge" [class.badge-warning]="row.severity.toLowerCase() !== 'error'">
                    {{ row.severity }}
                  </span>
                </div>
              </div>

              <div class="dataset-field-body">
                <div class="dataset-field-body-item">
                  <span class="dataset-field-label">Meaning</span>
                  <span class="dataset-meta-text">{{ row.description }}</span>
                </div>
                <div class="dataset-field-body-item">
                  <span class="dataset-field-label">Validation</span>
                  <span class="dataset-meta-text">{{ row.rule }}</span>
                </div>
              </div>
            </div>
          </div>
        </details>
      </mat-card>
    </section>
  `,
  styles: [`
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 24px;
    }
    .eyebrow {
      color: #2563eb;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }
    h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      color: #0f172a;
    }
    .page-intro {
      margin: 10px 0 0;
      max-width: 760px;
      color: #475569;
      line-height: 1.55;
    }
    .pilot-scope-card {
      margin-bottom: 16px;
      border: 1px solid #dbe4f0;
      box-shadow: none;
      border-radius: 16px;
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      background: linear-gradient(180deg, #ffffff, #f8fafc);
    }
    .pilot-scope-card h2 {
      margin: 0 0 6px;
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
    }
    .pilot-scope-card p {
      margin: 0;
      color: #475569;
      line-height: 1.5;
      max-width: 760px;
    }
    .pilot-scope-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }
    .pilot-chip {
      display: inline-flex;
      align-items: center;
      border: 1px solid #dbe4f0;
      background: #eff6ff;
      color: #1d4ed8;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .portfolio-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      align-items: start;
    }
    .dataset-card {
      border: 1px solid #dbe4f0;
      box-shadow: none;
      padding: 16px;
      display: grid;
      gap: 14px;
      background: linear-gradient(180deg, #ffffff, #f8fafc);
      align-self: start;
      height: fit-content;
    }
    .dataset-top {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 14px;
      align-items: start;
    }
    .dataset-icon {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background: linear-gradient(180deg, #eff6ff, #f8fafc);
      color: #2563eb;
      flex-shrink: 0;
    }
    .dataset-icon mat-icon { font-size: 22px; height: 22px; width: 22px; }
    .dataset-name {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .dataset-description {
      color: #475569;
      line-height: 1.45;
    }
    .dataset-status {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #475569;
      background: #f8fafc;
      border: 1px solid #dbe4f0;
      border-radius: 999px;
      padding: 6px 10px;
      white-space: nowrap;
    }
    .dataset-status--active {
      color: #166534;
      background: #ecfdf5;
      border-color: #bbf7d0;
    }
    .dataset-meta {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .dataset-meta-item {
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      min-width: 0;
    }
    .dataset-meta-item span {
      display: block;
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 800;
      letter-spacing: 0.04em;
      margin-bottom: 4px;
    }
    .dataset-meta-item strong {
      color: #0f172a;
      font-size: 14px;
      word-break: break-word;
    }
    .dataset-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .dataset-details {
      border: 1px solid #dbe4f0;
      border-radius: 14px;
      background: #ffffff;
      overflow: hidden;
    }

    .dataset-details[open] {
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
    }

    .dataset-details summary {
      list-style: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 14px;
      font-weight: 800;
      color: #1d4ed8;
      background: linear-gradient(180deg, #eff6ff, #ffffff);
    }

    .dataset-details summary::-webkit-details-marker {
      display: none;
    }

    .dataset-details summary mat-icon {
      transition: transform 0.2s ease;
    }

    .dataset-details[open] summary mat-icon {
      transform: rotate(180deg);
    }

    .dataset-details-copy {
      padding: 0 14px 10px;
      color: #475569;
      font-size: 13px;
      line-height: 1.5;
    }

    .dataset-field-list {
      border-top: 1px solid #e2e8f0;
      padding: 12px;
      display: grid;
      gap: 10px;
    }

    .dataset-field-card {
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: #f8fafc;
      padding: 12px;
      display: grid;
      gap: 10px;
    }

    .dataset-field-card-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }

    .dataset-field-pills {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    .dataset-field-body {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .dataset-field-body-item {
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .dataset-field-name {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      color: #0f172a;
      font-size: 13px;
      font-weight: 700;
    }

    .dataset-field-label {
      display: block;
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 800;
      letter-spacing: 0.04em;
    }

    .dataset-example,
    .dataset-meta-text {
      color: #475569;
      font-size: 12px;
      line-height: 1.45;
    }

    .dataset-type {
      display: inline-flex;
      width: fit-content;
      padding: 4px 8px;
      border-radius: 999px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge {
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      border: 1px solid #dbeafe;
      background: #eff6ff;
      color: #1d4ed8;
    }

    .badge-optional {
      border-color: #e2e8f0;
      background: #f8fafc;
      color: #475569;
    }

    .badge-warning {
      border-color: #fde68a;
      background: #fffbeb;
      color: #92400e;
    }
    .dataset-actions button {
      border-radius: 999px;
      min-height: 38px;
      font-weight: 700;
    }
    .dataset-actions mat-icon { margin-right: 4px; }

    @media (max-width: 960px) {
      .page-header {
        flex-direction: column;
        align-items: flex-start;
      }
      .pilot-scope-card {
        flex-direction: column;
      }
      .pilot-scope-badges {
        justify-content: flex-start;
      }
      .portfolio-grid,
      .dataset-meta,
      .dataset-field-body {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      h1 { font-size: 22px; }
      .portfolio-grid,
      .dataset-meta,
      .dataset-field-body {
        grid-template-columns: 1fr;
      }
      .dataset-card { padding: 14px; }
      .dataset-top { grid-template-columns: auto 1fr; }
      .dataset-status {
        grid-column: 1 / -1;
        justify-self: start;
      }
      .dataset-actions {
        flex-direction: column;
      }
      .dataset-actions button {
        width: 100%;
        justify-content: center;
      }
      .dataset-details summary {
        font-size: 14px;
      }
      .dataset-field-card-head {
        flex-direction: column;
      }
      .dataset-field-pills {
        justify-content: flex-start;
      }
    }
  `]
})
export class DatasetsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly importService = inject(ImportService);

  readonly pilotScope = PILOT_SCOPE;
  readonly pilotChips = [
    PILOT_SCOPE.site,
    PILOT_SCOPE.productFamily,
    ...PILOT_SCOPE.dataDomains,
    PILOT_SCOPE.submissionType,
    `Currency: ${PILOT_SCOPE.currency}`
  ];
  readonly datasetCatalog: DatasetDefinition[] = DATASET_CATALOG;
  requirementsByType: Partial<Record<EntityType, DatasetRequirement>> = {};

  ngOnInit(): void {
    this.importService.getDatasetRequirements().subscribe({
      next: (requirements) => {
        this.requirementsByType = requirements.reduce((acc, item) => {
          acc[item.entityTypeLabel] = item;
          return acc;
        }, {} as Partial<Record<EntityType, DatasetRequirement>>);
      }
    });
  }

  getRequirement(type: EntityType): DatasetRequirement | undefined {
    return this.requirementsByType[type];
  }

  structureRows(type: EntityType): Array<{
    name: string;
    required: boolean;
    dataType: string;
    description: string;
    example: string | null;
    rule: string;
    severity: string;
  }> {
    const requirement = this.getRequirement(type);
    if (!requirement) {
      return [];
    }

    return requirement.columns.map(column => {
      const rule = requirement.validationRules.find(item => item.field.toLowerCase() === column.name.toLowerCase());
      return {
        name: column.name,
        required: column.required,
        dataType: column.dataType,
        description: column.description,
        example: column.example,
        rule: rule ? this.displayRule(rule.field, rule.rule) : 'No additional validation rule defined.',
        severity: rule?.severity ?? (column.required ? 'Error' : 'Info')
      };
    });
  }

  displayRule(field: string, rule: string): string {
    if (field.toLowerCase() !== 'articlenumber') {
      return rule;
    }

    return /space/i.test(rule)
      ? rule
      : `${rule} No spaces are allowed.`;
  }

  startImport(dataset: DatasetDefinition) {
    this.router.navigate(['/import/new'], { queryParams: { dataset: dataset.key } });
  }

  downloadTemplate(dataset: DatasetDefinition) {
    this.importService.downloadTemplate(dataset.key).subscribe(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `CPQ_Dataset_Template_${dataset.fileNameFragment}.xlsx`;
      a.click();
    });
  }
}
