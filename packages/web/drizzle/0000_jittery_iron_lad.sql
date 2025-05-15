CREATE TABLE "conversationParticipants" (
	"conversationId" integer NOT NULL,
	"participantId" integer NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	CONSTRAINT "conversationParticipants_conversationId_participantId_pk" PRIMARY KEY("conversationId","participantId")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"type" varchar NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dialogues" (
	"conversationId" integer PRIMARY KEY NOT NULL,
	"initiatorId" integer NOT NULL,
	"participantId" integer NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pushReceivers" (
	"claimerId" integer,
	"id" serial PRIMARY KEY NOT NULL,
	"token" uuid NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "pushReceivers_claimerId_unique" UNIQUE("claimerId"),
	CONSTRAINT "pushReceivers_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "pushSubscriptions" (
	"pushId" integer NOT NULL,
	"receiverId" integer NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	CONSTRAINT "pushSubscriptions_pushId_receiverId_pk" PRIMARY KEY("pushId","receiverId")
);
--> statement-breakpoint
CREATE TABLE "pushes" (
	"businessId" integer NOT NULL,
	"businessType" varchar NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "renewalSchedules" (
	"businessId" integer NOT NULL,
	"businessType" varchar NOT NULL,
	"scheduleBarrier" timestamp with time zone NOT NULL,
	"targetExpiresAt" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "renewalSchedules_businessType_businessId_pk" PRIMARY KEY("businessType","businessId")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversationParticipants" ADD CONSTRAINT "conversationParticipants_conversationId_conversations_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pushSubscriptions" ADD CONSTRAINT "pushSubscriptions_pushId_pushes_id_fk" FOREIGN KEY ("pushId") REFERENCES "public"."pushes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pushSubscriptions" ADD CONSTRAINT "pushSubscriptions_receiverId_pushReceivers_id_fk" FOREIGN KEY ("receiverId") REFERENCES "public"."pushReceivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversationParticipants_participantId_conversationId_index" ON "conversationParticipants" USING btree ("participantId","conversationId");--> statement-breakpoint
CREATE INDEX "conversationParticipants_expiresAt_index" ON "conversationParticipants" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "conversations_type_index" ON "conversations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "conversations_expiresAt_index" ON "conversations" USING btree ("expiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX "dialogues_initiatorId_participantId_index" ON "dialogues" USING btree ("initiatorId","participantId");--> statement-breakpoint
CREATE UNIQUE INDEX "dialogues_participantId_initiatorId_index" ON "dialogues" USING btree ("participantId","initiatorId");--> statement-breakpoint
CREATE INDEX "dialogues_expiresAt_index" ON "dialogues" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "pushReceivers_expiresAt_index" ON "pushReceivers" USING btree ("expiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX "pushSubscriptions_receiverId_pushId_index" ON "pushSubscriptions" USING btree ("receiverId","pushId");--> statement-breakpoint
CREATE UNIQUE INDEX "pushes_businessType_businessId_index" ON "pushes" USING btree ("businessType","businessId");--> statement-breakpoint
CREATE UNIQUE INDEX "pushes_businessId_businessType_index" ON "pushes" USING btree ("businessId","businessType");--> statement-breakpoint
CREATE INDEX "pushes_expiresAt_index" ON "pushes" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "renewalSchedules_scheduleBarrier_index" ON "renewalSchedules" USING btree ("scheduleBarrier" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "renewalSchedules_expiresAt_index" ON "renewalSchedules" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "users_expiresAt_index" ON "users" USING btree ("expiresAt");