import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OkrService, Role } from '../../services/okr.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './roles.component.html',
  styleUrls: ['./roles.component.css']
})
export class RolesComponent implements OnInit {
  roles: Role[] = [];
  showModal = false;
  isEditing = false;
  loading = false;
  searchQuery = '';

  newRole: Partial<Role> = {
    name: '',
    code: '',
    description: ''
  };

  get filteredRoles(): Role[] {
    if (!this.searchQuery.trim()) return this.roles;
    const q = this.searchQuery.toLowerCase().trim();
    return this.roles.filter(r =>
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.code && r.code.toLowerCase().includes(q)) ||
      (r.description && r.description.toLowerCase().includes(q))
    );
  }

  isSaving = false;
  activeDropdownId: string | null = null;
  isDropup = false;

  constructor(private okrService: OkrService, private confirmService: ConfirmDialogService) {}

  ngOnInit(): void {
    this.loadRoles();
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

  loadRoles(): void {
    this.loading = true;
    this.okrService.getRoles().subscribe({
      next: (data) => {
        this.roles = data || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading roles:', err);
        this.loading = false;
      }
    });
  }

  openCreateModal(): void {
    this.newRole = { name: '', code: '', description: '' };
    this.isEditing = false;
    this.isSaving = false;
    this.showModal = true;
  }

  editRole(role: Role): void {
    this.newRole = { ...role };
    this.isEditing = true;
    this.isSaving = false;
    this.showModal = true;
  }

  async deleteRole(role: Role): Promise<void> {
    const id = role.id || role.code;
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận xóa Role',
      message: `Bạn có chắc chắn muốn xóa vai trò "${role.name}" (${role.code}) không? Thao tác này sẽ xóa vĩnh viễn khỏi hệ thống.`,
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.okrService.deleteRole(id).subscribe({
      next: () => {
        this.roles = this.roles.filter(r => (r.id || r.code) !== id);
      },
      error: (err) => {
        console.error('Error deleting role:', err);
      }
    });
  }

  closeModal(): void {
    if (this.isSaving) return;
    this.showModal = false;
  }

  saveRole(): void {
    if (this.isSaving) return;
    if (!this.newRole.name || !this.newRole.name.trim()) {
      return;
    }

    const roleId = (this.newRole.id || '').trim();
    const payload: Partial<Role> = {
      name: this.newRole.name.trim(),
      code: (this.newRole.code && this.newRole.code.trim())
        ? this.newRole.code.trim().toUpperCase()
        : this.newRole.name.trim().toUpperCase().replace(/\s+/g, '_'),
      description: this.newRole.description ? this.newRole.description.trim() : ''
    };

    this.isSaving = true;
    if (this.isEditing && roleId) {
      this.okrService.updateRole(roleId, payload).subscribe({
        next: () => {
          this.isSaving = false;
          this.closeModal();
          this.loadRoles();
        },
        error: (err) => {
          this.isSaving = false;
          console.error('Error updating role:', err);
        }
      });
    } else {
      this.okrService.createRole(payload).subscribe({
        next: () => {
          this.isSaving = false;
          this.closeModal();
          this.loadRoles();
        },
        error: (err) => {
          this.isSaving = false;
          console.error('Error saving role:', err);
        }
      });
    }
  }
}

