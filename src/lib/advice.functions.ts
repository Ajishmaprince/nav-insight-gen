// Module 2: Generative AI route recommendation via Lovable AI (server function).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  time: z.string().min(1),
  weather: z.string().min(1),
  holiday: z.boolean(),
  routes: z
    .array(
      z.object({
        name: z.string(),
        via: z.string(),
        score: z.number(),
        level: z.string(),
        distance_km: z.number(),
        etaMinutes: z.number(),
      }),
    )
    .min(1)
    .max(4),
});

export type RouteAdvice = {
  summary: string;
  recommendedRoute: string;
  reasoning: string;
  source: "ai" | "fallback";
};

export const getRouteAdvice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<RouteAdvice> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a traffic routing assistant. Given congestion scores (0-100, higher = worse) for alternate routes, reply ONLY with JSON: {\"summary\": string (<=200 chars, plain language), \"recommendedRoute\": string (exact route name), \"reasoning\": string (<=280 chars, mention scores/ETA trade-offs)}.",
          },
          {
            role: "user",
            content: JSON.stringify({
              trip: {
                origin: data.origin,
                destination: data.destination,
                departure: data.time,
                weather: data.weather,
                holiday: data.holiday,
              },
              routes: data.routes,
            }),
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI gateway ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as Partial<RouteAdvice>;
    const best = data.routes.reduce((a, b) => (a.score <= b.score ? a : b));

    return {
      summary: parsed.summary ?? `Lightest traffic is on ${best.name}.`,
      recommendedRoute:
        data.routes.find((r) => r.name === parsed.recommendedRoute)?.name ?? best.name,
      reasoning: parsed.reasoning ?? "Chosen for the lowest predicted congestion score.",
      source: "ai",
    };
  });
