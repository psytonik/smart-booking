import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Milestone 3: slots belong to a staff member, times are stored as UTC
 * instants, and slot status distinguishes booked slots from breaks.
 *
 * Data is preserved:
 * - Existing `timestamp` values were written in the server's local time.
 *   They're converted assuming the server ran in UTC, the only safe
 *   assumption without knowing its timezone. Pre-launch data only.
 * - Existing businesses get timezone `UTC`.
 * - Existing slots are assigned to their business's owner.
 * - Status `'0'` becomes `available`; `'1'` becomes `booked` when the slot
 *   has a booking, otherwise `break`.
 */
export class StaffSlotsTimezones1790200000000 implements MigrationInterface {
  name = 'StaffSlotsTimezones1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business" ADD "timezone" character varying NOT NULL DEFAULT 'UTC'`,
    );

    await queryRunner.query(
      `ALTER TABLE "slot" ALTER COLUMN "start_time" TYPE TIMESTAMP WITH TIME ZONE USING "start_time" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "slot" ALTER COLUMN "end_time" TYPE TIMESTAMP WITH TIME ZONE USING "end_time" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ALTER COLUMN "book_slot" TYPE TIMESTAMP WITH TIME ZONE USING "book_slot" AT TIME ZONE 'UTC'`,
    );

    await queryRunner.query(
      `ALTER TYPE "public"."slot_status_enum" RENAME TO "slot_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."slot_status_enum" AS ENUM('available', 'booked', 'break')`,
    );
    await queryRunner.query(
      `ALTER TABLE "slot" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(`
      ALTER TABLE "slot" ALTER COLUMN "status" TYPE "public"."slot_status_enum" USING (
        CASE
          WHEN "status"::text = '0' THEN 'available'
          WHEN "bookingById" IS NOT NULL THEN 'booked'
          ELSE 'break'
        END
      )::"public"."slot_status_enum"`);
    await queryRunner.query(
      `ALTER TABLE "slot" ALTER COLUMN "status" SET DEFAULT 'available'`,
    );
    await queryRunner.query(`DROP TYPE "public"."slot_status_enum_old"`);

    await queryRunner.query(`ALTER TABLE "slot" ADD "staffId" integer`);
    await queryRunner.query(`
      UPDATE "slot" SET "staffId" = "users"."id"
      FROM "users" WHERE "users"."businessId" = "slot"."businessId"`);
    // Slots whose business has no owner can't be attributed to anyone.
    await queryRunner.query(`DELETE FROM "slot" WHERE "staffId" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "slot" ALTER COLUMN "staffId" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "slot" DROP CONSTRAINT "UQ_8609cf0cc585e27a4ee0e6f3431"`,
    );
    await queryRunner.query(
      `ALTER TABLE "slot" ADD CONSTRAINT "UQ_585c9e3b0225b60d8840d896c48" UNIQUE ("staffId", "start_time")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8609cf0cc585e27a4ee0e6f343" ON "slot" ("businessId", "start_time")`,
    );
    await queryRunner.query(
      `ALTER TABLE "slot" ADD CONSTRAINT "FK_5cb02248cb5b5a5dadee2b68d66" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "slot" DROP CONSTRAINT "FK_5cb02248cb5b5a5dadee2b68d66"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8609cf0cc585e27a4ee0e6f343"`,
    );
    await queryRunner.query(
      `ALTER TABLE "slot" DROP CONSTRAINT "UQ_585c9e3b0225b60d8840d896c48"`,
    );
    // Several staff may share a start time now; keep one slot per business
    // and time so the old unique constraint can be restored.
    await queryRunner.query(`
      DELETE FROM "slot" a USING "slot" b
      WHERE a."businessId" = b."businessId" AND a."start_time" = b."start_time"
        AND a."id" > b."id" AND a."bookingById" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "slot" ADD CONSTRAINT "UQ_8609cf0cc585e27a4ee0e6f3431" UNIQUE ("start_time", "businessId")`,
    );
    await queryRunner.query(`ALTER TABLE "slot" DROP COLUMN "staffId"`);

    await queryRunner.query(
      `CREATE TYPE "public"."slot_status_enum_old" AS ENUM('0', '1')`,
    );
    await queryRunner.query(
      `ALTER TABLE "slot" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(`
      ALTER TABLE "slot" ALTER COLUMN "status" TYPE "public"."slot_status_enum_old" USING (
        CASE WHEN "status" = 'available' THEN '0' ELSE '1' END
      )::"public"."slot_status_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "slot" ALTER COLUMN "status" SET DEFAULT '0'`,
    );
    await queryRunner.query(`DROP TYPE "public"."slot_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."slot_status_enum_old" RENAME TO "slot_status_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "booking" ALTER COLUMN "book_slot" TYPE TIMESTAMP USING "book_slot" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "slot" ALTER COLUMN "end_time" TYPE TIMESTAMP USING "end_time" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "slot" ALTER COLUMN "start_time" TYPE TIMESTAMP USING "start_time" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(`ALTER TABLE "business" DROP COLUMN "timezone"`);
  }
}
