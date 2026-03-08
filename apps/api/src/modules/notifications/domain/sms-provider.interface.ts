export interface SmsResult {
  messageId: string;
  status: 'sent' | 'failed';
  provider: string;
}

export interface SmsParams {
  to: string; // E.164 format: +261340000000
  message: string;
}

/**
 * Adapter interface for SMS delivery.
 * Each carrier (Orange Madagascar, Africa's Talking, etc.) implements this
 * interface — business logic never contains provider-specific branching.
 */
export abstract class SmsProvider {
  abstract send(params: SmsParams): Promise<SmsResult>;
}
