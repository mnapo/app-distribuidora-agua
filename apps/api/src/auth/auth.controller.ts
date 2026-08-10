import { Body, Controller, Get, Post, Req, UseGuards, Inject} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AuthenticatedUser, RequestWithUser } from '../common/authenticated-user.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: RequestWithUser) {
    return this.authService.login(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() request: RequestWithUser) {
    return this.authService.refresh(dto.refreshToken, {
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });
  }

  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }
}
