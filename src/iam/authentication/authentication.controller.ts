import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SignUpDto } from './dto/sign-up.dto.js';
import { AuthenticationService } from './authentication.service.js';
import { SignInDto } from './dto/sign-in.dto.js';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from './decorator/auth.decorator.js';
import { AuthType } from './enums/auth-type.enum.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { Serialize } from '../../common/serialization/serialize.decorator.js';
import { UserResponseDto } from '../../users/dto/user-response.dto.js';

@ApiTags('Authentication')
@Auth(AuthType.None)
@Controller('authentication')
export class AuthenticationController {
  constructor(private readonly authService: AuthenticationService) {}

  @ApiOperation({ summary: 'Sign Up User' })
  @Serialize(UserResponseDto)
  @Post('sign-up')
  async signUp(@Body() dto: SignUpDto) {
    return await this.authService.signUp(dto);
  }

  @ApiOperation({ summary: 'Sign In User' })
  @HttpCode(HttpStatus.OK)
  @Post('sign-in')
  async signIn(@Body() dto: SignInDto): Promise<{ accessToken: string }> {
    return await this.authService.signIn(dto);
  }

  @ApiOperation({ summary: 'Refresh Token' })
  @HttpCode(HttpStatus.OK)
  @Post('refresh-tokens')
  async refreshToken(@Body() refreshToken: RefreshTokenDto) {
    return await this.authService.refreshToken(refreshToken);
  }

  @ApiOperation({ summary: 'Log out: end the session of this refresh token' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Body() refreshToken: RefreshTokenDto): Promise<void> {
    await this.authService.logout(refreshToken);
  }
}
