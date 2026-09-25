import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md rounded-lg border bg-background p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">EvoERP</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your school account
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
