CREATE TABLE "frontend-agent-test"."kb_feedback" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "frontend-agent-test"."kb_feedback_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kb_cache_id" integer NOT NULL,
	"group" varchar(20) NOT NULL,
	"score" integer NOT NULL,
	"reason" text,
	"supplement" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
