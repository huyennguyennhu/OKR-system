import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OkrService, Objective, KeyResult } from '../../services/okr.service';

@Component({
  selector: 'app-okr-board',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Lớp phủ khóa trang trong suốt (không làm mờ, chặn tương tác khi đang tải) -->
    <div class="page-loading-overlay" *ngIf="loading"></div>

    <div class="okr-board-page">
      <!-- Tên trang + Subtitle -->
      <div class="page-top-bar mb-4">
        <h3 class="card-title mb-1" style="font-size: 18px; font-weight: 700;">
          OKR Board
        </h3>
        <p class="subtitle mb-0">
          Theo dõi tiến độ hoàn thành các Mục tiêu Chiến lược và kết quả đo lường Key Results tự động từ GitLab qua Activepieces.
        </p>
      </div>

      <!-- KPI Overview Metrics -->
      <div class="kpi-grid mb-3">
        <div class="kpi-card">
          <div class="kpi-icon bg-indigo"><i class="fa-solid fa-bullseye"></i></div>
          <div class="kpi-info">
            <span class="kpi-label">Tiến độ OKR Trung bình</span>
            <span class="kpi-value">{{ avgProgress }}%</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon bg-emerald"><i class="fa-solid fa-circle-check"></i></div>
          <div class="kpi-info">
            <span class="kpi-label">Key Results Đạt SLA</span>
            <span class="kpi-value">{{ keyResults.length }} / {{ keyResults.length }}</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon bg-sky"><i class="fa-solid fa-code-merge"></i></div>
          <div class="kpi-info">
            <span class="kpi-label">Sự kiện GitLab từ Activepieces</span>
            <span class="kpi-value">{{ eventCount }}</span>
          </div>
        </div>
      </div>

      <!-- Hiển thị loading chính giữa bảng OKR khi đang tải -->
      <div class="card text-center" style="padding: 3.5rem 1rem;" *ngIf="loading">
        <div class="table-loading-content">
          <div class="loading-spinner-circle"></div>
          <span>Đang tải bảng OKR...</span>
        </div>
      </div>

      <!-- Objectives & Key Results Cards (Chỉ hiển thị khi đã load xong) -->
      <ng-container *ngIf="!loading">
        <div class="card mb-4" *ngFor="let obj of objectives">
          <div class="card-header">
            <div class="obj-header-left">
              <span class="badge" [ngClass]="getBadgeClass(obj.level)">
                {{ obj.level | uppercase }}
              </span>
              <h3 class="card-title">{{ obj.title }}</h3>
            </div>
            <div class="obj-header-right">
              <span class="progress-number">{{ obj.progress }}%</span>
            </div>
          </div>

          <div class="progress-container mb-3">
            <div class="progress-bar" [style.width.%]="obj.progress" [ngClass]="getProgressColor(obj.progress)"></div>
          </div>

          <!-- Key Results Table -->
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Mã KR</th>
                  <th>Tên Key Result</th>
                  <th class="text-center">Đơn vị</th>
                  <th class="text-center">Ban đầu (Start)</th>
                  <th class="text-center">Hiện tại (Current)</th>
                  <th class="text-center">Mục tiêu (Target)</th>
                  <th>Tiến độ (% Progress)</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let kr of obj.key_results">
                  <td><span class="kr-code">{{ kr.kr_id }}</span></td>
                  <td>
                    <div class="kr-title-box">
                      <strong>{{ kr.title }}</strong>
                    </div>
                  </td>
                  <td class="text-center">{{ kr.unit }}</td>
                  <td class="text-center">{{ kr.start_value }}</td>
                  <td class="text-center">
                    <span class="current-value-badge">{{ kr.current_value }}</span>
                  </td>
                  <td class="text-center">{{ kr.expected_value }}</td>
                  <td>
                    <div class="progress-cell">
                      <div class="progress-container flex-1">
                        <div class="progress-bar" [style.width.%]="kr.progress" [ngClass]="getProgressColor(kr.progress || 0)"></div>
                      </div>
                      <span class="progress-text">{{ kr.progress }}%</span>
                    </div>
                  </td>
                </tr>
                <tr *ngIf="!obj.key_results || obj.key_results.length === 0">
                  <td colspan="7" class="text-center text-muted py-3">Chưa có Key Result nào. Hãy tạo mới!</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="p-4 text-center text-muted" *ngIf="objectives.length === 0">
          Chưa có Mục tiêu OKR nào. Hãy tạo mới!
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .kpi-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.03);
    }
    .kpi-icon {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      color: #fff;
    }
    .bg-indigo { background: #6366f1; }
    .bg-emerald { background: #10b981; }
    .bg-sky { background: #0284c7; }
    .kpi-info { display: flex; flex-direction: column; }
    .kpi-label { font-size: 13px; color: #64748b; font-weight: 500; }
    .kpi-value { font-size: 16px; font-weight: 700; color: #0f172a; }
    .obj-header-left { display: flex; align-items: center; gap: 0.75rem; }
    .progress-number { font-size: 16px; font-weight: 700; color: #4f46e5; }
    .kr-code { font-family: monospace; background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
    .current-value-badge { font-weight: 700; color: #0f172a; background: #f1f5f9; padding: 4px 8px; border-radius: 6px; font-size: 13px; }
    .progress-cell { display: flex; align-items: center; gap: 0.75rem; }
    .progress-text { font-weight: 600; font-size: 13px; width: 45px; text-align: right; }
    .text-center { text-align: center; }
    .mb-3 { margin-bottom: 0.75rem; }
    .mb-4 { margin-bottom: 1.25rem; }
    .py-3 { padding-top: 1rem; padding-bottom: 1rem; }
    .p-4 { padding: 1.5rem; }
    .flex-1 { flex: 1; }
  `]
})
export class OkrBoardComponent implements OnInit {
  objectives: Objective[] = [];
  keyResults: KeyResult[] = [];
  avgProgress = 0;
  eventCount = 0;
  loading = false;

  constructor(private okrService: OkrService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    forkJoin({
      objs: this.okrService.getObjectives().pipe(catchError(() => of([]))),
      krs: this.okrService.getKeyResults().pipe(catchError(() => of([]))),
      events: this.okrService.getGitLabEvents().pipe(catchError(() => of([])))
    }).subscribe({
      next: (res) => {
        this.objectives = res.objs || [];
        if (this.objectives.length > 0) {
          const total = this.objectives.reduce((acc, o) => acc + o.progress, 0);
          this.avgProgress = parseFloat((total / this.objectives.length).toFixed(1));
        }
        this.keyResults = res.krs || [];
        this.eventCount = (res.events || []).length;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  getBadgeClass(level: string): string {
    switch (level) {
      case 'company': return 'badge-info';
      case 'team': return 'badge-success';
      default: return 'badge-warning';
    }
  }

  getProgressColor(progress: number): string {
    if (progress >= 75) return 'success';
    if (progress >= 50) return 'warning';
    return 'danger';
  }
}
