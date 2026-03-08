import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider } from './domain/sms-provider.interface';
import { MockSmsProvider } from './infrastructure/providers/mock-sms.provider';

@Module({
  providers: [
    {
      // Provider selected by config — business logic never contains
      // provider-specific branching (Dependency Inversion principle).
      // Orange Madagascar and Africa's Talking adapters will be added
      // in Phase 5 (Step 23) without touching this factory's consumers.
      provide: SmsProvider,
      useFactory: (config: ConfigService): SmsProvider => {
        const provider = config.get<string>('SMS_PROVIDER', 'mock');
        switch (provider) {
          // case 'orange': return new OrangeMadagascarProvider(config);
          // case 'africas_talking': return new AfricasTalkingProvider(config);
          default:
            return new MockSmsProvider();
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [SmsProvider],
})
export class NotificationsModule {}
