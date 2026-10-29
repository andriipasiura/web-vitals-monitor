CREATE INDEX "event_rollups_hourly_project_metric_hour_idx" ON "event_rollups_hourly" USING btree ("project_id","metric","hour");--> statement-breakpoint
CREATE INDEX "events_project_route_metric_idx" ON "events" USING btree ("project_id","route","metric");--> statement-breakpoint
CREATE INDEX "events_received_at_brin" ON "events" USING brin ("received_at");