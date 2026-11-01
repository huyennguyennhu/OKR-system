import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OkrService, Objective, Employee, Metric, Timeline, Team } from '../../services/okr.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-objective-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './objective-create.component.html',
  styleUrls: ['./objective-create.component.css']
})
export class ObjectiveCreateComponent implements OnInit {
  saving = false;
  
  objective: Partial<Objective> = {
    level: 'COMPANY',
    objective_id: 'OBJ-COM-01',
    progress: 0,
    start_value: 0,
    expected_value: 100
  };

  objectives: Objective[] = [];
  employees: Employee[] = [];
  metrics: Metric[] = [];
  timelines: Timeline[] = [];
  teams: Team[] = [];

  // Dropdown states
  isFormLevelDropdownOpen = false;
  isFormParentDropdownOpen = false;
  isFormTeamDropdownOpen = false;
  isFormAssigneeDropdownOpen = false;
  isFormTimelineDropdownOpen = false;
  selectedFormTeamName = '';

  constructor(
    private router: Router,
    private okrService: OkrService
  ) {}

  ngOnInit(): void {
    this.loadMetadata();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isFormLevelDropdownOpen = false;
    this.isFormParentDropdownOpen = false;
    this.isFormTeamDropdownOpen = false;
    this.isFormAssigneeDropdownOpen = false;
    this.isFormTimelineDropdownOpen = false;
  }

  loadMetadata(): void {
    this.okrService.getObjectives().subscribe(data => {
      this.objectives = data || [];
      this.objective.objective_id = this.generateObjectiveCode(this.objective.level || 'COMPANY');
    });
    this.okrService.getEmployees().subscribe(data => this.employees = data || []);
    this.okrService.getMetrics().subscribe(data => this.metrics = data || []);
    this.okrService.getTimelines().subscribe(data => {
      this.timelines = data || [];
      if (!this.objective.timeline_id && this.timelines.length > 0) {
        this.objective.timeline_id = this.timelines[0].id;
      }
    });
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

  selectFormLevel(level: 'COMPANY' | 'TEAM' | 'PERSONAL'): void {
    this.objective.level = level;
    this.objective.objective_id = this.generateObjectiveCode(level);
    this.isFormLevelDropdownOpen = false;
  }

  selectFormParent(obj: Objective | null): void {
    this.objective.parent_id = obj ? obj.objective_id : '';
    this.isFormParentDropdownOpen = false;
  }

  selectFormTeam(team: Team): void {
    this.selectedFormTeamName = team.name;
    this.isFormTeamDropdownOpen = false;
  }

  selectFormAssignee(emp: Employee): void {
    this.objective.assignee_id = emp.employee_id;
    if (emp.team_id && !this.selectedFormTeamName) {
      const t = this.teams.find(tm => tm.id === emp.team_id || tm.code === emp.team_id || tm.name === emp.team_id);
      if (t) this.selectedFormTeamName = t.name;
    }
    this.isFormAssigneeDropdownOpen = false;
  }

  selectFormTimeline(tl: Timeline): void {
    this.objective.timeline_id = tl.id;
    this.isFormTimelineDropdownOpen = false;
  }

  getFormLevelIcon(): string {
    switch ((this.objective.level || '').toUpperCase()) {
      case 'COMPANY': return 'fa-solid fa-building text-primary';
      case 'TEAM': return 'fa-solid fa-users text-info';
      case 'PERSONAL': return 'fa-solid fa-user text-success';
      default: return 'fa-solid fa-bullseye text-primary';
    }
  }

  getFormParentLabel(): string {
    if (!this.objective.parent_id) return '(Không có - Mục tiêu độc lập)';
    const found = this.objectives.find(o => o.objective_id === this.objective.parent_id);
    return found ? `[${found.objective_id}] ${found.title}` : this.objective.parent_id;
  }

  getFormAssigneeLabel(): string {
    if (!this.objective.assignee_id) return 'Chọn Người phụ trách...';
    const found = this.employees.find(e => e.employee_id === this.objective.assignee_id);
    return found ? `${found.full_name} (${found.display_code})` : this.objective.assignee_id;
  }

  getFormTimelineLabel(): string {
    if (!this.objective.timeline_id) return 'Chọn Chu kỳ...';
    const found = this.timelines.find(t => t.id === this.objective.timeline_id);
    return found ? `${found.title} (${found.level || 'chu kỳ'})` : this.objective.timeline_id;
  }

  get availableParentObjectives(): Objective[] {
    const lvl = (this.objective.level || '').toUpperCase();
    if (lvl === 'TEAM') {
      return this.objectives.filter(o => (o.level || '').toUpperCase() === 'COMPANY');
    }
    if (lvl === 'PERSONAL') {
      return this.objectives.filter(o => (o.level || '').toUpperCase() === 'TEAM' || (o.level || '').toUpperCase() === 'COMPANY');
    }
    return [];
  }

  saveObjective(): void {
    if (!this.objective.title) return alert('Vui lòng nhập Tên Mục tiêu');
    this.saving = true;
    this.okrService.createObjective(this.objective).subscribe({
      next: () => {
        this.router.navigate(['/okr-settings']);
      },
      error: (err) => {
        console.error(err);
        this.saving = false;
        alert('Lưu mục tiêu thất bại: ' + (err.error?.error || err.message));
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/okr-settings']);
  }
}
