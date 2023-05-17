import { repl } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  await repl(AppModule);
}

bootstrap().then();

// npm run start:dev -- --entryFile repl
// await get("UserRepository").update({ id: 1}, {role: 'admin'})
