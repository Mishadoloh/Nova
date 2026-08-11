ALTER TABLE `user_preferences` ADD `active_project_id` text;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `timer_mode` text DEFAULT 'focus' NOT NULL;