"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = createUser;
exports.findUserByEmail = findUserByEmail;
exports.findUserById = findUserById;
exports.countUsers = countUsers;
exports.listUsers = listUsers;
const client_1 = require("./client");
async function createUser(email, passwordHash, isOwner = false) {
    return client_1.prisma.user.create({ data: { email, passwordHash, isOwner } });
}
async function findUserByEmail(email) {
    return client_1.prisma.user.findUnique({ where: { email } });
}
async function findUserById(id) {
    return client_1.prisma.user.findUnique({ where: { id } });
}
async function countUsers() {
    return client_1.prisma.user.count();
}
async function listUsers() {
    return client_1.prisma.user.findMany({ orderBy: { createdAt: "desc" } });
}
