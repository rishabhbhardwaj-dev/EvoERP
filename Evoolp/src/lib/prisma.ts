import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 * Reuses a single instance across hot reloads in development.
 * In development mode, auto-heals stale globalThis singletons if schema models
 * (e.g. Notice) were added after the dev server process started.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function getPrismaInstance(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    let client = getPrismaInstance();
    let value = Reflect.get(client, prop, receiver);

    // If a model property (e.g. 'notice') is undefined on the cached singleton in dev mode,
    // re-instantiate PrismaClient from disk to auto-heal stale globalThis instances.
    if (
      value === undefined &&
      process.env.NODE_ENV !== "production" &&
      typeof prop === "string"
    ) {
      const freshClient = createPrismaClient();
      const freshValue = Reflect.get(freshClient, prop);
      if (freshValue !== undefined) {
        if (client && typeof client.$disconnect === "function") {
          client.$disconnect().catch(() => {});
        }
        globalForPrisma.prisma = freshClient;
        client = freshClient;
        value = freshValue;
      }
    }

    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
