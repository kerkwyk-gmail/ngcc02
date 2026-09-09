import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  imports: [RouterOutlet, RouterLink],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected readonly title = signal('World');

  constructor(private authService: AuthService) {}

  async ngOnInit(): Promise<void> {
    try {
      await this.authService.initAuth();
    } catch (error) {
      console.error('Auth initialization failed:', error);
    }
  }
}
