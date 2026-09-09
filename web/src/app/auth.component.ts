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

          <div style="margin: 2rem 0;">
            <h2>Users (from database)</h2>
            <p *ngIf="authService.dbUsersError() as error" style="color: #dc3545;">{{ error }}</p>
            <p *ngIf="!authService.dbUsersError() && authService.dbUsers() === null" style="color: #666;">
              Loading...
            </p>
            <table *ngIf="authService.dbUsers() as dbUsers" style="border-collapse: collapse; width: 100%;">
              <thead>
                <tr>
                  <th style="text-align: left; border-bottom: 1px solid #ccc; padding: 0.5rem;">ID</th>
                  <th style="text-align: left; border-bottom: 1px solid #ccc; padding: 0.5rem;">Name</th>
                  <th style="text-align: left; border-bottom: 1px solid #ccc; padding: 0.5rem;">Email</th>
                  <th style="text-align: left; border-bottom: 1px solid #ccc; padding: 0.5rem;">Created</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let dbUser of dbUsers">
                  <td style="padding: 0.5rem; border-bottom: 1px solid #eee;">{{ dbUser.id }}</td>
                  <td style="padding: 0.5rem; border-bottom: 1px solid #eee;">{{ dbUser.name }}</td>
                  <td style="padding: 0.5rem; border-bottom: 1px solid #eee;">{{ dbUser.email }}</td>
                  <td style="padding: 0.5rem; border-bottom: 1px solid #eee;">{{ dbUser.createdAt | date: 'medium' }}</td>
                </tr>
              </tbody>
            </table>
            <p *ngIf="authService.dbUsers() as dbUsers" [hidden]="dbUsers.length > 0" style="color: #666;">
              No users in the database
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
