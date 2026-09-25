export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }: { auth: unknown; request: { nextUrl: { pathname: string } } }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth;
      const role = (auth as { user?: { role?: string } })?.user?.role;

      if (pathname === "/login" || pathname === "/") {
        return true;
      }

      if (!isLoggedIn) return false;

      if (pathname.startsWith("/admin") && role !== "ADMIN") return false;
      if (pathname.startsWith("/teacher") && role !== "TEACHER") return false;
      if (pathname.startsWith("/student") && role !== "STUDENT") return false;
      if (pathname.startsWith("/parent") && role !== "PARENT") return false;

      return true;
    },
  },
  providers: [],
};