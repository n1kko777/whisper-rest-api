"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { completeGithubLogin } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function GithubCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      setError("Missing GitHub authorization data.");
      return;
    }

    const finishLogin = async () => {
      try {
        const response = await completeGithubLogin({ code, state });
        localStorage.setItem("token", response.data.access_token);
        router.replace("/dashboard");
      } catch (err: any) {
        setError(getErrorMessage(err));
      }
    };

    finishLogin();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Signing you in…</CardTitle>
          <CardDescription>Completing GitHub authentication.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <>
              <p className="text-red-500 text-sm">{error}</p>
              <Button asChild className="w-full">
                <Link href="/login">Back to login</Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-gray-600">
              Please wait while we finish connecting to GitHub.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function GithubCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Card className="w-[400px]">
            <CardHeader>
              <CardTitle>Signing you in…</CardTitle>
              <CardDescription>
                Completing GitHub authentication.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Please wait while we finish connecting to GitHub.
              </p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <GithubCallbackContent />
    </Suspense>
  );
}
