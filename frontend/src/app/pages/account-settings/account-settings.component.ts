import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OkrService, Team } from '../../services/okr.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './account-settings.component.html',
  styleUrls: ['./account-settings.component.css']
})
export class AccountSettingsComponent implements OnInit {
  employees: any[] = [];
  teams: Team[] = [];
  showModal = false;
  isEditing = false;
  loading = true;
  isSaving = false;
  activeDropdownId: string | null = null;
  isDropup = false;
  searchQuery = '';
  selectedTeam = 'all';
  isTeamDropdownOpen = false;
  isModalTeamDropdownOpen = false;
  
  newEmployee: any = {
    employee_id: '',
    full_name: '',
    gitlab_user_id: '',
    email: '',
    team_id: '',
    role: ''
  };

  get filteredEmployees(): any[] {
    return this.employees.filter(emp => {
      const matchSearch = !this.searchQuery.trim() || 
        (emp.full_name && emp.full_name.toLowerCase().includes(this.searchQuery.toLowerCase().trim())) ||
        (emp.employee_id && emp.employee_id.toLowerCase().includes(this.searchQuery.toLowerCase().trim())) ||
        (emp.gitlab_user_id && emp.gitlab_user_id.toLowerCase().includes(this.searchQuery.toLowerCase().trim())) ||
        (emp.email && emp.email.toLowerCase().includes(this.searchQuery.toLowerCase().trim())) ||
        (emp.role && emp.role.toLowerCase().includes(this.searchQuery.toLowerCase().trim()));
      
      const matchTeam = this.selectedTeam === 'all' || emp.team_id === this.selectedTeam;
      return matchSearch && matchTeam;
    });
  }

  constructor(private okrService: OkrService, private confirmService: ConfirmDialogService) {}

  ngOnInit(): void {
    this.loadEmployees();
    this.loadTeams();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.activeDropdownId = null;
    this.isTeamDropdownOpen = false;
    this.isModalTeamDropdownOpen = false;
  }

  toggleTeamDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isTeamDropdownOpen = !this.isTeamDropdownOpen;
  }

  selectTeam(teamId: string): void {
    this.selectedTeam = teamId;
    this.isTeamDropdownOpen = false;
  }

  getTeamName(teamId: string): string {
    if (!teamId) return '—';
    const found = this.teams.find(t => t.id === teamId || t.code === teamId);
    return found ? found.name : teamId;
  }

  getSelectedTeamLabel(): string {
    if (this.selectedTeam === 'all') return 'Tất cả Team';
    const found = this.teams.find(t => t.id === this.selectedTeam || t.code === this.selectedTeam);
    return found ? found.name : this.selectedTeam;
  }

  toggleModalTeamDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isModalTeamDropdownOpen = !this.isModalTeamDropdownOpen;
  }

  selectModalTeam(teamId: string): void {
    this.newEmployee.team_id = teamId;
    this.isModalTeamDropdownOpen = false;
  }

  getModalTeamLabel(): string {
    if (!this.newEmployee.team_id) return 'Chọn Team';
    const found = this.teams.find(t => t.id === this.newEmployee.team_id || t.code === this.newEmployee.team_id);
    return found ? found.name : this.newEmployee.team_id;
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

  loadTeams(): void {
    this.okrService.getTeams().subscribe({
      next: (data) => this.teams = data || [],
      error: (err) => console.error('Error loading teams:', err)
    });
  }

  loadEmployees(): void {
    this.loading = true;
    this.okrService.getEmployees().subscribe({
      next: (data) => {
        this.employees = data || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading employees:', err);
        this.loading = false;
      }
    });
  }

  openCreateModal(): void {
    const nextNum = this.employees.length + 1;
    this.newEmployee = {
      employee_id: `EMP00${nextNum}`,
      full_name: '',
      gitlab_user_id: '',
      email: '',
      team_id: this.teams.length > 0 ? (this.teams[0].id || this.teams[0].code) : 'TEAM-BE',
      role: ''
    };
    this.isEditing = false;
    this.isSaving = false;
    this.showModal = true;
  }

  editEmployee(emp: any): void {
    this.newEmployee = {
      employee_id: emp.employee_id,
      full_name: emp.full_name,
      gitlab_user_id: emp.gitlab_user_id || '',
      email: emp.email || '',
      team_id: emp.team_id,
      role: emp.role || emp.display_code || ''
    };
    this.isEditing = true;
    this.isSaving = false;
    this.showModal = true;
  }

  async deleteEmployee(emp: any): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận xóa Nhân viên',
      message: `Bạn có chắc chắn muốn xóa nhân viên "${emp.full_name}" (${emp.employee_id}) không? Thao tác này sẽ xóa vĩnh viễn khỏi hệ thống.`,
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.okrService.deleteEmployee(emp.employee_id).subscribe({
      next: () => {
        this.employees = this.employees.filter(e => e.employee_id !== emp.employee_id);
      },
      error: (err) => {
        this.confirmService.confirm({
          title: 'Lỗi khi xóa Nhân viên',
          message: err.error?.error || err.message || 'Không thể xóa nhân viên này.',
          confirmText: 'Đóng',
          cancelText: '',
          type: 'danger'
        });
      }
    });
  }

  closeModal(): void {
    if (this.isSaving) return;
    this.showModal = false;
  }

  saveEmployee(): void {
    if (this.isSaving) return;
    if (!this.newEmployee.employee_id || !this.newEmployee.full_name || !this.newEmployee.gitlab_user_id || !this.newEmployee.email || !this.newEmployee.team_id || !this.newEmployee.role) {
      alert('Vui lòng điền đầy đủ các trường bắt buộc!');
      return;
    }
    
    this.isSaving = true;
    const payload = {
      employee_id: this.newEmployee.employee_id,
      full_name: this.newEmployee.full_name,
      gitlab_user_id: this.newEmployee.gitlab_user_id,
      email: this.newEmployee.email,
      team_id: this.newEmployee.team_id,
      role: this.newEmployee.role,
      display_code: this.newEmployee.role
    };

    if (this.isEditing) {
      this.okrService.updateEmployee(this.newEmployee.employee_id, payload).subscribe({
        next: () => {
          this.isSaving = false;
          this.loadEmployees();
          this.closeModal();
        },
        error: (err) => {
          this.isSaving = false;
          console.error('Error updating employee:', err);
          alert('Có lỗi xảy ra khi cập nhật nhân viên: ' + (err.error?.error || err.message));
        }
      });
    } else {
      this.okrService.createEmployee(payload).subscribe({
        next: () => {
          this.isSaving = false;
          this.loadEmployees();
          this.closeModal();
        },
        error: (err) => {
          this.isSaving = false;
          console.error('Error creating employee:', err);
          alert('Có lỗi xảy ra khi tạo nhân viên: ' + (err.error?.error || err.message));
        }
      });
    }
  }
}
