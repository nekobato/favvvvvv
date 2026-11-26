CREATE TABLE `dashboard_sections` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `column_count` integer DEFAULT 1 NOT NULL CONSTRAINT "dashboard_sections_column_count" CHECK (`column_count` IN (1, 2, 3)),
  `created_at` integer NOT NULL,
  `sort_order` integer
);
--> statement-breakpoint
CREATE INDEX `dashboard_sections_user_sort_idx` ON `dashboard_sections` (`user_id`, `sort_order`, `created_at`, `id`);
--> statement-breakpoint
ALTER TABLE `audit_events` ADD COLUMN `section_id` text;
--> statement-breakpoint
ALTER TABLE `bookmark_groups` ADD COLUMN `column_count` integer DEFAULT 1 NOT NULL
  CONSTRAINT "bookmark_groups_column_count" CHECK (`column_count` IN (1, 2, 3));
--> statement-breakpoint
ALTER TABLE `bookmark_groups` ADD COLUMN `section_id` text REFERENCES `dashboard_sections`(`id`);
--> statement-breakpoint
ALTER TABLE `bookmarks` ADD COLUMN `section_id` text REFERENCES `dashboard_sections`(`id`)
  CONSTRAINT "bookmarks_single_parent" CHECK (`group_id` IS NULL OR `section_id` IS NULL);
--> statement-breakpoint
CREATE INDEX `bookmark_groups_user_section_sort_idx` ON `bookmark_groups` (`user_id`, `section_id`, `sort_order`);
--> statement-breakpoint
CREATE INDEX `bookmarks_user_section_sort_idx` ON `bookmarks` (`user_id`, `section_id`, `sort_order`);
--> statement-breakpoint
-- A single section per existing dashboard preserves the order and membership of its groups.
INSERT INTO `dashboard_sections` (`id`, `user_id`, `created_at`)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
             substr(hex(randomblob(2)), 2) || '-8' || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
       `user_id`, min(`created_at`)
FROM `bookmark_groups`
GROUP BY `user_id`;
--> statement-breakpoint
UPDATE `bookmark_groups`
SET `section_id` = `dashboard_sections`.`id`
FROM `dashboard_sections`
WHERE `bookmark_groups`.`user_id` = `dashboard_sections`.`user_id`
  AND `bookmark_groups`.`section_id` IS NULL;
