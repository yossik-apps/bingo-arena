// Local development only (?gallery): every shared component in one place. App.tsx loads this behind import.meta.env.DEV.
import { useState } from "react";
import "./tokens.css";
import "./visuals.css";
import "./shell.css";
import "./fonts";
import { Badge, Button, Card, Chip, EmptyState, ErrorState, ListRow, Modal, ProgressBar, SectionHeader, Select, Share, Sheet, Skeleton, Switch, Tabs, TextField, Toast } from "./components";
import { Ball } from "./Ball";
import { Icon, type IconName } from "./Icon";
import Radar from "./Radar";
import { RewardAdView } from "./RewardAd";
import DailyPopup, { DayStrip } from "./DailyPopup";
import { computeDna } from "../lib/dna";
import { demoRounds } from "../lib/demo";

const ICONS: IconName[] = ["lock", "shield", "share", "medal", "refresh", "gift", "bolt", "users", "target", "play", "map", "book", "trophy", "bag", "check", "flame", "mail", "menu", "star", "ghost", "eye", "clock", "back", "plus", "user", "gear", "out", "ext", "help", "speaker", "swords", "wave", "megaphone"];
const CAL = { rewards: [20, 30, 40, 50, 75, 100, 200], day: 4, claimed_today: true, streak: 14, next: 75, shields: 1 };

export default function Gallery() {
  const [tab, setTab] = useState("stages");
  const [speed, setSpeed] = useState("chill");
  const [open, setOpen] = useState<"sheet" | "modal" | "daily" | "tall" | null>(new URLSearchParams(location.search).get("open") as "sheet" | "modal" | "daily" | "tall" | null);
  const [name, setName] = useState("Coach Nova");
  const [pw, setPw] = useState("short");
  const [msg, setMsg] = useState("Hi! My daily reward did not arrive this morning.");
  const [limit, setLimit] = useState("45");
  const [tips, setTips] = useState(true);
  const [big, setBig] = useState(false);
  const dna = computeDna(demoRounds());
  document.documentElement.classList.add("nu-on");
  return (
    <div className="nu-root">
      <div className="nu-gallery">
        <h1>Components</h1>

        <SectionHeader title="Button" trail="lg, md, sm" />
        <Button size="lg" wide>Play Practice</Button>
        <div className="nu-gallerybox">
          <Button>Gold</Button>
          <Button kind="green">Green</Button>
          <Button kind="white">White</Button>
          <Button kind="panel">Panel</Button>
          <Button kind="ghost">Ghost</Button>
          <Button kind="danger">Delete account</Button>
          <Button size="sm" kind="danger">Leave crew</Button>
          <Button size="sm">Claim</Button>
          <Button size="sm" kind="green">Done</Button>
          <Button size="sm" short>Short</Button>
          <Button disabled>Disabled</Button>
          <Button kind="panel" size="sm" label="Add"><Icon name="check" size={20} /></Button>
        </div>

        <SectionHeader title="Card" />
        <div className="nu-gallerybox" style={{ alignItems: "stretch" }}>
          <div style={{ flex: "1 1 240px" }}><Card label="White card"><b>White card</b><br />Most content sits on this.</Card></div>
          <div style={{ flex: "1 1 240px" }}><Card tone="panel" label="Panel card"><b>Panel card</b><br />For quieter, locked or secondary content.</Card></div>
        </div>

        <SectionHeader title="Chip and Badge" />
        <div className="nu-gallerybox">
          <Chip>2x XP today</Chip>
          <Chip tone="pink">NEW</Chip>
          <Chip tone="green">FREE</Chip>
          <Chip tone="dark">Lv 8</Chip>
          <Badge count={3} label="3 new messages" />
          <Badge count={12} label="12 new messages" />
          <Badge label="A reward is waiting" />
        </div>

        <SectionHeader title="Tabs" />
        <Tabs label="Journey sections" value={tab} onChange={setTab} options={[{ id: "stages", text: "Stages" }, { id: "season", text: "Season" }, { id: "events", text: "Events" }]} />
        <Tabs small label="Speed" value={speed} onChange={setSpeed} options={[{ id: "chill", text: "Beginner" }, { id: "normal", text: "Medium" }, { id: "fast", text: "Hard", disabled: true }]} />

        <SectionHeader title="List row" trail="0/36" />
        <div className="nu-gallerycol">
          <ListRow title="Practice" sub="Play alone. Beat your best." lead={<Ball tone="B" num={7} size={48} />} trail={<Chip tone="green">FREE</Chip>} selected onClick={() => undefined} />
          <ListRow title="Beat the Ghost" sub="Race a practice rival." lead={<Ball tone="I" num={22} size={48} />} onClick={() => undefined} />
          <ListRow title="Chapter 2: Neon Boulevard" sub="Needs 12 stars. You have 0." locked lead={<Icon name="lock" size={26} />} />
        </div>

        <SectionHeader title="Progress bar" />
        <Card label="Progress on white"><ProgressBar pct={64} label="Season tier 12" showLabel value="64%" /></Card>
        <ProgressBar pct={35} label="XP to next level" dark />

        <SectionHeader title="Empty state" />
        <EmptyState title="No crew yet" text="Team up with friends and fill a shared chest." action={<Button size="sm">Find a crew</Button>} />

        <SectionHeader title="Error state" />
        <ErrorState onRetry={() => undefined} />

        <SectionHeader title="Loading skeleton" />
        <Skeleton rows={2} />

        <SectionHeader title="Toast" />
        <Toast inline>Saved. Your progress is kept on every device.</Toast>

        <SectionHeader title="Sheet and Modal" />
        <div className="nu-gallerybox">
          <Button kind="white" onClick={() => setOpen("sheet")}>Open sheet</Button>
          <Button kind="white" onClick={() => setOpen("modal")}>Open modal</Button>
          <Button kind="white" onClick={() => setOpen("daily")}>Daily reward</Button>
          <Button kind="white" onClick={() => setOpen("tall")}>Tall sheet with Not now</Button>
        </div>

        <SectionHeader title="Form controls" trail="TextField (one line or multiline), Select, Switch" />
        <Card label="Settings sample">
          <div className="nu-gallerycol">
            <TextField label="Coach's name" value={name} maxLength={24} onChange={setName} hint="Up to 24 letters." />
            <TextField label="New password" type="password" value={pw} onChange={setPw} error={pw.length < 8 ? "Use at least 8 characters." : undefined} autoComplete="new-password" />
            <TextField label="Your message" multiline rows={5} maxLength={500} value={msg} onChange={setMsg} hint="We answer in your inbox." />
            <Select label="Break reminder" value={limit} onChange={setLimit} options={[{ value: "0", text: "Off" }, { value: "30", text: "Every 30 min" }, { value: "45", text: "Every 45 min" }, { value: "60", text: "Every 60 min" }]} />
            <Switch label="Helpful tips" checked={tips} onChange={setTips} />
            <Switch label="Larger text" sub="Bigger letters on every screen" checked={big} onChange={setBig} />
          </div>
        </Card>

        <SectionHeader title="Share" />
        <Card label="Share sample"><div className="nu-gallerycol"><Share title="Share your Bingo DNA" text="My Bingo DNA says I'm a Sharp Dabber" link="https://example.com/" /><Share title="Challenge a friend" text="Beat my score" link="" /></div></Card>

        <SectionHeader title="Icons" />
        <div className="nu-gallerybox">{ICONS.map((n) => <span key={n} className="nu-galleryicon" title={n}><Icon name={n} size={28} /><small>{n}</small></span>)}</div>

        <SectionHeader title="Reward video" trail="ctx.platform.rewardAd" />
        <div className="nu-gallerycol">
          <RewardAdView coins={25} left={3} busy={false} msg="" onWatch={() => undefined} />
          <RewardAdView coins={25} left={3} busy={false} msg="" compact onWatch={() => undefined} />
          <RewardAdView coins={25} left={3} busy msg="" onWatch={() => undefined} />
          <RewardAdView coins={25} left={2} busy={false} msg="+25 coins. Thanks for watching!" onWatch={() => undefined} />
          <RewardAdView coins={25} left={3} busy={false} msg="The video was closed early, so there is no reward this time." onWatch={() => undefined} />
        </div>

        <SectionHeader title="Radar" trail="Bingo DNA" />
        <Card label="Bingo DNA chart">{dna ? <Radar dna={dna} /> : <p>No sample DNA.</p>}</Card>

        <SectionHeader title="Daily rewards" />
        <Card label="Seven-day strip"><DayStrip cal={CAL} /></Card>
      </div>
      {open === "sheet" && <Sheet label="Sample sheet" title="Sample sheet" onClose={() => setOpen(null)}><p style={{ margin: 0 }}>A bottom sheet on phones, centered from 1000 px.</p></Sheet>}
      {open === "modal" && <Modal label="Sample modal" title="Sample modal" onClose={() => setOpen(null)}><p style={{ margin: 0 }}>Centered at every width.</p></Modal>}
      {open === "tall" && (
        <Sheet label="Sample sign-up form" title="Save your progress" closeText="Not now" tall onClose={() => setOpen(null)}>
          <p style={{ margin: 0 }}>A long form: the screen less 24 px on phones, "Not now" at the top and no Close at the bottom, so the main button stays in view.</p>
          <TextField label="Player name" value="Sample player" onChange={() => undefined} />
          <TextField label="Email" type="email" value="" placeholder="you@example.com" onChange={() => undefined} />
          <TextField label="Password" type="password" value="" hint="At least 8 characters" onChange={() => undefined} />
          <Switch label="I am 18 or older and accept the Terms" checked={false} onChange={() => undefined} />
          <Button kind="gold" size="lg" wide onClick={() => setOpen(null)}>Create my account</Button>
          <Button kind="white" wide onClick={() => setOpen(null)}>Continue with Google</Button>
        </Sheet>
      )}
      {open === "daily" && <DailyPopup cal={CAL} bonus={50} pack="Sunny stamp 7" shieldUsed onClose={() => setOpen(null)} />}
    </div>
  );
}
