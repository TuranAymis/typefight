import { describe, expect, it } from 'vitest';
import app from './index';

describe('api smoke', () => {
  it('GET /health returns ok', async () => {
    const response = await app.request('/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});
