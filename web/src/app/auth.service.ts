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
      console.log('Initializing auth...');
      this.oauthService.configure(authConfig);
      console.log('Auth configured');
      
      // Try to load discovery document
      try {
        console.log('Loading discovery document...');
        await this.oauthService.loadDiscoveryDocument();
        console.log('Discovery document loaded successfully');
      } catch (error) {
        console.error('Discovery document load failed:', error);
      }

      // Try to restore token from callback
      try {
        if (this.isCodeInUrl()) {
          console.log('Code found in URL, attempting to complete login flow');
          await this.oauthService.tryLoginCodeFlow();
        }
      } catch (error) {
        console.warn('Code flow login failed:', error);
      }

      this.isAuthenticated$.next(this.oauthService.hasValidAccessToken());
      console.log('Authenticated:', this.oauthService.hasValidAccessToken());
      
      if (this.hasValidToken()) {
        try {
          await this.loadUserInfo().toPromise();
        } catch (error) {
          console.error('Failed to load user info:', error);
        }
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
    }
  }

  private isCodeInUrl(): boolean {
    return window.location.search.includes('code=') || 
           window.location.hash.includes('code=');
  }

  login(): void {
    console.log('Login clicked');
    console.log('Discovery doc loaded:', this.oauthService.discoveryDocumentLoaded);
    
    if (!this.oauthService.discoveryDocumentLoaded) {
      console.warn('Discovery document not loaded, loading now...');
      this.oauthService.loadDiscoveryDocument().then(() => {
        console.log('Discovery document loaded, initiating code flow');
        this.oauthService.initCodeFlow();
      }).catch((error) => {
        console.error('Failed to load discovery document:', error);
      });
    } else {
      console.log('Initiating code flow...');
      this.oauthService.initCodeFlow();
    }
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
