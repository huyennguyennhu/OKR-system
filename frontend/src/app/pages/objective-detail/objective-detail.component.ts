import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { OkrService, Objective, Employee, Metric, Timeline, KeyResult, Team, OkrComment } from '../../services/okr.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

export interface BreadcrumbItem {
  label: string;
  id?: string;
  icon: string;
  active?: boolean;
  clickable?: boolean;
  tooltip?: string;
}

@Component({
  selector: 'app-objective-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './objective-detail.component.html',
  styleUrls: ['./objective-detail.component.css']
})
export class ObjectiveDetailComponent implements OnInit {
  isNew = false;
  loading = true;
  saving = false;
  
  objective: any = {
    objective_id: '',
    level: 'PERSONAL',
    progress: 0,
    start_value: 0,
    expected_value: 100,
    current_value: 0,
    category: 'Objective',
    title: '',
    description: '',
    parent: null,
    child_objectives: [],
    key_results: []
  };

  employees: Employee[] = [];
  metrics: Metric[] = [];
  timelines: Timeline[] = [];
  teams: Team[] = [];

  // Trạng thái khi mở từ tab Objective của OKR Setting
  isFromSettings = false;
  selectedAssignToId = '';
  isAssignToDropdownOpen = false;
  
  activeTab = 'comments';

  comments: OkrComment[] = [];
  loadingComments = false;
  isAddingComment = false;
  newComment = '';

  showAddKrModal = false;
  isSavingKr = false;
  newKr: any = {
    title: '',
    metric_id: 'METRIC-01',
    start_value: 0,
    expected_value: 100,
    unit: '%'
  };

  // Custom Dropdown Open States
  isLevelDropdownOpen = false;
  isCategoryDropdownOpen = false;
  isAssigneeDropdownOpen = false;
  isTimelineDropdownOpen = false;
  isMetricDropdownOpen = false;
  isKrMetricDropdownOpen = false;

  @HostListener('document:click')
  closeAllDropdowns(): void {
    this.isLevelDropdownOpen = false;
    this.isCategoryDropdownOpen = false;
    this.isAssigneeDropdownOpen = false;
    this.isTimelineDropdownOpen = false;
    this.isMetricDropdownOpen = false;
    this.isKrMetricDropdownOpen = false;
    this.isAssignToDropdownOpen = false;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private okrService: OkrService,
    private confirmService: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      this.isFromSettings = params.get('from') === 'settings';
      if (this.isFromSettings) {
        this.selectedAssignToId = '';
      }
    });

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id === 'new') {
        this.isNew = true;
        this.loading = false;
        this.objective = {
          objective_id: `OBJ-${Math.floor(Math.random() * 900000 + 100000)}`,
          level: 'PERSONAL',
          progress: 0,
          start_value: 0,
          expected_value: 100,
          current_value: 0,
          category: 'Objective',
          title: '',
          description: '',
          parent: null,
          child_objectives: [],
          key_results: []
        };
      } else if (id) {
        this.isNew = false;
        this.loadObjective(id);
      }
    });
    this.loadMetadata();
  }

  get isCompanyLevel(): boolean {
    return (this.objective?.level || '').toUpperCase() === 'COMPANY';
  }

  get isTeamLevel(): boolean {
    return (this.objective?.level || '').toUpperCase() === 'TEAM';
  }

  loadObjective(id: string): void {
    this.loading = true;
    this.okrService.getObjectiveById(id).subscribe({
      next: (data: any) => {
        this.objective = data || {};
        if (this.isCompanyLevel) {
          this.objective.assignee_id = null;
          this.objective.assignee_name = null;
        }
        if (this.isFromSettings) {
          this.selectedAssignToId = '';
        }
        if (this.objective.start_value === undefined || this.objective.start_value === null) {
          this.objective.start_value = 0;
        }
        if (this.objective.expected_value === undefined || this.objective.expected_value === null) {
          this.objective.expected_value = 100;
        }
        this.loading = false;
        this.loadComments(id);
      },
      error: (err) => {
        console.error('Error loading objective', err);
        this.loading = false;
      }
    });
  }

  loadMetadata(): void {
    this.okrService.getEmployees().subscribe({
      next: data => this.employees = data || [],
      error: err => console.error(err)
    });
    this.okrService.getTeams().subscribe({
      next: data => this.teams = data || [],
      error: err => console.error(err)
    });
    this.okrService.getMetrics().subscribe({
      next: data => this.metrics = data || [],
      error: err => console.error(err)
    });
    this.okrService.getTimelines().subscribe({
      next: data => this.timelines = data || [],
      error: err => console.error(err)
    });
  }

  toggleAssignToDropdown(event: MouseEvent): void {
    event.stopPropagation();
    const wasOpen = this.isAssignToDropdownOpen;
    this.closeAllDropdowns();
    this.isAssignToDropdownOpen = !wasOpen;
  }

  selectAssignTo(id: string): void {
    this.selectedAssignToId = id;
    this.isAssignToDropdownOpen = false;
  }

  getSelectedAssignToLabel(): string {
    if (!this.selectedAssignToId) {
      return this.isTeamLevel ? 'Chọn nhóm phụ trách...' : 'Chọn người phụ trách...';
    }
    if (this.isTeamLevel) {
      const tm = this.teams.find(t => (t.id || t.code) === this.selectedAssignToId);
      return tm ? tm.name : this.selectedAssignToId;
    } else {
      const emp = this.employees.find(e => e.employee_id === this.selectedAssignToId);
      return emp ? emp.full_name : this.selectedAssignToId;
    }
  }

  saveObjective(): void {
    if (!this.objective.title?.trim()) {
      alert('Vui lòng nhập Tên Mục tiêu');
      return;
    }

    // Nếu vào từ OKR Settings (gán mục tiêu vào OKR Tree):
    if (this.isFromSettings) {
      if (!this.selectedAssignToId && !this.isCompanyLevel) {
        alert(this.isTeamLevel ? 'Vui lòng chọn nhóm phụ trách trước khi thêm vào OKR Tree!' : 'Vui lòng chọn người phụ trách trước khi thêm vào OKR Tree!');
        return;
      }
      this.saving = true;
      this.okrService.assignObjectiveToTree(this.objective.objective_id, {
        assignee_id: this.selectedAssignToId,
        title: this.objective.title
      }).subscribe({
        next: (res) => {
          this.saving = false;
          const assignedName = this.getSelectedAssignToLabel();
          this.confirmService.confirm({
            title: 'Thành công',
            message: `Đã thêm Mục tiêu cho "${assignedName}" vào OKR Tree thành công!`,
            confirmText: 'Đến OKR Tree',
            cancelText: 'Về tab Objective (Cài đặt)',
            type: 'info'
          }).then((goToTree) => {
            if (goToTree) {
              this.router.navigate(['/okr-tree']);
            } else {
              this.router.navigate(['/okr-settings'], { queryParams: { tab: 'Objectives' } });
            }
          });
        },
        error: (err) => {
          this.saving = false;
          console.error(err);
          alert('Lỗi khi thêm Mục tiêu vào OKR Tree: ' + (err.error?.error || err.message));
        }
      });
      return;
    }

    // Chế độ thông thường (Tạo mới hoặc Chỉnh sửa trực tiếp từ OKR Tree):
    if (this.isCompanyLevel) {
      this.objective.assignee_id = null;
    }
    this.saving = true;
    if (this.isNew) {
      this.okrService.createObjective(this.objective).subscribe({
        next: () => {
          this.saving = false;
          this.router.navigate(['/okr-tree']);
        },
        error: (err) => {
          console.error(err);
          this.saving = false;
          alert('Lỗi khi tạo Objective: ' + (err.error?.error || err.message));
        }
      });
    } else {
      this.okrService.updateObjective(this.objective.objective_id, this.objective).subscribe({
        next: () => {
          this.saving = false;
          this.router.navigate(['/okr-tree']);
        },
        error: (err) => {
          console.error(err);
          this.saving = false;
          alert('Lỗi khi cập nhật Objective: ' + (err.error?.error || err.message));
        }
      });
    }
  }

  get breadcrumbItems(): BreadcrumbItem[] {
    const items: BreadcrumbItem[] = [];
    const currentLevel = (this.objective.level || 'COMPANY').toUpperCase();
    const isPersonal = currentLevel === 'PERSONAL' || currentLevel === 'INDIVIDUAL';
    const isTeam = currentLevel === 'TEAM' || currentLevel === 'DEPARTMENT' || currentLevel === 'GROUP';
    const isCompany = currentLevel === 'COMPANY';

    const ancestors: any[] = this.objective.ancestors || (this.objective.parent ? [this.objective.parent] : []);
    const hasCompanyAncestor = ancestors.some(a => (a.level || '').toUpperCase() === 'COMPANY');

    // 1. Root Level (Company): Hiển thị nếu cấp cao nhất chưa phải là Company
    if (!hasCompanyAncestor && !isCompany) {
      items.push({
        label: 'Company',
        icon: 'fa-solid fa-building text-primary',
        clickable: false
      });
    }

    // 2. Ancestors theo đúng thứ tự phân cấp từ lớn đến nhỏ trên cây
    for (const anc of ancestors) {
      const ancLevel = (anc.level || '').toUpperCase();
      let icon = 'fa-solid fa-folder text-warning';
      if (ancLevel === 'COMPANY') icon = 'fa-solid fa-building text-primary';
      else if (ancLevel === 'TEAM' || ancLevel === 'DEPARTMENT' || ancLevel === 'GROUP') icon = 'fa-solid fa-users text-info';
      else if (ancLevel === 'PERSONAL' || ancLevel === 'INDIVIDUAL') icon = 'fa-solid fa-user text-success';

      items.push({
        label: anc.objective_id || anc.title,
        id: anc.objective_id,
        icon: icon,
        clickable: true,
        tooltip: anc.title
      });
    }

    // 3. Current Objective (Active node)
    let currentIcon = 'fa-solid fa-bullseye';
    if (isCompany) currentIcon = 'fa-solid fa-building text-primary';
    else if (isTeam) currentIcon = 'fa-solid fa-users text-info';
    else if (isPersonal) currentIcon = 'fa-solid fa-user text-success';

    items.push({
      label: this.objective.objective_id || 'Mới',
      id: this.objective.objective_id,
      icon: currentIcon,
      active: true,
      clickable: false,
      tooltip: this.objective.title
    });

    return items;
  }

  // --- Custom Dropdown Methods ---
  toggleLevelDropdown(event: MouseEvent): void {
    event.stopPropagation();
    const curr = this.isLevelDropdownOpen;
    this.closeAllDropdowns();
    this.isLevelDropdownOpen = !curr;
  }

  getLevelLabel(): string {
    const lvl = (this.objective.level || '').toUpperCase();
    if (lvl === 'COMPANY') return 'COMPANY';
    if (lvl === 'TEAM') return 'TEAM';
    if (lvl === 'PERSONAL' || lvl === 'INDIVIDUAL') return 'PERSONAL';
    return this.objective.level || 'Select Level...';
  }

  getLevelIcon(): string {
    const lvl = (this.objective.level || '').toUpperCase();
    if (lvl === 'COMPANY') return 'fa-solid fa-building text-primary';
    if (lvl === 'TEAM') return 'fa-solid fa-users text-info';
    if (lvl === 'PERSONAL' || lvl === 'INDIVIDUAL') return 'fa-solid fa-user text-success';
    return 'fa-solid fa-layer-group text-muted';
  }

  selectLevel(level: string): void {
    this.objective.level = level;
    this.isLevelDropdownOpen = false;
  }

  toggleCategoryDropdown(event: MouseEvent): void {
    event.stopPropagation();
    const curr = this.isCategoryDropdownOpen;
    this.closeAllDropdowns();
    this.isCategoryDropdownOpen = !curr;
  }

  getCategoryLabel(): string {
    return this.objective.category || 'Objective';
  }

  getCategoryIcon(): string {
    return this.objective.category === 'KPI' ? 'fa-solid fa-chart-line text-warning' : 'fa-solid fa-bullseye text-primary';
  }

  selectCategory(cat: string): void {
    this.objective.category = cat;
    this.isCategoryDropdownOpen = false;
  }

  toggleAssigneeDropdown(event: MouseEvent): void {
    event.stopPropagation();
    const curr = this.isAssigneeDropdownOpen;
    this.closeAllDropdowns();
    this.isAssigneeDropdownOpen = !curr;
  }

  getAssigneeLabel(): string {
    if (this.isCompanyLevel) return 'Toàn Công Ty';
    if (this.isTeamLevel) {
      return this.objective.assignee_name || this.objective.team_name || this.objective.assignee_id || 'Toàn nhóm';
    }
    if (!this.objective.assignee_id) return 'Chưa phân công';
    const emp = this.employees.find(e => e.employee_id === this.objective.assignee_id);
    return emp ? emp.full_name : (this.objective.assignee_name || this.objective.assignee_id);
  }

  selectAssignee(empId: string | null): void {
    this.objective.assignee_id = empId;
    this.isAssigneeDropdownOpen = false;
  }

  toggleTimelineDropdown(event: MouseEvent): void {
    event.stopPropagation();
    const curr = this.isTimelineDropdownOpen;
    this.closeAllDropdowns();
    this.isTimelineDropdownOpen = !curr;
  }

  getTimelineLabel(): string {
    if (!this.objective.timeline_id) return 'None';
    const t = this.timelines.find(tl => tl.id === this.objective.timeline_id);
    return t ? t.title : this.objective.timeline_id;
  }

  selectTimeline(timelineId: string | null): void {
    this.objective.timeline_id = timelineId;
    this.isTimelineDropdownOpen = false;
  }

  toggleMetricDropdown(event: MouseEvent): void {
    event.stopPropagation();
    const curr = this.isMetricDropdownOpen;
    this.closeAllDropdowns();
    this.isMetricDropdownOpen = !curr;
  }

  getMetricLabel(): string {
    if (!this.objective.metric_id) return 'Select Metric...';
    const m = this.metrics.find(mt => mt.id === this.objective.metric_id);
    return m ? `${m.name} (${m.unit || '%'})` : this.objective.metric_id;
  }

  selectMetric(metricId: string | null): void {
    this.objective.metric_id = metricId;
    this.isMetricDropdownOpen = false;
  }

  toggleKrMetricDropdown(event: MouseEvent): void {
    event.stopPropagation();
    const curr = this.isKrMetricDropdownOpen;
    this.closeAllDropdowns();
    this.isKrMetricDropdownOpen = !curr;
  }

  getKrMetricLabel(): string {
    if (!this.newKr.metric_id) return 'Select Metric...';
    const m = this.metrics.find(mt => mt.id === this.newKr.metric_id);
    return m ? `${m.name} (${m.unit || '%'})` : this.newKr.metric_id;
  }

  selectKrMetric(metricId: string): void {
    this.newKr.metric_id = metricId;
    this.isKrMetricDropdownOpen = false;
  }

  cancel(): void {
    if (this.isFromSettings) {
      this.router.navigate(['/okr-settings'], { queryParams: { tab: 'Objectives' } });
    } else {
      this.router.navigate(['/okr-tree']);
    }
  }

  viewParentObjective(id: string): void {
    this.router.navigate(['/objectives', id], {
      queryParams: this.isFromSettings ? { from: 'settings' } : {}
    });
  }

  viewChildObjective(id: string): void {
    this.router.navigate(['/objectives', id], {
      queryParams: this.isFromSettings ? { from: 'settings' } : {}
    });
  }

  openAddKrModal(): void {
    this.newKr = {
      title: '',
      metric_id: this.metrics.length > 0 ? this.metrics[0].id : 'METRIC-01',
      start_value: 0,
      expected_value: 100,
      unit: '%'
    };
    this.showAddKrModal = true;
  }

  saveNewKr(): void {
    if (!this.newKr.title?.trim()) {
      alert('Vui lòng nhập tên Kết quả then chốt (Key Result)');
      return;
    }
    this.isSavingKr = true;
    this.okrService.createKeyResult({
      ...this.newKr,
      objective_id: this.objective.objective_id,
      start_value: Number(this.newKr.start_value) || 0,
      expected_value: Number(this.newKr.expected_value) || 100,
      current_value: 0
    }).subscribe({
      next: () => {
        this.isSavingKr = false;
        this.showAddKrModal = false;
        this.loadObjective(this.objective.objective_id);
      },
      error: (err) => {
        this.isSavingKr = false;
        console.error(err);
        alert('Lỗi khi thêm Key Result: ' + (err.error?.error || err.message));
      }
    });
  }

  getProgressColor(progress: number): string {
    if (progress >= 70) return '#10b981';
    if (progress >= 40) return '#f59e0b';
    return '#ef4444';
  }

  getProgressRingStyle(progress: number): string {
    const val = Math.min(Math.max(progress || 0, 0), 100);
    const color = this.getProgressColor(val);
    return `conic-gradient(${color} ${val}%, #e2e8f0 ${val}% 100%)`;
  }

  getStatusLabel(progress: number): string {
    if (progress >= 100) return 'Completed';
    if (progress >= 70) return 'On Track';
    if (progress >= 40) return 'Needs Attention';
    return 'At Risk';
  }

  getStatusBadgeClass(progress: number): string {
    if (progress >= 70) return 'badge-success';
    if (progress >= 40) return 'badge-warning';
    return 'badge-danger';
  }

  loadComments(objId: string): void {
    if (!objId) return;
    this.loadingComments = true;
    this.okrService.getComments({ objective_id: objId }).subscribe({
      next: (data) => {
        this.comments = data || [];
        this.loadingComments = false;
      },
      error: (err) => {
        console.error('Error loading comments', err);
        this.loadingComments = false;
      }
    });
  }

  addComment(): void {
    if (!this.newComment.trim() || !this.objective?.objective_id) return;
    const content = this.newComment.trim();
    this.isAddingComment = true;
    const commentPayload: Partial<OkrComment> = {
      objective_id: this.objective.objective_id,
      content,
      author: 'Bạn (Quản trị viên)',
      source: 'web_user'
    };

    this.okrService.addComment(commentPayload).subscribe({
      next: () => {
        this.newComment = '';
        this.isAddingComment = false;
        this.loadComments(this.objective.objective_id);
      },
      error: (err) => {
        console.error('Error adding comment', err);
        this.isAddingComment = false;
        // Fallback local unshift if server error
        this.comments.unshift({
          author: 'Bạn (Quản trị viên)',
          created_at: new Date().toISOString(),
          content,
          source: 'web_user'
        });
        this.newComment = '';
      }
    });
  }

  deleteComment(commentId: number | string | undefined): void {
    if (!commentId) return;
    this.okrService.deleteComment(commentId).subscribe({
      next: () => {
        this.comments = this.comments.filter(c => c.comment_id !== commentId);
      },
      error: (err) => console.error('Error deleting comment', err)
    });
  }

  formatCommentTime(dateStr?: string): string {
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

  goToAuditLog(): void {
    this.router.navigate(['/audit-log']);
  }
}
