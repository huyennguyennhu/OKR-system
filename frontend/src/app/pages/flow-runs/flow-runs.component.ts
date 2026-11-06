import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { OkrService, FlowSummary, FlowRun, FlowRunsResponse } from '../../services/okr.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

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
          <div class="top-bar-right d-flex align-items-center gap-2">
            <button 
              type="button" 
              class="btn btn-outline-secondary" 
              (click)="openFlowDetail('all')"
              title="Xem bảng lịch sử của toàn bộ các Flow">
              <i class="fa-solid fa-list-check me-1"></i>
              <span>Tất cả lần chạy ({{ allRuns.length }})</span>
            </button>
            <button type="button" class="btn btn-primary" (click)="openSimulateModal()">
              <i class="fa-solid fa-play me-1"></i>
              <span>Chạy mô phỏng Flow</span>
            </button>
          </div>
        </div>

        <!-- Flow Cards Section -->
        <div class="flow-cards-section mb-4">
          <div class="flow-cards-header mb-3">
            <div class="d-flex align-items-center justify-content-between">
              <span class="cards-section-label">
                <strong>Danh sách Activepieces Flows ({{ flows.length }})</strong> — <em>Nhấn vào từng card để mở trang chi tiết bảng lịch sử lần chạy:</em>
              </span>
            </div>
          </div>

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

              <div class="card-impact-box">
                <span class="impact-label"><i class="fa-solid fa-chart-line text-primary me-1"></i>Tác động gần nhất:</span>
                <span class="impact-content" [title]="flow.last_impact">{{ flow.last_impact }}</span>
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
              <span class="text-muted">/</span>
              <span class="badge badge-code" style="font-size: 12.5px;">{{ selectedFlowCode === 'all' ? 'TẤT CẢ LẦN CHẠY' : selectedFlowCode }}</span>
            </div>

            <h3 class="card-title mb-1" style="font-size: 16px; font-weight: 700;">
              {{ selectedFlowCode === 'all' ? 'Nhật ký toàn bộ lần chạy Flow' : (currentFlowSummary?.flow_name || selectedFlowCode) }}
            </h3>
            <p class="subtitle mb-0" *ngIf="selectedFlowCode !== 'all' && currentFlowSummary">
              Liên kết KR: <strong class="text-primary">{{ currentFlowSummary.kr_id }}</strong> - {{ currentFlowSummary.kr_title }} &bull; Kiểu kích hoạt: {{ currentFlowSummary.trigger_type }}
            </p>
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

            <button type="button" class="btn btn-primary" (click)="openSimulateModal(selectedFlowCode)">
              <i class="fa-solid fa-play me-1"></i>
              <span>Chạy mô phỏng</span>
            </button>
          </div>
        </div>

        <!-- Flow Summary Box (Hiển thị tóm tắt thông số Flow khi xem flow cụ thể) -->
        <div class="flow-detail-summary-card p-3 mb-3 bg-white border rounded" *ngIf="selectedFlowCode !== 'all' && currentFlowSummary">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div class="d-flex align-items-center gap-2">
              <span class="badge badge-code">{{ currentFlowSummary.flow_code }}</span>
              <span class="fw-bold text-dark" style="font-size: 13.5px;">{{ currentFlowSummary.flow_name }}</span>
            </div>
            <div class="d-flex align-items-center gap-3 text-muted" style="font-size: 12.5px;">
              <div>Tổng lần chạy: <strong class="text-dark">{{ currentFlowSummary.total_runs }}</strong></div>
              <div>Tỷ lệ thành công: <strong class="text-success">{{ currentFlowSummary.success_rate }}%</strong></div>
              <div>Gần nhất: <strong class="text-dark">{{ currentFlowSummary.last_run_time || 'Chưa chạy' }}</strong></div>
            </div>
          </div>
          <div class="mt-2 pt-2 border-top text-muted d-flex align-items-center gap-2" style="font-size: 12.5px;">
            <i class="fa-solid fa-chart-line text-primary"></i>
            <span class="fw-semibold text-dark">Tác động gần nhất:</span>
            <span class="text-dark">{{ currentFlowSummary.last_impact }}</span>
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

          <div class="filter-count-badge ms-auto">
            <span>Hiển thị <strong>{{ filteredRuns.length }}</strong> / {{ totalRunsCount }} lần chạy</span>
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
                <th style="width: 110px;" class="text-center">Payload</th>
                <th style="width: 48px; text-align: center;"></th>
              </tr>
            </thead>
            <tbody>
              <!-- Center Table Loading -->
              <tr *ngIf="loading">
                <td colspan="10" class="table-loading-cell">
                  <div class="table-loading-content">
                    <div class="loading-spinner-circle"></div>
                    <span>Đang tải danh sách lần chạy flow...</span>
                  </div>
                </td>
              </tr>

              <!-- Table Rows & Empty State strictly wrapped in !loading -->
              <ng-container *ngIf="!loading">
                <tr *ngFor="let run of filteredRuns">
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
                  <td class="text-center">
                    <button type="button" class="btn btn-sm btn-payload" (click)="openPayloadModal(run)" title="Xem chi tiết dữ liệu JSON">
                      <i class="fa-solid fa-code me-1"></i>Chi tiết
                    </button>
                  </td>
                  <!-- 3-Dot Action Column -->
                  <td style="width: 48px; text-align: center; position: relative;">
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
                        <i class="fa-solid fa-code"></i> Xem Payload JSON
                      </button>
                      <button class="action-dropdown-item text-danger" (click)="deleteRun(run); closeDropdown()">
                        <i class="fa-solid fa-trash-can"></i> Xóa lần chạy
                      </button>
                    </div>
                  </td>
                </tr>

                <!-- Standard Empty State -->
                <tr *ngIf="filteredRuns.length === 0">
                  <td colspan="10" class="text-center text-muted py-4">
                    {{ (searchQuery || selectedStatus !== 'all' || selectedFlowCode !== 'all') ? 'Không tìm thấy lần chạy nào phù hợp bộ lọc.' : 'Chưa có lần chạy nào cho Flow này. Hãy kích hoạt chạy flow!' }}
                  </td>
                </tr>
              </ng-container>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- Modal 1: Chi tiết Payload JSON -->
    <div class="modal-overlay" *ngIf="selectedRunForModal" (click)="closePayloadModal()">
      <div class="modal-content payload-modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="d-flex align-items-center gap-2">
            <div class="modal-icon-badge">
              <i class="fa-solid fa-code"></i>
            </div>
            <h3 class="modal-title">
              Chi tiết lần chạy <span class="run-id-badge">{{ selectedRunForModal.run_id }}</span>
            </h3>
          </div>
          <button type="button" class="btn-close-modal" (click)="closePayloadModal()" aria-label="Đóng" title="Đóng">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="modal-body">
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
            <!-- Member metrics from payload if present -->
            <div class="member-trace-metrics mt-2 pt-2 border-top border-primary-subtle" *ngIf="getMemberTraceDetails(selectedRunForModal, pendingTraceMember) as m">
              <div class="d-flex align-items-center gap-3 flex-wrap" style="font-size: 12.5px;">
                <span *ngIf="m.IC_i !== undefined || m.ic_percent !== undefined">
                  Chỉ số đúng hạn (IC_i): <strong class="text-primary">{{ m.IC_i !== undefined ? m.IC_i : m.ic_percent }}%</strong>
                </span>
                <span *ngIf="m.Ni !== undefined || m.ontime_issues !== undefined">
                  Số Issue đạt: <strong class="text-dark">{{ m.Ni !== undefined ? m.Ni : m.ontime_issues }}/{{ m.Di !== undefined ? m.Di : m.due_issues }}</strong>
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

          <div class="run-summary-box mb-3">
            <div class="summary-item">
              <span class="label">Flow thực thi:</span>
              <span class="value-text">
                <strong>{{ selectedRunForModal.flow_name }}</strong>
                <span class="text-muted ms-1">({{ selectedRunForModal.flow_code }})</span>
              </span>
            </div>
            <div class="summary-item">
              <span class="label">Trạng thái:</span>
              <span class="badge" [ngClass]="getStatusBadgeClass(selectedRunForModal.status)">
                <i class="fa-solid me-1" [ngClass]="getStatusIconClass(selectedRunForModal.status)"></i>
                {{ selectedRunForModal.status }}
              </span>
            </div>
            <div class="summary-item">
              <span class="label">Thời gian chạy:</span>
              <span class="value-text">
                <i class="fa-regular fa-clock text-muted me-1"></i>
                {{ selectedRunForModal.start_time }}
                <span class="badge bg-light text-dark border ms-1">{{ formatDuration(selectedRunForModal.duration_ms) }}</span>
              </span>
            </div>
            <div class="summary-item">
              <span class="label">Tác động OKR:</span>
              <span class="impact-text">
                <i class="fa-solid fa-arrow-right text-primary me-1"></i>
                {{ selectedRunForModal.data_created }}
              </span>
            </div>
          </div>

          <div class="d-flex align-items-center justify-content-between mb-2">
            <span class="payload-header-label">
              <i class="fa-solid fa-file-code me-1 text-primary"></i>
              <strong>Payload JSON đồng bộ hệ thống:</strong>
            </span>
            <button type="button" class="btn-copy-payload" (click)="copyPayload()" title="Sao chép toàn bộ dữ liệu JSON">
              <i class="fa-solid" [ngClass]="isCopied ? 'fa-check text-success' : 'fa-copy'"></i>
              <span>{{ isCopied ? 'Đã sao chép' : 'Sao chép JSON' }}</span>
            </button>
          </div>

          <pre class="json-code-box"><code>{{ formatPayloadJson(selectedRunForModal.payload_json) }}</code></pre>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="closePayloadModal()">
            Đóng
          </button>
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
      overflow: hidden;
    }

    .table {
      margin-bottom: 0;
      width: 100%;
      border-collapse: collapse;
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
      max-width: 680px;
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
  isCopied = false;

  // Modal 2: Simulation
  isSimulateModalOpen = false;
  simulateFlowCode = 'FLOW-KR-A1';
  isSimulating = false;

  constructor(
    private okrService: OkrService,
    private confirmService: ConfirmDialogService,
    private router: Router,
    private route: ActivatedRoute
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
    try {
      const payload = typeof run.payload_json === 'string' ? JSON.parse(run.payload_json) : run.payload_json;
      if (!payload) return null;

      // 1. Check standardized summary_metrics.individual_breakdown (4-part structure)
      const breakdown = payload.summary_metrics?.individual_breakdown || payload.individual_breakdown;
      if (Array.isArray(breakdown)) {
        const found = breakdown.find((m: any) =>
          (m.name && m.name.toLowerCase().includes(memberName.toLowerCase())) ||
          (memberName.toLowerCase().includes((m.name || '').toLowerCase())) ||
          (m.employee && m.employee.toLowerCase().includes(memberName.toLowerCase())) ||
          (m.emp_id && memberName.toLowerCase().includes(m.emp_id.toLowerCase()))
        );
        if (found) {
          return {
            ...found,
            IC_i: found.ic_percent !== undefined ? found.ic_percent : found.IC_i,
            Ni: found.ontime_issues !== undefined ? found.ontime_issues : (found.ontime !== undefined ? found.ontime : found.Ni),
            Di: found.due_issues !== undefined ? found.due_issues : (found.reviews !== undefined ? found.reviews : found.Di),
            status: found.status || found.sla_status || 'PASS'
          };
        }
      }

      // 2. Check legacy / alternative member_results
      if (Array.isArray(payload.member_results)) {
        const found = payload.member_results.find((m: any) => 
          (m.employee && m.employee.toLowerCase().includes(memberName.toLowerCase())) ||
          (memberName.toLowerCase().includes((m.employee || '').toLowerCase()))
        );
        if (found) return found;
      }

      // 3. Check direct author, reviewer, developer
      if (payload.author === memberName || payload.reviewer === memberName || payload.developer === memberName) {
        return payload;
      }

      // 4. Check source_records for this member
      if (Array.isArray(payload.source_records)) {
        const matchingRecord = payload.source_records.find((r: any) =>
          (r.assignee && memberName.toLowerCase().includes(r.assignee.toLowerCase())) ||
          (r.reviewer && memberName.toLowerCase().includes(r.reviewer.toLowerCase())) ||
          (r.developer && memberName.toLowerCase().includes(r.developer.toLowerCase()))
        );
        if (matchingRecord) return matchingRecord;
      }
    } catch {
      return null;
    }
    return null;
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
  }

  closePayloadModal(): void {
    this.selectedRunForModal = null;
    this.isCopied = false;
  }

  copyPayload(): void {
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
    if (!raw) return '{\n  "status": "empty"\n}';
    try {
      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw);
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
