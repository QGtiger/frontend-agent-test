CREATE TABLE "frontend-agent-test"."analysis_prompts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "frontend-agent-test"."analysis_prompts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"system_prompt" text NOT NULL,
	"model" varchar(100) DEFAULT 'deepseek-chat' NOT NULL,
	"temperature" double precision DEFAULT 0.7 NOT NULL,
	"max_tokens" integer DEFAULT 4096 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "frontend-agent-test"."analysis_results" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "frontend-agent-test"."analysis_results_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"prompt_id" integer NOT NULL,
	"analysis_mode" varchar(50) DEFAULT 'full' NOT NULL,
	"summary" text,
	"top_issues" jsonb,
	"total_analyzed" integer DEFAULT 0 NOT NULL,
	"raw_response" text,
	"analyzed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "frontend-agent-test"."feedback_records" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "frontend-agent-test"."feedback_records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"record_id" varchar(255) NOT NULL,
	"description" text,
	"detail" text,
	"images" jsonb,
	"investigation" text,
	"raw_data" jsonb,
	"analyzed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_records_record_id_unique" UNIQUE("record_id")
);
--> statement-breakpoint
CREATE TABLE "frontend-agent-test"."system_configs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "frontend-agent-test"."system_configs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"config_key" varchar(255) NOT NULL,
	"config_value" text NOT NULL,
	"description" varchar(500),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_configs_config_key_unique" UNIQUE("config_key")
);
--> statement-breakpoint
CREATE TABLE "frontend-agent-test"."users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "frontend-agent-test"."users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" varchar(255) NOT NULL,
	"displayName" varchar(255) NOT NULL,
	"phone" varchar(50),
	"remark" varchar(500),
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);