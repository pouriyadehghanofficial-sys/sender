import { prisma } from "./client";

export async function createUser(email: string, passwordHash: string, isOwner = false) {
  return prisma.user.create({ data: { email, passwordHash, isOwner } });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function countUsers() {
  return prisma.user.count();
}

export async function listUsers() {
  return prisma.user.findMany({ orderBy: { createdAt: "desc" } });
}
