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
    this.oauthService.configure(authConfig);
    await this.oauthService.loadDiscoveryDocument().catch(() => {
      // Fallback for Azure AD
      console.log('Discovery document failed, using static config');
    });

    // Try to restore the token if the user is already logged in
    await this.oauthService.tryLoginCodeFlow().catch(() => {
      console.log('No valid session found');
    });

    this.isAuthenticated$.next(this.oauthService.hasValidAccessToken());
    
    if (this.hasValidToken()) {
      await this.loadUserInfo().toPromise();
    }
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
