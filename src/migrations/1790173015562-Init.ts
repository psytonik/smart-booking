import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1790173015562 implements MigrationInterface {
  name = 'Init1790173015562';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "booking" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "book_slot" TIMESTAMP NOT NULL,
                "businessId" uuid,
                "userId" integer,
                CONSTRAINT "PK_49171efc69702ed84c812f33540" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "users" (
                "id" SERIAL NOT NULL,
                "email" character varying NOT NULL,
                "password" character varying NOT NULL,
                "role" character varying NOT NULL DEFAULT 'client',
                "information" character varying,
                "businessId" uuid,
                "workplaceId" uuid,
                CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
                CONSTRAINT "REL_78725ac7117e7526e028014606" UNIQUE ("businessId"),
                CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "location" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "lat" double precision NOT NULL,
                "lng" double precision NOT NULL,
                CONSTRAINT "PK_876d7bdba03c72251ec4c2dc827" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "business" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "slug" character varying NOT NULL,
                "description" character varying NOT NULL,
                "address" text NOT NULL,
                "email" character varying NOT NULL,
                "phone_number" character varying NOT NULL,
                "featured" boolean NOT NULL DEFAULT false,
                "coordsId" uuid,
                CONSTRAINT "UQ_84a9cab71052a72adadf392d14e" UNIQUE ("slug"),
                CONSTRAINT "REL_dd3b6bc2fdf4fa7aa8abcfd449" UNIQUE ("coordsId"),
                CONSTRAINT "PK_0bd850da8dafab992e2e9b058e5" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."slot_status_enum" AS ENUM('0', '1')
        `);
    await queryRunner.query(`
            CREATE TABLE "slot" (
                "id" SERIAL NOT NULL,
                "start_time" TIMESTAMP NOT NULL,
                "end_time" TIMESTAMP NOT NULL,
                "status" "public"."slot_status_enum" NOT NULL DEFAULT '0',
                "businessId" uuid,
                "bookingById" uuid,
                CONSTRAINT "UQ_8609cf0cc585e27a4ee0e6f3431" UNIQUE ("businessId", "start_time"),
                CONSTRAINT "REL_858cbcc0d846ce64f0538f82a5" UNIQUE ("bookingById"),
                CONSTRAINT "PK_5b1f733c4ba831a51f3c114607b" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "booking"
            ADD CONSTRAINT "FK_04cb78eea3f46cb1a7d3a868ba2" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "booking"
            ADD CONSTRAINT "FK_336b3f4a235460dc93645fbf222" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD CONSTRAINT "FK_78725ac7117e7526e028014606b" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD CONSTRAINT "FK_3972c26ecc9b16bd9b6f2b24107" FOREIGN KEY ("workplaceId") REFERENCES "business"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "business"
            ADD CONSTRAINT "FK_dd3b6bc2fdf4fa7aa8abcfd449a" FOREIGN KEY ("coordsId") REFERENCES "location"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "slot"
            ADD CONSTRAINT "FK_9e8a52ad9c4fdeacf2cee79c3eb" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "slot"
            ADD CONSTRAINT "FK_858cbcc0d846ce64f0538f82a59" FOREIGN KEY ("bookingById") REFERENCES "booking"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "slot" DROP CONSTRAINT "FK_858cbcc0d846ce64f0538f82a59"
        `);
    await queryRunner.query(`
            ALTER TABLE "slot" DROP CONSTRAINT "FK_9e8a52ad9c4fdeacf2cee79c3eb"
        `);
    await queryRunner.query(`
            ALTER TABLE "business" DROP CONSTRAINT "FK_dd3b6bc2fdf4fa7aa8abcfd449a"
        `);
    await queryRunner.query(`
            ALTER TABLE "users" DROP CONSTRAINT "FK_3972c26ecc9b16bd9b6f2b24107"
        `);
    await queryRunner.query(`
            ALTER TABLE "users" DROP CONSTRAINT "FK_78725ac7117e7526e028014606b"
        `);
    await queryRunner.query(`
            ALTER TABLE "booking" DROP CONSTRAINT "FK_336b3f4a235460dc93645fbf222"
        `);
    await queryRunner.query(`
            ALTER TABLE "booking" DROP CONSTRAINT "FK_04cb78eea3f46cb1a7d3a868ba2"
        `);
    await queryRunner.query(`
            DROP TABLE "slot"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."slot_status_enum"
        `);
    await queryRunner.query(`
            DROP TABLE "business"
        `);
    await queryRunner.query(`
            DROP TABLE "location"
        `);
    await queryRunner.query(`
            DROP TABLE "users"
        `);
    await queryRunner.query(`
            DROP TABLE "booking"
        `);
  }
}
