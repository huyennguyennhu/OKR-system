import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { OkrService, Space, Timeline, Employee, Team, OkrComment } from '../../services/okr.service';
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

  objective_id?: string;
  parent_kr_id?: string;
  unit?: string;
  direction?: string;
  description?: string;
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
                    <option value="binhtt">Trần Thị Bình</option>
                    <option value="cuonglh">Lê Hoàng Cường</option>
                    <option value="anhnv">Nguyễn Văn Anh</option>
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
          
          <!-- Timeline Dropdown (Chỉ chọn Năm) -->
          <div class="d-flex flex-column" style="font-size: 13px; color: #64748b;">
            <span class="mb-1">Timeline</span>
            <div class="position-relative timeline-dropdown-wrapper">
              <button type="button" class="toolbar-dropdown-trigger" style="min-width: 120px;" (click)="toggleTimelineDropdown($event)" [class.active]="isTimelineDropdownOpen" title="Chọn Timeline">
                <span class="d-flex align-items-center gap-2 text-truncate" style="min-width: 0; flex: 1;">
                  <i class="fa-solid fa-calendar-days text-primary flex-shrink-0"></i>
                  <span class="dropdown-label text-truncate fw-semibold">{{ selectedTimeline }}</span>
                </span>
                <i class="fa-solid fa-chevron-down ms-1 chevron-icon flex-shrink-0" [class.rotate]="isTimelineDropdownOpen"></i>
              </button>
              <div class="custom-select-menu timeline-dropdown-menu" *ngIf="isTimelineDropdownOpen" style="min-width: 130px; z-index: 1080;">
                <div class="custom-select-option" *ngFor="let tl of timelineOptions" [class.selected]="tl === selectedTimeline" (click)="selectTimeline(tl)">
                  <span class="d-flex align-items-center gap-2">
                    <i class="fa-solid fa-calendar-days text-primary"></i>
                    <span style="color: #1e293b; font-weight: 500;">{{ tl }}</span>
                  </span>
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
              <!-- Collapsible Tree Dropdown Panel -->
              <div class="custom-select-menu timeline-tree-dropdown-menu p-0" *ngIf="isTimelineTreeDropdownOpen">
                <div class="timeline-tree-scroll-container">
                  <ng-container *ngFor="let yearNode of timelineTreeNav">
                    <!-- Year Node (Root) -->
                    <div class="custom-option" [class.selected]="isNavNodeSelected(yearNode.title)" (click)="selectTimelineTreeNode(yearNode)">
                      <div class="d-flex align-items-center" style="margin-left: 0px;">
                        <span class="toggle-icon material-icons-round btn" (click)="toggleNavNode(yearNode.id, $event)">
                          {{ isNavNodeCollapsed(yearNode.id) ? 'chevron_right' : 'keyboard_arrow_down' }}
                        </span>
                        <!-- Custom Timeline Logo Icon matching User Snippet -->
                        <span class="d-inline-flex align-items-center justify-content-center me-2 icon-timeline" style="width: 18px; height: 18px; flex-shrink: 0;">
                          <svg data-name="Group 16352" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 26 26" fit="" preserveAspectRatio="xMidYMid meet" focusable="false">
                            <rect data-name="Rectangle 7584" width="26" height="26" rx="3" style="fill:#42526e"></rect>
                            <g data-name="Group 16349">
                              <path data-name="Rectangle 7599" style="fill:#42526e" d="M0 0h24v24H0z" transform="translate(1 1)"></path>
                            </g>
                            <g data-name="Group 16351">
                              <g data-name="Group 16350" transform="translate(3.05 3.05)">
                                <path data-name="Path 29904" d="M4.07 13H2.05a10.013 10.013 0 0 0 2.21 5.33l1.43-1.43A7.941 7.941 0 0 1 4.07 13z" transform="translate(-2.05 -2.05)" style="fill:#fff"></path>
                                <path data-name="Path 29905" d="M5.69 7.1 4.26 5.67A10.013 10.013 0 0 0 2.05 11h2.02a7.941 7.941 0 0 1 1.62-3.9z" transform="translate(-2.05 -2.05)" style="fill:#fff"></path>
                                <path data-name="Path 29906" d="M11 4.07V2.05a10.013 10.013 0 0 0-5.33 2.21L7.1 5.69A7.941 7.941 0 0 1 11 4.07z" transform="translate(-2.05 -2.05)" style="fill:#fff"></path>
                                <path data-name="Path 29907" d="M18.33 4.26A10.013 10.013 0 0 0 13 2.05v2.02a7.941 7.941 0 0 1 3.9 1.62z" transform="translate(-2.05 -2.05)" style="fill:#fff"></path>
                                <path data-name="Path 29908" d="m18.31 16.9 1.43 1.43A9.981 9.981 0 0 0 21.95 13h-2.02a7.941 7.941 0 0 1-1.62 3.9z" transform="translate(-2.05 -2.05)" style="fill:#fff"></path>
                                <path data-name="Path 29909" d="M19.93 11h2.02a10.013 10.013 0 0 0-2.21-5.33L18.31 7.1a7.941 7.941 0 0 1 1.62 3.9z" transform="translate(-2.05 -2.05)" style="fill:#fff"></path>
                                <path data-name="Path 29910" d="M13 19.93v2.02a10.013 10.013 0 0 0 5.33-2.21l-1.43-1.43a7.941 7.941 0 0 1-3.9 1.62z" transform="translate(-2.05 -2.05)" style="fill:#fff"></path>
                                <path data-name="Path 29911" d="M5.67 19.74A9.981 9.981 0 0 0 11 21.95v-2.02a7.941 7.941 0 0 1-3.9-1.62z" transform="translate(-2.05 -2.05)" style="fill:#fff"></path>
                                <circle data-name="Ellipse 656" cx="5" cy="5" r="5" transform="translate(4.949 4.95)" style="fill:#fff"></circle>
                              </g>
                            </g>
                          </svg>
                        </span>
                        <span class="option-label fw-bold text-dark">{{ yearNode.title }}</span>
                      </div>
                    </div>

                    <!-- Quarters (Child of Year) -->
                    <ng-container *ngIf="!isNavNodeCollapsed(yearNode.id)">
                      <ng-container *ngFor="let qNode of yearNode.children">
                        <div class="custom-option" [class.selected]="isNavNodeSelected(qNode.title)" (click)="selectTimelineTreeNode(qNode, yearNode.title)">
                          <div class="d-flex align-items-center" style="margin-left: 15px;">
                            <span class="toggle-icon material-icons-round btn" (click)="toggleNavNode(qNode.id, $event)">
                              {{ isNavNodeCollapsed(qNode.id) ? 'chevron_right' : 'keyboard_arrow_down' }}
                            </span>
                            <span class="fa material-icons-outlined icon-md text-secondary me-2" style="font-size: 18px;">event</span>
                            <span class="option-label" [ngClass]="isNavNodeSelected(qNode.title) ? 'fw-bold text-primary' : 'text-dark'">{{ qNode.title }}</span>
                          </div>
                        </div>

                        <!-- Months (Child of Quarter) -->
                        <ng-container *ngIf="!isNavNodeCollapsed(qNode.id)">
                          <div class="custom-option" *ngFor="let mNode of qNode.children" [class.selected]="isNavNodeSelected(mNode.title)" (click)="selectTimelineTreeNode(mNode, yearNode.title)">
                            <div class="d-flex align-items-center" style="margin-left: 30px;">
                              <span class="toggle-icon material-icons-round btn hidden">keyboard_arrow_down</span>
                              <span class="fa material-icons-outlined icon-md text-secondary me-2" style="font-size: 18px;">date_range</span>
                              <span class="option-label" [ngClass]="isNavNodeSelected(mNode.title) ? 'fw-bold text-primary' : 'text-dark'">{{ mNode.title }}</span>
                            </div>
                          </div>
                        </ng-container>
                      </ng-container>
                    </ng-container>
                  </ng-container>
                </div>

                <!-- Footer: Manage Timeline -->
                <div class="timeline-tree-footer">
                  <button type="button" class="btn btn-link px-0 text-primary fw-medium text-decoration-none" (click)="navigateToManageTimeline($event)" style="font-size: 13px;">
                    Manage Timeline
                  </button>
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
                <span class="space-label">{{ selectedSpaceId === 'all' ? 'Tất cả Không gian' : (selectedSpace ? selectedSpace.name : 'Chọn Space') }}</span>
                <i class="fa-solid fa-chevron-down ms-1 chevron-icon" [class.rotate]="isSpaceDropdownOpen"></i>
              </button>
              <div class="custom-select-menu space-dropdown-menu" *ngIf="isSpaceDropdownOpen">
                <div class="custom-select-option" [class.selected]="selectedSpaceId === 'all'" (click)="selectAllSpaces()">
                  <span style="color: #1e293b; font-weight: 500;">Tất cả Không gian</span>
                  <i class="fa-solid fa-check check-icon ms-2" *ngIf="selectedSpaceId === 'all'"></i>
                </div>
                <div class="custom-select-option" *ngFor="let s of spaces" [class.selected]="s.id === selectedSpaceId" (click)="selectSpace(s)">
                  <span style="color: #1e293b; font-weight: 500;">{{ s.name }}</span>
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
                  <tr [attr.id]="'tree-node-' + node.id" [class.highlighted-node-row]="highlightedNodeId === node.id">
                    <!-- KPI Column (Tree) -->
                    <td class="kpi-cell" [style.padding-left.rem]="depth * 1.5 + 0.5">
                      <div class="d-flex align-items-center gap-2">
                        <!-- Expand/Collapse Chevron -->
                        <div class="chevron-box" [style.visibility]="node.children && node.children.length > 0 ? 'visible' : 'hidden'" (click)="toggleNode(node)">
                          <i class="fa-solid text-muted" [ngClass]="node.expanded ? 'fa-chevron-down' : 'fa-chevron-right'" style="font-size: 10px;"></i>
                        </div>
                        
                        <!-- Icon based on type -->
                        <div class="icon-box" [ngClass]="getIconColorClass(node.type)">
                          <i class="fa-solid" [ngClass]="getIconClass(node.type)"></i>
                        </div>
                        
                        <!-- Title -->
                        <span class="node-title cursor-pointer" [title]="isKrNode(node) ? 'Mở bảng thông tin Key Result' : 'Xem chi tiết Objective'">
                          <span class="node-id me-1" (click)="onNodeIdClick(node, $event)" title="Đi tới trang chi tiết">{{ node.id }}</span>
                          <span class="node-text" (click)="onNodeTextClick(node, $event)">{{ node.title }}</span>
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
                        <span class="assignee-text">{{ formatAssignTo(node.assignTo) }}</span>
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

      <!-- Right Bar (Drawer) for Key Result Details -->
      <div class="kr-drawer-backdrop" *ngIf="showRightBar" (click)="closeKrRightBar()"></div>
      <div class="kr-drawer-panel" [class.open]="showRightBar" *ngIf="showRightBar">
        
        <!-- Header: Breadcrumbs & Actions -->
        <div class="kr-drawer-header d-flex justify-content-between align-items-center p-3 border-bottom">
          <!-- Breadcrumbs Trail -->
          <div class="kr-breadcrumbs-trail d-flex align-items-center flex-wrap gap-1" style="font-size: 13px;">
            <ng-container *ngFor="let item of selectedKrDetail?.ancestors || []; let last = last">
              <span class="breadcrumb-chip d-flex align-items-center gap-1 text-primary cursor-pointer" 
                    [class.fw-bold]="last" 
                    (click)="onBreadcrumbClick(item)" 
                    [title]="item.title">
                <i class="fa-solid" [ngClass]="item.icon || 'fa-folder'"></i>
                <span>{{ item.id }}</span>
              </span>
              <span class="text-muted mx-1" *ngIf="!last">/</span>
            </ng-container>
            <ng-container *ngIf="!selectedKrDetail?.ancestors || selectedKrDetail?.ancestors.length === 0">
              <span class="breadcrumb-chip d-flex align-items-center gap-1 text-primary fw-bold">
                <i class="fa-solid fa-bullseye"></i>
                <span>{{ selectedKrNode?.id }}</span>
              </span>
            </ng-container>
          </div>

          <!-- Top-right Action Buttons -->
          <div class="d-flex align-items-center gap-1">
            <button class="btn btn-sm btn-icon text-muted" (click)="closeKrRightBar()" title="Đóng">
              <i class="fa-solid fa-xmark" style="font-size: 15px;"></i>
            </button>
          </div>
        </div>

        <!-- Body: Scrollable Content -->
        <div class="kr-drawer-body p-3 flex-grow-1" style="overflow-y: auto; flex: 1 1 0%; min-height: 0;">
          
          <!-- Status Badge -->
          <div class="mb-2">
            <span class="badge px-2 py-1" 
                  [ngClass]="{
                    'bg-danger-subtle text-danger border border-danger-subtle': (selectedKrNode?.risk === 'danger' || (selectedKrNode?.progress || 0) < 50),
                    'bg-warning-subtle text-warning border border-warning-subtle': ((selectedKrNode?.risk === 'warning' || ((selectedKrNode?.progress || 0) >= 50 && (selectedKrNode?.progress || 0) < 75)) && selectedKrNode?.risk !== 'danger'),
                    'bg-success-subtle text-success border border-success-subtle': ((selectedKrNode?.progress || 0) >= 75 && selectedKrNode?.risk === 'none')
                  }" style="font-size: 11px; font-weight: 700;">
              <i class="fa-regular fa-clock me-1" *ngIf="selectedKrNode?.risk === 'danger' || (selectedKrNode?.progress || 0) < 50"></i>
              <i class="fa-solid fa-triangle-exclamation me-1" *ngIf="selectedKrNode?.risk === 'warning' || ((selectedKrNode?.progress || 0) >= 50 && (selectedKrNode?.progress || 0) < 75)"></i>
              <i class="fa-regular fa-circle-check me-1" *ngIf="(selectedKrNode?.progress || 0) >= 75"></i>
              {{ (selectedKrNode?.risk === 'danger' || (selectedKrNode?.progress || 0) < 50) ? 'OVERDUE' : (((selectedKrNode?.progress || 0) < 75) ? 'BEHIND' : 'ON TRACK') }}
            </span>
          </div>

          <!-- KR Title -->
          <h4 class="kr-drawer-title fw-bold text-dark mb-3" style="font-size: 17px; line-height: 1.4;">
            {{ selectedKrNode?.title }}
          </h4>

          <!-- ================= TAB GROUP 1: General & Detail ================= -->
          <div class="kr-drawer-tab-nav d-flex border-bottom mb-3">
            <button class="drawer-tab-link" [class.active]="activeTab1 === 'general'" (click)="activeTab1 = 'general'">
              General
            </button>
            <button class="drawer-tab-link" [class.active]="activeTab1 === 'detail'" (click)="activeTab1 = 'detail'">
              Detail
            </button>
          </div>

          <!-- TAB 1.1: General -->
          <div *ngIf="activeTab1 === 'general'" class="tab-pane-content mb-4">
            <!-- Description (Editable) -->
            <div class="mb-3">
              <div class="d-flex align-items-center justify-content-between mb-1">
                <label class="text-muted fw-bold mb-0" style="font-size: 12px;">Description</label>
                <button *ngIf="!isEditingDescription" 
                        type="button" 
                        class="btn btn-link btn-sm text-primary p-0 text-decoration-none d-flex align-items-center gap-1" 
                        (click)="startEditDescription()" 
                        style="font-size: 11.5px; font-weight: 500;">
                  <i class="fa-solid fa-pen-to-square" style="font-size: 11px;"></i> Sửa
                </button>
              </div>

              <!-- VIEW MODE -->
              <div *ngIf="!isEditingDescription" 
                   class="p-2 rounded bg-light border text-dark description-view-box" 
                   (click)="startEditDescription()"
                   title="Nhấn để chỉnh sửa mô tả"
                   style="font-size: 13px; line-height: 1.5; cursor: pointer; transition: all 0.15s ease;">
                <span *ngIf="currentDescriptionText">{{ currentDescriptionText }}</span>
                <span *ngIf="!currentDescriptionText" class="text-muted fst-italic" style="font-size: 12.5px;">Chưa có mô tả cho Key Result này. Nhấn để thêm...</span>
              </div>

              <!-- EDIT MODE -->
              <div *ngIf="isEditingDescription" class="description-edit-box">
                <textarea class="form-control mb-2" rows="3" [(ngModel)]="editingDescriptionValue" 
                          placeholder="Nhập mô tả / quy tắc cho Key Result..." 
                          style="font-size: 13px; line-height: 1.5;"></textarea>
                <div class="d-flex justify-content-end gap-2">
                  <button type="button" class="btn btn-sm btn-light border" (click)="cancelEditDescription()" [disabled]="isSavingDescription" style="font-size: 12px;">Hủy</button>
                  <button type="button" class="btn btn-sm btn-primary" (click)="saveDescription()" [disabled]="isSavingDescription" style="font-size: 12px; background: #3b82f6; border-color: #3b82f6;">
                    <i class="fa-solid fa-check me-1"></i> {{ isSavingDescription ? 'Đang lưu...' : 'Lưu mô tả' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Thước đo tóm tắt (S, C, E) -->
            <div class="row g-2 mb-2 d-flex flex-nowrap w-100">
              <div class="col-4 flex-fill" style="flex: 1 1 0; min-width: 0;">
                <div class="metric-card p-2 rounded border bg-light text-center h-100">
                  <div class="text-muted" style="font-size: 11px;">Start (S)</div>
                  <div class="fw-bold text-dark text-truncate" style="font-size: 14px;">{{ selectedKrNode?.resultS }} {{ selectedKrNode?.unit || '%' }}</div>
                </div>
              </div>
              <div class="col-4 flex-fill" style="flex: 1 1 0; min-width: 0;">
                <div class="metric-card p-2 rounded border bg-primary-subtle border-primary-subtle text-center h-100">
                  <div class="text-primary fw-semibold" style="font-size: 11px;">Current (C)</div>
                  <div class="fw-bold text-primary text-truncate" style="font-size: 14px;">{{ selectedKrNode?.resultC }} {{ selectedKrNode?.unit || '%' }}</div>
                </div>
              </div>
              <div class="col-4 flex-fill" style="flex: 1 1 0; min-width: 0;">
                <div class="metric-card p-2 rounded border bg-light text-center h-100">
                  <div class="text-muted" style="font-size: 11px;">Expected (E)</div>
                  <div class="fw-bold text-success text-truncate" style="font-size: 14px;">{{ selectedKrNode?.resultE }} {{ selectedKrNode?.unit || '%' }}</div>
                </div>
              </div>
            </div>

          </div>

          <!-- TAB 1.2: Detail -->
          <div *ngIf="activeTab1 === 'detail'" class="tab-pane-content mb-4">
            <!-- Progress Bar Card -->
            <div class="p-3 rounded border bg-light mb-3">
              <div class="d-flex justify-content-between align-items-center mb-1" style="font-size: 13px;">
                <span class="text-muted fw-bold">Tiến độ hoàn thành:</span>
                <span class="fw-bold" [ngClass]="(selectedKrNode?.progress || 0) >= 70 ? 'text-success' : 'text-warning'">{{ selectedKrNode?.progress }}%</span>
              </div>
              <div class="progress" style="height: 6px;">
                <div class="progress-bar" [ngClass]="(selectedKrNode?.progress || 0) >= 70 ? 'bg-success' : 'bg-warning'" [style.width.%]="selectedKrNode?.progress"></div>
              </div>
            </div>

            <!-- Measurement Rules Details (bê từ OKR Detail) -->
            <div class="card p-3 border mb-3">
              <h6 class="fw-bold text-dark mb-2" style="font-size: 13px;">
                <i class="fa-solid fa-ruler-combined text-primary me-1"></i> Thuộc tính & Quy tắc đo SLA
              </h6>
              <div class="d-flex flex-column gap-2" style="font-size: 12px;">
                <div class="d-flex justify-content-between border-bottom pb-1">
                  <span class="text-muted">Loại sự kiện:</span>
                  <span class="fw-semibold text-dark">{{ selectedKrDetail?.rule?.event_type || 'GitLab Webhook' }}</span>
                </div>
                <div class="d-flex justify-content-between border-bottom pb-1">
                  <span class="text-muted">SLA tiêu chuẩn:</span>
                  <span class="fw-semibold text-primary">{{ selectedKrDetail?.rule?.sla_value || 24 }} giờ làm việc</span>
                </div>
                <div class="d-flex justify-content-between border-bottom pb-1">
                  <span class="text-muted">Bộ lọc nhãn:</span>
                  <span class="fw-semibold text-dark">{{ selectedKrDetail?.rule?.filters || 'Story / Bug / Improvement' }}</span>
                </div>
                <div class="d-flex justify-content-between border-bottom pb-1">
                  <span class="text-muted">Lịch làm việc:</span>
                  <span class="fw-semibold text-dark">Trừ 1.5h trưa, đóng băng T7/CN</span>
                </div>
                <div class="d-flex justify-content-between">
                  <span class="text-muted">Flow đồng bộ:</span>
                  <span class="badge bg-primary-subtle text-primary border">{{ selectedKrDetail?.rule?.flow_code || 'FLOW-ACTIVEPIECES' }}</span>
                </div>
              </div>
            </div>

            <!-- Quick update Current value -->
            <div class="p-3 rounded border bg-light">
              <label class="fw-bold text-dark mb-1" style="font-size: 12px; display: block;">Cập nhật nhanh giá trị C:</label>
              <div class="input-group input-group-sm">
                <input type="number" class="form-control" [(ngModel)]="newCheckinValue" step="0.1" style="font-size: 13px;">
                <button class="btn btn-primary btn-sm" (click)="submitCheckin()" [disabled]="isSubmittingCheckin">
                  <i class="fa-solid fa-check me-1"></i> {{ isSubmittingCheckin ? 'Đang lưu...' : 'Cập nhật C' }}
                </button>
              </div>
            </div>
          </div>

          <!-- ================= TAB GROUP 2: Comments, Check in, History ================= -->
          <div class="kr-drawer-tab-nav kr-drawer-tab-nav-sticky d-flex align-items-center justify-content-between border-bottom mb-3 mt-4 w-100">
            <div class="d-flex align-items-center">
              <button class="drawer-tab-link-box" [class.active]="activeTab2 === 'comments'" (click)="activeTab2 = 'comments'">
                Comments
              </button>
              <button class="drawer-tab-link-box" [class.active]="activeTab2 === 'checkin'" (click)="activeTab2 = 'checkin'">
                Check in
              </button>
              <button class="drawer-tab-link-box" [class.active]="activeTab2 === 'history'" (click)="activeTab2 = 'history'">
                History
              </button>
            </div>
            <!-- Sort on right side of tab nav (Newest first) - aligned to right -->
            <div class="ms-auto d-flex align-items-center" style="margin-left: auto;">
              <button *ngIf="activeTab2 === 'comments'" class="btn-sort-link" (click)="toggleCommentSort()" title="Đổi thứ tự sắp xếp">
                {{ commentSortOrder === 'newest' ? 'Newest first' : 'Oldest first' }}
                <i class="fa-solid fa-arrow-down ms-1" [style.transform]="commentSortOrder === 'oldest' ? 'rotate(180deg)' : 'none'" style="transition: transform 0.2s ease;"></i>
              </button>
              <button *ngIf="activeTab2 === 'checkin'" class="btn-sort-link" (click)="toggleCheckinSort()" title="Đổi thứ tự sắp xếp">
                {{ checkinSortOrder === 'newest' ? 'Newest first' : 'Oldest first' }}
                <i class="fa-solid fa-arrow-down ms-1" [style.transform]="checkinSortOrder === 'oldest' ? 'rotate(180deg)' : 'none'" style="transition: transform 0.2s ease;"></i>
              </button>
              <button *ngIf="activeTab2 === 'history'" class="btn-sort-link" (click)="toggleHistorySort()" title="Đổi thứ tự sắp xếp">
                {{ historySortOrder === 'newest' ? 'Newest first' : 'Oldest first' }}
                <i class="fa-solid fa-arrow-down ms-1" [style.transform]="historySortOrder === 'oldest' ? 'rotate(180deg)' : 'none'" style="transition: transform 0.2s ease;"></i>
              </button>
            </div>
          </div>

          <!-- TAB 2.1: Comments -->
          <div *ngIf="activeTab2 === 'comments'" class="tab-pane-content">
            <!-- Composer Area (Matches Screenshots 1 & 2) -->
            <div class="d-flex gap-2 mb-3 align-items-start">
              <!-- Current User Avatar -->
              <img src="https://ui-avatars.com/api/?name=Huyen+Nguyen&background=3157D5&color=fff&rounded=true" class="rounded-circle flex-shrink-0" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover;">

              <!-- STATE 1: Idle (Collapsed - Matches Screenshot 1 & 3) -->
              <div *ngIf="!isCommentEditorOpen" 
                   class="comment-idle-box flex-grow-1 p-2 border rounded bg-white" 
                   (click)="isCommentEditorOpen = true">
                <span style="color: #818cf8; font-size: 13.5px;">Comment something...</span>
              </div>

              <!-- STATE 2: Compose (Expanded with Toolbar - Matches Screenshot 2) -->
              <div *ngIf="isCommentEditorOpen" class="comment-editor-box border rounded bg-white flex-grow-1">
                <!-- Toolbar -->
                <div class="editor-toolbar d-flex align-items-center justify-content-between px-2 py-1 border-bottom" style="background: #ffffff;">
                  <div class="d-flex align-items-center gap-1">
                    <button type="button" class="btn-editor-tool fw-bold" (click)="insertFormat('**', '**')" title="Bold">B</button>
                    <button type="button" class="btn-editor-tool fst-italic" (click)="insertFormat('*', '*')" title="Italic">i</button>
                    <button type="button" class="btn-editor-tool" (click)="insertFormat('')" title="Text Color">A<span style="font-size: 9px; vertical-align: middle;">:</span></button>
                    <span class="editor-divider"></span>
                    <button type="button" class="btn-editor-tool text-primary" title="Align Left"><i class="fa-solid fa-align-left"></i></button>
                    <button type="button" class="btn-editor-tool" title="Align Center"><i class="fa-solid fa-align-center"></i></button>
                    <button type="button" class="btn-editor-tool" title="Align Right"><i class="fa-solid fa-align-right"></i></button>
                    <button type="button" class="btn-editor-tool" title="Paragraph"><i class="fa-solid fa-paragraph"></i></button>
                    <span class="editor-divider"></span>
                    <button type="button" class="btn-editor-tool" title="Tệp đính kèm"><i class="fa-regular fa-file"></i></button>
                    <button type="button" class="btn-editor-tool" title="Hình ảnh"><i class="fa-regular fa-image"></i></button>
                    <button type="button" class="btn-editor-tool" title="Video"><i class="fa-solid fa-video"></i></button>
                    <button type="button" class="btn-editor-tool" title="Thêm"><i class="fa-solid fa-plus"></i></button>
                  </div>
                  <div class="d-flex align-items-center gap-1">
                    <button type="button" class="btn-editor-tool" title="Undo"><i class="fa-solid fa-arrow-rotate-left"></i></button>
                    <button type="button" class="btn-editor-tool" title="Redo"><i class="fa-solid fa-arrow-rotate-right"></i></button>
                  </div>
                </div>

                <!-- Textarea -->
                <textarea class="form-control border-0 px-3 py-2 w-100" rows="3" [(ngModel)]="newKrComment" placeholder="Comment something..." style="font-size: 13.5px; resize: vertical; outline: none; box-shadow: none; min-height: 80px;"></textarea>

                <!-- Footer with Counters & Actions -->
                <div class="editor-footer d-flex align-items-center justify-content-between px-3 py-2 border-top bg-white">
                  <div class="text-muted" style="font-size: 11px;">
                    characters : {{ commentCharCount }} words : {{ commentWordCount }}
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    <button type="button" class="btn btn-link text-dark p-0 me-2 text-decoration-none" (click)="isCommentEditorOpen = false; newKrComment = ''" style="font-size: 13px; font-weight: 500;">Cancel</button>
                    <button type="button" class="btn btn-primary px-3 py-1" (click)="addKrComment()" [disabled]="!newKrComment.trim() || isAddingKrComment" style="font-size: 13px; border-radius: 4px; background: #3b82f6; border-color: #3b82f6; font-weight: 500;">
                      {{ isAddingKrComment ? 'Saving...' : 'Save' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Loading -->
            <div *ngIf="loadingKrComments" class="text-center py-3 text-muted">
              <i class="fa-solid fa-spinner fa-spin me-2"></i> Đang tải bình luận...
            </div>

            <!-- STATE 3: Comments List (Matches Screenshot 3) -->
            <div class="comments-list d-flex flex-column" *ngIf="!loadingKrComments && krComments.length > 0">
              <div class="comment-item d-flex gap-3 py-3 border-bottom" *ngFor="let c of sortedKrComments">
                <!-- Avatar (Syrix logo or user image) -->
                <div class="comment-avatar flex-shrink-0">
                  <div *ngIf="isBotAuthor(c.author, c.source)" class="syrix-avatar-ring">
                    <div class="syrix-avatar-pupil"></div>
                  </div>
                  <img *ngIf="!isBotAuthor(c.author, c.source)" 
                       [src]="c.author_avatar || ('https://ui-avatars.com/api/?name=' + c.author + '&background=3157D5&color=fff&rounded=true')" 
                       class="rounded-circle" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover;">
                </div>

                <!-- Comment Content -->
                <div class="comment-body flex-grow-1" style="min-width: 0;">
                  <div class="d-flex align-items-center gap-2 mb-1">
                    <span class="fw-bold text-dark" style="font-size: 13.5px;">{{ formatAuthorName(c.author, c.source) }}</span>
                    <span class="text-muted" style="font-size: 12px;">{{ formatCommentDate(c.created_at || c.time) }}</span>
                    <button type="button" class="btn-trace-link-sm" (click)="traceFlowRun(c)" title="Truy vết lần chạy Flow trên Flow Runs">
                      <i class="fa-solid fa-arrow-up-right-from-square me-1"></i> Truy vết
                    </button>
                    <button class="btn btn-link text-muted p-0 ms-auto" title="Xóa" (click)="deleteKrComment(c.comment_id)" *ngIf="c.comment_id">
                      <i class="fa-regular fa-trash-can" style="font-size: 11px;"></i>
                    </button>
                  </div>
                  <div class="comment-text text-dark" style="font-size: 13px; line-height: 1.55; white-space: pre-wrap;">{{ c.content }}</div>
                </div>
              </div>
            </div>

            <!-- Empty Comments -->
            <div class="text-center py-4 text-muted" *ngIf="!loadingKrComments && krComments.length === 0">
              <i class="fa-regular fa-comment-dots fa-2x mb-1 text-secondary opacity-50 d-block"></i>
              <p class="mb-0" style="font-size: 12.5px;">Chưa có bình luận nào cho Key Result này.</p>
            </div>
          </div>

          <!-- TAB 2.2: Check in -->
          <div *ngIf="activeTab2 === 'checkin'" class="tab-pane-content">
            <!-- Form Check in mới (Cập nhật số liệu & ghi chú Note) -->
            <div class="p-3 rounded border bg-light mb-3">
              <div class="d-flex align-items-center justify-content-between mb-2">
                <span class="fw-bold text-dark" style="font-size: 13px;">Ghi nhận lần Check-in mới</span>
                <span class="text-muted" style="font-size: 11.5px;">Cập nhật số liệu & ghi chú Note</span>
              </div>
              <div class="row g-2 mb-2 d-flex flex-nowrap w-100">
                <div class="col-4" style="flex: 0 0 130px;">
                  <label class="text-muted" style="font-size: 11px;">Giá trị C mới:</label>
                  <input type="number" class="form-control form-control-sm bg-white" [(ngModel)]="newCheckinValue" step="0.1" placeholder="Nhập C...">
                </div>
                <div class="col-8 flex-fill" style="flex: 1 1 0; min-width: 0;">
                  <label class="text-muted" style="font-size: 11px;">Ghi chú (Note):</label>
                  <input type="text" class="form-control form-control-sm bg-white" [(ngModel)]="newCheckinNote" placeholder="Lý do hoặc kết quả...">
                </div>
              </div>
              <div class="d-flex justify-content-end">
                <button class="btn btn-primary btn-sm px-3" (click)="submitCheckin()" [disabled]="isSubmittingCheckin" style="background: #3b82f6; border-color: #3b82f6;">
                  <i class="fa-solid fa-floppy-disk me-1"></i> {{ isSubmittingCheckin ? 'Đang lưu...' : 'Lưu Check-in' }}
                </button>
              </div>
            </div>

            <!-- Loading -->
            <div *ngIf="loadingKrCheckins" class="text-center py-3 text-muted">
              <i class="fa-solid fa-spinner fa-spin me-2"></i> Đang tải lịch sử check-in...
            </div>

            <!-- Checkin Feed List (Matches media_1793682152604_e86d3e81.png) -->
            <div class="checkin-feed-list d-flex flex-column" *ngIf="!loadingKrCheckins && krCheckins.length > 0">
              <div class="checkin-feed-item d-flex gap-3 py-3 border-bottom" *ngFor="let ck of sortedKrCheckins">
                <!-- Avatar: Syrix logo if Syrix Task/activepieces, else user avatar -->
                <div class="checkin-avatar flex-shrink-0">
                  <div *ngIf="isBotAuthor(ck.author)" class="syrix-avatar-ring">
                    <div class="syrix-avatar-pupil"></div>
                  </div>
                  <img *ngIf="!isBotAuthor(ck.author)" 
                       [src]="ck.author_avatar || getAvatarUrl(ck.author)" 
                       class="rounded-circle" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover;">
                </div>

                <!-- Checkin Content -->
                <div class="checkin-body flex-grow-1" style="min-width: 0;">
                  <!-- Line 1: Author updated the [field] value to [value] [relative time] + Trace Button -->
                  <div class="checkin-headline d-flex align-items-center justify-content-between flex-wrap gap-2 text-dark mb-1" style="font-size: 13px; line-height: 1.45;">
                    <div>
                      <strong class="fw-bold">{{ formatAuthorName(ck.author) }}</strong>
                      <span> updated the {{ ck.target_field || 'Current' }} value to </span>
                      <strong class="fw-bold">{{ ck.current_value }}</strong>
                      <span class="text-muted ms-2" style="font-size: 12px;">{{ formatRelativeTime(ck.calculated_at) }}</span>
                    </div>
                    <!-- Nút Truy vết lần chạy Flow -->
                    <button type="button" class="btn-trace-link" (click)="traceFlowRun(ck)" title="Truy vết lần chạy Flow trên Flow Runs (Mở tab Flow và bản ghi cụ thể)">
                      <i class="fa-solid fa-arrow-up-right-from-square me-1"></i> Truy vết
                    </button>
                  </div>

                  <!-- Line 2: Khung nội dung ghi nhận từ Flow (Comment-like Box - Khóa không thể sửa) -->
                  <div class="checkin-content-box mt-2">
                    <div class="content-box-header d-flex align-items-center justify-content-between mb-1">
                      <div class="d-flex align-items-center gap-1 content-box-title">
                        <i class="fa-solid fa-robot text-primary" *ngIf="isBotAuthor(ck.author)" style="font-size: 11.5px;"></i>
                        <i class="fa-solid fa-comment-dots text-primary" *ngIf="!isBotAuthor(ck.author)" style="font-size: 11.5px;"></i>
                        <span style="font-size: 12px; font-weight: 600; color: #334155;">
                          {{ isBotAuthor(ck.author) ? 'Nội dung ghi nhận từ Flow' : 'Nội dung Check-in' }}
                        </span>
                      </div>
                      <span class="badge-readonly" title="Bản ghi check-in đã khóa và có giá trị pháp lý, không được phép chỉnh sửa">
                        <i class="fa-solid fa-lock me-1"></i>Không thể sửa
                      </span>
                    </div>
                    <div class="content-box-text">
                      {{ ck.note || 'Giá trị C được cập nhật tự động từ Activepieces Flow.' }}
                    </div>
                    <!-- Metadata row if flow/run linked -->
                    <div class="content-box-meta mt-2 pt-1 border-top d-flex align-items-center justify-content-between text-muted" *ngIf="ck.flow_code || ck.run_id" style="font-size: 11px;">
                      <span>
                        <i class="fa-solid fa-diagram-project me-1 text-primary"></i>
                        Flow: <strong class="text-dark">{{ ck.flow_code || getFlowCodeForKr(selectedKrNode?.id) }}</strong>
                      </span>
                      <span *ngIf="ck.run_id">
                        Mã lần chạy: <code class="text-primary fw-bold">{{ ck.run_id }}</code>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty Checkins -->
            <div class="text-center py-4 text-muted" *ngIf="!loadingKrCheckins && krCheckins.length === 0">
              <i class="fa-solid fa-clock-rotate-left fa-2x mb-1 text-secondary opacity-50 d-block"></i>
              <p class="mb-0" style="font-size: 12.5px;">Chưa có lịch sử thay đổi giá trị C cho Key Result này.</p>
            </div>
          </div>

          <!-- TAB 2.3: History (Matches media_1793682184386_1cea203b.png) -->
          <div *ngIf="activeTab2 === 'history'" class="tab-pane-content">
            <!-- Loading -->
            <div *ngIf="loadingKrHistory" class="text-center py-3 text-muted">
              <i class="fa-solid fa-spinner fa-spin me-2"></i> Đang tải nhật ký lịch sử...
            </div>

            <!-- History Feed List -->
            <div class="history-feed-list d-flex flex-column" *ngIf="!loadingKrHistory && krHistory.length > 0">
              <div class="history-feed-item d-flex gap-3 py-3 border-bottom" *ngFor="let h of sortedKrHistory">
                <!-- Avatar on left -->
                <div class="history-avatar flex-shrink-0">
                  <div *ngIf="isBotAuthor(h.author)" class="syrix-avatar-ring">
                    <div class="syrix-avatar-pupil"></div>
                  </div>
                  <img *ngIf="!isBotAuthor(h.author)" 
                       [src]="h.author_avatar || getAvatarUrl(h.author)" 
                       class="rounded-circle" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover;">
                </div>

                <!-- Details on right -->
                <div class="history-body flex-grow-1" style="min-width: 0;">
                  <!-- Line 1: Author updated the [field_name]  [relative time] -->
                  <div class="history-headline text-dark mb-1" style="font-size: 13.5px; line-height: 1.45;">
                    <strong class="fw-bold">{{ formatAuthorName(h.author) }}</strong>
                    <span> updated the {{ h.field_name }}</span>
                    <span class="text-muted ms-2" style="font-size: 12.5px;">{{ formatRelativeTime(h.created_at) }}</span>
                  </div>

                  <!-- Line 2: [old_value] → [new_value] -->
                  <div class="history-diff d-flex align-items-center flex-wrap gap-2" style="font-size: 13px; line-height: 1.55;">
                    <!-- Old value -->
                    <span class="old-val" [style.color]="(!h.old_value || h.old_value.trim() === 'None') ? '#94a3b8' : '#334155'">
                      {{ h.old_value || 'None' }}
                    </span>

                    <!-- Arrow -->
                    <span class="diff-arrow mx-1" style="color: #94a3b8; font-size: 13px;">→</span>

                    <!-- New value with optional avatar (e.g. for Assignee) -->
                    <span class="new-val d-inline-flex align-items-center gap-1" style="color: #0f172a;">
                      <img *ngIf="h.new_value_avatar" [src]="h.new_value_avatar" class="rounded-circle" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;">
                      <span>{{ h.new_value }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty History -->
            <div class="text-center py-4 text-muted" *ngIf="!loadingKrHistory && krHistory.length === 0">
              <i class="fa-solid fa-clock-rotate-left fa-2x mb-1 text-secondary opacity-50 d-block"></i>
              <p class="mb-0" style="font-size: 12.5px;">Chưa có dữ liệu nhật ký sự kiện cho Key Result này.</p>
            </div>
          </div>

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

      <!-- Modal Xác nhận Nhân bản OKR / Key Result -->
      <div class="confirm-overlay" *ngIf="showCloneModal" (click)="closeCloneModal()">
        <div class="confirm-dialog-box" style="width: 480px; max-width: 95%;" (click)="$event.stopPropagation()">
          <div class="confirm-header">
            <div class="confirm-header-left">
              <div class="confirm-icon-box icon-info">
                <i class="fa-solid fa-circle-info"></i>
              </div>
              <h3 class="confirm-title">Xác nhận nhân bản</h3>
            </div>
            <button type="button" aria-label="Đóng" class="close-btn" (click)="closeCloneModal()">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="confirm-body" style="padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
            <!-- Hàng 1: KR / Objective -->
            <div class="clone-field-row">
              <label class="clone-field-label fw-bold mb-1" style="font-size: 13px; color: #475569; display: block;">
                {{ isCloningKr ? 'KR:' : 'Objective:' }}
              </label>
              <div class="clone-target-item p-2 rounded border bg-light d-flex align-items-center gap-2" style="font-size: 13px; min-height: 38px;">
                <i [class]="isCloningKr ? 'fa-solid fa-bullseye text-primary flex-shrink-0' : (cloningNode?.type === 'company_obj' ? 'fa-solid fa-building text-primary flex-shrink-0' : 'fa-solid fa-users text-info flex-shrink-0')"></i>
                <span class="text-truncate fw-medium text-dark" style="flex: 1;" [title]="cloningNode?.title">{{ cloningNode?.title }}</span>
                <span class="badge bg-white text-secondary border px-2 py-1 flex-shrink-0" style="font-size: 11px;">{{ cloningNode?.id }}</span>
              </div>
            </div>

            <!-- Hàng 2: Assign to -->
            <div class="clone-field-row clone-dropdown-wrapper position-relative">
              <label class="clone-field-label fw-bold mb-1" style="font-size: 13px; color: #475569; display: block;">
                Assign to:
              </label>

              <!-- Level Company: locked Toàn Công Ty -->
              <div *ngIf="cloneAssignType === 'company'" class="p-2 rounded border bg-light d-flex align-items-center gap-2 text-muted" style="font-size: 13px; height: 38px;">
                <i class="fa-solid fa-building text-secondary flex-shrink-0"></i>
                <span class="fw-medium text-dark">Toàn Công Ty</span>
                <span class="badge bg-secondary-subtle text-secondary ms-auto" style="font-size: 11px;">Mặc định</span>
              </div>

              <!-- Level Team: dropdown of teams -->
              <div *ngIf="cloneAssignType === 'team'" class="custom-select-wrapper position-relative w-100">
                <button type="button" class="custom-select-trigger w-100" (click)="isCloneDropdownOpen = !isCloneDropdownOpen; $event.stopPropagation()" [class.active]="isCloneDropdownOpen" style="height: 38px;">
                  <span class="d-flex align-items-center gap-2 text-truncate" style="min-width: 0; flex: 1;">
                    <i class="fa-solid fa-users text-info flex-shrink-0"></i>
                    <span class="text-truncate text-dark fw-medium">{{ getCloneSelectedTeamLabel() }}</span>
                  </span>
                  <i class="fa-solid fa-chevron-down chevron-icon flex-shrink-0" [class.rotate]="isCloneDropdownOpen"></i>
                </button>
                <div class="custom-select-menu w-100 shadow-sm" *ngIf="isCloneDropdownOpen" style="max-height: 200px; overflow-y: auto; z-index: 1050; position: absolute; top: 100%; left: 0; margin-top: 4px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);">
                  <div class="custom-select-option" *ngFor="let team of teamsList" [class.selected]="selectedCloneAssigneeId === (team.id || team.code)" (click)="selectCloneTeam(team); $event.stopPropagation()" style="padding: 8px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between;">
                    <span class="d-flex align-items-center gap-2 text-truncate">
                      <i class="fa-solid fa-users text-muted flex-shrink-0"></i>
                      <span class="text-truncate">{{ team.name }}</span>
                    </span>
                    <i class="fa-solid fa-check text-primary ms-2" *ngIf="selectedCloneAssigneeId === (team.id || team.code)"></i>
                  </div>
                </div>
              </div>

              <!-- Level Personal: dropdown of employees -->
              <div *ngIf="cloneAssignType === 'personal'" class="custom-select-wrapper position-relative w-100">
                <button type="button" class="custom-select-trigger w-100" (click)="isCloneDropdownOpen = !isCloneDropdownOpen; $event.stopPropagation()" [class.active]="isCloneDropdownOpen" style="height: 38px;">
                  <span class="d-flex align-items-center gap-2 text-truncate" style="min-width: 0; flex: 1;">
                    <i class="fa-solid fa-user text-primary flex-shrink-0"></i>
                    <span class="text-truncate text-dark fw-medium">{{ getCloneSelectedEmployeeLabel() }}</span>
                  </span>
                  <i class="fa-solid fa-chevron-down chevron-icon flex-shrink-0" [class.rotate]="isCloneDropdownOpen"></i>
                </button>
                <div class="custom-select-menu w-100 shadow-sm" *ngIf="isCloneDropdownOpen" style="max-height: 200px; overflow-y: auto; z-index: 1050; position: absolute; top: 100%; left: 0; margin-top: 4px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);">
                  <div class="custom-select-option" *ngFor="let emp of employeesList" [class.selected]="selectedCloneAssigneeId === emp.employee_id" (click)="selectCloneEmployee(emp); $event.stopPropagation()" style="padding: 8px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between;">
                    <span class="d-flex align-items-center gap-2 text-truncate">
                      <i class="fa-solid fa-user text-muted flex-shrink-0"></i>
                      <span class="text-truncate">{{ emp.full_name }}</span>
                    </span>
                    <i class="fa-solid fa-check text-primary ms-2" *ngIf="selectedCloneAssigneeId === emp.employee_id"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="confirm-footer" style="padding: 1rem 1.5rem; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.5rem; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
            <button type="button" class="btn btn-secondary" (click)="closeCloneModal()" [disabled]="isCloning">
              Hủy
            </button>
            <button type="button" class="btn btn-primary" (click)="submitClone()" [disabled]="isCloning" style="background-color: #3157D5 !important; border-color: #3157D5 !important; color: #ffffff !important;">
              <i class="fa-solid fa-clone me-1" *ngIf="!isCloning"></i>
              <i class="fa-solid fa-spinner fa-spin me-1" *ngIf="isCloning"></i>
              {{ isCloning ? 'Đang nhân bản...' : 'Nhân bản' }}
            </button>
          </div>
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
    .w-100 { width: 100% !important; }
    .h-100 { height: 100% !important; }
    .flex-fill { flex: 1 1 0% !important; min-width: 0 !important; }
    .flex-nowrap { flex-wrap: nowrap !important; }
    .row { display: flex; flex-wrap: wrap; margin-left: -0.25rem; margin-right: -0.25rem; }
    .g-2 { gap: 0.5rem; }
    .col-4 { flex: 0 0 33.333333%; max-width: 33.333333%; padding-left: 0.25rem; padding-right: 0.25rem; box-sizing: border-box; }
    .col-6 { flex: 0 0 50%; max-width: 50%; padding-left: 0.25rem; padding-right: 0.25rem; box-sizing: border-box; }
    .metric-card { height: 100%; box-sizing: border-box; }
    .bg-primary-subtle { background-color: #eff6ff !important; }
    .border-primary-subtle { border-color: #bfdbfe !important; }
    
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
    
    @keyframes highlightPulse {
      0% {
        background-color: rgba(49, 87, 213, 0.22) !important;
        box-shadow: inset 0 0 0 2px #3157D5, 0 4px 16px rgba(49, 87, 213, 0.4);
      }
      70% {
        background-color: rgba(49, 87, 213, 0.12) !important;
        box-shadow: inset 0 0 0 2px #3b82f6, 0 2px 8px rgba(49, 87, 213, 0.25);
      }
      100% {
        background-color: transparent;
        box-shadow: none;
      }
    }
    .highlighted-node-row {
      animation: highlightPulse 3s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
      position: relative;
      z-index: 5;
    }
    .highlighted-node-row td {
      background-color: transparent !important;
    }
    
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
      flex-shrink: 0;
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
    
    .icon-box {
      font-size: 1rem;
      width: 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
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
        .timeline-tree-nav-container {
      padding: 4px 0;
    }
    .tree-nav-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      cursor: pointer;
      font-size: 13px;
      color: #334155;
      transition: background-color 0.15s;
    }
    .tree-nav-item:hover {
      background-color: #f1f5f9;
    }
    .tree-nav-item.selected {
      background-color: #e0f2fe;
      color: #0369a1;
      font-weight: 600;
    }
    .tree-nav-item.level-year {
      padding-left: 12px;
    }
    .tree-nav-item.level-quarter {
      padding-left: 28px;
    }
    .tree-nav-item.level-month {
      padding-left: 48px;
    }
    .chevron-box {
      width: 14px;
      height: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .manage-timeline-footer a:hover {
      text-decoration: underline !important;
    }
    .timeline-tree-dropdown-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
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
      font-size: 13px;
      color: #1e293b;
    }
    .custom-option:hover {
      background-color: #f1f5f9;
    }
    .custom-option.selected {
      background-color: #e0f2fe !important;
    }
    .custom-option.selected .option-label {
      color: #0369a1 !important;
      font-weight: 600 !important;
    }
    .custom-option .option-label {
      font-size: 13px;
      color: #1e293b;
    }
    .custom-option .toggle-icon.btn {
      width: 20px;
      height: 20px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: #64748b;
      font-size: 18px !important;
      cursor: pointer;
      border-radius: 4px;
      margin-right: 4px;
      flex-shrink: 0;
      line-height: 1;
      transition: all 0.15s ease;
    }
    .custom-option .toggle-icon.btn:hover {
      background-color: #e2e8f0;
      color: #0f172a;
    }
    .custom-option .toggle-icon.btn.hidden {
      visibility: hidden;
      cursor: default;
      pointer-events: none;
    }
    .timeline-tree-footer {
      border-top: 1px solid #e2e8f0;
      padding: 8px 14px;
      background: #f8fafc;
    }
    .timeline-tree-footer button:hover {
      text-decoration: underline !important;
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

    @keyframes modalFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes modalSlideUp {
      from { opacity: 0; transform: translateY(12px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .confirm-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      animation: modalFadeIn 0.2s ease-out;
    }
    .confirm-dialog-box {
      width: 480px;
      max-width: 95%;
      border-radius: 12px;
      background: #ffffff;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      display: flex;
      flex-direction: column;
      animation: modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .confirm-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      background-color: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      border-top-left-radius: 12px;
      border-top-right-radius: 12px;
    }
    .confirm-header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .confirm-icon-box {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
    }
    .confirm-icon-box.icon-info {
      background-color: #e0e7ff;
      color: #4f46e5;
    }
    .confirm-title {
      font-size: 16px !important;
      font-weight: 600 !important;
      color: #1e293b !important;
      margin: 0 !important;
    }
    .confirm-footer {
      border-bottom-left-radius: 12px;
      border-bottom-right-radius: 12px;
    }
    .clone-target-item {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
    }

    /* Right Bar (Drawer) Styles */
    .kr-drawer-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.35);
      backdrop-filter: blur(2px);
      z-index: 1040;
      animation: fadeIn 0.2s ease-out;
    }

    .kr-drawer-panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 520px;
      max-width: 90vw;
      background: #ffffff;
      z-index: 1050;
      box-shadow: -4px 0 25px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes slideInRight {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .kr-drawer-header {
      background: #ffffff;
      flex-shrink: 0;
    }

    .kr-drawer-body {
      flex: 1 1 0%;
      min-height: 0;
      overflow-y: auto !important;
      overflow-x: hidden;
    }

    .kr-drawer-tab-nav-sticky {
      position: sticky;
      top: -1rem;
      background: #ffffff;
      z-index: 10;
      padding-top: 0.75rem;
      margin-top: 1rem !important;
    }

    .comments-list,
    .checkin-feed-list,
    .history-feed-list {
      padding-bottom: 2.5rem;
    }

    .kr-drawer-body::-webkit-scrollbar {
      width: 6px;
    }

    .kr-drawer-body::-webkit-scrollbar-track {
      background: transparent;
    }

    .kr-drawer-body::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }

    .kr-drawer-body::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    .breadcrumb-chip {
      padding: 2px 6px;
      border-radius: 4px;
      background: #f1f5f9;
      text-decoration: none;
      font-size: 12px;
      transition: background 0.15s ease;
    }

    .breadcrumb-chip:hover {
      background: #e2e8f0;
    }

    .btn-icon {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      border: none;
      background: transparent;
      cursor: pointer;
    }

    .btn-icon:hover {
      background: #f1f5f9;
      color: #1e293b;
    }

    .kr-drawer-tab-nav {
      gap: 1.5rem;
    }

    .drawer-tab-link {
      background: none;
      border: none;
      padding: 0.5rem 0.25rem;
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .drawer-tab-link:hover {
      color: var(--primary, #3157D5);
    }

    .drawer-tab-link.active {
      color: var(--primary, #3157D5);
      border-bottom-color: var(--primary, #3157D5);
    }

    .node-id:hover {
      text-decoration: underline;
      color: var(--primary, #3157D5);
    }

    .node-text:hover {
      color: var(--primary, #3157D5);
    }

    /* Syrix Avatar with vibrant conic gradient ring (Matches Image 3) */
    .syrix-avatar-ring {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      padding: 3px;
      background: conic-gradient(from 180deg at 50% 50%, #f97316 0deg, #ef4444 120deg, #3b82f6 240deg, #f97316 360deg);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .syrix-avatar-pupil {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .syrix-avatar-pupil::after {
      content: '';
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #0f172a;
      position: absolute;
    }
    .syrix-avatar-pupil::before {
      content: '';
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #ffffff;
      position: absolute;
      top: 5px;
      left: 5px;
      z-index: 2;
    }

    /* Tab Link Box styling (Matches Screenshots 1, 2, 3) */
    .drawer-tab-link-box {
      border: 1px solid transparent;
      background: transparent;
      color: #64748b;
      padding: 6px 14px;
      font-weight: 500;
      font-size: 13.5px;
      cursor: pointer;
      border-radius: 6px 6px 0 0;
      transition: all 0.15s ease;
      margin-bottom: -1px;
    }
    .drawer-tab-link-box:hover {
      color: #2563eb;
    }
    .drawer-tab-link-box.active {
      border: 1px solid #e2e8f0;
      border-bottom: 1px solid #ffffff;
      background: #ffffff;
      color: #2563eb;
      font-weight: 600;
    }
    .btn-sort-link {
      background: none;
      border: none;
      color: #334155;
      font-size: 12.5px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 6px;
      font-weight: 500;
    }
    .btn-sort-link:hover {
      color: #2563eb;
    }

    .rounded-circle { border-radius: 50% !important; }
    .ms-auto { margin-left: auto !important; }
    /* Comment Idle Box (Collapsed) */
    .comment-idle-box {
      min-height: 44px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 14px;
      color: #94a3b8;
      font-size: 13.5px;
      cursor: pointer;
      display: flex;
      align-items: center;
      background: #ffffff;
      transition: border-color 0.15s ease;
    }
    .comment-idle-box:hover {
      border-color: #93c5fd;
    }

    .description-view-box:hover {
      background: #f1f5f9 !important;
      border-color: #93c5fd !important;
    }

    /* Comment Editor Box (Expanded) */
    .comment-editor-box {
      border: 1px solid #93c5fd;
      border-radius: 6px;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }
    .btn-editor-tool {
      background: transparent;
      border: none;
      padding: 3px 6px;
      color: #475569;
      font-size: 12.5px;
      border-radius: 4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      height: 24px;
    }
    .btn-editor-tool:hover {
      background: #f1f5f9;
      color: #0f172a;
    }
    .editor-divider {
      display: inline-block;
      width: 1px;
      height: 14px;
      background: #e2e8f0;
      margin: 0 4px;
    }

    /* History Filter Pills */
    .btn-filter-pill {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 3px 10px;
      font-size: 12px;
      color: #64748b;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-filter-pill:hover {
      background: #f1f5f9;
      color: #1e293b;
    }
    .btn-filter-pill.active {
      background: #eff6ff;
      border-color: #bfdbfe;
      color: #2563eb;
      font-weight: 600;
    }

    /* Audit Icon Circle */
    .audit-icon-circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      flex-shrink: 0;
    }
    .bg-info-subtle { background-color: #ecfeff !important; }
    .text-info { color: #0891b2 !important; }
    .border-info-subtle { border-color: #a5f3fc !important; }
    .bg-success-subtle { background-color: #f0fdf4 !important; }
    .border-success-subtle { border-color: #bbf7d0 !important; }
    .bg-danger-subtle { background-color: #fef2f2 !important; }
    .border-danger-subtle { border-color: #fecaca !important; }

    /* Trace Link Button */
    .btn-trace-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      font-size: 11.5px;
      font-weight: 600;
      color: #2563eb;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 4px;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease-in-out;
      margin-left: auto;
    }
    .btn-trace-link:hover {
      background: #2563eb;
      color: #ffffff;
      border-color: #2563eb;
    }
    .btn-trace-link-sm {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 6px;
      font-size: 11px;
      font-weight: 500;
      color: #2563eb;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 4px;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .btn-trace-link-sm:hover {
      background: #2563eb;
      color: #ffffff;
      border-color: #2563eb;
    }

    /* Checkin Content Box (Comment-like & Immutable) */
    .checkin-content-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      margin-top: 6px;
    }
    .content-box-title {
      color: #334155;
      font-weight: 600;
      font-size: 12px;
    }
    .badge-readonly {
      display: inline-flex;
      align-items: center;
      font-size: 10.5px;
      font-weight: 600;
      color: #64748b;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 1px 6px;
      border-radius: 4px;
      letter-spacing: 0.2px;
    }
    .content-box-text {
      font-size: 13px;
      color: #1e293b;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .content-box-meta {
      font-size: 11px;
      color: #64748b;
    }
  `]
})
export class OkrTreeComponent implements OnInit {
  // --- Right Bar (Drawer) State ---
  showRightBar = false;
  selectedKrNode: TreeNode | null = null;
  selectedKrDetail: any = null;
  loadingKrDetail = false;

  activeTab1: 'general' | 'detail' = 'general';
  activeTab2: 'comments' | 'checkin' | 'history' = 'comments';

  // Comments in Right Bar
  krComments: OkrComment[] = [];
  loadingKrComments = false;
  newKrComment = '';
  isAddingKrComment = false;
  isCommentEditorOpen = false;
  commentSortOrder: 'newest' | 'oldest' = 'newest';

  // Checkins in Right Bar
  krCheckins: any[] = [];
  loadingKrCheckins = false;
  newCheckinValue: number | null = null;
  newCheckinNote = '';
  isSubmittingCheckin = false;
  checkinSortOrder: 'newest' | 'oldest' = 'newest';

  // Audit History in Right Bar
  krHistory: any[] = [];
  loadingKrHistory = false;
  historyFilter: 'all' | 'checkin' | 'comment' | 'event' = 'all';
  historySortOrder: 'newest' | 'oldest' = 'newest';

  // Description Edit in Right Bar
  isEditingDescription = false;
  editingDescriptionValue = '';
  isSavingDescription = false;

  activeDropdownId: string | null = null;
  showFilter = false;
  selectedFilterLevel: string = 'All';
  selectedFilterDueDate: string = 'All';
  selectedFilterIndicator: string = 'All';
  private readonly now = new Date();
  private readonly curMonth = this.now.getMonth() + 1;
  private readonly curYear = this.now.getFullYear();

  timelines: Timeline[] = [];
  selectedTimeline = String(new Date().getFullYear());
  timelineOptions: string[] = ['2026', '2025', '2024'];
  isTimelineDropdownOpen = false;

  selectedTimelineTree = `Month ${new Date().getMonth() + 1}, ${new Date().getFullYear()}`;
  selectedTimelineId = `TL-M${new Date().getMonth() + 1}-${new Date().getFullYear()}`;
  selectedTimelineNodeTitle = `Month ${new Date().getMonth() + 1}`;
  collapsedNavNodes: { [key: string]: boolean } = {
    [`TL-Q1-${new Date().getFullYear()}`]: Math.ceil((new Date().getMonth() + 1) / 3) !== 1,
    [`TL-Q2-${new Date().getFullYear()}`]: Math.ceil((new Date().getMonth() + 1) / 3) !== 2,
    [`TL-Q3-${new Date().getFullYear()}`]: Math.ceil((new Date().getMonth() + 1) / 3) !== 3,
    [`TL-Q4-${new Date().getFullYear()}`]: Math.ceil((new Date().getMonth() + 1) / 3) !== 4
  };

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

  get timelineTreeNav(): any[] {
    const list = this.timelines.filter(t => t.workspace_id === this.selectedSpaceId || !t.workspace_id || this.timelines.length > 0);
    
    // Group into Year -> Quarters -> Months with chronological sorting
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

    // Fallback default structure matching image
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

  toggleNavNode(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.collapsedNavNodes[id] = !this.collapsedNavNodes[id];
  }

  isNavNodeCollapsed(id: string): boolean {
    return !!this.collapsedNavNodes[id];
  }

  isNavNodeSelected(title: string): boolean {
    if (!title) return false;
    if (this.selectedTimelineNodeTitle) {
      return this.selectedTimelineNodeTitle === title;
    }
    return !!(this.selectedTimelineTree && this.selectedTimelineTree.includes(title));
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
    this.loadTreeData();
  }

  navigateToManageTimeline(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.isTimelineTreeDropdownOpen = false;
    this.router.navigate(['/okr-settings'], { queryParams: { tab: 'Chu kỳ' } });
  }


  timelineTreeOptions: string[] = [
    'Month 10, 2026',
    'Month 11, 2026',
    'Month 12, 2026',
    'Quarter 4, 2026',
    'Month 8, 2026',
    'Month 9, 2026'
  ];
  isTimelineTreeDropdownOpen = false;

  spaces: Space[] = [];
  selectedSpaceId: string = '';
  selectedSpace: Space | null = null;
  isSpaceDropdownOpen = false;
  loading = true;
  treeData: TreeNode[] = [];
  rawTreeData: TreeNode[] = [];
  searchQuery = '';
  showKrModal = false;
  editingKrNode: TreeNode | null = null;
  editKrTitle = '';
  editKrExpected: number = 100;
  isSavingKr = false;
  isDropup = false;

  showCloneModal = false;
  cloningNode: TreeNode | null = null;
  isCloningKr = false;
  cloneAssignType: 'company' | 'team' | 'personal' = 'personal';
  selectedCloneAssigneeId = '';
  isCloneDropdownOpen = false;
  isCloning = false;
  employeesList: Employee[] = [];
  teamsList: Team[] = [];
  highlightedNodeId: string | null = null;

  constructor(
    private okrService: OkrService, 
    private router: Router,
    private route: ActivatedRoute,
    private confirmService: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.route.queryParams.subscribe(params => {
      const targetId = params['highlight'];
      const targetSpace = params['space_id'];
      const targetTl = params['timeline_id'];

      let needReload = false;
      if (targetSpace && targetSpace !== 'all' && targetSpace !== this.selectedSpaceId) {
        this.selectedSpaceId = targetSpace;
        needReload = true;
      }
      if (targetTl && targetTl !== 'all' && targetTl !== this.selectedTimelineId) {
        this.selectedTimelineId = targetTl;
        needReload = true;
      }

      if (targetId) {
        this.highlightedNodeId = targetId;
        if (!needReload && this.treeData && this.treeData.length > 0) {
          this.expandAncestorsOfNode(this.treeData, targetId);
          this.triggerNodeHighlight(targetId);
        }
      }

      if (needReload && !this.loading) {
        this.loadTreeData();
      }
    });

    this.loadTimelines();
    this.loadSpaces();
    this.loadEmployeesAndTeams();
  }

  expandAncestorsOfNode(nodes: TreeNode[], targetId: string): boolean {
    if (!nodes || !nodes.length) return false;
    for (const node of nodes) {
      if (node.id === targetId) {
        node.expanded = true;
        return true;
      }
      if (node.children && node.children.length > 0) {
        const found = this.expandAncestorsOfNode(node.children, targetId);
        if (found) {
          node.expanded = true;
          return true;
        }
      }
    }
    return false;
  }

  triggerNodeHighlight(targetId: string): void {
    const tryHighlight = (attemptsLeft: number) => {
      const el = document.getElementById('tree-node-' + targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.highlightedNodeId = targetId;
        setTimeout(() => {
          this.highlightedNodeId = null;
        }, 3000);
      } else if (attemptsLeft > 0) {
        setTimeout(() => tryHighlight(attemptsLeft - 1), 200);
      }
    };
    setTimeout(() => tryHighlight(3), 350);
  }

  loadEmployeesAndTeams(): void {
    this.okrService.getEmployees().subscribe({
      next: (data) => this.employeesList = data || [],
      error: (err) => console.error('Error loading employees for clone:', err)
    });
    this.okrService.getTeams().subscribe({
      next: (data) => this.teamsList = data || [],
      error: (err) => console.error('Error loading teams for clone:', err)
    });
  }

  formatAssignTo(assignTo: string): string {
    if (!assignTo) return '';
    return assignTo.replace(/\s*\([^)]*\)/g, '').trim();
  }

  loadTreeData(): void {
    this.loading = true;
    this.okrService.getOkrTree(this.selectedSpaceId, this.selectedTimelineId).subscribe({
      next: (data) => {
        this.rawTreeData = data || [];
        this.onSearch();
        this.loading = false;
        if (this.highlightedNodeId) {
          this.expandAncestorsOfNode(this.treeData, this.highlightedNodeId);
          this.triggerNodeHighlight(this.highlightedNodeId);
        }
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
          // Chỉ lấy các mốc thời gian cấp Năm (level === 'year' hoặc 4 chữ số năm)
          const yearNodes = this.timelines.filter(t => t.level === 'year' || (/^\d{4}$/).test(t.title?.trim()));
          const yearTitles = yearNodes.map(t => t.title.trim()).filter(Boolean);
          
          if (yearTitles.length > 0) {
            const uniqueYears = Array.from(new Set(yearTitles)).sort((a, b) => b.localeCompare(a));
            this.timelineOptions = uniqueYears;
            const currentYearStr = String(new Date().getFullYear());
            if (uniqueYears.includes(currentYearStr)) {
              this.selectedTimeline = currentYearStr;
            } else {
              this.selectedTimeline = uniqueYears[0];
            }
          } else {
            this.timelineOptions = ['2026', '2025', '2024'];
            this.selectedTimeline = '2026';
          }

          // Ưu tiên timeline_id từ query parameters (nếu có và hợp lệ trong danh sách timelines)
          const targetFromQuery = this.route.snapshot.queryParams['timeline_id'] || this.selectedTimelineId;
          const queryTl = targetFromQuery ? this.timelines.find(t => t.id === targetFromQuery) : null;
          const currentTl = queryTl || this.findCurrentMonthTimeline(this.timelines);
          if (currentTl) {
            const prevId = this.selectedTimelineId;
            this.selectedTimelineId = currentTl.id;
            const parentYear = this.getTimelineYear(currentTl, this.timelines);
            this.selectedTimelineTree = `${currentTl.title}, ${parentYear}`;
            this.selectedTimelineNodeTitle = currentTl.title;
            this.selectedTimeline = parentYear;

            // Tự động mở rộng Quarter chứa tháng hiện tại trong dropdown tree
            if (currentTl.parent_id) {
              this.collapsedNavNodes[currentTl.parent_id] = false;
            }

            // Nếu timeline id cập nhật khác giá trị mặc định, load lại dữ liệu cây
            if (prevId !== currentTl.id && this.selectedSpaceId) {
              this.loadTreeData();
            }
          } else if (this.timelines.length > 0) {
            this.selectedTimelineId = this.timelines[0].id;
            this.selectedTimelineTree = this.timelines[0].title;
            this.selectedTimelineNodeTitle = this.timelines[0].title;
          }
        } else {
          this.timelineOptions = ['2026', '2025', '2024'];
          this.selectedTimeline = '2026';
        }
      },
      error: (err) => {
        console.error('Error loading timelines:', err);
        this.timelineOptions = ['2026', '2025', '2024'];
        this.selectedTimeline = '2026';
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
    // Khi chọn Năm, lọc theo timeline cấp Năm tương ứng
    const yearTl = this.timelines.find(t => t.title === tl || t.id === `TL-YEAR-${tl}`);
    if (yearTl) {
      this.selectedTimelineId = yearTl.id;
      this.selectedTimelineTree = yearTl.title;
      this.selectedTimelineNodeTitle = yearTl.title;
    }
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
    const parts = tlt.split(',').map(p => p.trim());
    const primaryPart = parts[0];
    const found = this.timelines.find(t => t.title === primaryPart || t.title === tlt) || this.timelines.find(t => tlt.includes(t.title));
    if (found) {
      this.selectedTimelineId = found.id;
      this.selectedTimelineNodeTitle = found.title;
    }
    this.isTimelineTreeDropdownOpen = false;
    this.loadTreeData();
  }

  loadSpaces(): void {
    this.okrService.getSpaces().subscribe({
      next: (data) => {
        this.spaces = data || [];
        if (this.spaces.length > 0) {
          const defaultSpace = this.spaces.find(s => s.id === 'SPC-1793153879989') || this.spaces[0];
          if (!this.selectedSpaceId || !this.spaces.some(s => s.id === this.selectedSpaceId)) {
            this.selectedSpace = defaultSpace;
            this.selectedSpaceId = defaultSpace.id;
          }
        }
        this.loadTreeData();
      },
      error: (err) => {
        console.error('Error loading spaces:', err);
        this.loadTreeData();
      }
    });
  }

  selectAllSpaces(): void {
    this.selectedSpace = null;
    this.selectedSpaceId = 'all';
    this.isSpaceDropdownOpen = false;
    this.loadTreeData();
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
      if (!target.closest('.clone-dropdown-wrapper')) {
        this.isCloneDropdownOpen = false;
      }
    } else {
      this.showFilter = false;
      this.isSpaceDropdownOpen = false;
      this.isTimelineDropdownOpen = false;
      this.isTimelineTreeDropdownOpen = false;
      this.isCloneDropdownOpen = false;
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

  isKrNode(node: TreeNode): boolean {
    return node.type === 'team_kr' || node.type === 'ind_kr' || node.id.startsWith('KR-');
  }

  onNodeTitleClick(node: TreeNode, event: MouseEvent): void {
    event.stopPropagation();
    if (this.isKrNode(node)) {
      this.openKrRightBar(node);
    } else {
      this.router.navigate(['/objectives', node.id]);
    }
  }

  onNodeIdClick(node: TreeNode, event: MouseEvent): void {
    event.stopPropagation();
    if (this.isKrNode(node)) {
      const objId = node.objective_id || this.findParentObjectiveId(node) || node.id;
      this.router.navigate(['/objectives', objId], { queryParams: { kr: node.id } });
    } else {
      this.router.navigate(['/objectives', node.id]);
    }
  }

  onNodeTextClick(node: TreeNode, event: MouseEvent): void {
    event.stopPropagation();
    if (this.isKrNode(node)) {
      this.openKrRightBar(node);
    } else {
      this.router.navigate(['/objectives', node.id]);
    }
  }

  findParentObjectiveId(targetNode: TreeNode): string | null {
    if (targetNode.objective_id) return targetNode.objective_id;
    const findInNodes = (nodes: TreeNode[], currentObjId: string | null): string | null => {
      for (const n of nodes) {
        const objId = (n.type === 'company_obj' || n.type === 'team_obj') ? n.id : currentObjId;
        if (n.id === targetNode.id) return objId;
        if (n.children && n.children.length > 0) {
          const found = findInNodes(n.children, objId);
          if (found) return found;
        }
      }
      return null;
    };
    return findInNodes(this.treeData, null);
  }

  openKrRightBar(node: TreeNode): void {
    this.selectedKrNode = node;
    this.showRightBar = true;
    this.activeTab1 = 'general';
    this.activeTab2 = 'comments';
    this.newCheckinValue = parseFloat(node.resultC) || 0;
    this.newCheckinNote = '';
    this.newKrComment = '';
    this.isCommentEditorOpen = false;
    this.commentSortOrder = 'newest';
    this.historyFilter = 'all';
    this.historySortOrder = 'newest';
    this.isEditingDescription = false;
    this.editingDescriptionValue = '';

    this.loadKrFullDetail(node.id);
    this.loadKrComments(node.id);
    this.loadKrCheckins(node.id);
    this.loadKrHistory(node.id);
  }

  closeKrRightBar(): void {
    this.showRightBar = false;
  }

  onBreadcrumbClick(item: any): void {
    if (!item?.id) return;
    if (item.id.startsWith('KR-')) {
      const foundKr = this.findNodeById(item.id);
      if (foundKr) {
        this.openKrRightBar(foundKr);
      } else {
        this.loadKrFullDetail(item.id);
        this.loadKrComments(item.id);
        this.loadKrCheckins(item.id);
        this.loadKrHistory(item.id);
      }
    } else {
      this.router.navigate(['/objectives', item.id]);
    }
  }

  findNodeById(id: string): TreeNode | null {
    const search = (nodes: TreeNode[]): TreeNode | null => {
      for (const n of nodes) {
        if (n.id === id) return n;
        if (n.children && n.children.length > 0) {
          const found = search(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    return search(this.treeData);
  }

  goToFullDetailFromDrawer(): void {
    if (!this.selectedKrNode) return;
    const objId = this.selectedKrNode.objective_id || this.findParentObjectiveId(this.selectedKrNode) || this.selectedKrNode.id;
    this.router.navigate(['/objectives', objId], { queryParams: { kr: this.selectedKrNode.id } });
  }

  loadKrFullDetail(krId: string): void {
    this.loadingKrDetail = true;
    this.okrService.getKeyResultById(krId).subscribe({
      next: (data) => {
        this.selectedKrDetail = data || {};
        this.loadingKrDetail = false;
      },
      error: (err) => {
        console.error('Error loading KR details:', err);
        this.loadingKrDetail = false;
      }
    });
  }

  loadKrComments(krId: string): void {
    this.loadingKrComments = true;
    this.okrService.getComments({ kr_id: krId }).subscribe({
      next: (data) => {
        this.krComments = data || [];
        this.loadingKrComments = false;
      },
      error: (err) => {
        console.error('Error loading comments:', err);
        this.loadingKrComments = false;
      }
    });
  }

  get currentDescriptionText(): string {
    return this.selectedKrDetail?.description || this.selectedKrNode?.description || '';
  }

  startEditDescription(): void {
    this.editingDescriptionValue = this.currentDescriptionText;
    this.isEditingDescription = true;
  }

  cancelEditDescription(): void {
    this.isEditingDescription = false;
  }

  saveDescription(): void {
    if (!this.selectedKrNode) return;
    this.isSavingDescription = true;
    const newDesc = this.editingDescriptionValue.trim();
    this.okrService.updateKeyResult(this.selectedKrNode.id, {
      description: newDesc
    }).subscribe({
      next: () => {
        this.isSavingDescription = false;
        this.isEditingDescription = false;
        if (this.selectedKrDetail) {
          this.selectedKrDetail.description = newDesc;
        }
        if (this.selectedKrNode) {
          this.selectedKrNode.description = newDesc;
        }
        if (this.selectedKrNode) {
          this.loadKrHistory(this.selectedKrNode.id);
        }
      },
      error: (err) => {
        this.isSavingDescription = false;
        console.error('Error updating description:', err);
        alert('Lỗi cập nhật mô tả: ' + (err.error?.error || err.message));
      }
    });
  }

  get commentCharCount(): number {
    return (this.newKrComment || '').length;
  }

  get commentWordCount(): number {
    const trimmed = (this.newKrComment || '').trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }

  get sortedKrComments(): OkrComment[] {
    if (!this.krComments) return [];
    return [...this.krComments].sort((a, b) => {
      const timeA = new Date(a.created_at || a.time || 0).getTime();
      const timeB = new Date(b.created_at || b.time || 0).getTime();
      return this.commentSortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }

  toggleCommentSort(): void {
    this.commentSortOrder = this.commentSortOrder === 'newest' ? 'oldest' : 'newest';
  }

  get sortedKrHistory(): any[] {
    if (!this.krHistory) return [];
    return [...this.krHistory].sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return this.historySortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }

  get filteredKrHistory(): any[] {
    if (!this.krHistory) return [];
    let list = this.krHistory;
    if (this.historyFilter !== 'all') {
      list = list.filter(item => item.type === this.historyFilter);
    }
    return [...list].sort((a, b) => {
      const timeA = new Date(a.created_at || a.event_time || 0).getTime();
      const timeB = new Date(b.created_at || b.event_time || 0).getTime();
      return this.historySortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }

  toggleHistorySort(): void {
    this.historySortOrder = this.historySortOrder === 'newest' ? 'oldest' : 'newest';
  }

  insertFormat(prefix: string, suffix: string = ''): void {
    this.newKrComment = (this.newKrComment || '') + prefix + suffix;
  }

  formatCommentDate(dateStr?: string): string {
    if (!dateStr) return 'Vừa xong';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const day = String(d.getDate()).padStart(2, '0');
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const formattedHours = String(hours).padStart(2, '0');
      return `${month} ${day}, ${year} ${formattedHours}:${minutes} ${ampm}`;
    } catch {
      return dateStr;
    }
  }

  addKrComment(): void {
    if (!this.newKrComment.trim() || !this.selectedKrNode) return;
    this.isAddingKrComment = true;
    const payload: Partial<OkrComment> = {
      kr_id: this.selectedKrNode.id,
      objective_id: this.selectedKrNode.objective_id,
      content: this.newKrComment.trim(),
      author: 'Huyền Nguyễn Như',
      author_avatar: 'https://ui-avatars.com/api/?name=Huyen+Nguyen&background=3157D5&color=fff&rounded=true',
      source: 'web_user'
    };

    this.okrService.addComment(payload).subscribe({
      next: () => {
        this.newKrComment = '';
        this.isAddingKrComment = false;
        this.isCommentEditorOpen = false;
        if (this.selectedKrNode) {
          this.loadKrComments(this.selectedKrNode.id);
          this.loadKrHistory(this.selectedKrNode.id);
        }
      },
      error: (err) => {
        console.error('Error adding comment:', err);
        this.isAddingKrComment = false;
      }
    });
  }

  deleteKrComment(commentId: number | string | undefined): void {
    if (!commentId) return;
    this.okrService.deleteComment(commentId).subscribe({
      next: () => {
        this.krComments = this.krComments.filter(c => c.comment_id !== commentId);
      },
      error: (err) => console.error('Error deleting comment:', err)
    });
  }

  loadKrCheckins(krId: string): void {
    this.loadingKrCheckins = true;
    this.okrService.getKrCheckins(krId).subscribe({
      next: (data) => {
        this.krCheckins = data || [];
        this.loadingKrCheckins = false;
      },
      error: (err) => {
        console.error('Error loading checkins:', err);
        this.loadingKrCheckins = false;
      }
    });
  }

  get sortedKrCheckins(): any[] {
    if (!this.krCheckins) return [];
    return [...this.krCheckins].sort((a, b) => {
      const timeA = new Date(a.calculated_at || 0).getTime();
      const timeB = new Date(b.calculated_at || 0).getTime();
      return this.checkinSortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }

  toggleCheckinSort(): void {
    this.checkinSortOrder = this.checkinSortOrder === 'newest' ? 'oldest' : 'newest';
  }

  isBotAuthor(author?: string, source?: string): boolean {
    if (source === 'activepieces') return true;
    if (!author) return false;
    const a = author.toLowerCase();
    return a === 'bot' || a.includes('bot') || a.includes('syrix') || a.includes('activepieces');
  }

  isSyrixAuthor(author?: string): boolean {
    return this.isBotAuthor(author);
  }

  formatAuthorName(author?: string, source?: string): string {
    if (source === 'activepieces') return 'bot';
    if (!author) return 'bot';
    const a = author.toLowerCase();
    if (a === 'bot' || a.includes('bot') || a.includes('syrix') || a.includes('activepieces')) {
      return 'bot';
    }
    return author;
  }

  getAvatarUrl(author?: string): string {
    if (!author) return 'https://ui-avatars.com/api/?name=User&background=3157D5&color=fff&rounded=true';
    if (author.includes('Y Nguyen')) return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&h=64&fit=crop&crop=faces';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(author)}&background=3157D5&color=fff&rounded=true`;
  }

  formatRelativeTime(dateStr?: string): string {
    if (!dateStr) return 'Just now';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      if (diffMs < 0) return 'Just now';
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);
      const diffMonth = Math.floor(diffDay / 30);
      const diffYear = Math.floor(diffDay / 365);

      if (diffYear > 0) return `${diffYear} ${diffYear === 1 ? 'year' : 'years'} ago`;
      if (diffMonth > 0) return `${diffMonth} ${diffMonth === 1 ? 'month' : 'months'} ago`;
      if (diffDay > 0) return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
      if (diffHour > 0) return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
      if (diffMin > 0) return `${diffMin} ${diffMin === 1 ? 'min' : 'mins'} ago`;
      return 'Just now';
    } catch {
      return dateStr;
    }
  }

  submitCheckin(): void {
    if (this.newCheckinValue === null || isNaN(this.newCheckinValue) || !this.selectedKrNode) return;
    this.isSubmittingCheckin = true;
    const noteText = this.newCheckinNote.trim();
    const payload = {
      current_value: Number(this.newCheckinValue),
      reason: noteText || `Check-in: C = ${this.newCheckinValue}`,
      note: noteText || null,
      author: 'Huyền Nguyễn Như'
    };

    this.okrService.updateKrCurrentValue(this.selectedKrNode.id, payload).subscribe({
      next: () => {
        this.isSubmittingCheckin = false;
        if (this.selectedKrNode) {
          this.selectedKrNode.resultC = String(this.newCheckinValue);
          this.loadKrCheckins(this.selectedKrNode.id);
          this.loadKrComments(this.selectedKrNode.id);
          this.loadKrHistory(this.selectedKrNode.id);
          this.loadKrFullDetail(this.selectedKrNode.id);
        }
        this.loadTreeData();
        this.newCheckinNote = '';
      },
      error: (err) => {
        this.isSubmittingCheckin = false;
        console.error('Error submitting checkin:', err);
        alert('Lỗi cập nhật check-in: ' + (err.error?.error || err.message));
      }
    });
  }

  // Phương thức Truy vết lần chạy Flow từ bản ghi Check-in sang Flow Runs
  traceFlowRun(ck: any): void {
    const krId = this.selectedKrNode?.id || ck?.kr_id || '';
    const flowCode = ck?.flow_code || this.getFlowCodeForKr(krId);
    const runId = ck?.run_id || '';

    // Lấy tên thành viên nếu là Personal KR hoặc có phân công
    let memberName = '';
    if (this.selectedKrNode) {
      if (this.selectedKrNode.title && this.selectedKrNode.title.includes(' - ')) {
        const parts = this.selectedKrNode.title.split(' - ');
        memberName = parts[parts.length - 1].trim();
      } else if (this.selectedKrNode.assignTo && this.selectedKrNode.assignTo !== 'Team dev') {
        memberName = this.selectedKrNode.assignTo;
      }
    }
    if (!memberName && ck?.author && ck?.author !== 'bot') {
      memberName = ck.author;
    }

    // Lấy ngày chạy từ calculated_at
    let dateStr = '';
    if (ck?.calculated_at) {
      dateStr = ck.calculated_at.substring(0, 10);
    }

    const queryParams: any = {
      flow: flowCode
    };
    if (runId) {
      queryParams.runId = runId;
      queryParams.search = runId;
    } else if (memberName) {
      queryParams.member = memberName;
      queryParams.search = memberName;
    }
    if (memberName) {
      queryParams.author = memberName;
    }
    if (dateStr) {
      queryParams.date = dateStr;
    }

    // Mở trang Flow Runs vào đúng flow và lọc đúng lần chạy của thành viên
    this.router.navigate(['/flow-runs', flowCode], { queryParams });
  }

  getFlowCodeForKr(krId?: string): string {
    if (!krId) return 'FLOW-KR-A1';
    const upper = krId.toUpperCase();
    if (upper.includes('KR-A1') || upper.includes('M11-A1') || upper.includes('M12-A1')) return 'FLOW-KR-A1';
    if (upper.includes('KR-B1') || upper.includes('M11-B1') || upper.includes('M12-B1')) return 'FLOW-KR-B1';
    if (upper.includes('KR-C1') || upper.includes('M11-C1') || upper.includes('M12-C1')) return 'FLOW-KR-C1';
    return 'FLOW-KR-A1';
  }

  loadKrHistory(krId: string): void {
    this.loadingKrHistory = true;
    this.okrService.getKrHistory(krId).subscribe({
      next: (data) => {
        this.krHistory = data || [];
        this.loadingKrHistory = false;
      },
      error: (err) => {
        console.error('Error loading history:', err);
        this.loadingKrHistory = false;
      }
    });
  }

  formatTime(dateStr?: string): string {
    if (!dateStr) return 'Vừa xong';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return dateStr;
    }
  }

  editNode(node: TreeNode): void {
    const isKr = this.isKrNode(node);
    if (isKr) {
      this.openKrRightBar(node);
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

  cloneNode(node: TreeNode): void {
    this.cloningNode = node;
    this.isCloningKr = node.type === 'team_kr' || node.type === 'ind_kr' || node.id.startsWith('KR-');

    if (node.type === 'company_obj') {
      this.cloneAssignType = 'company';
      this.selectedCloneAssigneeId = '';
    } else if (node.type === 'team_obj' || node.type === 'team_kr') {
      this.cloneAssignType = 'team';
      const currentName = this.formatAssignTo(node.assignTo || '').toLowerCase();
      const foundTeam = this.teamsList.find(t => 
        (t.name && t.name.toLowerCase().includes(currentName)) || 
        (t.code && currentName.includes(t.code.toLowerCase())) ||
        (t.id && currentName.includes(t.id.toLowerCase()))
      );
      this.selectedCloneAssigneeId = foundTeam ? (foundTeam.id || foundTeam.code) : (this.teamsList.length > 0 ? (this.teamsList[0].id || this.teamsList[0].code) : '');
    } else {
      this.cloneAssignType = 'personal';
      const currentName = this.formatAssignTo(node.assignTo || '').toLowerCase();
      const foundEmp = this.employeesList.find(e => 
        (e.full_name && e.full_name.toLowerCase().includes(currentName)) ||
        (e.full_name && currentName.includes(e.full_name.toLowerCase()))
      );
      this.selectedCloneAssigneeId = foundEmp ? foundEmp.employee_id : (this.employeesList.length > 0 ? this.employeesList[0].employee_id : '');
    }

    this.isCloneDropdownOpen = false;
    this.showCloneModal = true;
  }

  closeCloneModal(): void {
    if (this.isCloning) return;
    this.showCloneModal = false;
    this.cloningNode = null;
    this.isCloneDropdownOpen = false;
  }

  selectCloneTeam(team: Team): void {
    this.selectedCloneAssigneeId = team.id || team.code;
    this.isCloneDropdownOpen = false;
  }

  selectCloneEmployee(emp: Employee): void {
    this.selectedCloneAssigneeId = emp.employee_id;
    this.isCloneDropdownOpen = false;
  }

  getCloneSelectedTeamLabel(): string {
    const found = this.teamsList.find(t => (t.id || t.code) === this.selectedCloneAssigneeId);
    return found ? found.name : 'Chọn phòng ban / nhóm';
  }

  getCloneSelectedEmployeeLabel(): string {
    const found = this.employeesList.find(e => e.employee_id === this.selectedCloneAssigneeId);
    return found ? found.full_name : 'Chọn người phụ trách';
  }

  submitClone(): void {
    if (!this.cloningNode) return;
    this.isCloning = true;
    const payload = this.cloneAssignType === 'company' 
      ? { assignee_id: '' }
      : { assignee_id: this.selectedCloneAssigneeId };

    this.okrService.cloneObjective(this.cloningNode.id, payload).subscribe({
      next: () => {
        this.isCloning = false;
        this.showCloneModal = false;
        this.cloningNode = null;
        this.loadTreeData();
      },
      error: (err) => {
        this.isCloning = false;
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
      message: `Bạn có chắc chắn muốn xóa ${typeLabel} <strong>"${node.title}"</strong> (${node.id}) khỏi cơ sở dữ liệu không? Thao tác này sẽ xóa vĩnh viễn và không thể khôi phục.`,
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
        this.confirmService.confirm({
          title: `Lỗi khi xóa ${typeLabel}`,
          message: err.error?.error || err.message || `Không thể xóa ${typeLabel} này.`,
          confirmText: 'Đóng',
          cancelText: '',
          type: 'danger'
        });
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

