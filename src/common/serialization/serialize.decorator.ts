import {
  applyDecorators,
  CallHandler,
  ExecutionContext,
  NestInterceptor,
  Type,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { map, Observable } from 'rxjs';

class SerializeInterceptor implements NestInterceptor {
  constructor(private readonly dto: Type) {}

  intercept(_: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next
      .handle()
      .pipe(
        map((data) =>
          plainToInstance(this.dto, data, { excludeExtraneousValues: true }),
        ),
      );
  }
}

/**
 * Serializes the handler's result (object or array) through `dto`: only
 * properties marked `@Expose()` there reach the client, whatever the entity
 * happens to have loaded. Also documents the response in Swagger.
 */
export function Serialize(dto: Type, options: { isArray?: boolean } = {}) {
  return applyDecorators(
    UseInterceptors(new SerializeInterceptor(dto)),
    ApiOkResponse({ type: dto, isArray: options.isArray }),
  );
}
