CREATE TABLE "event_rollups_hourly" (
	"project_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"route" text NOT NULL,
	"device_type" text NOT NULL,
	"release" text,
	"hour" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	"good_count" integer NOT NULL,
	"ni_count" integer NOT NULL,
	"poor_count" integer NOT NULL,
	"sum_value" double precision NOT NULL,
	"buckets" integer[] NOT NULL,
	CONSTRAINT "event_rollups_hourly_key" UNIQUE NULLS NOT DISTINCT("project_id","metric","route","device_type","release","hour")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigint GENERATED ALWAYS AS IDENTITY (sequence name "events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"project_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"value" double precision NOT NULL,
	"rating" text NOT NULL,
	"path" text NOT NULL,
	"route" text NOT NULL,
	"route_source" text NOT NULL,
	"device_type" text NOT NULL,
	"connection_type" text,
	"release" text,
	"attribution" jsonb,
	"client_event_id" uuid NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"client_timestamp" timestamp with time zone,
	CONSTRAINT "events_id_received_at_pk" PRIMARY KEY("id","received_at")
) PARTITION BY RANGE ("received_at");
--> statement-breakpoint
ALTER TABLE "event_rollups_hourly" ADD CONSTRAINT "event_rollups_hourly_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;