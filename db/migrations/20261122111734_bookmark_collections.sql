CREATE TABLE `collection_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`collection_id` text NOT NULL,
	`link_id` text NOT NULL,
	`added_at` integer NOT NULL,
	FOREIGN KEY (`user_id`,`collection_id`) REFERENCES `collections`(`user_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`,`link_id`) REFERENCES `saved_links`(`user_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collection_entries_collection_link_idx` ON `collection_entries` (`collection_id`,`link_id`);--> statement-breakpoint
CREATE INDEX `collection_entries_user_collection_added_idx` ON `collection_entries` (`user_id`,`collection_id`,`added_at`,`id`);--> statement-breakpoint
CREATE INDEX `collection_entries_user_link_idx` ON `collection_entries` (`user_id`,`link_id`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_user_id_idx` ON `collections` (`user_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `collections_user_name_idx` ON `collections` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `saved_links` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`thumbnail_type` text,
	`thumbnail` blob,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_links_user_id_idx` ON `saved_links` (`user_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `saved_links_user_url_idx` ON `saved_links` (`user_id`,`url`);--> statement-breakpoint
CREATE INDEX `saved_links_user_created_idx` ON `saved_links` (`user_id`,`created_at`,`id`);--> statement-breakpoint
ALTER TABLE `audit_events` ADD `collection_id` text;--> statement-breakpoint
ALTER TABLE `audit_events` ADD `link_id` text;
