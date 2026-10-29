import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ConfirmDialogService, ConfirmOptions } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="confirm-overlay" *ngIf="isOpen" (click)="onOverlayClick($event)">
      <div class="confirm-dialog-box" (click)="$event.stopPropagation()">
        <div class="confirm-header">
          <div class="confirm-header-left">
            <div class="confirm-icon-box" [ngClass]="'icon-' + options.type">
              <i class="fa-solid" [ngClass]="getIconClass()"></i>
            </div>
            <h3 class="confirm-title">{{ options.title }}</h3>
          </div>
          <button class="close-btn" type="button" (click)="cancel()" aria-label="Đóng">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="confirm-body">
          <p class="confirm-message">{{ options.message }}</p>
        </div>

        <div class="confirm-footer">
          <button type="button" class="btn btn-secondary" (click)="cancel()">
            {{ options.cancelText }}
          </button>
          <button type="button" class="btn btn-danger" [ngClass]="'btn-' + options.type" (click)="accept()">
            <i class="fa-solid fa-trash-can" *ngIf="options.type === 'danger'"></i>
            {{ options.confirmText }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
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
      width: 440px;
      max-width: 95%;
      border-radius: 12px;
      background: #ffffff;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      overflow: hidden;
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

    .confirm-icon-box.icon-danger {
      background-color: #fee2e2;
      color: #ef4444;
    }

    .confirm-icon-box.icon-warning {
      background-color: #fef3c7;
      color: #f59e0b;
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

    .close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 16px;
      cursor: pointer;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }

    .close-btn:hover {
      background-color: #e2e8f0;
      color: #ef4444;
    }

    .confirm-body {
      padding: 1.5rem;
      background: #ffffff;
    }

    .confirm-message {
      font-size: 13px !important;
      line-height: 1.6 !important;
      color: #475569 !important;
      margin: 0 !important;
    }

    .confirm-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }

    .btn {
      padding: 0.5rem 1.25rem;
      font-size: 13px;
      font-weight: 500;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.15s ease;
    }

    .btn-secondary {
      background-color: #ffffff;
      border: 1px solid #cbd5e1;
      color: #475569;
    }

    .btn-secondary:hover {
      background-color: #f1f5f9;
      color: #1e293b;
    }

    .btn-danger {
      background-color: #ef4444;
      border: 1px solid transparent;
      color: #ffffff;
    }

    .btn-danger:hover {
      background-color: #dc2626;
      box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.25);
    }

    .btn-warning {
      background-color: #f59e0b;
      border: 1px solid transparent;
      color: #ffffff;
    }

    .btn-warning:hover {
      background-color: #d97706;
    }
  `]
})
export class ConfirmDialogComponent implements OnInit, OnDestroy {
  isOpen = false;
  options: ConfirmOptions = {
    title: 'Xác nhận xóa',
    message: '',
    confirmText: 'Xác nhận xóa',
    cancelText: 'Hủy',
    type: 'danger'
  };
  private resolveFn: ((value: boolean) => void) | null = null;
  private sub: Subscription | null = null;

  constructor(private confirmService: ConfirmDialogService) {}

  ngOnInit(): void {
    this.sub = this.confirmService.confirmState$.subscribe(state => {
      if (state) {
        this.options = state.options;
        this.resolveFn = state.resolve;
        this.isOpen = true;
      } else {
        this.isOpen = false;
        this.resolveFn = null;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.sub) {
      this.sub.unsubscribe();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.cancel();
    }
  }

  onOverlayClick(event: MouseEvent): void {
    this.cancel();
  }

  getIconClass(): string {
    switch (this.options.type) {
      case 'danger': return 'fa-triangle-exclamation';
      case 'warning': return 'fa-circle-exclamation';
      default: return 'fa-circle-info';
    }
  }

  accept(): void {
    if (this.resolveFn) {
      this.resolveFn(true);
    }
    this.isOpen = false;
  }

  cancel(): void {
    if (this.resolveFn) {
      this.resolveFn(false);
    }
    this.isOpen = false;
  }
}
