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

  constructor(
    private oauthService: OAuthService,
    private http: HttpClient
  ) {}

  async initAuth(): Promise<void> {
    try {
      console.log('🔐 AuthService.initAuth() called');
      this.oauthService.configure(authConfig);
      console.log('✓ Configured OAuthService with issuer:', authConfig.issuer);
      
      // Load discovery document immediately
      try {
        console.log('📋 Loading discovery document...');
        await this.oauthService.loadDiscoveryDocument();
        console.log('✓ Discovery document loaded successfully');
        console.log('  - Auth endpoint:', this.oauthService.authorizationEndpoint);
        console.log('  - Token endpoint:', this.oauthService.tokenEndpoint);
      } catch (error) {
        console.error('❌ Discovery document load failed:', error);
      }

      // Try to restore token from callback
      try {
        if (this.isCodeInUrl()) {
          console.log('🔄 Code found in URL, attempting to complete login flow');
          await this.oauthService.tryLoginCodeFlow();
          this.isAuthenticated$.next(true);
          console.log('✓ Successfully logged in from callback');
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
    }
  }

  private isCodeInUrl(): boolean {
    return window.location.search.includes('code=') || 
           window.location.hash.includes('code=');
  }

  async login(): Promise<void> {
    try {
      console.log('🔐 AuthService.login() called');
      console.log('✓ OAuthService exists?', !!this.oauthService);
      console.log('Discovery doc loaded?', this.oauthService.discoveryDocumentLoaded);
      console.log('Authorization endpoint:', this.oauthService.authorizationEndpoint);
      
      // Ensure discovery document is loaded
      if (!this.oauthService.discoveryDocumentLoaded) {
        console.log('⏳ Loading discovery document before login...');
        try {
          await this.oauthService.loadDiscoveryDocument();
          console.log('✓ Discovery document loaded');
        } catch (error) {
          console.error('❌ Failed to load discovery document:', error);
          return;
        }
      }
      
      console.log('🚀 About to call initCodeFlow()...');
      console.log('  - authorizationEndpoint:', this.oauthService.authorizationEndpoint);
      console.log('  - clientId:', this.oauthService.clientId);
      console.log('  - redirectUri:', this.oauthService.redirectUri);
      
      this.oauthService.initCodeFlow();
      
      console.log('✓ initCodeFlow() called - redirect should happen now');
    } catch (error) {
      console.error('❌ Login failed with exception:', error);
      throw error;
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
