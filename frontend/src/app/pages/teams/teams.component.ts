import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OkrService, Team } from '../../services/okr.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teams.component.html',
  styleUrls: ['./teams.component.css']
})
export class TeamsComponent implements OnInit {
  teams: Team[] = [];
  showModal = false;
  isEditing = false;
  loading = true;
  searchQuery = '';
  
  newTeam: Partial<Team> = {
    name: '',
    code: ''
  };

  get filteredTeams(): Team[] {
    if (!this.searchQuery.trim()) return this.teams;
    const q = this.searchQuery.toLowerCase().trim();
    return this.teams.filter(t => 
      (t.name && t.name.toLowerCase().includes(q)) || 
      (t.code && t.code.toLowerCase().includes(q))
    );
  }

  isSaving = false;
  activeDropdownId: string | null = null;
  isDropup = false;

  constructor(private okrService: OkrService, private confirmService: ConfirmDialogService) {}

  ngOnInit(): void {
    this.loadTeams();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
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

  loadTeams(): void {
    this.loading = true;
    this.okrService.getTeams().subscribe({
      next: (data) => {
        this.teams = data || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading teams:', err);
        this.loading = false;
      }
    });
  }

  openCreateModal(): void {
    this.newTeam = { name: '', code: '' };
    this.isEditing = false;
    this.isSaving = false;
    this.showModal = true;
  }

  editTeam(team: Team): void {
    this.newTeam = { ...team };
    this.isEditing = true;
    this.isSaving = false;
    this.showModal = true;
  }

  async deleteTeam(team: Team): Promise<void> {
    const id = team.id || team.code;
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận xóa Team',
      message: `Bạn có chắc chắn muốn xóa team "${team.name}" không? Thao tác này sẽ xóa vĩnh viễn khỏi hệ thống.`,
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.okrService.deleteTeam(id).subscribe({
      next: () => {
        this.teams = this.teams.filter(t => (t.id || t.code) !== id);
      },
      error: (err) => {
        this.confirmService.confirm({
          title: 'Lỗi khi xóa Team',
          message: err.error?.error || err.message || 'Không thể xóa Team này.',
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

  saveTeam(): void {
    if (this.isSaving) return;
    if (!this.newTeam.name || !this.newTeam.name.trim()) {
      alert('Vui lòng nhập Tên Team!');
      return;
    }
    
    const teamId = (this.newTeam.id || this.newTeam.code || '').trim();
    const payload: Partial<Team> = {
      name: this.newTeam.name.trim(),
      code: (this.newTeam.code && this.newTeam.code.trim()) ? this.newTeam.code.trim() : (teamId || this.newTeam.name.trim().toUpperCase().replace(/\s+/g, '-'))
    };

    this.isSaving = true;
    if (this.isEditing && teamId) {
      this.okrService.updateTeam(teamId, payload).subscribe({
        next: () => {
          this.isSaving = false;
          this.closeModal();
          this.loadTeams();
        },
        error: (err) => {
          this.isSaving = false;
          console.error('Error updating team:', err);
          alert('Lỗi khi cập nhật Team: ' + (err.error?.error || err.message));
        }
      });
    } else {
      this.okrService.createTeam(payload).subscribe({
        next: () => {
          this.isSaving = false;
          this.closeModal();
          this.loadTeams();
        },
        error: (err) => {
          this.isSaving = false;
          console.error('Error saving team:', err);
          alert('Lỗi khi lưu Team: ' + (err.error?.error || err.message));
        }
      });
    }
  }
}
