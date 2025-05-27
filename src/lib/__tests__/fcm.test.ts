import { FCM } from '../fcm';
import { FcmOptions } from '../../entity/fcm-options';
import { EnhancedFcmMessage } from '../../entity/fcm-message-v2';
import { FcmServiceAccount } from '../../entity/fcm-service-account';

// Mock crypto-utils
jest.mock('../crypto-utils', () => ({
  createJWT: jest.fn().mockResolvedValue('mocked-jwt-token'),
}));

// Mock fetch
global.fetch = jest.fn();

const mockServiceAccount: FcmServiceAccount = {
  type: 'service_account',
  project_id: 'test-project',
  private_key_id: 'private_key_id',
  private_key: '-----BEGIN PRIVATE KEY-----\nprivate_key\n-----END PRIVATE KEY-----',
  client_email: 'test@example.com',
  client_id: 'client_id',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/test%40example.com',
};

describe('FCM', () => {
  beforeEach(() => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockReset(); // Reset the main mock
    require('../crypto-utils').createJWT.mockClear();

    // Default mock for getAccessToken internal fetch call
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === mockServiceAccount.token_uri) {
        return {
          ok: true,
          json: async () => ({ access_token: 'mocked-oauth-token', expires_in: 3600 }),
        };
      }
      // Fallback for other calls - this helps identify unexpected fetch calls
      return {
        ok: false,
        status: 500,
        statusText: `Unexpected fetch call to ${url}`,
        json: async () => ({ error: `Unexpected fetch call to ${url}` }),
      };
    });
  });

  it('should throw an error if serviceAccount is not provided', () => {
    const options: Partial<FcmOptions> = {
      maxConcurrentConnections: 5,
      maxConcurrentStreamsAllowed: 100,
    };
    expect(() => new FCM(options as FcmOptions)).toThrow(
      'Please provide the service account JSON configuration file.'
    );
  });

  describe('sendToToken', () => {
    const options: FcmOptions = {
      serviceAccount: mockServiceAccount,
      maxConcurrentConnections: 5,
      maxConcurrentStreamsAllowed: 100,
    };
    const fcm = new FCM(options);
    const message: EnhancedFcmMessage = { data: { foo: 'bar' } };
    const token = 'test-token';
    const fcmSendUrl = `https://fcm.googleapis.com/v1/projects/${mockServiceAccount.project_id}/messages:send`;

    it('should call fetch with the correct parameters for FCM send', async () => {
      const fetchMock = global.fetch as jest.Mock;
      // Specific mock for the FCM send call for this test
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === mockServiceAccount.token_uri) {
          return {
            ok: true,
            json: async () => ({ access_token: 'mocked-oauth-token', expires_in: 3600 }),
          };
        }
        if (url === fcmSendUrl) {
          return {
            ok: true,
            json: async () => ({ name: 'message-id' }),
          };
        }
        return { ok: false, status: 404, json: async () => ({ error: "Not Found" }) }; // Fallback
      });

      await fcm.sendToToken(message, token);

      // Check createJWT call (for OAuth2 token, not the one mocked away by crypto-utils for FCM token)
      // This actually means the JWT for the OAuth token, not the FCM message itself
      expect(require('../crypto-utils').createJWT).toHaveBeenCalledTimes(1);

      // Check FCM send call
      expect(fetchMock).toHaveBeenCalledWith(
        fcmSendUrl,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer mocked-oauth-token', // This should be the OAuth token
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: { ...message, token } }),
        }
      );
      // Ensure overall fetch was called for token and for FCM
      expect(fetchMock).toHaveBeenCalledTimes(2); 
    });

    it('should throw an error if FCM send fetch fails', async () => {
      const fetchMock = global.fetch as jest.Mock;
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === mockServiceAccount.token_uri) {
          return {
            ok: true,
            json: async () => ({ access_token: 'mocked-oauth-token', expires_in: 3600 }),
          };
        }
        if (url === fcmSendUrl) {
          return {
            ok: false,
            status: 500, // Simulate a server error for FCM send
            statusText: 'Internal Server Error',
            json: async () => ({ error: { message: 'Internal Server Error' } })
          };
        }
        return { ok: false, status: 404, json: async () => ({ error: "Not Found" }) };
      });

      await expect(fcm.sendToToken(message, token)).rejects.toThrow(
        'Internal Server Error' // This error comes from the sendMessage method
      );
       expect(require('../crypto-utils').createJWT).toHaveBeenCalledTimes(1);
       expect(fetchMock).toHaveBeenCalledTimes(2); // Token call + FCM send call
    });

    it('should throw an error if token is unregistered', async () => {
      const fetchMock = global.fetch as jest.Mock;
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === mockServiceAccount.token_uri) {
          return {
            ok: true,
            json: async () => ({ access_token: 'mocked-oauth-token', expires_in: 3600 }),
          };
        }
        if (url === fcmSendUrl) {
          return {
            ok: false,
            status: 404, 
            json: async () => ({
              error: {
                code: 404,
                message: 'Requested entity was not found. FIRMessagingError: The registration token is not a valid FCM registration token',
                status: 'NOT_FOUND',
                details: [
                  {
                    '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError',
                    errorCode: 'UNREGISTERED',
                  },
                ],
              },
            }),
          };
        }
        return { ok: false, status: 404, json: async () => ({ error: "Not Found" }) }; 
      });

      await expect(fcm.sendToToken(message, token)).rejects.toThrow(
        'The provided registration token is not registered with FCM'
      );
      expect(require('../crypto-utils').createJWT).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2); // Token call + FCM send call
    });
  });

  describe('sendToTopic', () => {
    const options: FcmOptions = {
      serviceAccount: mockServiceAccount,
      maxConcurrentConnections: 5,
      maxConcurrentStreamsAllowed: 100,
    };
    const fcm = new FCM(options);
    const message: EnhancedFcmMessage = { data: { foo: 'bar' } };
    const topic = 'test-topic';
    const fcmSendUrl = `https://fcm.googleapis.com/v1/projects/${mockServiceAccount.project_id}/messages:send`;

    it('should call fetch with the correct parameters for FCM send to topic', async () => {
      const fetchMock = global.fetch as jest.Mock;
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === mockServiceAccount.token_uri) {
          return { ok: true, json: async () => ({ access_token: 'mocked-oauth-token', expires_in: 3600 }) };
        }
        if (url === fcmSendUrl) {
          return { ok: true, json: async () => ({ name: 'message-id' }) };
        }
        return { ok: false, status: 404, json: async () => ({ error: "Not Found" }) };
      });

      await fcm.sendToTopic(message, topic);

      expect(require('../crypto-utils').createJWT).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        fcmSendUrl,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer mocked-oauth-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: { ...message, topic: topic } }),
        }
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should throw an error for invalid topic format', async () => {
      const invalidTopic = 'invalid!topic';
      await expect(fcm.sendToTopic(message, invalidTopic)).rejects.toThrow(
        'Invalid topic format'
      );
      expect(require('../crypto-utils').createJWT).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should throw an error if FCM send to topic fails', async () => {
      const fetchMock = global.fetch as jest.Mock;
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === mockServiceAccount.token_uri) {
          return { ok: true, json: async () => ({ access_token: 'mocked-oauth-token', expires_in: 3600 }) };
        }
        if (url === fcmSendUrl) {
          return { ok: false, status: 500, statusText: 'Server Error', json: async () => ({error: {message: 'Server Error'}}) };
        }
        return { ok: false, status: 404, json: async () => ({ error: "Not Found" }) };
      });

      await expect(fcm.sendToTopic(message, topic)).rejects.toThrow(
        'Server Error'
      );
      expect(require('../crypto-utils').createJWT).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendToCondition', () => {
    const options: FcmOptions = {
      serviceAccount: mockServiceAccount,
      maxConcurrentConnections: 5,
      maxConcurrentStreamsAllowed: 100,
    };
    const fcm = new FCM(options);
    const message: EnhancedFcmMessage = { data: { foo: 'bar' } };
    const condition = "'foo' in topics && 'bar' in topics";
    const fcmSendUrl = `https://fcm.googleapis.com/v1/projects/${mockServiceAccount.project_id}/messages:send`;

    it('should call fetch with the correct parameters for FCM send to condition', async () => {
      const fetchMock = global.fetch as jest.Mock;
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === mockServiceAccount.token_uri) {
          return { ok: true, json: async () => ({ access_token: 'mocked-oauth-token', expires_in: 3600 }) };
        }
        if (url === fcmSendUrl) {
          return { ok: true, json: async () => ({ name: 'message-id' }) };
        }
        return { ok: false, status: 404, json: async () => ({ error: "Not Found" }) };
      });

      await fcm.sendToCondition(message, condition);

      expect(require('../crypto-utils').createJWT).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        fcmSendUrl,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer mocked-oauth-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: { ...message, condition } }),
        }
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should throw an error if FCM send to condition fails', async () => {
      const fetchMock = global.fetch as jest.Mock;
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === mockServiceAccount.token_uri) {
          return { ok: true, json: async () => ({ access_token: 'mocked-oauth-token', expires_in: 3600 }) };
        }
        if (url === fcmSendUrl) {
          return { ok: false, status: 500, statusText: 'Server Error', json: async () => ({error: {message: 'Server Error'}}) };
        }
        return { ok: false, status: 404, json: async () => ({ error: "Not Found" }) };
      });

      await expect(fcm.sendToCondition(message, condition)).rejects.toThrow(
        'Server Error'
      );
      expect(require('../crypto-utils').createJWT).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendToTokens', () => {
    const options: FcmOptions = {
      serviceAccount: mockServiceAccount,
      maxConcurrentConnections: 1, // Set to 1 to easily test batching
      maxConcurrentStreamsAllowed: 2, // Ensure batching happens
    };
    const fcm = new FCM(options);
    const message: EnhancedFcmMessage = { data: { foo: 'bar' } };
    const fcmSendUrl = `https://fcm.googleapis.com/v1/projects/${mockServiceAccount.project_id}/messages:send`;

    it('should send messages in batches and return unregistered tokens', async () => {
      const tokens = ['token1', 'token2', 'token3', 'token4', 'token5'];
      const fetchMock = global.fetch as jest.Mock;
      let fcmCallCount = 0;

      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === mockServiceAccount.token_uri) {
          return { ok: true, json: async () => ({ access_token: 'mocked-oauth-token', expires_in: 3600 }) };
        }
        if (url === fcmSendUrl) {
          fcmCallCount++;
          const body = JSON.parse(init?.body as string);
          const currentToken = body.message.token;
          if (currentToken === 'token2' || currentToken === 'token4') {
            // Simulate original UNREGISTERED detection: 400 status and specific message
            return {
              ok: false,
              status: 400, 
              json: async () => ({
                error: {
                  code: 400, // Aligns with status
                  message: 'some error message including not a valid FCM registration token string',
                  status: 'INVALID_ARGUMENT',
                },
              })
            };
          }
          return { ok: true, json: async () => ({ name: `message-id-for-${currentToken}` }) };
        }
        return { ok: false, status: 404, json: async () => ({ error: "Not Found" }) }; 
      });

      const unregisteredTokens = await fcm.sendToTokens(message, tokens);

      expect(require('../crypto-utils').createJWT).toHaveBeenCalledTimes(1);
      expect(fcmCallCount).toBe(5);
      expect(fetchMock).toHaveBeenCalledTimes(1 + 5);
      expect(unregisteredTokens).toEqual(['token2', 'token4']);
    });

    it('should process batches and log errors but not throw for critical failures', async () => {
      const tokens = ['token1', 'token2']; // token2 will fail critically
      const fetchMock = global.fetch as jest.Mock;
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === mockServiceAccount.token_uri) {
          return { ok: true, json: async () => ({ access_token: 'mocked-oauth-token', expires_in: 3600 }) };
        }
        if (url === fcmSendUrl) {
          const body = JSON.parse(init?.body as string);
          if (body.message.token === 'token1') {
            return { ok: true, json: async () => ({ name: `message-id-for-token1` }) };
          }
          // Simulate a critical failure for token2 (will be retried by sendRequest)
          return { 
            ok: false, 
            status: 500, 
            statusText: 'Server Error Batch', 
            json: async () => ({error: {message: 'Server Error Batch'}})
           };
        }
        return { ok: false, status: 404, json: async () => ({ error: "Not Found" }) };
      });

      const result = await fcm.sendToTokens(message, tokens);
      expect(result).toEqual([]); // Expect empty array as token1 succeeds, token2 fails critically
      
      expect(require('../crypto-utils').createJWT).toHaveBeenCalledTimes(1);
      // 1 (OAuth) + 1 (token1 successful) + 4 (token2 with 3 retries) = 6 calls
      expect(fetchMock).toHaveBeenCalledTimes(1 + 1 + 4); 

      // Check that console.error was called due to the critical failure
      // Logs from sendRequest (final attempt for token2)
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error sending request to device token2:", expect.objectContaining({ message: "HTTP error! status: 500, message: Server Error Batch" }));
      // Logs from processBatch
      expect(consoleErrorSpy).toHaveBeenCalledWith("Errors occurred while processing batch: 1");
      // This is the forEach loop in processBatch logging the actual error object
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: "HTTP error! status: 500, message: Server Error Batch" }));
      
      consoleErrorSpy.mockRestore();
    }, 10000); 

     it('should handle all tokens being unregistered by returning them', async () => {
      const tokens = ['unreg1', 'unreg2'];
      const fetchMock = global.fetch as jest.Mock;
      let fcmCallCount = 0;

      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === mockServiceAccount.token_uri) {
          return { ok: true, json: async () => ({ access_token: 'mocked-oauth-token', expires_in: 3600 }) };
        }
        if (url === fcmSendUrl) {
          fcmCallCount++;
          return { 
            ok: false, 
            status: 400, 
            json: async () => ({ 
              error: { 
                code: 400,
                message: 'The registration token is not a valid FCM registration token.', 
                status: 'INVALID_ARGUMENT',
              } 
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({ error: "Not Found" }) };
      });

      const unregisteredTokens = await fcm.sendToTokens(message, tokens);
      expect(unregisteredTokens).toEqual(['unreg1', 'unreg2']);
      expect(require('../crypto-utils').createJWT).toHaveBeenCalledTimes(1);
      expect(fcmCallCount).toBe(2);
      expect(fetchMock).toHaveBeenCalledTimes(1 + 2);
    });

    it('should handle empty token array input', async () => {
        await expect(fcm.sendToTokens(message, [])).rejects.toThrow('Token array is required');
        expect(global.fetch as jest.Mock).not.toHaveBeenCalled(); // No fetch if tokens are empty
    });

  });
}); 