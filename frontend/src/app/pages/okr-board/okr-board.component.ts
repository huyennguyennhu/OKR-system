import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OkrService, Objective, KeyResult, Space, Timeline, Team, Employee } from '../../services/okr.service';

@Component({
  selector: 'app-okr-board',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <!-- Lớp phủ khóa trang trong suốt khi đang tải (Không làm mờ) -->
    <div class="page-loading-overlay" *ngIf="loading"></div>

    <div class="okr-board-page">
      <!-- ======================================================== -->
      <!-- TẦNG 1: THANH ĐIỀU KHIỂN & BỘ LỌC ĐỘNG (HEADER & TOOLBAR) -->
      <!-- ======================================================== -->
      <div class="board-top-bar mb-4">
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
          <div>
            <h3 class="page-title mb-1">OKR Dashboard</h3>
            <p class="subtitle mb-0">
              Bảng điều khiển chiến lược và theo dõi tiến độ OKR tự động từ GitLab CI/CD qua Activepieces.
            </p>
          </div>

          <!-- Bộ chọn chu kỳ, không gian và làm mới -->
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <!-- Timeline Tree Dropdown -->
            <div class="custom-select-wrapper position-relative" style="min-width: 190px;">
              <button type="button" class="custom-select-trigger" (click)="toggleTimelineTreeDropdown($event)" [class.active]="isTimelineTreeDropdownOpen" title="Chọn Chu kỳ / Timeline">
                <span class="d-flex align-items-center gap-2 text-truncate">
                  <i class="fa-solid fa-calendar-days text-primary"></i>
                  <span class="text-truncate">{{ selectedTimelineTree }}</span>
                </span>
                <i class="fa-solid fa-chevron-down chevron-icon" [class.rotate]="isTimelineTreeDropdownOpen"></i>
              </button>

              <div class="custom-select-menu timeline-tree-dropdown-menu p-0" *ngIf="isTimelineTreeDropdownOpen" style="right: 0; min-width: 250px; z-index: 1060;">
                <div class="timeline-tree-scroll-container">
                  <div class="custom-option" [class.selected]="selectedTimelineId === 'all'" (click)="selectAllTimelines()">
                    <div class="d-flex align-items-center" style="margin-left: 22px;">
                      <i class="fa-solid fa-layer-group text-muted me-2" style="font-size: 13px;"></i>
                      <span class="option-label" [ngClass]="selectedTimelineId === 'all' ? 'fw-bold text-primary' : 'text-dark'">Tất cả Chu kỳ</span>
                    </div>
                  </div>

                  <ng-container *ngFor="let yearNode of timelineTreeNav">
                    <div class="custom-option" [class.selected]="isNavNodeSelected(yearNode.title)" (click)="selectTimelineTreeNode(yearNode)">
                      <div class="d-flex align-items-center" style="margin-left: 0px;">
                        <button type="button" class="toggle-btn" (click)="toggleNavNode(yearNode.id, $event)">
                          <i class="fa-solid" [ngClass]="isNavNodeCollapsed(yearNode.id) ? 'fa-chevron-right' : 'fa-chevron-down'"></i>
                        </button>
                        <i class="fa-solid fa-calendar-check text-muted me-2" style="font-size: 13px;"></i>
                        <span class="option-label fw-bold text-dark">{{ yearNode.title }}</span>
                      </div>
                    </div>

                    <ng-container *ngIf="!isNavNodeCollapsed(yearNode.id)">
                      <ng-container *ngFor="let qNode of yearNode.children">
                        <div class="custom-option" [class.selected]="isNavNodeSelected(qNode.title)" (click)="selectTimelineTreeNode(qNode, yearNode.title)">
                          <div class="d-flex align-items-center" style="margin-left: 15px;">
                            <button type="button" class="toggle-btn" (click)="toggleNavNode(qNode.id, $event)">
                              <i class="fa-solid" [ngClass]="isNavNodeCollapsed(qNode.id) ? 'fa-chevron-right' : 'fa-chevron-down'"></i>
                            </button>
                            <i class="fa-solid fa-calendar-day text-secondary me-2" style="font-size: 13px;"></i>
                            <span class="option-label" [ngClass]="isNavNodeSelected(qNode.title) ? 'fw-bold text-primary' : 'text-dark'">{{ qNode.title }}</span>
                          </div>
                        </div>

                        <ng-container *ngIf="!isNavNodeCollapsed(qNode.id)">
                          <div class="custom-option" *ngFor="let mNode of qNode.children" [class.selected]="isNavNodeSelected(mNode.title)" (click)="selectTimelineTreeNode(mNode, yearNode.title)">
                            <div class="d-flex align-items-center" style="margin-left: 32px;">
                              <i class="fa-regular fa-clock text-muted me-2" style="font-size: 13px;"></i>
                              <span class="option-label" [ngClass]="isNavNodeSelected(mNode.title) ? 'fw-bold text-primary' : 'text-dark'">{{ mNode.title }}</span>
                            </div>
                          </div>
                        </ng-container>
                      </ng-container>
                    </ng-container>
                  </ng-container>
                </div>
              </div>
            </div>

            <!-- Space Dropdown -->
            <div class="custom-select-wrapper position-relative" style="min-width: 200px;">
              <button type="button" class="custom-select-trigger" (click)="toggleSpaceDropdown($event)" [class.active]="isSpaceDropdownOpen">
                <span class="d-flex align-items-center gap-2 text-truncate">
                  <i class="fa-solid fa-shapes text-primary"></i>
                  <span class="text-truncate">{{ getSelectedSpaceLabel() }}</span>
                </span>
                <i class="fa-solid fa-chevron-down chevron-icon" [class.rotate]="isSpaceDropdownOpen"></i>
              </button>
              <div class="custom-select-menu" *ngIf="isSpaceDropdownOpen" style="right: 0; min-width: 220px; z-index: 1050;">
                <div class="custom-select-option" [class.selected]="selectedSpaceId === 'all'" (click)="selectSpace('all')">
                  <span class="d-flex align-items-center gap-2">
                    <i class="fa-solid fa-shapes text-muted"></i>
                    <span>Tất cả Không gian</span>
                  </span>
                  <i class="fa-solid fa-check check-icon" *ngIf="selectedSpaceId === 'all'"></i>
                </div>
                <div class="custom-select-option" *ngFor="let s of spaces" [class.selected]="selectedSpaceId === s.id" (click)="selectSpace(s.id)">
                  <span class="d-flex align-items-center gap-2">
                    <i class="fa-solid fa-layer-group text-primary"></i>
                    <span>{{ s.name }}</span>
                  </span>
                  <i class="fa-solid fa-check check-icon" *ngIf="selectedSpaceId === s.id"></i>
                </div>
              </div>
            </div>

            <!-- Nút Làm mới -->
            <button class="btn btn-outline-secondary btn-icon-only" (click)="loadData()" title="Làm mới dữ liệu">
              <i class="fa-solid fa-rotate" [class.fa-spin]="loading"></i>
            </button>
          </div>
        </div>

        <!-- Toolbar lọc cấp bậc, tìm kiếm và chuyển đổi chế độ xem -->
        <div class="card shadow-sm p-3 border-0">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <!-- Level Filter Pills -->
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <button type="button" class="filter-pill-btn" [class.active]="selectedLevelFilter === 'ALL'" (click)="setLevelFilter('ALL')">
                Tất cả Cấp bậc <span class="pill-counter">{{ objectives.length }}</span>
              </button>
              <button type="button" class="filter-pill-btn" [class.active]="selectedLevelFilter === 'COMPANY'" (click)="setLevelFilter('COMPANY')">
                <i class="fa-solid fa-building me-1"></i> Cấp Công ty <span class="pill-counter">{{ getLevelCount('COMPANY') }}</span>
              </button>
              <button type="button" class="filter-pill-btn" [class.active]="selectedLevelFilter === 'TEAM'" (click)="setLevelFilter('TEAM')">
                <i class="fa-solid fa-users me-1"></i> Cấp Đội ngũ <span class="pill-counter">{{ getLevelCount('TEAM') }}</span>
              </button>
              <button type="button" class="filter-pill-btn" [class.active]="selectedLevelFilter === 'PERSONAL'" (click)="setLevelFilter('PERSONAL')">
                <i class="fa-solid fa-user me-1"></i> Cấp Cá nhân <span class="pill-counter">{{ getLevelCount('PERSONAL') }}</span>
              </button>
            </div>

            <!-- Search + View Toggle -->
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <div class="board-search-wrapper">
                <input type="text" class="form-control form-control-sm board-search-input" placeholder="Tìm theo mục tiêu, mã KR..." [(ngModel)]="searchQuery">
                <button class="clear-btn" *ngIf="searchQuery" (click)="searchQuery = ''"><i class="fa-solid fa-xmark"></i></button>
              </div>

              <div class="btn-group view-switcher">
                <button type="button" class="btn btn-sm" [class.btn-primary]="viewMode === 'cards'" [class.btn-outline-secondary]="viewMode !== 'cards'" (click)="viewMode = 'cards'" title="Dạng Thẻ">
                  <i class="fa-solid fa-grip-vertical me-1"></i> Thẻ
                </button>
                <button type="button" class="btn btn-sm" [class.btn-primary]="viewMode === 'table'" [class.btn-outline-secondary]="viewMode !== 'table'" (click)="viewMode = 'table'" title="Dạng Bảng">
                  <i class="fa-solid fa-table-list me-1"></i> Bảng
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ======================================================== -->
      <!-- TẦNG 2: BỘ 3 THẺ KPI CỐT LÕI VÀNG (EXECUTIVE KPI GOLDEN TRIO) -->
      <!-- ======================================================== -->
      <div class="kpi-golden-trio-grid mb-4">
        <!-- KPI 1: Tiến độ Bình quân -->
        <div class="kpi-card shadow-sm h-100">
          <div class="kpi-card-header">
            <span class="kpi-title">Tiến độ OKR Bình quân</span>
            <div class="kpi-icon-box bg-gradient-primary">
              <i class="fa-solid fa-bullseye"></i>
            </div>
          </div>
          <div class="kpi-main-val">
            <span class="kpi-number">{{ avgProgress }}%</span>
            <span class="status-chip" [ngClass]="getHealthClass(avgProgress)">
              <i class="fa-solid" [ngClass]="avgProgress >= 75 ? 'fa-arrow-trend-up' : (avgProgress >= 50 ? 'fa-minus' : 'fa-arrow-trend-down')"></i>
              {{ getHealthLabel(avgProgress) }}
            </span>
          </div>
          <div class="kpi-progress-bar-bg mt-2">
            <div class="kpi-progress-bar-fill" [style.width.%]="avgProgress" [ngClass]="getProgressBarColor(avgProgress)"></div>
          </div>
          <div class="kpi-footer-note mt-2">
            Tổng hợp từ <strong>{{ filteredObjectives.length }} mục tiêu</strong> chu kỳ
          </div>
        </div>

        <!-- KPI 2: Tuân thủ SLA Đo lường -->
        <div class="kpi-card shadow-sm h-100">
          <div class="kpi-card-header">
            <span class="kpi-title">Tuân thủ SLA Đo lường</span>
            <div class="kpi-icon-box bg-gradient-success">
              <i class="fa-solid fa-shield-halved"></i>
            </div>
          </div>
          <div class="kpi-main-val">
            <span class="kpi-number">{{ slaComplianceRate }}%</span>
            <span class="status-chip chip-success" *ngIf="slaComplianceRate >= 90">
              <i class="fa-solid fa-circle-check"></i> Đạt chuẩn SLA
            </span>
            <span class="status-chip chip-warning" *ngIf="slaComplianceRate < 90">
              <i class="fa-solid fa-triangle-exclamation"></i> Cần cải thiện
            </span>
          </div>
          <div class="kpi-progress-bar-bg mt-2">
            <div class="kpi-progress-bar-fill bg-success" [style.width.%]="slaComplianceRate"></div>
          </div>
          <div class="kpi-footer-note mt-2">
            <strong>{{ achievedKrCount }} / {{ totalKrCount }}</strong> Key Results đạt SLA
          </div>
        </div>

        <!-- KPI 3: Sức khỏe Mục tiêu -->
        <div class="kpi-card shadow-sm h-100">
          <div class="kpi-card-header">
            <span class="kpi-title">Sức khỏe Mục tiêu</span>
            <div class="kpi-icon-box bg-gradient-warning">
              <i class="fa-solid fa-heart-pulse"></i>
            </div>
          </div>
          <div class="kpi-main-val">
            <div class="d-flex align-items-baseline gap-2">
              <span class="kpi-number text-success">{{ onTrackCount }}</span>
              <span class="text-muted" style="font-size: 13px;">Tốt</span>
              <span class="mx-1 text-muted">/</span>
              <span class="kpi-number text-warning">{{ atRiskCount }}</span>
              <span class="text-muted" style="font-size: 13px;">Chú ý</span>
              <span class="mx-1 text-muted">/</span>
              <span class="kpi-number text-danger">{{ behindCount }}</span>
              <span class="text-muted" style="font-size: 13px;">Chậm</span>
            </div>
          </div>
          <div class="segmented-bar mt-2">
            <div class="segment bg-success" [style.width.%]="onTrackPct" title="Tốt: {{ onTrackCount }}"></div>
            <div class="segment bg-warning" [style.width.%]="atRiskPct" title="Chú ý: {{ atRiskCount }}"></div>
            <div class="segment bg-danger" [style.width.%]="behindPct" title="Chậm: {{ behindCount }}"></div>
          </div>
          <div class="kpi-footer-note mt-2 d-flex justify-content-between">
            <span><i class="fa-solid fa-circle text-success me-1" style="font-size: 8px;"></i>{{ onTrackPct }}% Tốt</span>
            <span><i class="fa-solid fa-circle text-warning me-1" style="font-size: 8px;"></i>{{ atRiskPct }}% Chú ý</span>
            <span><i class="fa-solid fa-circle text-danger me-1" style="font-size: 8px;"></i>{{ behindPct }}% Chậm</span>
          </div>
        </div>
      </div>

      <!-- ======================================================== -->
      <!-- TẦNG 3: TRỰC QUAN HÓA CHIẾN LƯỢC & VINH DANH NHÂN SỰ      -->
      <!-- ======================================================== -->
      <div class="row g-3 mb-4">
        <!-- Khối 1: Biểu đồ Donut Sức khỏe Chiến lược -->
        <div class="col-12">
          <div class="card chart-card shadow-sm border-0">
            <div class="chart-header">
              <div>
                <h4 class="chart-title mb-1">Sức khỏe Chiến lược</h4>
                <p class="chart-subtitle mb-0">Phân bổ mục tiêu theo mức độ hoàn thành</p>
              </div>
              <span class="badge badge-light-secondary">{{ filteredObjectives.length }} OKRs</span>
            </div>

            <div class="chart-body d-flex align-items-center justify-content-center flex-wrap gap-5 py-4">
              <div class="donut-chart-container">
                <div class="conic-donut" [style.--on-track-pct]="onTrackPct" [style.--at-risk-pct]="atRiskPct">
                  <div class="donut-center">
                    <span class="donut-center-val">{{ filteredObjectives.length }}</span>
                    <span class="donut-center-sub">Mục tiêu</span>
                  </div>
                </div>
              </div>

              <div class="donut-legend">
                <div class="legend-item">
                  <div class="legend-left">
                    <div class="legend-dot bg-success"></div>
                    <span class="legend-label">Đúng hạn (>=75%)</span>
                  </div>
                  <div class="legend-right">
                    <strong class="legend-count text-success">{{ onTrackCount }}</strong>
                    <span class="legend-pct text-muted">({{ onTrackPct }}%)</span>
                  </div>
                </div>

                <div class="legend-item">
                  <div class="legend-left">
                    <div class="legend-dot bg-warning"></div>
                    <span class="legend-label">Cần chú ý (50-74%)</span>
                  </div>
                  <div class="legend-right">
                    <strong class="legend-count text-warning">{{ atRiskCount }}</strong>
                    <span class="legend-pct text-muted">({{ atRiskPct }}%)</span>
                  </div>
                </div>

                <div class="legend-item">
                  <div class="legend-left">
                    <div class="legend-dot bg-danger"></div>
                    <span class="legend-label">Chậm tiến độ (&lt;50%)</span>
                  </div>
                  <div class="legend-right">
                    <strong class="legend-count text-danger">{{ behindCount }}</strong>
                    <span class="legend-pct text-muted">({{ behindPct }}%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Khối 2: Bảng Vinh Danh Đóng Góp (Best Contributors) -->
        <div class="col-12">
          <div class="card chart-card shadow-sm border-0">
            <div class="chart-header">
              <div>
                <h4 class="chart-title mb-1">🏆 Bảng Vinh danh Đóng góp</h4>
                <p class="chart-subtitle mb-0">Top nhân sự xuất sắc theo tiến độ Key Results thực tế</p>
              </div>
              <span class="badge badge-light-primary"><i class="fa-solid fa-medal me-1"></i> Top Kỹ sư</span>
            </div>

            <div class="chart-body p-0 mt-2">
              <div class="table-responsive">
                <table class="table table-hover align-middle mb-0 leaderboard-table">
                  <tbody>
                    <tr *ngFor="let c of bestContributors">
                      <td class="text-center" style="width: 44px;">
                        <span class="rank-medal" style="font-size: 16px;">{{ c.medal }}</span>
                      </td>
                      <td style="width: 220px;">
                        <div class="d-flex align-items-center gap-2">
                          <span class="badge badge-emp-code">{{ c.displayCode }}</span>
                          <span class="emp-name fw-bold text-dark">{{ c.fullName }}</span>
                        </div>
                      </td>
                      <td style="width: 180px;">
                        <span class="d-flex align-items-center gap-1.5 text-muted">
                          <i class="fa-solid fa-users text-primary" style="font-size: 12px;"></i>
                          <span>{{ c.teamName }}</span>
                        </span>
                      </td>
                      <td style="width: 150px;">
                        <span class="text-muted"><strong class="text-dark">{{ c.krCount }}</strong> KRs cá nhân</span>
                      </td>
                      <td>
                        <div class="d-flex align-items-center gap-2.5" style="max-width: 220px;">
                          <div class="kr-progress-track flex-grow-1" style="height: 7px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                            <div class="kr-progress-bar" [style.width.%]="c.avgProgress" [ngClass]="getProgressBarColor(c.avgProgress)" style="height: 100%;"></div>
                          </div>
                          <span class="fw-bold" [ngClass]="getHealthTextClass(c.avgProgress)" style="min-width: 45px; text-align: right;">
                            {{ c.avgProgress }}%
                          </span>
                        </div>
                      </td>
                    </tr>
                    <tr *ngIf="bestContributors.length === 0">
                      <td colspan="5" class="text-center py-4 text-muted" style="font-size: 13px;">
                        <i class="fa-regular fa-user me-1"></i> Chưa có dữ liệu đóng góp cá nhân trong chu kỳ này.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ======================================================== -->
      <!-- TẦNG 4: BẢNG SO SÁNH HIỆU SUẤT ĐỘI NGŨ (TEAM PERFORMANCE)  -->
      <!-- ======================================================== -->
      <div class="card shadow-sm border-0 mb-4">
        <div class="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div>
            <h4 class="card-title mb-1" style="font-size: 16px; font-weight: 700; color: #1e293b;">
              Bảng So sánh Hiệu suất Đội ngũ
            </h4>
            <p class="subtitle mb-0">Đo lường tiến độ và mức độ tuân thủ cam kết SLA theo từng đội nhóm kỹ thuật</p>
          </div>
          <span class="badge badge-light-primary"><i class="fa-solid fa-users-gear me-1"></i> Hiệu suất nhóm</span>
        </div>

        <div class="table-container p-0">
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0 matrix-team-table">
              <thead>
                <tr>
                  <th style="min-width: 180px;">Đội ngũ</th>
                  <th style="min-width: 180px;">Tiến độ Bình quân</th>
                  <th class="text-center" style="width: 110px;">Đúng hạn (🟢)</th>
                  <th class="text-center" style="width: 110px;">Cần chú ý (🟡)</th>
                  <th class="text-center" style="width: 110px;">Chậm trễ (🔴)</th>
                  <th class="text-center" style="width: 150px;">Tuân thủ SLA</th>
                  <th class="text-center" style="min-width: 160px;">Trạng thái điều hành</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let tm of teamPerformanceMatrix">
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <span class="team-icon-circle"><i class="fa-solid fa-users text-primary"></i></span>
                      <div>
                        <strong class="text-dark">{{ tm.teamName }}</strong>
                        <div class="text-muted" style="font-size: 11.5px;">{{ tm.krCount }} Key Results</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="d-flex align-items-center gap-2" *ngIf="tm.krCount > 0">
                      <div class="kr-progress-track flex-1">
                        <div class="kr-progress-bar" [style.width.%]="tm.avgProgress" [ngClass]="getProgressBarColor(tm.avgProgress)"></div>
                      </div>
                      <span class="fw-bold" [ngClass]="getHealthTextClass(tm.avgProgress)" style="font-size: 13px; width: 45px; text-align: right;">
                        {{ tm.avgProgress }}%
                      </span>
                    </div>
                    <span class="text-muted" style="font-size: 12px;" *ngIf="tm.krCount === 0">—</span>
                  </td>
                  <td class="text-center">
                    <span class="badge badge-dot-val text-success" *ngIf="tm.krCount > 0">{{ tm.onTrack }}</span>
                    <span class="text-muted" *ngIf="tm.krCount === 0">—</span>
                  </td>
                  <td class="text-center">
                    <span class="badge badge-dot-val text-warning" *ngIf="tm.krCount > 0">{{ tm.atRisk }}</span>
                    <span class="text-muted" *ngIf="tm.krCount === 0">—</span>
                  </td>
                  <td class="text-center">
                    <span class="badge badge-dot-val text-danger" *ngIf="tm.krCount > 0">{{ tm.behind }}</span>
                    <span class="text-muted" *ngIf="tm.krCount === 0">—</span>
                  </td>
                  <td class="text-center">
                    <span class="fw-bold text-success" style="font-size: 13px;" *ngIf="tm.krCount > 0">
                      <i class="fa-solid fa-shield-halved text-success me-1"></i> {{ tm.slaRate }}%
                    </span>
                    <span class="text-muted" style="font-size: 12px;" *ngIf="tm.krCount === 0">—</span>
                  </td>
                  <td class="text-center">
                    <span class="status-chip" [ngClass]="tm.statusClass">
                      {{ tm.status }}
                    </span>
                  </td>
                </tr>

                <!-- Dòng Tổng cộng Toàn tổ chức (Total Row) -->
                <tr class="table-total-row">
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <span class="team-icon-circle bg-primary-light"><i class="fa-solid fa-building text-primary"></i></span>
                      <strong class="text-dark">Toàn tổ chức</strong>
                    </div>
                  </td>
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <div class="kr-progress-track flex-1">
                        <div class="kr-progress-bar bg-primary" [style.width.%]="totalTeamRow.avgProgress"></div>
                      </div>
                      <strong class="text-primary" style="font-size: 13px; width: 45px; text-align: right;">
                        {{ totalTeamRow.avgProgress }}%
                      </strong>
                    </div>
                  </td>
                  <td class="text-center fw-bold text-success">{{ totalTeamRow.onTrack }}</td>
                  <td class="text-center fw-bold text-warning">{{ totalTeamRow.atRisk }}</td>
                  <td class="text-center fw-bold text-danger">{{ totalTeamRow.behind }}</td>
                  <td class="text-center fw-bold text-success" style="font-size: 13px;">
                    <i class="fa-solid fa-shield-check text-success me-1"></i> {{ totalTeamRow.slaRate }}%
                  </td>
                  <td class="text-center">
                    <span class="status-chip chip-primary fw-bold">
                      {{ totalTeamRow.status }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ======================================================== -->
      <!-- TẦNG 5: DANH MỤC THẺ MỤC TIÊU & KEY RESULTS MỞ RỘNG       -->
      <!-- ======================================================== -->
      <div class="mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h4 class="mb-0" style="font-size: 16px; font-weight: 700; color: #1e293b;">
            Danh mục Mục tiêu & Key Results Chi tiết
          </h4>
          <p class="subtitle mb-0">Các chỉ số then chốt được cập nhật tự động từ hệ thống GitLab</p>
        </div>
        <span class="badge badge-light-secondary" style="font-size: 12px;">
          Hiển thị: {{ filteredObjectives.length }} / {{ objectives.length }} Mục tiêu
        </span>
      </div>

      <!-- Loading State -->
      <div class="card text-center p-5 mb-4 shadow-sm border-0" *ngIf="loading">
        <div class="table-loading-content">
          <div class="loading-spinner-circle"></div>
          <span class="mt-2 text-muted fw-semibold" style="font-size: 13px;">Đang cập nhật chỉ số OKR Dashboard...</span>
        </div>
      </div>

      <!-- Empty State -->
      <div class="card text-center p-5 mb-4 shadow-sm border-0" *ngIf="!loading && filteredObjectives.length === 0">
        <div class="empty-icon-box mb-3">
          <i class="fa-solid fa-bullseye text-muted"></i>
        </div>
        <h4 style="font-size: 16px; font-weight: 700; color: #1e293b;">Không tìm thấy mục tiêu nào phù hợp bộ lọc.</h4>
        <p class="text-muted mb-3" style="font-size: 13px; max-width: 480px; margin: 0 auto;">
          Không có mục tiêu nào trong chu kỳ <strong>{{ selectedTimelineTree }}</strong> và bộ lọc đã chọn. Hãy chuyển chu kỳ khác hoặc tạo mới trong Cài đặt OKR.
        </p>
        <div>
          <button class="btn btn-primary btn-sm px-3" routerLink="/objective-create">
            <i class="fa-solid fa-plus me-1"></i> Tạo Mục tiêu mới
          </button>
        </div>
      </div>

      <!-- CHẾ ĐỘ 1: DẠNG THẺ CHIẾN LƯỢC (EXECUTIVE CARDS) -->
      <ng-container *ngIf="!loading && viewMode === 'cards' && filteredObjectives.length > 0">
        <div class="row g-4">
          <div class="col-12" *ngFor="let obj of filteredObjectives">
            <div class="card okr-executive-card shadow-sm border-0">
              <!-- Header Thẻ Mục tiêu -->
              <div class="okr-card-header">
                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 w-100">
                  <div class="d-flex align-items-center gap-3 flex-wrap">
                    <span class="level-badge-pill" [ngClass]="getLevelBadgeClass(obj.level)">
                      <i class="fa-solid" [ngClass]="getLevelIcon(obj.level)"></i>
                      {{ getLevelName(obj.level) }}
                    </span>

                    <code class="obj-code-tag">{{ obj.objective_id }}</code>
                    <h4 class="obj-card-title mb-0">{{ obj.title }}</h4>
                  </div>

                  <div class="d-flex align-items-center gap-2.5">
                    <div class="assignee-pill" [title]="(obj.level || '').toUpperCase() === 'COMPANY' ? 'Phạm vi áp dụng' : 'Người / Đội ngũ phụ trách'">
                      <i class="fa-solid" [ngClass]="(obj.level || '').toUpperCase() === 'COMPANY' ? 'fa-building text-primary' : ((obj.level || '').toUpperCase() === 'PERSONAL' ? 'fa-user text-success' : 'fa-users text-primary')"></i>
                      <span>{{ getAssigneeLabel(obj) }}</span>
                    </div>

                    <span class="status-chip" [ngClass]="getHealthClass(obj.progress)">
                      <i class="fa-solid" [ngClass]="obj.progress >= 75 ? 'fa-circle-check' : (obj.progress >= 50 ? 'fa-triangle-exclamation' : 'fa-circle-xmark')"></i>
                      {{ getHealthLabel(obj.progress) }}
                    </span>

                    <span class="obj-big-pct" [ngClass]="getHealthTextClass(obj.progress)">
                      {{ obj.progress }}%
                    </span>

                    <!-- Nút Xem trên OKR Tree ngay trên Header thẻ -->
                    <a [routerLink]="['/okr-tree']" 
                       [queryParams]="{ highlight: obj.objective_id, timeline_id: obj.timeline_id || selectedTimelineId, space_id: obj.space_id || selectedSpaceId }" 
                       class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5 py-1 px-2.5 ms-1 header-tree-btn" 
                       style="font-size: 12px; font-weight: 600; border-radius: 6px; text-decoration: none;"
                       title="Xem trên OKR Tree">
                      <i class="fa-solid fa-sitemap"></i>
                      <span>Xem trên OKR Tree</span>
                      <i class="fa-solid fa-arrow-right" style="font-size: 10px;"></i>
                    </a>
                  </div>
                </div>

                <!-- Thanh Tiến độ chính -->
                <div class="obj-progress-bar-container mt-3">
                  <div class="obj-progress-bar-fill" [style.width.%]="obj.progress" [ngClass]="getProgressBarColor(obj.progress)"></div>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-1" style="font-size: 11.5px; color: #64748b;">
                  <span>Khởi điểm: <strong>{{ obj.start_value || 0 }}%</strong></span>
                  <span>Hiện tại: <strong [ngClass]="getHealthTextClass(obj.progress)">{{ obj.progress }}%</strong></span>
                  <span>Mục tiêu cam kết: <strong>{{ obj.expected_value || 100 }}%</strong></span>
                </div>
              </div>

              <!-- 1. KHỐI MỤC TIÊU CẤP ĐỘI NGŨ TRỰC THUỘC (NẾU CÓ) -->
              <div class="child-objectives-container border-top" *ngIf="getChildObjectives(obj).length > 0">
                <div class="px-4 py-2.5 bg-light-subtle d-flex align-items-center justify-content-between border-bottom">
                  <div class="d-flex align-items-center gap-2">
                    <span class="badge badge-light-primary"><i class="fa-solid fa-sitemap me-1"></i> Cấp Đội ngũ</span>
                    <strong class="text-dark" style="font-size: 13px;">
                      Mục tiêu Cấp Đội ngũ Trực thuộc ({{ getChildObjectives(obj).length }} Mục tiêu)
                    </strong>
                  </div>
                  <span class="text-muted" style="font-size: 11.5px;">Phân bổ mục tiêu chiến lược cho từng đội ngũ phụ trách</span>
                </div>

                <div class="table-responsive">
                  <table class="table table-hover align-middle mb-0 child-team-table">
                    <thead>
                      <tr>
                        <th style="width: 160px;">Mã Mục tiêu</th>
                        <th>Mục tiêu Cấp Đội ngũ & Đội ngũ phụ trách</th>
                        <th class="text-center" style="width: 110px;">Quy mô KR</th>
                        <th style="width: 200px;">Tiến độ Hoàn thành</th>
                        <th class="text-center" style="width: 140px;">Trạng thái</th>
                        <th class="text-center" style="width: 100px;">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody>
                      <ng-container *ngFor="let child of getChildObjectives(obj)">
                        <!-- Dòng thông tin Mục tiêu Đội ngũ -->
                        <tr class="child-row-clickable" (click)="toggleChildObj(child.objective_id)">
                          <td>
                            <div class="d-flex align-items-center gap-1.5">
                              <i class="fa-solid fa-chevron-right child-chevron me-1 text-primary" 
                                 [class.rotate-90]="isChildExpanded(child.objective_id)"></i>
                              <span class="badge badge-team-code">{{ child.objective_id }}</span>
                            </div>
                          </td>
                          <td>
                            <div class="d-flex flex-column gap-1.5">
                              <strong class="text-dark" style="font-size: 13px;">{{ child.title }}</strong>
                              <span class="text-muted d-flex align-items-center gap-1.5" style="font-size: 12px;">
                                <i class="fa-solid fa-users text-primary"></i>
                                {{ getAssigneeLabel(child) }}
                              </span>
                            </div>
                          </td>
                          <td class="text-center">
                            <span class="badge badge-light-secondary fw-semibold">
                              {{ child.key_results?.length || 0 }} KRs
                            </span>
                          </td>
                          <td>
                            <div class="d-flex align-items-center gap-2">
                              <div class="kr-progress-track flex-1">
                                <div class="kr-progress-bar" [style.width.%]="child.progress" [ngClass]="getProgressBarColor(child.progress)"></div>
                              </div>
                              <span class="fw-bold" [ngClass]="getHealthTextClass(child.progress)" style="font-size: 13px; width: 45px; text-align: right;">
                                {{ child.progress }}%
                              </span>
                            </div>
                          </td>
                          <td class="text-center">
                            <span class="status-chip" [ngClass]="getHealthClass(child.progress)">
                              <i class="fa-solid" [ngClass]="child.progress >= 75 ? 'fa-circle-check' : (child.progress >= 50 ? 'fa-triangle-exclamation' : 'fa-circle-xmark')"></i>
                              {{ getHealthLabel(child.progress) }}
                            </span>
                          </td>
                          <td class="text-center">
                            <div class="d-inline-flex align-items-center gap-2">
                              <button type="button" class="btn btn-sm btn-link p-0 text-primary text-decoration-none fw-semibold" style="font-size: 12px;">
                                {{ isChildExpanded(child.objective_id) ? 'Thu gọn' : 'Xem KRs' }}
                              </button>
                              <a [routerLink]="['/okr-tree']" 
                                 [queryParams]="{ highlight: child.objective_id, timeline_id: child.timeline_id || selectedTimelineId, space_id: child.space_id || selectedSpaceId }" 
                                 (click)="$event.stopPropagation()"
                                 class="btn btn-sm btn-outline-primary py-0.5 px-1.5" 
                                 style="font-size: 11px; border-radius: 4px;"
                                 title="Xem trên OKR Tree">
                                <i class="fa-solid fa-sitemap"></i>
                              </a>
                            </div>
                          </td>
                        </tr>

                        <!-- Bảng Key Results của Mục tiêu Đội ngũ khi mở rộng -->
                        <tr *ngIf="isChildExpanded(child.objective_id)" class="child-krs-expanded-row">
                          <td colspan="6" class="p-0 border-0 bg-light-subtle">
                            <div class="nested-krs-box m-3 p-3 bg-white rounded border shadow-2xs">
                              <div class="d-flex align-items-center justify-content-between mb-2">
                                <span class="fw-bold text-dark d-flex align-items-center gap-2" style="font-size: 12.5px;">
                                  <i class="fa-solid fa-list-check text-primary"></i>
                                  Key Results cấu thành thuộc <strong>{{ child.objective_id }}</strong>
                                </span>
                                <span class="badge badge-light-primary" style="font-size: 11px;">
                                  {{ child.key_results?.length || 0 }} Key Results
                                </span>
                              </div>

                              <div class="table-responsive">
                                <table class="table table-hover align-middle mb-0 kr-table">
                                  <thead>
                                    <tr>
                                      <th style="width: 130px;">Mã KR</th>
                                      <th>Kết quả Then chốt & PIC</th>
                                      <th class="text-center" style="width: 170px;">Đo lường</th>
                                      <th style="width: 220px;">Tiến độ Hoàn thành</th>
                                      <th class="text-center" style="width: 130px;">Đạt SLA</th>
                                      <th class="text-center" style="width: 150px;">Cơ chế Đo lường</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr *ngFor="let kr of child.key_results">
                                      <td><span class="kr-code-badge">{{ kr.kr_id }}</span></td>
                                      <td>
                                        <div class="kr-title-wrapper">
                                          <span class="kr-title-text">{{ kr.title }}</span>
                                          <span class="kr-assignee-sub">
                                            <i class="fa-regular fa-user me-1"></i>{{ getKrAssigneeLabel(kr) }}
                                          </span>
                                        </div>
                                      </td>
                                      <td class="text-center">
                                        <div class="metric-val-flow">
                                          <span class="val-start text-muted">{{ kr.start_value }}{{ kr.unit || '%' }}</span>
                                          <i class="fa-solid fa-arrow-right-long text-muted" style="font-size: 10px;"></i>
                                          <span class="val-current fw-bold" [ngClass]="getKrProgress(kr) >= 75 ? 'text-success' : 'text-primary'">
                                            {{ kr.current_value }}{{ kr.unit || '%' }}
                                          </span>
                                          <i class="fa-solid fa-arrow-right-long text-muted" style="font-size: 10px;"></i>
                                          <span class="val-target fw-semibold text-dark">{{ kr.expected_value }}{{ kr.unit || '%' }}</span>
                                        </div>
                                      </td>
                                      <td>
                                        <div class="d-flex align-items-center gap-2">
                                          <div class="kr-progress-track flex-1">
                                            <div class="kr-progress-bar" [style.width.%]="getKrProgress(kr)" [ngClass]="getProgressBarColor(getKrProgress(kr))"></div>
                                          </div>
                                          <span class="kr-pct-label fw-bold" [ngClass]="getHealthTextClass(getKrProgress(kr))">
                                            {{ getKrProgress(kr) }}%
                                          </span>
                                        </div>
                                      </td>
                                      <td class="text-center">
                                        <span class="sla-badge" [ngClass]="getKrSlaBadgeClass(kr)">
                                          <i class="fa-solid" [ngClass]="getKrProgress(kr) >= 75 ? 'fa-check' : (getKrProgress(kr) >= 50 ? 'fa-clock' : 'fa-triangle-exclamation')"></i>
                                          {{ getKrSlaLabel(kr) }}
                                        </span>
                                      </td>
                                      <td class="text-center">
                                        <span class="badge-source-gitlab" *ngIf="kr.flow_code" [title]="'Kịch bản: ' + kr.flow_code">
                                          <i class="fa-solid fa-robot text-primary me-1"></i> Activepieces
                                        </span>
                                        <span class="badge-source-manual" *ngIf="!kr.flow_code">
                                          <i class="fa-solid fa-hand text-muted me-1"></i> Thủ công
                                        </span>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </ng-container>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- 2. BẢNG KEY RESULTS TRỰC TIẾP (HIỂN THỊ NẾU CÓ KR TRỰC TIẾP, HOẶC KHÔNG CÓ MỤC TIÊU CON) -->
              <div class="table-container p-0" *ngIf="(obj.key_results && obj.key_results.length > 0) || getChildObjectives(obj).length === 0">
                <div class="px-4 py-2 bg-light border-top border-bottom d-flex align-items-center justify-content-between" *ngIf="getChildObjectives(obj).length > 0 && obj.key_results && obj.key_results.length > 0">
                  <strong class="text-dark" style="font-size: 13px;">Key Results trực tiếp</strong>
                </div>
                <table class="table table-hover align-middle mb-0 kr-table">
                  <thead>
                    <tr>
                      <th style="width: 130px;">Mã KR</th>
                      <th>Kết quả Then chốt & PIC</th>
                      <th class="text-center" style="width: 170px;">Đo lường</th>
                      <th style="width: 220px;">Tiến độ Hoàn thành</th>
                      <th class="text-center" style="width: 130px;">Đạt SLA</th>
                      <th class="text-center" style="width: 150px;">Cơ chế Đo lường</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let kr of obj.key_results">
                      <!-- 1. Mã KR -->
                      <td>
                        <span class="kr-code-badge">{{ kr.kr_id }}</span>
                      </td>

                      <!-- 2. Tên KR & PIC -->
                      <td>
                        <div class="kr-title-wrapper">
                          <span class="kr-title-text">{{ kr.title }}</span>
                          <span class="kr-assignee-sub">
                            <i class="fa-regular fa-user me-1"></i>{{ getKrAssigneeLabel(kr) }}
                          </span>
                        </div>
                      </td>

                      <!-- 3. Đo lường: Start -> Current -> Target -->
                      <td class="text-center">
                        <div class="metric-val-flow">
                          <span class="val-start text-muted" title="Ban đầu">{{ kr.start_value }}{{ kr.unit || '%' }}</span>
                          <i class="fa-solid fa-arrow-right-long text-muted" style="font-size: 10px;"></i>
                          <span class="val-current fw-bold" [ngClass]="getKrProgress(kr) >= 75 ? 'text-success' : 'text-primary'" title="Hiện tại">
                            {{ kr.current_value }}{{ kr.unit || '%' }}
                          </span>
                          <i class="fa-solid fa-arrow-right-long text-muted" style="font-size: 10px;"></i>
                          <span class="val-target fw-semibold text-dark" title="Chỉ tiêu">{{ kr.expected_value }}{{ kr.unit || '%' }}</span>
                        </div>
                      </td>

                      <!-- 4. Tiến độ % -->
                      <td>
                        <div class="d-flex align-items-center gap-2">
                          <div class="kr-progress-track flex-1">
                            <div class="kr-progress-bar" [style.width.%]="getKrProgress(kr)" [ngClass]="getProgressBarColor(getKrProgress(kr))"></div>
                          </div>
                          <span class="kr-pct-label fw-bold" [ngClass]="getHealthTextClass(getKrProgress(kr))">
                            {{ getKrProgress(kr) }}%
                          </span>
                        </div>
                      </td>

                      <!-- 5. Đạt SLA -->
                      <td class="text-center">
                        <span class="sla-badge" [ngClass]="getKrSlaBadgeClass(kr)">
                          <i class="fa-solid" [ngClass]="getKrProgress(kr) >= 75 ? 'fa-check' : (getKrProgress(kr) >= 50 ? 'fa-clock' : 'fa-triangle-exclamation')"></i>
                          {{ getKrSlaLabel(kr) }}
                        </span>
                      </td>

                      <!-- 6. Cơ chế đo lường -->
                      <td class="text-center">
                        <span class="badge-source-gitlab" *ngIf="kr.flow_code" [title]="'Kịch bản: ' + kr.flow_code">
                          <i class="fa-solid fa-robot text-primary me-1"></i> Activepieces
                        </span>
                        <span class="badge-source-manual" *ngIf="!kr.flow_code">
                          <i class="fa-solid fa-hand text-muted me-1"></i> Thủ công
                        </span>
                      </td>
                    </tr>

                    <tr *ngIf="getChildObjectives(obj).length === 0 && (!obj.key_results || obj.key_results.length === 0)">
                      <td colspan="6" class="text-center text-muted py-3" style="font-size: 13px;">
                        <i class="fa-regular fa-circle-question me-1"></i> Chưa có Mục tiêu con hay Key Result nào gắn với mục tiêu này.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Footer Thẻ -->
              <div class="okr-card-footer d-flex justify-content-between align-items-center px-4 py-2 border-top bg-light">
                <span class="text-muted" style="font-size: 12px;">
                  Chu kỳ áp dụng: <strong>{{ obj.timeline_id || selectedTimelineTree }}</strong>
                </span>
                <a [routerLink]="['/okr-tree']" 
                   [queryParams]="{ highlight: obj.objective_id, timeline_id: obj.timeline_id || selectedTimelineId, space_id: obj.space_id || selectedSpaceId }" 
                   class="text-primary text-decoration-none fw-semibold d-inline-flex align-items-center" 
                   style="font-size: 12px; cursor: pointer;">
                  Xem trên OKR Tree <i class="fa-solid fa-arrow-right ms-1"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- CHẾ ĐỘ 2: DẠNG BẢNG MA TRẬN TỔNG HỢP (COMPACT MATRIX) -->
      <ng-container *ngIf="!loading && viewMode === 'table' && filteredObjectives.length > 0">
        <div class="card shadow-sm border-0">
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0 okr-matrix-table">
              <thead>
                <tr>
                  <th style="width: 150px;">Mã & Cấp bậc</th>
                  <th>Mục tiêu Chiến lược (Objective)</th>
                  <th style="width: 180px;">Phụ trách</th>
                  <th class="text-center" style="width: 110px;">Số KRs</th>
                  <th style="width: 220px;">Tiến độ Tổng thể</th>
                  <th class="text-center" style="width: 140px;">Tình trạng</th>
                  <th class="text-center" style="width: 100px;">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let obj of filteredObjectives">
                  <td>
                    <div class="d-flex flex-column gap-1">
                      <code class="obj-code-tag">{{ obj.objective_id }}</code>
                      <span class="level-badge-pill" [ngClass]="getLevelBadgeClass(obj.level)" style="font-size: 10.5px; padding: 2px 6px;">
                        <i class="fa-solid" [ngClass]="getLevelIcon(obj.level)"></i>
                        {{ getLevelName(obj.level) }}
                      </span>
                    </div>
                  </td>
                  <td>
                    <strong class="text-dark" style="font-size: 13.5px;">{{ obj.title }}</strong>
                    <div class="text-muted" style="font-size: 11.5px;">Chu kỳ: {{ obj.timeline_id || selectedTimelineTree }}</div>
                  </td>
                  <td>
                    <span class="assignee-pill" [title]="(obj.level || '').toUpperCase() === 'COMPANY' ? 'Phạm vi áp dụng' : 'Người / Đội ngũ phụ trách'">
                      <i class="fa-solid" [ngClass]="(obj.level || '').toUpperCase() === 'COMPANY' ? 'fa-building text-primary' : ((obj.level || '').toUpperCase() === 'PERSONAL' ? 'fa-user text-success' : 'fa-users text-primary')"></i>
                      <span>{{ getAssigneeLabel(obj) }}</span>
                    </span>
                  </td>
                  <td class="text-center">
                    <span class="badge badge-light-primary fw-bold" style="font-size: 12px;">
                      {{ getAggregatedKrCount(obj) }} KRs
                    </span>
                  </td>
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <div class="kr-progress-track flex-1">
                        <div class="kr-progress-bar" [style.width.%]="obj.progress" [ngClass]="getProgressBarColor(obj.progress)"></div>
                      </div>
                      <span class="fw-bold" [ngClass]="getHealthTextClass(obj.progress)" style="font-size: 13px; width: 45px; text-align: right;">
                        {{ obj.progress }}%
                      </span>
                    </div>
                  </td>
                  <td class="text-center">
                    <span class="status-chip" [ngClass]="getHealthClass(obj.progress)">
                      {{ getHealthLabel(obj.progress) }}
                    </span>
                  </td>
                  <td class="text-center">
                    <a [routerLink]="['/okr-tree']" 
                       [queryParams]="{ highlight: obj.objective_id, timeline_id: obj.timeline_id || selectedTimelineId, space_id: obj.space_id || selectedSpaceId }" 
                       class="btn btn-sm btn-outline-primary py-1 px-2" 
                       title="Xem trên OKR Tree">
                      <i class="fa-solid fa-sitemap"></i>
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .okr-board-page {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      padding-bottom: 2rem;
    }
    .page-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }
    .subtitle {
      font-size: 13px;
      color: #64748b;
    }
    .badge-timeline-active {
      font-size: 12px;
      font-weight: 600;
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
      padding: 3px 10px;
      border-radius: 20px;
      display: inline-flex;
      align-items: center;
    }

    /* 1. KPI Golden Trio (3 Cards on 1 row) */
    .kpi-golden-trio-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
    }
    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.25rem;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.06);
    }
    .kpi-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .kpi-title {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .kpi-icon-box {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      color: #ffffff;
    }
    .bg-gradient-primary { background: linear-gradient(135deg, #4f46e5, #3b82f6); }
    .bg-gradient-success { background: linear-gradient(135deg, #10b981, #059669); }
    .bg-gradient-warning { background: linear-gradient(135deg, #f59e0b, #d97706); }
    .bg-gradient-info { background: linear-gradient(135deg, #06b6d4, #0284c7); }

    .kpi-main-val {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .kpi-number {
      font-size: 26px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
    }
    .kpi-progress-bar-bg {
      height: 6px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }
    .kpi-progress-bar-fill {
      height: 100%;
      border-radius: 4px;
      display: block;
      transition: width 0.4s ease;
    }
    .kpi-footer-note {
      font-size: 12px;
      color: #64748b;
    }

    /* Segmented Bar */
    .segmented-bar {
      display: flex;
      height: 6px;
      border-radius: 4px;
      overflow: hidden;
      background: #e2e8f0;
      gap: 2px;
    }
    .segmented-bar .segment {
      height: 100%;
      transition: width 0.3s ease;
    }

    /* Status Chips */
    .status-chip {
      font-size: 12px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 20px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .chip-success {
      background: #ecfdf5;
      color: #059669;
      border: 1px solid #a7f3d0;
    }
    .chip-warning {
      background: #fffbeb;
      color: #d97706;
      border: 1px solid #fde68a;
    }
    .chip-danger {
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fecaca;
    }
    .chip-primary {
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
    }
    .chip-neutral {
      background: #f1f5f9;
      color: #64748b;
      border: 1px solid #e2e8f0;
    }

    /* 2. Charts Section */
    .chart-card {
      border-radius: 12px;
      background: #ffffff;
      padding: 1.25rem 1.5rem;
      border: 1px solid #e2e8f0;
    }
    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #f1f5f9;
    }
    .chart-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }
    .chart-subtitle {
      font-size: 12.5px;
      color: #64748b;
    }

    /* Conic Donut Chart */
    .donut-chart-container {
      position: relative;
      width: 140px;
      height: 140px;
    }
    .conic-donut {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: conic-gradient(
        #10b981 0% calc(var(--on-track-pct, 70) * 1%),
        #f59e0b calc(var(--on-track-pct, 70) * 1%) calc((var(--on-track-pct, 70) + var(--at-risk-pct, 20)) * 1%),
        #ef4444 calc((var(--on-track-pct, 70) + var(--at-risk-pct, 20)) * 1%) 100%
      );
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .donut-center {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);
    }
    .donut-center-val {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1;
    }
    .donut-center-sub {
      font-size: 11.5px;
      color: #64748b;
      margin-top: 2px;
    }

    .donut-legend {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
      min-width: 260px;
      max-width: 380px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 9px 12px;
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 8px;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .legend-item:hover {
      background: #f1f5f9;
      border-color: #e2e8f0;
    }
    .legend-left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .legend-label {
      font-size: 13px;
      color: #1e293b;
      font-weight: 500;
      white-space: nowrap;
    }
    .legend-right {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .legend-count {
      font-size: 13px;
      font-weight: 700;
    }
    .legend-pct {
      font-size: 12px;
      color: #64748b;
    }

    /* Leaderboard Table */
    .leaderboard-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
    }
    .leaderboard-table td {
      padding: 10px 14px;
      vertical-align: middle;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
    }
    .leaderboard-table tr:last-child td {
      border-bottom: none;
    }
    .leaderboard-table tr:hover td {
      background-color: #f8fafc;
    }
    .badge-emp-code {
      font-size: 11px;
      font-weight: 600;
      background: #e0e7ff;
      color: #4338ca;
      padding: 2px 7px;
      border-radius: 4px;
    }
    .emp-name {
      font-size: 13px;
    }

    /* 3. Team Matrix Table */
    .matrix-team-table th {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 11px 16px;
    }
    .matrix-team-table td {
      padding: 12px 16px;
      font-size: 13px;
      border-bottom: 1px solid #f1f5f9;
    }
    .team-icon-circle {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #eff6ff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
    }
    .badge-dot-val {
      font-size: 13px;
      font-weight: 700;
    }
    .table-total-row {
      background: #f8fafc;
      font-weight: 600;
      border-top: 2px solid #e2e8f0;
    }
    .table-total-row td {
      border-bottom: none;
    }

    /* 4. Filter Toolbar */
    .filter-pill-btn {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      color: #475569;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .filter-pill-btn:hover {
      border-color: #3b82f6;
      color: #2563eb;
    }
    .filter-pill-btn.active {
      background: #eff6ff;
      border-color: #2563eb;
      color: #1d4ed8;
      font-weight: 600;
    }
    .pill-counter {
      background: #f1f5f9;
      color: #475569;
      font-size: 11px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 10px;
    }
    .filter-pill-btn.active .pill-counter {
      background: #dbeafe;
      color: #1d4ed8;
    }

    .board-search-wrapper {
      position: relative;
      min-width: 220px;
    }
    .board-search-input {
      padding-left: 10px;
      padding-right: 26px;
      border-radius: 6px;
      font-size: 13px;
      border: 1px solid #cbd5e1;
    }
    .board-search-wrapper .clear-btn {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      border: none;
      background: transparent;
      color: #94a3b8;
      font-size: 12px;
      cursor: pointer;
    }

    /* 5. Executive Cards View */
    .okr-executive-card {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      overflow: hidden;
      transition: box-shadow 0.2s ease;
    }
    .okr-executive-card:hover {
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08) !important;
    }
    .okr-card-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid #f1f5f9;
      background: #ffffff;
    }
    .obj-card-title {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
    }
    .obj-code-tag {
      font-size: 11.5px;
      font-weight: 600;
      background: #f1f5f9;
      color: #475569;
      padding: 2px 7px;
      border-radius: 4px;
    }
    .assignee-pill {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      color: #334155;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .obj-big-pct {
      font-size: 22px;
      font-weight: 800;
      line-height: 1;
    }
    .obj-progress-bar-container {
      height: 8px;
      background: #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
    }
    .obj-progress-bar-fill {
      height: 100%;
      border-radius: 6px;
      display: block;
      transition: width 0.4s ease;
    }

    /* Child Objectives Block */
    .child-objectives-container {
      background: #ffffff;
    }
    .child-team-table th {
      font-size: 11.5px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 9px 16px;
    }
    .child-team-table td {
      padding: 11px 16px;
      font-size: 13px;
      border-bottom: 1px solid #f1f5f9;
    }
    .child-row-clickable {
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .child-row-clickable:hover {
      background: #f8fafc;
    }
    .child-chevron {
      transition: transform 0.2s ease;
      display: inline-block;
    }
    .child-chevron.rotate-90 {
      transform: rotate(90deg);
    }
    .badge-team-code {
      font-size: 11px;
      font-weight: 600;
      background: #eff6ff;
      color: #2563eb;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid #dbeafe;
    }
    .nested-krs-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
    }

    /* KR Table inside Card */
    .kr-table th {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 10px 16px;
    }
    .kr-table td {
      padding: 12px 16px;
      font-size: 13px;
      border-bottom: 1px solid #f1f5f9;
    }
    .kr-code-badge {
      font-family: monospace;
      font-size: 12px;
      font-weight: 600;
      background: #eff6ff;
      color: #1d4ed8;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .kr-title-wrapper {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .kr-title-text {
      font-weight: 600;
      color: #1e293b;
      line-height: 1.35;
      font-size: 13px;
    }
    .kr-assignee-sub {
      font-size: 11.5px;
      color: #64748b;
    }
    .metric-val-flow {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      background: #f8fafc;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid #f1f5f9;
    }
    .kr-progress-track {
      height: 6px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
      min-width: 90px;
    }
    .kr-progress-bar {
      height: 100%;
      border-radius: 4px;
      display: block;
      transition: width 0.3s ease;
    }
    .kr-pct-label {
      font-size: 12.5px;
      width: 42px;
      text-align: right;
    }

    /* Core Progress & Status Colors */
    .bg-success,
    .kr-progress-bar.bg-success,
    .obj-progress-bar-fill.bg-success,
    .kpi-progress-bar-fill.bg-success,
    .segment.bg-success,
    .legend-dot.bg-success {
      background-color: #10b981 !important;
    }

    .bg-warning,
    .kr-progress-bar.bg-warning,
    .obj-progress-bar-fill.bg-warning,
    .kpi-progress-bar-fill.bg-warning,
    .segment.bg-warning,
    .legend-dot.bg-warning {
      background-color: #f59e0b !important;
    }

    .bg-danger,
    .kr-progress-bar.bg-danger,
    .obj-progress-bar-fill.bg-danger,
    .kpi-progress-bar-fill.bg-danger,
    .segment.bg-danger,
    .legend-dot.bg-danger {
      background-color: #ef4444 !important;
    }

    .bg-primary,
    .kr-progress-bar.bg-primary,
    .obj-progress-bar-fill.bg-primary,
    .kpi-progress-bar-fill.bg-primary,
    .segment.bg-primary,
    .legend-dot.bg-primary {
      background-color: #3157D5 !important;
    }

    .bg-info {
      background-color: #0284c7 !important;
    }

    .text-success { color: #10b981 !important; }
    .text-warning { color: #f59e0b !important; }
    .text-danger { color: #ef4444 !important; }
    .text-primary { color: #3157D5 !important; }
    .text-info { color: #0284c7 !important; }
    .text-muted { color: #64748b !important; }
    .sla-badge {
      font-size: 11.5px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .badge-source-gitlab {
      font-size: 11.5px;
      font-weight: 600;
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
      padding: 2px 8px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
    }
    .badge-source-manual {
      font-size: 11.5px;
      font-weight: 500;
      background: #f8fafc;
      color: #64748b;
      border: 1px solid #e2e8f0;
      padding: 2px 8px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
    }

    /* Level Badges */
    .level-badge-pill {
      font-size: 11.5px;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 20px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .level-pill-company {
      background: #f5f3ff;
      color: #7c3aed;
      border: 1px solid #ddd6fe;
    }
    .level-pill-team {
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
    }
    .level-pill-personal {
      background: #ecfdf5;
      color: #059669;
      border: 1px solid #a7f3d0;
    }

    /* Timeline Tree Dropdown Styles */
    .custom-select-wrapper .custom-select-trigger {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      color: #1e293b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      cursor: pointer;
    }
    .chevron-icon {
      font-size: 11px;
      color: #94a3b8;
      transition: transform 0.2s ease;
    }
    .chevron-icon.rotate {
      transform: rotate(180deg);
    }
    .timeline-tree-dropdown-menu {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      min-width: 250px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      z-index: 1060;
      overflow: hidden;
    }
    .timeline-tree-scroll-container {
      max-height: 290px;
      overflow-y: auto;
      padding: 6px 0;
    }
    .custom-option {
      padding: 6px 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      transition: background-color 0.15s ease;
      user-select: none;
    }
    .custom-option:hover {
      background-color: #f8fafc;
    }
    .custom-option.selected {
      background-color: #eff6ff;
    }
    .toggle-btn {
      font-size: 11px;
      color: #94a3b8;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 4px;
      margin-right: 4px;
      padding: 0;
      border: none;
      background: transparent;
    }
    .toggle-btn:hover {
      color: #3b82f6;
      background-color: #e2e8f0;
    }

    .custom-select-menu {
      position: absolute;
      top: calc(100% + 4px);
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
      padding: 6px;
    }
    .custom-select-option {
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .custom-select-option:hover {
      background: #f8fafc;
      color: #2563eb;
    }
    .custom-select-option.selected {
      background: #eff6ff;
      color: #2563eb;
      font-weight: 600;
    }

    .btn-icon-only {
      width: 36px;
      height: 36px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
    }
    .empty-icon-box {
      font-size: 38px;
    }

    /* Loading Overlay & Rotating Spinner */
    .page-loading-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: transparent !important;
      backdrop-filter: none !important;
      pointer-events: auto;
      cursor: wait;
    }
    .table-loading-content {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
    }
    .loading-spinner-circle {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid rgba(49, 87, 213, 0.18);
      border-top-color: #3157D5;
      animation: spinnerRotate 0.75s linear infinite;
      display: inline-block;
    }
    @keyframes spinnerRotate {
      to { transform: rotate(360deg); }
    }
  `]
})
export class OkrBoardComponent implements OnInit {
  objectives: Objective[] = [];
  keyResults: KeyResult[] = [];
  spaces: Space[] = [];
  timelines: Timeline[] = [];
  teams: Team[] = [];
  employees: Employee[] = [];

  private readonly now = new Date();
  private readonly curMonth = this.now.getMonth() + 1;
  private readonly curYear = this.now.getFullYear();

  selectedSpaceId = 'all';
  selectedTimelineId = `TL-M${this.curMonth}-${this.curYear}`;
  selectedTimelineTree = `Month ${this.curMonth}, ${this.curYear}`;
  selectedTimelineNodeTitle = `Month ${this.curMonth}`;

  selectedLevelFilter: 'ALL' | 'COMPANY' | 'TEAM' | 'PERSONAL' = 'ALL';
  searchQuery = '';
  viewMode: 'cards' | 'table' = 'cards';
  expandedChildObjectives: { [key: string]: boolean } = {};

  getChildObjectives(parentObj: Objective): Objective[] {
    if (!parentObj) return [];
    return this.objectives.filter(o => o.parent_id === parentObj.objective_id);
  }

  isChildExpanded(id: string): boolean {
    return this.expandedChildObjectives[id] !== false;
  }

  toggleChildObj(id: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.expandedChildObjectives[id] = !this.isChildExpanded(id);
  }

  getAggregatedKrCount(obj: Objective): number {
    if (obj.key_results && obj.key_results.length > 0) return obj.key_results.length;
    const children = this.getChildObjectives(obj);
    return children.reduce((acc, c) => acc + (c.key_results ? c.key_results.length : 0), 0);
  }

  isSpaceDropdownOpen = false;
  isTimelineTreeDropdownOpen = false;
  collapsedNavNodes: { [key: string]: boolean } = {
    [`TL-Q1-${new Date().getFullYear()}`]: Math.ceil((new Date().getMonth() + 1) / 3) !== 1,
    [`TL-Q2-${new Date().getFullYear()}`]: Math.ceil((new Date().getMonth() + 1) / 3) !== 2,
    [`TL-Q3-${new Date().getFullYear()}`]: Math.ceil((new Date().getMonth() + 1) / 3) !== 3,
    [`TL-Q4-${new Date().getFullYear()}`]: Math.ceil((new Date().getMonth() + 1) / 3) !== 4
  };

  avgProgress = 0;
  eventCount = 0;
  loading = true;

  constructor(private okrService: OkrService) {}

  ngOnInit(): void {
    this.loading = true;
    this.loadInitialData();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isSpaceDropdownOpen = false;
    this.isTimelineTreeDropdownOpen = false;
  }

  toggleSpaceDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isTimelineTreeDropdownOpen = false;
    this.isSpaceDropdownOpen = !this.isSpaceDropdownOpen;
  }

  toggleTimelineTreeDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isSpaceDropdownOpen = false;
    this.isTimelineTreeDropdownOpen = !this.isTimelineTreeDropdownOpen;
  }

  selectSpace(spaceId: string): void {
    this.selectedSpaceId = spaceId;
    this.isSpaceDropdownOpen = false;
    this.loadData();
  }

  getSelectedSpaceLabel(): string {
    if (this.selectedSpaceId === 'all') return 'Tất cả Không gian';
    const s = this.spaces.find(x => x.id === this.selectedSpaceId);
    return s ? s.name : this.selectedSpaceId;
  }

  selectTimelineTreeNode(node: any, parentTitle?: string): void {
    this.selectedTimelineId = node.id;
    this.selectedTimelineNodeTitle = node.title;
    if (parentTitle) {
      this.selectedTimelineTree = `${node.title}, ${parentTitle}`;
    } else {
      this.selectedTimelineTree = node.title;
    }
    this.isTimelineTreeDropdownOpen = false;
    this.loadData();
  }

  selectAllTimelines(): void {
    this.selectedTimelineId = 'all';
    this.selectedTimelineTree = 'Tất cả Chu kỳ';
    this.selectedTimelineNodeTitle = 'Tất cả Chu kỳ';
    this.isTimelineTreeDropdownOpen = false;
    this.loadData();
  }

  toggleNavNode(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.collapsedNavNodes[id] = !this.collapsedNavNodes[id];
  }

  isNavNodeCollapsed(id: string): boolean {
    return !!this.collapsedNavNodes[id];
  }

  isNavNodeSelected(title: string): boolean {
    if (!title) return false;
    if (this.selectedTimelineId === 'all' && title === 'Tất cả Chu kỳ') return true;
    if (this.selectedTimelineNodeTitle) {
      return this.selectedTimelineNodeTitle === title;
    }
    return !!(this.selectedTimelineTree && this.selectedTimelineTree.includes(title));
  }

  setLevelFilter(lvl: 'ALL' | 'COMPANY' | 'TEAM' | 'PERSONAL'): void {
    this.selectedLevelFilter = lvl;
  }

  getLevelCount(lvl: string): number {
    if (lvl.toUpperCase() === 'PERSONAL') {
      const explicit = this.objectives.filter(o => (o.level || '').toUpperCase() === 'PERSONAL' || (o.level || '').toUpperCase() === 'INDIVIDUAL').length;
      if (explicit > 0) return explicit;
      return this.objectives.filter(o => (o.key_results || []).some(kr => kr.assignee_id && kr.assignee_id.startsWith('EMP'))).length;
    }
    return this.objectives.filter(o => (o.level || '').toUpperCase() === lvl.toUpperCase()).length;
  }

  get filteredObjectives(): Objective[] {
    return this.objectives.filter(obj => {
      // 1. Level filter
      if (this.selectedLevelFilter !== 'ALL') {
        const lvl = (obj.level || '').toUpperCase();
        if (this.selectedLevelFilter === 'PERSONAL') {
          const hasPersonalObj = this.objectives.some(o => (o.level || '').toUpperCase() === 'PERSONAL' || (o.level || '').toUpperCase() === 'INDIVIDUAL');
          if (hasPersonalObj) {
            if (lvl !== 'PERSONAL' && lvl !== 'INDIVIDUAL') return false;
          } else {
            const hasPersonalKr = (obj.key_results || []).some(kr => kr.assignee_id && kr.assignee_id.startsWith('EMP'));
            if (!hasPersonalKr) return false;
          }
        } else if (lvl !== this.selectedLevelFilter) {
          return false;
        }
      }

      // 2. Search query filter
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase().trim();
        const matchTitle = (obj.title || '').toLowerCase().includes(q);
        const matchCode = (obj.objective_id || '').toLowerCase().includes(q);
        const matchAssignee = this.getAssigneeLabel(obj).toLowerCase().includes(q);
        const matchKr = (obj.key_results || []).some(kr => 
          (kr.title || '').toLowerCase().includes(q) || (kr.kr_id || '').toLowerCase().includes(q)
        );
        return matchTitle || matchCode || matchAssignee || matchKr;
      }
      return true;
    });
  }

  // --- KPI & Statistics Calculation ---
  get totalKrCount(): number {
    return this.keyResults.length;
  }

  get achievedKrCount(): number {
    return this.keyResults.filter(kr => this.getKrProgress(kr) >= 75).length;
  }

  get slaComplianceRate(): number {
    if (this.totalKrCount === 0) return 0;
    return parseFloat(((this.achievedKrCount / this.totalKrCount) * 100).toFixed(1));
  }

  get onTrackCount(): number {
    return this.filteredObjectives.filter(o => (o.progress || 0) >= 75).length;
  }

  get atRiskCount(): number {
    return this.filteredObjectives.filter(o => (o.progress || 0) >= 50 && (o.progress || 0) < 75).length;
  }

  get behindCount(): number {
    return this.filteredObjectives.filter(o => (o.progress || 0) < 50).length;
  }

  get onTrackPct(): number {
    const total = this.filteredObjectives.length;
    if (total === 0) return 0;
    return parseFloat(((this.onTrackCount / total) * 100).toFixed(1));
  }

  get atRiskPct(): number {
    const total = this.filteredObjectives.length;
    if (total === 0) return 0;
    return parseFloat(((this.atRiskCount / total) * 100).toFixed(1));
  }

  get behindPct(): number {
    const total = this.filteredObjectives.length;
    if (total === 0) return 0;
    return parseFloat(((this.behindCount / total) * 100).toFixed(1));
  }

  // --- TẦNG 3: Bảng Vinh danh Đóng góp (Best Contributors) ---
  get bestContributors(): Array<{
    employeeId: string;
    fullName: string;
    displayCode: string;
    teamName: string;
    krCount: number;
    avgProgress: number;
    medal: string;
  }> {
    const personalKrs = this.keyResults.filter(kr => kr.assignee_id && kr.assignee_id.startsWith('EMP'));
    const map = new Map<string, { employeeId: string; fullName: string; displayCode: string; teamName: string; krs: KeyResult[] }>();
    
    for (const kr of personalKrs) {
      if (!map.has(kr.assignee_id!)) {
        const emp = this.employees.find(e => e.employee_id === kr.assignee_id);
        map.set(kr.assignee_id!, {
          employeeId: kr.assignee_id!,
          fullName: emp ? emp.full_name : (kr.assignee_name || kr.assignee_id!),
          displayCode: emp ? emp.display_code : (kr.assignee_code || 'DEV'),
          teamName: kr.team_name || (emp ? this.getTeamName(emp.team_id) : 'Team'),
          krs: []
        });
      }
      map.get(kr.assignee_id!)!.krs.push(kr);
    }

    const medals = ['🥇', '🥈', '🥉', '🎖️', '🎖️'];
    return Array.from(map.values())
      .map(item => {
        const sum = item.krs.reduce((acc, k) => acc + this.getKrProgress(k), 0);
        const avgProgress = parseFloat((sum / item.krs.length).toFixed(1));
        return {
          employeeId: item.employeeId,
          fullName: item.fullName,
          displayCode: item.displayCode,
          teamName: item.teamName,
          krCount: item.krs.length,
          avgProgress,
          medal: ''
        };
      })
      .sort((a, b) => b.avgProgress - a.avgProgress)
      .slice(0, 5)
      .map((item, idx) => ({
        ...item,
        medal: medals[idx] || '🎖️'
      }));
  }

  // --- TẦNG 4: Bảng So sánh Hiệu suất Đội ngũ (Team Performance Matrix) ---
  get teamPerformanceMatrix(): Array<{
    teamId: string;
    teamName: string;
    krCount: number;
    avgProgress: number;
    onTrack: number;
    atRisk: number;
    behind: number;
    slaRate: number;
    status: string;
    statusClass: string;
  }> {
    const teamsList = this.teams.length > 0 ? this.teams : [
      { id: 'TEAM-BE', name: 'Team Backend', code: 'BE' },
      { id: 'TEAM-FE', name: 'Team Frontend', code: 'FE' },
      { id: 'TEAM-QA', name: 'Team QA', code: 'QA' }
    ];

    return teamsList.map(team => {
      const teamKrs = this.keyResults.filter(k => 
        k.team_id === team.id || 
        k.assignee_id === team.id || 
        (k.team_name && k.team_name.toLowerCase().includes(team.name.toLowerCase()))
      );
      const count = teamKrs.length;
      if (count === 0) {
        return {
          teamId: team.id || '',
          teamName: team.name,
          krCount: 0,
          avgProgress: 0,
          onTrack: 0,
          atRisk: 0,
          behind: 0,
          slaRate: 0,
          status: 'Chưa giao KR',
          statusClass: 'chip-neutral'
        };
      }
      const sum = teamKrs.reduce((acc, k) => acc + this.getKrProgress(k), 0);
      const avgProgress = parseFloat((sum / count).toFixed(1));
      const onTrack = teamKrs.filter(k => this.getKrProgress(k) >= 75).length;
      const atRisk = teamKrs.filter(k => this.getKrProgress(k) >= 50 && this.getKrProgress(k) < 75).length;
      const behind = teamKrs.filter(k => this.getKrProgress(k) < 50).length;
      const slaRate = parseFloat(((onTrack / count) * 100).toFixed(1));
      let status = '🟢 Vận hành xuất sắc';
      let statusClass = 'chip-success';
      if (slaRate < 80 || behind > 0) {
        status = '🟡 Cần hỗ trợ';
        statusClass = 'chip-warning';
      }
      if (slaRate < 50) {
        status = '🔴 Chậm tiến độ';
        statusClass = 'chip-danger';
      }
      return {
        teamId: team.id || '',
        teamName: team.name,
        krCount: count,
        avgProgress,
        onTrack,
        atRisk,
        behind,
        slaRate,
        status,
        statusClass
      };
    });
  }

  get totalTeamRow(): {
    avgProgress: number;
    onTrack: number;
    atRisk: number;
    behind: number;
    slaRate: number;
    status: string;
  } {
    const activeTeams = this.teamPerformanceMatrix.filter(t => t.krCount > 0);
    if (activeTeams.length === 0) {
      return { avgProgress: 0, onTrack: 0, atRisk: 0, behind: 0, slaRate: 0, status: 'Chưa có dữ liệu' };
    }
    const totalKrs = activeTeams.reduce((acc, t) => acc + t.krCount, 0);
    const totalOnTrack = activeTeams.reduce((acc, t) => acc + t.onTrack, 0);
    const totalAtRisk = activeTeams.reduce((acc, t) => acc + t.atRisk, 0);
    const totalBehind = activeTeams.reduce((acc, t) => acc + t.behind, 0);
    const weightedProgress = totalKrs > 0 ? parseFloat((activeTeams.reduce((acc, t) => acc + (t.avgProgress * t.krCount), 0) / totalKrs).toFixed(1)) : 0;
    const slaRate = totalKrs > 0 ? parseFloat(((totalOnTrack / totalKrs) * 100).toFixed(1)) : 0;
    return {
      avgProgress: weightedProgress,
      onTrack: totalOnTrack,
      atRisk: totalAtRisk,
      behind: totalBehind,
      slaRate,
      status: slaRate >= 90 ? '🛡️ Hệ thống Ổn định' : '⚠️ Cần Tối ưu'
    };
  }

  // --- KR Progress & Status Helper ---
  getKrProgress(kr: KeyResult): number {
    if (kr.progress !== undefined && kr.progress !== null && !isNaN(kr.progress)) {
      return parseFloat(Number(kr.progress).toFixed(1));
    }
    const s = Number(kr.start_value) || 0;
    const e = Number(kr.expected_value) || 100;
    const c = Number(kr.current_value) || 0;
    if (e === s) return 100;
    let p = 0;
    if (kr.direction === 'increase') {
      p = ((c - s) / (e - s)) * 100;
    } else {
      p = ((s - c) / (s - e)) * 100;
    }
    return Math.min(100, Math.max(0, parseFloat(p.toFixed(1))));
  }

  getKrSlaBadgeClass(kr: KeyResult): string {
    const p = this.getKrProgress(kr);
    if (p >= 75) return 'chip-success';
    if (p >= 50) return 'chip-warning';
    return 'chip-danger';
  }

  getKrSlaLabel(kr: KeyResult): string {
    const p = this.getKrProgress(kr);
    if (p >= 75) return 'Đạt SLA';
    if (p >= 50) return 'Cần chú ý';
    return 'Trễ SLA';
  }

  // --- Helpers for Display ---
  getHealthClass(progress: number): string {
    if (progress >= 75) return 'chip-success';
    if (progress >= 50) return 'chip-warning';
    return 'chip-danger';
  }

  getHealthTextClass(progress: number): string {
    if (progress >= 75) return 'text-success';
    if (progress >= 50) return 'text-warning';
    return 'text-danger';
  }

  getHealthLabel(progress: number): string {
    if (progress >= 75) return 'Đúng tiến độ';
    if (progress >= 50) return 'Cần chú ý';
    return 'Chậm tiến độ';
  }

  getProgressBarColor(progress: number): string {
    if (progress >= 75) return 'bg-success';
    if (progress >= 50) return 'bg-warning';
    return 'bg-danger';
  }

  getLevelBadgeClass(level: string): string {
    switch ((level || '').toUpperCase()) {
      case 'COMPANY': return 'level-pill-company';
      case 'TEAM': return 'level-pill-team';
      default: return 'level-pill-personal';
    }
  }

  getLevelIcon(level: string): string {
    switch ((level || '').toUpperCase()) {
      case 'COMPANY': return 'fa-building';
      case 'TEAM': return 'fa-users';
      default: return 'fa-user';
    }
  }

  getLevelName(level: string): string {
    switch ((level || '').toUpperCase()) {
      case 'COMPANY': return 'Công ty';
      case 'TEAM': return 'Đội ngũ';
      default: return 'Cá nhân';
    }
  }

  getAssigneeLabel(obj: Objective): string {
    const lvl = (obj.level || '').toUpperCase();
    if (lvl === 'COMPANY') return 'Toàn công ty';
    if (obj.team_name) return obj.team_name;
    if (obj.assignee_name && obj.assignee_name !== 'Chưa phân bổ') return obj.assignee_name;
    if (obj.assignee_id) {
      if (obj.assignee_id === 'TEAM-FE' || obj.assignee_id === 'FE-Team') return 'Team Frontend';
      if (obj.assignee_id === 'TEAM-BE' || obj.assignee_id === 'BE-Team') return 'Team Backend';
      if (obj.assignee_id === 'TEAM-QA') return 'Team QA';
      if (obj.assignee_id === 'Toàn công ty' || obj.assignee_id === 'COMPANY') return 'Toàn công ty';
      const tm = this.teams.find(t => t.id === obj.assignee_id || t.code === obj.assignee_id);
      if (tm) return tm.name;
      const emp = this.employees.find(e => e.employee_id === obj.assignee_id);
      if (emp) return emp.full_name;
      return obj.assignee_id;
    }
    if (lvl === 'TEAM') return 'Đội ngũ Kỹ thuật';
    return 'Đội ngũ Kỹ thuật';
  }

  getKrAssigneeLabel(kr: KeyResult): string {
    if (kr.assignee_name) return kr.assignee_name;
    if (kr.assignee_id) {
      const emp = this.employees.find(e => e.employee_id === kr.assignee_id || e.full_name === kr.assignee_id);
      if (emp) return emp.full_name;
      const tm = this.teams.find(t => t.id === kr.assignee_id || t.code === kr.assignee_id);
      if (tm) return tm.name;
      return kr.assignee_id;
    }
    return 'Team dev';
  }

  getTeamName(teamId: string): string {
    const tm = this.teams.find(t => t.id === teamId || t.code === teamId);
    return tm ? tm.name : 'Team';
  }

  // --- Timeline Tree Navigation Grouping ---
  get timelineTreeNav(): any[] {
    const list = this.timelines.filter(t => t.workspace_id === this.selectedSpaceId || !t.workspace_id || this.timelines.length > 0);
    const yearRoots = list.filter(t => !t.parent_id || t.level === 'year');
    if (yearRoots.length > 0) {
      const sortedYears = this.sortTimelineItems(yearRoots);
      return sortedYears.map(y => {
        const quarters = list.filter(t => t.parent_id === y.id || (t.level === 'quarter' && (t.title.includes(y.title) || t.id.includes(y.title))));
        const sortedQuarters = this.sortTimelineItems(quarters);
        return {
          ...y,
          children: sortedQuarters.map(q => {
            const months = list.filter(t => t.parent_id === q.id);
            const sortedMonths = this.sortTimelineItems(months);
            return {
              ...q,
              children: sortedMonths
            };
          })
        };
      });
    }

    return [
      {
        id: 'TL-YEAR-2026',
        title: '2026',
        level: 'year',
        children: [
          { id: 'TL-Q1-2026', title: 'Quarter 1', level: 'quarter', children: [
            { id: 'TL-M1-2026', title: 'Month 1' },
            { id: 'TL-M2-2026', title: 'Month 2' },
            { id: 'TL-M3-2026', title: 'Month 3' }
          ]},
          { id: 'TL-Q2-2026', title: 'Quarter 2', level: 'quarter', children: [
            { id: 'TL-M4-2026', title: 'Month 4' },
            { id: 'TL-M5-2026', title: 'Month 5' },
            { id: 'TL-M6-2026', title: 'Month 6' }
          ]},
          { id: 'TL-Q3-2026', title: 'Quarter 3', level: 'quarter', children: [
            { id: 'TL-M7-2026', title: 'Month 7' },
            { id: 'TL-M8-2026', title: 'Month 8' },
            { id: 'TL-M9-2026', title: 'Month 9' }
          ]},
          { id: 'TL-Q4-2026', title: 'Quarter 4', level: 'quarter', children: [
            { id: 'TL-M10-2026', title: 'Month 10' },
            { id: 'TL-M11-2026', title: 'Month 11' },
            { id: 'TL-M12-2026', title: 'Month 12' }
          ]}
        ]
      }
    ];
  }

  extractTimelineNumber(str: string): number {
    if (!str) return 0;
    const qMatch = str.match(/q(?:uarter)?\s*(\d+)/i);
    if (qMatch) return parseInt(qMatch[1], 10);
    const mMatch = str.match(/(?:m|month|tháng)\s*(\d+)/i);
    if (mMatch) return parseInt(mMatch[1], 10);
    const wMatch = str.match(/(?:w|week|tuần)\s*(\d+)/i);
    if (wMatch) return parseInt(wMatch[1], 10);
    const generic = str.match(/(\d+)/);
    return generic ? parseInt(generic[1], 10) : 0;
  }

  sortTimelineItems(items: any[]): any[] {
    if (!items || !items.length) return [];
    return [...items].sort((a, b) => {
      const dateA = a.start_date ? new Date(a.start_date).getTime() : NaN;
      const dateB = b.start_date ? new Date(b.start_date).getTime() : NaN;
      if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) {
        return dateA - dateB;
      }
      const numA = this.extractTimelineNumber(a.title || a.id || '');
      const numB = this.extractTimelineNumber(b.title || b.id || '');
      if (numA !== numB) {
        return numA - numB;
      }
      return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true });
    });
  }

  // --- Initial Data Load ---
  loadInitialData(): void {
    this.loading = true;
    forkJoin({
      spaces: this.okrService.getSpaces().pipe(catchError(() => of([]))),
      timelines: this.okrService.getTimelines().pipe(catchError(() => of([]))),
      teams: this.okrService.getTeams().pipe(catchError(() => of([]))),
      employees: this.okrService.getEmployees().pipe(catchError(() => of([])))
    }).subscribe({
      next: (res) => {
        this.spaces = res.spaces || [];
        if (this.spaces.length > 0 && this.selectedSpaceId === 'all') {
          this.selectedSpaceId = this.spaces[0].id;
        }

        this.teams = res.teams || [];
        this.employees = res.employees || [];

        this.timelines = res.timelines || [];
        if (this.timelines.length > 0) {
          const currentTl = this.findCurrentMonthTimeline(this.timelines);
          if (currentTl) {
            this.selectedTimelineId = currentTl.id;
            const parentYear = this.getTimelineYear(currentTl, this.timelines);
            this.selectedTimelineTree = `${currentTl.title}, ${parentYear}`;
            this.selectedTimelineNodeTitle = currentTl.title;
            if (currentTl.parent_id) {
              this.collapsedNavNodes[currentTl.parent_id] = false;
            }
          } else {
            this.selectedTimelineId = this.timelines[0].id;
            this.selectedTimelineTree = this.timelines[0].title;
            this.selectedTimelineNodeTitle = this.timelines[0].title;
          }
        }
        this.loadData();
      },
      error: () => {
        this.loadData();
      }
    });
  }

  findCurrentMonthTimeline(timelines: Timeline[]): Timeline | undefined {
    if (!timelines || timelines.length === 0) return undefined;
    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();
    const nowTime = now.getTime();

    const activeByDate = timelines.find(t => {
      if (!t.start_date || !t.end_date) return false;
      const s = new Date(t.start_date).getTime();
      const e = new Date(t.end_date).setHours(23, 59, 59, 999);
      const isMonth = t.level === 'month' || (t.title && /month|tháng/i.test(t.title));
      return !isNaN(s) && !isNaN(e) && s <= nowTime && nowTime <= e && isMonth;
    });
    if (activeByDate) return activeByDate;

    const targetId = `TL-M${curMonth}-${curYear}`;
    const byId = timelines.find(t => t.id === targetId || t.id === `TL-M0${curMonth}-${curYear}`);
    if (byId) return byId;

    const byMonthAndYear = timelines.find(t => {
      const titleLower = (t.title || '').toLowerCase();
      const isMonth = titleLower.includes(`month ${curMonth}`) || titleLower.includes(`tháng ${curMonth}`);
      const isYear = (t.id && t.id.includes(String(curYear))) || (t.start_date && t.start_date.includes(String(curYear)));
      return isMonth && isYear;
    });
    if (byMonthAndYear) return byMonthAndYear;

    const byMonthTitle = timelines.find(t => {
      const titleLower = (t.title || '').toLowerCase();
      return titleLower === `month ${curMonth}` || titleLower === `tháng ${curMonth}`;
    });
    if (byMonthTitle) return byMonthTitle;

    return undefined;
  }

  getTimelineYear(tl: Timeline, timelines: Timeline[]): string {
    if (tl.start_date) {
      const match = tl.start_date.match(/\b(20\d\d)\b/);
      if (match) return match[1];
    }
    if (tl.id) {
      const match = tl.id.match(/\b(20\d\d)\b/);
      if (match) return match[1];
    }
    let current: Timeline | undefined = tl;
    while (current && current.parent_id) {
      const parent = timelines.find(p => p.id === current!.parent_id);
      if (parent) {
        if (parent.level === 'year') return parent.title;
        const match = (parent.title || '').match(/\b(20\d\d)\b/);
        if (match) return match[1];
        current = parent;
      } else {
        break;
      }
    }
    return String(new Date().getFullYear());
  }

  loadData(): void {
    this.loading = true;
    forkJoin({
      objs: this.okrService.getObjectives(this.selectedSpaceId, this.selectedTimelineId).pipe(catchError(() => of([]))),
      krs: this.okrService.getKeyResults().pipe(catchError(() => of([]))),
      events: this.okrService.getGitLabEvents().pipe(catchError(() => of([])))
    }).subscribe({
      next: (res) => {
        this.objectives = res.objs || [];
        if (this.objectives.length > 0) {
          const total = this.objectives.reduce((acc, o) => acc + (o.progress || 0), 0);
          this.avgProgress = parseFloat((total / this.objectives.length).toFixed(1));
          
          const objIds = new Set(this.objectives.map(o => o.objective_id));
          this.keyResults = (res.krs || []).filter(kr => objIds.has(kr.objective_id));
        } else {
          this.avgProgress = 0;
          this.keyResults = [];
        }
        this.eventCount = (res.events || []).length;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }
}
