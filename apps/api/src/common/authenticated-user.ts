export type AuthenticatedUser = {
  id: string;
  tenantId: string | null;
  email: string;
  isPlatformAdmin: boolean;
  permissions: string[];
};

export type RequestWithUser = Request & {
  user?: AuthenticatedUser;
  ip?: string;
  headers: {
    authorization?: string;
    'user-agent'?: string;
  };
};
