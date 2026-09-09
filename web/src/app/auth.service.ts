import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { OAuthService } from 'angular-oauth2-oidc';
import { authConfig } from './auth-config';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface UserInfo {
  name: string;
  email: string;
  id: string;
  groups: string[];
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private userInfo$ = new BehaviorSubject<UserInfo | null>(null);
  private isAuthenticated$ = new BehaviorSubject<boolean>(false);

  constructor(private oauthService: OAuthService, private http: HttpClient) {}

  async initAuth(): Promise<void> {
    try {
      this.oauthService.configure(authConfig);
      
      // Try to load discovery document, but don't fail if it doesn't work
      try {
        await this.oauthService.loadDiscoveryDocument();
      } catch (error) {
        console.warn('Discovery document failed, continuing without it:', error);
      }

      // Try to restore token from callback
      try {
        if (this.isCodeInUrl()) {
          await this.oauthService.tryLoginCodeFlow();
        }
      } catch (error) {
        console.warn('Code flow login failed:', error);
      }

      this.isAuthenticated$.next(this.oauthService.hasValidAccessToken());
      
      if (this.hasValidToken()) {
        try {
          await this.loadUserInfo().toPromise();
        } catch (error) {
          console.error('Failed to load user info:', error);
        }
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      // Don't throw - app should still work without auth
    }
  }

  private isCodeInUrl(): boolean {
    return window.location.search.includes('code=') || 
           window.location.hash.includes('code=');
  }

  login(): void {
    this.oauthService.initCodeFlow();
  }

  logout(): void {
    this.oauthService.logOut();
    this.userInfo$.next(null);
    this.isAuthenticated$.next(false);
  }

  hasValidToken(): boolean {
    return this.oauthService.hasValidAccessToken();
  }

  getIsAuthenticated(): Observable<boolean> {
    return this.isAuthenticated$.asObservable();
  }

  getUserInfo(): Observable<UserInfo | null> {
    return this.userInfo$.asObservable();
  }

  private loadUserInfo(): Observable<UserInfo> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.oauthService.getAccessToken()}`,
    });

    return this.http.get<UserInfo>('/api/auth/user', { headers }).pipe(
      tap((userInfo) => {
        this.userInfo$.next(userInfo);
        this.isAuthenticated$.next(true);
      })
    );
  }

  refreshUserInfo(): Observable<UserInfo> {
    return this.loadUserInfo();
  }
}
