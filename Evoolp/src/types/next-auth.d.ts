import { DefaultSession } from "next-auth";

export type AppRole = "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      schoolId: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: string;
    schoolId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    schoolId: string;
  }
}