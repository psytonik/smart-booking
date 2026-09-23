import { Role } from '../../users/enums/role.enum';
import { TokenType } from '../authentication/enums/token-type.enum';

export interface ActiveUserData {
  sub: number;
  email: string;
  role: Role;
  type: TokenType;
}
