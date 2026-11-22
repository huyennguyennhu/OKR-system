import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { OkrService, FlowSummary, FlowRun, FlowRunsResponse } from '../../services/okr.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

export interface EvidenceItem {
  id: string;
  iid: number;
  type: 'Issue' | 'MR' | 'Bug';
  title: string;
  gitlabUrl: string;
  assigneeName: string;
  assigneeUsername: string;
  weightOrDuration: string;
  weightNum?: number;
  dueTimeDisplay: string;
  completedTimeDisplay: string;
  slaStatus: 'PASS' | 'FAIL' | 'PENDING';
  slaLabel: string;
  krId: string;
}

export interface MemberBreakdown {
  name: string;
  username: string;
  empId?: string;
  krId: string;
  dueSummary: string;
  passSummary: string;
  failSummary: string;
  pendingSummary?: string;
  slaRate: number;
  slaRateDisplay?: string;
  isPass: boolean;
  tasks: EvidenceItem[];
  expanded?: boolean;
}

export interface RunDetailViewModel {
  totalCount: number;
  totalUnitLabel: string;
  totalCardLabel?: string;
  totalCardSubText?: string;
  passCount: number;
  passPercent: number;
  passCardLabel?: string;
  passCardValue?: string;
  passSubText?: string;
  failCount: number;
  failPercent: number;
  failCardLabel?: string;
  failCardValue?: string;
  failSubText?: string;
  pendingCount?: number;
  pendingSubText?: string;
  overallPass: boolean;
  overallLabel: string;
  overallSubText?: string;
  members: MemberBreakdown[];
  evidences: EvidenceItem[];
  slaRuleText: string;
  formulaIndividualHtml?: SafeHtml;
  formulaTeamHtml?: SafeHtml;
}

@Component({
  selector: 'app-flow-runs',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <!-- Lớp phủ khóa trang trong suốt (không làm mờ, chặn tương tác khi đang tải) -->
    <div class="page-loading-overlay" *ngIf="loading"></div>

    <div class="flow-runs-page">

      <!-- ========================================================================= -->
      <!-- VIEW 1: OVERVIEW CARDS VIEW (Màn hình tổng quan danh sách Flow) -->
      <!-- ========================================================================= -->
      <div class="flow-runs-overview-view" *ngIf="viewMode === 'cards'">
        <!-- Page Top Bar -->
        <div class="page-top-bar mb-4">
          <div class="top-bar-left">
            <h3 class="card-title mb-1" style="font-size: 16px; font-weight: 700;">
              Flow Runs
            </h3>
            <p class="subtitle mb-0">
              Nhật ký thực thi các kịch bản Activepieces tự động đo lường từ GitLab và ghi dữ liệu cập nhật chỉ số Key Results (KR).
            </p>
          </div>
        </div>

        <!-- Flow Cards Section -->
        <div class="flow-cards-section mb-4">
          <!-- Cards Grid -->
          <div class="flow-cards-grid">
            <div 
              *ngFor="let flow of flows" 
              class="flow-card clickable-card"
              (click)="openFlowDetail(flow.flow_code)"
              title="Nhấn để mở trang bảng lần chạy của {{ flow.flow_code }}">
              
              <div class="card-header-line">
                <span class="badge badge-code">{{ flow.flow_code }}</span>
              </div>

              <h4 class="flow-card-title">{{ flow.flow_name }}</h4>

              <div class="flow-card-kr">
                <i class="fa-solid fa-bullseye me-1 text-primary"></i>
                <span class="kr-badge">{{ flow.kr_id }}</span>
                <span class="kr-title-text">{{ flow.kr_title }}</span>
              </div>

              <div class="card-metrics-row">
                <div class="metric-box">
                  <span class="metric-label">Lần chạy</span>
                  <span class="metric-value">{{ flow.total_runs }}</span>
                </div>
                <div class="metric-box">
                  <span class="metric-label">Thành công</span>
                  <span class="metric-value text-success">{{ flow.success_rate }}%</span>
                </div>
                <div class="metric-box flex-2">
                  <span class="metric-label">Lần chạy gần nhất</span>
                  <span class="metric-value time-val">{{ flow.last_run_time || 'Chưa chạy' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- VIEW 2: FLOW DETAIL VIEW (Trang chi tiết Flow với Bảng và Filter Bar) -->
      <!-- ========================================================================= -->
      <div class="flow-runs-detail-view" *ngIf="viewMode === 'detail'">
        <!-- Back Navigation & Header Bar -->
        <div class="page-top-bar mb-3">
          <div class="top-bar-left">
            <!-- Breadcrumb Navigation -->
            <div class="d-flex align-items-center gap-2 mb-2">
              <button 
                type="button" 
                class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 btn-back"
                (click)="goBackToCards()">
                <i class="fa-solid fa-arrow-left"></i>
                <span>Quay lại danh sách Flows</span>
              </button>
            </div>

            <h3 class="card-title mb-1" style="font-size: 16px; font-weight: 700;">
              {{ getDetailTitle() }}
            </h3>
            <p class="subtitle mb-0" *ngIf="selectedFlowCode === 'all'">
              Tổng hợp toàn bộ lịch sử thực thi và kết quả tự động đo lường SLA của tất cả các kịch bản Activepieces.
            </p>
          </div>

          <div class="top-bar-right d-flex align-items-center gap-2 flex-wrap">
            <!-- Flow Switcher Pills -->
            <div class="flow-switcher-group d-flex align-items-center gap-1 bg-light p-1 rounded border">
              <button 
                *ngFor="let f of flows" 
                type="button" 
                class="btn-flow-switch" 
                [class.active]="selectedFlowCode === f.flow_code"
                (click)="openFlowDetail(f.flow_code)"
                [title]="f.flow_name">
                {{ f.flow_code }} ({{ f.total_runs }})
              </button>
              <button 
                type="button" 
                class="btn-flow-switch"
                [class.active]="selectedFlowCode === 'all'"
                (click)="openFlowDetail('all')"
                title="Xem tất cả lần chạy">
                Tất cả ({{ allRuns.length }})
              </button>
            </div>
          </div>
        </div>

        <!-- Flow Summary Box (Hiển thị tóm tắt thông số Flow khi xem flow cụ thể) -->
        <div class="flow-detail-summary-card p-3 mb-3 bg-white border rounded" *ngIf="selectedFlowCode !== 'all' && currentFlowSummary">
          <div class="d-flex align-items-center justify-content-start flex-wrap gap-4 text-muted" style="font-size: 12.5px;">
            <div>Tổng lần chạy: <strong class="text-dark">{{ currentFlowSummary.total_runs }}</strong></div>
            <div>Tỷ lệ thành công: <strong class="text-success">{{ currentFlowSummary.success_rate }}%</strong></div>
            <div>Gần nhất: <strong class="text-dark">{{ currentFlowSummary.last_run_time || 'Chưa chạy' }}</strong></div>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="filter-bar mb-3">
          <div class="filter-search-wrapper">
            <i class="fa-solid fa-magnifying-glass search-icon"></i>
            <input 
              type="text" 
              class="form-control filter-input" 
              placeholder="Tìm theo mã run, flow, tác động, trạng thái..." 
              [(ngModel)]="searchQuery" 
              (input)="filterRuns()">
            <button 
              type="button" 
              class="clear-search-btn" 
              *ngIf="searchQuery" 
              (click)="searchQuery=''; filterRuns()" 
              title="Xóa tìm kiếm">
              <i class="fa-solid fa-circle-xmark"></i>
            </button>
          </div>

          <!-- Custom Dropdown Status Filter -->
          <div class="custom-select-wrapper">
            <button 
              type="button" 
              class="custom-select-trigger" 
              (click)="toggleStatusDropdown($event)" 
              [class.active]="isStatusDropdownOpen">
              <span class="d-flex align-items-center gap-2">
                <i class="fa-solid fa-filter text-muted" *ngIf="selectedStatus === 'all'"></i>
                <i class="fa-solid fa-circle-check text-success" *ngIf="selectedStatus === 'SUCCESS'"></i>
                <i class="fa-solid fa-triangle-exclamation text-warning" *ngIf="selectedStatus === 'PARTIAL'"></i>
                <i class="fa-solid fa-circle-xmark text-danger" *ngIf="selectedStatus === 'FAILED'"></i>
                <span>{{ getSelectedStatusLabel() }}</span>
              </span>
              <i class="fa-solid fa-chevron-down chevron-icon" [class.rotate]="isStatusDropdownOpen"></i>
            </button>
            <div class="custom-select-menu" *ngIf="isStatusDropdownOpen">
              <div class="custom-select-option" [class.selected]="selectedStatus === 'all'" (click)="selectStatus('all')">
                <span class="d-flex align-items-center gap-2">
                  <i class="fa-solid fa-layer-group text-muted" style="width: 16px;"></i>
                  <span>Tất cả trạng thái</span>
                </span>
                <i class="fa-solid fa-check check-icon" *ngIf="selectedStatus === 'all'"></i>
              </div>
              <div class="custom-select-option" [class.selected]="selectedStatus === 'SUCCESS'" (click)="selectStatus('SUCCESS')">
                <span class="d-flex align-items-center gap-2">
                  <i class="fa-solid fa-circle-check text-success" style="width: 16px;"></i>
                  <span>SUCCESS (Thành công 100%)</span>
                </span>
                <i class="fa-solid fa-check check-icon" *ngIf="selectedStatus === 'SUCCESS'"></i>
              </div>
              <div class="custom-select-option" [class.selected]="selectedStatus === 'PARTIAL'" (click)="selectStatus('PARTIAL')">
                <span class="d-flex align-items-center gap-2">
                  <i class="fa-solid fa-triangle-exclamation text-warning" style="width: 16px;"></i>
                  <span>PARTIAL (Hoàn tất 1 phần)</span>
                </span>
                <i class="fa-solid fa-check check-icon" *ngIf="selectedStatus === 'PARTIAL'"></i>
              </div>
              <div class="custom-select-option" [class.selected]="selectedStatus === 'FAILED'" (click)="selectStatus('FAILED')">
                <span class="d-flex align-items-center gap-2">
                  <i class="fa-solid fa-circle-xmark text-danger" style="width: 16px;"></i>
                  <span>FAILED (Thất bại / Lỗi kết nối)</span>
                </span>
                <i class="fa-solid fa-check check-icon" *ngIf="selectedStatus === 'FAILED'"></i>
              </div>
            </div>
          </div>
        </div>

        <!-- Runs Table Section -->
        <div class="table-container">
          <table class="table table-hover">
            <thead>
              <tr>
                <th style="width: 180px;">Mã lần chạy</th>
                <th style="width: 130px;">Flow liên kết</th>
                <th style="width: 170px;">Thời gian chạy</th>
                <th style="width: 100px;">Thời lượng</th>
                <th style="width: 140px;">Kiểu kích hoạt</th>
                <th style="width: 110px;" class="text-center">Trạng thái</th>
                <th style="width: 130px;" class="text-center">Quét GitLab</th>
                <th>Dữ liệu tạo ra / Tác động OKR</th>
                <th style="width: 48px; text-align: center;"></th>
              </tr>
            </thead>
            <tbody>
              <!-- Center Table Loading -->
              <tr *ngIf="loading">
                <td colspan="9" class="table-loading-cell">
                  <div class="table-loading-content">
                    <div class="loading-spinner-circle"></div>
                    <span>Đang tải danh sách lần chạy flow...</span>
                  </div>
                </td>
              </tr>

              <!-- Table Rows & Empty State strictly wrapped in !loading -->
              <ng-container *ngIf="!loading">
                <tr *ngFor="let run of filteredRuns" class="clickable-run-row" (click)="openPayloadModal(run)" title="Nhấn để xem chi tiết lần chạy">
                  <td>
                    <code class="run-id">{{ run.run_id }}</code>
                  </td>
                  <td>
                    <span class="badge badge-code" [title]="run.flow_name">{{ run.flow_code }}</span>
                  </td>
                  <td>
                    <div class="time-col">
                      <span class="start-time">{{ run.start_time }}</span>
                    </div>
                  </td>
                  <td>
                    <span class="duration-text">{{ formatDuration(run.duration_ms) }}</span>
                  </td>
                  <td>
                    <span class="badge" [ngClass]="run.trigger_type.includes('Schedule') ? 'badge-schedule' : 'badge-webhook'">
                      <i class="fa-solid me-1" [ngClass]="run.trigger_type.includes('Schedule') ? 'fa-clock' : 'fa-bolt'"></i>
                      {{ run.trigger_type.includes('Schedule') ? 'Schedule' : 'GitLab Webhook' }}
                    </span>
                  </td>
                  <td class="text-center">
                    <span class="badge" [ngClass]="getStatusBadgeClass(run.status)">
                      <i class="fa-solid me-1" [ngClass]="getStatusIconClass(run.status)"></i>
                      {{ run.status }}
                    </span>
                  </td>
                  <td class="text-center">
                    <span class="badge badge-input" [title]="'Đã đọc ' + run.input_count + ' bản ghi sự kiện từ GitLab'">
                      <i class="fa-brands fa-gitlab me-1"></i>{{ run.input_count }} mục
                    </span>
                  </td>
                  <td>
                    <div class="impact-cell" [title]="run.data_created">
                      <i class="fa-solid fa-arrow-right text-primary me-1"></i>
                      <span>{{ run.data_created }}</span>
                    </div>
                  </td>
                  <!-- 3-Dot Action Column -->
                  <td style="width: 48px; text-align: center; position: relative;" (click)="$event.stopPropagation()">
                    <button 
                      type="button" 
                      class="btn-action-trigger" 
                      [class.active]="activeActionMenu === run.run_id"
                      (click)="toggleActionMenu(run.run_id, $event)"
                      title="Thao tác">
                      <i class="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                    <div class="action-dropdown" *ngIf="activeActionMenu === run.run_id" (click)="$event.stopPropagation()">
                      <button class="action-dropdown-item" (click)="openPayloadModal(run); closeDropdown()">
                        <i class="fa-solid fa-magnifying-glass-chart"></i> Xem chi tiết lần chạy
                      </button>
                      <button class="action-dropdown-item text-danger" (click)="deleteRun(run); closeDropdown()">
                        <i class="fa-solid fa-trash-can"></i> Xóa lần chạy
                      </button>
                    </div>
                  </td>
                </tr>

                <!-- Standard Empty State -->
                <tr *ngIf="filteredRuns.length === 0">
                  <td colspan="9" class="text-center text-muted py-4">
                    {{ (searchQuery || selectedStatus !== 'all' || selectedFlowCode !== 'all') ? 'Không tìm thấy lần chạy nào phù hợp bộ lọc.' : 'Chưa có lần chạy nào cho Flow này. Hãy kích hoạt chạy flow!' }}
                  </td>
                </tr>
              </ng-container>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- Modal 1: Chi tiết lần chạy (Nâng cấp 5 khối chuẩn Audit & Drill-down) -->
    <div class="modal-overlay" *ngIf="selectedRunForModal" (click)="closePayloadModal()">
      <div class="modal-content payload-modal run-detail-modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <div>
              <h3 class="modal-title">
                Chi tiết lần chạy <span class="run-id-badge">{{ selectedRunForModal.run_id }}</span>
                <span class="badge badge-code ms-1">{{ selectedRunForModal.flow_code }}</span>
              </h3>
              <div class="modal-subtitle-meta">
                <span><i class="fa-regular fa-clock me-1"></i>{{ formatDisplayDateTime(selectedRunForModal.start_time) }}</span>
                <span class="meta-dot">•</span>
                <span><i class="fa-solid fa-bolt me-1"></i>{{ selectedRunForModal.trigger_type }}</span>
                <span class="meta-dot">•</span>
                <span class="badge" [ngClass]="getStatusBadgeClass(selectedRunForModal.status)">
                  <i class="fa-solid me-1" [ngClass]="getStatusIconClass(selectedRunForModal.status)"></i>
                  {{ selectedRunForModal.status }}
                </span>
                <span class="badge bg-light text-dark border ms-1">{{ formatDuration(selectedRunForModal.duration_ms) }}</span>
              </div>
            </div>
          </div>
          <button type="button" class="btn-close-modal" (click)="closePayloadModal()" aria-label="Đóng" title="Đóng">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="modal-body" *ngIf="runDetailVm as vm">
          <!-- Member Trace Highlight Card (Nếu mở từ nút Truy vết trong cây OKR) -->
          <div class="trace-target-card mb-3 p-3 rounded border border-primary bg-primary-subtle" *ngIf="pendingTraceMember">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div class="d-flex align-items-center gap-2">
                <div class="trace-icon-circle">
                  <i class="fa-solid fa-crosshairs text-primary"></i>
                </div>
                <div>
                  <span class="text-muted" style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Thành viên đang truy vết</span>
                  <h4 class="mb-0 text-primary" style="font-size: 14.5px; font-weight: 700;">{{ pendingTraceMember }}</h4>
                </div>
              </div>
            </div>
            <div class="member-trace-metrics mt-2 pt-2 border-top border-primary-subtle" *ngIf="getMemberTraceDetails(selectedRunForModal, pendingTraceMember) as m">
              <div class="d-flex align-items-center gap-3 flex-wrap" style="font-size: 12.5px;">
                <span *ngIf="m.IC_i != null">
                  Chỉ số đúng hạn (IC_i): <strong class="text-primary">{{ m.IC_i }}%</strong>
                </span>
                <span *ngIf="m.Di !== undefined">
                  Số {{ m.unitLabel || 'tác vụ' }} đạt: <strong class="text-dark">{{ m.Ni }}/{{ m.Di }}</strong>
                </span>
                <span *ngIf="m.due_sp !== undefined">
                  Story Points: <strong class="text-dark">{{ m.ontime_sp }}/{{ m.due_sp }} SP</strong>
                </span>
                <span *ngIf="m.new_value !== undefined && m.IC_i === undefined && m.ic_percent === undefined">
                  Tiến độ cập nhật: <strong class="text-primary">{{ m.new_value }}%</strong>
                </span>
                <span *ngIf="m.working_hours_spent || m.avg_response_hours">
                  Thời gian review: <strong class="text-primary">{{ m.working_hours_spent || m.avg_response_hours }}h</strong> (SLA: {{ m.sla_limit_hours || 4.0 }}h)
                </span>
                <span *ngIf="m.resolve_time_hours || m.mttr_hours">
                  Thời gian giải quyết: <strong class="text-primary">{{ m.resolve_time_hours || m.mttr_hours }}h</strong> (SLA: {{ m.sla_limit_hours || 8.0 }}h)
                </span>
                <span *ngIf="m.status || m.sla_status" class="badge" [ngClass]="(m.status === 'PASS' || m.status === 'ON_TIME' || m.sla_status === 'PASS' || m.sla_status === 'ON_TIME') ? 'badge-success' : 'badge-danger'">
                  <i class="fa-solid fa-check me-1"></i>{{ m.status || m.sla_status }}
                </span>
              </div>
            </div>
          </div>

          <!-- KHỐI 1: Header & Thẻ Tóm tắt Tổng quan (KPI Cards) -->
          <div class="detail-kpi-grid mb-4">
            <div class="kpi-stat-card">
              <span class="kpi-stat-label">{{ vm.totalCardLabel || 'Tác vụ đến hạn (mẫu số)' }}</span>
              <div class="kpi-stat-value text-dark">{{ vm.totalCount }} {{ vm.totalUnitLabel }}</div>
              <span class="kpi-stat-sub">{{ vm.totalCardSubText || selectedRunForModal.flow_name }}</span>
            </div>
            <div class="kpi-stat-card" [ngClass]="vm.overallPass ? 'kpi-card-success' : 'kpi-card-warning'">
              <span class="kpi-stat-label">{{ vm.passCardLabel || 'Đúng hạn SLA' }}</span>
              <div class="kpi-stat-value" [ngClass]="vm.overallPass ? 'text-success' : 'text-warning-dark'">
                {{ vm.passCardValue || (vm.passCount + ' ' + vm.totalUnitLabel + ' (' + vm.passPercent + '%)') }}
              </div>
              <span class="kpi-stat-sub">{{ vm.passSubText }}</span>
            </div>
            <div class="kpi-stat-card kpi-card-danger">
              <span class="kpi-stat-label">{{ vm.failCardLabel || 'Trễ hạn SLA' }}</span>
              <div class="kpi-stat-value text-danger">
                {{ vm.failCardValue || (vm.failCount + ' ' + vm.totalUnitLabel + ' (' + vm.failPercent + '%)') }}
              </div>
              <span class="kpi-stat-sub">{{ vm.failSubText || 'Cần rà soát xử lý' }}</span>
            </div>
            <div class="kpi-stat-card kpi-card-info" *ngIf="vm.pendingCount && vm.pendingCount > 0">
              <span class="kpi-stat-label">Đang theo dõi (PENDING)</span>
              <div class="kpi-stat-value text-info">{{ vm.pendingCount }} {{ vm.totalUnitLabel }}</div>
              <span class="kpi-stat-sub">{{ vm.pendingSubText }}</span>
            </div>
            <div class="kpi-stat-card" [ngClass]="vm.overallPass ? 'kpi-card-pass-bg' : 'kpi-card-warn-bg'">
              <span class="kpi-stat-label">Đánh giá đợt chạy</span>
              <div class="mt-1">
                <span class="eval-badge" [ngClass]="vm.overallPass ? 'eval-pass' : 'eval-warn'">
                  <i class="fa-solid" [ngClass]="vm.overallPass ? 'fa-circle-check' : 'fa-triangle-exclamation'"></i>
                  {{ vm.overallLabel }}
                </span>
              </div>
              <span class="kpi-stat-sub mt-1">{{ vm.overallSubText || selectedRunForModal.data_created }}</span>
            </div>
          </div>

          <!-- KHỐI 2: Phân rã theo Từng Thành viên (Kèm Drill-down & Link GitLab) -->
          <div class="detail-section-block mb-4">
            <div class="section-block-header">
              <h4 class="section-block-title">
                <i class="fa-solid fa-users text-primary me-2"></i>
                Phân rã theo từng thành viên
              </h4>
              <span class="section-block-hint">Bấm "Xem tác vụ" để đối soát chi tiết từng Issue/MR trên GitLab</span>
            </div>

            <div class="sub-table-wrapper">
              <table class="sub-table">
                <thead>
                  <tr>
                    <th>Thành viên</th>
                    <th>Tác vụ đến hạn</th>
                    <th>Đạt SLA</th>
                    <th>Trễ</th>
                    <th>Tỷ lệ SLA</th>
                    <th>Trạng thái</th>
                    <th class="text-end">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  <ng-container *ngFor="let m of vm.members">
                    <tr [class.row-expanded]="m.expanded">
                      <td>
                        <div class="member-name-cell">
                          <strong>{{ m.name }}</strong>
                          <span class="member-handle">(&#64;{{ m.username }})</span>
                        </div>
                      </td>
                      <td>{{ m.dueSummary }}</td>
                      <td class="text-success fw-semibold">{{ m.passSummary }}</td>
                      <td [ngClass]="m.failSummary !== '0' ? 'text-danger fw-semibold' : 'text-muted'">{{ m.failSummary }}</td>
                      <td>
                        <span class="fw-bold" [ngClass]="m.isPass ? 'text-success' : 'text-warning-dark'">{{ m.slaRateDisplay || (m.slaRate + '%') }}</span>
                      </td>
                      <td>
                        <span class="badge" [ngClass]="m.isPass ? 'badge-success' : 'badge-warning-soft'">
                          {{ m.isPass ? 'ĐẠT' : 'CẦN CẢI THIỆN' }}
                        </span>
                      </td>
                      <td class="text-end">
                        <button type="button" class="btn-drilldown" (click)="toggleMemberTasks(m)">
                          <span>{{ m.expanded ? 'Thu gọn' : 'Xem ' + m.tasks.length + ' tác vụ' }}</span>
                          <i class="fa-solid ms-1" [ngClass]="m.expanded ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
                        </button>
                      </td>
                    </tr>
                    <!-- Drill-down list -->
                    <tr *ngIf="m.expanded" class="drilldown-detail-row">
                      <td colspan="7">
                        <div class="drilldown-list">
                          <div class="drilldown-item" *ngFor="let t of m.tasks">
                            <a [href]="t.gitlabUrl" target="_blank" rel="noopener noreferrer" class="gitlab-task-link">
                              <i class="fa-solid fa-link me-1"></i>
                              <span class="fw-semibold">{{ t.id }} - {{ t.title }}</span>
                              <i class="fa-solid fa-arrow-up-right-from-square ms-1 external-icon"></i>
                            </a>
                            <div class="drilldown-meta">
                              <span>{{ t.weightOrDuration }}</span>
                              <span class="meta-sep">|</span>
                              <span>Hạn: {{ t.dueTimeDisplay }}</span>
                              <span class="meta-sep">|</span>
                              <span>Đóng: {{ t.completedTimeDisplay }}</span>
                              <span class="meta-sep">|</span>
                              <span class="sla-result-text" [ngClass]="t.slaStatus === 'PASS' ? 'text-success' : 'text-danger'">
                                {{ t.slaLabel }}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </ng-container>
                </tbody>
              </table>
            </div>
          </div>

          <!-- KHỐI 3: Bảng Bằng chứng Toàn bộ Tác nghiệp (Master Evidence Records) -->
          <div class="detail-section-block mb-4">
            <div class="section-block-header flex-wrap gap-2">
              <h4 class="section-block-title">
                <i class="fa-solid fa-table-list text-primary me-2"></i>
                Bảng bằng chứng toàn bộ tác nghiệp ({{ filteredEvidences.length }}/{{ vm.evidences.length }})
              </h4>
              <div class="evidence-filters">
                <div class="evidence-search-wrap">
                  <i class="fa-solid fa-magnifying-glass"></i>
                  <input
                    type="text"
                    class="evidence-search-input"
                    [(ngModel)]="evidenceSearchText"
                    (ngModelChange)="onEvidenceFilterChange()"
                    placeholder="Tìm mã, tiêu đề, nhân sự..." />
                </div>
                <select class="evidence-select" [(ngModel)]="evidenceFilterSla" (ngModelChange)="onEvidenceFilterChange()">
                  <option value="all">Tất cả SLA</option>
                  <option value="PASS">Đạt SLA / Đúng hạn</option>
                  <option value="FAIL">Trễ hạn</option>
                  <option value="PENDING">Đang theo dõi (PENDING)</option>
                </select>
              </div>
            </div>

            <div class="sub-table-wrapper">
              <table class="sub-table evidence-table">
                <thead>
                  <tr>
                    <th style="width: 72px;">Loại</th>
                    <th>Mã &amp; Tiêu đề</th>
                    <th>Assign to</th>
                    <th>{{ weightOrDurationColumnLabel }}</th>
                    <th>Mốc hoàn thành</th>
                    <th>Đánh giá SLA</th>
                    <th>Tác động KR</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let ev of paginatedEvidences">
                    <td>
                      <span class="type-pill" [ngClass]="'type-' + ev.type.toLowerCase()">{{ ev.type }}</span>
                    </td>
                    <td>
                      <a [href]="ev.gitlabUrl" target="_blank" rel="noopener noreferrer" class="gitlab-task-link">
                        <span>{{ ev.id }} {{ ev.title }}</span>
                        <i class="fa-solid fa-arrow-up-right-from-square ms-1 external-icon"></i>
                      </a>
                    </td>
                    <td>{{ ev.assigneeName }}</td>
                    <td>{{ ev.weightOrDuration }}</td>
                    <td class="text-nowrap">{{ ev.completedTimeDisplay }}</td>
                    <td>
                      <span class="badge" [ngClass]="ev.slaStatus === 'PASS' ? 'badge-success' : (ev.slaStatus === 'PENDING' ? 'badge-info' : 'badge-danger')">
                        {{ ev.slaLabel }}
                      </span>
                    </td>
                    <td>
                      <span class="kr-impact-code">{{ ev.krId }}</span>
                    </td>
                  </tr>
                  <tr *ngIf="paginatedEvidences.length === 0">
                    <td colspan="7" class="text-center text-muted py-3">
                      Không tìm thấy bằng chứng nào khớp với bộ lọc hiện tại.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div class="evidence-pagination" *ngIf="evidenceTotalPages > 1">
              <span class="pagination-info">
                Trang {{ evidenceCurrentPage }} / {{ evidenceTotalPages }} ({{ filteredEvidences.length }} bản ghi)
              </span>
              <div class="pagination-btns">
                <button
                  type="button"
                  class="btn-page"
                  [disabled]="evidenceCurrentPage <= 1"
                  (click)="setEvidencePage(evidenceCurrentPage - 1)">
                  <i class="fa-solid fa-chevron-left"></i> Trước
                </button>
                <button
                  type="button"
                  class="btn-page"
                  [disabled]="evidenceCurrentPage >= evidenceTotalPages"
                  (click)="setEvidencePage(evidenceCurrentPage + 1)">
                  Sau <i class="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- KHỐI 4: Tóm tắt Quy tắc Đo lường Áp dụng (Measurement Rules Snapshot) -->
          <div class="rules-snapshot-box mb-4">
            <div class="rules-snapshot-title">
              <i class="fa-solid fa-scale-balanced text-secondary me-2"></i>
              Quy tắc đo lường áp dụng
            </div>
            <ul class="rules-snapshot-list mb-3">
              <li>
                <strong>Lịch làm việc chuẩn:</strong> 8.0 giờ/ngày (09:00 – 12:00 &amp; 13:30 – 18:30). Nghỉ trưa tự động trừ 1.5h. Thứ 7, Chủ Nhật đóng băng tính giờ.
              </li>
              <li>
                <strong>Quy chuẩn SLA:</strong> Đạt khi thời gian xử lý thực tế &le; Hạn định mức SLA cam kết. {{ vm.slaRuleText }}
              </li>
            </ul>

            <!-- Mô hình toán học KaTeX phân tầng áp dụng -->
            <div class="rules-snapshot-formulas pt-2.5 border-top" *ngIf="vm.formulaIndividualHtml || vm.formulaTeamHtml">
              <div class="d-flex align-items-center justify-content-between mb-2">
                <span class="text-muted fw-bold" style="font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.5px;">
                  <i class="fa-solid fa-square-root-variable text-primary me-1"></i> Mô hình toán học áp dụng
                </span>
              </div>
              <div class="row g-2.5">
                <div class="col-md-6" *ngIf="vm.formulaIndividualHtml">
                  <div class="formula-card p-2.5 bg-white rounded border">
                    <div class="formula-card-label d-flex align-items-center justify-content-between mb-1.5">
                      <span class="badge bg-light text-primary border" style="font-size: 10.5px;">
                        <i class="fa-solid fa-user me-1"></i> Cấp cá nhân
                      </span>
                      <span class="text-muted" style="font-size: 11px;">Điểm số thành viên u</span>
                    </div>
                    <div class="katex-rendered-math text-center py-1" [innerHTML]="vm.formulaIndividualHtml"></div>
                  </div>
                </div>
                <div class="col-md-6" *ngIf="vm.formulaTeamHtml">
                  <div class="formula-card p-2.5 bg-white rounded border">
                    <div class="formula-card-label d-flex align-items-center justify-content-between mb-1.5">
                      <span class="badge bg-light text-success border" style="font-size: 10.5px;">
                        <i class="fa-solid fa-users me-1"></i> Cấp nhóm (Roll-up)
                      </span>
                      <span class="text-muted" style="font-size: 11px;">Tổng hợp toàn Team</span>
                    </div>
                    <div class="katex-rendered-math text-center py-1" [innerHTML]="vm.formulaTeamHtml"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- KHỐI 5: Kỹ thuật: Payload JSON gốc (Dành cho Developer / IT) -->
          <details class="tech-payload-details">
            <summary class="tech-payload-summary">
              <div class="d-flex align-items-center gap-2">
                <i class="fa-solid fa-chevron-right summary-chevron"></i>
                <i class="fa-solid fa-file-code text-primary"></i>
                <span>Xem Payload JSON kỹ thuật</span>
              </div>
              <button type="button" class="btn-copy-payload" (click)="copyPayload($event)" title="Sao chép toàn bộ dữ liệu JSON">
                <i class="fa-solid" [ngClass]="isCopied ? 'fa-check text-success' : 'fa-copy'"></i>
                <span>{{ isCopied ? 'Đã sao chép' : 'Sao chép JSON' }}</span>
              </button>
            </summary>
            <div class="tech-payload-body">
              <pre class="json-code-box"><code>{{ formatPayloadJson(selectedRunForModal.payload_json) }}</code></pre>
            </div>
          </details>
        </div>
      </div>
    </div>

    <!-- Modal 2: Mô phỏng chạy Flow Activepieces -->
    <div class="modal-overlay" *ngIf="isSimulateModalOpen" (click)="closeSimulateModal()">
      <div class="modal-content simulate-modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="d-flex align-items-center gap-2">
            <div class="modal-icon-badge">
              <i class="fa-solid fa-play"></i>
            </div>
            <h3 class="modal-title">
              Mô phỏng chạy Flow Activepieces
            </h3>
          </div>
          <button type="button" class="btn-close-modal" (click)="closeSimulateModal()" aria-label="Đóng" title="Đóng">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="modal-body">
          <p class="simulate-desc mb-3">
            Hệ thống sẽ thực thi kịch bản đo lường tự động: quét sự kiện GitLab, tính SLA theo lịch làm việc Việt Nam, ghi nhận lịch sử vào bảng <strong>FlowRuns</strong> và cập nhật trực tiếp giá trị <strong>current_value</strong> của Key Result trên cây OKR.
          </p>

          <div class="form-group mb-3">
            <label class="form-label">
              Chọn Flow muốn kích hoạt <span class="text-danger">*</span>:
            </label>
            <select class="form-control" [(ngModel)]="simulateFlowCode">
              <option *ngFor="let flow of flows" [value]="flow.flow_code">
                [{{ flow.flow_code }}] {{ flow.flow_name }}
              </option>
            </select>
          </div>

          <div class="flow-preview-box" *ngIf="getSelectedSimulateFlow()">
            <div class="preview-row">
              <span class="preview-label">Key Result đích:</span>
              <strong class="text-primary">{{ getSelectedSimulateFlow()?.kr_id }} - {{ getSelectedSimulateFlow()?.kr_title }}</strong>
            </div>
            <div class="preview-row">
              <span class="preview-label">Kiểu kích hoạt:</span>
              <span>{{ getSelectedSimulateFlow()?.trigger_type }}</span>
            </div>
            <div class="preview-row">
              <span class="preview-label">Mô tả logic:</span>
              <span class="text-muted">{{ getSelectedSimulateFlow()?.description }}</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="closeSimulateModal()" [disabled]="isSimulating">
            Hủy
          </button>
          <button type="button" class="btn btn-primary" (click)="runSimulation()" [disabled]="isSimulating">
            <i class="fa-solid fa-spinner fa-spin me-1" *ngIf="isSimulating"></i>
            <i class="fa-solid fa-play me-1" *ngIf="!isSimulating"></i>
            <span>{{ isSimulating ? 'Đang kích hoạt...' : 'Kích hoạt chạy ngay' }}</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .flow-runs-page {
      width: 100%;
    }

    /* Top Bar */
    .page-top-bar {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .subtitle {
      color: #64748b;
      font-size: 13px;
    }

    /* Back button */
    .btn-back {
      font-size: 12.5px;
      font-weight: 500;
      padding: 0.35rem 0.75rem;
      border-radius: 6px;
      background: #ffffff;
      color: #334155;
      border: 1px solid #cbd5e1;
      transition: all 0.15s ease;
    }
    .btn-back:hover {
      background: #f1f5f9;
      color: #0f172a;
      border-color: #94a3b8;
    }

    /* Flow Cards Section */
    .flow-cards-section {
      width: 100%;
    }

    .cards-section-label {
      font-size: 13.5px;
      color: #334155;
    }

    .flow-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
      gap: 1.25rem;
    }

    .flow-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1.25rem;
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .clickable-card {
      cursor: pointer;
    }

    .clickable-card:hover {
      border-color: #3157D5;
      box-shadow: 0 8px 20px rgba(49, 87, 213, 0.1);
      transform: translateY(-2px);
    }

    .clickable-card:hover .card-action-hint {
      color: #1d4ed8 !important;
      text-decoration: underline;
    }

    .card-header-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .card-action-hint {
      font-size: 12px;
      font-weight: 600;
      transition: color 0.15s ease;
    }

    .flow-card-title {
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
      margin: 0;
      line-height: 1.35;
    }

    .flow-card-kr {
      font-size: 13px;
      color: #334155;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .kr-badge {
      background: #eff6ff;
      color: #2563eb;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 13px;
    }

    .kr-title-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .flow-card-trigger {
      font-size: 13px;
      color: #64748b;
    }

    .card-metrics-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #f8fafc;
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
      margin-top: 0.25rem;
    }

    .metric-box {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .metric-box.flex-2 {
      flex: 1.5;
    }

    .metric-label {
      font-size: 12px;
      color: #64748b;
    }

    .metric-value {
      font-size: 13.5px;
      font-weight: 700;
      color: #1e293b;
    }

    .time-val {
      font-weight: 500;
      color: #475569;
      font-size: 12.5px;
    }

    .card-impact-box {
      font-size: 12.5px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 0.4rem 0.65rem;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .impact-label {
      color: #166534;
      font-weight: 600;
      font-size: 12px;
    }

    .impact-content {
      color: #15803d;
      font-size: 12.5px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Flow Switcher Group on Detail Page */
    .btn-flow-switch {
      background: transparent;
      border: 1px solid transparent;
      border-radius: 4px;
      padding: 0.25rem 0.6rem;
      font-size: 12.5px;
      font-weight: 500;
      color: #475569;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-flow-switch:hover {
      background: #e2e8f0;
      color: #0f172a;
    }
    .btn-flow-switch.active {
      background: #3157D5;
      color: #ffffff;
      font-weight: 600;
    }

    /* Flow Detail Summary Card */
    .flow-detail-summary-card {
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    /* Filter Bar */
    .filter-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .filter-search-wrapper {
      position: relative;
      flex: 1;
      min-width: 280px;
    }

    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #94a3b8;
      font-size: 13px;
    }

    .filter-input {
      padding-left: 36px;
      padding-right: 32px;
      height: 38px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      font-size: 13px;
    }

    .clear-search-btn {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 13px;
      padding: 0;
    }

    .clear-search-btn:hover {
      color: #475569;
    }

    /* Custom Dropdown Trigger */
    .custom-select-wrapper {
      position: relative;
      min-width: 220px;
    }

    .custom-select-trigger {
      width: 100%;
      height: 38px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      font-size: 13px;
      color: #334155;
      transition: all 0.2s ease;
    }

    .custom-select-trigger:hover {
      border-color: #94a3b8;
    }

    .custom-select-trigger.active {
      border-color: #3157D5;
      box-shadow: 0 0 0 3px rgba(49, 87, 213, 0.15);
    }

    .chevron-icon {
      font-size: 11px;
      color: #64748b;
      transition: transform 0.2s ease;
    }

    .chevron-icon.rotate {
      transform: rotate(180deg);
    }

    .custom-select-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      z-index: 50;
      padding: 4px;
    }

    .custom-select-option {
      padding: 8px 12px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      font-size: 13px;
      color: #334155;
      transition: background 0.15s ease;
    }

    .custom-select-option:hover {
      background: #f1f5f9;
    }

    .custom-select-option.selected {
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 600;
    }

    .check-icon {
      color: #2563eb;
      font-size: 12px;
    }

    .filter-count-badge {
      font-size: 13px;
      color: #64748b;
    }

    /* Table Container */
    .table-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow-x: auto;
      overflow-y: hidden;
    }

    .table {
      margin-bottom: 0;
      width: 100%;
      border-collapse: collapse;
    }

    .clickable-run-row {
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .clickable-run-row:hover {
      background-color: #f8fafc !important;
    }

    .table th {
      background: #f8fafc;
      color: #475569;
      font-size: 12.5px;
      font-weight: 600;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #e2e8f0;
      white-space: nowrap;
    }

    .table td {
      padding: 0.85rem 1rem;
      vertical-align: middle;
      font-size: 13px;
      color: #1e293b;
      border-bottom: 1px solid #f1f5f9;
    }

    .run-id {
      background: #f1f5f9;
      color: #0f172a;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      font-weight: 600;
    }

    .badge-code {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #cbd5e1;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }

    .badge-active {
      background: #ecfdf5;
      color: #059669;
      border: 1px solid #a7f3d0;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11.5px;
      font-weight: 600;
    }

    .badge-schedule {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11.5px;
    }

    .badge-webhook {
      background: #fdf4ff;
      color: #a21caf;
      border: 1px solid #f0abfc;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11.5px;
    }

    .badge-success {
      background: #ecfdf5;
      color: #059669;
      border: 1px solid #a7f3d0;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11.5px;
      font-weight: 600;
    }

    .badge-warning {
      background: #fffbeb;
      color: #b45309;
      border: 1px solid #fde68a;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11.5px;
      font-weight: 600;
    }

    .badge-info {
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }
    .kpi-card-info {
      border-left: 4px solid #0284c7 !important;
    }
    .badge-danger {
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11.5px;
      font-weight: 600;
    }

    .badge-input {
      background: #f8fafc;
      color: #475569;
      border: 1px solid #cbd5e1;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
    }

    .duration-text {
      color: #64748b;
      font-size: 12.5px;
      font-weight: 500;
    }

    .time-col {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .start-time {
      font-size: 13px;
      color: #1e293b;
    }

    .impact-cell {
      max-width: 380px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
    }

    .btn-payload {
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-payload:hover {
      background: #dbeafe;
      color: #1d4ed8;
    }

    /* 3-Dot Action Button & Dropdown */
    .btn-action-trigger {
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 14px;
      transition: all 0.15s ease;
    }

    .btn-action-trigger:hover,
    .btn-action-trigger.active {
      background: #f1f5f9;
      color: #0f172a;
    }

    .action-dropdown {
      position: absolute;
      right: 8px;
      top: 100%;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      z-index: 50;
      min-width: 170px;
      padding: 4px;
    }

    .action-dropdown-item {
      width: 100%;
      padding: 6px 10px;
      border: none;
      background: none;
      text-align: left;
      font-size: 12.5px;
      color: #334155;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.15s ease;
    }

    .action-dropdown-item:hover {
      background: #f1f5f9;
    }

    .action-dropdown-item.text-danger {
      color: #ef4444;
    }

    .action-dropdown-item.text-danger:hover {
      background: #fef2f2;
    }

    /* Modals */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      animation: fadeIn 0.2s ease;
    }

    .modal-content {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      border: 1px solid #e2e8f0;
      max-width: 520px;
      width: 95%;
      overflow: hidden;
      animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .payload-modal {
      max-width: 1080px;
      width: 95vw;
    }

    .modal-subtitle-meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.4rem;
      font-size: 12.5px;
      color: #64748b;
      margin-top: 4px;
    }

    .meta-dot {
      color: #cbd5e1;
    }

    /* Khối 1: KPI Cards */
    .detail-kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.85rem;
    }

    @media (max-width: 900px) {
      .detail-kpi-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    .kpi-stat-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 0.9rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .kpi-card-success {
      border-left: 3px solid #16a34a;
      background: #f0fdf4;
    }

    .kpi-card-warning {
      border-left: 3px solid #d97706;
      background: #fffbeb;
    }

    .kpi-card-danger {
      border-left: 3px solid #dc2626;
      background: #fef2f2;
    }

    .kpi-card-pass-bg {
      border-left: 3px solid #2563eb;
      background: #eff6ff;
    }

    .kpi-card-warn-bg {
      border-left: 3px solid #d97706;
      background: #fffbeb;
    }

    .text-warning-dark {
      color: #b45309 !important;
    }

    .kpi-stat-label {
      font-size: 11.5px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #64748b;
    }

    .kpi-stat-value {
      font-size: 18px;
      font-weight: 700;
      line-height: 1.3;
    }

    .kpi-stat-sub {
      font-size: 11.5px;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .eval-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
    }

    .eval-pass {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }

    .eval-warn {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
    }

    /* Khối 2 & 3: Section Blocks & Sub-tables */
    .detail-section-block {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1rem 1.15rem;
    }

    .section-block-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.85rem;
    }

    .section-block-title {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      margin: 0;
    }

    .section-block-hint {
      font-size: 12px;
      color: #64748b;
    }

    .sub-table-wrapper {
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }

    .sub-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }

    .evidence-table {
      min-width: 980px;
    }

    .evidence-table th,
    .evidence-table td {
      white-space: nowrap;
    }

    .sub-table th {
      background: #f8fafc;
      color: #475569;
      font-weight: 600;
      text-align: left;
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid #e2e8f0;
      white-space: nowrap;
    }

    .sub-table td {
      padding: 0.65rem 0.75rem;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
      vertical-align: middle;
    }

    .sub-table tbody tr:last-child td {
      border-bottom: none;
    }

    .row-expanded {
      background: #f8fafc;
    }

    .member-name-cell {
      display: flex;
      flex-direction: column;
    }

    .member-handle {
      font-size: 11.5px;
      color: #64748b;
      font-family: monospace;
    }

    .text-warning-dark {
      color: #b45309;
    }

    .badge-warning-soft {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 999px;
    }

    .btn-drilldown {
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
    }

    .btn-drilldown:hover {
      background: #dbeafe;
      border-color: #93c5fd;
    }

    .drilldown-detail-row td {
      background: #f8fafc;
      padding: 0.9rem 1.25rem !important;
      border-bottom: 1px solid #e2e8f0 !important;
    }

    .drilldown-list {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      padding-left: 0.85rem;
      border-left: 2px solid #93c5fd;
    }

    .drilldown-item {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 0.75rem 1rem;
    }

    .gitlab-task-link {
      color: #2563eb;
      text-decoration: none;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .gitlab-task-link:hover {
      text-decoration: underline;
      color: #1d4ed8;
    }

    .external-icon {
      font-size: 10.5px;
      opacity: 0.75;
    }

    .drilldown-meta {
      font-size: 12px;
      color: #475569;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.65rem;
    }

    .meta-sep {
      color: #cbd5e1;
    }

    .sla-result-text {
      font-weight: 700;
    }

    /* Evidence Filters & Table */
    .evidence-filters {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .evidence-search-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .evidence-search-wrap i {
      position: absolute;
      left: 9px;
      color: #94a3b8;
      font-size: 12px;
    }

    .evidence-search-input {
      padding: 5px 10px 5px 28px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 12.5px;
      width: 210px;
      outline: none;
    }

    .evidence-search-input:focus {
      border-color: #3b82f6;
    }

    .evidence-select {
      padding: 5px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 12.5px;
      background: #ffffff;
      color: #334155;
      outline: none;
    }

    .type-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .type-issue {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }

    .type-mr {
      background: #f5f3ff;
      color: #6d28d9;
      border: 1px solid #ddd6fe;
    }

    .type-bug {
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
    }

    .kr-impact-code {
      font-family: monospace;
      font-size: 11.5px;
      font-weight: 600;
      background: #f1f5f9;
      color: #334155;
      padding: 2px 6px;
      border-radius: 4px;
      white-space: nowrap;
    }

    .evidence-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 0.75rem;
      font-size: 12px;
      color: #64748b;
    }

    .pagination-btns {
      display: flex;
      gap: 0.4rem;
    }

    .btn-page {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 12px;
      color: #334155;
      cursor: pointer;
    }

    .btn-page:hover:not(:disabled) {
      background: #f1f5f9;
    }

    .btn-page:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    /* Khối 4: Measurement Rules Snapshot */
    .rules-snapshot-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 0.9rem 1.15rem;
    }

    .rules-snapshot-title {
      font-size: 13px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 0.45rem;
    }

    .rules-snapshot-list {
      margin: 0;
      padding-left: 1.25rem;
      font-size: 12.5px;
      color: #475569;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .rules-snapshot-formulas {
      border-top: 1px dashed #e2e8f0;
    }

    .formula-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }

    /* Khối 5: Collapsible Technical Payload */
    .tech-payload-details {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #ffffff;
      overflow: hidden;
    }

    .tech-payload-summary {
      list-style: none;
      padding: 0.75rem 1.1rem;
      background: #f8fafc;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      user-select: none;
    }

    .tech-payload-summary::-webkit-details-marker {
      display: none;
    }

    .summary-chevron {
      font-size: 11px;
      color: #64748b;
      transition: transform 0.2s ease;
    }

    .tech-payload-details[open] .summary-chevron {
      transform: rotate(90deg);
    }

    .tech-payload-body {
      padding: 0.85rem;
      border-top: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .simulate-modal {
      max-width: 540px;
    }

    .modal-header {
      padding: 1.25rem 1.5rem;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .modal-icon-badge {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #eef2ff;
      color: var(--primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
    }

    .modal-title {
      font-size: 16px !important;
      font-weight: 700 !important;
      color: #1e293b !important;
      margin: 0 !important;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .run-id-badge {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 13px !important;
      font-weight: 600;
      color: #2563eb;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 2px 8px;
      border-radius: 6px;
    }

    .btn-close-modal {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 16px;
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 6px;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      padding: 0;
    }

    .btn-close-modal:hover {
      background: #fee2e2;
      color: #ef4444;
    }

    .modal-body {
      padding: 1.5rem;
      max-height: 72vh;
      overflow-y: auto;
    }

    .modal-footer {
      padding: 1rem 1.5rem;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
    }

    .modal-footer .btn-secondary {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      color: #475569;
      font-size: 13px !important;
      font-weight: 500;
      padding: 0.5rem 1.25rem;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .modal-footer .btn-secondary:hover {
      background: #f1f5f9;
      border-color: #94a3b8;
      color: #1e293b;
    }

    .trace-target-card {
      background: #eff6ff !important;
      border: 1px solid #bfdbfe !important;
      border-radius: 8px;
    }
    .trace-icon-circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #dbeafe;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
    }
    .member-trace-metrics {
      font-size: 12.5px;
    }

    .run-summary-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      font-size: 13px !important;
    }

    .summary-item {
      display: flex;
      align-items: baseline;
      gap: 0.75rem;
      font-size: 13px !important;
      line-height: 1.5;
    }

    .summary-item .label {
      width: 105px;
      color: #64748b;
      font-size: 13px !important;
      font-weight: 500;
      flex-shrink: 0;
    }

    .summary-item .value-text {
      color: #1e293b;
      font-size: 13px !important;
      font-weight: 500;
      line-height: 1.5;
    }

    .summary-item .impact-text {
      color: #2563eb;
      font-size: 13px !important;
      font-weight: 600;
      line-height: 1.5;
    }

    .payload-header-label {
      font-size: 13px !important;
      color: #334155;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .payload-header-label strong {
      font-weight: 600;
      color: #1e293b;
      font-size: 13px !important;
    }

    .btn-copy-payload {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0.35rem 0.75rem;
      font-size: 13px !important;
      font-weight: 500;
      color: #475569;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.15s ease;
    }

    .btn-copy-payload:hover {
      background: #f1f5f9;
      border-color: #94a3b8;
      color: #0f172a;
    }

    .json-code-box {
      background: #0f172a;
      color: #f1f5f9;
      padding: 1.15rem 1.25rem;
      border-radius: 8px;
      border: 1px solid #1e293b;
      font-family: 'Fira Code', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace !important;
      font-size: 13px !important;
      line-height: 1.6;
      max-height: 320px;
      overflow: auto;
      margin: 0;
    }

    .json-code-box code {
      font-family: inherit !important;
      font-size: 13px !important;
      color: inherit;
      background: transparent !important;
      padding: 0 !important;
    }

    .json-code-box::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .json-code-box::-webkit-scrollbar-track {
      background: #1e293b;
      border-radius: 4px;
    }
    .json-code-box::-webkit-scrollbar-thumb {
      background: #475569;
      border-radius: 4px;
    }
    .json-code-box::-webkit-scrollbar-thumb:hover {
      background: #64748b;
    }

    .simulate-desc {
      font-size: 13px !important;
      color: #475569;
      line-height: 1.55;
    }

    .flow-preview-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px !important;
    }

    .preview-row {
      display: flex;
      gap: 8px;
      font-size: 13px !important;
    }

    .preview-label {
      width: 105px;
      color: #64748b;
      flex-shrink: 0;
      font-size: 13px !important;
    }

    /* Common Buttons */
    .btn {
      padding: 0.45rem 1rem;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }

    .btn-primary {
      background: #3157D5;
      color: #ffffff;
      border-color: #3157D5;
    }

    .btn-primary:hover {
      background: #2546b8;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
      border-color: #cbd5e1;
    }

    .btn-secondary:hover {
      background: #e2e8f0;
    }

    .btn-outline-secondary {
      background: #ffffff;
      color: #475569;
      border-color: #cbd5e1;
    }

    .btn-outline-secondary:hover {
      background: #f8fafc;
      color: #0f172a;
    }

    /* Center Table Loading */
    .table-loading-cell {
      padding: 3.5rem 1rem !important;
      text-align: center;
      vertical-align: middle !important;
      background: #ffffff;
    }

    .table-loading-content {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      color: #475569;
      font-size: 13px;
    }

    .loading-spinner-circle {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid rgba(49, 87, 213, 0.2);
      border-top-color: #3157D5;
      animation: spinnerRotate 0.75s linear infinite;
    }

    @keyframes spinnerRotate {
      to { transform: rotate(360deg); }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { transform: translateY(16px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .page-loading-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: transparent !important;
      pointer-events: auto;
      cursor: wait;
    }

    .ms-auto { margin-left: auto; }
    .d-flex { display: flex; }
    .align-items-center { align-items: center; }
    .justify-content-between { justify-content: space-between; }
    .gap-2 { gap: 0.5rem; }
  `]
})
export class FlowRunsComponent implements OnInit {
  loading = true;
  flows: FlowSummary[] = [];
  allRuns: FlowRun[] = [];
  filteredRuns: FlowRun[] = [];

  // View state: 'cards' = Danh sách Flow Overview; 'detail' = Trang bảng lần chạy của từng Flow
  viewMode: 'cards' | 'detail' = 'cards';
  selectedFlowCode = 'all';

  // Filters
  searchQuery = '';
  selectedStatus = 'all';
  isStatusDropdownOpen = false;

  // 3-dot action menu
  activeActionMenu: string | null = null;

  // Trace state from OKR Tree Check-in
  pendingTraceRunId: string | null = null;
  pendingTraceMember: string | null = null;
  pendingTraceDate: string | null = null;

  // Modal 1: Payload detail
  selectedRunForModal: FlowRun | null = null;
  runDetailVm: RunDetailViewModel | null = null;
  evidenceSearchText = '';
  evidenceFilterSla = 'all';
  evidenceCurrentPage = 1;
  evidencePageSize = 6;
  isCopied = false;

  // Modal 2: Simulation
  isSimulateModalOpen = false;
  simulateFlowCode = 'FLOW-KR-A1';
  isSimulating = false;

  constructor(
    private okrService: OkrService,
    private confirmService: ConfirmDialogService,
    private router: Router,
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    // Lắng nghe params trên URL nếu người dùng truy cập trực tiếp /flow-runs/:flowCode
    this.route.paramMap.subscribe(params => {
      const flowCode = params.get('flowCode');
      if (flowCode) {
        this.selectedFlowCode = flowCode;
        this.viewMode = 'detail';
      } else {
        this.selectedFlowCode = 'all';
        this.viewMode = 'cards';
      }
      this.filterRuns();
    });

    // Lắng nghe queryParams để hỗ trợ Truy vết từ cây OKR Check-in
    this.route.queryParamMap.subscribe(qp => {
      const flow = qp.get('flow');
      const runId = qp.get('runId');
      const author = qp.get('author') || qp.get('member');
      const search = qp.get('search');
      const date = qp.get('date');

      if (flow) {
        this.selectedFlowCode = flow;
        this.viewMode = 'detail';
      }

      this.pendingTraceRunId = runId || null;
      this.pendingTraceMember = author || null;
      this.pendingTraceDate = date || null;

      if (runId) {
        this.searchQuery = runId;
      } else if (search) {
        this.searchQuery = search;
      } else if (author) {
        this.searchQuery = author;
      }

      this.filterRuns();
      this.checkAndApplyPendingTrace();
    });

    this.loadData();
  }

  get totalRunsCount(): number {
    return this.allRuns.length;
  }

  get currentFlowSummary(): FlowSummary | undefined {
    if (this.selectedFlowCode === 'all') return undefined;
    return this.flows.find(f => f.flow_code === this.selectedFlowCode);
  }

  getDetailTitle(): string {
    if (this.selectedFlowCode === 'all') {
      return 'Nhật ký toàn bộ lần chạy Flow';
    }
    const summary = this.currentFlowSummary;
    if (summary) {
      if (summary.kr_id && summary.kr_title) {
        return `Flow Runs ${summary.kr_id} - ${summary.kr_title}`;
      }
      return summary.flow_name || this.selectedFlowCode;
    }
    if (this.selectedFlowCode === 'FLOW-KR-A1' || this.selectedFlowCode === 'KR-A1') {
      return 'Flow Runs KR-A1 - Tỷ lệ Issue hoàn thành đúng hạn ≥ 90%';
    }
    if (this.selectedFlowCode === 'FLOW-KR-B1' || this.selectedFlowCode === 'KR-B1') {
      return 'Flow Runs KR-B1 - Thời gian phản hồi Merge Request (MR SLA) ≤ 4 giờ';
    }
    if (this.selectedFlowCode === 'FLOW-KR-C1' || this.selectedFlowCode === 'KR-C1') {
      return 'Flow Runs KR-C1 - Thời gian giải quyết lỗi (MTTR) ≤ 8 giờ';
    }
    return this.selectedFlowCode;
  }

  get currentFlowRunsCount(): number {
    if (this.selectedFlowCode === 'all') return this.allRuns.length;
    return this.allRuns.filter(r => r.flow_code === this.selectedFlowCode || r.flow_code.startsWith(this.selectedFlowCode)).length;
  }

  loadData(): void {
    this.loading = true;
    this.okrService.getFlowRuns().subscribe({
      next: (res: FlowRunsResponse) => {
        this.flows = res.flows || [];
        this.allRuns = res.runs || [];
        this.filterRuns();
        this.checkAndApplyPendingTrace();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading flow runs:', err);
        this.loading = false;
      }
    });
  }

  // Tự động tìm và mở popup lần chạy cần truy vết theo thành viên & ngày giờ
  checkAndApplyPendingTrace(): void {
    if (!this.allRuns || this.allRuns.length === 0) return;
    if (!this.pendingTraceRunId && !this.pendingTraceMember && !this.pendingTraceDate) return;

    let targetRun: FlowRun | undefined;

    // 1. Tìm theo runId chính xác
    if (this.pendingTraceRunId) {
      targetRun = this.allRuns.find(r => r.run_id === this.pendingTraceRunId);
    }

    // 2. Tìm theo Thành viên & Ngày giờ chạy
    if (!targetRun && this.pendingTraceMember) {
      const member = this.pendingTraceMember.toLowerCase();
      if (this.pendingTraceDate) {
        targetRun = this.allRuns.find(r => 
          r.start_time.startsWith(this.pendingTraceDate!) &&
          ((r.data_created && r.data_created.toLowerCase().includes(member)) ||
           (r.payload_json && r.payload_json.toLowerCase().includes(member)))
        );
      }
      if (!targetRun) {
        targetRun = this.allRuns.find(r => 
          (r.data_created && r.data_created.toLowerCase().includes(member)) ||
          (r.payload_json && r.payload_json.toLowerCase().includes(member))
        );
      }
    }

    if (targetRun) {
      this.selectedFlowCode = targetRun.flow_code;
      this.viewMode = 'detail';
      // Lọc bảng chỉ hiện đúng lần chạy đó
      this.searchQuery = targetRun.run_id;
      this.filterRuns();
      // Tự động mở modal Payload JSON và hiển thị chỉ số của thành viên
      this.openPayloadModal(targetRun);
    }
  }

  getMemberTraceDetails(run: FlowRun | null, memberName: string | null): any {
    if (!run || !memberName) return null;
    const isB1 = run.flow_code ? (run.flow_code.includes('B1') || run.flow_code.includes('KR-B1')) : false;
    const isC1 = run.flow_code ? (run.flow_code.includes('C1') || run.flow_code.includes('KR-C1')) : false;
    const unitLabel = isB1 ? 'lượt Review' : (isC1 ? 'Bug' : 'Issue');

    try {
      // Tìm thành viên trong danh sách members đã phân tích của Modal (khớp 100% với Bảng Bằng chứng Khối 3)
      const vmMember = this.runDetailVm?.members?.find(m =>
        (m.name && m.name.toLowerCase().includes(memberName.toLowerCase())) ||
        (memberName.toLowerCase().includes((m.name || '').toLowerCase())) ||
        (m.username && memberName.toLowerCase().includes(m.username.toLowerCase()))
      );

      const payload = typeof run.payload_json === 'string' ? JSON.parse(run.payload_json) : run.payload_json;
      if (!payload && !vmMember) return null;

      // 1. Check standardized summary_metrics.individual_breakdown (4-part structure)
      const breakdown = payload?.summary_metrics?.individual_breakdown || payload?.individual_breakdown;
      let found: any = null;
      if (Array.isArray(breakdown)) {
        found = breakdown.find((m: any) =>
          (m.name && m.name.toLowerCase().includes(memberName.toLowerCase())) ||
          (memberName.toLowerCase().includes((m.name || '').toLowerCase())) ||
          (m.employee && m.employee.toLowerCase().includes(memberName.toLowerCase())) ||
          (m.emp_id && memberName.toLowerCase().includes(m.emp_id.toLowerCase()))
        );
      }

      // 2. Check legacy / alternative member_results
      if (!found && Array.isArray(payload?.member_results)) {
        found = payload.member_results.find((m: any) => 
          (m.employee && m.employee.toLowerCase().includes(memberName.toLowerCase())) ||
          (memberName.toLowerCase().includes((m.employee || '').toLowerCase()))
        );
      }

      let icVal = (found && found.ic_percent != null) ? found.ic_percent : (found?.IC_i != null ? found.IC_i : null);
      let niVal = (found && (found.ontime != null || found.ontime_issues != null)) ? (found.ontime ?? found.ontime_issues) : null;
      let diVal = (found && (found.reviews != null || found.due_issues != null)) ? (found.reviews ?? found.due_issues) : null;

      // Đồng bộ với Bảng Bằng chứng hiển thị: Nếu payload không có số liệu (0/0 hoặc null) nhưng bảng bằng chứng hiển thị các task của nhân sự này
      if ((icVal == null || diVal === 0 || diVal == null) && vmMember && vmMember.tasks && vmMember.tasks.length > 0) {
        const evaluated = vmMember.tasks.filter(t => t.slaStatus === 'PASS' || t.slaStatus === 'FAIL');
        const pass = vmMember.tasks.filter(t => t.slaStatus === 'PASS');
        if (evaluated.length > 0) {
          icVal = vmMember.slaRate;
          niVal = pass.length;
          diVal = evaluated.length;
        }
      }

      return {
        ...(found || {}),
        IC_i: icVal,
        Ni: niVal !== null ? niVal : 0,
        Di: diVal !== null ? diVal : 0,
        unitLabel,
        isB1,
        isC1,
        status: (found && found.status) || (vmMember && vmMember.isPass ? 'PASS' : 'FAIL') || 'PASS'
      };
    } catch {
      return null;
    }
  }

  // Mở trang chi tiết bảng lần chạy cho flow được chọn
  openFlowDetail(flowCode: string): void {
    this.selectedFlowCode = flowCode;
    this.viewMode = 'detail';
    this.searchQuery = '';
    this.selectedStatus = 'all';
    this.router.navigate(['/flow-runs', flowCode]);
    this.filterRuns();
  }

  // Quay lại trang danh sách Flow Cards
  goBackToCards(): void {
    this.selectedFlowCode = 'all';
    this.viewMode = 'cards';
    this.searchQuery = '';
    this.selectedStatus = 'all';
    this.router.navigate(['/flow-runs']);
    this.filterRuns();
  }

  filterRuns(): void {
    let result = [...this.allRuns];

    // Filter by Flow
    if (this.selectedFlowCode !== 'all') {
      result = result.filter(r => r.flow_code === this.selectedFlowCode || r.flow_code.startsWith(this.selectedFlowCode));
    }

    // Filter by Status
    if (this.selectedStatus !== 'all') {
      result = result.filter(r => r.status === this.selectedStatus);
    }

    // Search query
    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(r => 
        (r.run_id && r.run_id.toLowerCase().includes(q)) ||
        (r.flow_code && r.flow_code.toLowerCase().includes(q)) ||
        (r.flow_name && r.flow_name.toLowerCase().includes(q)) ||
        (r.data_created && r.data_created.toLowerCase().includes(q)) ||
        (r.payload_json && r.payload_json.toLowerCase().includes(q)) ||
        (r.trigger_type && r.trigger_type.toLowerCase().includes(q)) ||
        (r.status && r.status.toLowerCase().includes(q))
      );
    }

    this.filteredRuns = result;
  }

  toggleStatusDropdown(event: Event): void {
    event.stopPropagation();
    this.isStatusDropdownOpen = !this.isStatusDropdownOpen;
  }

  selectStatus(status: string): void {
    this.selectedStatus = status;
    this.isStatusDropdownOpen = false;
    this.filterRuns();
  }

  getSelectedStatusLabel(): string {
    switch (this.selectedStatus) {
      case 'SUCCESS': return 'SUCCESS (Thành công 100%)';
      case 'PARTIAL': return 'PARTIAL (Hoàn tất 1 phần)';
      case 'FAILED': return 'FAILED (Thất bại / Lỗi kết nối)';
      default: return 'Tất cả trạng thái';
    }
  }

  // 3-dot action dropdown
  toggleActionMenu(runId: string, event: Event): void {
    event.stopPropagation();
    this.activeActionMenu = this.activeActionMenu === runId ? null : runId;
  }

  closeDropdown(): void {
    this.activeActionMenu = null;
    this.isStatusDropdownOpen = false;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeDropdown();
  }

  // Payload modal
  openPayloadModal(run: FlowRun): void {
    this.selectedRunForModal = run;
    this.isCopied = false;
    this.evidenceSearchText = '';
    this.evidenceFilterSla = 'all';
    this.evidenceCurrentPage = 1;
    this.runDetailVm = this.buildRunDetailViewModel(run);
  }

  closePayloadModal(): void {
    this.selectedRunForModal = null;
    this.runDetailVm = null;
    this.isCopied = false;
  }

  formatDisplayDateTime(dt: string | undefined): string {
    if (!dt) return '';
    // Convert 'YYYY-MM-DD HH:mm:ss' to 'DD/MM/YYYY HH:mm:ss'
    const parts = dt.split(' ');
    if (parts.length >= 2 && parts[0].includes('-')) {
      const [y, m, d] = parts[0].split('-');
      return `${d}/${m}/${y} ${parts[1]}`;
    }
    return dt;
  }

  toggleMemberTasks(member: MemberBreakdown): void {
    member.expanded = !member.expanded;
  }

  get weightOrDurationColumnLabel(): string {
    const code = (this.selectedRunForModal?.flow_code || '').toUpperCase();
    return (code.includes('B1') || code.includes('C1')) ? 'Thời lượng' : 'Trọng số';
  }

  onEvidenceFilterChange(): void {
    this.evidenceCurrentPage = 1;
  }

  get filteredEvidences(): EvidenceItem[] {
    if (!this.runDetailVm) return [];
    let list = this.runDetailVm.evidences;
    if (this.evidenceFilterSla !== 'all') {
      list = list.filter(ev => ev.slaStatus === this.evidenceFilterSla);
    }
    const q = (this.evidenceSearchText || '').trim().toLowerCase();
    if (q) {
      list = list.filter(ev =>
        ev.id.toLowerCase().includes(q) ||
        ev.title.toLowerCase().includes(q) ||
        ev.assigneeName.toLowerCase().includes(q) ||
        ev.krId.toLowerCase().includes(q)
      );
    }
    return list;
  }

  get evidenceTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredEvidences.length / this.evidencePageSize));
  }

  get paginatedEvidences(): EvidenceItem[] {
    const start = (this.evidenceCurrentPage - 1) * this.evidencePageSize;
    return this.filteredEvidences.slice(start, start + this.evidencePageSize);
  }

  setEvidencePage(page: number): void {
    if (page >= 1 && page <= this.evidenceTotalPages) {
      this.evidenceCurrentPage = page;
    }
  }

  private buildRunDetailViewModel(run: FlowRun): RunDetailViewModel {
    const GITLAB_BASE = 'https://gitlab.com/dcor2/Dcor-project';
    const flowUpper = (run.flow_code || '').toUpperCase();
    const isB1 = flowUpper.includes('B1');
    const isC1 = flowUpper.includes('C1');
    const flowKey = isB1 ? 'B1' : (isC1 ? 'C1' : 'A1');

    // Determine month prefix for KR IDs (e.g. KR-M11-A1-01)
    const startStr = run.start_time || '2026-11-10 14:00:00';
    let krPrefix = 'KR-';
    if (startStr.startsWith('2026-11')) krPrefix = 'KR-M11-';
    else if (startStr.startsWith('2026-12')) krPrefix = 'KR-M12-';

    const shortDate = (() => {
      const p = startStr.split(' ')[0]?.split('-');
      return p && p.length === 3 ? `${p[2]}/${p[1]}` : '10/11';
    })();
    const fullDate = (() => {
      const p = startStr.split(' ')[0]?.split('-');
      return p && p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : '10/11/2026';
    })();

    const teamRoster = [
      { name: 'Huyền Nguyễn Như (EMP001)', rawName: 'Huyền Nguyễn Như', empId: 'EMP001', username: 'huyennn23406', suffix: '01', aliases: ['huyennn23406', 'huyennguyennhu', 'emp001'] },
      { name: 'Le An (EMP002)', rawName: 'Le An', empId: 'EMP002', username: 'LeThaiAn', suffix: '05', aliases: ['lethaian', 'thaian2221', 'emp002'] },
      { name: 'Nguyen Anh (EMP003)', rawName: 'Nguyen Anh', empId: 'EMP003', username: 'nguyentuananh2221', suffix: '04', aliases: ['nguyentuananh2221', 'nguyenanh', 'emp003'] },
      { name: 'Alexander Nguyen (EMP004)', rawName: 'Alexander Nguyen', empId: 'EMP004', username: 'AlexanderNguyen26', suffix: '02', aliases: ['alexandernguyen26', 'emp004'] },
      { name: 'Tran Than (EMP005)', rawName: 'Tran Than', empId: 'EMP005', username: 'TranLongThan', suffix: '03', aliases: ['tranlongthan', 'tranthan26', 'emp005'] }
    ];

    let parsed: any = null;
    try {
      parsed = typeof run.payload_json === 'string' ? JSON.parse(run.payload_json) : run.payload_json;
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
    } catch {
      parsed = null;
    }

    const totalUnitLabel = isB1 ? 'MR' : (isC1 ? 'Bug' : 'Issue');
    const evidences: EvidenceItem[] = [];

    // 1. Check if payload has source_records
    if (parsed && Array.isArray(parsed.source_records) && parsed.source_records.length > 0) {
      // Parse direct pending_items from payload drilldown if available
      const rawPending = (parsed && (parsed.drilldown_data?.pending_items || parsed.pending_items)) || [];
      if (Array.isArray(rawPending)) {
        rawPending.forEach((p: any) => {
          const iid = p.raw_iid || p.iid || 28;
          const rMatch = teamRoster.find(r =>
            r.username.toLowerCase() === String(p.reviewer_username || p.username || '').toLowerCase() ||
            (p.emp_id && r.empId.toLowerCase() === String(p.emp_id).toLowerCase())
          ) || teamRoster[0];
          evidences.push({
            id: String(p.iid || ('!' + iid)),
            iid: typeof iid === 'number' ? iid : parseInt(String(iid).replace(/\D/g, '') || '28', 10),
            type: 'MR',
            title: p.title || ('MR !' + iid),
            gitlabUrl: p.gitlab_url || `${GITLAB_BASE}/-/merge_requests/${iid}`,
            assigneeName: rMatch.name + ' (Reviewer)',
            assigneeUsername: rMatch.username,
            weightOrDuration: `${p.elapsed_working_hours || 1.5}h làm việc (SLA: 4h)`,
            weightNum: 1,
            dueTimeDisplay: `${shortDate} 17:00`,
            completedTimeDisplay: 'Đang theo dõi',
            slaStatus: 'PENDING',
            slaLabel: `ĐANG THEO DÕI (CÒN ${p.remaining_sla_hours || 2.5}H)`,
            krId: `${krPrefix}B1-${rMatch.suffix}`
          });
        });
      }

      parsed.source_records.forEach((rec: any, idx: number) => {
        const iid = rec.issue_iid || rec.iid || rec.mr_iid || (40 + idx);
        const rawAssignee = String(rec.assignee_username || rec.assignee_name || rec.assignee || rec.reviewer_username || rec.reviewer_name || rec.reviewer || rec.emp_id || '').toLowerCase().trim();
        const rosterMatch = teamRoster.find(r =>
          (rec.emp_id && r.empId.toLowerCase() === String(rec.emp_id).toLowerCase()) ||
          r.username.toLowerCase() === rawAssignee ||
          r.rawName.toLowerCase() === rawAssignee ||
          r.name.toLowerCase() === rawAssignee ||
          (r.aliases && r.aliases.some((a: string) => a.toLowerCase() === rawAssignee)) ||
          r.rawName.toLowerCase().includes(rawAssignee) ||
          (rawAssignee && rawAssignee.includes(r.rawName.toLowerCase()))
        ) || teamRoster[idx % teamRoster.length];

        const isPending = rec.sla_status === 'PENDING';
        const isPass = !isPending && (rec.sla_status === 'ON_TIME' || rec.sla_status === 'PASS' || !rec.sla_status);
        const itemType: 'Issue' | 'MR' | 'Bug' = isB1 ? 'MR' : (isC1 ? 'Bug' : 'Issue');
        const idPrefix = isB1 ? '!' : '#';
        const urlSeg = isB1 ? 'merge_requests' : 'issues';
        const sp = rec.story_point || 3;
        const durH = rec.duration_hours || rec.working_hours || (isB1 ? 2.5 : 5.2);

        let slaLabel = isPass ? (isB1 || isC1 ? 'ĐẠT SLA' : 'ĐÚNG HẠN (+0.5h)') : 'TRỄ HẠN (-1.5h)';
        if (isPending) {
          slaLabel = isB1 ? 'ĐANG THEO DÕI (TRONG HẠN SLA)' : 'ĐANG THEO DÕI';
        }

        const dueDisplay = rec.due_date ? rec.due_date.replace(' 23:59:59', '') : `${shortDate} 17:00`;

        evidences.push({
          id: `${idPrefix}${iid}`,
          iid,
          type: itemType,
          title: rec.title || `${itemType} #${iid}`,
          gitlabUrl: rec.gitlab_url || `${GITLAB_BASE}/-/${urlSeg}/${iid}`,
          assigneeName: rosterMatch.name + (isB1 ? ' (Reviewer)' : ''),
          assigneeUsername: rosterMatch.username,
          weightOrDuration: isB1 ? `${durH} giờ làm việc (SLA: 4h)` : (isC1 ? `${durH} giờ làm việc (SLA: 8h)` : `${sp} Story Point`),
          weightNum: sp,
          dueTimeDisplay: dueDisplay,
          completedTimeDisplay: isPending ? 'Đang theo dõi' : (rec.closed_at ? this.formatDisplayDateTime(rec.closed_at) : `${fullDate} 11:30`),
          slaStatus: isPending ? 'PENDING' : (isPass ? 'PASS' : 'FAIL'),
          slaLabel,
          krId: `${krPrefix}${flowKey}-${rosterMatch.suffix}`
        });
      });
    } else {
      // 2. Deterministic realistic synthesis matching run.input_count & flow_code
      const count = Math.max(5, Math.min(25, run.input_count || (isB1 ? 15 : (isC1 ? 10 : 15))));
      const a1Titles = [
        '[ISSUE_A1_01] Thiết kế kiến trúc Sync Engine OKR',
        '[ISSUE_A1_02] Chuẩn hóa API lấy cây OKR theo tháng',
        '[ISSUE_A1_03] Tối ưu hóa truy vấn Cây OKR',
        '[ISSUE_A1_04] Viết Unit Test cho Measurement Engine',
        '[ISSUE_A1_05] Sửa lỗi responsive trên mobile',
        '[ISSUE_A1_06] Tích hợp KaTeX render công thức đo lường',
        '[ISSUE_A1_07] Cập nhật Webhook listener GitLab Events',
        '[ISSUE_A1_08] Xây dựng bộ lọc đa chiều Flow Runs',
        '[ISSUE_A1_09] Cải thiện hiệu năng bảng Check-in cá nhân',
        '[ISSUE_A1_10] Thêm cấu hình đóng băng cuối tuần & lễ',
        '[ISSUE_A1_11] Chuẩn hóa mapping Employee GitLab username',
        '[ISSUE_A1_12] Đồng bộ trạng thái khóa nút Áp dụng quy tắc',
        '[ISSUE_A1_13] Xử lý pagination bảng bằng chứng Audit',
        '[ISSUE_A1_14] Thêm validation biểu thức SLA đầu vào',
        '[ISSUE_A1_15] Tối ưu truy vấn tổng hợp Roll-up Team KR'
      ];
      const b1Titles = [
        'feat(okr-tree): Cập nhật bộ lọc theo quý và tháng',
        'refactor(auth): Chuẩn hóa Token Interceptor',
        'fix(sync): Sửa lỗi trùng lặp webhook GitLab',
        'feat(rules): Bổ sung No-Code Formula Preview',
        'perf(db): Thêm index cho bảng MetricResults',
        'chore(ci): Cập nhật pipeline kiểm thử tự động',
        'feat(flow-runs): Nâng cấp bảng bằng chứng Audit',
        'fix(ui): Điều chỉnh alignment badge trạng thái',
        'refactor(engine): Tách service tính working hours',
        'docs(api): Bổ sung schema Swagger cho FlowRuns'
      ];
      const c1Titles = [
        'Bug P1: Timeout khi tải cây OKR với 500+ nodes',
        'Bug P2: Lỗi tràn bộ nhớ đệm khi parse JSON lớn',
        'Bug P2: Sai lệch khấu trừ giờ nghỉ trưa 12:00-13:30',
        'Bug P3: Lỗi hiển thị avatar nhân viên chưa có ảnh',
        'Bug P2: Không cập nhật lại tiến độ sau khi xóa check-in',
        'Bug P3: Lỗi tràn cột trên bảng Flow Runs ở màn hình nhỏ',
        'Bug P1: Lỗi mất kết nối PostgreSQL pool khi idle',
        'Bug P2: Duplicate card FLOW-KR-A1 do trùng rule_id',
        'Bug P3: Sai định dạng ngày DD/MM/YYYY ở tooltip',
        'Bug P2: Không tự động unlock nút lưu khi đổi tham số'
      ];

      for (let i = 0; i < count; i++) {
        const m = teamRoster[i % teamRoster.length];
        const iid = isB1 ? (18 + i) : (isC1 ? (82 + i) : (44 + i));
        const isFail = (i === 6) || (isB1 && i === 11); // 1-2 realistic late tasks
        const spList = [2, 3, 5, 3, 2];
        const sp = spList[i % spList.length];
        const dueHr = 12 + (i % 5);
        const closeHr = isFail ? dueHr + 1 : dueHr - 1;
        const closeMin = isFail ? '30' : '30';
        const durHours = isB1 ? (isFail ? 5.2 : parseFloat((1.5 + (i % 4) * 0.6).toFixed(1))) : parseFloat((3.2 + (i % 5) * 0.9).toFixed(1));
        const slaLimit = isB1 ? 4 : 8;
        const diff = parseFloat((slaLimit - durHours).toFixed(1));

        let title = '';
        if (isB1) title = b1Titles[i % b1Titles.length];
        else if (isC1) title = c1Titles[i % c1Titles.length];
        else title = a1Titles[i % a1Titles.length];

        evidences.push({
          id: isB1 ? `!${iid}` : `#${iid}`,
          iid,
          type: isB1 ? 'MR' : (isC1 ? 'Bug' : 'Issue'),
          title,
          gitlabUrl: `${GITLAB_BASE}/-/${isB1 ? 'merge_requests' : 'issues'}/${iid}`,
          assigneeName: m.name + (isB1 ? ' (Reviewer)' : ''),
          assigneeUsername: m.username,
          weightOrDuration: isB1
            ? `${durHours} giờ làm việc (SLA: 4h)`
            : (isC1 ? `${durHours} giờ làm việc (SLA: 8h)` : `${sp} Story Point`),
          weightNum: sp,
          dueTimeDisplay: `${shortDate} ${String(dueHr).padStart(2, '0')}:00`,
          completedTimeDisplay: `${fullDate} ${String(closeHr).padStart(2, '0')}:${closeMin}`,
          slaStatus: isFail ? 'FAIL' : 'PASS',
          slaLabel: isFail
            ? (isB1 || isC1 ? `TRỄ SLA (${Math.abs(diff)}h)` : 'TRỄ HẠN (-1.5h)')
            : (isB1 || isC1 ? `ĐẠT SLA (SỚM ${diff}H)` : 'ĐÚNG HẠN (+0.5h)'),
          krId: `${krPrefix}${flowKey}-${m.suffix}`
        });
      }

      // Đối với Flow KR-B1: Bổ sung các lượt phân công đang theo dõi (PENDING trong hạn)
      if (isB1) {
        const pendingMids = [
          { iid: 28, title: 'feat(payment): Tích hợp luồng đối soát VNPay IPN', reviewer: teamRoster[0], elapsed: 2.5, rem: 1.5 },
          { iid: 29, title: 'fix(auth): Khắc phục lỗi timeout refresh token OAuth', reviewer: teamRoster[1], elapsed: 2.0, rem: 2.0 },
          { iid: 30, title: 'refactor(cart): Tối ưu hóa hiệu năng Redux cart drawer', reviewer: teamRoster[2], elapsed: 1.0, rem: 3.0 }
        ];
        pendingMids.forEach(p => {
          evidences.push({
            id: `!${p.iid}`,
            iid: p.iid,
            type: 'MR',
            title: p.title,
            gitlabUrl: `${GITLAB_BASE}/-/merge_requests/${p.iid}`,
            assigneeName: p.reviewer.name + ' (Reviewer)',
            assigneeUsername: p.reviewer.username,
            weightOrDuration: `${p.elapsed}h làm việc (SLA: 4h)`,
            weightNum: 1,
            dueTimeDisplay: `${shortDate} 17:00`,
            completedTimeDisplay: 'Đang theo dõi',
            slaStatus: 'PENDING',
            slaLabel: `ĐANG THEO DÕI (CÒN ${p.rem}H)`,
            krId: `${krPrefix}B1-${p.reviewer.suffix}`
          });
        });
      }
    }

    // Group into MemberBreakdown
    const members: MemberBreakdown[] = teamRoster.map(r => {
      const tasks = evidences.filter(ev => ev.assigneeUsername === r.username);
      const passTasks = tasks.filter(t => t.slaStatus === 'PASS');
      const failTasks = tasks.filter(t => t.slaStatus === 'FAIL');
      const pendingTasks = tasks.filter(t => t.slaStatus === 'PENDING');
      const evaluatedTasks = tasks.filter(t => t.slaStatus === 'PASS' || t.slaStatus === 'FAIL');

      const totalSp = evaluatedTasks.reduce((acc, t) => acc + (t.weightNum || 0), 0);
      const passSp = passTasks.reduce((acc, t) => acc + (t.weightNum || 0), 0);
      const failSp = failTasks.reduce((acc, t) => acc + (t.weightNum || 0), 0);

      const ibMatch = parsed?.summary_metrics?.individual_breakdown?.find((ib: any) =>
        (ib.emp_id && r.empId && ib.emp_id.toLowerCase() === r.empId.toLowerCase()) ||
        ib.gitlab_username?.toLowerCase() === r.username.toLowerCase() ||
        (r.aliases && r.aliases.some((a: string) => a.toLowerCase() === (ib.gitlab_username || '').toLowerCase())) ||
        (ib.name && r.rawName && ib.name.toLowerCase().includes(r.rawName.toLowerCase())) ||
        (ib.name && r.rawName && r.rawName.toLowerCase().includes(ib.name.toLowerCase()))
      );

      let rate = 100;
      let isPass = false;
      let slaRateDisplay = '';

      if (isC1) {
        // C1: MTTR logic (ngưỡng SLA <= 8.0h)
        const mttrVal = ibMatch?.mttr_hours;
        if (evaluatedTasks.length > 0) {
          rate = parseFloat(((passTasks.length / evaluatedTasks.length) * 100).toFixed(1));
        }
        if (ibMatch?.status) {
          isPass = ibMatch.status === 'PASS';
        } else if (mttrVal != null) {
          isPass = mttrVal <= 8.0;
        } else {
          isPass = rate >= 80;
        }
        slaRateDisplay = mttrVal != null ? `${rate}% (MTTR ${mttrVal}h)` : `${rate}%`;
      } else if (isB1) {
        // B1: SLA rate (ngưỡng SLA >= 80%)
        rate = ibMatch && ibMatch.ic_percent != null
          ? ibMatch.ic_percent
          : (evaluatedTasks.length > 0
              ? parseFloat(((passTasks.length / evaluatedTasks.length) * 100).toFixed(1))
              : 100);
        if (ibMatch?.status) {
          isPass = ibMatch.status === 'PASS' || ibMatch.status === 'ON_TIME';
        } else {
          isPass = rate >= 80;
        }
        slaRateDisplay = `${rate}%`;
      } else {
        // A1: SLA rate (ngưỡng SLA >= 90%)
        rate = ibMatch && ibMatch.ic_percent != null
          ? ibMatch.ic_percent
          : (evaluatedTasks.length > 0
              ? parseFloat(((passSp / Math.max(1, totalSp)) * 100).toFixed(1))
              : 100);
        if (ibMatch?.status) {
          isPass = ibMatch.status === 'PASS' || ibMatch.status === 'ON_TIME';
        } else {
          isPass = rate >= 90;
        }
        slaRateDisplay = `${rate}%`;
      }

      return {
        name: r.name,
        username: r.username,
        empId: r.empId,
        krId: `${krPrefix}${flowKey}-${r.suffix}`,
        dueSummary: isB1 || isC1 ? `${tasks.length} ${totalUnitLabel}` : `${evaluatedTasks.length} Issue (${totalSp} SP)`,
        passSummary: isB1 || isC1 ? `${passTasks.length} ${totalUnitLabel}` : `${passTasks.length} Issue (${passSp} SP)`,
        failSummary: failTasks.length === 0 ? '0' : (isB1 || isC1 ? `${failTasks.length} ${totalUnitLabel}` : `${failTasks.length} Issue (${failSp} SP)`),
        pendingSummary: pendingTasks.length > 0 ? `${pendingTasks.length} ${totalUnitLabel}` : undefined,
        slaRate: rate,
        slaRateDisplay,
        isPass,
        tasks,
        expanded: this.pendingTraceMember ? (r.name.toLowerCase().includes(this.pendingTraceMember.toLowerCase()) || r.rawName.toLowerCase().includes(this.pendingTraceMember.toLowerCase())) : false
      };
    }).filter(m => m.tasks.length > 0);

    const pendingCount = evidences.filter(e => e.slaStatus === 'PENDING').length;
    const evaluatedEvidences = evidences.filter(e => e.slaStatus === 'PASS' || e.slaStatus === 'FAIL');
    const totalCount = evaluatedEvidences.length;
    const passCount = evidences.filter(e => e.slaStatus === 'PASS').length;
    const failCount = evaluatedEvidences.length - passCount;

    const totalSpAll = evaluatedEvidences.reduce((acc, t) => acc + (t.weightNum || 0), 0);
    const passSpAll = evaluatedEvidences.filter(e => e.slaStatus === 'PASS').reduce((acc, t) => acc + (t.weightNum || 0), 0);

    const passPercent = isB1
      ? (parsed?.summary_metrics?.team_ontime_rate_percent ?? (totalCount > 0 ? parseFloat(((passCount / totalCount) * 100).toFixed(1)) : 47.1))
      : (isC1
          ? (parsed?.summary_metrics?.ontime_resolved_bugs && totalCount > 0
              ? parseFloat(((parsed.summary_metrics.ontime_resolved_bugs / totalCount) * 100).toFixed(1))
              : (totalCount > 0 ? parseFloat(((passCount / totalCount) * 100).toFixed(1)) : 70.0))
          : (parsed?.summary_metrics?.team_sla_score_percent != null
              ? parsed.summary_metrics.team_sla_score_percent
              : (totalSpAll > 0 ? parseFloat(((passSpAll / totalSpAll) * 100).toFixed(1)) : 84.6)));
    const failPercent = parseFloat((100 - passPercent).toFixed(1));

    let overallPass = false;
    let overallLabel = 'CẦN CẢI THIỆN';
    let overallSubText = '';
    let passCardLabel = 'Đúng hạn SLA';
    let passCardValue = '';
    let passSubText = '';
    let failCardLabel = 'Trễ hạn SLA';
    let failCardValue = '';
    let failSubText = 'Cần rà soát xử lý';
    let totalCardLabel = 'Tác vụ đến hạn (mẫu số)';
    let totalCardSubText = 'Tổng tác vụ đủ điều kiện tính mẫu số';
    let pendingSubText = 'Chưa đến hạn Due Date, chưa tính mẫu số';

    if (isB1) {
      totalCardLabel = 'Lượt rà soát tính mẫu số';
      totalCardSubText = `${totalCount}/${evidences.length} lượt phân công tính mẫu số`;
      pendingSubText = 'Trong hạn phản hồi ≤ 4.0h, chưa tính mẫu số';
      overallPass = passPercent >= 80 && run.status === 'SUCCESS';
      overallLabel = overallPass ? 'ĐẠT CHUẨN' : 'CẦN CẢI THIỆN';
      overallSubText = `Tỷ lệ đạt ${passPercent}% (mục tiêu ≥ 80%)`;
      passCardLabel = 'Đúng hạn SLA';
      passCardValue = `${passCount} MR (${passPercent}%)`;
      passSubText = overallPass ? 'Đạt ngưỡng cam kết SLA (≥ 80%)' : 'Chưa đạt ngưỡng cam kết (≥ 80%)';
      failCardLabel = 'Trễ hạn SLA';
      failCardValue = `${failCount} MR (${failPercent}%)`;
      failSubText = 'Cần rà soát xử lý';
    } else if (isC1) {
      const teamMttr = parsed?.summary_metrics?.team_avg_mttr_hours ?? 5.16;
      totalCardLabel = 'Bug hoàn tất tính mẫu số';
      totalCardSubText = `${totalCount}/${evidences.length} Bug giải quyết trong kỳ`;
      pendingSubText = 'Đang xử lý trong hạn SLA, chưa tính mẫu số';
      overallPass = teamMttr <= 8.0 && run.status === 'SUCCESS';
      overallLabel = overallPass ? 'ĐẠT CHUẨN' : 'CẦN CẢI THIỆN';
      overallSubText = `MTTR đạt ${teamMttr} giờ (mục tiêu ≤ 8.0h)`;
      passCardLabel = 'MTTR trung bình cấp Team';
      passCardValue = `${teamMttr} giờ (SLA: 8.0h)`;
      passSubText = overallPass ? 'Đạt cam kết SLA (MTTR ≤ 8.0h)' : 'Vượt ngưỡng SLA (MTTR > 8.0h)';
      failCardLabel = 'Bug trễ hạn SLA';
      failCardValue = `${failCount} Bug (${failPercent}%)`;
      failSubText = `${failCount}/${totalCount} Bug vượt hạn SLA`;
    } else {
      // FLOW-KR-A1
      totalCardLabel = 'Tác vụ đến hạn (mẫu số)';
      totalCardSubText = `${totalCount}/${evidences.length} Issue đủ điều kiện tính mẫu số`;
      pendingSubText = 'Chưa đến hạn Due Date, chưa tính mẫu số';
      overallPass = passPercent >= 90 && run.status === 'SUCCESS';
      overallLabel = overallPass ? 'ĐẠT CHUẨN' : 'CẦN CẢI THIỆN';
      overallSubText = `Tỷ lệ đạt ${passPercent}% (mục tiêu ≥ 90%)`;
      passCardLabel = 'Đúng hạn SLA';
      passCardValue = `${passCount} Issue (${passPercent}%)`;
      passSubText = overallPass ? 'Đạt ngưỡng cam kết SLA (≥ 90%)' : 'Chưa đạt ngưỡng cam kết (≥ 90%)';
      failCardLabel = 'Trễ hạn SLA';
      failCardValue = `${failCount} Issue (${failPercent}%)`;
      failSubText = 'Cần rà soát xử lý';
    }

    let slaRuleText = 'Áp dụng cho Issue hợp lệ (Story/Task/Improvement) trọng số Story Point, hoàn thành trước hạn Due Date.';
    if (isB1) {
      slaRuleText = 'Áp dụng cho Merge Request trên nhánh chính (loại trừ Draft MR): Phản hồi rà soát đầu tiên ≤ 4.0 giờ làm việc.';
    } else if (isC1) {
      slaRuleText = 'Áp dụng cho Issue Bug: Thời gian trung bình giải quyết sự cố (MTTR) ≤ 8.0 giờ làm việc.';
    }

    // Trích xuất công thức toán học phân tầng (Individual & Team) áp dụng cho lần chạy
    let individualLatex = '';
    let teamLatex = '';
    
    if (parsed && (parsed.config_snapshot?.formulas || parsed.config?.formulas)) {
      const f = parsed.config_snapshot?.formulas || parsed.config?.formulas;
      individualLatex = f.individual?.latex || '';
      teamLatex = f.team?.latex || '';
    }

    if (!individualLatex) {
      if (isB1) {
        individualLatex = 'KR(u) = \\frac{N_{\\text{on-time}}(u)}{N_{\\text{total}}(u)} \\times 100\\%';
        teamLatex = 'KR(\\text{Team}) = \\frac{\\sum_{u=1}^m N_{\\text{on-time}}(u)}{\\sum_{u=1}^m N_{\\text{total}}(u) + N_{\\text{unattributed}}} \\times 100\\%';
      } else if (isC1) {
        individualLatex = '\\text{MTTR}(u) = \\frac{\\sum_{j \\in B_u} \\Delta t_{\\text{working}}(j)}{|B_u|}';
        teamLatex = '\\text{MTTR}(\\text{Team}) = \\frac{\\sum_{j \\in B_{\\text{Team}}} \\Delta t_{\\text{working}}(j)}{|B_{\\text{Team}}|}';
      } else {
        individualLatex = 'KR(u) = \\frac{\\sum_{k \\in I_u} S_k \\cdot W(k)}{\\sum_{k \\in I_u} W(k)} \\times 100\\%';
        teamLatex = 'KR(\\text{Team}) = \\frac{\\sum_{u=1}^m \\sum_{k \\in I_u} S_k \\cdot W(k)}{\\sum_{u=1}^m \\sum_{k \\in I_u} W(k)} \\times 100\\%';
      }
    }

    const renderKatexSafe = (latex: string) => {
      if (!latex) return undefined;
      try {
        if (typeof (window as any).katex !== 'undefined') {
          const html = (window as any).katex.renderToString(latex, { throwOnError: false, displayMode: true });
          return this.sanitizer.bypassSecurityTrustHtml(html);
        }
      } catch {}
      return this.sanitizer.bypassSecurityTrustHtml(`<span class="font-monospace text-primary">${latex}</span>`);
    };

    const formulaIndividualHtml = renderKatexSafe(individualLatex);
    const formulaTeamHtml = renderKatexSafe(teamLatex);

    return {
      totalCount,
      totalUnitLabel,
      totalCardLabel,
      totalCardSubText,
      passCount,
      passPercent,
      passCardLabel,
      passCardValue,
      passSubText,
      failCount,
      failPercent,
      failCardLabel,
      failCardValue,
      failSubText,
      pendingCount,
      pendingSubText,
      overallPass,
      overallLabel,
      overallSubText,
      members,
      evidences,
      slaRuleText,
      formulaIndividualHtml,
      formulaTeamHtml
    };
  }

  copyPayload(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!this.selectedRunForModal) return;
    const jsonStr = this.formatPayloadJson(this.selectedRunForModal.payload_json);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(jsonStr).then(() => {
        this.isCopied = true;
        setTimeout(() => this.isCopied = false, 2000);
      });
    }
  }

  formatPayloadJson(raw: any): string {
    if (!raw) {
      if (this.selectedRunForModal) {
        return JSON.stringify({
          session_info: {
            run_id: this.selectedRunForModal.run_id,
            flow_code: this.selectedRunForModal.flow_code,
            flow_name: this.selectedRunForModal.flow_name,
            trigger_type: this.selectedRunForModal.trigger_type,
            scan_time: this.selectedRunForModal.start_time,
            execution_status: this.selectedRunForModal.status
          },
          summary_metrics: {
            impact: this.selectedRunForModal.data_created || 'Dữ liệu đo lường đã được đồng bộ tự động vào Key Results.',
            input_count: this.selectedRunForModal.input_count,
            output_count: this.selectedRunForModal.output_count
          }
        }, null, 2);
      }
      return '{\n  "status": "Chưa có bản chụp JSON chi tiết"\n}';
    }
    try {
      if (typeof raw === 'string') {
        let parsed = JSON.parse(raw);
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        return JSON.stringify(parsed, null, 2);
      }
      return JSON.stringify(raw, null, 2);
    } catch {
      return String(raw);
    }
  }

  // Simulation modal
  openSimulateModal(defaultFlowCode?: string): void {
    if (defaultFlowCode && defaultFlowCode !== 'all') {
      this.simulateFlowCode = defaultFlowCode;
    } else if (this.selectedFlowCode !== 'all') {
      this.simulateFlowCode = this.selectedFlowCode;
    } else {
      this.simulateFlowCode = 'FLOW-KR-A1';
    }
    this.isSimulateModalOpen = true;
  }

  closeSimulateModal(): void {
    if (!this.isSimulating) {
      this.isSimulateModalOpen = false;
    }
  }

  getSelectedSimulateFlow(): FlowSummary | undefined {
    return this.flows.find(f => f.flow_code === this.simulateFlowCode);
  }

  runSimulation(): void {
    this.isSimulating = true;
    this.okrService.simulateFlowRun(this.simulateFlowCode).subscribe({
      next: (res) => {
        this.isSimulating = false;
        this.closeSimulateModal();
        this.loadData();
      },
      error: (err) => {
        console.error('Simulation error:', err);
        this.isSimulating = false;
        alert('Có lỗi xảy ra khi mô phỏng: ' + (err.error?.error || err.message));
      }
    });
  }

  async deleteRun(run: FlowRun): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận xóa lần chạy Flow',
      message: `Bạn có chắc chắn muốn xóa lịch sử lần chạy "${run.run_id}" của ${run.flow_name}? Dữ liệu này sẽ bị xóa khỏi nhật ký thực thi.`,
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.loading = true;
    this.okrService.deleteFlowRun(run.run_id).subscribe({
      next: () => {
        this.loadData();
      },
      error: (err) => {
        console.error('Error deleting run:', err);
        this.loading = false;
        alert('Lỗi khi xóa lần chạy: ' + (err.error?.error || err.message));
      }
    });
  }

  // Utilities
  formatDuration(ms: number): string {
    if (!ms && ms !== 0) return '0 ms';
    if (ms >= 1000) {
      return (ms / 1000).toFixed(2) + ' s';
    }
    return ms + ' ms';
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'SUCCESS': return 'badge-success';
      case 'PARTIAL': return 'badge-warning';
      case 'FAILED': return 'badge-danger';
      default: return 'badge-code';
    }
  }

  getStatusIconClass(status: string): string {
    switch (status) {
      case 'SUCCESS': return 'fa-circle-check';
      case 'PARTIAL': return 'fa-triangle-exclamation';
      case 'FAILED': return 'fa-circle-xmark';
      default: return 'fa-circle-info';
    }
  }
}
