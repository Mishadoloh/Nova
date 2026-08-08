CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text,
	`title` text NOT NULL,
	`starts_at` integer NOT NULL,
	`duration_minutes` integer NOT NULL,
	`recurrence` text,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_events_user_starts` ON `calendar_events` (`user_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `sync_meta` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`focus_minutes` integer DEFAULT 25 NOT NULL,
	`break_minutes` integer DEFAULT 5 NOT NULL,
	`auto_pomodoro` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_user_preferences`("user_id", "focus_minutes", "break_minutes", "auto_pomodoro", "updated_at") SELECT "user_id", "focus_minutes", "break_minutes", "auto_pomodoro", "updated_at" FROM `user_preferences`;--> statement-breakpoint
DROP TABLE `user_preferences`;--> statement-breakpoint
ALTER TABLE `__new_user_preferences` RENAME TO `user_preferences`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `projects` ADD `deadline` integer;--> statement-breakpoint
ALTER TABLE `projects` ADD `archived` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `status` text DEFAULT 'todo' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `deadline` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `recurrence` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `updated_at` integer DEFAULT 0 NOT NULL;