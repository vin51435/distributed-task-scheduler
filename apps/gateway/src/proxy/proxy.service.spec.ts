import { ProxyService } from './proxy.service';

describe('ProxyService', () => {
  let proxyService: ProxyService;

  beforeEach(() => {
    proxyService = new ProxyService();
  });

  it('should route auth and identity endpoints to identity service', () => {
    expect(proxyService.resolveTargetUrl('/api/auth/login')).toContain('3001');
    expect(proxyService.resolveTargetUrl('/api/tenants/current')).toContain('3001');
    expect(proxyService.resolveTargetUrl('/api/roles')).toContain('3001');
    expect(proxyService.resolveTargetUrl('/api/api-keys')).toContain('3001');
  });

  it('should route scheduler and admin endpoints to scheduler service', () => {
    expect(proxyService.resolveTargetUrl('/api/schedules')).toContain('3002');
    expect(proxyService.resolveTargetUrl('/api/jobs/search')).toContain('3002');
    expect(proxyService.resolveTargetUrl('/api/admin/metrics')).toContain('3002');
  });
});
