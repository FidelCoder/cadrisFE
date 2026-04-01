"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertCircle, Bot, Database, RefreshCw, Server } from "lucide-react";
import { useCadrisStore } from "@/stores/use-cadris-store";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { clientApiFetch } from "@/lib/api/client";
import { getApiBaseUrl } from "@/lib/api/base-url";

interface BackendHealthResponse {
  ok: boolean;
  service: string;
  version: string;
  release: string | null;
  environment: string;
  timestamp: string;
  storage: {
    provider: "local" | "s3";
    servingStrategy: "public-url" | "api-proxy";
    publicBaseUrl: string | null;
    bucket: string | null;
    localRoot: string | null;
  };
  ai: {
    localLlmEnabled: boolean;
    baseUrl: string | null;
    model: string | null;
  };
  cors: {
    allowedOrigins: string[];
  };
  limits: {
    writeRequests: {
      windowMs: number;
      max: number;
    };
  };
}

interface LocalLlmHealth {
  provider: "ollama";
  configured: boolean;
  reachable: boolean;
  fallbackAvailable: boolean;
  baseUrl: string;
  model: string;
  availableModels: string[];
  message: string;
}

export default function SettingsPage() {
  const { showFaceBoxes, setShowFaceBoxes, cinematicSmoothing, setCinematicSmoothing } = useCadrisStore();
  const [backendHealth, setBackendHealth] = useState<BackendHealthResponse | null>(null);
  const [llmHealth, setLlmHealth] = useState<LocalLlmHealth | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [isRefreshing, startRefreshTransition] = useTransition();

  const frontendEnvironment = process.env.NEXT_PUBLIC_APP_ENV || "development";
  const frontendVersion = process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0";

  useEffect(() => {
    refreshRuntime();
  }, []);

  function refreshRuntime() {
    startRefreshTransition(async () => {
      try {
        const [healthPayload, llmPayload] = await Promise.all([
          clientApiFetch<BackendHealthResponse>("/api/health"),
          clientApiFetch<LocalLlmHealth>("/api/ai/health")
        ]);

        setBackendHealth(healthPayload);
        setLlmHealth(llmPayload);
        setRuntimeError(null);
      } catch (error) {
        setRuntimeError(error instanceof Error ? error.message : "Unable to reach the backend runtime.");
      }
    });
  }

  return (
    <div className="space-y-5 pb-28">
      <div className="space-y-3 pt-4">
        <Badge>Settings</Badge>
        <h1 className="text-3xl font-semibold">Tune the operator feel for this device.</h1>
        <p className="text-sm text-slate-400">These controls stay intentionally light for v1: preview overlays and motion smoothing without adding operator friction.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <button
            className="surface-muted flex w-full items-center justify-between rounded-3xl p-4 text-left"
            onClick={() => setShowFaceBoxes(!showFaceBoxes)}
          >
            <div>
              <div className="font-medium">Show face boxes in guide view</div>
              <div className="mt-1 text-sm text-slate-400">Helpful during testing to verify who the tracker currently favors.</div>
            </div>
            <div className="text-sm text-cyan-200">{showFaceBoxes ? "On" : "Off"}</div>
          </button>

          <div className="surface-muted rounded-3xl p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">Cinematic smoothing</div>
                <div className="mt-1 text-sm text-slate-400">Higher values reduce twitchiness in the live crop path.</div>
              </div>
              <div className="text-sm text-cyan-200">{Math.round(cinematicSmoothing * 100)}%</div>
            </div>
            <input
              className="mt-4 w-full accent-cyan-300"
              type="range"
              min="0.4"
              max="0.95"
              step="0.01"
              value={cinematicSmoothing}
              onChange={(event) => setCinematicSmoothing(Number(event.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge>Runtime</Badge>
              <CardTitle className="mt-3">Deployment visibility</CardTitle>
            </div>
            <Button variant="ghost" onClick={refreshRuntime} disabled={isRefreshing}>
              <RefreshCw className="h-4 w-4" />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="surface-muted rounded-3xl p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-cyan-300/10 p-2 text-cyan-200">
                  <Server className="h-4 w-4" />
                </div>
                <div className="space-y-2 text-sm text-slate-300">
                  <div className="font-medium text-white">Frontend runtime</div>
                  <div>Environment: {frontendEnvironment}</div>
                  <div>Version: {frontendVersion}</div>
                  <div>API base URL: {getApiBaseUrl()}</div>
                </div>
              </div>
            </div>

            <div className="surface-muted rounded-3xl p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-cyan-300/10 p-2 text-cyan-200">
                  <Database className="h-4 w-4" />
                </div>
                <div className="space-y-2 text-sm text-slate-300">
                  <div className="font-medium text-white">Backend runtime</div>
                  {backendHealth ? (
                    <>
                      <div>
                        {backendHealth.service} {backendHealth.version}
                      </div>
                      <div>Environment: {backendHealth.environment}</div>
                      <div>Storage: {backendHealth.storage.provider} via {backendHealth.storage.servingStrategy}</div>
                      <div>Write limit: {backendHealth.limits.writeRequests.max} requests / {Math.round(backendHealth.limits.writeRequests.windowMs / 1000)}s</div>
                    </>
                  ) : (
                    <div className="text-slate-400">Waiting for backend runtime data...</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="surface-muted rounded-3xl p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-cyan-300/10 p-2 text-cyan-200">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="space-y-2 text-sm text-slate-300">
                  <div className="font-medium text-white">Local AI runtime</div>
                  {llmHealth ? (
                    <>
                      <div>Status: {llmHealth.reachable ? "Reachable" : llmHealth.configured ? "Configured but unavailable" : "Disabled"}</div>
                      <div>Model: {llmHealth.model}</div>
                      <div>Base URL: {llmHealth.baseUrl}</div>
                      <div className="text-slate-400">{llmHealth.message}</div>
                    </>
                  ) : (
                    <div className="text-slate-400">Waiting for local AI status...</div>
                  )}
                </div>
              </div>
            </div>

            <div className="surface-muted rounded-3xl p-4">
              <div className="space-y-2 text-sm text-slate-300">
                <div className="font-medium text-white">Deploy notes</div>
                {backendHealth ? (
                  <>
                    <div>Allowed origins: {backendHealth.cors.allowedOrigins.join(", ")}</div>
                    <div>Storage public base: {backendHealth.storage.publicBaseUrl || "Proxy only"}</div>
                    <div>Bucket: {backendHealth.storage.bucket || "Not using object storage"}</div>
                    <div>Backend checked at: {new Date(backendHealth.timestamp).toLocaleString()}</div>
                  </>
                ) : (
                  <div className="text-slate-400">Runtime details will appear after the first successful health check.</div>
                )}
              </div>
            </div>
          </div>

          {runtimeError ? (
            <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <div>
                  <div className="font-medium">Runtime check failed</div>
                  <div className="mt-1 text-amber-100/80">{runtimeError}</div>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
