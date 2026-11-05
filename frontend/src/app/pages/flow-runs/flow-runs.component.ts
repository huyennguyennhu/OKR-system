import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OkrService, FlowSummary, FlowRun, FlowRunsResponse } from '../../services/okr.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-flow-runs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Lớp phủ khóa trang trong suốt (không làm mờ, chặn tương tác khi đang tải) -->
    <div class="page-loading-overlay" *ngIf="loading"></div>

    <div class="flow-runs-page">
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
        <div class="top-bar-right">
          <button type="button" class="btn btn-primary" (click)="openSimulateModal()">
            <i class="fa-solid fa-play"></i>
            <span>Chạy mô phỏng Flow</span>
          </button>
        </div>
      </div>

      <!-- Flow Cards Section (Mỗi Flow là 1 Card) -->
      <div class="flow-cards-section mb-4">
        <div class="flow-cards-header mb-2">
          <div class="d-flex align-items-center justify-content-between">
            <span class="cards-section-label">
              <strong>Danh sách Activepieces Flows</strong> (Nhấn vào card để xem bảng lần chạy tương ứng):
            </span>
            <button 
              type="button" 
              class="btn-all-flows" 
              [class.active]="selectedFlowCode === 'all'"
              (click)="selectFlow('all')"
              title="Xem lịch sử chạy của tất cả các flow">
              <i class="fa-solid fa-layer-group me-1"></i>
              <span>Tất cả lần chạy ({{ allRuns.length }})</span>
            </button>
          </div>
        </div>

        <div class="flow-cards-grid">
          <div 
            *ngFor="let flow of flows" 
            class="flow-card"
            [class.selected]="selectedFlowCode === flow.flow_code"
            (click)="selectFlow(flow.flow_code)">
            
            <div class="card-header-line">
              <div class="d-flex align-items-center gap-2">
                <span class="badge badge-code">{{ flow.flow_code }}</span>
                <span class="badge badge-active">
                  <i class="fa-solid fa-circle-check me-1"></i>Hoạt động
                </span>
              </div>
              <span class="selection-indicator" *ngIf="selectedFlowCode === flow.flow_code">
                <i class="fa-solid fa-circle-dot text-primary"></i> Đang xem
              </span>
            </div>

            <h4 class="flow-card-title">{{ flow.flow_name }}</h4>

            <div class="flow-card-kr">
              <i class="fa-solid fa-bullseye me-1 text-primary"></i>
              <span class="kr-badge">{{ flow.kr_id }}</span>
              <span class="kr-title-text">{{ flow.kr_title }}</span>
            </div>

            <div class="flow-card-trigger">
              <i class="fa-solid fa-bolt me-1 text-warning"></i>
              <span>{{ flow.trigger_type }}</span>
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
                  {{ (searchQuery || selectedStatus !== 'all' || selectedFlowCode !== 'all') ? 'Không tìm thấy lần chạy nào phù hợp bộ lọc.' : 'Chưa có lần chạy nào. Hãy kích hoạt chạy flow!' }}
                </td>
              </tr>
            </ng-container>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal 1: Chi tiết Payload JSON -->
    <div class="modal-overlay" *ngIf="selectedRunForModal" (click)="closePayloadModal()">
      <div class="modal-content payload-modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="d-flex align-items-center gap-2">
            <i class="fa-solid fa-code text-primary"></i>
            <h3 class="modal-title" style="font-size: 16px; font-weight: 700; margin: 0;">
              Chi tiết lần chạy {{ selectedRunForModal.run_id }}
            </h3>
          </div>
          <button type="button" class="btn-close-modal" (click)="closePayloadModal()" aria-label="Đóng">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="modal-body">
          <div class="run-summary-box mb-3">
            <div class="summary-item">
              <span class="label">Flow:</span>
              <strong>{{ selectedRunForModal.flow_name }} ({{ selectedRunForModal.flow_code }})</strong>
            </div>
            <div class="summary-item">
              <span class="label">Trạng thái:</span>
              <span class="badge" [ngClass]="getStatusBadgeClass(selectedRunForModal.status)">{{ selectedRunForModal.status }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Thời gian:</span>
              <span>{{ selectedRunForModal.start_time }} ({{ formatDuration(selectedRunForModal.duration_ms) }})</span>
            </div>
            <div class="summary-item">
              <span class="label">Tác động OKR:</span>
              <span class="text-primary fw-600">{{ selectedRunForModal.data_created }}</span>
            </div>
          </div>

          <div class="d-flex align-items-center justify-content-between mb-2">
            <span class="payload-header-label">
              <i class="fa-solid fa-file-code me-1 text-muted"></i>
              <strong>Payload JSON đồng bộ hệ thống:</strong>
            </span>
            <button type="button" class="btn-copy-payload" (click)="copyPayload()">
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
            <i class="fa-solid fa-play text-primary"></i>
            <h3 class="modal-title" style="font-size: 16px; font-weight: 700; margin: 0;">
              Mô phỏng chạy Flow Activepieces
            </h3>
          </div>
          <button type="button" class="btn-close-modal" (click)="closeSimulateModal()" aria-label="Đóng">
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

    /* Flow Cards Section */
    .flow-cards-section {
      width: 100%;
    }

    .cards-section-label {
      font-size: 13px;
      color: #334155;
    }

    .btn-all-flows {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0.35rem 0.75rem;
      font-size: 13px;
      font-weight: 500;
      color: #475569;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-all-flows:hover {
      background: #e2e8f0;
      color: #1e293b;
    }

    .btn-all-flows.active {
      background: #e0e7ff;
      border-color: #3157D5;
      color: #3157D5;
      font-weight: 600;
    }

    .flow-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
      gap: 1rem;
    }

    .flow-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1.15rem;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .flow-card:hover {
      border-color: #94a3b8;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      transform: translateY(-1px);
    }

    .flow-card.selected {
      border: 2px solid #3157D5;
      background: #fcfdff;
      box-shadow: 0 4px 14px rgba(49, 87, 213, 0.12);
    }

    .card-header-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .selection-indicator {
      font-size: 13px;
      font-weight: 600;
      color: #3157D5;
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
      font-size: 13px;
      color: #64748b;
    }

    .metric-value {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
    }

    .time-val {
      font-weight: 500;
      color: #475569;
      font-size: 13px;
    }

    .card-impact-box {
      font-size: 13px;
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
      font-size: 13px;
    }

    .impact-content {
      color: #15803d;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Filter Bar */
    .filter-count-badge {
      font-size: 13px;
      color: #64748b;
    }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      line-height: 1;
    }

    .badge-code {
      background: #f1f5f9;
      color: #334155;
      font-family: monospace;
      font-size: 13px;
      border: 1px solid #cbd5e1;
    }

    .badge-active {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
    }

    .badge-schedule {
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
    }

    .badge-webhook {
      background: #fff7ed;
      color: #c2410c;
      border: 1px solid #fed7aa;
    }

    .badge-success {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #86efac;
    }

    .badge-warning {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
    }

    .badge-danger {
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fca5a5;
    }

    .badge-input {
      background: #f8fafc;
      color: #475569;
      border: 1px solid #e2e8f0;
    }

    /* Table specifics */
    .run-id {
      font-size: 13px;
      font-family: monospace;
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      color: #1e293b;
      font-weight: 600;
    }

    .time-col {
      font-size: 13px;
      color: #334155;
    }

    .duration-text {
      font-size: 13px;
      font-weight: 500;
      color: #475569;
    }

    .impact-cell {
      font-size: 13px;
      color: #1e293b;
      max-width: 280px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .btn-payload {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      border-radius: 4px;
      padding: 0.25rem 0.6rem;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-payload:hover {
      background: #dbeafe;
      color: #1e40af;
    }

    /* Modal Styling */
    .payload-modal {
      width: 620px;
      max-width: 95%;
    }

    .simulate-modal {
      width: 500px;
      max-width: 95%;
    }

    .run-summary-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      font-size: 13px;
    }

    .summary-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .summary-item .label {
      color: #64748b;
      width: 100px;
    }

    .payload-header-label {
      font-size: 13px;
      color: #334155;
    }

    .btn-copy-payload {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 0.25rem 0.65rem;
      font-size: 13px;
      color: #475569;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      transition: all 0.15s ease;
    }

    .btn-copy-payload:hover {
      background: #f1f5f9;
      color: #1e293b;
    }

    .json-code-box {
      background: #0f172a;
      color: #38bdf8;
      border-radius: 8px;
      padding: 1rem;
      font-size: 13px;
      font-family: 'Consolas', 'Courier New', monospace;
      max-height: 280px;
      overflow-y: auto;
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .simulate-desc {
      font-size: 13px;
      color: #475569;
      line-height: 1.5;
    }

    .flow-preview-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 0.85rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      font-size: 13px;
    }

    .preview-row {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .preview-label {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
    }

    /* Common utilities */
    .fw-600 { font-weight: 600; }
    .text-primary { color: #3157D5 !important; }
    .text-success { color: #16a34a !important; }
    .text-warning { color: #d97706 !important; }
    .text-danger { color: #dc2626 !important; }
    .text-muted { color: #64748b !important; }
    .mb-1 { margin-bottom: 0.25rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-3 { margin-bottom: 0.75rem; }
    .mb-4 { margin-bottom: 1.5rem; }
    .me-1 { margin-right: 0.25rem; }
    .me-2 { margin-right: 0.5rem; }
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

  // Selection & Filtering
  selectedFlowCode = 'all';
  searchQuery = '';
  selectedStatus = 'all';
  isStatusDropdownOpen = false;

  // 3-dot action menu
  activeActionMenu: string | null = null;

  // Modal 1: Payload detail
  selectedRunForModal: FlowRun | null = null;
  isCopied = false;

  // Modal 2: Simulation
  isSimulateModalOpen = false;
  simulateFlowCode = 'FLOW-KR-A1';
  isSimulating = false;

  constructor(
    private okrService: OkrService,
    private confirmService: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  get totalRunsCount(): number {
    return this.allRuns.length;
  }

  loadData(): void {
    this.loading = true;
    this.okrService.getFlowRuns().subscribe({
      next: (res: FlowRunsResponse) => {
        this.flows = res.flows || [];
        this.allRuns = res.runs || [];
        this.filterRuns();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading flow runs:', err);
        this.loading = false;
      }
    });
  }

  selectFlow(flowCode: string): void {
    if (this.selectedFlowCode === flowCode && flowCode !== 'all') {
      this.selectedFlowCode = 'all';
    } else {
      this.selectedFlowCode = flowCode;
    }
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
      case 'SUCCESS': return 'SUCCESS (Thành công)';
      case 'PARTIAL': return 'PARTIAL (Một phần)';
      case 'FAILED': return 'FAILED (Thất bại)';
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
  openSimulateModal(): void {
    if (this.selectedFlowCode !== 'all') {
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

