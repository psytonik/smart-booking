import { MigrationInterface, QueryRunner } from 'typeorm';

/** users.role becomes a real Postgres enum instead of free text. */
export class UserRoleEnum1790300000000 implements MigrationInterface {
  name = 'UserRoleEnum1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'business', 'employee', 'client')`,
    );
    // Nothing should be outside the enum, but don't let a stray value abort
    // the migration: treat it as the least-privileged role.
    await queryRunner.query(
      `UPDATE "users" SET "role" = 'client' WHERE "role" NOT IN ('admin', 'business', 'employee', 'client')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."users_role_enum" USING "role"::"public"."users_role_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'client'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" TYPE character varying USING "role"::text`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'client'`,
    );
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
