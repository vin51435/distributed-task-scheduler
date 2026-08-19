import { TenantContextService } from './tenant-context.service';

describe('TenantContextService', () => {
  let service: TenantContextService;

  beforeEach(() => {
    service = new TenantContextService();
  });

  it('should isolate tenant context within async scope', (done) => {
    service.runWithContext({ tenantId: 'tenant-1' }, () => {
      expect(service.getTenantId()).toBe('tenant-1');
      expect(service.getRequiredTenantId()).toBe('tenant-1');

      setTimeout(() => {
        expect(service.getTenantId()).toBe('tenant-1');
        done();
      }, 10);
    });
  });

  it('should throw error when tenant context is missing', () => {
    expect(() => service.getRequiredTenantId()).toThrow(
      'Tenant context is required but was not found',
    );
  });
});
