// utils/refreshStore.ts
export type RefreshRecord = {
    jti: string;
    userId: string;
    expiresAt: number; // epoch seconds
    userAgent?: string;
    ip?: string;
  };
  
  export interface IRefreshStore {
    add(rec: RefreshRecord): Promise<void>;
    revoke(jti: string): Promise<void>;
    isActive(jti: string): Promise<boolean>;
    rotate(oldJti: string, next: RefreshRecord): Promise<void>;
  }
  
  /** Default: in-memory (dev/test). Replace with Redis/DB in prod. */
  class MemoryRefreshStore implements IRefreshStore {
    private map = new Map<string, RefreshRecord>();
    async add(rec: RefreshRecord) { this.map.set(rec.jti, rec); }
    async revoke(jti: string) { this.map.delete(jti); }
    async isActive(jti: string) { return this.map.has(jti); }
    async rotate(oldJti: string, next: RefreshRecord) {
      this.map.delete(oldJti);
      this.map.set(next.jti, next);
    }
  }
  
  let store: IRefreshStore = new MemoryRefreshStore();
  export const setRefreshStore = (custom: IRefreshStore) => { store = custom; };
  export const refreshStore = () => store;
  