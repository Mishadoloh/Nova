CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`focus_area` text DEFAULT 'work' NOT NULL,
	`timezone` text DEFAULT 'Europe/Kyiv' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
