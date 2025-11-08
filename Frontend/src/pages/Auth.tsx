import { useState } from "react";
import { Shield, Eye, EyeOff, Lock, User, Loader2 } from "lucide-react";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { authApi } from "@/lib/api";

export default function Auth() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("admin@fraudguard.com");
  const [password, setPassword] = useState("anytext");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  const validate = () => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = "Please enter your email address.";
    }

    if (!password.trim()) {
      errors.password = "Please enter your password.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    if (!validate()) {
      setErrorMessage("We need both your email and password to sign you in.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await authApi.login(email.trim(), password);
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));

      toast({
        title: "Welcome back",
        description: `Signed in as ${response.user.fullName}`,
      });

      navigate("/");
    } catch (error) {
      let message = "We could not sign you in. Please check your credentials and try again.";

      if (isAxiosError(error)) {
        const status = error.response?.status;
        const backendMessage = (error.response?.data as { message?: string } | undefined)?.message;

        if (status === 401) {
          message = "Invalid credential please provide the correct credentials";
        } else if (backendMessage) {
          message = backendMessage;
        } else if (status === 0 || !status) {
          message = "We couldn't reach the server. Please confirm the backend is running.";
        }
      }

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const emailInputHasError = Boolean(fieldErrors.email);
  const passwordInputHasError = Boolean(fieldErrors.password);

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Branding */}
      <div className="hidden w-1/2 flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">FraudGuard</h1>
        </div>

        <div className="space-y-6">
          <h2 className="text-5xl font-bold leading-tight">
            Secure, Real-Time Fraud Detection
          </h2>
          <p className="text-lg text-primary-foreground/80">
            Our advanced, rules-based system provides low-latency detection to protect your financial activities around the clock.
          </p>
        </div>

        <div className="text-sm text-primary-foreground/60">
          © 2025 FraudGuard. All rights reserved.
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex w-full items-center justify-center bg-background p-8 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight">Welcome Back</h1>
            <p className="text-muted-foreground">Please enter your details to sign in.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Username or Email</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="text"
                  placeholder="admin@fraudguard.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (errorMessage) {
                      setErrorMessage(null);
                    }
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  autoComplete="username"
                  className={`pl-10 ${
                    emailInputHasError ? "border-destructive focus-visible:ring-destructive" : ""
                  }`}
                  disabled={isLoading}
                  aria-invalid={emailInputHasError}
                  aria-describedby={emailInputHasError ? "email-error" : undefined}
                />
              </div>
              {fieldErrors.email ? (
                <p id="email-error" className="text-sm text-destructive">
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Button variant="link" type="button" className="h-auto p-0 text-sm text-primary">
                  Forgot Password?
                </Button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (errorMessage) {
                      setErrorMessage(null);
                    }
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  autoComplete="current-password"
                  className={`pl-10 pr-10 ${
                    passwordInputHasError ? "border-destructive focus-visible:ring-destructive" : ""
                  }`}
                  disabled={isLoading}
                  aria-invalid={passwordInputHasError}
                  aria-describedby={passwordInputHasError ? "password-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password ? (
                <p id="password-error" className="text-sm text-destructive">
                  {fieldErrors.password}
                </p>
              ) : null}
            </div>

            {errorMessage ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing In
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="text-center text-xs text-muted-foreground">
            © 2025 FraudGuard. All rights reserved.{" "}
            <a href="#" className="text-primary hover:underline">Terms of Service</a> &{" "}
            <a href="#" className="text-primary hover:underline">Privacy Policy</a>
          </div>

          
        </div>
      </div>
    </div>
  );
}
