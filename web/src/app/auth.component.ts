import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService, UserInfo } from './auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding: 2rem; font-family: sans-serif;">
      <div *ngIf="!isAuthenticated">
        <h1>Authentication Required</h1>
        <button (click)="login()" style="padding: 0.75rem 1.5rem; font-size: 1rem; cursor: pointer;">
          Login with Entra ID
        </button>
      </div>

      <div *ngIf="isAuthenticated && userInfo">
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
      </div>

      <div *ngIf="isLoading" style="text-align: center;">
        <p>Loading user information...</p>
      </div>
    </div>
  `,
})
export class AuthComponent implements OnInit {
  isAuthenticated = false;
  isLoading = true;
  userInfo: UserInfo | null = null;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.authService.getIsAuthenticated().subscribe((isAuth) => {
      this.isAuthenticated = isAuth;
      this.isLoading = false;
    });

    this.authService.getUserInfo().subscribe((info) => {
      this.userInfo = info;
    });
  }

  login(): void {
    this.authService.login();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
