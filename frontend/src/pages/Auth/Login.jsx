import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, tokenStore } from "../../lib/api";

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const { isAuthenticated, loading, refresh, user } = useAuth();

  const [email, setEmail] = useState("demo@salesforge.com");
  const [password, setPassword] = useState("Demo1234!");
  const [error, setError] = useState(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      if (user?.role === "ADMIN") {
        navigate("/admin-dashboard", { replace: true });
      } else {
        navigate(redirect, { replace: true });
      }
    }
  }, [isAuthenticated, loading, navigate, redirect, user]);

  const handleEmailLogin = async (event) => {
    event.preventDefault();
    setError(null);
    setSigningIn(true);

    try {
      const res = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });

      tokenStore.set(res.data.data.token);

      const authData = await refresh();
      const userRole =
        authData?.user?.role || res.data.data.user?.role;

      if (userRole === "ADMIN") {
        navigate("/admin-dashboard", { replace: true });
      } else {
        navigate(redirect, { replace: true });
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.normalized?.message ||
        err?.message ||
        "Login failed. Please check your email and password.";

      setError(msg);
    } finally {
      setSigningIn(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError(null);
    setSigningIn(true);

    try {
      const res = await api.post("/auth/google", {
        credential: credentialResponse.credential,
      });

      tokenStore.set(res.data.data.token);

      const authData = await refresh();
      const userRole =
        authData?.user?.role || res.data.data.user?.role;

      if (userRole === "ADMIN") {
        navigate("/admin-dashboard", { replace: true });
      } else {
        navigate(redirect, { replace: true });
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.normalized?.message ||
        "Google Sign-In failed. Please try again.";

      setError(msg);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-teal-50 px-4 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-[500px] w-[500px] rounded-full bg-teal-400/20 blur-3xl dark:bg-teal-500/10" />
        <div className="absolute -bottom-40 -right-32 h-[500px] w-[500px] rounded-full bg-violet-400/20 blur-3xl dark:bg-violet-500/10" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="rounded-3xl border border-gray-200/60 bg-white/80 p-8 shadow-2xl backdrop-blur-xl dark:border-gray-700/60 dark:bg-gray-900/80">
          <div className="mb-7 flex flex-col items-center text-center">
            <img
              src="/UptoSkillsLogo.webp"
              alt="UptoSkills Logo"
              className="mb-4 h-14 w-auto object-contain"
            />

            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Welcome back
            </h1>

            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Sign in to your SalesForge workspace
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={signingIn}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingIn ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            <span className="text-xs text-gray-400">OR</span>
            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          </div>

          <div className="flex justify-center">
            {signingIn ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin text-teal-500" />
                Signing you in…
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() =>
                  setError("Google Sign-In failed. Please try again.")
                }
                width="280"
                text="continue_with"
                shape="rectangular"
                logo_alignment="left"
              />
            )}
          </div>

          <div className="mt-8 border-t border-gray-100 pt-5 text-center dark:border-gray-800">
            <button
              type="button"
              onClick={() => navigate("/admin-login")}
              className="text-xs font-medium text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
            >
              Admin portal →
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-600">
          By continuing, you agree to our{" "}
          <span className="cursor-pointer underline hover:text-gray-600 dark:hover:text-gray-400">
            Terms
          </span>{" "}
          &amp;{" "}
          <span className="cursor-pointer underline hover:text-gray-600 dark:hover:text-gray-400">
            Privacy Policy
          </span>
          .
        </p>
      </div>
    </div>
  );
};

export default Login;
