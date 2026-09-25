"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePagination = parsePagination;
exports.buildPaginatedResult = buildPaginatedResult;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
/** از query string (?page=2&pageSize=50) پارامترهای امن صفحه‌بندی می‌سازد */
function parsePagination(query) {
    let page = Number(query.page) || 1;
    let pageSize = Number(query.pageSize) || DEFAULT_PAGE_SIZE;
    if (page < 1)
        page = 1;
    if (pageSize < 1)
        pageSize = DEFAULT_PAGE_SIZE;
    if (pageSize > MAX_PAGE_SIZE)
        pageSize = MAX_PAGE_SIZE;
    return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
function buildPaginatedResult(data, total, params) {
    return {
        data,
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
    };
}
