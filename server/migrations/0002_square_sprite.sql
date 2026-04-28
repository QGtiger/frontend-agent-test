CREATE TABLE "frontend-agent-test"."feishu_image_mapping" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "frontend-agent-test"."feishu_image_mapping_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"feishu_url" text NOT NULL,
	"oss_url" text NOT NULL,
	"file_name" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feishu_image_mapping_feishu_url_unique" UNIQUE("feishu_url")
);
