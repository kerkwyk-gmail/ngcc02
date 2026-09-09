import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding: 2rem; font-family: sans-serif;">
      <div *ngIf="authService.isInitializing()" style="text-align: center;">
        <p>Checking authentication...</p>
      </div>

      <div *ngIf="!authService.isInitializing() && !authService.isAuthenticated()">
        <h1>Authentication Required</h1>
        <button
          (click)="login()"
          style="padding: 0.75rem 1.5rem; font-size: 1rem; cursor: pointer; background: #007bff; color: white; border: 2px solid blue;">
          Login with Entra ID
        </button>
      </div>

      <div *ngIf="!authService.isInitializing() && authService.isAuthenticated()">
        <ng-container *ngIf="authService.userInfo() as userInfo">
          <h1>Welcome, {{ userInfo.name }}!</h1>
          <div style="margin: 2rem 0; padding: 1rem; background: #f0f0f0; border-radius: 0.5rem;">
            <p><strong>Email:</strong> {{ userInfo.email }}</p>
            <p><strong>User ID:</strong> {{ userInfo.id }}</p>
          </div>

          <div style="margin: 2rem 0;">
            <h2>Group Memberships</h2>
            <div *ngIf="userInfo.groups && userInfo.groups.length > 0">
              <ul style="list-style-position: inside;">
                <li *ngFor="let group of userInfo.groups" style="padding: 0.5rem 0;">
                  {{ group }}
                </li>
              </ul>
            </div>
            <p *ngIf="!userInfo.groups || userInfo.groups.length === 0" style="color: #666;">
              No groups assigned
            </p>
          </div>

          <button (click)="logout()" style="padding: 0.75rem 1.5rem; font-size: 1rem; cursor: pointer; background: #dc3545; color: white; border: none; border-radius: 0.25rem;">
            Logout
          </button>
        </ng-container>
      </div>
    </div>
  `,
})
export class AuthComponent {
  constructor(protected authService: AuthService, private router: Router) {}

  login(): void {
    this.authService.login().catch((error) => {
      console.error('❌ Login rejected with error:', error);
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth']);
  }
}
