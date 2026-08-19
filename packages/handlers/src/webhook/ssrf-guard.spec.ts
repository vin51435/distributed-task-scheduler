import { validateWebhookUrl, SsrfBlockedError } from './ssrf-guard';

describe('SSRF Guard', () => {
  it('should allow valid public HTTPS and HTTP URLs', async () => {
    await expect(validateWebhookUrl('https://httpbin.org/post')).resolves.toBeDefined();
    await expect(validateWebhookUrl('https://api.github.com/events')).resolves.toBeDefined();
    await expect(validateWebhookUrl('http://example.com/webhook')).resolves.toBeDefined();
  });

  it('should block non-http protocols (file://, ftp://, gopher://)', async () => {
    await expect(validateWebhookUrl('file:///etc/passwd')).rejects.toThrow(SsrfBlockedError);
    await expect(validateWebhookUrl('ftp://example.com')).rejects.toThrow(SsrfBlockedError);
    await expect(validateWebhookUrl('gopher://127.0.0.1:6379')).rejects.toThrow(SsrfBlockedError);
  });

  it('should block localhost and loopback addresses', async () => {
    await expect(validateWebhookUrl('http://localhost:5432')).rejects.toThrow(SsrfBlockedError);
    await expect(validateWebhookUrl('http://127.0.0.1:8080')).rejects.toThrow(SsrfBlockedError);
    await expect(validateWebhookUrl('http://127.0.1.1:3000')).rejects.toThrow(SsrfBlockedError);
    await expect(validateWebhookUrl('http://[::1]:3000')).rejects.toThrow(SsrfBlockedError);
  });

  it('should block AWS/GCP cloud metadata endpoint (169.254.169.254)', async () => {
    await expect(validateWebhookUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
      SsrfBlockedError,
    );
  });

  it('should block RFC 1918 private subnets (10.x, 172.16.x, 192.168.x)', async () => {
    await expect(validateWebhookUrl('http://10.0.0.1/admin')).rejects.toThrow(SsrfBlockedError);
    await expect(validateWebhookUrl('http://172.16.0.5:5432')).rejects.toThrow(SsrfBlockedError);
    await expect(validateWebhookUrl('http://192.168.1.1:80')).rejects.toThrow(SsrfBlockedError);
  });

  it('should block CGNAT and documentation IPs', async () => {
    await expect(validateWebhookUrl('http://100.64.0.1')).rejects.toThrow(SsrfBlockedError);
    await expect(validateWebhookUrl('http://192.0.2.1')).rejects.toThrow(SsrfBlockedError);
  });
});
