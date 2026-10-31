import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LoginSchema,
  RegisterSchema,
  type LoginInput,
  type RegisterInput,
} from '@rum/shared';
import type { CookieOptions, Request, Response } from 'express';
import { sha256 } from '../common/crypto/tokens.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import {
  RATE_LIMITS,
  RateLimitService,
} from '../rate-limit/rate-limit.service.js';
import { CurrentUser, Public, type AuthUser } from './auth.decorators.js';
import {
  AuthService,
  REFRESH_TOKEN_TTL_MS,
  type Session,
} from './auth.service.js';

const COOKIE = 'rt';

@Controller('v1/auth')
export class AuthController {
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly authService: AuthService,
    private readonly rateLimits: RateLimitService,
    config: ConfigService,
  ) {
    this.cookieOptions = {
      httpOnly: true,
      secure: config.getOrThrow<boolean>('COOKIE_SECURE'),
      sameSite: 'lax',
      path: '/v1/auth',
    };
  }

  @Public()
  @Post('register')
  register(@Body(new ZodValidationPipe(RegisterSchema)) input: RegisterInput) {
    return this.authService.register(input);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) input: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.rateLimits.enforce(
      RATE_LIMITS.login,
      `${req.ip ?? 'unknown'}:${sha256(input.email)}`,
      res,
    );
    return this.setSession(res, await this.authService.login(input));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      return this.setSession(
        res,
        await this.authService.refresh(readCookie(req)),
      );
    } catch (err) {
      res.clearCookie(COOKIE, this.cookieOptions);
      throw err;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(user.id, readCookie(req));
    res.clearCookie(COOKIE, this.cookieOptions);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logoutAll(user.id);
    res.clearCookie(COOKIE, this.cookieOptions);
  }

  private setSession(res: Response, { refreshToken, ...body }: Session) {
    res.cookie(COOKIE, refreshToken, {
      ...this.cookieOptions,
      maxAge: REFRESH_TOKEN_TTL_MS,
    });
    return body;
  }
}

function readCookie(req: Request): string | undefined {
  return /(?:^|;\s*)rt=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
}
