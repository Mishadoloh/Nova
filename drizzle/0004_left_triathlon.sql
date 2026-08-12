CREATE INDEX `idx_events_user_project_starts` ON `calendar_events` (`user_id`,`project_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_project_started` ON `focus_sessions` (`user_id`,`project_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_tasks_user_status_sort` ON `tasks` (`user_id`,`status`,`sort_order`);