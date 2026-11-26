CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`occurred_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`event` text NOT NULL,
	`user_id` text,
	`bookmark_id` text,
	`reason` text
);
--> statement-breakpoint
CREATE TRIGGER `audit_session_started`
AFTER INSERT ON `session`
BEGIN
	INSERT INTO `audit_events` (`event`, `user_id`)
	VALUES ('auth.session_started', NEW.`userId`);
END;
--> statement-breakpoint
CREATE TRIGGER `audit_session_ended`
AFTER DELETE ON `session`
BEGIN
	INSERT INTO `audit_events` (`event`, `user_id`)
	VALUES ('auth.session_ended', OLD.`userId`);
END;
