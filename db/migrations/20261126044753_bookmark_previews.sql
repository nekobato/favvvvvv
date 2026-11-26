CREATE TABLE `bookmark_previews` (
	`bookmark_id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`revision` text NOT NULL,
	`favicon_type` text,
	`favicon` blob,
	`thumbnail_type` text,
	`thumbnail` blob,
	FOREIGN KEY (`bookmark_id`) REFERENCES `bookmarks`(`id`) ON UPDATE no action ON DELETE cascade
);
