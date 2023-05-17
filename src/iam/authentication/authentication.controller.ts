import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SignUpDto } from './dto/sign-up.dto.ts';
import { AuthenticationService } from './authentication.service';
import { SignInDto } from './dto/sign-in.dto.ts';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from './decorator/auth.decorator';
import { AuthType } from './enums/auth-type.enum';

@ApiTags('Authentication')
@Auth(AuthType.None)
@Controller('authentication')
export class AuthenticationController {
  constructor(private readonly authService: AuthenticationService) {}

  @ApiOperation({ summary: 'Sign Up User' })
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
}
