CREATE TABLE `bookmark_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`layout` text DEFAULT 'list-small' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bookmark_groups_user_created_idx` ON `bookmark_groups` (`user_id`,`created_at`,`id`);
--> statement-breakpoint
ALTER TABLE `audit_events` ADD `group_id` text;
--> statement-breakpoint
ALTER TABLE `bookmarks` ADD `group_id` text REFERENCES `bookmark_groups`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX `bookmarks_user_group_created_idx` ON `bookmarks` (`user_id`,`group_id`,`created_at`,`id`);
