// Local development only (?gallery): every shared component in one place. App.tsx loads this behind import.meta.env.DEV.
import { useState } from "react";
import "./tokens.css";
import "./visuals.css";
import "./shell.css";
import "./fonts";
import { Badge, Button, Card, Chip, EmptyState, ErrorState, ListRow, Modal, ProgressBar, SectionHeader, Sheet, Skeleton, Tabs, Toast } from "./components";
import { Ball } from "./Ball";
import { Icon } from "./Icon";

export default function Gallery() {
  const [tab, setTab] = useState("stages");
  const [speed, setSpeed] = useState("chill");
  const [open, setOpen] = useState<"sheet" | "modal" | null>(new URLSearchParams(location.search).get("open") as "sheet" | "modal" | null);
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
          <ListRow title="Chapter 2: Neon Boulevard" sub="Needs 12 stars. You have 0." locked lead={<Icon name="check" size={26} />} />
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
        </div>
      </div>
      {open === "sheet" && <Sheet label="Sample sheet" title="Sample sheet" onClose={() => setOpen(null)}><p style={{ margin: 0 }}>A bottom sheet on phones, centered from 1000 px.</p></Sheet>}
      {open === "modal" && <Modal label="Sample modal" title="Sample modal" onClose={() => setOpen(null)}><p style={{ margin: 0 }}>Centered at every width.</p></Modal>}
    </div>
  );
}
