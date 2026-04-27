CREATE TABLE "frontend-agent-test"."analysis_sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "frontend-agent-test"."analysis_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"feishu_config" jsonb NOT NULL,
	"ai_config" jsonb NOT NULL,
	"system_prompt" text NOT NULL,
	"analysis" text,
	"top_issues" jsonb,
	"total" integer DEFAULT 0 NOT NULL,
	"records" jsonb,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "frontend-agent-test"."analysis_prompts" CASCADE;--> statement-breakpoint
DROP TABLE "frontend-agent-test"."analysis_results" CASCADE;--> statement-breakpoint
DROP TABLE "frontend-agent-test"."feedback_records" CASCADE;--> statement-breakpoint
DROP TABLE "frontend-agent-test"."system_configs" CASCADE;--> statement-breakpoint
DROP TABLE "frontend-agent-test"."users" CASCADE;