import { DefaultSession } from "next-auth";

export type AppRole = "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      schoolId: string;
      role: AppRole;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppRole;
    schoolId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    schoolId?: string;
    role?: AppRole;
  }
}
