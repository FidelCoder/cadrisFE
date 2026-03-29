"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertCircle, Bot, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { clientApiFetch } from "@/lib/api/client";

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

interface ProjectInsightResult {
  source: "ollama" | "fallback";
  summary: string;
  strengths: string[];
  risks: string[];
  nextSteps: string[];
  operatorNotes: string;
}

interface OllamaProbeResult {
  provider: "ollama";
  baseUrl: string;
  model: string;
  prompt: string;
  response: string;
  generatedAt: string;
}

export function AiReviewPanel({ projectId }: { projectId: string }) {
  const [health, setHealth] = useState<LocalLlmHealth | null>(null);
  const [insight, setInsight] = useState<ProjectInsightResult | null>(null);
  const [probe, setProbe] = useState<OllamaProbeResult | null>(null);
  const [isLoadingHealth, startHealthTransition] = useTransition();
  const [isGenerating, startGenerateTransition] = useTransition();
  const [isProbing, startProbeTransition] = useTransition();

  useEffect(() => {
    startHealthTransition(async () => {
      try {
        const payload = await clientApiFetch<LocalLlmHealth>("/api/ai/health");
        setHealth(payload);
      } catch {
        setHealth({
          provider: "ollama",
          configured: true,
          reachable: false,
          fallbackAvailable: true,
          baseUrl: "http://127.0.0.1:11434",
          model: "llama3.2:1b",
          availableModels: [],
          message: "Backend could not reach the local LLM runtime. Built-in fallback review is still available."
        });
      }
    });
  }, []);

  function generateInsights() {
    startGenerateTransition(async () => {
      try {
        const payload = await clientApiFetch<{ projectId: string; insight: ProjectInsightResult }>(
          `/api/projects/${projectId}/insights`,
          {
            method: "POST"
          }
        );

        setInsight(payload.insight);
        toast.success(payload.insight.source === "ollama" ? "Local AI review generated." : "Fallback review generated for testing.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to generate local AI review.");
      }
    });
  }

  function runProbe() {
    startProbeTransition(async () => {
      try {
        const payload = await clientApiFetch<OllamaProbeResult>("/api/ai/probe", {
          method: "POST"
        });

        setProbe(payload);
        toast.success("Ollama returned a live proof response.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to run the Ollama proof.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge>Local AI Review</Badge>
              {health ? (
                <Badge
                  className={
                    health.reachable
                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                      : "border-amber-400/25 bg-amber-400/10 text-amber-200"
                  }
                >
                  {health.reachable ? "Ready" : health.fallbackAvailable ? "Fallback Ready" : "Unavailable"}
                </Badge>
              ) : null}
            </div>
            <CardTitle>Session insights from your local model</CardTitle>
            <CardDescription>
              Use a local Ollama model to review shot stability, overlap handling, and the operator guidance for the session.
            </CardDescription>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200">
            <Bot className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="surface-muted rounded-3xl p-4">
          <div className="flex items-start gap-3">
            {health?.reachable ? (
              <Sparkles className="mt-0.5 h-4 w-4 text-cyan-200" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 text-amber-200" />
            )}
            <div className="text-sm text-slate-300">
              <div className="font-medium text-white">
                {health?.model || "Local model not checked yet"}
              </div>
              <div className="mt-1 text-slate-400">{health?.message || "Checking local runtime..."}</div>
              {health ? (
                <div className="mt-2 text-xs text-slate-500">
                  Runtime: {health.baseUrl}
                  {health.availableModels.length ? ` • Installed: ${health.availableModels.join(", ")}` : ""}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Button
            variant="secondary"
            onClick={generateInsights}
            disabled={(!health?.reachable && !health?.fallbackAvailable) || isGenerating}
          >
            <Sparkles className="h-4 w-4" />
            {isGenerating ? "Generating..." : health?.reachable ? "Generate local review" : "Generate fallback review"}
          </Button>
          <Button
            variant="secondary"
            onClick={runProbe}
            disabled={!health?.reachable || isProbing}
          >
            <Bot className="h-4 w-4" />
            {isProbing ? "Probing..." : "Run Ollama proof"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              startHealthTransition(async () => {
                try {
                  setHealth(await clientApiFetch<LocalLlmHealth>("/api/ai/health"));
                } catch {
                  toast.error("Unable to refresh local LLM health.");
                }
              });
            }}
            disabled={isLoadingHealth}
          >
            <RefreshCw className="h-4 w-4" />
            {isLoadingHealth ? "Checking..." : "Refresh runtime"}
          </Button>
        </div>

        {insight ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge
                className={
                  insight.source === "ollama"
                    ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-200"
                    : "border-slate-400/20 bg-slate-400/10 text-slate-200"
                }
              >
                {insight.source === "ollama" ? "From Ollama" : "Heuristic Fallback"}
              </Badge>
            </div>
            <div className="surface-muted rounded-3xl p-4">
              <div className="text-sm font-medium text-white">Summary</div>
              <p className="mt-2 text-sm text-slate-300">{insight.summary}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="surface-muted rounded-3xl p-4">
                <div className="text-sm font-medium text-white">Strengths</div>
                <ul className="mt-2 space-y-2 text-sm text-slate-300">
                  {insight.strengths.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="surface-muted rounded-3xl p-4">
                <div className="text-sm font-medium text-white">Risks</div>
                <ul className="mt-2 space-y-2 text-sm text-slate-300">
                  {insight.risks.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="surface-muted rounded-3xl p-4">
                <div className="text-sm font-medium text-white">Next steps</div>
                <ul className="mt-2 space-y-2 text-sm text-slate-300">
                  {insight.nextSteps.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="surface-muted rounded-3xl p-4">
              <div className="text-sm font-medium text-white">Operator notes</div>
              <p className="mt-2 text-sm text-slate-300">{insight.operatorNotes}</p>
            </div>
          </div>
        ) : null}

        {probe ? (
          <div className="surface-muted rounded-3xl p-4">
            <div className="flex items-center gap-2">
              <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">Live Ollama proof</Badge>
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <div>
                <span className="text-slate-500">Model:</span> {probe.model}
              </div>
              <div>
                <span className="text-slate-500">Prompt:</span> {probe.prompt}
              </div>
              <div>
                <span className="text-slate-500">Response:</span> {probe.response}
              </div>
              <div className="text-xs text-slate-500">Generated at {new Date(probe.generatedAt).toLocaleString()}</div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
