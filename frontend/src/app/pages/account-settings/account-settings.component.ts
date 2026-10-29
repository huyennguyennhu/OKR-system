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
  loading = false;
  isSaving = false;
  activeDropdownId: string | null = null;
  isDropup = false;
  searchQuery = '';
  selectedTeam = 'all';
  isTeamDropdownOpen = false;
  
  newEmployee: any = {
    employee_id: '',
    full_name: '',
    email: '',
    team_id: '',
    role: ''
  };

  get filteredEmployees(): any[] {
    return this.employees.filter(emp => {
      const matchSearch = !this.searchQuery.trim() || 
        (emp.full_name && emp.full_name.toLowerCase().includes(this.searchQuery.toLowerCase().trim())) ||
        (emp.employee_id && emp.employee_id.toLowerCase().includes(this.searchQuery.toLowerCase().trim())) ||
        (emp.gitlab_user_id && emp.gitlab_user_id.toLowerCase().includes(this.searchQuery.toLowerCase().trim()));
      
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
  }

  toggleTeamDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isTeamDropdownOpen = !this.isTeamDropdownOpen;
  }

  selectTeam(teamId: string): void {
    this.selectedTeam = teamId;
    this.isTeamDropdownOpen = false;
  }

  getSelectedTeamLabel(): string {
    if (this.selectedTeam === 'all') return 'Tất cả Team';
    const found = this.teams.find(t => t.id === this.selectedTeam || t.code === this.selectedTeam);
    return found ? found.name : this.selectedTeam;
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
    const randomId = Math.floor(1000 + Math.random() * 9000);
    this.newEmployee = {
      employee_id: `EMP-${randomId}`,
      full_name: '',
      email: '',
      team_id: '',
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
      email: emp.gitlab_user_id || emp.email,
      team_id: emp.team_id,
      role: emp.display_code || emp.role
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
      error: (err) => alert('Lỗi khi xóa nhân viên: ' + (err.error?.error || err.message))
    });
  }

  closeModal(): void {
    if (this.isSaving) return;
    this.showModal = false;
  }

  saveEmployee(): void {
    if (this.isSaving) return;
    if (!this.newEmployee.employee_id || !this.newEmployee.full_name || !this.newEmployee.email || !this.newEmployee.team_id || !this.newEmployee.role) {
      alert('Vui lòng điền đầy đủ các trường bắt buộc!');
      return;
    }
    
    this.isSaving = true;
    const payload = {
      ...this.newEmployee,
      gitlab_user_id: this.newEmployee.email,
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
