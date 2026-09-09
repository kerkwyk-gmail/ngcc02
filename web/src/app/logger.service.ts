import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  private queue: string[] = [];
  private flushInterval: any;

  constructor(private http: HttpClient) {
    // Flush logs every 2 seconds
    this.flushInterval = setInterval(() => this.flush(), 2000);
  }

  log(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry);
    this.queue.push(logEntry);
    
    // Flush immediately if queue gets large
    if (this.queue.length >= 10) {
      this.flush();
    }
  }

  error(message: string, error?: any): void {
    const timestamp = new Date().toISOString();
    const errorStr = error ? ` ${JSON.stringify(error)}` : '';
    const logEntry = `[${timestamp}] ERROR: ${message}${errorStr}`;
    console.error(logEntry);
    this.queue.push(logEntry);
    this.flush(); // Flush errors immediately
  }

  private flush(): void {
    if (this.queue.length === 0) return;

    const logs = this.queue.splice(0, this.queue.length).join('\n');
    this.http.post('/api/logs', logs, { responseType: 'text' }).subscribe({
      error: (err) => console.error('Failed to send logs:', err),
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.flushInterval);
    this.flush();
  }
}
