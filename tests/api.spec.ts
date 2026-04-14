import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
  // Public endpoints
  test('POST /api/register validates input', async ({ request }) => {
    const res = await request.post('/api/register', {
      data: { email: 'bad', password: '123' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('POST /api/register rejects duplicate email', async ({ request }) => {
    const res = await request.post('/api/register', {
      data: { email: 'demo@avishopper.cl', password: 'password123', name: 'Test' },
    });
    // Should fail because demo user already exists
    expect(res.status()).toBe(409);
  });

  // Protected endpoints should return 401 without auth
  const protectedEndpoints = [
    { method: 'GET', url: '/api/users/me' },
    { method: 'GET', url: '/api/shopping-lists' },
    { method: 'GET', url: '/api/products' },
    { method: 'GET', url: '/api/stores' },
    { method: 'GET', url: '/api/budgets' },
    { method: 'GET', url: '/api/alerts' },
    { method: 'GET', url: '/api/nutrition' },
    { method: 'GET', url: '/api/health' },
    { method: 'GET', url: '/api/users/store-accounts' },
  ];

  for (const endpoint of protectedEndpoints) {
    test(`${endpoint.method} ${endpoint.url} returns 401 without auth`, async ({ request }) => {
      const res = await request.get(endpoint.url);
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  }

  // Validation tests
  test('POST /api/register creates new user successfully', async ({ request }) => {
    const unique = `test_${Date.now()}@test.com`;
    const res = await request.post('/api/register', {
      data: { email: unique, password: 'testpassword123', name: 'Test User' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.email).toBe(unique);
    expect(body.data).not.toHaveProperty('password');
  });
});
