import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  SmsProvider,
  type SmsParams,
  type SmsResult,
} from '../../domain/sms-provider.interface';

/**
 * Console-only SMS provider for development and test environments.
 * Throws at startup if loaded in production — a misconfigured SMS_PROVIDER
 * env var in production would silently drop all SMS instead of sending.
 */
@Injectable()
export class MockSmsProvider extends SmsProvider {
  private readonly logger = new Logger(MockSmsProvider.name);

  constructor() {
    super();

    // LOW-01 fix: fail loudly at boot if this provider is accidentally
    // loaded outside dev/test. Without this guard, a production deploy
    // with SMS_PROVIDER=mock would silently swallow every OTP and
    // appointment reminder.
    const env = process.env.NODE_ENV;
    if (env !== 'development' && env !== 'test' && env !== undefined) {
      throw new Error(
        'MockSmsProvider must not be used outside development/test environments. ' +
          'Set SMS_PROVIDER=orange or SMS_PROVIDER=africas_talking.',
      );
    }
  }

  async send(params: SmsParams): Promise<SmsResult> {
    this.logger.log(`[MOCK SMS] To: ${params.to} | Message: ${params.message}`);

    return {
      messageId: `mock-${randomUUID()}`,
      status: 'sent',
      provider: 'mock',
    };
  }
}
