CREATE TABLE `activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`label` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_activity_user_created` ON `activity_log` (`user_id`,`created_at`);