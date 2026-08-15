import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantStore {
  tenantId: string;
  userId?: string;
  correlationId?: string;
}

@Injectable()
export class TenantContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<TenantStore>();

  /**
   * Sets the tenant context for the duration of the callback.
   */
  public runWithContext<T>(store: TenantStore, callback: () => T): T {
    return this.asyncLocalStorage.run(store, callback);
  }

  /**
   * Retrieves the current tenantId from async local storage.
   */
  public getTenantId(): string | undefined {
    return this.asyncLocalStorage.getStore()?.tenantId;
  }

  /**
   * Retrieves current store.
   */
  public getStore(): TenantStore | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Enforces tenant ID presence; throws if missing.
   */
  public getRequiredTenantId(): string {
    const tenantId = this.getTenantId();
    if (!tenantId) {
      throw new Error(
        'Tenant context is required but was not found in the current execution scope',
      );
    }
    return tenantId;
  }
}
