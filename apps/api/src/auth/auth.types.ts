export type AccessTokenPayload = {
  sub: string;
  tenantId: string | null;
  email: string;
  isPlatformAdmin: boolean;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    tenantId: string | null;
    email: string;
    firstName: string;
    lastName: string;
    isPlatformAdmin: boolean;
    permissions: string[];
  };
};
