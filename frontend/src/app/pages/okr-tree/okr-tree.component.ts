import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OkrService, Space, Timeline } from '../../services/okr.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

interface TreeNode {
  id: string;
  title: string;
  type: 'company_obj' | 'team_obj' | 'team_kr' | 'ind_kr';
  progress: number;
  expanded: boolean;
  children: TreeNode[];
  
  // Columns for TreeTable
  assignTo: string;
  assignToAvatar?: string;
  metricName: string;
  metricSub: string;
  aggType: 'SUM' | 'AVG' | 'Develop';
  resultS: string;
  resultC: string;
  resultE: string;
  risk: 'danger' | 'warning' | 'none';
  tl: string;
}

@Component({
  selector: 'app-okr-tree',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Lớp phủ khóa trang trong suốt (không làm mờ, chặn tương tác khi đang tải) -->
    <div class="page-loading-overlay" *ngIf="loading"></div>

    <div class="okr-tree-page">
      <!-- Tên trang + Subtitle -->
      <div class="page-top-bar mb-4">
        <h3 class="card-title mb-1" style="font-size: 18px; font-weight: 700;">
          OKR Tree
        </h3>
        <p class="subtitle mb-0">
          Trực quan hóa cấu trúc liên kết đa tầng giữa Mục tiêu Công ty, Phòng ban và Kết quả then chốt (Key Results).
        </p>
      </div>

      <!-- Top Filters & Toolbars -->
      <div class="toolbar d-flex align-items-center justify-content-between mb-3 bg-white border rounded">
        <div class="d-flex gap-3 align-items-end">
          <div class="position-relative filter-dropdown-wrapper">
            <button type="button" class="btn-filter-trigger" [class.active]="showFilter" (click)="toggleFilter($event)">
              <i class="fa-solid fa-filter text-primary"></i>
              <span>Filter</span>
              <i class="fa-solid fa-chevron-down chevron-icon" [class.rotate]="showFilter"></i>
            </button>
            
            <!-- Filter Dropdown Menu -->
            <div class="filter-dropdown-menu" *ngIf="showFilter" (click)="$event.stopPropagation()">
              <div class="filter-header">
                <div class="d-flex align-items-center gap-2">
                  <i class="fa-solid fa-sliders text-primary"></i>
                  <span>FILTER CRITERIA</span>
                </div>
                <button type="button" class="btn-close-filter" (click)="showFilter = false" title="Đóng">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
              
              <div class="filter-body">
                <!-- Due Date -->
                <div class="filter-section">
                  <label class="filter-label">Due Date</label>
                  <input type="text" class="form-control" placeholder="Select Due Date">
                  <div class="filter-badges-group">
                    <span class="filter-badge" [class.active]="selectedFilterDueDate === 'All'" (click)="setFilterDueDate('All')">All</span>
                    <span class="filter-badge" [class.active]="selectedFilterDueDate === 'Today'" (click)="setFilterDueDate('Today')">Today</span>
                    <span class="filter-badge" [class.active]="selectedFilterDueDate === 'This Week'" (click)="setFilterDueDate('This Week')">This Week</span>
                    <span class="filter-badge" [class.active]="selectedFilterDueDate === 'Last Month'" (click)="setFilterDueDate('Last Month')">Last Month</span>
                    <span class="filter-badge" [class.active]="selectedFilterDueDate === 'This Month'" (click)="setFilterDueDate('This Month')">This Month</span>
                  </div>
                </div>

                <!-- OKR Level -->
                <div class="filter-section">
                  <label class="filter-label">OKR Level</label>
                  <select class="form-select" [(ngModel)]="selectedFilterLevel">
                    <option value="All">All Levels</option>
                    <option value="COMPANY">Company</option>
                    <option value="GROUP">Group</option>
                    <option value="TEAM">Team</option>
                    <option value="PERSONAL">Personal</option>
                  </select>
                  <div class="filter-badges-group">
                    <span class="filter-badge" [class.active]="selectedFilterLevel === 'All'" (click)="setFilterLevel('All')">All</span>
                    <span class="filter-badge" [class.active]="selectedFilterLevel === 'COMPANY'" (click)="setFilterLevel('COMPANY')">Company</span>
                    <span class="filter-badge" [class.active]="selectedFilterLevel === 'GROUP'" (click)="setFilterLevel('GROUP')">Group</span>
                    <span class="filter-badge" [class.active]="selectedFilterLevel === 'TEAM'" (click)="setFilterLevel('TEAM')">Team</span>
                    <span class="filter-badge" [class.active]="selectedFilterLevel === 'PERSONAL'" (click)="setFilterLevel('PERSONAL')">Personal</span>
                  </div>
                </div>

                <!-- Indicator -->
                <div class="filter-section">
                  <label class="filter-label">Indicator</label>
                  <select class="form-select" [(ngModel)]="selectedFilterIndicator">
                    <option value="All">All Indicators</option>
                    <option value="Leading">Leading</option>
                    <option value="Lagging">Lagging</option>
                  </select>
                  <div class="filter-badges-group">
                    <span class="filter-badge" [class.active]="selectedFilterIndicator === 'All'" (click)="setFilterIndicator('All')">All</span>
                    <span class="filter-badge" [class.active]="selectedFilterIndicator === 'Leading'" (click)="setFilterIndicator('Leading')">Leading</span>
                    <span class="filter-badge" [class.active]="selectedFilterIndicator === 'Lagging'" (click)="setFilterIndicator('Lagging')">Lagging</span>
                  </div>
                </div>

                <!-- Assignee -->
                <div class="filter-section">
                  <label class="filter-label">Assignee</label>
                  <select class="form-select">
                    <option value="" selected>All Assignees</option>
                    <option value="binhtt">Trần Thị Bình (binhtt)</option>
                    <option value="cuonglh">Lê Hoàng Cường (cuonglh)</option>
                    <option value="anhnv">Nguyễn Văn Anh (anhnv)</option>
                  </select>
                </div>

                <!-- Group -->
                <div class="filter-section">
                  <label class="filter-label">Group</label>
                  <select class="form-select">
                    <option value="" selected>All Groups</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Product">Product</option>
                    <option value="Design">Design</option>
                  </select>
                </div>

                <!-- Team -->
                <div class="filter-section">
                  <label class="filter-label">Team</label>
                  <select class="form-select">
                    <option value="" selected>All Teams</option>
                    <option value="Team Dev">Team Dev</option>
                    <option value="Team QA">Team QA</option>
                    <option value="Team DevOps">Team DevOps</option>
                  </select>
                </div>
              </div>

              <!-- Footer -->
              <div class="filter-footer">
                <button type="button" class="btn-filter-reset" (click)="resetFilter()">
                  <i class="fa-solid fa-arrow-rotate-left me-1"></i> Reset
                </button>
                <div class="filter-footer-actions">
                  <button type="button" class="btn btn-secondary btn-sm" (click)="showFilter = false">Cancel</button>
                  <button type="button" class="btn btn-primary btn-sm px-3 fw-bold" (click)="applyFilter()">Apply</button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Timeline Dropdown -->
          <div class="d-flex flex-column" style="font-size: 13px; color: #64748b;">
            <span class="mb-1">Timeline</span>
            <div class="position-relative timeline-dropdown-wrapper">
              <button type="button" class="toolbar-dropdown-trigger" style="min-width: 120px;" (click)="toggleTimelineDropdown($event)" [class.active]="isTimelineDropdownOpen" title="Chọn Timeline">
                <span class="dropdown-label text-truncate">{{ selectedTimeline }}</span>
                <i class="fa-solid fa-chevron-down ms-1 chevron-icon" [class.rotate]="isTimelineDropdownOpen"></i>
              </button>
              <div class="custom-select-menu timeline-dropdown-menu" *ngIf="isTimelineDropdownOpen">
                <div class="custom-select-option" *ngFor="let tl of timelineOptions" [class.selected]="tl === selectedTimeline" (click)="selectTimeline(tl)">
                  <span style="color: #1e293b; font-weight: 500;">{{ tl }}</span>
                  <i class="fa-solid fa-check check-icon ms-2" *ngIf="tl === selectedTimeline"></i>
                </div>
              </div>
            </div>
          </div>

          <!-- Timeline Tree Dropdown -->
          <div class="d-flex flex-column" style="font-size: 13px; color: #64748b;">
            <span class="mb-1">Timeline Tree</span>
            <div class="position-relative timeline-tree-dropdown-wrapper">
              <button type="button" class="toolbar-dropdown-trigger" style="min-width: 155px;" (click)="toggleTimelineTreeDropdown($event)" [class.active]="isTimelineTreeDropdownOpen" title="Chọn Timeline Tree">
                <span class="dropdown-label text-truncate">{{ selectedTimelineTree }}</span>
                <i class="fa-solid fa-chevron-down ms-1 chevron-icon" [class.rotate]="isTimelineTreeDropdownOpen"></i>
              </button>
              <div class="custom-select-menu timeline-tree-dropdown-menu" *ngIf="isTimelineTreeDropdownOpen">
                <div class="custom-select-option" *ngFor="let tlt of timelineTreeOptions" [class.selected]="tlt === selectedTimelineTree" (click)="selectTimelineTree(tlt)">
                  <span style="color: #1e293b; font-weight: 500;">{{ tlt }}</span>
                  <i class="fa-solid fa-check check-icon ms-2" *ngIf="tlt === selectedTimelineTree"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="d-flex gap-3 align-items-end">
          <!-- Spaces Group -->
          <div class="d-flex flex-column" style="font-size: 13px; color: #64748b;">
            <span class="mb-1">Spaces</span>
            <!-- Dropdown Space từ Database thay thế cho XC2026 -->
            <div class="position-relative space-dropdown-wrapper">
              <button type="button" class="toolbar-dropdown-trigger" (click)="toggleSpaceDropdown($event)" [class.active]="isSpaceDropdownOpen" title="Chọn không gian làm việc">
                <span class="space-label">{{ selectedSpace ? (selectedSpace.space_key || selectedSpace.name) : 'Chọn Space' }}</span>
                <i class="fa-solid fa-chevron-down ms-1 chevron-icon" [class.rotate]="isSpaceDropdownOpen"></i>
              </button>
              <div class="custom-select-menu space-dropdown-menu" *ngIf="isSpaceDropdownOpen">
                <div class="custom-select-option" *ngFor="let s of spaces" [class.selected]="s.id === selectedSpaceId" (click)="selectSpace(s)">
                  <span style="color: #1e293b; font-weight: 500;">{{ s.space_key || s.name }}</span>
                  <i class="fa-solid fa-check check-icon ms-2" *ngIf="s.id === selectedSpaceId"></i>
                </div>
                <div class="text-muted p-2 text-center" *ngIf="spaces.length === 0" style="font-size: 13px;">
                  Chưa có không gian nào trong DB
                </div>
              </div>
            </div>
          </div>

          <!-- Search Input -->
          <div class="position-relative search-input-box">
            <input type="text" class="form-control" placeholder="Search" [(ngModel)]="searchQuery" (input)="onSearch()" style="width: 140px;">
            <button type="button" class="btn-search-inside" (click)="onSearch()" title="Tìm kiếm">
              <i class="fa-solid fa-magnifying-glass"></i>
            </button>
          </div>

          <!-- Refresh Button -->
          <button class="btn btn-outline-secondary btn-tree-refresh" (click)="loadTreeData()" title="Làm mới dữ liệu">
            <i class="fa-solid fa-rotate" [class.fa-spin]="loading"></i>
          </button>
        </div>
      </div>

      <!-- Tree Table -->
      <div class="card tree-table-card">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 okr-table">
            <thead>
              <tr>
                <th style="width: 52%;">
                  OKR 
                  <i *ngIf="!isAnyExpanded()" class="fa-solid fa-up-right-and-down-left-from-center ms-2 text-muted cursor-pointer" (click)="toggleAll(true)" title="Expand All"></i>
                  <i *ngIf="isAnyExpanded()" class="fa-solid fa-down-left-and-up-right-to-center ms-2 text-muted cursor-pointer" (click)="toggleAll(false)" title="Collapse All"></i>
                </th>
                <th style="width: 15%;">Assign To</th>
                <th style="width: 7%; text-align: center;" class="text-center">Agg Type</th>
                <th style="width: 140px; min-width: 140px; text-align: center;" class="text-center">Result</th>
                <th style="width: 10%;">Progress</th>
                <th style="width: 48px; min-width: 48px; text-align: center;" class="text-center">Risk</th>
                <th style="width: 48px; text-align: center;"></th>
              </tr>
            </thead>
            <tbody>
              <!-- Recursive Template Definition -->
              <ng-template #treeNodeTemplate let-nodes="nodes" let-depth="depth">
                <ng-container *ngFor="let node of nodes">
                  <tr>
                    <!-- KPI Column (Tree) -->
                    <td class="kpi-cell" [style.padding-left.rem]="depth * 1.5 + 0.5">
                      <div class="d-flex align-items-center">
                        <!-- Expand/Collapse Chevron -->
                        <div class="chevron-box" [style.visibility]="node.children && node.children.length > 0 ? 'visible' : 'hidden'" (click)="toggleNode(node)">
                          <i class="fa-solid text-muted" [ngClass]="node.expanded ? 'fa-chevron-down' : 'fa-chevron-right'" style="font-size: 10px;"></i>
                        </div>
                        
                        <!-- Icon based on type -->
                        <div class="icon-box ms-1 me-2" [ngClass]="getIconColorClass(node.type)">
                          <i class="fa-solid" [ngClass]="getIconClass(node.type)"></i>
                        </div>
                        
                        <!-- Title -->
                        <span class="node-title cursor-pointer" (click)="onNodeTitleClick(node, $event)" title="Xem chi tiết Objective">
                          <span class="node-id">{{ node.id }}</span> {{ node.title }}
                        </span>
                      </div>
                      <div class="node-subtitle text-muted ms-5" *ngIf="(node.type === 'ind_kr' || node.type === 'team_kr') && node.metricSub">
                        <small>Quy tắc SLA: {{ node.metricSub }}</small>
                      </div>
                    </td>
                    
                    <!-- Assign To -->
                    <td>
                      <div class="d-flex align-items-center" *ngIf="node.assignTo !== 'No Group'">
                        <img *ngIf="node.assignToAvatar" [src]="node.assignToAvatar" class="avatar me-2" alt="avatar">
                        <span class="badge bg-light text-dark border me-2" *ngIf="!node.assignToAvatar"><i class="fa-solid fa-users"></i></span>
                        <span class="assignee-text">{{ node.assignTo }}</span>
                      </div>
                      <span class="text-muted fst-italic" style="font-size: 13px;" *ngIf="node.assignTo === 'No Group'">No Group</span>
                    </td>

                    <!-- Agg Type -->
                    <td class="text-center" style="text-align: center;">
                      <span class="badge" [ngClass]="getAggBadgeClass(node.aggType)">{{ node.aggType }}</span>
                      <i class="fa-solid fa-circle-exclamation text-warning ms-1" *ngIf="node.aggType === 'AVG' && depth > 2"></i>
                      <i class="fa-solid fa-circle-exclamation text-danger ms-1" *ngIf="node.aggType === 'SUM' && depth > 2"></i>
                    </td>

                    <!-- Result (S, C, E) -->
                    <td class="text-center" style="width: 140px; min-width: 140px; text-align: center;">
                      <div class="result-box">
                        <div class="r-col">
                          <div class="r-icon r-icon-s" title="Start"><small>S</small></div>
                          <div class="r-val" [title]="node.resultS">{{ (node.resultS !== undefined && node.resultS !== null && node.resultS !== '') ? node.resultS : '0' }}</div>
                        </div>
                        <div class="r-col">
                          <div class="r-icon r-icon-c" title="Current"><small>C</small></div>
                          <div class="r-val" [title]="node.resultC">{{ (node.resultC !== undefined && node.resultC !== null && node.resultC !== '') ? node.resultC : '0' }}</div>
                        </div>
                        <div class="r-col">
                          <div class="r-icon r-icon-e" title="Expected"><small>E</small></div>
                          <div class="r-val" [title]="node.resultE">{{ (node.resultE !== undefined && node.resultE !== null && node.resultE !== '') ? node.resultE : '100' }}</div>
                        </div>
                      </div>
                    </td>

                    <!-- Progress -->
                    <td>
                      <div class="d-flex justify-content-between mb-1" style="font-size: 13px;">
                        <span class="text-success fw-bold">{{ node.progress }}%</span>
                      </div>
                      <div class="progress" style="height: 4px;">
                        <div class="progress-bar bg-success" role="progressbar" [style.width.%]="node.progress"></div>
                      </div>
                    </td>

                    <!-- Risk -->
                    <td class="text-center">
                      <i class="fa-solid fa-circle-exclamation text-danger" *ngIf="node.risk === 'danger'"></i>
                      <i class="fa-solid fa-triangle-exclamation text-warning" *ngIf="node.risk === 'warning'"></i>
                      <span class="text-muted" *ngIf="node.risk === 'none'">-</span>
                    </td>

                    <!-- Actions -->
                    <td class="action-cell" [style.z-index]="activeDropdownId === node.id ? 10000 : 'auto'">
                      <div class="action-menu-container" [style.z-index]="activeDropdownId === node.id ? 10000 : 'auto'">
                        <button class="btn-action-trigger" (click)="toggleDropdown(node.id, $event)" title="Thao tác" [class.active]="activeDropdownId === node.id">
                          <i class="fa-solid fa-ellipsis-vertical"></i>
                        </button>
                        <div class="action-dropdown-menu" *ngIf="activeDropdownId === node.id" [class.dropup]="isDropup">
                          <button class="action-dropdown-item" (click)="editNode(node); closeDropdown()">
                            <i class="fa-solid fa-pen-to-square"></i> Chỉnh sửa
                          </button>
                          <button class="action-dropdown-item" (click)="cloneNode(node); closeDropdown()">
                            <i class="fa-solid fa-clone"></i> Clone
                          </button>
                          <button class="action-dropdown-item text-danger" (click)="deleteNode(node); closeDropdown()">
                            <i class="fa-solid fa-trash-can"></i> Xóa
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Recursive Call -->
                  <ng-container *ngIf="node.expanded && node.children && node.children.length > 0">
                    <ng-container *ngTemplateOutlet="treeNodeTemplate; context: { nodes: node.children, depth: depth + 1 }"></ng-container>
                  </ng-container>
                </ng-container>
              </ng-template>

              <!-- Loading State (Center Table Loading - Rule 3 rule_UI.md) -->
              <tr *ngIf="loading">
                <td colspan="7" class="table-loading-cell">
                  <div class="table-loading-content">
                    <div class="loading-spinner-circle"></div>
                    <span class="loading-spinner-text">Đang tải cấu trúc OKR Tree từ hệ thống...</span>
                  </div>
                </td>
              </tr>

              <!-- Content Rendered Strictly When Not Loading -->
              <ng-container *ngIf="!loading">
                <tr *ngIf="treeData.length === 0">
                  <td colspan="7" class="text-center py-4 text-muted" style="padding: 2.5rem 1rem;">
                    <i class="fa-solid fa-folder-open mb-2" style="font-size: 2rem; color: #94a3b8; display: block;"></i>
                    Chưa có Mục tiêu hoặc Kết quả then chốt nào. Hãy tạo mới!
                  </td>
                </tr>
                <!-- Initial Call to Recursive Template -->
                <ng-container *ngTemplateOutlet="treeNodeTemplate; context: { nodes: treeData, depth: 0 }"></ng-container>
              </ng-container>

            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal Chỉnh sửa Key Result -->
      <div class="modal-overlay" *ngIf="showKrModal">
        <div class="modal-content" style="max-width: 480px;">
          <div class="card-header mb-3">
            <h3 class="card-title">Chỉnh sửa Key Result ({{ editingKrNode?.id }})</h3>
            <button class="close-btn" (click)="showKrModal = false" type="button" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form (ngSubmit)="saveKrEdit()">
            <div class="form-group mb-3">
              <label class="form-label fw-bold mb-1" style="font-size: 13px; color: #334155;">Tên Kết quả then chốt (Key Result)</label>
              <input type="text" class="form-control" [(ngModel)]="editKrTitle" name="krTitle" required placeholder="Nhập tên KR..." style="font-size: 13px;">
            </div>
            <div class="form-group mb-4">
              <label class="form-label fw-bold mb-1" style="font-size: 13px; color: #334155;">Giá trị mục tiêu kỳ vọng (Target / Expected)</label>
              <input type="number" class="form-control" [(ngModel)]="editKrExpected" name="krExpected" required style="font-size: 13px;">
            </div>
            <div class="d-flex justify-content-end gap-2">
              <button type="button" class="btn btn-secondary" (click)="showKrModal = false" [disabled]="isSavingKr">Hủy</button>
              <button type="submit" class="btn btn-primary" [disabled]="isSavingKr">
                <i class="fa-solid fa-save"></i> {{ isSavingKr ? 'Đang lưu...' : 'Lưu thay đổi' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Utility Classes to replace Bootstrap */
    .d-flex { display: flex; }
    .flex-column { flex-direction: column; }
    .align-items-center { align-items: center; }
    .align-items-end { align-items: flex-end; }
    .justify-content-between { justify-content: space-between; }
    .justify-content-center { justify-content: center; }
    .gap-2 { gap: 0.5rem; }
    .gap-3 { gap: 1rem; }
    
    .text-center { text-align: center; }
    .text-end { text-align: right; }
    .text-muted { color: #64748b !important; }
    .text-primary { color: #3b82f6 !important; }
    .text-success { color: #10b981 !important; }
    .text-warning { color: #f59e0b !important; }
    .text-danger { color: #ef4444 !important; }
    .text-dark { color: #0f172a !important; }
    .text-white { color: #ffffff !important; }
    .fw-bold { font-weight: 700 !important; }
    .fst-italic { font-style: italic !important; }
    .text-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }

    .bg-white { background-color: #ffffff !important; }
    .bg-light { background-color: #f8fafc !important; }
    .bg-primary { background-color: #0056b3 !important; } /* Custom darker blue for filter apply button */
    .bg-success { background-color: #10b981 !important; }
    .bg-secondary { background-color: #94a3b8 !important; }

    .p-0 { padding: 0 !important; }
    .p-2 { padding: 0.5rem !important; }
    .px-3 { padding-left: 1rem !important; padding-right: 1rem !important; }
    .mb-0 { margin-bottom: 0 !important; }
    .mb-1 { margin-bottom: 0.25rem !important; }
    .mb-2 { margin-bottom: 0.5rem !important; }
    .mb-3 { margin-bottom: 1rem !important; }
    .mb-4 { margin-bottom: 1.5rem !important; }
    .page-top-bar { display: block; margin-bottom: 1.5rem !important; }
    .page-top-bar .card-title { font-size: 18px !important; font-weight: 700 !important; color: #1e293b !important; margin: 0 0 0.25rem 0 !important; display: block !important; }
    .page-top-bar .subtitle { color: #64748b !important; font-size: 13px !important; margin: 0 !important; line-height: 1.5; display: block !important; }
    .btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; cursor: pointer; }
    .btn-secondary:hover { background: #e2e8f0; color: #0f172a; }
    .btn-sm { padding: 0.35rem 0.75rem; font-size: 13px; border-radius: 6px; font-weight: 500; display: inline-flex; align-items: center; gap: 0.375rem; }
    .ms-1 { margin-left: 0.25rem !important; }
    .ms-2 { margin-left: 0.5rem !important; }
    .ms-5 { margin-left: 2rem !important; }
    .me-2 { margin-right: 0.5rem !important; }

    .toolbar { padding: 0.75rem 1rem; }
    .border { border: 1px solid #e2e8f0 !important; }
    .rounded { border-radius: 0.25rem !important; }
    .position-relative { position: relative !important; }
    .flex-wrap { flex-wrap: wrap !important; }
    .text-decoration-none { text-decoration: none !important; }

    .btn-link { background: transparent; border: none; cursor: pointer; }
    .btn-outline-secondary { background: transparent; border: 1px solid #cbd5e1; color: #475569; }
    .btn-outline-secondary:hover, .btn-outline-secondary.active { background: #e2e8f0; }
    .btn-light { background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; }
    .btn-light:hover { background: #f1f5f9; }
    .btn-primary { background: #0052cc; color: white; border: 1px solid #0052cc; } /* Deep blue */
    .btn-primary:hover { background: #0047b3; }

    .form-select, .form-control { border: 1px solid #cbd5e1; border-radius: 0.25rem; padding: 0.25rem 0.5rem; background: #fff; color: #64748b; font-size: 13px;}
    .input-group { display: flex; align-items: stretch; }
    .input-group-text { display: flex; align-items: center; padding: 0 0.5rem; border: 1px solid #cbd5e1; }
    .input-group .form-control { border-left: none; border-right: none; }
    
    .btn-group { display: flex; }
    .btn-group .btn:first-child { border-top-right-radius: 0; border-bottom-right-radius: 0; }
    .btn-group .btn:last-child { border-top-left-radius: 0; border-bottom-left-radius: 0; border-left: 0; }

    /* Toolbar Form Select Controls */
    .toolbar select.form-select,
    .toolbar select.form-select-sm,
    select.form-select-sm {
      height: 32px !important;
      padding: 0 1.75rem 0 0.75rem !important;
      font-size: 13px !important;
      font-weight: 500;
      color: #334155;
      background-color: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px !important;
      line-height: 30px !important;
      cursor: pointer;
      outline: none;
      transition: all 0.2s ease;
      background-position: right 0.5rem center !important;
      background-size: 1rem 1rem !important;
    }
    .toolbar select.form-select:hover,
    .toolbar select.form-select-sm:hover,
    select.form-select-sm:hover {
      border-color: #94a3b8;
      background-color: #f8fafc;
    }
    .toolbar select.form-select:focus,
    .toolbar select.form-select-sm:focus,
    select.form-select-sm:focus {
      border-color: var(--primary, #3157D5);
      box-shadow: 0 0 0 2px rgba(49, 87, 213, 0.15);
    }

    /* Filter Trigger Button */
    .btn-filter-trigger {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      height: 32px;
      padding: 0 0.85rem;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
      transition: all 0.2s ease-in-out;
    }
    .btn-filter-trigger:hover,
    .btn-filter-trigger.active {
      background: #f8fafc;
      border-color: var(--primary);
      color: var(--primary);
      box-shadow: 0 0 0 3px rgba(49, 87, 213, 0.12);
    }
    .btn-filter-trigger .chevron-icon {
      font-size: 10px;
      color: #94a3b8;
      transition: transform 0.2s ease;
    }
    .btn-filter-trigger .chevron-icon.rotate {
      transform: rotate(180deg);
    }

    /* Filter Dropdown Custom Styles */
    .filter-dropdown-menu {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      width: 380px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.12), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      z-index: 1050;
      font-size: 13px;
      overflow: hidden;
      animation: modalFadeIn 0.2s ease-out;
    }

    .filter-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #e2e8f0;
      background-color: #f8fafc;
      color: #1e293b;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.03em;
    }

    .btn-close-filter {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 14px;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }
    .btn-close-filter:hover {
      color: #ef4444;
      background: #fee2e2;
    }

    .filter-body {
      padding: 1.25rem;
      max-height: 420px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .filter-body::-webkit-scrollbar {
      width: 5px;
    }
    .filter-body::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 10px;
    }
    .filter-body::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    .filter-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .filter-label {
      display: block;
      color: #334155;
      font-weight: 600;
      font-size: 13px;
      margin: 0;
    }

    .filter-section .form-control,
    .filter-section .form-select {
      width: 100%;
      padding: 0.5rem 0.75rem;
      font-size: 13px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background-color: #ffffff;
      color: #1e293b;
      transition: all 0.15s ease-in-out;
    }
    .filter-section .form-control:focus,
    .filter-section .form-select:focus {
      border-color: var(--primary);
      outline: none;
      box-shadow: 0 0 0 3px rgba(49, 87, 213, 0.15);
    }

    .filter-badges-group {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.25rem;
    }

    .filter-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.35rem 0.75rem;
      background-color: #f1f5f9;
      color: #475569;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid #e2e8f0;
      user-select: none;
      transition: all 0.15s ease-in-out;
    }
    .filter-badge:hover {
      background-color: #eef2ff;
      color: var(--primary);
      border-color: #c7d2fe;
      transform: translateY(-1px);
    }
    .filter-badge.active {
      background-color: #e0e7ff;
      color: var(--primary);
      border-color: var(--primary);
      font-weight: 600;
      box-shadow: 0 1px 2px rgba(49, 87, 213, 0.15);
    }

    .filter-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.875rem 1.25rem;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .btn-filter-reset {
      background: transparent;
      border: none;
      color: #64748b;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0.6rem;
      border-radius: 4px;
      transition: all 0.15s ease;
    }
    .btn-filter-reset:hover {
      color: #ef4444;
      background-color: #fee2e2;
    }

    .filter-footer-actions {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    /* OKR Tree Styles */
    .okr-tree-page { font-family: 'Inter', sans-serif; }
    .tree-table-card { border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 6px; overflow: visible !important; background: #fff; }
    .tree-table-card .table-responsive { overflow: visible !important; }
    .okr-table { font-size: 13px; width: 100%; border-collapse: collapse; }
    .okr-table thead th { 
      background-color: #f8fafc; 
      color: #475569; 
      font-weight: 600; 
      border-bottom: 2px solid #e2e8f0;
      padding: 0.75rem 0.5rem;
      white-space: nowrap;
      text-align: left;
    }
    .okr-table tbody td {
      padding: 0.5rem;
      vertical-align: middle;
      border-bottom: 1px solid #f1f5f9;
    }
    .okr-table thead th.text-center,
    .okr-table tbody td.text-center {
      text-align: center !important;
    }
    .okr-table tbody tr:hover { background-color: #f8fafc; }
    
    .cursor-pointer { cursor: pointer; }
    .kpi-cell { position: relative; }
    
    .chevron-box {
      width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border-radius: 4px;
      transition: background-color 0.15s ease;
    }
    .chevron-box:hover {
      background-color: #f1f5f9;
    }
    .chevron-box i {
      font-size: 10px !important;
      color: #94a3b8;
      transition: color 0.15s ease;
    }
    .chevron-box:hover i {
      color: #334155;
    }
    
    .icon-box { font-size: 1rem; }
    .color-company { color: #3b82f6; } /* Blue */
    .color-kr { color: #10b981; } /* Green */
    .color-ind { color: #a855f7; } /* Purple */
    
    .node-id { color: #3b82f6; font-weight: 500; }
    .node-title { color: #1e293b; font-weight: 500; cursor: pointer; transition: color 0.15s ease; }
    .node-title:hover { color: var(--primary, #3157D5); }
    .node-title:hover .node-id { text-decoration: underline; }
    
    .avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
    .assignee-text { font-size: 13px; color: #334155; }
    
    .metric-name { font-size: 13px; color: #1e293b; font-weight: 500; }
    .metric-sub { font-size: 13px; }
    
    .badge-sum { background-color: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-weight: bold;}
    .badge-avg { background-color: #f59e0b; color: white; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-weight: bold;}
    .badge-develop { background-color: #64748b; color: white; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-weight: bold;}
    
    .result-box {
      display: inline-grid !important;
      grid-template-columns: 38px 38px 38px !important;
      column-gap: 6px !important;
      justify-content: center !important;
      align-items: flex-start !important;
      margin: 0 auto !important;
      width: 126px !important;
    }
    .r-col {
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: flex-start !important;
      text-align: center !important;
      width: 38px !important;
    }
    .result-box .r-icon {
      width: 18px !important;
      height: 18px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 10px !important;
      font-weight: 700 !important;
      border-radius: 4px !important;
      margin: 0 auto !important;
      line-height: 1 !important;
    }
    .r-icon-s { background-color: #64748b !important; color: #ffffff !important; }
    .r-icon-c { background-color: #2563eb !important; color: #ffffff !important; }
    .r-icon-e { background-color: #10b981 !important; color: #ffffff !important; }
    .result-box .r-val {
      font-size: 12px !important;
      font-weight: 600 !important;
      color: #334155 !important;
      margin-top: 3px !important;
      width: 100% !important;
      text-align: center !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      line-height: 1.2 !important;
    }

    /* Progress bar specific to this table */
    .progress { display: flex; height: 4px; overflow: hidden; background-color: #e2e8f0; border-radius: 2px; width: 100%; }
    .progress-bar { display: flex; flex-direction: column; justify-content: center; background-color: #10b981; transition: width 0.6s ease; }

    /* Custom Toolbar Dropdowns (Timeline, Timeline Tree, Space) */
    .timeline-dropdown-wrapper,
    .timeline-tree-dropdown-wrapper,
    .space-dropdown-wrapper { display: inline-flex; position: relative; }

    .space-dropdown-trigger,
    .toolbar-dropdown-trigger {
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      height: 32px;
      padding: 0 0.75rem;
      font-size: 13px;
      font-weight: 500;
      color: #334155;
      background-color: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px !important;
      cursor: pointer;
      white-space: nowrap;
      gap: 0.5rem;
      transition: all 0.2s ease;
      outline: none;
    }
    .space-dropdown-trigger:hover,
    .toolbar-dropdown-trigger:hover {
      background-color: #f8fafc;
      border-color: #94a3b8;
    }
    .space-dropdown-trigger:focus,
    .space-dropdown-trigger.active,
    .toolbar-dropdown-trigger:focus,
    .toolbar-dropdown-trigger.active {
      border-color: var(--primary, #3157D5);
      box-shadow: 0 0 0 2px rgba(49, 87, 213, 0.15);
    }
    .space-dropdown-trigger .chevron-icon,
    .toolbar-dropdown-trigger .chevron-icon {
      font-size: 11px;
      color: #64748b;
      transition: transform 0.2s ease;
    }
    .space-dropdown-trigger .chevron-icon.rotate,
    .toolbar-dropdown-trigger .chevron-icon.rotate {
      transform: rotate(180deg);
      color: var(--primary, #3157D5);
    }
    .space-dropdown-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      min-width: 230px;
      max-width: 340px;
      max-height: 280px;
      overflow-y: auto;
      z-index: 1060;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
    }
    .timeline-dropdown-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      min-width: 140px;
      max-height: 280px;
      overflow-y: auto;
      z-index: 1060;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
    }
    .timeline-tree-dropdown-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      min-width: 240px;
      max-height: 280px;
      overflow-y: auto;
      z-index: 1060;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
    }
    .search-input-box {
      position: relative;
      display: inline-flex;
      align-items: center;
    }
    .search-input-box input {
      height: 32px;
      font-size: 13px;
      border-radius: 6px !important;
      border: 1px solid #cbd5e1;
      padding: 0 28px 0 0.75rem !important;
      background-color: #ffffff;
      transition: all 0.2s ease;
    }
    .search-input-box input:focus {
      border-color: var(--primary, #3157D5);
      box-shadow: 0 0 0 2px rgba(49, 87, 213, 0.15);
      z-index: 3;
    }
    .btn-search-inside {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      padding: 0;
      color: #94a3b8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      z-index: 5;
      transition: color 0.2s ease;
    }
    .btn-search-inside:hover {
      color: var(--primary, #3157D5);
    }
    .btn-tree-refresh {
      height: 32px;
      padding: 0 0.65rem;
      border-radius: 6px !important;
      border: 1px solid #cbd5e1;
      background-color: #ffffff;
      color: #64748b;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    .btn-tree-refresh:hover {
      background-color: #f8fafc;
      border-color: #94a3b8;
      color: var(--primary, #3157D5);
    }
  `]
})
export class OkrTreeComponent implements OnInit {
  activeDropdownId: string | null = null;
  showFilter = false;
  selectedFilterLevel: string = 'All';
  selectedFilterDueDate: string = 'All';
  selectedFilterIndicator: string = 'All';
  timelines: Timeline[] = [];
  selectedTimeline = '2026';
  timelineOptions: string[] = ['2026', 'Quý 4/2026', 'Quý 3/2026', 'Quý 2/2026', 'Quý 1/2026', '2025'];
  isTimelineDropdownOpen = false;

  selectedTimelineTree = 'Month 8, 2026';
  timelineTreeOptions: string[] = [
    'Month 8, 2026',
    'Month 9, 2026',
    'Month 10, 2026',
    'Tuần 36 (31/08 - 06/09/2026)',
    'Tuần 37 (07/09 - 13/09/2026)',
    'Tuần 38 (14/09 - 20/09/2026)',
    'Tuần 39 (21/09 - 27/09/2026)'
  ];
  isTimelineTreeDropdownOpen = false;

  spaces: Space[] = [];
  selectedSpaceId: string = '';
  selectedSpace: Space | null = null;
  isSpaceDropdownOpen = false;
  loading = false;
  treeData: TreeNode[] = [];
  rawTreeData: TreeNode[] = [];
  searchQuery = '';
  showKrModal = false;
  editingKrNode: TreeNode | null = null;
  editKrTitle = '';
  editKrExpected: number = 100;
  isSavingKr = false;
  isDropup = false;

  constructor(
    private okrService: OkrService, 
    private router: Router,
    private confirmService: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.loadTimelines();
    this.loadSpaces();
    this.loadTreeData();
  }

  loadTreeData(): void {
    this.loading = true;
    this.okrService.getOkrTree().subscribe({
      next: (data) => {
        this.rawTreeData = data || [];
        this.onSearch();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading OKR Tree:', err);
        this.loading = false;
      }
    });
  }

  onSearch(): void {
    if (!this.searchQuery.trim()) {
      this.treeData = this.rawTreeData;
      return;
    }
    const q = this.searchQuery.toLowerCase().trim();
    this.treeData = this.filterNodes(this.rawTreeData, q);
    this.setExpandedRecursive(this.treeData, true);
  }

  private filterNodes(nodes: TreeNode[], q: string): TreeNode[] {
    const res: TreeNode[] = [];
    for (const node of nodes) {
      const matchSelf = (node.title && node.title.toLowerCase().includes(q)) ||
                        (node.id && node.id.toLowerCase().includes(q)) ||
                        (node.assignTo && node.assignTo.toLowerCase().includes(q));
      const filteredChildren = node.children ? this.filterNodes(node.children, q) : [];
      if (matchSelf || filteredChildren.length > 0) {
        res.push({
          ...node,
          expanded: true,
          children: filteredChildren.length > 0 ? filteredChildren : node.children
        });
      }
    }
    return res;
  }

  loadTimelines(): void {
    this.okrService.getTimelines().subscribe({
      next: (data) => {
        this.timelines = data || [];
        if (this.timelines.length > 0) {
          const titles = this.timelines.map(t => t.title).filter(Boolean);
          this.timelineOptions = Array.from(new Set([...titles, ...this.timelineOptions]));
          if (this.timelines[0].title) {
            this.selectedTimeline = this.timelines[0].title;
          }
        }
      },
      error: (err) => {
        console.error('Error loading timelines:', err);
      }
    });
  }

  toggleTimelineDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isSpaceDropdownOpen = false;
    this.isTimelineTreeDropdownOpen = false;
    this.showFilter = false;
    this.activeDropdownId = null;
    this.isTimelineDropdownOpen = !this.isTimelineDropdownOpen;
  }

  selectTimeline(tl: string): void {
    this.selectedTimeline = tl;
    this.isTimelineDropdownOpen = false;
    this.loadTreeData();
  }

  toggleTimelineTreeDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isSpaceDropdownOpen = false;
    this.isTimelineDropdownOpen = false;
    this.showFilter = false;
    this.activeDropdownId = null;
    this.isTimelineTreeDropdownOpen = !this.isTimelineTreeDropdownOpen;
  }

  selectTimelineTree(tlt: string): void {
    this.selectedTimelineTree = tlt;
    this.isTimelineTreeDropdownOpen = false;
    this.loadTreeData();
  }

  loadSpaces(): void {
    this.okrService.getSpaces().subscribe({
      next: (data) => {
        this.spaces = data || [];
        if (this.spaces.length > 0) {
          this.selectedSpace = this.spaces[0];
          this.selectedSpaceId = this.spaces[0].id;
        }
      },
      error: (err) => {
        console.error('Error loading spaces:', err);
      }
    });
  }

  toggleSpaceDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isTimelineDropdownOpen = false;
    this.isTimelineTreeDropdownOpen = false;
    this.showFilter = false;
    this.activeDropdownId = null;
    this.isSpaceDropdownOpen = !this.isSpaceDropdownOpen;
  }

  selectSpace(space: Space): void {
    this.selectedSpace = space;
    this.selectedSpaceId = space.id;
    this.isSpaceDropdownOpen = false;
    this.loadTreeData();
  }

  toggleNode(node: TreeNode): void {
    node.expanded = !node.expanded;
  }

  toggleAll(expand: boolean): void {
    this.setExpandedRecursive(this.treeData, expand);
  }

  private setExpandedRecursive(nodes: TreeNode[], expand: boolean): void {
    nodes.forEach(node => {
      node.expanded = expand;
      if (node.children) {
        this.setExpandedRecursive(node.children, expand);
      }
    });
  }

  isAnyExpanded(): boolean {
    return this.checkAnyExpanded(this.treeData);
  }

  private checkAnyExpanded(nodes: TreeNode[]): boolean {
    for (const node of nodes) {
      if (node.expanded) return true;
      if (node.children && this.checkAnyExpanded(node.children)) return true;
    }
    return false;
  }

  getIconClass(type: string): string {
    switch (type) {
      case 'company_obj': return 'fa-building';
      case 'team_obj': return 'fa-building';
      case 'team_kr': return 'fa-bullseye';
      case 'ind_kr': return 'fa-user';
      default: return 'fa-circle';
    }
  }

  getIconColorClass(type: string): string {
    switch (type) {
      case 'company_obj': return 'color-company';
      case 'team_obj': return 'color-company';
      case 'team_kr': return 'color-kr';
      case 'ind_kr': return 'color-ind';
      default: return '';
    }
  }

  getAggBadgeClass(aggType: string): string {
    switch (aggType) {
      case 'SUM': return 'badge-sum';
      case 'AVG': return 'badge-avg';
      case 'Develop': return 'badge-develop';
      default: return 'bg-secondary';
    }
  }

  setFilterLevel(level: string): void {
    this.selectedFilterLevel = level;
  }

  setFilterDueDate(due: string): void {
    this.selectedFilterDueDate = due;
  }

  setFilterIndicator(ind: string): void {
    this.selectedFilterIndicator = ind;
  }

  resetFilter(): void {
    this.selectedFilterLevel = 'All';
    this.selectedFilterDueDate = 'All';
    this.selectedFilterIndicator = 'All';
    this.searchQuery = '';
    this.onSearch();
    this.showFilter = false;
  }

  applyFilter(): void {
    this.showFilter = false;
    this.onSearch();
  }

  toggleFilter(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.isTimelineDropdownOpen = false;
    this.isTimelineTreeDropdownOpen = false;
    this.isSpaceDropdownOpen = false;
    this.activeDropdownId = null;
    this.showFilter = !this.showFilter;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event?: MouseEvent): void {
    if (event) {
      const target = event.target as HTMLElement;
      if (!target.closest('.filter-dropdown-wrapper')) {
        this.showFilter = false;
      }
      if (!target.closest('.space-dropdown-wrapper')) {
        this.isSpaceDropdownOpen = false;
      }
      if (!target.closest('.timeline-dropdown-wrapper')) {
        this.isTimelineDropdownOpen = false;
      }
      if (!target.closest('.timeline-tree-dropdown-wrapper')) {
        this.isTimelineTreeDropdownOpen = false;
      }
    } else {
      this.showFilter = false;
      this.isSpaceDropdownOpen = false;
      this.isTimelineDropdownOpen = false;
      this.isTimelineTreeDropdownOpen = false;
    }
    this.activeDropdownId = null;
  }

  toggleDropdown(id: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.activeDropdownId === id) {
      this.activeDropdownId = null;
      return;
    }
    this.activeDropdownId = id;
    const trigger = event.currentTarget as HTMLElement;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      this.isDropup = (window.innerHeight - rect.bottom) < 170;
    }
  }

  closeDropdown(): void {
    this.activeDropdownId = null;
  }

  onNodeTitleClick(node: TreeNode, event: MouseEvent): void {
    event.stopPropagation();
    this.editNode(node);
  }

  editNode(node: TreeNode): void {
    const isKr = node.type === 'ind_kr' || node.type === 'team_kr' || node.id.startsWith('KR-');
    if (isKr) {
      this.editingKrNode = node;
      this.editKrTitle = node.title;
      this.editKrExpected = parseFloat(node.resultE) || 100;
      this.showKrModal = true;
    } else {
      this.router.navigate(['/objectives', node.id]);
    }
  }

  saveKrEdit(): void {
    if (!this.editingKrNode) return;
    this.isSavingKr = true;
    this.okrService.updateKeyResult(this.editingKrNode.id, {
      title: this.editKrTitle,
      expected_value: Number(this.editKrExpected)
    }).subscribe({
      next: () => {
        this.isSavingKr = false;
        this.showKrModal = false;
        this.loadTreeData();
      },
      error: (err) => {
        this.isSavingKr = false;
        console.error('Lỗi khi cập nhật Key Result:', err);
        alert('Lỗi khi cập nhật Key Result: ' + (err.error?.error || err.message));
      }
    });
  }

  async cloneNode(node: TreeNode): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận nhân bản',
      message: `Bạn có muốn nhân bản "${node.title}" (${node.id}) không?`,
      confirmText: 'Nhân bản',
      type: 'info'
    });
    if (!ok) return;

    this.loading = true;
    this.okrService.cloneObjective(node.id).subscribe({
      next: () => {
        this.loadTreeData();
      },
      error: (err) => {
        this.loading = false;
        console.error('Lỗi khi nhân bản:', err);
        this.confirmService.confirm({
          title: 'Lỗi khi nhân bản',
          message: err.error?.error || 'Không thể nhân bản mục tiêu này. Vui lòng kiểm tra lại.',
          confirmText: 'Đóng',
          cancelText: '',
          type: 'danger'
        });
      }
    });
  }

  async deleteNode(node: TreeNode): Promise<void> {
    const isKr = node.type === 'ind_kr' || node.type === 'team_kr' || node.id.startsWith('KR-');
    const typeLabel = isKr ? 'Key Result' : 'Mục tiêu';
    const ok = await this.confirmService.confirm({
      title: `Xác nhận xóa ${typeLabel}`,
      message: `Bạn có chắc chắn muốn xóa ${typeLabel} "${node.title}" (${node.id}) khỏi cơ sở dữ liệu không? Thao tác này sẽ xóa vĩnh viễn và không thể khôi phục.`,
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.loading = true;
    const deleteObs = isKr 
      ? this.okrService.deleteKeyResult(node.id)
      : this.okrService.deleteObjective(node.id);

    deleteObs.subscribe({
      next: () => {
        this.removeNodeRecursive(this.treeData, node.id);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        console.error(`Lỗi khi xóa ${typeLabel}:`, err);
        alert(`Lỗi khi xóa ${typeLabel}: ` + (err.error?.error || err.message));
      }
    });
  }

  private removeNodeRecursive(nodes: TreeNode[], targetId: string): boolean {
    const index = nodes.findIndex(n => n.id === targetId);
    if (index !== -1) {
      nodes.splice(index, 1);
      return true;
    }
    for (const node of nodes) {
      if (node.children && this.removeNodeRecursive(node.children, targetId)) {
        return true;
      }
    }
    return false;
  }
}

