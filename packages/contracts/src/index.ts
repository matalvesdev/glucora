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
export const PrivacyRequestListItemSchema = Type.Object(
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
  },
  { additionalProperties: false },
);
export const PrivacyRequestListQuerySchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
    cursor: Type.Optional(Type.String({ pattern: '^[A-Za-z0-9_-]{8,512}$' })),
  },
  { additionalProperties: false },
);
export const PrivacyRequestListSchema = Type.Object(
  {
    items: Type.Array(PrivacyRequestListItemSchema, { maxItems: 50 }),
    next_cursor: Type.Union([Type.String(), Type.Null()]),
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
const CodingSchema = Type.Object(
  {
    system: Type.String({ minLength: 1, maxLength: 128 }),
    code: Type.String({ minLength: 1, maxLength: 128 }),
  },
  { additionalProperties: false },
);
export const CreateManualGlucoseObservationBodySchema = Type.Object(
  {
    decimal_value: Type.String({
      pattern: '^(?:0|[1-9]\\d{0,11})(?:\\.\\d{1,9})?$',
    }),
    occurred_at: IsoTimestampSchema,
    observed_timezone: Type.String({ minLength: 1, maxLength: 64 }),
    utc_offset_minutes: Type.Integer({ minimum: -840, maximum: 840 }),
  },
  { additionalProperties: false },
);
export const ManualGlucoseObservationSchema = Type.Object(
  {
    id: Type.String({ pattern: '^obs_[A-Za-z0-9_-]{16,64}$' }),
    type: CodingSchema,
    decimal_value: Type.String({
      pattern: '^(?:0|[1-9]\\d{0,11})(?:\\.\\d{1,9})?$',
    }),
    unit: CodingSchema,
    occurred_at: IsoTimestampSchema,
    source_type: Type.Literal('manual'),
    method: Type.Literal('capillary_user_reported'),
    request_id: RequestIdSchema,
  },
  { additionalProperties: false },
);
export const ManualGlucoseObservationListQuerySchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
    cursor: Type.Optional(Type.String({ pattern: '^[A-Za-z0-9_-]{8,512}$' })),
  },
  { additionalProperties: false },
);
export const ManualGlucoseObservationListSchema = Type.Object(
  {
    items: Type.Array(
      Type.Object(
        {
          id: Type.String({ pattern: '^obs_[A-Za-z0-9_-]{16,64}$' }),
          decimal_value: Type.String({
            pattern: '^(?:0|[1-9]\\d{0,11})(?:\\.\\d{1,9})?$',
          }),
          occurred_at: IsoTimestampSchema,
          source_type: Type.Literal('manual'),
        },
        { additionalProperties: false },
      ),
      { maxItems: 50 },
    ),
    next_cursor: Type.Union([Type.String(), Type.Null()]),
    request_id: RequestIdSchema,
  },
  { additionalProperties: false },
);
export const TimelineListQuerySchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
    cursor: Type.Optional(Type.String({ pattern: '^[A-Za-z0-9_-]{8,512}$' })),
    source_kind: Type.Optional(
      Type.Union([Type.Literal('observation'), Type.Literal('context_event')]),
    ),
  },
  { additionalProperties: false },
);
const TimelineItemSchema = Type.Object(
  {
    id: Type.String({ pattern: '^tli_[A-Za-z0-9_-]{16,64}$' }),
    source_kind: Type.Union([
      Type.Literal('observation'),
      Type.Literal('context_event'),
    ]),
    source_type: Type.Union([
      Type.Literal('manual'),
      Type.Literal('imported'),
      Type.Literal('derived'),
    ]),
    fact_class: Type.Union([
      Type.Literal('fact'),
      Type.Literal('declaration'),
      Type.Literal('derivation'),
      Type.Literal('inference'),
      Type.Literal('clinical_assertion'),
    ]),
    category: CodingSchema,
    occurred_at: IsoTimestampSchema,
  },
  { additionalProperties: false },
);
export const TimelineListSchema = Type.Object(
  {
    state: Type.Union([Type.Literal('empty'), Type.Literal('ready')]),
    groups: Type.Array(
      Type.Object(
        {
          local_date: Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
          items: Type.Array(TimelineItemSchema, { maxItems: 50 }),
        },
        { additionalProperties: false },
      ),
      { maxItems: 50 },
    ),
    next_cursor: Type.Union([Type.String(), Type.Null()]),
    request_id: RequestIdSchema,
  },
  { additionalProperties: false },
);
export const PrivacyRequestParamsSchema = Type.Object(
  { id: Type.String({ pattern: '^dsr_[A-Za-z0-9_-]{16,64}$' }) },
  { additionalProperties: false },
);
export const PrivacyRequestHistoryItemSchema = Type.Object(
  {
    from_status: Type.Union([
      Type.Literal('requested'),
      Type.Literal('identity_verification_required'),
      Type.Literal('in_review'),
      Type.Literal('fulfilled'),
      Type.Literal('partially_fulfilled'),
      Type.Literal('denied'),
      Type.Literal('cancelled'),
      Type.Null(),
    ]),
    to_status: Type.Union([
      Type.Literal('requested'),
      Type.Literal('identity_verification_required'),
      Type.Literal('in_review'),
      Type.Literal('fulfilled'),
      Type.Literal('partially_fulfilled'),
      Type.Literal('denied'),
      Type.Literal('cancelled'),
    ]),
    occurred_at: IsoTimestampSchema,
  },
  { additionalProperties: false },
);
export const PrivacyRequestHistorySchema = Type.Object(
  {
    items: Type.Array(PrivacyRequestHistoryItemSchema, { maxItems: 100 }),
    request_id: RequestIdSchema,
  },
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
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
    cursor: Type.Optional(Type.String({ pattern: '^[A-Za-z0-9_-]{8,512}$' })),
  },
  { additionalProperties: false },
);
export const SupportRequestListSchema = Type.Object(
  {
    items: Type.Array(SupportRequestSchema, { maxItems: 50 }),
    next_cursor: Type.Union([Type.String(), Type.Null()]),
    request_id: RequestIdSchema,
  },
  { additionalProperties: false },
);
export const ConsentHistoryQuerySchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
    cursor: Type.Optional(Type.String({ pattern: '^[A-Za-z0-9_-]{8,512}$' })),
  },
  { additionalProperties: false },
);
export const ConsentHistoryItemSchema = Type.Object(
  {
    event_id: Type.String({ pattern: '^cne_[A-Za-z0-9_-]{16,64}$' }),
    purpose_version_id: Type.String({
      pattern: '^pur_[A-Za-z0-9_-]{16,64}$',
    }),
    purpose_key: Type.String({ pattern: '^[a-z][a-z0-9_]{2,63}$' }),
    purpose_version: Type.Integer({ minimum: 1 }),
    purpose_title: Type.String({ minLength: 1, maxLength: 160 }),
    notice_text: Type.String({ minLength: 1, maxLength: 4000 }),
    decision: Type.Union([
      Type.Literal('granted'),
      Type.Literal('denied'),
      Type.Literal('revoked'),
    ]),
    occurred_at: IsoTimestampSchema,
    recorded_at: IsoTimestampSchema,
  },
  { additionalProperties: false },
);
export const ConsentHistoryResponseSchema = Type.Object(
  {
    items: Type.Array(ConsentHistoryItemSchema, { maxItems: 50 }),
    next_cursor: Type.Union([Type.String(), Type.Null()]),
    request_id: RequestIdSchema,
  },
  { additionalProperties: false },
);
export const ConsentPurposeSchema = Type.Object(
  {
    id: Type.String({ pattern: '^pur_[A-Za-z0-9_-]{16,64}$' }),
    purpose_key: Type.String({ pattern: '^[a-z][a-z0-9_]{2,63}$' }),
    version: Type.Integer({ minimum: 1 }),
    title: Type.String({ minLength: 1, maxLength: 160 }),
    notice_text: Type.String({ minLength: 1, maxLength: 4000 }),
    legal_basis_ref: Type.String({ minLength: 1, maxLength: 200 }),
    retention_policy_ref: Type.String({ minLength: 1, maxLength: 200 }),
    current_decision: Type.Union([
      Type.Literal('granted'),
      Type.Literal('denied'),
      Type.Literal('revoked'),
      Type.Null(),
    ]),
  },
  { additionalProperties: false },
);
export const ConsentPurposeListSchema = Type.Object(
  {
    items: Type.Array(ConsentPurposeSchema, { maxItems: 50 }),
    request_id: RequestIdSchema,
  },
  { additionalProperties: false },
);
export const RecordConsentDecisionBodySchema = Type.Object(
  {
    purpose_version_id: Type.String({ pattern: '^pur_[A-Za-z0-9_-]{16,64}$' }),
    decision: Type.Union([
      Type.Literal('granted'),
      Type.Literal('denied'),
      Type.Literal('revoked'),
    ]),
  },
  { additionalProperties: false },
);
export const ConsentDecisionResponseSchema = Type.Object(
  {
    id: Type.String({ pattern: '^cne_[A-Za-z0-9_-]{16,64}$' }),
    purpose_version_id: Type.String({ pattern: '^pur_[A-Za-z0-9_-]{16,64}$' }),
    decision: Type.Union([
      Type.Literal('granted'),
      Type.Literal('denied'),
      Type.Literal('revoked'),
    ]),
    occurred_at: IsoTimestampSchema,
    recorded_at: IsoTimestampSchema,
    request_id: RequestIdSchema,
  },
  { additionalProperties: false },
);
export type HealthResponse = Static<typeof HealthSchema>;
export type ErrorResponse = Static<typeof ErrorSchema>;
export type MeResponse = Static<typeof MeSchema>;
export type PrivacyRequestResponse = Static<typeof PrivacyRequestSchema>;
export type ManualGlucoseObservationResponse = Static<
  typeof ManualGlucoseObservationSchema
>;
