import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmDialogService {
  private confirmSubject = new Subject<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>();

  confirmState$ = this.confirmSubject.asObservable();

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmSubject.next({
        options: {
          title: options.title || 'Xác nhận xóa',
          message: options.message,
          confirmText: options.confirmText || 'Xác nhận xóa',
          cancelText: options.cancelText || 'Hủy',
          type: options.type || 'danger'
        },
        resolve
      });
    });
  }

  close(): void {
    this.confirmSubject.next(null);
  }
}

