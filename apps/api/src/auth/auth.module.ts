import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import {
  createJsonBodyParser,
  DASHBOARD_BODY_LIMIT_BYTES,
} from '../common/body-parser/json-body-parser.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { AuthController } from './auth.controller.js';
import { ACCESS_TOKEN_TTL_SECONDS, AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const JWT_CLAIMS = {
  issuer: 'web-vitals-monitor',
  audience: 'web-vitals-monitor-dashboard',
};

@Module({
  imports: [
    RateLimitModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
          ...JWT_CLAIMS,
        },
        verifyOptions: { algorithms: ['HS256'], ...JWT_CLAIMS },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        createJsonBodyParser({
          limit: DASHBOARD_BODY_LIMIT_BYTES,
          types: ['application/json'],
        }),
      )
      .forRoutes(AuthController);
  }
}
