import { Role } from '../../users/enums/role.enum.js';
import { TokenType } from '../authentication/enums/token-type.enum.js';

export interface ActiveUserData {
  sub: number;
  email: string;
  role: Role;
  type: TokenType;
}
