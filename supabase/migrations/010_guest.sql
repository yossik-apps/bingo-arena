-- Bingo Arena 0.10.0: visitors can look around before registering.
-- Only public game content is opened up (worlds, stages without their secret boards, stamps, running events, daily deals).
-- Nothing about players, coins or scores is visible without an account.

create policy worlds_read_anon on public.worlds for select to anon using (true);
create policy stages_read_anon on public.stages for select to anon using (true);
create policy stamps_read_anon on public.stamps for select to anon using (true);
create policy liveops_read_anon on public.liveops for select to anon using (active);

grant select on public.worlds, public.stamps, public.liveops to anon;
grant select (id, world, idx, name, level, mods, s1, s2, s3, reward_coins) on public.stages to anon;
grant execute on function public.daily_deals(date) to anon;
