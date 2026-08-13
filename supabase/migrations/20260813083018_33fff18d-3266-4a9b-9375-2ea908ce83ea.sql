CREATE TABLE public.forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  depart_time TEXT NOT NULL,
  travel_date DATE NOT NULL,
  weather TEXT NOT NULL,
  holiday BOOLEAN NOT NULL DEFAULT false,
  recommended_route TEXT NOT NULL,
  score NUMERIC NOT NULL,
  level TEXT NOT NULL,
  eta_minutes INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forecasts TO authenticated;
GRANT ALL ON public.forecasts TO service_role;
ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own forecasts" ON public.forecasts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX forecasts_user_created_idx ON public.forecasts (user_id, created_at DESC);