ALTER TABLE `bookmark_groups` ADD `sort_order` integer;
--> statement-breakpoint
CREATE INDEX `bookmark_groups_user_sort_idx` ON `bookmark_groups` (`user_id`,`sort_order`,`created_at`,`id`);
--> statement-breakpoint
ALTER TABLE `bookmarks` ADD `sort_order` integer;
--> statement-breakpoint
CREATE INDEX `bookmarks_user_group_sort_idx` ON `bookmarks` (`user_id`,`group_id`,`sort_order`);
