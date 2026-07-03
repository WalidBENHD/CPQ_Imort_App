import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'cpq.theme.preference';
  private readonly themeSubject = new BehaviorSubject<ThemeMode>(this.resolveTheme());
  private readonly preferenceSubject = new BehaviorSubject<ThemePreference>(this.resolvePreference());
  private mediaQuery: MediaQueryList | null = null;
  private mediaQueryHandler: ((event: MediaQueryListEvent) => void) | null = null;

  readonly theme$ = this.themeSubject.asObservable();
  readonly preference$ = this.preferenceSubject.asObservable();

  get currentTheme(): ThemeMode {
    return this.themeSubject.value;
  }

  get preference(): ThemePreference {
    return this.preferenceSubject.value;
  }

  initialize(): void {
    this.applyTheme(this.themeSubject.value);

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    if (this.preferenceSubject.value === 'system') {
      this.mediaQueryHandler = (event: MediaQueryListEvent) => {
        this.setTheme(event.matches ? 'dark' : 'light', false);
      };

      if (typeof this.mediaQuery.addEventListener === 'function') {
        this.mediaQuery.addEventListener('change', this.mediaQueryHandler);
      }
      else {
        this.mediaQuery.addListener(this.mediaQueryHandler);
      }
    }
  }

  toggleTheme(): void {
    this.setTheme(this.currentTheme === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: ThemeMode, persist = true): void {
    this.preferenceSubject.next(theme);
    this.themeSubject.next(theme);

    if (persist && typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, theme);
    }

    if (persist && this.mediaQuery && this.mediaQueryHandler) {
      if (typeof this.mediaQuery.removeEventListener === 'function') {
        this.mediaQuery.removeEventListener('change', this.mediaQueryHandler);
      }
      else {
        this.mediaQuery.removeListener(this.mediaQueryHandler);
      }

      this.mediaQueryHandler = null;
    }

    this.applyTheme(theme);
  }

  private resolvePreference(): ThemePreference {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return 'system';
    }

    const stored = localStorage.getItem(this.storageKey);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }

    return 'system';
  }

  private resolveTheme(): ThemeMode {
    const preference = this.resolvePreference();
    if (preference === 'light' || preference === 'dark') {
      return preference;
    }

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    return 'light';
  }

  private applyTheme(theme: ThemeMode): void {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    root.classList.toggle('theme-dark', theme === 'dark');
    root.classList.toggle('theme-light', theme === 'light');
    root.dataset['theme'] = theme;
  }
}