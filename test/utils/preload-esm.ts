// Works around a known NestJS 12 / Jest ESM interaction: NestJS 12's
// packages are ESM-only, but several ecosystem packages we depend on
// (@nestjs/throttler as of 6.7.0) are still CommonJS and `require()`
// `@nestjs/common`/`@nestjs/core` internally. Under Jest's ESM mode, if
// that `require()` lands while Node is still linking the ESM graph (which
// happens the first time anything imports `@nestjs/core` in a fresh test
// file), Node throws `ERR_REQUIRE_CYCLE_MODULE` even though there's no real
// cycle — see https://github.com/nestjs/nest/issues/17583.
//
// Fully awaiting the ESM graph here, before any test file (or its
// transitive imports) touches it, means it's already linked and cached by
// the time a CJS package `require()`s it, so no in-flight collision occurs.
await import('@nestjs/core');
await import('@nestjs/common');
