import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TraffIQ Traffic Intelligence" },
      {
        name: "description",
        content:
          "Sign in to TraffIQ to save route forecasts, track prediction accuracy and open your commute dashboard.",
      },
      { property: "og:title", content: "Sign in — TraffIQ" },
      {
        property: "og:description",
        content: "Access your saved congestion forecasts and commute dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage;
});

function AuthPage() {
  return null;
}
