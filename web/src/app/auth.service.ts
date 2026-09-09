import { Injectable, signal } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { authConfig } from './auth-config';

export interface UserInfo {
  name: string;
  email: string;
  id: string;
  groups: string[];
}

export interface DbUser {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly userInfoSignal = signal<UserInfo | null>(null);
  private readonly isAuthenticatedSignal = signal<boolean>(false);
  private readonly isInitializingSignal = signal<boolean>(true);
  private readonly dbUsersSignal = signal<DbUser[] | null>(null);
  private readonly dbUsersErrorSignal = signal<string | null>(null);

  readonly isAuthenticated = this.isAuthenticatedSignal.asReadonly();
  readonly userInfo = this.userInfoSignal.asReadonly();
  readonly isInitializing = this.isInitializingSignal.asReadonly();
  readonly dbUsers = this.dbUsersSignal.asReadonly();
  readonly dbUsersError = this.dbUsersErrorSignal.asReadonly();

  constructor(private oauthService: OAuthService) {}

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
      } catch (error) {
        console.error('❌ Discovery document load failed:', error);
      }

      // Try to restore token from callback
      try {
        if (this.isCodeInUrl()) {
          console.log('🔄 Code found in URL, attempting to complete login flow');
          await this.oauthService.tryLoginCodeFlow();
          console.log('✓ Successfully logged in from callback');
        }
      } catch (error) {
        console.warn('Code flow login failed:', error);
      }

      this.isAuthenticatedSignal.set(this.oauthService.hasValidAccessToken());

      if (this.hasValidToken()) {
        this.userInfoSignal.set(this.extractUserInfo());
        await this.loadDbUsers();
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
    } finally {
      this.isInitializingSignal.set(false);
    }
  }

  private async loadDbUsers(): Promise<void> {
    try {
      const response = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${this.oauthService.getAccessToken()}` },
      });
      if (!response.ok) {
        throw new Error(`/api/users returned ${response.status}`);
      }
      this.dbUsersSignal.set(await response.json());
      this.dbUsersErrorSignal.set(null);
    } catch (error) {
      console.error('Failed to load users from database:', error);
      this.dbUsersErrorSignal.set('Could not load users from the database.');
    }
  }

  private isCodeInUrl(): boolean {
    return window.location.search.includes('code=') ||
           window.location.hash.includes('code=');
  }

  async login(): Promise<void> {
    try {
      console.log('🔐 AuthService.login() called');

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
      this.oauthService.initCodeFlow();
      console.log('✓ initCodeFlow() called - redirect should happen now');
    } catch (error) {
      console.error('❌ Login failed with exception:', error);
      throw error;
    }
  }

  logout(): void {
    this.oauthService.logOut();
    this.userInfoSignal.set(null);
    this.isAuthenticatedSignal.set(false);
    this.dbUsersSignal.set(null);
    this.dbUsersErrorSignal.set(null);
  }

  hasValidToken(): boolean {
    return this.oauthService.hasValidAccessToken();
  }

  private extractUserInfo(): UserInfo {
    const claims: any = this.oauthService.getIdentityClaims() ?? {};
    return {
      name: claims['name'] ?? '',
      email: claims['preferred_username'] ?? claims['email'] ?? '',
      id: claims['sub'] ?? claims['oid'] ?? '',
      groups: claims['groups'] ?? [],
    };
  }
}
