-- Gym Note friends + profiles. Run after schema.sql. Contains no credentials.
-- Friends never get row access to workout tables: they only read aggregated figures through SECURITY DEFINER
-- functions that verify an accepted friendship and the owner's share_progress flag.

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL CHECK (username ~ '^[a-z0-9_]{3,20}$'),
  share_progress boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username));
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_own ON public.profiles;
CREATE POLICY profiles_own ON public.profiles FOR ALL TO authenticated
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester <> addressee)
);
CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair ON public.friendships (least(requester, addressee), greatest(requester, addressee));
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS friendships_select ON public.friendships;
DROP POLICY IF EXISTS friendships_delete ON public.friendships;
CREATE POLICY friendships_select ON public.friendships FOR SELECT TO authenticated
  USING (requester = (select auth.uid()) OR addressee = (select auth.uid()));
CREATE POLICY friendships_delete ON public.friendships FOR DELETE TO authenticated
  USING (requester = (select auth.uid()) OR addressee = (select auth.uid()));
-- No INSERT/UPDATE policies on purpose: all writes go through the functions below.

-- Maps exercise ids to muscles so a friend's progress can be grouped by muscle (built-in exercises only live in the app).
CREATE TABLE IF NOT EXISTS public.exercise_catalog (
  id text PRIMARY KEY,
  name text NOT NULL,
  muscle text NOT NULL
);
ALTER TABLE public.exercise_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS catalog_read ON public.exercise_catalog;
CREATE POLICY catalog_read ON public.exercise_catalog FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.are_friends(a uuid, b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester = a AND addressee = b) OR (requester = b AND addressee = a))
  );
$$;

CREATE OR REPLACE FUNCTION public.send_friend_request(p_username text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); target uuid; fr record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = uid) THEN RETURN 'need_username'; END IF;
  SELECT user_id INTO target FROM profiles WHERE lower(username) = lower(trim(p_username));
  IF target IS NULL THEN RETURN 'not_found'; END IF;
  IF target = uid THEN RETURN 'self'; END IF;
  SELECT * INTO fr FROM friendships
    WHERE (requester = uid AND addressee = target) OR (requester = target AND addressee = uid);
  IF FOUND THEN
    IF fr.status = 'accepted' THEN RETURN 'already_friends'; END IF;
    IF fr.requester = uid THEN RETURN 'already_sent'; END IF;
    UPDATE friendships SET status = 'accepted' WHERE id = fr.id;
    RETURN 'accepted';
  END IF;
  INSERT INTO friendships (requester, addressee) VALUES (uid, target);
  RETURN 'sent';
END $$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(p_id uuid, p_accept boolean) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM friendships WHERE id = p_id AND addressee = uid AND status = 'pending') THEN
    RETURN 'not_found';
  END IF;
  IF p_accept THEN UPDATE friendships SET status = 'accepted' WHERE id = p_id;
  ELSE DELETE FROM friendships WHERE id = p_id; END IF;
  RETURN 'ok';
END $$;

CREATE OR REPLACE FUNCTION public.my_friends()
RETURNS TABLE (friendship_id uuid, friend_id uuid, username text, status text, direction text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.id,
         CASE WHEN f.requester = auth.uid() THEN f.addressee ELSE f.requester END,
         p.username,
         f.status,
         CASE WHEN f.status = 'accepted' THEN 'friend'
              WHEN f.requester = auth.uid() THEN 'outgoing' ELSE 'incoming' END
  FROM friendships f
  JOIN profiles p ON p.user_id = CASE WHEN f.requester = auth.uid() THEN f.addressee ELSE f.requester END
  WHERE f.requester = auth.uid() OR f.addressee = auth.uid()
  ORDER BY p.username;
$$;

CREATE OR REPLACE FUNCTION public.friend_overview(p_friend uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); prof record; nowms numeric := extract(epoch from now()) * 1000;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT are_friends(uid, p_friend) THEN RETURN jsonb_build_object('error', 'not_friends'); END IF;
  SELECT * INTO prof FROM profiles WHERE user_id = p_friend;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF NOT prof.share_progress THEN RETURN jsonb_build_object('error', 'not_shared', 'username', prof.username); END IF;
  RETURN jsonb_build_object(
    'username', prof.username,
    'workouts_30', (SELECT count(*) FROM workout_sessions WHERE user_id = p_friend AND finished_at IS NOT NULL AND started_at >= nowms - 30 * 86400000::bigint),
    'workouts_90', (SELECT count(*) FROM workout_sessions WHERE user_id = p_friend AND finished_at IS NOT NULL AND started_at >= nowms - 90 * 86400000::bigint),
    'last_workout', (SELECT max(started_at) FROM workout_sessions WHERE user_id = p_friend AND finished_at IS NOT NULL),
    'top_lifts', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT ls.exercise_name, max(ls.weight) AS max_weight
        FROM logged_sets ls JOIN workout_sessions ws ON ws.id = ls.session_id
        WHERE ls.user_id = p_friend AND ws.finished_at IS NOT NULL AND ls.weight > 0
        GROUP BY ls.exercise_name ORDER BY max(ls.weight) DESC LIMIT 8) t), '[]'::jsonb),
    'recent_sessions', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT ws.name, ws.started_at, ws.finished_at,
               count(ls.id) FILTER (WHERE ls.side IS DISTINCT FROM 'R') AS sets,
               COALESCE(sum(ls.weight * ls.reps), 0) AS volume
        FROM workout_sessions ws LEFT JOIN logged_sets ls ON ls.session_id = ws.id
        WHERE ws.user_id = p_friend AND ws.finished_at IS NOT NULL
        GROUP BY ws.id ORDER BY ws.started_at DESC LIMIT 8) t), '[]'::jsonb)
  );
END $$;

CREATE OR REPLACE FUNCTION public.friend_muscle_weeks(p_friend uuid, p_days int DEFAULT 90)
RETURNS TABLE (muscle text, week text, week_start text, volume double precision, sets bigint, hard_sets bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); nowms numeric := extract(epoch from now()) * 1000;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT are_friends(uid, p_friend) THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = p_friend AND share_progress) THEN RETURN; END IF;
  RETURN QUERY
  SELECT COALESCE(ce.muscle, ex.muscle) AS muscle,
         to_char(date_trunc('week', to_timestamp(ws.started_at / 1000.0)), 'YYYY-MM-DD') AS week,
         to_char(date_trunc('week', to_timestamp(ws.started_at / 1000.0)), 'YYYY-MM-DD') AS week_start,
         sum(ls.weight * ls.reps)::double precision AS volume,
         count(*) FILTER (WHERE ls.side IS DISTINCT FROM 'R') AS sets,
         count(*) FILTER (WHERE ls.rir IS NOT NULL AND ls.rir <= 3 AND ls.side IS DISTINCT FROM 'R') AS hard_sets
  FROM logged_sets ls
  JOIN workout_sessions ws ON ws.id = ls.session_id
  LEFT JOIN exercise_catalog ce ON ce.id = ls.exercise_id
  LEFT JOIN exercises ex ON ex.id = ls.exercise_id AND ex.user_id = p_friend
  WHERE ls.user_id = p_friend AND ws.finished_at IS NOT NULL
    AND ws.started_at >= nowms - p_days * 86400000::bigint
    AND COALESCE(ce.muscle, ex.muscle) IS NOT NULL
  GROUP BY 1, 2, 3 ORDER BY 2;
END $$;

REVOKE ALL ON FUNCTION public.are_friends(uuid, uuid), public.send_friend_request(text), public.respond_friend_request(uuid, boolean),
  public.my_friends(), public.friend_overview(uuid), public.friend_muscle_weeks(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_friend_request(text), public.respond_friend_request(uuid, boolean),
  public.my_friends(), public.friend_overview(uuid), public.friend_muscle_weeks(uuid, int) TO authenticated;

REVOKE ALL ON public.profiles, public.friendships, public.exercise_catalog FROM anon;
NOTIFY pgrst, 'reload schema';
