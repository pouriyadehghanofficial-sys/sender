"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingKeys = void 0;
exports.getSetting = getSetting;
exports.setSetting = setSetting;
exports.getAllSettings = getAllSettings;
const client_1 = require("./client");
async function getSetting(key) {
    const row = await client_1.prisma.setting.findUnique({ where: { key } });
    return row?.value ?? null;
}
async function setSetting(key, value) {
    return client_1.prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
    });
}
async function getAllSettings() {
    const rows = await client_1.prisma.setting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
/** کلیدهای شناخته‌شده‌ی تنظیمات عمومی پروژه */
exports.SettingKeys = {
    BALE_BOT_TOKEN: "bale_bot_token",
    BALE_SAFIR_KEY: "bale_safir_key",
    ADMIN_NOTIFY_TARGET: "admin_notify_target",
    ADMIN_NOTIFY_METHOD: "admin_notify_method",
    SMTP_HOST: "smtp_host",
    SMTP_PORT: "smtp_port",
    SMTP_USER: "smtp_user",
    SMTP_PASS: "smtp_pass",
    SMTP_FROM: "smtp_from",
    ESCALATION_MESSAGE_THRESHOLD: "escalation_message_threshold",
    ESCALATION_KEYWORDS: "escalation_keywords",
    ESCALATION_CUSTOM_INSTRUCTIONS: "escalation_custom_instructions",
};
