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
    <!-- Lớp phủ khóa trang trong suốt khi đang tải -->
    <div class="page-loading-overlay" *ngIf="loading"></div>

    <div class="okr-board-page">
      <!-- 1. Header Toolbar: Tiêu đề + Không gian & Chu kỳ -->
      <div class="board-header mb-4">
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            <div class="d-flex align-items-center gap-2 mb-1">
              <h3 class="page-title mb-0">OKR Dashboard</h3>
              <span class="badge-timeline-active">
                <i class="fa-solid fa-calendar-check text-primary me-1"></i>
                {{ selectedTimelineTree }}
              </span>
            </div>
            <p class="subtitle mb-0">
              Bảng điều khiển Chiến lược & Báo cáo Tiến độ Key Results tự động từ GitLab CI/CD qua Activepieces.
            </p>
          </div>

          <!-- Bộ lọc Toolbar góc phải -->
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

              <!-- Collapsible Tree Dropdown Panel -->
              <div class="custom-select-menu timeline-tree-dropdown-menu p-0" *ngIf="isTimelineTreeDropdownOpen" style="right: 0; min-width: 250px; z-index: 1060;">
                <div class="timeline-tree-scroll-container">
                  <!-- All Timelines Option -->
                  <div class="custom-option" [class.selected]="selectedTimelineId === 'all'" (click)="selectAllTimelines()">
                    <div class="d-flex align-items-center" style="margin-left: 22px;">
                      <i class="fa-solid fa-layer-group text-muted me-2" style="font-size: 13px;"></i>
                      <span class="option-label" [ngClass]="selectedTimelineId === 'all' ? 'fw-bold text-primary' : 'text-dark'">Tất cả Chu kỳ</span>
                    </div>
                  </div>

                  <ng-container *ngFor="let yearNode of timelineTreeNav">
                    <!-- Year Node (Root) -->
                    <div class="custom-option" [class.selected]="isNavNodeSelected(yearNode.title)" (click)="selectTimelineTreeNode(yearNode)">
                      <div class="d-flex align-items-center" style="margin-left: 0px;">
                        <button type="button" class="toggle-btn" (click)="toggleNavNode(yearNode.id, $event)">
                          <i class="fa-solid" [ngClass]="isNavNodeCollapsed(yearNode.id) ? 'fa-chevron-right' : 'fa-chevron-down'"></i>
                        </button>
                        <i class="fa-solid fa-calendar-check text-muted me-2" style="font-size: 14px;"></i>
                        <span class="option-label fw-bold text-dark">{{ yearNode.title }}</span>
                      </div>
                    </div>

                    <!-- Quarters (Child of Year) -->
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

                        <!-- Months (Child of Quarter) -->
                        <ng-container *ngIf="!isNavNodeCollapsed(qNode.id)">
                          <div class="custom-option" *ngFor="let mNode of qNode.children" [class.selected]="isNavNodeSelected(mNode.title)" (click)="selectTimelineTreeNode(mNode, yearNode.title)">
                            <div class="d-flex align-items-center" style="margin-left: 32px;">
                              <i class="fa-regular fa-clock text-muted me-2" style="font-size: 12px;"></i>
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
      </div>

      <!-- 2. KPI Executive Highlights (4 Cards) -->
      <div class="kpi-grid mb-4">
        <!-- KPI 1: Tiến độ Bình quân -->
        <div class="kpi-card shadow-sm">
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
          <!-- Mini Progress -->
          <div class="kpi-progress-bar-bg mt-2">
            <div class="kpi-progress-bar-fill" [style.width.%]="avgProgress" [ngClass]="getProgressBarColor(avgProgress)"></div>
          </div>
          <div class="kpi-footer-note mt-2">
            Tổng hợp từ <strong>{{ objectives.length }} mục tiêu</strong> chu kỳ này
          </div>
        </div>

        <!-- KPI 2: Tỷ lệ Đạt SLA -->
        <div class="kpi-card shadow-sm">
          <div class="kpi-card-header">
            <span class="kpi-title">Tuân thủ SLA Đo lường</span>
            <div class="kpi-icon-box bg-gradient-success">
              <i class="fa-solid fa-shield-halved"></i>
            </div>
          </div>
          <div class="kpi-main-val">
            <span class="kpi-number">{{ slaComplianceRate }}%</span>
            <span class="status-chip chip-success">
              <i class="fa-solid fa-circle-check"></i> Đạt SLA
            </span>
          </div>
          <div class="kpi-progress-bar-bg mt-2">
            <div class="kpi-progress-bar-fill bg-success" [style.width.%]="slaComplianceRate"></div>
          </div>
          <div class="kpi-footer-note mt-2">
            <strong>{{ achievedKrCount }} / {{ totalKrCount }}</strong> Key Results đạt chuẩn SLA
          </div>
        </div>

        <!-- KPI 3: Phân bổ Sức khỏe -->
        <div class="kpi-card shadow-sm">
          <div class="kpi-card-header">
            <span class="kpi-title">Sức khỏe Mục tiêu</span>
            <div class="kpi-icon-box bg-gradient-warning">
              <i class="fa-solid fa-heart-pulse"></i>
            </div>
          </div>
          <div class="kpi-main-val">
            <div class="d-flex align-items-baseline gap-2">
              <span class="kpi-number text-success">{{ onTrackCount }}</span>
              <span class="text-muted" style="font-size: 13px;">đúng hạn</span>
              <span class="mx-1 text-muted">/</span>
              <span class="kpi-number text-warning" style="font-size: 20px;">{{ atRiskCount }}</span>
              <span class="text-muted" style="font-size: 13px;">chú ý</span>
            </div>
          </div>
          <!-- Segmented Bar -->
          <div class="segmented-bar mt-2">
            <div class="segment bg-success" [style.width.%]="onTrackPct" title="Đúng hạn: {{ onTrackCount }}"></div>
            <div class="segment bg-warning" [style.width.%]="atRiskPct" title="Cần chú ý: {{ atRiskCount }}"></div>
            <div class="segment bg-danger" [style.width.%]="behindPct" title="Chậm tiến độ: {{ behindCount }}"></div>
          </div>
          <div class="kpi-footer-note mt-2 d-flex justify-content-between">
            <span><i class="fa-solid fa-circle text-success me-1" style="font-size: 8px;"></i>{{ onTrackCount }} Tốt</span>
            <span><i class="fa-solid fa-circle text-warning me-1" style="font-size: 8px;"></i>{{ atRiskCount }} Chú ý</span>
            <span><i class="fa-solid fa-circle text-danger me-1" style="font-size: 8px;"></i>{{ behindCount }} Chậm</span>
          </div>
        </div>

        <!-- KPI 4: Sự kiện Tự động hóa -->
        <div class="kpi-card shadow-sm">
          <div class="kpi-card-header">
            <span class="kpi-title">Sự kiện Đo lường GitLab</span>
            <div class="kpi-icon-box bg-gradient-info">
              <i class="fa-brands fa-gitlab"></i>
            </div>
          </div>
          <div class="kpi-main-val">
            <span class="kpi-number">{{ eventCount }}</span>
            <span class="badge badge-gitlab-tag">
              <i class="fa-solid fa-bolt text-warning me-1"></i> Realtime Hook
            </span>
          </div>
          <div class="kpi-progress-bar-bg mt-2">
            <div class="kpi-progress-bar-fill bg-info" style="width: 100%;"></div>
          </div>
          <div class="kpi-footer-note mt-2">
            Activepieces Engine tự động tính vào KR
          </div>
        </div>
      </div>

      <!-- 3. Biểu đồ Phân tích Chiến lược (Executive Charts Section) -->
      <div class="row g-3 mb-4">
        <!-- Biểu đồ 1: Donut Phân bổ Sức khỏe Chiến lược -->
        <div class="col-lg-5 col-md-12">
          <div class="card h-100 chart-card shadow-sm">
            <div class="chart-header">
              <div>
                <h5 class="chart-title mb-1">Phân bổ Sức khỏe Chiến lược</h5>
                <p class="chart-subtitle mb-0">Tỷ lệ các mục tiêu đạt chuẩn, cần chú ý hoặc chậm tiến độ</p>
              </div>
              <span class="badge badge-light-secondary">{{ filteredObjectives.length }} OKRs</span>
            </div>

            <div class="chart-body d-flex align-items-center justify-content-around flex-wrap gap-4 py-3">
              <!-- CSS Conic Donut Chart -->
              <div class="donut-chart-container">
                <div class="conic-donut" [style.--on-track-pct]="onTrackPct" [style.--at-risk-pct]="atRiskPct">
                  <div class="donut-center">
                    <span class="donut-center-val">{{ filteredObjectives.length }}</span>
                    <span class="donut-center-sub">Mục tiêu</span>
                  </div>
                </div>
              </div>

              <!-- Legend bên phải -->
              <div class="donut-legend d-flex flex-column gap-3">
                <div class="legend-item">
                  <div class="legend-dot bg-success"></div>
                  <div class="legend-info">
                    <div class="d-flex justify-content-between align-items-center gap-3">
                      <span class="legend-label">Đúng hạn (>=75%)</span>
                      <strong class="legend-count text-success">{{ onTrackCount }}</strong>
                    </div>
                    <span class="legend-pct text-muted">{{ onTrackPct }}% tổng số</span>
                  </div>
                </div>

                <div class="legend-item">
                  <div class="legend-dot bg-warning"></div>
                  <div class="legend-info">
                    <div class="d-flex justify-content-between align-items-center gap-3">
                      <span class="legend-label">Cần chú ý (50-74%)</span>
                      <strong class="legend-count text-warning">{{ atRiskCount }}</strong>
                    </div>
                    <span class="legend-pct text-muted">{{ atRiskPct }}% tổng số</span>
                  </div>
                </div>

                <div class="legend-item">
                  <div class="legend-dot bg-danger"></div>
                  <div class="legend-info">
                    <div class="d-flex justify-content-between align-items-center gap-3">
                      <span class="legend-label">Chậm tiến độ (<50%)</span>
                      <strong class="legend-count text-danger">{{ behindCount }}</strong>
                    </div>
                    <span class="legend-pct text-muted">{{ behindPct }}% tổng số</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Biểu đồ 2: Thanh Tiến độ theo Cấp bậc (Progress by Hierarchy Level) -->
        <div class="col-lg-7 col-md-12">
          <div class="card h-100 chart-card shadow-sm">
            <div class="chart-header">
              <div>
                <h5 class="chart-title mb-1">Tiến độ theo Cấp bậc Phân quyền</h5>
                <p class="chart-subtitle mb-0">So sánh tiến độ thực hiện giữa Cấp Công ty, Đội ngũ và Cá nhân</p>
              </div>
              <span class="badge badge-light-primary"><i class="fa-solid fa-chart-simple me-1"></i> Đa tầng</span>
            </div>

            <div class="chart-body d-flex flex-column justify-content-around py-2 gap-3">
              <!-- Level 1: Company -->
              <div class="level-progress-row">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <span class="level-title d-flex align-items-center gap-2">
                    <span class="level-icon-badge badge-company"><i class="fa-solid fa-building"></i></span>
                    <strong style="color: #1e293b;">Cấp Công ty (Company)</strong>
                    <span class="badge badge-light-secondary ms-1">{{ getLevelCount('COMPANY') }} mục tiêu</span>
                  </span>
                  <div class="d-flex align-items-center gap-2">
                    <span class="progress-pill-pct">{{ companyAvgProgress }}%</span>
                  </div>
                </div>
                <div class="level-progress-bar-wrapper">
                  <div class="level-bar-fill bg-company-gradient" [style.width.%]="companyAvgProgress"></div>
                </div>
              </div>

              <!-- Level 2: Team -->
              <div class="level-progress-row">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <span class="level-title d-flex align-items-center gap-2">
                    <span class="level-icon-badge badge-team"><i class="fa-solid fa-users"></i></span>
                    <strong style="color: #1e293b;">Cấp Đội ngũ (Team / Squad)</strong>
                    <span class="badge badge-light-secondary ms-1">{{ getLevelCount('TEAM') }} mục tiêu</span>
                  </span>
                  <div class="d-flex align-items-center gap-2">
                    <span class="progress-pill-pct">{{ teamAvgProgress }}%</span>
                  </div>
                </div>
                <div class="level-progress-bar-wrapper">
                  <div class="level-bar-fill bg-team-gradient" [style.width.%]="teamAvgProgress"></div>
                </div>
              </div>

              <!-- Level 3: Individual -->
              <div class="level-progress-row">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <span class="level-title d-flex align-items-center gap-2">
                    <span class="level-icon-badge badge-personal"><i class="fa-solid fa-user"></i></span>
                    <strong style="color: #1e293b;">Cấp Cá nhân (Individual)</strong>
                    <span class="badge badge-light-secondary ms-1">{{ getLevelCount('PERSONAL') }} mục tiêu</span>
                  </span>
                  <div class="d-flex align-items-center gap-2">
                    <span class="progress-pill-pct">{{ personalAvgProgress }}%</span>
                  </div>
                </div>
                <div class="level-progress-bar-wrapper">
                  <div class="level-bar-fill bg-personal-gradient" [style.width.%]="personalAvgProgress"></div>
                </div>
              </div>

              <!-- Footer cam kết tự động -->
              <div class="chart-summary-bar d-flex align-items-center justify-content-between pt-2 border-top">
                <span class="small text-muted d-flex align-items-center gap-1">
                  <i class="fa-solid fa-circle-info text-primary"></i>
                  Độ trễ cập nhật: <strong>Thời gian thực (Real-time Webhook)</strong>
                </span>
                <span class="small fw-semibold text-primary">
                  100% đo lường tự động từ SLA Git
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. Filter Toolbar & View Mode Switcher -->
      <div class="board-filter-bar card shadow-sm mb-4 p-3">
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <!-- Level Filter Pills -->
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <button type="button" class="filter-pill-btn" [class.active]="selectedLevelFilter === 'ALL'" (click)="setLevelFilter('ALL')">
              Tất cả Cấp bậc <span class="pill-counter">{{ objectives.length }}</span>
            </button>
            <button type="button" class="filter-pill-btn" [class.active]="selectedLevelFilter === 'COMPANY'" (click)="setLevelFilter('COMPANY')">
              <i class="fa-solid fa-building me-1"></i> Công ty <span class="pill-counter">{{ getLevelCount('COMPANY') }}</span>
            </button>
            <button type="button" class="filter-pill-btn" [class.active]="selectedLevelFilter === 'TEAM'" (click)="setLevelFilter('TEAM')">
              <i class="fa-solid fa-users me-1"></i> Đội ngũ <span class="pill-counter">{{ getLevelCount('TEAM') }}</span>
            </button>
            <button type="button" class="filter-pill-btn" [class.active]="selectedLevelFilter === 'PERSONAL'" (click)="setLevelFilter('PERSONAL')">
              <i class="fa-solid fa-user me-1"></i> Cá nhân <span class="pill-counter">{{ getLevelCount('PERSONAL') }}</span>
            </button>
          </div>

          <!-- Search + View Toggle -->
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <!-- Search input -->
            <div class="board-search-wrapper">
              <i class="fa-solid fa-magnifying-glass search-icon"></i>
              <input type="text" class="form-control form-control-sm board-search-input" placeholder="Tìm theo mục tiêu, mã KR..." [(ngModel)]="searchQuery">
              <button class="clear-btn" *ngIf="searchQuery" (click)="searchQuery = ''"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <!-- View Switcher -->
            <div class="btn-group view-switcher">
              <button type="button" class="btn btn-sm" [class.btn-primary]="viewMode === 'cards'" [class.btn-outline-secondary]="viewMode !== 'cards'" (click)="viewMode = 'cards'" title="Dạng Thẻ Chiến lược">
                <i class="fa-solid fa-grip-vertical me-1"></i> Thẻ
              </button>
              <button type="button" class="btn btn-sm" [class.btn-primary]="viewMode === 'table'" [class.btn-outline-secondary]="viewMode !== 'table'" (click)="viewMode = 'table'" title="Dạng Bảng Tổng quan">
                <i class="fa-solid fa-table-list me-1"></i> Bảng
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Hiển thị Loading khi đang tải -->
      <div class="card text-center p-5 mb-4 shadow-sm" *ngIf="loading">
        <div class="table-loading-content">
          <div class="loading-spinner-circle"></div>
          <span class="mt-2 text-muted fw-semibold">Đang cập nhật chỉ số OKR Dashboard...</span>
        </div>
      </div>

      <!-- Empty state khi không tìm thấy dữ liệu -->
      <div class="card text-center p-5 mb-4 shadow-sm" *ngIf="!loading && filteredObjectives.length === 0">
        <div class="empty-icon-box mb-3">
          <i class="fa-solid fa-bullseye text-muted"></i>
        </div>
        <h4 style="font-size: 16px; font-weight: 700; color: #1e293b;">Không tìm thấy Mục tiêu nào phù hợp</h4>
        <p class="text-muted mb-3" style="font-size: 13px; max-width: 480px; margin: 0 auto;">
          Không có mục tiêu nào trong chu kỳ <strong>{{ selectedTimelineTree }}</strong> và bộ lọc hiện tại. Hãy chuyển chu kỳ khác hoặc tạo mới trong Cài đặt OKR.
        </p>
        <div>
          <button class="btn btn-primary btn-sm px-3" routerLink="/objective-create">
            <i class="fa-solid fa-plus me-1"></i> Tạo Mục tiêu mới
          </button>
        </div>
      </div>

      <!-- 5. CHẾ ĐỘ 1: DẠNG THẺ CHIẾN LƯỢC (EXECUTIVE CARDS) -->
      <ng-container *ngIf="!loading && viewMode === 'cards' && filteredObjectives.length > 0">
        <div class="row g-4">
          <div class="col-12" *ngFor="let obj of filteredObjectives">
            <div class="card okr-executive-card shadow-sm">
              <!-- Header Thẻ Mục tiêu -->
              <div class="okr-card-header">
                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 w-100">
                  <div class="d-flex align-items-center gap-3 flex-wrap">
                    <!-- Badge Cấp bậc -->
                    <span class="level-badge-pill" [ngClass]="getLevelBadgeClass(obj.level)">
                      <i class="fa-solid" [ngClass]="getLevelIcon(obj.level)"></i>
                      {{ getLevelName(obj.level) }}
                    </span>

                    <!-- Mã Mục tiêu -->
                    <code class="obj-code-tag">{{ obj.objective_id }}</code>

                    <!-- Tiêu đề Mục tiêu -->
                    <h4 class="obj-card-title mb-0">{{ obj.title }}</h4>
                  </div>

                  <!-- Góc phải: Tiến độ & Tình trạng -->
                  <div class="d-flex align-items-center gap-3">
                    <!-- Người phụ trách -->
                    <div class="assignee-pill" title="Người / Đội ngũ phụ trách">
                      <i class="fa-solid" [ngClass]="(obj.level || '').toUpperCase() === 'PERSONAL' ? 'fa-user text-success' : 'fa-users text-primary'"></i>
                      <span>{{ getAssigneeLabel(obj) }}</span>
                    </div>

                    <!-- Tình trạng -->
                    <span class="status-chip" [ngClass]="getHealthClass(obj.progress)">
                      <i class="fa-solid" [ngClass]="obj.progress >= 75 ? 'fa-circle-check' : (obj.progress >= 50 ? 'fa-triangle-exclamation' : 'fa-circle-xmark')"></i>
                      {{ getHealthLabel(obj.progress) }}
                    </span>

                    <!-- % Lớn -->
                    <span class="obj-big-pct" [ngClass]="getHealthTextClass(obj.progress)">
                      {{ obj.progress }}%
                    </span>
                  </div>
                </div>

                <!-- Thanh Tiến độ chính của Mục tiêu -->
                <div class="obj-progress-bar-container mt-3">
                  <div class="obj-progress-bar-fill" [style.width.%]="obj.progress" [ngClass]="getProgressBarColor(obj.progress)"></div>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-1" style="font-size: 11.5px; color: #64748b;">
                  <span>Khởi điểm: <strong>{{ obj.start_value || 0 }}%</strong></span>
                  <span>Hiện tại: <strong [ngClass]="getHealthTextClass(obj.progress)">{{ obj.progress }}%</strong></span>
                  <span>Mục tiêu cam kết: <strong>{{ obj.expected_value || 100 }}%</strong></span>
                </div>
              </div>

              <!-- Danh sách Key Results của Mục tiêu -->
              <div class="table-container p-0">
                <table class="table table-hover align-middle mb-0 kr-table">
                  <thead>
                    <tr>
                      <th style="width: 120px;">Mã KR</th>
                      <th>Kết quả Then chốt (Key Result)</th>
                      <th class="text-center" style="width: 150px;">Giá trị Đo lường</th>
                      <th style="width: 220px;">Tiến độ Hoàn thành</th>
                      <th class="text-center" style="width: 140px;">Đạt SLA</th>
                      <th class="text-center" style="width: 140px;">Cơ chế Đo lường</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let kr of obj.key_results">
                      <!-- Mã KR -->
                      <td>
                        <span class="kr-code-badge">{{ kr.kr_id }}</span>
                      </td>

                      <!-- Tên KR & Người phụ trách -->
                      <td>
                        <div class="kr-title-wrapper">
                          <span class="kr-title-text">{{ kr.title }}</span>
                          <span class="kr-assignee-sub">
                            <i class="fa-regular fa-user me-1"></i>{{ getKrAssigneeLabel(kr) }}
                          </span>
                        </div>
                      </td>

                      <!-- Giá trị Đo lường: Start -> Current -> Target -->
                      <td class="text-center">
                        <div class="metric-val-flow">
                          <span class="val-start text-muted" title="Ban đầu">{{ kr.start_value }}</span>
                          <i class="fa-solid fa-arrow-right-long text-muted" style="font-size: 10px;"></i>
                          <span class="val-current fw-bold" [ngClass]="getKrProgress(kr) >= 75 ? 'text-success' : 'text-primary'" title="Hiện tại">
                            {{ kr.current_value }} {{ kr.unit }}
                          </span>
                          <i class="fa-solid fa-arrow-right-long text-muted" style="font-size: 10px;"></i>
                          <span class="val-target fw-semibold text-dark" title="Chỉ tiêu">{{ kr.expected_value }} {{ kr.unit }}</span>
                        </div>
                      </td>

                      <!-- Tiến độ % -->
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

                      <!-- Trạng thái SLA -->
                      <td class="text-center">
                        <span class="sla-badge" [ngClass]="getKrSlaBadgeClass(kr)">
                          <i class="fa-solid" [ngClass]="getKrProgress(kr) >= 75 ? 'fa-check' : (getKrProgress(kr) >= 50 ? 'fa-clock' : 'fa-triangle-exclamation')"></i>
                          {{ getKrSlaLabel(kr) }}
                        </span>
                      </td>

                      <!-- Cơ chế đo lường -->
                      <td class="text-center">
                        <span class="badge-source-gitlab">
                          <i class="fa-brands fa-gitlab text-warning me-1"></i> Git SLA
                        </span>
                      </td>
                    </tr>

                    <tr *ngIf="!obj.key_results || obj.key_results.length === 0">
                      <td colspan="6" class="text-center text-muted py-3">
                        <i class="fa-regular fa-circle-question me-1"></i> Chưa có Key Result nào gắn với mục tiêu này.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Footer Thẻ -->
              <div class="okr-card-footer d-flex justify-content-between align-items-center px-4 py-2 border-top bg-light">
                <span class="small text-muted">
                  Chu kỳ áp dụng: <strong>{{ obj.timeline_id || selectedTimelineTree }}</strong>
                </span>
                <a [routerLink]="['/okr-tree']" class="text-primary text-decoration-none small fw-semibold">
                  Xem trên Cây Phân Cấp (Tree) <i class="fa-solid fa-arrow-right ms-1"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- 6. CHẾ ĐỘ 2: DẠNG BẢNG MA TRẬN TỔNG HỢP (COMPACT MATRIX) -->
      <ng-container *ngIf="!loading && viewMode === 'table' && filteredObjectives.length > 0">
        <div class="card shadow-sm">
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0 okr-matrix-table">
              <thead>
                <tr>
                  <th style="width: 140px;">Mã & Cấp bậc</th>
                  <th>Mục tiêu Chiến lược (Objective)</th>
                  <th style="width: 180px;">Phụ trách</th>
                  <th class="text-center" style="width: 110px;">Số KRs</th>
                  <th style="width: 220px;">Tiến độ Tổng thể</th>
                  <th class="text-center" style="width: 140px;">Tình trạng</th>
                  <th class="text-center" style="width: 100px;">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let obj of filteredObjectives">
                  <!-- Cấp bậc & Mã -->
                  <td>
                    <div class="d-flex flex-column gap-1">
                      <span class="level-badge-pill" [ngClass]="getLevelBadgeClass(obj.level)" style="font-size: 11px; padding: 2px 6px;">
                        {{ getLevelName(obj.level) }}
                      </span>
                      <code class="obj-code-tag" style="font-size: 11px;">{{ obj.objective_id }}</code>
                    </div>
                  </td>

                  <!-- Tiêu đề -->
                  <td>
                    <div class="fw-bold text-dark" style="font-size: 13.5px;">{{ obj.title }}</div>
                    <div class="text-muted small">Chu kỳ: {{ obj.timeline_id || selectedTimelineTree }}</div>
                  </td>

                  <!-- Người phụ trách -->
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <i class="fa-solid" [ngClass]="(obj.level || '').toUpperCase() === 'PERSONAL' ? 'fa-user text-success' : 'fa-users text-primary'"></i>
                      <span class="text-dark fw-medium" style="font-size: 13px;">{{ getAssigneeLabel(obj) }}</span>
                    </div>
                  </td>

                  <!-- Số KRs -->
                  <td class="text-center">
                    <span class="badge badge-light-primary fw-bold" style="font-size: 12px;">
                      {{ obj.key_results?.length || 0 }} KRs
                    </span>
                  </td>

                  <!-- Tiến độ bar -->
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

                  <!-- Tình trạng -->
                  <td class="text-center">
                    <span class="status-chip" [ngClass]="getHealthClass(obj.progress)">
                      {{ getHealthLabel(obj.progress) }}
                    </span>
                  </td>

                  <!-- Thao tác -->
                  <td class="text-center">
                    <a [routerLink]="['/okr-tree']" class="btn btn-sm btn-outline-primary py-1 px-2" title="Xem trên cây">
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
      font-size: 20px;
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

    /* 1. KPI Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
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
      background: #f1f5f9;
      border-radius: 4px;
      overflow: hidden;
    }
    .kpi-progress-bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.4s ease;
    }
    .kpi-footer-note {
      font-size: 12px;
      color: #64748b;
    }
    .badge-gitlab-tag {
      background: #fdf4ff;
      color: #9333ea;
      border: 1px solid #f0abfc;
      font-size: 11.5px;
      padding: 3px 8px;
      border-radius: 6px;
    }

    /* Segmented Bar */
    .segmented-bar {
      display: flex;
      height: 6px;
      border-radius: 4px;
      overflow: hidden;
      background: #f1f5f9;
      gap: 2px;
    }
    .segmented-bar .segment {
      height: 100%;
      transition: width 0.3s ease;
    }

    /* Status Chips */
    .status-chip {
      font-size: 11.5px;
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

    /* 2. Charts Section */
    .chart-card {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      padding: 1.25rem;
    }
    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    }
    .chart-title {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
    }
    .chart-subtitle {
      font-size: 12px;
      color: #64748b;
    }
    .badge-light-secondary {
      background: #f1f5f9;
      color: #475569;
      border-radius: 6px;
      font-size: 12px;
      padding: 4px 8px;
    }
    .badge-light-primary {
      background: #eff6ff;
      color: #2563eb;
      border-radius: 6px;
      font-size: 12px;
      padding: 4px 8px;
    }

    /* Conic Donut Chart */
    .donut-chart-container {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .conic-donut {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: conic-gradient(
        #10b981 0% calc(var(--on-track-pct, 0) * 1%),
        #f59e0b calc(var(--on-track-pct, 0) * 1%) calc((var(--on-track-pct, 0) + var(--at-risk-pct, 0)) * 1%),
        #ef4444 calc((var(--on-track-pct, 0) + var(--at-risk-pct, 0)) * 1%) 100%
      );
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(0,0,0,0.06);
    }
    .donut-center {
      width: 82px;
      height: 82px;
      border-radius: 50%;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
    }
    .donut-center-val {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1;
    }
    .donut-center-sub {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }

    /* Donut Legend */
    .donut-legend {
      min-width: 180px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .legend-info {
      flex: 1;
    }
    .legend-label {
      font-size: 12.5px;
      font-weight: 500;
      color: #334155;
    }
    .legend-count {
      font-size: 13px;
    }
    .legend-pct {
      font-size: 11px;
    }

    /* Level Progress Rows */
    .level-icon-badge {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      color: #fff;
    }
    .badge-company { background: #8b5cf6; }
    .badge-team { background: #3b82f6; }
    .badge-personal { background: #10b981; }

    .level-progress-bar-wrapper {
      height: 8px;
      background: #f1f5f9;
      border-radius: 6px;
      overflow: hidden;
    }
    .level-bar-fill {
      height: 100%;
      border-radius: 6px;
      transition: width 0.4s ease;
    }
    .bg-company-gradient { background: linear-gradient(90deg, #8b5cf6, #a78bfa); }
    .bg-team-gradient { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
    .bg-personal-gradient { background: linear-gradient(90deg, #10b981, #34d399); }
    .progress-pill-pct {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }

    /* 3. Filter Bar */
    .board-filter-bar {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
    }
    .filter-pill-btn {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #475569;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 12.5px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .filter-pill-btn:hover {
      background: #f1f5f9;
      color: #1e293b;
    }
    .filter-pill-btn.active {
      background: #2563eb;
      color: #ffffff;
      border-color: #2563eb;
    }
    .filter-pill-btn.active .pill-counter {
      background: rgba(255,255,255,0.25);
      color: #ffffff;
    }
    .pill-counter {
      background: #e2e8f0;
      color: #475569;
      font-size: 11px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 10px;
    }
    .board-search-wrapper {
      position: relative;
      min-width: 200px;
    }
    .board-search-input {
      padding-left: 28px;
      border-radius: 6px;
      font-size: 12.5px;
    }
    .board-search-wrapper .search-icon {
      position: absolute;
      left: 9px;
      top: 50%;
      transform: translateY(-50%);
      color: #94a3b8;
      font-size: 11px;
    }
    .board-search-wrapper .clear-btn {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      border: none;
      background: transparent;
      color: #94a3b8;
      font-size: 11px;
      cursor: pointer;
    }

    /* 4. Executive Cards View */
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
      font-size: 15.5px;
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
      background: #f1f5f9;
      border-radius: 6px;
      overflow: hidden;
    }
    .obj-progress-bar-fill {
      height: 100%;
      border-radius: 6px;
      transition: width 0.4s ease;
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
    }
    .kr-assignee-sub {
      font-size: 11.5px;
      color: #64748b;
    }
    .metric-val-flow {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      background: #f8fafc;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid #f1f5f9;
    }
    .kr-progress-track {
      height: 6px;
      background: #f1f5f9;
      border-radius: 4px;
      overflow: hidden;
      min-width: 90px;
    }
    .kr-progress-bar {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    .kr-pct-label {
      font-size: 12.5px;
      width: 42px;
      text-align: right;
    }
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
      font-size: 11px;
      font-weight: 600;
      background: #fef2f2;
      color: #e11d48;
      border: 1px solid #fecdd3;
      padding: 2px 7px;
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
    .btn-icon-only {
      width: 38px;
      height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
    }
    .empty-icon-box {
      font-size: 38px;
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
    return this.objectives.filter(o => (o.level || '').toUpperCase() === lvl.toUpperCase()).length;
  }

  get filteredObjectives(): Objective[] {
    return this.objectives.filter(obj => {
      // 1. Level filter
      if (this.selectedLevelFilter !== 'ALL') {
        const lvl = (obj.level || '').toUpperCase();
        if (lvl !== this.selectedLevelFilter) return false;
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

  get companyAvgProgress(): number {
    const list = this.objectives.filter(o => (o.level || '').toUpperCase() === 'COMPANY');
    if (list.length === 0) return 0;
    const sum = list.reduce((acc, o) => acc + (o.progress || 0), 0);
    return parseFloat((sum / list.length).toFixed(1));
  }

  get teamAvgProgress(): number {
    const list = this.objectives.filter(o => (o.level || '').toUpperCase() === 'TEAM');
    if (list.length === 0) return 0;
    const sum = list.reduce((acc, o) => acc + (o.progress || 0), 0);
    return parseFloat((sum / list.length).toFixed(1));
  }

  get personalAvgProgress(): number {
    const list = this.objectives.filter(o => (o.level || '').toUpperCase() === 'PERSONAL' || (o.level || '').toUpperCase() === 'INDIVIDUAL');
    if (list.length === 0) return 0;
    const sum = list.reduce((acc, o) => acc + (o.progress || 0), 0);
    return parseFloat((sum / list.length).toFixed(1));
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
    if (obj.team_name) return obj.team_name;
    if (obj.assignee_name) return obj.assignee_name;
    if (obj.assignee_id) {
      const tm = this.teams.find(t => t.id === obj.assignee_id || t.code === obj.assignee_id);
      if (tm) return tm.name;
      const emp = this.employees.find(e => e.employee_id === obj.assignee_id);
      if (emp) return emp.full_name;
      return obj.assignee_id;
    }
    const lvl = (obj.level || '').toUpperCase();
    if (lvl === 'COMPANY') return 'Ban Giám Đốc';
    return 'Chưa phân bổ';
  }

  getKrAssigneeLabel(kr: KeyResult): string {
    if (kr.assignee_id) {
      const emp = this.employees.find(e => e.employee_id === kr.assignee_id || e.full_name === kr.assignee_id);
      if (emp) return emp.full_name;
      const tm = this.teams.find(t => t.id === kr.assignee_id || t.code === kr.assignee_id);
      if (tm) return tm.name;
      return kr.assignee_id;
    }
    return 'Team dev';
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
          // Chủ động phát hiện và hiển thị đúng tháng hiện tại
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

  // Tự động nhận diện Timeline tương ứng với tháng và năm hiện tại
  findCurrentMonthTimeline(timelines: Timeline[]): Timeline | undefined {
    if (!timelines || timelines.length === 0) return undefined;
    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();
    const nowTime = now.getTime();

    // 1. Tìm theo khoảng ngày thực tế bao phủ ngày hiện tại (cấp month)
    const activeByDate = timelines.find(t => {
      if (!t.start_date || !t.end_date) return false;
      const s = new Date(t.start_date).getTime();
      const e = new Date(t.end_date).setHours(23, 59, 59, 999);
      const isMonth = t.level === 'month' || (t.title && /month|tháng/i.test(t.title));
      return !isNaN(s) && !isNaN(e) && s <= nowTime && nowTime <= e && isMonth;
    });
    if (activeByDate) return activeByDate;

    // 2. Tìm theo ID hoặc Title khớp Tháng và Năm hiện tại (ví dụ: TL-M11-2026 hoặc Month 11)
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

    // 3. Tìm theo Title khớp Tháng hiện tại
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
          
          // Lọc Key Results thuộc các mục tiêu đang được load
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
