import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { OAuthModule } from 'angular-oauth2-oidc';
import { AuthService } from './auth.service';

@Component({
  imports: [RouterOutlet, RouterLink, HttpClientModule, OAuthModule],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected readonly title = signal('World');

  constructor(private authService: AuthService) {}

  async ngOnInit(): Promise<void> {
    await this.authService.initAuth();
  }
}
