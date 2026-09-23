import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Milestone 6: services, working hours, blocked time, and bookings as
 * appointments (staff + service + [start, end)), replacing pre-generated
 * slots.
 *
 * Data:
 * - Existing bookings keep their time and staff member (taken from their
 *   slot). Each business with bookings gets an inactive "Appointment"
 *   service they point to, since the old model had no services. Prices of
 *   those bookings are 0.
 * - Existing slot schedules are not converted; staff set their working
 *   hours again (pre-launch data only).
 * - The `slot` table is dropped.
 */
export class ServicesAndFlexibleScheduling1790400000000 implements MigrationInterface {
  name = 'ServicesAndFlexibleScheduling1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Needed for "staffId WITH =" inside the gist exclusion constraint.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    await queryRunner.query(
      `ALTER TABLE "business" ADD "currency" character(3) NOT NULL DEFAULT 'USD'`,
    );

    await queryRunner.query(
      `CREATE TABLE "service" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "duration_minutes" integer NOT NULL, "buffer_minutes" integer NOT NULL DEFAULT '0', "price_minor" integer NOT NULL, "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "businessId" uuid NOT NULL, CONSTRAINT "PK_85a21558c006647cd76fdce044b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "staff_service" ("id" SERIAL NOT NULL, "duration_minutes" integer, "buffer_minutes" integer, "price_minor" integer, "staffId" integer NOT NULL, "serviceId" uuid NOT NULL, CONSTRAINT "UQ_22d89e1ca759052aee4f1c62d9f" UNIQUE ("staffId", "serviceId"), CONSTRAINT "PK_538b8a85f169c8f37e4bb08c871" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "working_hours" ("id" SERIAL NOT NULL, "weekday" smallint NOT NULL, "start_minute" smallint NOT NULL, "end_minute" smallint NOT NULL, "staffId" integer NOT NULL, CONSTRAINT "PK_5f84d2fa3953367fe9d704d8df6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d7ff5c91ced59faa3df6fd7c42" ON "working_hours" ("staffId", "weekday")`,
    );
    await queryRunner.query(
      `CREATE TABLE "time_block" ("id" SERIAL NOT NULL, "start_time" TIMESTAMP WITH TIME ZONE NOT NULL, "end_time" TIMESTAMP WITH TIME ZONE NOT NULL, "reason" character varying, "staffId" integer NOT NULL, CONSTRAINT "PK_1c6bb03fe5b1501673a5d9acb18" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9720c8aa6e16ad0cc4522f52ee" ON "time_block" ("staffId", "start_time")`,
    );
    await queryRunner.query(
      `CREATE TABLE "schedule_override" ("id" SERIAL NOT NULL, "date" date NOT NULL, "start_minute" smallint, "end_minute" smallint, "staffId" integer NOT NULL, CONSTRAINT "PK_f0bb72d63eed79587cda818db06" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fa0a7d1382495a6283c8feb1d4" ON "schedule_override" ("staffId", "date")`,
    );

    // Bookings become appointments. Add columns nullable, backfill, then
    // tighten.
    await queryRunner.query(
      `CREATE TYPE "public"."booking_status_enum" AS ENUM('confirmed', 'cancelled_by_client', 'cancelled_by_business')`,
    );
    await queryRunner.query(`
      ALTER TABLE "booking"
        ADD "start_time" TIMESTAMP WITH TIME ZONE,
        ADD "end_time" TIMESTAMP WITH TIME ZONE,
        ADD "blocked_until" TIMESTAMP WITH TIME ZONE,
        ADD "status" "public"."booking_status_enum" NOT NULL DEFAULT 'confirmed',
        ADD "duration_minutes" integer,
        ADD "price_minor" integer,
        ADD "currency" character(3),
        ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        ADD "staffId" integer,
        ADD "serviceId" uuid`);

    await queryRunner.query(`
      INSERT INTO "service" ("businessId", "name", "duration_minutes", "price_minor", "active")
      SELECT DISTINCT "businessId", 'Appointment', 60, 0, false
      FROM "booking" WHERE "businessId" IS NOT NULL`);
    // Time and staff from the booked slot; fall back to book_slot + 60 min
    // and the business owner for bookings without a slot.
    await queryRunner.query(`
      UPDATE "booking" b SET
        "start_time" = COALESCE(
          (SELECT s."start_time" FROM "slot" s WHERE s."bookingById" = b."id"),
          b."book_slot"),
        "end_time" = COALESCE(
          (SELECT s."end_time" FROM "slot" s WHERE s."bookingById" = b."id"),
          b."book_slot" + interval '60 minutes'),
        "staffId" = COALESCE(
          (SELECT s."staffId" FROM "slot" s WHERE s."bookingById" = b."id"),
          (SELECT u."id" FROM "users" u WHERE u."businessId" = b."businessId" LIMIT 1)),
        "serviceId" = (
          SELECT svc."id" FROM "service" svc
          WHERE svc."businessId" = b."businessId" AND svc."name" = 'Appointment' AND svc."active" = false
          LIMIT 1),
        "price_minor" = 0,
        "currency" = (SELECT biz."currency" FROM "business" biz WHERE biz."id" = b."businessId")`);
    await queryRunner.query(
      `UPDATE "booking" SET "blocked_until" = "end_time"`,
    );
    await queryRunner.query(`
      UPDATE "booking" SET "duration_minutes" =
        GREATEST(1, EXTRACT(EPOCH FROM ("end_time" - "start_time")) / 60)::int`);
    // Bookings that can't be attributed to a business or staff member.
    await queryRunner.query(
      `DELETE FROM "booking" WHERE "start_time" IS NULL OR "staffId" IS NULL OR "serviceId" IS NULL OR "userId" IS NULL`,
    );
    // Two old bookings of one staff member can't overlap (slots were
    // unique per staff and start), but guard the new constraint anyway.
    await queryRunner.query(`
      UPDATE "booking" a SET "status" = 'cancelled_by_business'
      FROM "booking" b
      WHERE a."staffId" = b."staffId" AND a."id" > b."id"
        AND tstzrange(a."start_time", a."blocked_until") && tstzrange(b."start_time", b."blocked_until")`);

    await queryRunner.query(`
      ALTER TABLE "booking"
        ALTER COLUMN "start_time" SET NOT NULL,
        ALTER COLUMN "end_time" SET NOT NULL,
        ALTER COLUMN "blocked_until" SET NOT NULL,
        ALTER COLUMN "duration_minutes" SET NOT NULL,
        ALTER COLUMN "price_minor" SET NOT NULL,
        ALTER COLUMN "currency" SET NOT NULL,
        ALTER COLUMN "staffId" SET NOT NULL,
        ALTER COLUMN "serviceId" SET NOT NULL,
        ALTER COLUMN "businessId" SET NOT NULL,
        ALTER COLUMN "userId" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "booking" DROP COLUMN "book_slot"`);

    await queryRunner.query(`DROP TABLE "slot"`);
    await queryRunner.query(`DROP TYPE "public"."slot_status_enum"`);

    await queryRunner.query(
      `CREATE INDEX "IDX_6c669f0fc6b986d0c1f9ed8d0c" ON "booking" ("staffId", "start_time")`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ADD CONSTRAINT "booking_no_overlap" EXCLUDE USING gist ("staffId" WITH =, tstzrange("start_time", "blocked_until", '[)') WITH &&) WHERE ("status" = 'confirmed')`,
    );
    for (const fk of [
      `ALTER TABLE "staff_service" ADD CONSTRAINT "FK_236e0fd893445611ae30b67b5ba" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      `ALTER TABLE "staff_service" ADD CONSTRAINT "FK_be30f284db42a00d77ca680c150" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      `ALTER TABLE "service" ADD CONSTRAINT "FK_3eb29dbcdd36a9b99a0ec2c2caa" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      `ALTER TABLE "booking" ADD CONSTRAINT "FK_5fd729b20ca23c8f5cfd2f2f33c" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      `ALTER TABLE "booking" ADD CONSTRAINT "FK_e812cafb996fae4e9636ffe294f" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      `ALTER TABLE "working_hours" ADD CONSTRAINT "FK_f0865cbd77448d0d22386ecf9c1" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      `ALTER TABLE "time_block" ADD CONSTRAINT "FK_e5daaf6a552452bf60bd74e919d" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      `ALTER TABLE "schedule_override" ADD CONSTRAINT "FK_978e46008399235aada88180712" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    ]) {
      await queryRunner.query(fk);
    }
  }

  /**
   * Restores the slot-based schema. Bookings keep their times as book_slot;
   * slots themselves are not recreated (staff regenerate them).
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking" DROP CONSTRAINT "booking_no_overlap"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6c669f0fc6b986d0c1f9ed8d0c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" DROP CONSTRAINT "FK_5fd729b20ca23c8f5cfd2f2f33c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" DROP CONSTRAINT "FK_e812cafb996fae4e9636ffe294f"`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."slot_status_enum" AS ENUM('available', 'booked', 'break')`,
    );
    await queryRunner.query(`
      CREATE TABLE "slot" (
        "id" SERIAL NOT NULL,
        "start_time" TIMESTAMP WITH TIME ZONE NOT NULL,
        "end_time" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" "public"."slot_status_enum" NOT NULL DEFAULT 'available',
        "businessId" uuid,
        "bookingById" uuid,
        "staffId" integer NOT NULL,
        CONSTRAINT "REL_858cbcc0d846ce64f0538f82a5" UNIQUE ("bookingById"),
        CONSTRAINT "UQ_585c9e3b0225b60d8840d896c48" UNIQUE ("staffId", "start_time"),
        CONSTRAINT "PK_5b1f733c4ba831a51f3c114607b" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_8609cf0cc585e27a4ee0e6f343" ON "slot" ("businessId", "start_time")`,
    );
    await queryRunner.query(
      `ALTER TABLE "slot" ADD CONSTRAINT "FK_9e8a52ad9c4fdeacf2cee79c3eb" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "slot" ADD CONSTRAINT "FK_858cbcc0d846ce64f0538f82a59" FOREIGN KEY ("bookingById") REFERENCES "booking"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "slot" ADD CONSTRAINT "FK_5cb02248cb5b5a5dadee2b68d66" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "booking" ADD "book_slot" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`UPDATE "booking" SET "book_slot" = "start_time"`);
    await queryRunner.query(
      `ALTER TABLE "booking" ALTER COLUMN "book_slot" SET NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "booking"
        ALTER COLUMN "businessId" DROP NOT NULL,
        ALTER COLUMN "userId" DROP NOT NULL,
        DROP COLUMN "start_time",
        DROP COLUMN "end_time",
        DROP COLUMN "blocked_until",
        DROP COLUMN "status",
        DROP COLUMN "duration_minutes",
        DROP COLUMN "price_minor",
        DROP COLUMN "currency",
        DROP COLUMN "created_at",
        DROP COLUMN "staffId",
        DROP COLUMN "serviceId"`);
    await queryRunner.query(`DROP TYPE "public"."booking_status_enum"`);

    await queryRunner.query(`DROP TABLE "schedule_override"`);
    await queryRunner.query(`DROP TABLE "time_block"`);
    await queryRunner.query(`DROP TABLE "working_hours"`);
    await queryRunner.query(`DROP TABLE "staff_service"`);
    await queryRunner.query(`DROP TABLE "service"`);
    await queryRunner.query(`ALTER TABLE "business" DROP COLUMN "currency"`);
  }
}
