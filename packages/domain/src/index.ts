export interface AuthenticatedActor {
  readonly id: string;
  readonly kind: 'consumer';
}

export interface IdentityPort<RequestContext> {
  authenticate(context: RequestContext): Promise<AuthenticatedActor | null>;
}
