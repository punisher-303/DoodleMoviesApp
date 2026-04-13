import 'react-native-url-polyfill/auto';
import {SupabaseClient, User as SupabaseUser} from '@supabase/supabase-js';
import {MMKV} from 'react-native-mmkv';
import {supabase} from './supabaseClient';
import {cloudSyncService} from './CloudSyncService';
import {storageService} from '../storage/StorageService';

// MMKV key used to store the user's custom profile photo (base64 data URI)
const PROFILE_PHOTO_KEY = 'user_profile_photo';

export interface User {
  id: string;
  email: string;
  name: string;
  photo?: string;
}

class UserSession {
  private static instance: UserSession;
  private readonly supabase: SupabaseClient = supabase;
  private readonly sessionStorage = new MMKV({id: 'user-session'});
  private currentUser: User | null = null;

  private constructor() {
    this._restoreSession();
  }

  static getInstance(): UserSession {
    if (!UserSession.instance) {
      UserSession.instance = new UserSession();
    }
    return UserSession.instance;
  }

  private _mapSupabaseUser(su: SupabaseUser): User {
    return {
      id: su.id,
      email: su.email ?? '',
      name:
        su.user_metadata?.full_name ??
        su.user_metadata?.name ??
        (su.email ?? '').split('@')[0],
      photo: su.user_metadata?.avatar_url ?? undefined,
    };
  }

  private _restoreSession(): void {
    try {
      const userJson = this.sessionStorage.getString('currentUser');
        this.currentUser = JSON.parse(userJson) as User;
        console.log('[UserSession] Session restored for:', this.currentUser.email);
        
        // Swap MMKV partition to user-scoped storage immediately
        storageService.setCurrentUser(this.currentUser.id);
        
        // Sync data on restore
        cloudSyncService.pullUserData(this.currentUser.id).catch(() => {});
    } catch (e) {
      console.error('[UserSession] Failed to restore session:', e);
      this.currentUser = null;
    }
  }

  private async _finaliseLogin(user: User): Promise<User> {
    this.currentUser = user;
    this.sessionStorage.set('currentUser', JSON.stringify(user));
    
    // Swap MMKV partition to user-scoped storage
    storageService.setCurrentUser(user.id);

    await cloudSyncService.pullUserData(user.id);
    
    // Save profile info to Supabase profiles table if needed
    cloudSyncService
      .saveUserProfile(user.id, {email: user.email, name: user.name, photo: user.photo})
      .catch(() => {});
      
    return user;
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  async signUp(email: string, password: string): Promise<User> {
    const {data, error} = await this.supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(error.message);
    if (!data.session && data.user) {
        // Handle auto-signin if confirmed
        try {
            return await this.signInWithEmail(email, password);
        } catch (_) {
            throw new Error('Please check your email to confirm your account.');
        }
    }
    if (!data.user) throw new Error('Sign up failed.');
    return this._finaliseLogin(this._mapSupabaseUser(data.user));
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    const {data, error} = await this.supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Sign in failed.');
    return this._finaliseLogin(this._mapSupabaseUser(data.user));
  }

  async sendPasswordReset(email: string): Promise<void> {
    const {error} = await this.supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
    );
    if (error) throw new Error(error.message);
  }

  async signOut(): Promise<void> {
    if (this.currentUser) {
      await cloudSyncService.pushUserData(this.currentUser.id).catch(() => {});
    }
    await this.supabase.auth.signOut().catch(() => {});
    this.currentUser = null;
    this.sessionStorage.delete('currentUser');
    
    // Reset MMKV partition to guest storage
    storageService.setCurrentUser(null);
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isLoggedIn(): boolean {
    return this.currentUser !== null;
  }
}

export const userSession = UserSession.getInstance();
