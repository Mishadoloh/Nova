CREATE TABLE `focus_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`duration_seconds` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user_started` ON `focus_sessions` (`user_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_projects_user_created` ON `projects` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`text` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_user_project` ON `tasks` (`user_id`,`project_id`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`focus_minutes` integer DEFAULT 25 NOT NULL,
	`break_minutes` integer DEFAULT 5 NOT NULL,
	`auto_pomodoro` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL
);
