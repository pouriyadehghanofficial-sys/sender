"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProduct = createProduct;
exports.listProducts = listProducts;
exports.listProductsForUser = listProductsForUser;
exports.getProductById = getProductById;
exports.getProductAccessibleByUser = getProductAccessibleByUser;
exports.getProductOwnedByUser = getProductOwnedByUser;
exports.getProductByShortCode = getProductByShortCode;
exports.updateProduct = updateProduct;
exports.setProductActive = setProductActive;
exports.deleteProduct = deleteProduct;
exports.countActiveProductsForUser = countActiveProductsForUser;
const client_1 = require("./client");
async function createProduct(input) {
    return client_1.prisma.product.create({
        data: {
            name: input.name,
            shortCode: input.shortCode,
            descriptionText: input.descriptionText,
            userId: input.userId ?? null,
        },
    });
}
async function listProducts() {
    return client_1.prisma.product.findMany({ orderBy: { createdAt: "desc" } });
}
/** فقط محصولات همان کاربر + محصولات سراسری (userId=null) — طبق بخش ۵ سند چندمستأجری */
async function listProductsForUser(userId) {
    return client_1.prisma.product.findMany({
        where: { OR: [{ userId }, { userId: null }] },
        orderBy: { createdAt: "desc" },
    });
}
async function getProductById(id) {
    return client_1.prisma.product.findUnique({ where: { id } });
}
/** فقط اگر محصول متعلق به همین کاربر یا سراسری باشد برمی‌گرداند — جلوگیری از IDOR */
async function getProductAccessibleByUser(id, userId) {
    return client_1.prisma.product.findFirst({ where: { id, OR: [{ userId }, { userId: null }] } });
}
/** فقط اگر واقعاً مالک همین کاربر باشد (نه سراسری) — برای edit/deactivate */
async function getProductOwnedByUser(id, userId) {
    return client_1.prisma.product.findFirst({ where: { id, userId } });
}
async function getProductByShortCode(shortCode) {
    return client_1.prisma.product.findUnique({ where: { shortCode } });
}
async function updateProduct(id, data) {
    return client_1.prisma.product.update({ where: { id }, data });
}
async function setProductActive(id, isActive) {
    return client_1.prisma.product.update({ where: { id }, data: { isActive } });
}
async function deleteProduct(id) {
    return client_1.prisma.product.delete({ where: { id } });
}
async function countActiveProductsForUser(userId) {
    return client_1.prisma.product.count({ where: { userId, isActive: true } });
}
