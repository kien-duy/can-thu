CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"species_id" text NOT NULL,
	"location_id" text NOT NULL,
	"weight_g" integer NOT NULL,
	"caught_at" timestamp with time zone NOT NULL,
	"local_hour" smallint NOT NULL,
	"weather_kind" text NOT NULL,
	"water_temp_c" numeric(4, 1),
	"depth_cm" integer,
	"bait" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rig" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fate" text DEFAULT 'kept' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catch_weight" CHECK ("catches"."weight_g" > 0),
	CONSTRAINT "catch_hour" CHECK ("catches"."local_hour" between 0 and 23),
	CONSTRAINT "catch_weather" CHECK ("catches"."weather_kind" in ('sunny','cloudy','rain','storm','fog')),
	CONSTRAINT "catch_depth" CHECK ("catches"."depth_cm" is null or "catches"."depth_cm" between 0 and 2000),
	CONSTRAINT "catch_fate" CHECK ("catches"."fate" in ('kept','released','sold'))
);
--> statement-breakpoint
CREATE TABLE "fishing_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"location_id" text NOT NULL,
	"kind" text NOT NULL,
	"ticket_coins" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"planned_end_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"outcome" text,
	"earned_coins" integer DEFAULT 0 NOT NULL,
	"weather" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_kind" CHECK ("fishing_sessions"."kind" in ('paid_shift','free')),
	CONSTRAINT "session_outcome" CHECK ("fishing_sessions"."outcome" is null or "fishing_sessions"."outcome" in ('sold','released','mixed','abandoned')),
	CONSTRAINT "session_coins" CHECK ("fishing_sessions"."ticket_coins" >= 0 and "fishing_sessions"."earned_coins" >= 0),
	CONSTRAINT "paid_has_end" CHECK ("fishing_sessions"."kind" = 'free' or "fishing_sessions"."planned_end_at" is not null),
	CONSTRAINT "end_after_start" CHECK ("fishing_sessions"."ended_at" is null or "fishing_sessions"."ended_at" >= "fishing_sessions"."started_at"),
	CONSTRAINT "planned_after_start" CHECK ("fishing_sessions"."planned_end_at" is null or "fishing_sessions"."planned_end_at" > "fishing_sessions"."started_at")
);
--> statement-breakpoint
CREATE TABLE "player_state" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"coins" integer DEFAULT 500 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"state_schema" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_state_nonneg" CHECK ("player_state"."version" >= 0 and "player_state"."coins" >= 0 and "player_state"."xp" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_guest" boolean DEFAULT true NOT NULL,
	"email" text,
	"password_hash" text,
	"google_sub" text,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "display_name_length" CHECK ("users"."display_name" is null or char_length("users"."display_name") between 2 and 24),
	CONSTRAINT "account_has_login" CHECK ("users"."is_guest" or "users"."password_hash" is not null or "users"."google_sub" is not null)
);
--> statement-breakpoint
CREATE TABLE "wildlife_sightings" (
	"user_id" uuid NOT NULL,
	"creature_id" text NOT NULL,
	"first_location" text NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"times_seen" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "wildlife_sightings_user_id_creature_id_pk" PRIMARY KEY("user_id","creature_id"),
	CONSTRAINT "sighting_times" CHECK ("wildlife_sightings"."times_seen" > 0)
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catches" ADD CONSTRAINT "catches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catches" ADD CONSTRAINT "catches_session_id_fishing_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."fishing_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fishing_sessions" ADD CONSTRAINT "fishing_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_state" ADD CONSTRAINT "player_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wildlife_sightings" ADD CONSTRAINT "wildlife_sightings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_sessions_user" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_expires" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "catches_user_caught" ON "catches" USING btree ("user_id","caught_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "catches_user_species_weight" ON "catches" USING btree ("user_id","species_id","weight_g" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "catches_session" ON "catches" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "fishing_sessions_user_started" ON "fishing_sessions" USING btree ("user_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "one_open_session_per_user" ON "fishing_sessions" USING btree ("user_id") WHERE "fishing_sessions"."ended_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_google_sub" ON "users" USING btree ("google_sub");