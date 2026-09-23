import { repl } from '@nestjs/core';
import { AppModule } from './app.module.js';

// Interactive Nest REPL against the configured database: `npm run repl`.
// Until admin tools exist (roadmap F3) this is how to make someone an admin:
//   await get("UsersRepository").update({ email: "you@example.com" }, { role: "admin" })
async function bootstrap() {
  await repl(AppModule);
}

bootstrap();
