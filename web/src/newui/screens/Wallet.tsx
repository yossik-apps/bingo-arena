// The Wallet (Coins): your balance, the last 7 days, purchases, ways to earn and recent activity.
// The playground has no Wallet page (only the coin and gem chips), so this is designed in its style; the data, rules and words are Classic's (views/Wallet.tsx).
// Uses: wallet, history, rounds, daily, navigation, platform
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LedgerRow } from "../../lib/screenData";
import { price, type PurchaseRow } from "../../lib/store";
import { Ball } from "../Ball";
import { Button, Card, ErrorState, ListRow, SectionHeader, Skeleton, Tabs } from "../components";
import { Coin, Gem, Icon } from "../Icon";
import type { ScreenProps } from "./contract";
import {
  chartLabel, dayTitle, emptyText, filtered, FILTERS, groups, kindIcon, PAGE, PURCHASES_SHOWN, purchaseSub, signed, timeOf, totals, week, WORDS, type Filter,
} from "./Wallet.logic";
import "./wallet.css";

/** Classic's coloured mark for a row: the kind's icon, or + / − when the kind is unknown. */
function Mark({ row }: { row: LedgerRow }) {
  const icon = kindIcon(row), earned = row.amount > 0;
  return (
    <Ball tone={earned ? "G" : "I"} size={40}>
      {icon ? <Icon name={icon} size={20} color="#14254F" /> : <b className="nu-wl-sign" aria-hidden="true">{earned ? "+" : "−"}</b>}
    </Ball>
  );
}

export default function Wallet({ ctx }: ScreenProps) {
  const { wallet, rounds, daily, navigation, platform } = ctx;
  // ctx is rebuilt on every App render, so the loaders are kept in a ref
  const history = useRef(ctx.history);
  history.current = ctx.history;
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [buys, setBuys] = useState<PurchaseRow[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const hasEcon = !!wallet.economy;

  // as in Classic: the activity reloads whenever the balance changes; the list stays on screen while it does
  const loadRows = useCallback((fresh: boolean) => {
    if (fresh) { setFailed(false); setRows(null); }
    history.current.ledger().then(setRows, () => { if (fresh) setFailed(true); });
  }, []);
  useEffect(() => { loadRows(rows === null); }, [wallet.coins]); // eslint-disable-line react-hooks/exhaustive-deps
  // purchases load only with the gem economy; a failure hides the section, as in Classic
  useEffect(() => {
    if (!hasEcon) return;
    history.current.purchases().then(setBuys, () => setBuys([]));
  }, [hasEcon, wallet.economy?.gems, wallet.coins]);

  const days = useMemo(() => week(rows ?? []), [rows]);
  const t = totals(days);
  const list = filtered(rows ?? [], filter);
  const grouped = groups(list, shown);

  const balance = (
    <Card label={WORDS.balance}>
      <div className="nu-wl-bal">
        <span className="nu-wl-eyebrow">{WORDS.balance}</span>
        <span className="nu-wl-amount"><Coin size={40} /><b>{wallet.coins.toLocaleString()}</b></span>
        <p className="nu-wl-note">{WORDS.playMoney}</p>
        {wallet.economy && <span className="nu-wl-gems"><Gem size={22} /><b>{wallet.economy.gems.toLocaleString()}</b> gems</span>}
      </div>
    </Card>
  );

  const kpis = (
    <div className="nu-wl-kpis">
      <div className="nu-wl-kpi"><span>{WORDS.earned7}</span><b className="is-in">+{t.earned.toLocaleString()}</b></div>
      <div className="nu-wl-kpi"><span>{WORDS.spent7}</span><b className="is-out">−{t.spent.toLocaleString()}</b></div>
      <div className="nu-wl-kpi"><span>{WORDS.net}</span><b className={t.net >= 0 ? "is-in" : "is-out"}>{signed(t.net)}</b></div>
    </div>
  );

  const chart = (
    <Card label={WORDS.chart}>
      <div className="nu-wl-chart">
        <div className="nu-wl-chtop">
          <h2>{WORDS.chart}</h2>
          <span className="nu-wl-legend"><i className="is-in" />{WORDS.legendIn} <i className="is-out" />{WORDS.legendOut}</span>
        </div>
        <div className="nu-wl-bars" role="img" aria-label={chartLabel(days)}>
          {days.map((d) => (
            <div className="nu-wl-day" key={d.key} title={dayTitle(d)}>
              <div className="nu-wl-up"><i style={{ height: `${(d.earned / t.top) * 100}%` }} /></div>
              <div className="nu-wl-dn"><i style={{ height: `${(d.spent / t.top) * 100}%` }} /></div>
              <span>{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );

  const purchases = hasEcon && buys.length > 0 && (
    <section className="nu-wl-sec" aria-label={WORDS.purchases}>
      <SectionHeader title={WORDS.purchases} />
      <div className="nu-wl-rows">
        {buys.slice(0, PURCHASES_SHOWN).map((b) => (
          <ListRow key={b.id} title={<span className="nu-wl-ell" title={b.name}>{b.name}</span>} sub={purchaseSub(b)} lead={<Icon name="bag" size={24} />} trail={<b className="nu-wl-price">{price(b.price_cents)}</b>} />
        ))}
      </div>
    </section>
  );

  const ways = (
    <section className="nu-wl-sec" aria-label={WORDS.ways} data-must-peek="ways to earn">
      <SectionHeader title={WORDS.ways} />
      {platform.rewardAd("wallet")}
      <div className="nu-wl-rows">
        <ListRow title={WORDS.drill} sub={daily.drillDone ? WORDS.drillDone : WORDS.drillTodo} lead={<Ball tone="G" size={44}><Icon name="bolt" size={22} color="#14254F" /></Ball>} trail={<Icon name="play" size={22} />} onClick={rounds.startDrill} />
        <ListRow title={WORDS.challenge} sub={WORDS.challengeSub} lead={<Ball tone="P" size={44}><Icon name="star" size={22} color="#14254F" /></Ball>} trail={<Icon name="play" size={22} />} onClick={() => navigation.go("lobby")} />
        <ListRow title={WORDS.quests} sub={WORDS.questsSub} lead={<Ball tone="B" size={44}><Icon name="target" size={22} color="#14254F" /></Ball>} trail={<Icon name="play" size={22} />} onClick={() => navigation.go("collect")} />
      </div>
    </section>
  );

  const activity = (
    <section className="nu-wl-sec nu-wl-activity" aria-label={WORDS.activity}>
      <SectionHeader title={WORDS.activity} />
      <Tabs label={WORDS.filter} value={filter} options={FILTERS} onChange={(f) => { setFilter(f); setShown(PAGE); }} small />
      {failed && <ErrorState title="Your coin activity did not load" onRetry={() => loadRows(true)} />}
      {!failed && rows === null && <Skeleton rows={3} height={64} label="Loading your coin activity" />}
      {rows && list.length === 0 && <p className="nu-wl-empty">{emptyText(filter)}</p>}
      {grouped.map((g) => (
        <section key={g.label} className="nu-wl-group" aria-label={g.label}>
          <div className="nu-wl-gh"><span>{g.label}</span><b className={g.net >= 0 ? "is-in" : "is-out"}>{signed(g.net, false)}</b></div>
          <div className="nu-wl-rows">
            {g.items.map((x) => (
              <ListRow key={x.id} lead={<Mark row={x} />} title={<span className="nu-wl-ell" title={x.reason}>{x.reason}</span>} sub={timeOf(x.created_at)}
                trail={<b className={`nu-wl-v ${x.amount > 0 ? "is-in" : "is-out"}`}>{signed(x.amount, false)}</b>} />
            ))}
          </div>
        </section>
      ))}
      {list.length > shown && <Button kind="white" wide onClick={() => setShown(shown + PAGE)}>{WORDS.more}</Button>}
    </section>
  );

  return (
    <div className="nu-wl">
      <div className="nu-wl-col">{balance}{kpis}{chart}{purchases}{ways}</div>
      <div className="nu-wl-col">{activity}</div>
    </div>
  );
}
