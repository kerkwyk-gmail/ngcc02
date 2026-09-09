import { Routes } from '@angular/router';
import { AuthComponent } from './auth.component';

export const routes: Routes = [
  { path: 'auth', component: AuthComponent },
  { path: 'callback', component: AuthComponent },
];
