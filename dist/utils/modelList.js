"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseModelList = parseModelList;
/**
 * فیلد model یک ارائه‌دهنده می‌تواند شامل چند مدل با کاما جدا شده باشد
 * (مثلاً یک کلید OpenRouter که چند مدل مختلف را پوشش می‌دهد).
 * ترتیب خروجی همان ترتیب نوشته‌شده است (اولین مدل = اولویت بالاتر در فیل‌اوور).
 */
function parseModelList(modelField) {
    const models = modelField
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
    return models.length > 0 ? models : [modelField.trim()];
}
