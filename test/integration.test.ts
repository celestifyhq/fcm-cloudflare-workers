import app from '../fixtures/index'; // Import the Hono app
import { EnhancedFcmMessage, FcmServiceAccount } from '../src';
import { KVNamespace } from '@cloudflare/workers-types';

// Mock service account for testing
const mockServiceAccount: FcmServiceAccount = {
  type: 'service_account',
  project_id: 'test-project-id',
  private_key_id: 'test-private-key-id',
  private_key: 'MIIBVQIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEAwZQtmpY06evzTFXszv9hZqjhV9tzDy0OLaApuaRUzlrclQ6U0vJkL7oa0O/fymYO/KHyxe5kX9cfiKFcsXYpEwIDAQABAkEAhFwYLookFgpCamCaMhNGexZgNl2Tt7274xCPVyL45bri++KTE5J5Kt1FBpvNy11yqQLmu+9gnq1Eig8NMF9TgQIhAPZARc+co0mudTpWas8+A7Bf5YwzGSSSNjeEr+Z1U7NBAiEAyT4T/ISJv22hocHuig94ftSNpdygLGKEseJL8mEPS1MCIHNzcseBgrTazC9LsMv1ITmh3Dc9Bb61piGlXerIezOBAiEAmH1Nr77OkhuEqonFMyBd8d0mKFRxmrBcVF5hphwd9rkCIEgXgZjNYsu7akKA19jz4lKUe66keF+MkQXSFKy4Ybrv',
  client_email: 'test-client-email@example.com',
  client_id: 'test-client-id',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/test-client-email%40example.com',
};

// Mock KV Namespace for testing
const mockKvStore: KVNamespace = {
  get: jest.fn().mockResolvedValue(null), // Default to cache miss
  put: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  list: jest.fn().mockResolvedValue({ keys: [], list_complete: true, cursor: undefined }),
  getWithMetadata: jest.fn().mockResolvedValue({ value: null, metadata: null }),
};

const MOCK_ENV = {
  FIREBASE_PROJECT_ID: mockServiceAccount.project_id,
  FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(mockServiceAccount),
  MY_WORKER_CACHE: mockKvStore,
  // Add any other bindings your fixtures/index.ts or middleware expects from c.env
};

// Global fetch spy for outbound requests from the worker
let outboundFetchSpy: jest.Mock;

describe('FCM Library Hono Integration Tests', () => {
  beforeEach(() => {
    // Reset and redefine the global fetch mock for each test
    outboundFetchSpy = jest.fn(async (url: string, options?: RequestInit): Promise<Response> => {
      console.log('Global fetch call intercepted in Hono test:', url, options?.method);
      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'mock-oauth-token', expires_in: 3600 }), { status: 200 });
      }
      if (url.includes('fcm.googleapis.com/v1/projects')) {
        return new Response(JSON.stringify({ name: `projects/${mockServiceAccount.project_id}/messages/mock-id` }), { status: 200 });
      }
      return new Response('Unexpected outbound call', { status: 500 });
    });
    global.fetch = outboundFetchSpy as any; // Assign to global fetch

    // Reset KV mock calls before each test
    (mockKvStore.get as jest.Mock).mockClear().mockResolvedValue(null);
    (mockKvStore.put as jest.Mock).mockClear().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restore global fetch and other spies
  });

  it('should send a message via /api/v2/push-token successfully', async () => {
    const message: EnhancedFcmMessage = {
      notification: { title: 'Test Title', body: 'Test Body' },
      data: { testKey: 'testValue' },
    };
    const token = 'test-device-token';

    const req = new Request('http://localhost/api/v2/push-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, message }),
    });

    const res = await app.request(req, undefined, MOCK_ENV);

    expect(res.status).toBe(200);
    const responseBody = await res.json();
    expect(responseBody).toEqual({ success: true });

    expect(outboundFetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('oauth2.googleapis.com/token'),
      expect.anything()
    );
    expect(outboundFetchSpy).toHaveBeenCalledWith(
      `https://fcm.googleapis.com/v1/projects/${mockServiceAccount.project_id}/messages:send`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-oauth-token',
        }),
        body: JSON.stringify({ message: { ...message, token } })
      })
    );

    // Optionally, verify KV interactions if token caching is active and being tested
    // For example, expect(mockKvStore.put).toHaveBeenCalledWith("fcm-token-cache", "mock-oauth-token", { expirationTtl: 3540 });
  });

  // Example for an endpoint that returns unregistered tokens, like /api/v2/push-tokens
  it('should handle unregistered tokens via /api/v2/push-tokens', async () => {
    const message: EnhancedFcmMessage = { notification: { title: 'Batch Test', body: 'Batch Body' } };
    const tokens = ['valid-token', 'unregistered-token', 'another-valid-token'];

    // Adjust global fetch mock for this specific test to return an unregistered error for one token
    outboundFetchSpy.mockImplementation(async (url: string, options?: RequestInit): Promise<Response> => {
      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'mock-oauth-token', expires_in: 3600 }), { status: 200 });
      }
      if (url.includes('fcm.googleapis.com/v1/projects')) {
        // The body from FCM class is a stringified JSON
        const requestBody = options?.body ? JSON.parse(options.body as string) : {}; 
        if (requestBody?.message?.token === 'unregistered-token') {
          return new Response(JSON.stringify({
            error: { 
              code: 400, 
              message: 'The registration token is not a valid FCM registration token.',
              status: 'INVALID_ARGUMENT'
            }
          }), { status: 400 });
        }
        return new Response(JSON.stringify({ name: `projects/${mockServiceAccount.project_id}/messages/mock-id-for-${requestBody?.message?.token}` }), { status: 200 });
      }
      return new Response('Unexpected outbound call', { status: 500 });
    });

    const req = new Request('http://localhost/api/v2/push-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens, message }),
    });

    const res = await app.request(req, undefined, MOCK_ENV);
    expect(res.status).toBe(200);
    const responseBody = await res.json();
    expect(responseBody.success).toBe(true);
    expect(responseBody.unregisteredTokens).toEqual(['unregistered-token']);
    
    // Verify oauth call + 3 FCM calls
    expect(outboundFetchSpy).toHaveBeenCalledTimes(1 + tokens.length); 
  });

}); 