"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCampaignRunning = isCampaignRunning;
exports.sendCampaign = sendCampaign;
exports.isTenantCampaignRunning = isTenantCampaignRunning;
exports.runTenantCampaign = runTenantCampaign;
const contactRepository_1 = require("../db/contactRepository");
const productRepository_1 = require("../db/productRepository");
const settingsRepository_1 = require("../db/settingsRepository");
const baleSafirClient_1 = require("../providers/baleSafirClient");
const enums_1 = require("../db/enums");
const campaignRepository_1 = require("../db/campaignRepository");
const activityLogRepository_1 = require("../db/activityLogRepository");
const DELAY_BETWEEN_MESSAGES_MS = 1500;
/**
 * قفل ساده درون‌حافظه‌ای: از اجرای دو کمپین هم‌زمان روی یک محصول جلوگیری می‌کند.
 * چون sendCampaign فقط مخاطبین status='pending' را می‌فرستد، اگر سرور وسط کار
 * (قطعی برق/اینترنت/کرش) از کار بیفتد، کافیست دوباره همین تابع صدا زده شود —
 * خودش از همان‌جا که مانده ادامه می‌دهد؛ نیازی به ذخیره progress جداگانه نیست.
 */
const runningCampaigns = new Set();
function isCampaignRunning(productId) {
    return runningCampaigns.has(productId);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function truncate(text, max) {
    return text.length > max ? text.slice(0, max) + "..." : text;
}
/**
 * ارسال گروهی پیام معرفی محصول به همه‌ی مخاطبین pending آن محصول،
 * با فاصله‌ی DELAY_BETWEEN_MESSAGES_MS بین هر پیام و ثبت وضعیت هر ارسال در دیتابیس.
 */
async function sendCampaign(productId, onProgress, options) {
    if (runningCampaigns.has(productId)) {
        throw new Error("یک کمپین برای این محصول در حال اجراست؛ صبر کنید تمام شود یا دوباره تلاش کنید.");
    }
    runningCampaigns.add(productId);
    try {
        const product = await (0, productRepository_1.getProductById)(productId);
        if (!product)
            throw new Error("محصول یافت نشد.");
        const apiKey = await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.BALE_SAFIR_KEY);
        if (!apiKey) {
            throw new Error("کلید سفیر بله (bale_safir_key) در تنظیمات وارد نشده است.");
        }
        const botToken = await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.BALE_BOT_TOKEN);
        if (!botToken) {
            throw new Error("توکن ربات (bale_bot_token) برای استخراج bot_id تنظیم نشده است.");
        }
        const botIdStr = botToken.split(":")[0];
        const botId = parseInt(botIdStr, 10);
        if (isNaN(botId)) {
            throw new Error("توکن ربات نامعتبر است (bot_id یافت نشد).");
        }
        const pendingContacts = await (0, contactRepository_1.listContactsByProduct)(productId, null, enums_1.ContactStatus.PENDING);
        const progress = { total: pendingContacts.length, sent: 0, failed: 0, noBale: 0, done: false };
        const introText = options?.initialMessageText || `سلام! محصول «${product.name}» را معرفی می‌کنیم.\n${truncate(product.descriptionText, 300)}`;
        for (const contact of pendingContacts) {
            if (options?.isPassiveMode) {
                // In passive mode, we just mark the contact as passive and don't send anything.
                await (0, contactRepository_1.updateContactStatus)(contact.id, "passive", { errorMessage: null });
                progress.sent++;
            }
            else {
                const outcome = await (0, baleSafirClient_1.sendSafirMessage)({
                    apiKey,
                    botId,
                    phone: contact.phone,
                    text: introText,
                    photoUrl: options?.initialMessagePhoto,
                    button: { type: "copy_text", value: `کد محصول: ${product.shortCode}`, label: "شروع گفتگو" },
                });
                if (outcome.kind === "sent") {
                    await (0, contactRepository_1.updateContactStatus)(contact.id, enums_1.ContactStatus.SENT, { sentAt: new Date(), errorMessage: null });
                    if (outcome.chatId) {
                        await (0, contactRepository_1.setContactBaleChatId)(contact.id, outcome.chatId);
                    }
                    progress.sent++;
                }
                else if (outcome.kind === "no_bale") {
                    await (0, contactRepository_1.updateContactStatus)(contact.id, enums_1.ContactStatus.NO_BALE, { errorMessage: outcome.message });
                    progress.noBale++;
                }
                else {
                    await (0, contactRepository_1.updateContactStatus)(contact.id, enums_1.ContactStatus.FAILED, { errorMessage: outcome.message });
                    progress.failed++;
                }
            }
            onProgress?.({ ...progress });
            if (!options?.isPassiveMode) {
                await sleep(DELAY_BETWEEN_MESSAGES_MS);
            }
        }
        progress.done = true;
        onProgress?.({ ...progress });
        return progress;
    }
    finally {
        runningCampaigns.delete(productId);
    }
}
// ---------------------------------------------------------------------------
// نسخه‌ی چندمستأجری (پلتفرم API) — روی یک رکورد Campaign ماندگار کار می‌کند و
// pause/resume/cancel واقعی دارد (وسط حلقه‌ی ارسال، وضعیت را از دیتابیس می‌خواند).
// ---------------------------------------------------------------------------
const runningCampaignIds = new Set();
function isTenantCampaignRunning(campaignId) {
    return runningCampaignIds.has(campaignId);
}
/**
 * اجرای یک کمپین ماندگار. اگر قبلاً شروع شده و paused بوده، از همان مخاطبین
 * pending باقی‌مانده ادامه می‌دهد (resume واقعی). اگر وسط اجرا کسی وضعیت را در
 * دیتابیس به paused/cancelled تغییر دهد (از طریق endpoint pause/cancel)، همین
 * حلقه در همان لحظه متوقف می‌شود — نیازی به سیگنال درون‌حافظه‌ای بین request ها نیست.
 */
async function runTenantCampaign(campaignId, userId, productId, apiKeyId) {
    if (runningCampaignIds.has(campaignId))
        return; // از قبل در حال اجراست، دوباره شروع نکن
    runningCampaignIds.add(campaignId);
    try {
        const product = await (0, productRepository_1.getProductById)(productId);
        if (!product)
            throw new Error("محصول یافت نشد.");
        const apiKey = await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.BALE_SAFIR_KEY);
        if (!apiKey)
            throw new Error("کلید سفیر بله (bale_safir_key) در تنظیمات وارد نشده است.");
        const botToken = await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.BALE_BOT_TOKEN);
        if (!botToken) {
            throw new Error("توکن ربات (bale_bot_token) برای استخراج bot_id تنظیم نشده است.");
        }
        const botIdStr = botToken.split(":")[0];
        const botId = parseInt(botIdStr, 10);
        if (isNaN(botId)) {
            throw new Error("توکن ربات نامعتبر است (bot_id یافت نشد).");
        }
        const introText = `سلام! محصول «${product.name}» را معرفی می‌کنیم.\n${truncate(product.descriptionText, 300)}`;
        const pendingContacts = await (0, contactRepository_1.listContactsByProduct)(productId, userId, enums_1.ContactStatus.PENDING);
        // مهم: اگر این resume یک کمپین متوقف‌شده است (نه شروع اول)، total/processed/successful/failed
        // باید از همان مقداری که قبل از pause ذخیره شده بود ادامه پیدا کنند، نه اینکه دوباره صفر شوند
        // یا total روی تعداد مخاطبین *باقیمانده* (کمتر از واقعی) تنظیم شود.
        const existingCampaign = await (0, campaignRepository_1.getCampaignOwnedByUser)(campaignId, userId);
        const isFreshStart = !existingCampaign || existingCampaign.totalContacts === 0;
        let successful = isFreshStart ? 0 : existingCampaign.successful;
        let failed = isFreshStart ? 0 : existingCampaign.failed;
        let processed = isFreshStart ? 0 : existingCampaign.processed;
        if (isFreshStart) {
            await (0, campaignRepository_1.updateCampaignProgress)(campaignId, { totalContacts: pendingContacts.length });
        }
        for (const contact of pendingContacts) {
            // قبل از هر پیام، وضعیت واقعی کمپین را از دیتابیس می‌خوانیم — این همان مکانیزم
            // pause/cancel واقعی است (نه یک flag درون‌حافظه‌ای که با ری‌استارت سرور از بین برود)
            const currentStatus = await (0, campaignRepository_1.getCampaignStatus)(campaignId);
            if (currentStatus === campaignRepository_1.CampaignStatus.PAUSED || currentStatus === campaignRepository_1.CampaignStatus.CANCELLED) {
                return; // حلقه همین‌جا متوقف می‌شود؛ مخاطبین باقیمانده pending می‌مانند برای resume بعدی
            }
            const outcome = await (0, baleSafirClient_1.sendSafirMessage)({
                apiKey,
                botId,
                phone: contact.phone,
                text: introText,
                button: { type: "copy_text", value: `کد محصول: ${product.shortCode}`, label: "شروع گفتگو" },
            });
            if (outcome.kind === "sent") {
                await (0, contactRepository_1.updateContactStatus)(contact.id, enums_1.ContactStatus.SENT, { sentAt: new Date(), errorMessage: null });
                if (outcome.chatId)
                    await (0, contactRepository_1.setContactBaleChatId)(contact.id, outcome.chatId);
                successful++;
            }
            else if (outcome.kind === "no_bale") {
                await (0, contactRepository_1.updateContactStatus)(contact.id, enums_1.ContactStatus.NO_BALE, { errorMessage: outcome.message });
                failed++;
            }
            else {
                await (0, contactRepository_1.updateContactStatus)(contact.id, enums_1.ContactStatus.FAILED, { errorMessage: outcome.message });
                failed++;
            }
            processed++;
            await (0, campaignRepository_1.updateCampaignProgress)(campaignId, { processed, successful, failed });
            await sleep(DELAY_BETWEEN_MESSAGES_MS);
        }
        // اگر تا اینجا رسیدیم یعنی همه‌ی مخاطبین pending این دور تمام شدند. فقط وقتی
        // واقعاً هنوز "running" است کمپین را completed کن — اگر درست همزمان با پردازش
        // آخرین مخاطب، کاربر pause را زده باشد (status الان "paused" است)، نباید این
        // را نادیده بگیریم و completed کنیم؛ باید paused بماند تا با resume به‌درستی
        // نهایی شود (که چون دیگر مخاطب pending ای نمانده، فوراً completed می‌شود).
        const finalStatus = await (0, campaignRepository_1.getCampaignStatus)(campaignId);
        if (finalStatus === campaignRepository_1.CampaignStatus.RUNNING) {
            await (0, campaignRepository_1.updateCampaignStatus)(campaignId, campaignRepository_1.CampaignStatus.COMPLETED);
            await (0, activityLogRepository_1.logActivity)({
                userId,
                apiKeyId,
                action: "campaign_completed",
                resourceType: "campaign",
                resourceId: campaignId,
                metadata: { successful, failed, processed },
            });
        }
    }
    catch (err) {
        console.error(`[runTenantCampaign] خطا در کمپین ${campaignId}:`, err);
        await (0, activityLogRepository_1.logActivity)({
            userId,
            apiKeyId,
            action: "campaign_error",
            resourceType: "campaign",
            resourceId: campaignId,
            metadata: { message: err?.message },
        }).catch(() => undefined);
    }
    finally {
        runningCampaignIds.delete(campaignId);
    }
}
