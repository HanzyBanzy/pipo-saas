-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('TRIAL', 'STARTER', 'GROWTH', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PersonalityMode" AS ENUM ('PROFESSIONAL', 'FRIENDLY', 'CONCIERGE', 'MINIMAL');

-- CreateEnum
CREATE TYPE "KnowledgeCategory" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'HOUSE_RULES', 'WIFI', 'PARKING', 'AMENITIES', 'LOCAL_AREA', 'EMERGENCY', 'FAQ', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('PUBLIC', 'AI_READABLE', 'STAFF_ONLY', 'ENCRYPTED');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WEB_CHAT', 'WHATSAPP', 'LINE', 'EMAIL', 'SMS', 'DIRECT');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'RESOLVED', 'ESCALATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('GUEST', 'AI', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EscalationUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "EscalationTrigger" AS ENUM ('AI_REQUESTED', 'KEYWORD_MATCH', 'SENTIMENT_THRESHOLD', 'TIMEOUT', 'MANUAL', 'SECURITY_VIOLATION');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('WHATSAPP_TWILIO', 'LINE', 'GOOGLE_CALENDAR', 'BOOKING_COM', 'AIRBNB', 'STRIPE', 'CUSTOM_WEBHOOK');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR', 'PENDING_SETUP');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'TRIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "invitedEmail" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'ACTIVE',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "personalityMode" "PersonalityMode" NOT NULL DEFAULT 'CONCIERGE',
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "webChatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "brandColor" TEXT,
    "systemPromptExtra" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeItem" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "KnowledgeCategory" NOT NULL,
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'AI_READABLE',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "language" TEXT NOT NULL DEFAULT 'en',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "embedding" vector(1536),
    "embeddingModel" TEXT,
    "embeddedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeVersion" (
    "id" TEXT NOT NULL,
    "knowledgeItemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "savedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretItem" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "authTag" BYTEA NOT NULL,
    "guestHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecretItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "externalConversationId" TEXT,
    "guestName" TEXT,
    "guestIdentifier" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "sourceItemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "injectionScore" DOUBLE PRECISION,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escalation" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "trigger" "EscalationTrigger" NOT NULL,
    "urgency" "EscalationUrgency" NOT NULL DEFAULT 'MEDIUM',
    "status" "EscalationStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Escalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationRule" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "EscalationTrigger" NOT NULL,
    "urgency" "EscalationUrgency" NOT NULL DEFAULT 'MEDIUM',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscalationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING_SETUP',
    "credentials" BYTEA NOT NULL,
    "credentialsIv" BYTEA NOT NULL,
    "credentialsTag" BYTEA NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "lastSyncAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyIntegration" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundWebhookEvent" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundWebhook" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "signingSecret" BYTEA NOT NULL,
    "signingIv" BYTEA NOT NULL,
    "signingTag" BYTEA NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'user',
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "traceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestScenario" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userMessage" TEXT NOT NULL,
    "expectedTags" TEXT[],
    "isSecurity" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QAResult" (
    "id" TEXT NOT NULL,
    "qaRunId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "actualReply" TEXT NOT NULL,
    "violations" TEXT[],
    "latencyMs" INTEGER,
    "tokensUsed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QAResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QARun" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "triggeredById" TEXT,
    "totalScenarios" INTEGER NOT NULL,
    "passed" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "blockedDeploy" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "QARun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_clerkId_idx" ON "User"("clerkId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Property_organizationId_idx" ON "Property"("organizationId");

-- CreateIndex
CREATE INDEX "Property_status_idx" ON "Property"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Property_organizationId_slug_key" ON "Property"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "KnowledgeItem_propertyId_idx" ON "KnowledgeItem"("propertyId");

-- CreateIndex
CREATE INDEX "KnowledgeItem_propertyId_category_idx" ON "KnowledgeItem"("propertyId", "category");

-- CreateIndex
CREATE INDEX "KnowledgeItem_propertyId_isPublished_idx" ON "KnowledgeItem"("propertyId", "isPublished");

-- CreateIndex
CREATE INDEX "KnowledgeItem_accessLevel_idx" ON "KnowledgeItem"("accessLevel");

-- CreateIndex
CREATE INDEX "KnowledgeVersion_knowledgeItemId_idx" ON "KnowledgeVersion"("knowledgeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeVersion_knowledgeItemId_version_key" ON "KnowledgeVersion"("knowledgeItemId", "version");

-- CreateIndex
CREATE INDEX "SecretItem_propertyId_idx" ON "SecretItem"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "SecretItem_propertyId_key_key" ON "SecretItem"("propertyId", "key");

-- CreateIndex
CREATE INDEX "Conversation_propertyId_idx" ON "Conversation"("propertyId");

-- CreateIndex
CREATE INDEX "Conversation_propertyId_status_idx" ON "Conversation"("propertyId", "status");

-- CreateIndex
CREATE INDEX "Conversation_externalConversationId_idx" ON "Conversation"("externalConversationId");

-- CreateIndex
CREATE INDEX "Conversation_createdAt_idx" ON "Conversation"("createdAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Escalation_conversationId_idx" ON "Escalation"("conversationId");

-- CreateIndex
CREATE INDEX "Escalation_status_idx" ON "Escalation"("status");

-- CreateIndex
CREATE INDEX "Escalation_urgency_idx" ON "Escalation"("urgency");

-- CreateIndex
CREATE INDEX "Escalation_createdAt_idx" ON "Escalation"("createdAt");

-- CreateIndex
CREATE INDEX "EscalationRule_propertyId_idx" ON "EscalationRule"("propertyId");

-- CreateIndex
CREATE INDEX "EscalationRule_propertyId_isActive_idx" ON "EscalationRule"("propertyId", "isActive");

-- CreateIndex
CREATE INDEX "Integration_organizationId_idx" ON "Integration"("organizationId");

-- CreateIndex
CREATE INDEX "Integration_organizationId_type_idx" ON "Integration"("organizationId", "type");

-- CreateIndex
CREATE INDEX "Integration_status_idx" ON "Integration"("status");

-- CreateIndex
CREATE INDEX "PropertyIntegration_propertyId_idx" ON "PropertyIntegration"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyIntegration_integrationId_idx" ON "PropertyIntegration"("integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyIntegration_propertyId_integrationId_key" ON "PropertyIntegration"("propertyId", "integrationId");

-- CreateIndex
CREATE INDEX "InboundWebhookEvent_integrationId_idx" ON "InboundWebhookEvent"("integrationId");

-- CreateIndex
CREATE INDEX "InboundWebhookEvent_processedAt_idx" ON "InboundWebhookEvent"("processedAt");

-- CreateIndex
CREATE INDEX "InboundWebhookEvent_createdAt_idx" ON "InboundWebhookEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InboundWebhookEvent_integrationId_externalId_key" ON "InboundWebhookEvent"("integrationId", "externalId");

-- CreateIndex
CREATE INDEX "OutboundWebhook_organizationId_idx" ON "OutboundWebhook"("organizationId");

-- CreateIndex
CREATE INDEX "OutboundWebhook_organizationId_isActive_idx" ON "OutboundWebhook"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_traceId_idx" ON "AuditLog"("traceId");

-- CreateIndex
CREATE INDEX "TestScenario_propertyId_idx" ON "TestScenario"("propertyId");

-- CreateIndex
CREATE INDEX "TestScenario_propertyId_isSecurity_idx" ON "TestScenario"("propertyId", "isSecurity");

-- CreateIndex
CREATE INDEX "QAResult_qaRunId_idx" ON "QAResult"("qaRunId");

-- CreateIndex
CREATE INDEX "QAResult_scenarioId_idx" ON "QAResult"("scenarioId");

-- CreateIndex
CREATE INDEX "QARun_propertyId_idx" ON "QARun"("propertyId");

-- CreateIndex
CREATE INDEX "QARun_startedAt_idx" ON "QARun"("startedAt");

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItem" ADD CONSTRAINT "KnowledgeItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeVersion" ADD CONSTRAINT "KnowledgeVersion_knowledgeItemId_fkey" FOREIGN KEY ("knowledgeItemId") REFERENCES "KnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretItem" ADD CONSTRAINT "SecretItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escalation" ADD CONSTRAINT "Escalation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationRule" ADD CONSTRAINT "EscalationRule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIntegration" ADD CONSTRAINT "PropertyIntegration_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIntegration" ADD CONSTRAINT "PropertyIntegration_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundWebhookEvent" ADD CONSTRAINT "InboundWebhookEvent_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QAResult" ADD CONSTRAINT "QAResult_qaRunId_fkey" FOREIGN KEY ("qaRunId") REFERENCES "QARun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QAResult" ADD CONSTRAINT "QAResult_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "TestScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
