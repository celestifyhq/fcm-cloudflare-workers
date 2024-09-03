export interface FcmErrorResponse {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

export interface FcmTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}
