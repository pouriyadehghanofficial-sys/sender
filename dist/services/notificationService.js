"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEscalationNotificationText = buildEscalationNotificationText;
exports.buildOrderNotificationText = buildOrderNotificationText;
exports.buildMailOptions = buildMailOptions;
exports.sendEmailNotification = sendEmailNotification;
exports.sendBaleNotification = sendBaleNotification;
const nodemailer_1 = __importDefault(require("nodemailer"));
const baleBotClient_1 = require("../providers/baleBotClient");
/** ساخت متن اعلان ارجاع مکالمه به اپراتور انسانی — تابع خالص، قابل تست */
function buildEscalationNotificationText(details) {
    const reasonText = {
        keyword: "کاربر درخواست صحبت با اپراتور کرد",
        message_limit: "تعداد پیام‌های رد و بدل شده زیاد شد",
        ai_failure: "هوش مصنوعی موقتاً در دسترس نیست",
        ai_requested: "خودِ هوش مصنوعی تشخیص داد باید ارجاع بدهد (احتمالاً جواب سوال را نمی‌دانست)",
    };
    return [
        "🔔 این مکالمه نیاز به پیگیری شما دارد!",
        `دلیل: ${reasonText[details.reason]}`,
        `مشتری: ${details.customerName}`,
        `شماره: ${details.customerPhone}`,
        `محصول: ${details.productName}`,
        "",
        "چند پیام آخر:",
        details.conversationSummary,
    ].join("\n");
}
/** ساخت متن اعلان — تابع خالص، مستقل از شبکه، به‌راحتی قابل تست */
function buildOrderNotificationText(details) {
    return [
        "🎉 سفارش جدید تایید شد!",
        `مشتری: ${details.customerName}`,
        `شماره: ${details.customerPhone}`,
        `محصول: ${details.productName}`,
        "",
        "خلاصه مکالمه:",
        details.conversationSummary,
    ].join("\n");
}
/** ساخت mail options — تابع خالص، جدا از ارسال واقعی، برای تست‌پذیری */
function buildMailOptions(config, text) {
    return {
        from: config.from,
        to: config.to,
        subject: "🎉 سفارش جدید در ربات فروش",
        text,
    };
}
async function sendEmailNotification(config, text) {
    const transporter = nodemailer_1.default.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: { user: config.user, pass: config.pass },
    });
    await transporter.sendMail(buildMailOptions(config, text));
}
async function sendBaleNotification(botConfig, targetChatId, text) {
    await (0, baleBotClient_1.sendBaleMessage)(botConfig, targetChatId, text);
}
