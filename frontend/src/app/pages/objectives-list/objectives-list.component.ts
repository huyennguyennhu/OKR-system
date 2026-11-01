import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OkrService, Objective, Employee, Metric, Timeline, Team, Space } from '../../services/okr.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-objectives-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './objectives-list.component.html',
  styleUrls: ['./objectives-list.component.css']
})
export class ObjectivesListComponent implements OnInit {
  objectives: Objective[] = [];
  loading = true;
  activeDropdownId: string | null = null;
  searchQuery = '';
  selectedLevel = 'all';
  isLevelDropdownOpen = false;

  // Space filtering state
  spaces: Space[] = [];
  selectedSpaceId = 'all';
  isSpaceFilterDropdownOpen = false;
  
  showCreateModal = false;
  saving = false;
  isDropup = false;

  newObjective: Partial<Objective> = {
    level: 'COMPANY',
    progress: 0,
    start_value: 0,
    expected_value: 100,
    category: 'Objective',
    space_id: ''
  };

  employees: Employee[] = [];
  metrics: Metric[] = [];
  timelines: Timeline[] = [];
  teams: Team[] = [];

  // Dropdown states for Create Modal
  isFormSpaceDropdownOpen = false;
  isFormLevelDropdownOpen = false;
  isFormParentDropdownOpen = false;
  isFormTeamDropdownOpen = false;
  isFormAssigneeDropdownOpen = false;
  isFormTimelineDropdownOpen = false;
  selectedFormTeamName = '';

  get filteredObjectives(): Objective[] {
    return this.objectives.filter(obj => {
      const q = this.searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        (obj.objective_id && obj.objective_id.toLowerCase().includes(q)) ||
        (obj.title && obj.title.toLowerCase().includes(q));

      const matchLevel = this.selectedLevel === 'all' || 
        (obj.level && obj.level.toUpperCase() === this.selectedLevel.toUpperCase());

      return matchSearch && matchLevel;
    });
  }

  constructor(
    private okrService: OkrService, 
    private router: Router,
    private confirmService: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.loadObjectives();
    this.loadMetadata();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.activeDropdownId = null;
    this.isLevelDropdownOpen = false;
    this.isSpaceFilterDropdownOpen = false;
    this.isFormSpaceDropdownOpen = false;
    this.isFormLevelDropdownOpen = false;
    this.isFormParentDropdownOpen = false;
    this.isFormTeamDropdownOpen = false;
    this.isFormAssigneeDropdownOpen = false;
    this.isFormTimelineDropdownOpen = false;
  }

  toggleSpaceFilterDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isLevelDropdownOpen = false;
    this.isSpaceFilterDropdownOpen = !this.isSpaceFilterDropdownOpen;
  }

  selectSpaceFilter(spaceId: string): void {
    this.selectedSpaceId = spaceId;
    this.isSpaceFilterDropdownOpen = false;
    this.loadObjectives();
  }

  getSelectedSpaceLabel(): string {
    if (this.selectedSpaceId === 'all') return 'Tất cả Không gian';
    const s = this.spaces.find(x => x.id === this.selectedSpaceId);
    return s ? s.name : this.selectedSpaceId;
  }

  toggleLevelDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isSpaceFilterDropdownOpen = false;
    this.isLevelDropdownOpen = !this.isLevelDropdownOpen;
  }

  selectLevel(level: string): void {
    this.selectedLevel = level;
    this.isLevelDropdownOpen = false;
  }

  getSelectedLevelLabel(): string {
    switch (this.selectedLevel.toUpperCase()) {
      case 'COMPANY': return 'Cấp Công ty (COMPANY)';
      case 'TEAM': return 'Cấp Nhóm (TEAM)';
      case 'PERSONAL': return 'Cấp Cá nhân (PERSONAL)';
      default: return 'Tất cả cấp độ';
    }
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

  loadObjectives(): void {
    this.loading = true;
    this.okrService.getObjectives(this.selectedSpaceId).subscribe({
      next: (data) => {
        this.objectives = data || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching objectives', err);
        this.loading = false;
      }
    });
  }

  loadMetadata(): void {
    this.okrService.getSpaces().subscribe(data => this.spaces = data || []);
    this.okrService.getEmployees().subscribe(data => this.employees = data || []);
    this.okrService.getMetrics().subscribe(data => this.metrics = data || []);
    this.okrService.getTimelines().subscribe(data => this.timelines = data || []);
    this.okrService.getTeams().subscribe(data => this.teams = data || []);
  }

  generateObjectiveCode(level: string): string {
    const lvl = (level || 'COMPANY').toUpperCase();
    let prefix = 'OBJ-COM';
    if (lvl === 'TEAM') prefix = 'OBJ-TEAM';
    else if (lvl === 'PERSONAL' || lvl === 'INDIVIDUAL') prefix = 'OBJ-IND';

    let maxNum = 0;
    this.objectives.forEach(obj => {
      if (obj.objective_id && obj.objective_id.toUpperCase().startsWith(prefix)) {
        const parts = obj.objective_id.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });

    const nextNum = (maxNum + 1).toString().padStart(2, '0');
    return `${prefix}-${nextNum}`;
  }

  createObjective(): void {
    const defaultLevel = 'COMPANY';
    let defaultSpaceId = '';
    if (this.selectedSpaceId && this.selectedSpaceId !== 'all') {
      defaultSpaceId = this.selectedSpaceId;
    } else if (this.spaces.length > 0) {
      defaultSpaceId = this.spaces[0].id;
    }

    const spaceTimelines = this.timelines.filter(t => !defaultSpaceId || t.workspace_id === defaultSpaceId);

    this.newObjective = {
      level: defaultLevel,
      objective_id: this.generateObjectiveCode(defaultLevel),
      space_id: defaultSpaceId,
      title: '',
      description: '',
      timeline_id: spaceTimelines.length > 0 ? spaceTimelines[0].id : (this.timelines.length > 0 ? this.timelines[0].id : 'Q3-2026'),
      progress: 0,
      start_value: 0,
      expected_value: 100,
      parent_id: '',
      assignee_id: undefined
    };
    this.selectedFormTeamName = '';
    this.isFormSpaceDropdownOpen = false;
    this.isFormLevelDropdownOpen = false;
    this.isFormParentDropdownOpen = false;
    this.isFormTeamDropdownOpen = false;
    this.isFormAssigneeDropdownOpen = false;
    this.isFormTimelineDropdownOpen = false;
    this.showCreateModal = true;
  }

  selectFormSpace(space: Space): void {
    this.newObjective.space_id = space.id;
    this.isFormSpaceDropdownOpen = false;
    
    // Auto adjust timeline for this space if needed
    const spaceTimelines = this.timelines.filter(t => t.workspace_id === space.id);
    if (spaceTimelines.length > 0 && (!this.newObjective.timeline_id || !spaceTimelines.some(t => t.id === this.newObjective.timeline_id))) {
      this.newObjective.timeline_id = spaceTimelines[0].id;
    }

    // Reset parent objective if not in same space
    if (this.newObjective.parent_id) {
      const parent = this.objectives.find(o => o.objective_id === this.newObjective.parent_id);
      if (parent && parent.space_id && parent.space_id !== space.id) {
        this.newObjective.parent_id = '';
      }
    }
  }

  getFormSpaceLabel(): string {
    if (!this.newObjective.space_id) return 'Chọn Không gian...';
    const found = this.spaces.find(s => s.id === this.newObjective.space_id);
    return found ? found.name : this.newObjective.space_id;
  }

  get availableFormTimelines(): Timeline[] {
    if (!this.newObjective.space_id) return this.timelines;
    const filtered = this.timelines.filter(t => t.workspace_id === this.newObjective.space_id);
    return filtered.length > 0 ? filtered : this.timelines;
  }

  selectFormLevel(level: 'COMPANY' | 'TEAM' | 'PERSONAL'): void {
    this.newObjective.level = level;
    this.newObjective.objective_id = this.generateObjectiveCode(level);
    if (level === 'COMPANY') {
      this.newObjective.assignee_id = undefined;
      this.selectedFormTeamName = '';
      this.newObjective.parent_id = '';
      this.isFormAssigneeDropdownOpen = false;
    }
    this.isFormLevelDropdownOpen = false;
  }

  selectFormParent(obj: Objective | null): void {
    this.newObjective.parent_id = obj ? obj.objective_id : '';
    this.isFormParentDropdownOpen = false;
  }

  selectFormTeam(team: Team): void {
    this.selectedFormTeamName = team.name;
    this.isFormTeamDropdownOpen = false;
  }

  selectFormAssignee(emp: Employee): void {
    this.newObjective.assignee_id = emp.employee_id;
    if (emp.team_id && !this.selectedFormTeamName) {
      const t = this.teams.find(tm => tm.id === emp.team_id || tm.code === emp.team_id || tm.name === emp.team_id);
      if (t) this.selectedFormTeamName = t.name;
    }
    this.isFormAssigneeDropdownOpen = false;
  }

  selectFormTimeline(tl: Timeline): void {
    this.newObjective.timeline_id = tl.id;
    this.isFormTimelineDropdownOpen = false;
  }

  getFormLevelIcon(): string {
    switch ((this.newObjective.level || '').toUpperCase()) {
      case 'COMPANY': return 'fa-solid fa-building text-primary';
      case 'TEAM': return 'fa-solid fa-users text-info';
      case 'PERSONAL': return 'fa-solid fa-user text-success';
      default: return 'fa-solid fa-bullseye text-primary';
    }
  }

  getFormParentLabel(): string {
    if (!this.newObjective.parent_id) return '(Không có - Mục tiêu độc lập)';
    const found = this.objectives.find(o => o.objective_id === this.newObjective.parent_id);
    return found ? `[${found.objective_id}] ${found.title}` : this.newObjective.parent_id;
  }

  getFormAssigneeLabel(): string {
    if ((this.newObjective.level || '').toUpperCase() === 'COMPANY') {
      return 'Toàn Công Ty';
    }
    if (!this.newObjective.assignee_id) return 'Chọn Người phụ trách...';
    const found = this.employees.find(e => e.employee_id === this.newObjective.assignee_id);
    return found ? `${found.full_name} (${found.display_code})` : this.newObjective.assignee_id;
  }

  getFormTimelineLabel(): string {
    if (!this.newObjective.timeline_id) return 'Chọn Chu kỳ...';
    const found = this.timelines.find(t => t.id === this.newObjective.timeline_id);
    return found ? `${found.title} (${found.level || 'chu kỳ'})` : this.newObjective.timeline_id;
  }

  get availableParentObjectives(): Objective[] {
    const lvl = (this.newObjective.level || '').toUpperCase();
    return this.objectives.filter(o => {
      const sameSpace = !this.newObjective.space_id || !o.space_id || o.space_id === this.newObjective.space_id;
      if (!sameSpace) return false;
      const oLvl = (o.level || '').toUpperCase();
      if (lvl === 'TEAM') {
        return oLvl === 'COMPANY';
      }
      if (lvl === 'PERSONAL') {
        return oLvl === 'TEAM' || oLvl === 'COMPANY';
      }
      return false;
    });
  }

  editObjective(obj: Objective): void {
    this.viewObjective(obj.objective_id);
  }

  async cloneObjective(obj: Objective): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận nhân bản Mục tiêu',
      message: `Bạn có muốn nhân bản mục tiêu "${obj.title}" kèm các Key Results liên thuộc không?`,
      confirmText: 'Nhân bản',
      type: 'info'
    });
    if (!ok) return;

    this.loading = true;
    this.okrService.cloneObjective(obj.objective_id).subscribe({
      next: () => {
        this.loadObjectives();
      },
      error: (err) => {
        this.loading = false;
        console.error('Lỗi khi nhân bản mục tiêu:', err);
        this.confirmService.confirm({
          title: 'Lỗi khi nhân bản mục tiêu',
          message: err.error?.error || 'Không thể nhân bản mục tiêu này. Vui lòng kiểm tra lại kết nối cơ sở dữ liệu.',
          confirmText: 'Đóng',
          cancelText: '',
          type: 'danger'
        });
      }
    });
  }

  async deleteObjective(obj: Objective): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận xóa Mục tiêu',
      message: `Bạn có chắc chắn muốn xóa mục tiêu <strong>"${obj.title}"</strong> (${obj.objective_id}) không? Các kết quả then chốt và dữ liệu đo lường liên quan sẽ bị xóa vĩnh viễn.`,
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.okrService.deleteObjective(obj.objective_id).subscribe({
      next: () => {
        this.objectives = this.objectives.filter(o => o.objective_id !== obj.objective_id);
      },
      error: (err) => {
        this.confirmService.confirm({
          title: 'Lỗi khi xóa Mục tiêu',
          message: err.error?.error || err.message || 'Không thể xóa mục tiêu này.',
          confirmText: 'Đóng',
          cancelText: '',
          type: 'danger'
        });
      }
    });
  }

  closeCreateModal(): void {
    if (this.saving) return;
    this.showCreateModal = false;
  }

  saveObjective(): void {
    if (this.saving) return;
    if (!this.newObjective.title) return alert('Vui lòng nhập Tên Mục tiêu');
    if ((this.newObjective.level || '').toUpperCase() === 'COMPANY') {
      this.newObjective.assignee_id = undefined;
      this.newObjective.parent_id = '';
    }
    this.saving = true;
    this.okrService.createObjective(this.newObjective).subscribe({
      next: () => {
        this.saving = false;
        this.showCreateModal = false;
        this.loadObjectives();
      },
      error: (err) => {
        console.error(err);
        this.saving = false;
        alert('Lưu mục tiêu thất bại: ' + (err.error?.error || err.message));
      }
    });
  }

  viewObjective(id: string): void {
    this.router.navigate(['/objectives', id], { queryParams: { from: 'settings' } });
  }
}
