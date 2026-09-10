import { Type, type Static } from '@sinclair/typebox';
const RequestIdSchema = Type.String({
  pattern:
    '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
});
const IsoTimestampSchema = Type.String({
  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$',
});
export const HealthSchema = Type.Object(
  { status: Type.Literal('ok'), request_id: RequestIdSchema },
  { additionalProperties: false },
);
export const ErrorSchema = Type.Object(
  { code: Type.String(), message: Type.String(), request_id: RequestIdSchema },
  { additionalProperties: false },
);
export const MeSchema = Type.Object(
  {
    id: Type.String({ pattern: '^usr_[A-Za-z0-9_-]{16,64}$' }),
    kind: Type.Literal('consumer'),
    status: Type.Literal('active'),
    locale: Type.String({ pattern: '^[a-z]{2}(?:-[A-Z]{2})?$' }),
    timezone: Type.String({ minLength: 1, maxLength: 64 }),
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema,
    request_id: RequestIdSchema,
  },
  { additionalProperties: false },
);
export const PrivacyRequestSchema = Type.Object(
  {
    id: Type.String({ pattern: '^dsr_[A-Za-z0-9_-]{16,64}$' }),
    kind: Type.Union([
      Type.Literal('access'),
      Type.Literal('export'),
      Type.Literal('deletion'),
    ]),
    scope: Type.Literal('all_user_data'),
    status: Type.Union([
      Type.Literal('requested'),
      Type.Literal('identity_verification_required'),
      Type.Literal('in_review'),
      Type.Literal('fulfilled'),
      Type.Literal('partially_fulfilled'),
      Type.Literal('denied'),
      Type.Literal('cancelled'),
    ]),
    version: Type.Integer({ minimum: 1 }),
    requested_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema,
    request_id: RequestIdSchema,
  },
  { additionalProperties: false },
);
export const CreatePrivacyRequestBodySchema = Type.Object(
  {
    kind: Type.Union([
      Type.Literal('access'),
      Type.Literal('export'),
      Type.Literal('deletion'),
    ]),
  },
  { additionalProperties: false },
);
export const IdempotencyHeadersSchema = Type.Object(
  {
    'idempotency-key': Type.String({ minLength: 8, maxLength: 128 }),
  },
  { additionalProperties: true },
);
export const PrivacyRequestParamsSchema = Type.Object(
  { id: Type.String({ pattern: '^dsr_[A-Za-z0-9_-]{16,64}$' }) },
  { additionalProperties: false },
);
const SupportCategorySchema = Type.Union([
  Type.Literal('account_access'),
  Type.Literal('privacy_rights'),
  Type.Literal('data_quality'),
  Type.Literal('sharing'),
  Type.Literal('unsafe_output'),
  Type.Literal('technical_issue'),
]);
export const SupportRequestSchema = Type.Object(
  {
    id: Type.String({ pattern: '^sup_[A-Za-z0-9_-]{16,64}$' }),
    category: SupportCategorySchema,
    status: Type.Literal('submitted'),
    created_at: IsoTimestampSchema,
  },
  { additionalProperties: false },
);
export const CreateSupportRequestBodySchema = Type.Object(
  { category: SupportCategorySchema },
  { additionalProperties: false },
);
export const ListSupportRequestsQuerySchema = Type.Object(
  { limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })) },
  { additionalProperties: false },
);
export const SupportRequestListSchema = Type.Object(
  {
    items: Type.Array(SupportRequestSchema, { maxItems: 100 }),
    request_id: RequestIdSchema,
  },
  { additionalProperties: false },
);
export type HealthResponse = Static<typeof HealthSchema>;
export type ErrorResponse = Static<typeof ErrorSchema>;
export type MeResponse = Static<typeof MeSchema>;
export type PrivacyRequestResponse = Static<typeof PrivacyRequestSchema>;
