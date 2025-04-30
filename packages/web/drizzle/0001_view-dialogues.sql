-- Custom SQL migration file, put your code below! --

-- 创建触发器函数：处理 conversations 表的删除和 expiredAt 更新
CREATE FUNCTION handle_conversation_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- 如果是 DELETE 操作，删除对应的 dialogues
    IF (TG_OP = 'DELETE') THEN
        DELETE FROM "dialogues"
        WHERE "conversationId" = OLD."id";
    END IF;

    -- 如果是 UPDATE 操作，且更新了 expiredAt，更新 dialogues 的 expiredAt
    IF (TG_OP = 'UPDATE' AND NEW."expiredAt" IS DISTINCT FROM OLD."expiredAt") THEN
        UPDATE "dialogues"
        SET "expiredAt" = NEW."expiredAt"
        WHERE "conversationId" = NEW."id";
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 conversations 表创建触发器
CREATE TRIGGER trigger_handle_conversation_changes
AFTER DELETE OR UPDATE OF "expiredAt" ON "conversations"
FOR EACH ROW
EXECUTE FUNCTION handle_conversation_changes();

-- 创建触发器函数：处理 conversationParticipants 表的插入
CREATE FUNCTION handle_participant_inserts()
RETURNS TRIGGER AS $$
BEGIN
    -- 检查是否有对应的 conversation 且 type 为 'dialogue'
    IF EXISTS (
        SELECT 1
        FROM "conversations"
        WHERE "id" = NEW."conversationId" AND "type" = 'dialogue'
    ) THEN
        -- 插入 dialogues 表，按照 createdAt 的顺序决定 initiatorId 和 participantId
        INSERT INTO "dialogues" ("conversationId", "initiatorId", "participantId", "expiredAt")
        SELECT
            c."id" AS "conversationId",
            cp1."participantId" AS "initiatorId",
            cp2."participantId" AS "participantId",
            c."expiredAt" AS "expiredAt"
        FROM
            "conversations" c
        JOIN (
            SELECT *
            FROM "conversationParticipants"
            WHERE "conversationId" = NEW."conversationId"
            ORDER BY "createdAt" ASC
            LIMIT 2
        ) cp1 ON TRUE
        JOIN (
            SELECT *
            FROM "conversationParticipants"
            WHERE "conversationId" = NEW."conversationId"
            ORDER BY "createdAt" ASC
            OFFSET 1
            LIMIT 1
        ) cp2 ON TRUE
        WHERE
            c."id" = NEW."conversationId"
            AND cp1."participantId" <> cp2."participantId"
        ON CONFLICT ("conversationId") DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 conversationParticipants 表创建触发器
CREATE TRIGGER trigger_handle_participant_inserts
AFTER INSERT ON "conversationParticipants"
FOR EACH ROW
EXECUTE FUNCTION handle_participant_inserts();