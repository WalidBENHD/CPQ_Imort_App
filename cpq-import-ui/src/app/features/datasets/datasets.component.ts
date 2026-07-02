import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DATASET_CATALOG, DatasetDefinition, DatasetRequirement, EntityType } from '../../core/models/import.models';
import { ImportService } from '../../core/services/import.service';

@Component({
  selector: 'app-datasets',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">Dataset governance</div>
        <h1>Dataset Management</h1>
        <p class="page-intro">
          Manage the dataset portfolio, ownership, template standards and current version for each business stream.
        </p>
      </div>
      <button mat-raised-button color="primary" routerLink="/import/new">
        <mat-icon>add</mat-icon> New Dataset Import
      </button>
    </div>

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

        <div class="dataset-requirements" *ngIf="getRequirement(dataset.key) as requirement">
          <div class="requirements-grid">
            <div>
              <div class="requirements-title">Required Columns</div>
              <ul class="requirements-list">
                <li *ngFor="let col of requirement.columns">
                  <span>
                    <strong>{{ col.name }}</strong>
                    <span class="badge" [class.badge-optional]="!col.required">
                      {{ col.required ? 'Required' : 'Optional' }}
                    </span>
                  </span>
                  <small>{{ col.dataType }} - {{ col.description }}</small>
                </li>
              </ul>
            </div>

            <div>
              <div class="requirements-title">Validation Rules</div>
              <ul class="requirements-list">
                <li *ngFor="let rule of requirement.validationRules">
                  <span>
                    <strong>{{ rule.field }}</strong>
                    <span class="badge" [class.badge-warning]="rule.severity.toLowerCase() !== 'error'">
                      {{ rule.severity }}
                    </span>
                  </span>
                  <small>{{ rule.rule }}</small>
                </li>
              </ul>
            </div>
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
    .portfolio-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .dataset-card {
      border: 1px solid #dbe4f0;
      box-shadow: none;
      padding: 16px;
    }
    .dataset-top {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 14px;
      align-items: start;
      margin-bottom: 16px;
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

    .dataset-requirements {
      margin-bottom: 16px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      border-radius: 12px;
      padding: 12px;
    }

    .requirements-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .requirements-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
      font-weight: 800;
      margin-bottom: 8px;
    }

    .requirements-list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 8px;
    }

    .requirements-list li {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 8px 10px;
      display: grid;
      gap: 4px;
      background: #f8fafc;
    }

    .requirements-list li > span {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #0f172a;
      font-size: 13px;
    }

    .requirements-list li small {
      color: #475569;
      line-height: 1.4;
      font-size: 12px;
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
      .portfolio-grid,
      .dataset-meta {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      h1 { font-size: 22px; }
      .portfolio-grid,
      .dataset-meta {
        grid-template-columns: 1fr;
      }
      .requirements-grid {
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
    }
  `]
})
export class DatasetsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly importService = inject(ImportService);

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
