import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OkrService, MeasurementRule, Space, Timeline, Metric, SpaceMember, MetricConversion, Template, Team, Role } from '../../services/okr.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

import { ObjectivesListComponent } from '../objectives-list/objectives-list.component';

export interface VisibleTimelineRow {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  period: string;
  workspace_id: string;
  timeline_category: string;
  parent_id?: string | null;
  level?: string;
  depth: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  icon: string;
}

@Component({
  selector: 'app-okr-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ObjectivesListComponent],
  templateUrl: './okr-settings.component.html',
  styleUrls: ['./okr-settings.component.css']
})
export class OkrSettingsComponent implements OnInit {
  tabs = [
    'Spaces', 'Timelines', 'Members', 'Objectives'
  ];
  activeTab = 'Spaces';

  // Data arrays
  spaces: Space[] = [];
  timelines: Timeline[] = [];
  metrics: Metric[] = [];
  spaceMembers: SpaceMember[] = [];
  conversions: MetricConversion[] = [];
  progressTemplates: Template[] = [];
  aggregationTemplates: Template[] = [];
  rules: MeasurementRule[] = [];
  employees: any[] = [];
  teams: Team[] = [];
  roles: Role[] = [];

  // Dropdown states for Add Member Modal
  isMemberSpaceDropdownOpen = false;
  isMemberEmpDropdownOpen = false;
  isMemberTeamDropdownOpen = false;
  isMemberRoleDropdownOpen = false;

  // Action Dropdown state
  activeDropdownId: string | null = null;

  // Modals state
  showSpaceModal = false;
  isEditingSpace = false;
  showTimelineModal = false;
  isEditingTimeline = false;
  showMetricModal = false;
  isEditingMetric = false;
  showMemberModal = false;
  showConversionModal = false;
  showTemplateModal = false;
  isEditingTemplate = false;
  showRuleModal = false;

  // New / Edit Items
  newSpace: Partial<Space> = {};
  isSavingSpace = false;
  newTimeline: Partial<Timeline> = {};
  isSavingTimeline = false;
  // --- TIMELINE TREE & CREATE TIMELINE ENHANCED STATE ---
  selectedTimelineSpaceId: string = '';
  isTimelineSpaceFilterDropdownOpen: boolean = false;
  isAllTimelinesCollapsed: boolean = false;
  timelineModalMode: 'tree' | 'single' = 'tree';
  selectedTimelineFilterYear: string = 'all';
  treeTimelineHierarchy: string[] = ['Quarterly', 'Monthly'];
  isTreeTimelineDropdownOpen: boolean = false;
  isCreateTimelineSpaceDropdownOpen: boolean = false;
  isEditTimelineSpaceDropdownOpen: boolean = false;
  isEditTimelineLevelDropdownOpen: boolean = false;
  isEditTimelineParentDropdownOpen: boolean = false;
  previewTimelineCollapsed: boolean = false;
  multipleYearsTimeline: boolean = false;
  selectedTimelineYear: number = 2026;
  timelineYearsList: number[] = [2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032];
  previewTimelineItems: any[] = [];
  collapsedTimelineNodes: { [key: string]: boolean } = {};
  newMetric: Partial<Metric> = {};
  isSavingMetric = false;
  newMember: Partial<SpaceMember> = {};
  isSavingMember = false;
  newConversion: Partial<MetricConversion> = {};
  isSavingConversion = false;
  newTemplate: Partial<Template> = {};
  isSavingTemplate = false;
  newRule: Partial<MeasurementRule> = {};

  // Dropdown states
  showSpaceDropdown = false;
  spaceSearchText = '';
  showEmployeeDropdown = false;
  employeeSearchText = '';

  // Space filter for Member tab
  selectedMemberSpaceId: string = 'all';
  isSpaceFilterDropdownOpen: boolean = false;

  loading = true;
  isDropup = false;

  constructor(private okrService: OkrService, private confirmService: ConfirmDialogService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const tabParam = params.get('tab');
      if (tabParam) {
        const found = this.tabs.find(t => t.toLowerCase() === tabParam.toLowerCase());
        if (found) {
          this.activeTab = found;
        }
      }
    });
    this.loading = true;
    this.loadAllData();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.activeDropdownId = null;
    this.isSpaceFilterDropdownOpen = false;
    this.isMemberSpaceDropdownOpen = false;
    this.isMemberEmpDropdownOpen = false;
    this.isMemberTeamDropdownOpen = false;
    this.isMemberRoleDropdownOpen = false;
    this.isTreeTimelineDropdownOpen = false;
    this.isCreateTimelineSpaceDropdownOpen = false;
    this.isEditTimelineSpaceDropdownOpen = false;
    this.isEditTimelineLevelDropdownOpen = false;
    this.isEditTimelineParentDropdownOpen = false;
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

  loadAllData(): void {
    this.loading = true;
    forkJoin({
      spaces: this.okrService.getSpaces().pipe(catchError(() => of([]))),
      timelines: this.okrService.getTimelines().pipe(catchError(() => of([]))),
      metrics: this.okrService.getMetrics().pipe(catchError(() => of([]))),
      spaceMembers: this.okrService.getSpaceMembers().pipe(catchError(() => of([]))),
      conversions: this.okrService.getConversions().pipe(catchError(() => of([]))),
      progressTemplates: this.okrService.getTemplates('PROGRESS').pipe(catchError(() => of([]))),
      aggregationTemplates: this.okrService.getTemplates('AGGREGATION').pipe(catchError(() => of([]))),
      rules: this.okrService.getRules().pipe(catchError(() => of([]))),
      employees: this.okrService.getEmployees().pipe(catchError(() => of([]))),
      teams: this.okrService.getTeams().pipe(catchError(() => of([]))),
      roles: this.okrService.getRoles().pipe(catchError(() => of([])))
    }).subscribe({
      next: (res) => {
        this.spaces = res.spaces || [];
        if ((!this.selectedTimelineSpaceId || this.selectedTimelineSpaceId === 'all' || !this.spaces.some(s => s.id === this.selectedTimelineSpaceId)) && this.spaces.length > 0) {
          this.selectedTimelineSpaceId = this.spaces[0].id;
        }
        if ((!this.selectedMemberSpaceId || this.selectedMemberSpaceId === 'all') && this.spaces.length > 0) {
          this.selectedMemberSpaceId = this.spaces[0].id;
        }
        this.timelines = res.timelines || [];
        this.metrics = res.metrics || [];
        this.spaceMembers = res.spaceMembers || [];
        this.conversions = res.conversions || [];
        this.progressTemplates = res.progressTemplates || [];
        this.aggregationTemplates = res.aggregationTemplates || [];
        this.rules = res.rules || [];
        this.employees = res.employees || [];
        this.teams = res.teams || [];
        this.roles = res.roles || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  switchTab(tab: string) {
    this.activeTab = tab;
    this.activeDropdownId = null;
    this.isSpaceFilterDropdownOpen = false;
  }

  // --- SPACE FILTER FOR MEMBER TAB ---
  toggleSpaceFilterDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isSpaceFilterDropdownOpen = !this.isSpaceFilterDropdownOpen;
  }

  selectMemberSpace(spaceId: string): void {
    this.selectedMemberSpaceId = spaceId;
    this.isSpaceFilterDropdownOpen = false;
  }

  getSelectedSpaceFilterLabel(): string {
    if (!this.selectedMemberSpaceId || this.selectedMemberSpaceId === "all") {
      if (this.spaces && this.spaces.length > 0) {
        return this.spaces[0].name;
      }
      return "Chọn Không gian";
    }
    const found = this.spaces.find(s => s.id === this.selectedMemberSpaceId);
    return found ? found.name : this.selectedMemberSpaceId;
  }

  get filteredSpaceMembers(): SpaceMember[] {
    if (!this.selectedMemberSpaceId || this.selectedMemberSpaceId === 'all') {
      return this.spaceMembers;
    }
    return this.spaceMembers.filter(m => m.space_id === this.selectedMemberSpaceId);
  }

  getSpaceName(spaceId: string): string {
    const s = this.spaces.find(sp => sp.id === spaceId);
    return s ? s.name : (spaceId || '—');
  }

  openCreateMemberModal(): void {
    const defaultSpace = (this.selectedMemberSpaceId && this.selectedMemberSpaceId !== 'all')
      ? this.selectedMemberSpaceId
      : ((this.spaces && this.spaces.length > 0) ? this.spaces[0].id : '');
    this.newMember = {
      space_id: defaultSpace,
      user_name: '',
      email: '',
      role: '',
      team_name: ''
    };
    this.isMemberSpaceDropdownOpen = false;
    this.isMemberEmpDropdownOpen = false;
    this.isMemberTeamDropdownOpen = false;
    this.isMemberRoleDropdownOpen = false;

    if (!this.teams || this.teams.length === 0) {
      this.okrService.getTeams().subscribe(t => this.teams = t || []);
    }
    if (!this.roles || this.roles.length === 0) {
      this.okrService.getRoles().subscribe(r => this.roles = r || []);
    }
    if (!this.employees || this.employees.length === 0) {
      this.okrService.getEmployees().subscribe(e => this.employees = e || []);
    }

    this.showMemberModal = true;
  }

  getMemberModalSpaceName(): string {
    if (!this.newMember.space_id) return 'Chọn Không gian...';
    const found = this.spaces.find(s => s.id === this.newMember.space_id);
    return found ? found.name : this.newMember.space_id;
  }

  selectMemberModalSpace(space: Space): void {
    this.newMember.space_id = space.id;
    this.isMemberSpaceDropdownOpen = false;
  }

  selectMemberModalEmployee(emp: any): void {
    this.newMember.user_name = emp.full_name;
    this.newMember.email = emp.gitlab_user_id 
      ? (emp.gitlab_user_id.includes('@') ? emp.gitlab_user_id : `${emp.gitlab_user_id}@company.com`)
      : `${emp.full_name.toLowerCase().replace(/\s+/g, '')}@company.com`;

    // 1. Tự động xác định Team từ nhân sự
    if (emp.team_id) {
      const tid = (emp.team_id || '').toLowerCase().trim();
      const tidAlnum = tid.replace(/[^a-z0-9]/g, '');
      const foundTeam = this.teams.find(t => {
        const tId = (t.id || '').toLowerCase().trim();
        const tCode = (t.code || '').toLowerCase().trim();
        const tName = (t.name || '').toLowerCase().trim();
        const tIdAlnum = tId.replace(/[^a-z0-9]/g, '');
        const tCodeAlnum = tCode.replace(/[^a-z0-9]/g, '');
        const tNameAlnum = tName.replace(/[^a-z0-9]/g, '');
        return tId === tid || tCode === tid || tName === tid ||
               (tidAlnum && (tIdAlnum.includes(tidAlnum) || tidAlnum.includes(tIdAlnum) ||
                             tCodeAlnum.includes(tidAlnum) || tidAlnum.includes(tCodeAlnum) ||
                             tNameAlnum.includes(tidAlnum) || tidAlnum.includes(tNameAlnum)));
      });
      if (foundTeam) {
        this.newMember.team_name = foundTeam.name;
      } else {
        this.newMember.team_name = emp.team_id;
      }
    } else {
      this.newMember.team_name = 'Chưa phân nhóm';
    }

    // 2. Tự động xác định Role từ nhân sự
    const rawRole = emp.display_code || emp.role || '';
    const upperRole = rawRole.toUpperCase().trim();
    if (upperRole) {
      const foundRole = this.roles.find(r => {
        const rCode = (r.code || '').toUpperCase().trim();
        const rName = (r.name || '').toUpperCase().trim();
        return (rCode && upperRole === rCode) || 
               (rName && upperRole === rName) ||
               (rCode && upperRole.includes(rCode)) ||
               (rName && upperRole.includes(rName));
      });
      if (foundRole) {
        this.newMember.role = foundRole.name;
      } else if (upperRole.startsWith('DEV')) {
        const r = this.roles.find(r => (r.code || '').toUpperCase() === 'DEV');
        this.newMember.role = r ? r.name : 'Developer';
      } else if (upperRole.startsWith('QA') || upperRole.startsWith('TEST')) {
        const r = this.roles.find(r => (r.code || '').toUpperCase() === 'QA');
        this.newMember.role = r ? r.name : 'Tester';
      } else if (upperRole.startsWith('LEAD')) {
        const r = this.roles.find(r => (r.code || '').toUpperCase() === 'LEAD');
        this.newMember.role = r ? r.name : 'Tech Lead';
      } else {
        this.newMember.role = rawRole;
      }
    } else {
      this.newMember.role = 'Member';
    }

    this.isMemberEmpDropdownOpen = false;
  }

  selectMemberModalTeam(team: Team): void {
    this.newMember.team_name = team.name;
    this.isMemberTeamDropdownOpen = false;
  }

  selectMemberModalRole(role: Role): void {
    this.newMember.role = role.name;
    this.isMemberRoleDropdownOpen = false;
  }

  getTabIcon(tab: string): string {
    const t = (tab || '').trim().toLowerCase();
    switch (t) {
      case 'spaces':
      case 'không gian': 
        return 'fa-solid fa-layer-group';
      case 'timelines':
      case 'chu kỳ': 
        return 'fa-solid fa-calendar-days';
      case 'members':
      case 'thành viên': 
        return 'fa-solid fa-users';
      case 'objectives':
      case 'mục tiêu': 
        return 'fa-solid fa-bullseye';
      default: 
        return 'fa-solid fa-layer-group';
    }
  }

  // --- SPACE MODAL & CRUD ---
  openCreateSpaceModal() {
    this.newSpace = {};
    this.isEditingSpace = false;
    this.isSavingSpace = false;
    this.showSpaceModal = true;
  }

  editSpace(space: Space) {
    this.newSpace = { ...space };
    this.isEditingSpace = true;
    this.isSavingSpace = false;
    this.showSpaceModal = true;
  }

  async deleteSpace(space: Space): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận xóa Không gian',
      message: `Bạn có chắc chắn muốn xóa Không gian "${space.name}" (${space.space_key}) không? Thao tác này cũng sẽ xóa các Chu kỳ và Thành viên liên kết thuộc Không gian này.`,
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.okrService.deleteSpace(space.id).subscribe({
      next: () => {
        this.spaces = this.spaces.filter(s => s.id !== space.id);
        this.timelines = this.timelines.filter(t => t.workspace_id !== space.id);
        this.spaceMembers = this.spaceMembers.filter(m => m.space_id !== space.id);
        if (this.selectedTimelineSpaceId === space.id) {
          this.selectedTimelineSpaceId = this.spaces.length > 0 ? this.spaces[0].id : '';
        }
        if (this.selectedMemberSpaceId === space.id) {
          this.selectedMemberSpaceId = 'all';
        }
      },
      error: (err) => {
        this.confirmService.confirm({
          title: 'Lỗi khi xóa Không gian',
          message: err.error?.error || err.message || 'Xóa không gian thất bại.',
          confirmText: 'Đóng',
          cancelText: '',
          type: 'danger'
        });
      }
    });
  }

  closeSpaceModal() {
    if (this.isSavingSpace) return;
    this.showSpaceModal = false;
  }

  saveSpace() {
    if (this.isSavingSpace) return;
    if (!this.newSpace.name || !this.newSpace.space_key) {
      return;
    }
    this.isSavingSpace = true;
    if (this.isEditingSpace && this.newSpace.id) {
      this.okrService.updateSpace(this.newSpace.id, this.newSpace).subscribe({
        next: () => {
          this.showSpaceModal = false;
          this.newSpace = {};
          this.isSavingSpace = false;
          this.isEditingSpace = false;
          this.okrService.getSpaces().subscribe(d => this.spaces = d);
        },
        error: (err) => {
          this.isSavingSpace = false;
          alert('Cập nhật không gian thất bại: ' + (err.error?.error || err.message));
        }
      });
    } else {
      this.okrService.createSpace(this.newSpace).subscribe({
        next: () => {
          this.showSpaceModal = false;
          this.newSpace = {};
          this.isSavingSpace = false;
          this.okrService.getSpaces().subscribe(d => this.spaces = d);
        },
        error: (err) => {
          this.isSavingSpace = false;
          alert('Lưu không gian thất bại: ' + (err.error?.error || err.message));
        }
      });
    }
  }

  // --- TIMELINE MODAL & TREE VISUALIZATION ---
  toggleTimelineSpaceFilterDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isTimelineSpaceFilterDropdownOpen = !this.isTimelineSpaceFilterDropdownOpen;
  }

  selectTimelineSpace(spaceId: string): void {
    this.selectedTimelineSpaceId = spaceId;
    this.isTimelineSpaceFilterDropdownOpen = false;
  }

  getSelectedTimelineSpaceFilterLabel(): string {
    const found = this.spaces.find(s => s.id === this.selectedTimelineSpaceId);
    if (found) return found.name;
    return (this.spaces.length > 0) ? this.spaces[0].name : 'Chọn không gian';
  }

  toggleNodeCollapse(nodeId: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.collapsedTimelineNodes[nodeId] = !this.collapsedTimelineNodes[nodeId];
  }

  isNodeCollapsed(nodeId: string): boolean {
    return !!this.collapsedTimelineNodes[nodeId];
  }

  toggleExpandCollapseAll(): void {
    this.isAllTimelinesCollapsed = !this.isAllTimelinesCollapsed;
    if (this.isAllTimelinesCollapsed) {
      const collapsed: { [key: string]: boolean } = {};
      const parents = this.timelines.filter(t => this.timelines.some(c => c.parent_id === t.id));
      parents.forEach(p => {
        collapsed[p.id] = true;
      });
      this.collapsedTimelineNodes = collapsed;
    } else {
      this.collapsedTimelineNodes = {};
    }
  }

  get visibleTimelineRows(): VisibleTimelineRow[] {
    let list = this.timelines || [];
    const activeSpaceId = this.selectedTimelineSpaceId || (this.spaces.length > 0 ? this.spaces[0].id : null);
    if (activeSpaceId) {
      list = list.filter(t => t.workspace_id === activeSpaceId);
    }
    if (!list || list.length === 0) return [];

    // Map all nodes
    const nodeMap = new Map<string, any>();
    list.forEach(t => {
      nodeMap.set(t.id, {
        ...t,
        period: (t.start_date && t.end_date) 
          ? `${t.start_date} - ${t.end_date}` 
          : (t.start_date || t.end_date || 'Chưa thiết lập'),
        children: []
      });
    });

    // Build hierarchy
    const roots: any[] = [];
    nodeMap.forEach(node => {
      if (node.parent_id && nodeMap.has(node.parent_id)) {
        nodeMap.get(node.parent_id).children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sorting function for chronological tree display
    const parseItemOrder = (title: string, startDate?: string) => {
      const mMatch = (title || '').match(/Month\s*(\d+)/i);
      if (mMatch) return parseInt(mMatch[1], 10);
      const qMatch = (title || '').match(/Quarter\s*(\d+)/i);
      if (qMatch) return parseInt(qMatch[1], 10) * 100;
      if (startDate) {
        const parsed = Date.parse(startDate);
        if (!isNaN(parsed)) return parsed;
      }
      return 0;
    };

    const sortNodes = (arr: any[]) => {
      arr.sort((a, b) => {
        const orderA = parseItemOrder(a.title, a.start_date);
        const orderB = parseItemOrder(b.title, b.start_date);
        if (orderA !== orderB) return orderA - orderB;
        return (a.title || '').localeCompare(b.title || '');
      });
      arr.forEach(item => {
        if (item.children && item.children.length > 0) {
          sortNodes(item.children);
        }
      });
    };
    sortNodes(roots);

    // Flatten respecting collapse state
    const rows: VisibleTimelineRow[] = [];
    const traverse = (nodes: any[], depth: number, parentCollapsed: boolean) => {
      for (const node of nodes) {
        const hasChildren = node.children && node.children.length > 0;
        const isCollapsed = !!this.collapsedTimelineNodes[node.id];

        let icon = 'date_range';
        if (node.level === 'year' || depth === 0) {
          icon = 'event';
        }

        const row: VisibleTimelineRow = {
          id: node.id,
          title: node.title,
          start_date: node.start_date,
          end_date: node.end_date,
          period: node.period,
          workspace_id: node.workspace_id,
          timeline_category: node.timeline_category,
          parent_id: node.parent_id,
          level: node.level,
          depth: depth,
          hasChildren: hasChildren,
          isCollapsed: isCollapsed,
          icon: icon
        };

        if (!parentCollapsed) {
          rows.push(row);
        }

        if (hasChildren) {
          traverse(node.children, depth + 1, parentCollapsed || isCollapsed);
        }
      }
    };

    traverse(roots, 0, false);
    return rows;
  }

  editTimeline(tl: Timeline | VisibleTimelineRow) {
    this.newTimeline = {
      id: tl.id,
      title: tl.title,
      start_date: tl.start_date,
      end_date: tl.end_date,
      workspace_id: tl.workspace_id,
      timeline_category: tl.timeline_category || 'tree',
      parent_id: tl.parent_id || undefined,
      level: tl.level || 'quarter'
    };
    this.isEditingTimeline = true;
    this.timelineModalMode = 'single';
    this.isSavingTimeline = false;
    this.isEditTimelineSpaceDropdownOpen = false;
    this.isEditTimelineLevelDropdownOpen = false;
    this.isEditTimelineParentDropdownOpen = false;
    this.showTimelineModal = true;
  }

  getEditTimelineSpaceName(): string {
    if (!this.newTimeline.workspace_id) return 'Chọn Không gian...';
    const s = this.spaces.find(sp => sp.id === this.newTimeline.workspace_id);
    return s ? s.name : this.newTimeline.workspace_id;
  }

  selectEditTimelineSpace(space: Space): void {
    this.newTimeline.workspace_id = space.id;
    this.isEditTimelineSpaceDropdownOpen = false;
  }

  getEditTimelineLevelLabel(): string {
    switch (this.newTimeline.level) {
      case 'year': return 'Year (Cấp Năm)';
      case 'quarter': return 'Quarter (Cấp Quý)';
      case 'month': return 'Month (Cấp Tháng)';
      default: return this.newTimeline.level || 'Chọn cấp độ...';
    }
  }

  getEditTimelineLevelIcon(): string {
    switch (this.newTimeline.level) {
      case 'year': return 'fa-solid fa-calendar-days text-primary';
      case 'quarter': return 'fa-solid fa-calendar-week text-info';
      case 'month': return 'fa-solid fa-calendar-day text-success';
      default: return 'fa-solid fa-calendar text-muted';
    }
  }

  selectEditTimelineLevel(lvl: 'year' | 'quarter' | 'month'): void {
    this.newTimeline.level = lvl;
    this.isEditTimelineLevelDropdownOpen = false;
  }

  getEditTimelineParentLabel(): string {
    if (!this.newTimeline.parent_id) return '(None - Root Year / Cấp cao nhất)';
    const found = this.timelines.find(t => t.id === this.newTimeline.parent_id);
    return found ? `${found.level === 'year' ? '📅 ' : (found.level === 'quarter' ? '🗓️ ' : '• ')}${found.title}` : this.newTimeline.parent_id;
  }

  selectEditTimelineParent(t: Timeline | null): void {
    this.newTimeline.parent_id = t ? t.id : undefined;
    this.isEditTimelineParentDropdownOpen = false;
  }

  get availableParentTimelines(): Timeline[] {
    return this.timelines.filter(t => t.id !== this.newTimeline.id);
  }

  openAddChildTimeline(parent: VisibleTimelineRow, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.isEditingTimeline = false;
    this.isSavingTimeline = false;
    this.timelineModalMode = 'single';

    let defaultCat = 'Quarter';
    let defaultLevel = 'quarter';
    if (parent.level === 'year' || parent.depth === 0) {
      defaultCat = 'Quarter';
      defaultLevel = 'quarter';
    } else if (parent.level === 'quarter' || parent.depth === 1) {
      defaultCat = 'Month';
      defaultLevel = 'month';
    } else {
      defaultCat = 'Custom';
      defaultLevel = 'custom';
    }

    this.newTimeline = {
      title: '',
      workspace_id: parent.workspace_id,
      timeline_category: defaultCat,
      level: defaultLevel,
      parent_id: parent.id,
      start_date: parent.start_date,
      end_date: parent.end_date
    };
    this.showTimelineModal = true;
  }

  async deleteTimeline(tl: Timeline | VisibleTimelineRow): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận xóa Chu kỳ',
      message: `Bạn có chắc chắn muốn xóa Chu kỳ "${tl.title}" không? Thao tác này sẽ xóa vĩnh viễn chu kỳ và các chu kỳ con liên quan.`,
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.okrService.deleteTimeline(tl.id).subscribe({
      next: () => {
        this.timelines = this.timelines.filter(t => t.id !== tl.id && t.parent_id !== tl.id);
      },
      error: (err) => {
        this.confirmService.confirm({
          title: 'Lỗi khi xóa Chu kỳ',
          message: err.error?.error || err.message || 'Xóa chu kỳ thất bại.',
          confirmText: 'Đóng',
          cancelText: '',
          type: 'danger'
        });
      }
    });
  }

  openCreateTimelineModal(): void {
    this.isEditingTimeline = false;
    this.isSavingTimeline = false;
    this.timelineModalMode = 'tree';
    this.selectedTimelineYear = 2027;
    this.multipleYearsTimeline = false;
    this.previewTimelineCollapsed = false;
    this.treeTimelineHierarchy = ['Quarterly', 'Monthly'];
    
    const defaultSpace = (this.selectedTimelineSpaceId && this.selectedTimelineSpaceId !== 'all')
      ? this.selectedTimelineSpaceId
      : ((this.spaces && this.spaces.length > 0) ? this.spaces[0].id : '');

    this.newTimeline = {
      title: '2027',
      workspace_id: defaultSpace,
      start_date: 'Jan 01, 2027',
      end_date: 'Dec 31, 2027',
      timeline_category: 'tree',
      level: 'year'
    };
    this.generateTimelinePreview();
    this.showTimelineModal = true;
  }

  onTimelineYearChange(year: number): void {
    this.selectedTimelineYear = year;
    this.newTimeline.title = `${year}`;
    this.newTimeline.start_date = `Jan 01, ${year}`;
    this.newTimeline.end_date = `Dec 31, ${year}`;
    this.generateTimelinePreview();
  }

  generateTimelinePreview(): void {
    const yr = this.selectedTimelineYear || 2027;
    const hasQuarters = this.treeTimelineHierarchy.includes('Quarterly');
    const hasMonths = this.treeTimelineHierarchy.includes('Monthly');

    const yearItem: any = {
      id: `TL-YEAR-${yr}`,
      title: `${yr}`,
      period: `Jan 01, ${yr} - Dec 31, ${yr}`,
      start_date: `Jan 01, ${yr}`,
      end_date: `Dec 31, ${yr}`,
      level: 'year',
      checked: true,
      collapsed: false,
      children: []
    };

    const quarters = [
      { name: 'Quarter 1', start: `Jan 01, ${yr}`, end: `Mar 31, ${yr}`, m: [1, 2, 3] },
      { name: 'Quarter 2', start: `Apr 01, ${yr}`, end: `Jun 30, ${yr}`, m: [4, 5, 6] },
      { name: 'Quarter 3', start: `Jul 01, ${yr}`, end: `Sep 30, ${yr}`, m: [7, 8, 9] },
      { name: 'Quarter 4', start: `Oct 01, ${yr}`, end: `Dec 31, ${yr}`, m: [10, 11, 12] }
    ];

    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthDays = [0, 31, (yr % 4 === 0 ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    if (hasQuarters) {
      quarters.forEach((q, qIdx) => {
        const qItem: any = {
          id: `TL-Q${qIdx + 1}-${yr}`,
          title: q.name,
          period: `${q.start} - ${q.end}`,
          start_date: q.start,
          end_date: q.end,
          level: 'quarter',
          checked: true,
          collapsed: false,
          children: []
        };

        if (hasMonths) {
          q.m.forEach((mNum) => {
            const lastDay = monthDays[mNum];
            const mName = monthNames[mNum];
            const mStart = `${mName} 01, ${yr}`;
            const mEnd = `${mName} ${lastDay}, ${yr}`;
            qItem.children.push({
              id: `TL-M${mNum}-${yr}`,
              title: `Month ${mNum}`,
              period: `${mStart} - ${mEnd}`,
              start_date: mStart,
              end_date: mEnd,
              level: 'month',
              checked: true
            });
          });
        }

        yearItem.children.push(qItem);
      });
    } else if (hasMonths) {
      for (let mNum = 1; mNum <= 12; mNum++) {
        const lastDay = monthDays[mNum];
        const mName = monthNames[mNum];
        const mStart = `${mName} 01, ${yr}`;
        const mEnd = `${mName} ${lastDay}, ${yr}`;
        yearItem.children.push({
          id: `TL-M${mNum}-${yr}`,
          title: `Month ${mNum}`,
          period: `${mStart} - ${mEnd}`,
          start_date: mStart,
          end_date: mEnd,
          level: 'month',
          checked: true
        });
      }
    }

    this.previewTimelineItems = [yearItem];
  }

  togglePreviewNodeCollapse(node: any, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    node.collapsed = !node.collapsed;
  }

  togglePreviewCollapseAll(): void {
    this.previewTimelineCollapsed = !this.previewTimelineCollapsed;
    this.previewTimelineItems.forEach(yr => {
      yr.collapsed = this.previewTimelineCollapsed;
      if (yr.children) {
        yr.children.forEach((q: any) => {
          q.collapsed = this.previewTimelineCollapsed;
        });
      }
    });
  }

  removeTreeHierarchyTag(tag: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.treeTimelineHierarchy = this.treeTimelineHierarchy.filter(t => t !== tag);
    this.generateTimelinePreview();
  }

  getCreateTimelineSpaceName(): string {
    if (!this.newTimeline.workspace_id) return 'Chọn Không gian...';
    const s = this.spaces.find(sp => sp.id === this.newTimeline.workspace_id);
    return s ? s.name : this.newTimeline.workspace_id;
  }

  selectCreateTimelineSpace(space: Space): void {
    this.newTimeline.workspace_id = space.id;
    this.isCreateTimelineSpaceDropdownOpen = false;
  }

  addTreeHierarchyTag(tag: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!this.treeTimelineHierarchy.includes(tag)) {
      this.treeTimelineHierarchy.push(tag);
    } else {
      this.treeTimelineHierarchy = this.treeTimelineHierarchy.filter(t => t !== tag);
    }
    this.generateTimelinePreview();
  }

  onPreviewChildCheckChange(parent: any, grandParent?: any): void {
    if (parent && parent.children) {
      const anyChecked = parent.children.some((c: any) => c.checked);
      if (anyChecked) {
        parent.checked = true;
        if (grandParent) {
          grandParent.checked = true;
        }
      }
    }
  }

  togglePreviewCheck(item: any): void {
    if (item.children) {
      item.children.forEach((c: any) => {
        c.checked = item.checked;
        if (c.children) {
          c.children.forEach((sub: any) => sub.checked = item.checked);
        }
      });
    }
  }

  saveEnhancedTimeline(): void {
    if (this.isSavingTimeline) return;
    this.isSavingTimeline = true;

    const checkedItems: any[] = [];
    const spaceId = this.newTimeline.workspace_id || (this.spaces.length > 0 ? this.spaces[0].id : 'SPC-01');

    this.previewTimelineItems.forEach(year => {
      if (year.checked) {
        checkedItems.push({
          id: year.id,
          title: year.title,
          start_date: year.start_date,
          end_date: year.end_date,
          workspace_id: spaceId,
          timeline_category: 'tree',
          level: 'year',
          parent_id: null
        });

        if (year.children) {
          year.children.forEach((q: any) => {
            if (q.checked) {
              checkedItems.push({
                id: q.id,
                title: q.title,
                start_date: q.start_date,
                end_date: q.end_date,
                workspace_id: spaceId,
                timeline_category: 'tree',
                level: 'quarter',
                parent_id: year.id
              });

              if (q.children) {
                q.children.forEach((m: any) => {
                  if (m.checked) {
                    checkedItems.push({
                      id: m.id,
                      title: m.title,
                      start_date: m.start_date,
                      end_date: m.end_date,
                      workspace_id: spaceId,
                      timeline_category: 'tree',
                      level: 'month',
                      parent_id: q.id
                    });
                  }
                });
              }
            }
          });
        }
      }
    });

    if (checkedItems.length === 0) {
      alert('Vui lòng chọn ít nhất một mốc thời gian để khởi tạo!');
      this.isSavingTimeline = false;
      return;
    }

    this.okrService.createTimeline({ items: checkedItems } as any).subscribe({
      next: () => {
        this.showTimelineModal = false;
        this.isSavingTimeline = false;
        this.okrService.getTimelines().subscribe(d => this.timelines = d);
      },
      error: (err) => {
        this.isSavingTimeline = false;
        alert('Tạo chu kỳ thời gian thất bại: ' + (err.error?.error || err.message));
      }
    });
  }

  saveTimeline() {
    if (this.isSavingTimeline) return;
    if (!this.newTimeline.title) {
      alert('Vui lòng nhập Tên chu kỳ (Title)!');
      return;
    }
    this.newTimeline.timeline_category = this.newTimeline.timeline_category || 'tree';
    this.isSavingTimeline = true;
    if (this.isEditingTimeline && this.newTimeline.id) {
      this.okrService.updateTimeline(this.newTimeline.id, this.newTimeline).subscribe({
        next: () => {
          this.showTimelineModal = false;
          this.newTimeline = {};
          this.isSavingTimeline = false;
          this.isEditingTimeline = false;
          this.okrService.getTimelines().subscribe(d => this.timelines = d);
        },
        error: (err) => {
          this.isSavingTimeline = false;
          alert('Cập nhật chu kỳ thất bại: ' + (err.error?.error || err.message));
        }
      });
    } else {
      this.okrService.createTimeline(this.newTimeline).subscribe({
        next: () => {
          this.showTimelineModal = false;
          this.newTimeline = {};
          this.isSavingTimeline = false;
          this.okrService.getTimelines().subscribe(d => this.timelines = d);
        },
        error: (err) => {
          this.isSavingTimeline = false;
          alert('Lưu chu kỳ thất bại: ' + (err.error?.error || err.message));
        }
      });
    }
  }

    // --- METRIC MODAL & CRUD ---
  editMetric(m: Metric) {
    this.newMetric = { ...m };
    this.isEditingMetric = true;
    this.isSavingMetric = false;
    this.showMetricModal = true;
  }

  async deleteMetric(m: Metric): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận xóa Thước đo',
      message: `Bạn có chắc chắn muốn xóa Thước đo "${m.name}" (${m.metric_key || m.unit}) không? Thao tác này sẽ xóa vĩnh viễn khỏi hệ thống.`,
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.okrService.deleteMetric(m.id).subscribe({
      next: () => {
        this.metrics = this.metrics.filter(item => item.id !== m.id);
      },
      error: (err) => {
        this.confirmService.confirm({
          title: 'Lỗi khi xóa Thước đo',
          message: err.error?.error || err.message || 'Xóa thước đo thất bại.',
          confirmText: 'Đóng',
          cancelText: '',
          type: 'danger'
        });
      }
    });
  }

  saveMetric() {
    if (this.isSavingMetric) return;
    if (!this.newMetric.name) return;
    this.isSavingMetric = true;
    if (this.isEditingMetric && this.newMetric.id) {
      this.okrService.updateMetric(this.newMetric.id, this.newMetric).subscribe({
        next: () => {
          this.showMetricModal = false;
          this.newMetric = {};
          this.isSavingMetric = false;
          this.isEditingMetric = false;
          this.okrService.getMetrics().subscribe(d => this.metrics = d);
        },
        error: (err) => {
          this.isSavingMetric = false;
          alert('Cập nhật thước đo thất bại: ' + (err.error?.error || err.message));
        }
      });
    } else {
      this.okrService.createMetric(this.newMetric).subscribe({
        next: () => {
          this.showMetricModal = false;
          this.newMetric = {};
          this.isSavingMetric = false;
          this.okrService.getMetrics().subscribe(d => this.metrics = d);
        },
        error: (err) => {
          this.isSavingMetric = false;
          alert('Lưu thước đo thất bại: ' + (err.error?.error || err.message));
        }
      });
    }
  }

  // --- SPACE MEMBER CRUD ---
  async deleteSpaceMember(sm: SpaceMember): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận xóa Thành viên',
      message: `Bạn có chắc chắn muốn xóa thành viên "${sm.user_name}" khỏi không gian không?`,
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.okrService.deleteSpaceMember(sm.id).subscribe({
      next: () => {
        this.spaceMembers = this.spaceMembers.filter(m => m.id !== sm.id);
      },
      error: (err) => {
        this.confirmService.confirm({
          title: 'Lỗi khi xóa Thành viên',
          message: err.error?.error || err.message || 'Xóa thành viên thất bại.',
          confirmText: 'Đóng',
          cancelText: '',
          type: 'danger'
        });
      }
    });
  }

  saveMember() {
    if (this.isSavingMember) return;
    if (!this.newMember.space_id) {
      alert('Vui lòng chọn Không gian!');
      return;
    }
    if (!this.newMember.user_name) {
      alert('Vui lòng chọn Thành viên!');
      return;
    }
    if (!this.newMember.team_name) {
      alert('Vui lòng chọn Team (Đội nhóm)!');
      return;
    }
    if (!this.newMember.role) {
      alert('Vui lòng chọn Vai trò (Role)!');
      return;
    }
    this.isSavingMember = true;
    this.okrService.createSpaceMember(this.newMember).subscribe({
      next: () => {
        this.showMemberModal = false;
        this.newMember = {};
        this.isSavingMember = false;
        this.okrService.getSpaceMembers().subscribe(d => this.spaceMembers = d);
      },
      error: (err) => {
        this.isSavingMember = false;
        alert('Lưu thành viên thất bại: ' + (err.error?.error || err.message));
      }
    });
  }

  // --- CONVERSION CRUD ---
  async deleteConversion(cv: MetricConversion): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận xóa Quy đổi Thước đo',
      message: 'Bạn có chắc chắn muốn xóa quy đổi thước đo này không?',
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.okrService.deleteConversion(cv.id).subscribe({
      next: () => {
        this.conversions = this.conversions.filter(c => c.id !== cv.id);
      },
      error: (err) => {
        this.confirmService.confirm({
          title: 'Lỗi khi xóa Quy đổi',
          message: err.error?.error || err.message || 'Xóa quy đổi thất bại.',
          confirmText: 'Đóng',
          cancelText: '',
          type: 'danger'
        });
      }
    });
  }

  saveConversion() {
    if (this.isSavingConversion) return;
    if (!this.newConversion.source_metric_id || !this.newConversion.target_metric_id || !this.newConversion.conversion_ratio) return;
    this.isSavingConversion = true;
    this.okrService.createConversion(this.newConversion).subscribe({
      next: () => {
        this.showConversionModal = false;
        this.newConversion = {};
        this.isSavingConversion = false;
        this.okrService.getConversions().subscribe(d => this.conversions = d);
      },
      error: (err) => {
        this.isSavingConversion = false;
        alert('Lưu quy đổi thất bại: ' + (err.error?.error || err.message));
      }
    });
  }

  // --- TEMPLATES CRUD ---
  editTemplate(t: Template) {
    this.newTemplate = { ...t };
    this.isEditingTemplate = true;
    this.isSavingTemplate = false;
    this.showTemplateModal = true;
  }

  async deleteTemplate(t: Template): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận xóa Mẫu công thức',
      message: `Bạn có chắc chắn muốn xóa Mẫu công thức "${t.name}" không?`,
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.okrService.deleteTemplate(t.id).subscribe({
      next: () => {
        this.progressTemplates = this.progressTemplates.filter(item => item.id !== t.id);
        this.aggregationTemplates = this.aggregationTemplates.filter(item => item.id !== t.id);
      },
      error: (err) => {
        this.confirmService.confirm({
          title: 'Lỗi khi xóa Mẫu công thức',
          message: err.error?.error || err.message || 'Xóa mẫu công thức thất bại.',
          confirmText: 'Đóng',
          cancelText: '',
          type: 'danger'
        });
      }
    });
  }

  saveTemplate() {
    if (this.isSavingTemplate) return;
    if (!this.newTemplate.name || !this.newTemplate.formula) return;
    this.isSavingTemplate = true;
    const type = this.activeTab === 'Công thức Tiến độ' ? 'PROGRESS' : 'AGGREGATION';
    this.newTemplate.template_type = type;

    if (this.isEditingTemplate && this.newTemplate.id) {
      this.okrService.updateTemplate(this.newTemplate.id, this.newTemplate).subscribe({
        next: () => {
          this.showTemplateModal = false;
          this.newTemplate = {};
          this.isSavingTemplate = false;
          this.isEditingTemplate = false;
          if (type === 'PROGRESS') {
            this.okrService.getTemplates('PROGRESS').subscribe(d => this.progressTemplates = d);
          } else {
            this.okrService.getTemplates('AGGREGATION').subscribe(d => this.aggregationTemplates = d);
          }
        },
        error: (err) => {
          this.isSavingTemplate = false;
          alert('Cập nhật công thức thất bại: ' + (err.error?.error || err.message));
        }
      });
    } else {
      this.okrService.createTemplate(this.newTemplate).subscribe({
        next: () => {
          this.showTemplateModal = false;
          this.newTemplate = {};
          this.isSavingTemplate = false;
          if (type === 'PROGRESS') {
            this.okrService.getTemplates('PROGRESS').subscribe(d => this.progressTemplates = d);
          } else {
            this.okrService.getTemplates('AGGREGATION').subscribe(d => this.aggregationTemplates = d);
          }
        },
        error: (err) => {
          this.isSavingTemplate = false;
          alert('Lưu công thức thất bại: ' + (err.error?.error || err.message));
        }
      });
    }
  }

  saveRule(): void {
    this.okrService.saveRule(this.newRule).subscribe(() => {
      this.showRuleModal = false;
      this.newRule = {};
      this.okrService.getRules().subscribe(r => this.rules = r);
    });
  }

  // --- DROPDOWN LOGIC ---
  get filteredSpaces() {
    return this.spaces.filter(s => s.name.toLowerCase().includes(this.spaceSearchText.toLowerCase()));
  }

  get filteredEmployees() {
    return this.employees.filter(e => e.name.toLowerCase().includes(this.employeeSearchText.toLowerCase()));
  }

  selectSpace(space: Space) {
    this.newMember.space_id = space.id;
    this.spaceSearchText = space.name;
    this.showSpaceDropdown = false;
  }

  hideSpaceDropdown() {
    setTimeout(() => this.showSpaceDropdown = false, 200);
  }

  selectEmployee(emp: any) {
    this.newMember.user_name = emp.name;
    this.employeeSearchText = emp.name;
    this.showEmployeeDropdown = false;
  }

  hideEmployeeDropdown() {
    setTimeout(() => this.showEmployeeDropdown = false, 200);
  }

  openCreateSpace() {
    this.showSpaceDropdown = false;
    this.showMemberModal = false;
    this.openCreateSpaceModal();
  }

  // --- AUTO GENERATE KEY ---
  generateKey(name: string | undefined): string {
    if (!name) return '';
    return name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9\s]/g, '') // Bỏ ký tự đặc biệt
      .trim()
      .replace(/\s+/g, '_') // Thay khoảng trắng bằng dấu gạch dưới
      .toUpperCase();
  }

  onSpaceNameChange(name: string) {
    this.newSpace.space_key = this.generateKey(name);
  }

  onMetricNameChange(name: string) {
    this.newMetric.metric_key = this.generateKey(name);
  }
}
