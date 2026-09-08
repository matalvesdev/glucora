export interface AuthenticatedActor {
  readonly id: string;
  readonly kind: 'consumer';
}

export interface IdentityPort<RequestContext> {
  authenticate(context: RequestContext): Promise<AuthenticatedActor | null>;
}

export interface UserAccount {
  readonly id: string;
  readonly status: 'active' | 'disabled';
  readonly locale: string;
  readonly timezone: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface UserAccountRepository {
  findById(id: string): Promise<UserAccount | null>;
}
