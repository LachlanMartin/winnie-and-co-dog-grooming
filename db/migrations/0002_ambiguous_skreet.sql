ALTER TABLE "bookings" ADD COLUMN "order_id" text;--> statement-breakpoint
CREATE INDEX "bookings_order_idx" ON "bookings" USING btree ("order_id");