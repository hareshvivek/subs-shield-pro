import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Shield, Plus, Bell, Sun, Moon, ExternalLink, Calendar as CalIcon,
  TrendingUp, Users, ChevronDown, ChevronUp, Trash2, Mail, Sparkles,
  AlertTriangle, Check, CreditCard, Info, RefreshCw, LogOut, Zap, Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { toast, Toaster } from "sonner";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { connectAppUser } from "@/integrations/lovable/appUserConnectorClient";
import {
  startGmailConnect, saveGmailConnection, disconnectGmail,
  getSyncStatus, listSyncedSubscriptions, syncGmailNow,
} from "@/lib/gmailSync.functions";
import {
  seedSubscriptions, monthlyCost, daysUntil, fmtMoney, fmtDate,
  type Subscription, type BillingCycle,
} from "@/lib/subscriptions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "SubShield — Private Subscription & Trial Tracker" },
      { name: "description", content: "Track subscriptions and trials privately. Split shared plans and get vibe-check alerts before each renewal." },
      { property: "og:title", content: "SubShield Dashboard" },
      { property: "og:description", content: "Your private command center for subscriptions and free trials." },
    ],
  }),
  component: Dashboard,
});

const CATEGORIES = ["Entertainment", "Music", "Productivity", "Storage", "News", "AI Tools", "Fitness", "Other"];

function Dashboard() {
  const [subs, setSubs] = useState<Subscription[]>(seedSubscriptions);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { theme, toggle } = useTheme();

  const totalMonthly = useMemo(() => subs.reduce((acc, s) => acc + monthlyCost(s), 0), [subs]);
  const upcoming = useMemo(
    () => subs.filter((s) => daysUntil(s.renewalDate) <= 7 && daysUntil(s.renewalDate) >= 0)
              .sort((a, b) => daysUntil(a.renewalDate) - daysUntil(b.renewalDate)),
    [subs],
  );

  const addSub = (s: Subscription) => {
    setSubs((p) => [s, ...p]);
    toast.success(`${s.name} added to your shield`);
  };
  const removeSub = (id: string) => {
    setSubs((p) => p.filter((s) => s.id !== id));
    toast("Subscription removed");
  };
  const updateSub = (id: string, patch: Partial<Subscription>) =>
    setSubs((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme={theme} position="top-right" />

      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl shield-gradient flex items-center justify-center card-glow">
              <Shield className="size-4 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">SubShield</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">private · encrypted</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Notifications">
                  <Bell className="size-4" />
                </Button>
              </SheetTrigger>
              <NotificationSettings />
            </Sheet>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="gap-1.5 shield-gradient text-primary-foreground hover:opacity-95">
                  <Plus className="size-4" /> Add
                </Button>
              </DialogTrigger>
              <AddSubscriptionModal onAdd={(s) => { addSub(s); setAddOpen(false); }} />
            </Dialog>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-8 py-10 space-y-10">
        {/* Hero / KPIs */}
        <section>
          <div className="flex flex-col gap-2 mb-6">
            <Badge variant="secondary" className="w-fit gap-1.5 text-xs">
              <Sparkles className="size-3" /> Vibe check active
            </Badge>
            <h1 className="text-display text-4xl sm:text-5xl">
              Your shield, <em className="text-display">quietly working.</em>
            </h1>
            <p className="text-muted-foreground max-w-xl">
              {subs.length} active subscriptions tracked. {upcoming.length} renew in the next 7 days.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              icon={<TrendingUp className="size-4" />}
              label="Total Monthly Spend"
              value={fmtMoney(totalMonthly)}
              hint={`${fmtMoney(totalMonthly * 12)} / year`}
              tone="primary"
            />
            <KpiCard
              icon={<Shield className="size-4" />}
              label="Active Subscriptions"
              value={String(subs.length)}
              hint={`${subs.filter((s) => s.shared).length} shared plans`}
            />
            <KpiCard
              icon={<CalIcon className="size-4" />}
              label="Renewing in 7 days"
              value={String(upcoming.length)}
              hint={upcoming[0] ? `Next: ${upcoming[0].name} · ${fmtDate(upcoming[0].renewalDate)}` : "All clear"}
              tone={upcoming.length > 2 ? "warn" : "default"}
            />
          </div>
        </section>

        {/* Timeline */}
        <section>
          <SectionHeader title="Upcoming renewals" subtitle="Next 14 days" />
          <TimelineCalendar subs={subs} />
        </section>

        {/* Virtual Shields */}
        <section>
          <SectionHeader title="Active Virtual Shields" subtitle="1 card active" />
          <VirtualCardSection />
        </section>

        {/* Subscriptions list */}
        <section>
          <SectionHeader title="Tracked subscriptions" subtitle={`${subs.length} services`} />
          <div className="space-y-3">
            {subs.map((s) => (
              <SubscriptionRow
                key={s.id}
                sub={s}
                expanded={expanded === s.id}
                onToggleExpand={() => setExpanded(expanded === s.id ? null : s.id)}
                onUpdate={(patch) => updateSub(s.id, patch)}
                onRemove={() => removeSub(s.id)}
              />
            ))}
          </div>
        </section>

        <footer className="pt-8 pb-4 text-center text-xs text-muted-foreground">
          End-to-end encrypted · No data sold · Made with care
        </footer>
      </main>
    </div>
  );
}

/* ──────────────────────────── KPI Card ──────────────────────────── */

function KpiCard({
  icon, label, value, hint, tone = "default",
}: { icon: React.ReactNode; label: string; value: string; hint?: string; tone?: "default" | "primary" | "warn" }) {
  return (
    <Card className="p-5 relative overflow-hidden border-border bg-card">
      {tone === "primary" && (
        <div className="absolute -top-12 -right-12 size-40 rounded-full shield-gradient opacity-20 blur-2xl" />
      )}
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
        <span className={tone === "warn" ? "text-warning" : tone === "primary" ? "text-primary" : ""}>{icon}</span>
        {label}
      </div>
      <div className="text-display text-4xl mt-3">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

/* ──────────────────────────── Section Header ──────────────────────────── */

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h2 className="text-display text-2xl">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ──────────────────────────── Timeline ──────────────────────────── */

function TimelineCalendar({ subs }: { subs: Subscription[] }) {
  const days = Array.from({ length: 14 }, (_, i) => i);
  const byDay = useMemo(() => {
    const map = new Map<number, Subscription[]>();
    subs.forEach((s) => {
      const d = daysUntil(s.renewalDate);
      if (d >= 0 && d < 14) {
        const arr = map.get(d) ?? [];
        arr.push(s);
        map.set(d, arr);
      }
    });
    return map;
  }, [subs]);

  return (
    <Card className="p-4 bg-card border-border overflow-x-auto">
      <div className="flex gap-2 min-w-max">
        {days.map((d) => {
          const items = byDay.get(d) ?? [];
          const date = new Date();
          date.setDate(date.getDate() + d);
          const isToday = d === 0;
          const total = items.reduce((a, s) => a + s.cost, 0);
          return (
            <div
              key={d}
              className={`flex-1 min-w-[88px] rounded-xl p-3 border transition-colors ${
                isToday ? "border-primary bg-accent/40" : items.length ? "border-border bg-muted/30" : "border-border/50"
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {date.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div className="text-lg font-semibold">{date.getDate()}</div>
              <div className="mt-2 space-y-1">
                {items.length === 0 ? (
                  <div className="h-6" />
                ) : (
                  items.slice(0, 2).map((s) => (
                    <div key={s.id} className="flex items-center gap-1.5 text-[11px] truncate">
                      <span className="size-1.5 rounded-full" style={{ background: s.color }} />
                      <span className="truncate">{s.name}</span>
                    </div>
                  ))
                )}
                {items.length > 2 && <div className="text-[10px] text-muted-foreground">+{items.length - 2} more</div>}
              </div>
              {total > 0 && (
                <div className="text-[10px] mt-2 text-primary font-medium">{fmtMoney(total)}</div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ──────────────────────────── Subscription Row ──────────────────────────── */

function SubscriptionRow({
  sub, expanded, onToggleExpand, onUpdate, onRemove,
}: {
  sub: Subscription;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<Subscription>) => void;
  onRemove: () => void;
}) {
  const d = daysUntil(sub.renewalDate);
  const soon = d <= 3;
  const inactive = sub.lastUsedDaysAgo > 7;

  return (
    <Card className="bg-card border-border overflow-hidden">
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="size-11 rounded-xl flex items-center justify-center text-white font-semibold text-sm shrink-0"
            style={{ background: sub.color }}
          >
            {sub.initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-medium truncate ${sub.status === "auto-canceled" ? "line-through opacity-60" : ""}`}>{sub.name}</span>
              <Badge variant="outline" className="text-[10px] py-0">{sub.category}</Badge>
              {sub.source === "email" && (
                <Badge variant="secondary" className="text-[10px] py-0 gap-1 bg-primary/10 text-primary border-primary/20">
                  <Mail className="size-2.5" /> Synced via Email
                </Badge>
              )}
              {sub.status === "auto-canceled" ? (
                <Badge variant="secondary" className="text-[10px] py-0 gap-1 bg-muted text-muted-foreground">
                  <Shield className="size-2.5" /> Auto-Canceled
                </Badge>
              ) : sub.source === "email" ? (
                <Badge variant="secondary" className="text-[10px] py-0 gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                </Badge>
              ) : null}
              {inactive && (
                <Badge variant="secondary" className="text-[10px] py-0 gap-1 text-warning">
                  <AlertTriangle className="size-2.5" /> Unused {sub.lastUsedDaysAgo}d
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {fmtMoney(sub.cost)} / {sub.cycle.toLowerCase()} · renews {fmtDate(sub.renewalDate)}
              {d >= 0 && (
                <span className={`ml-2 ${soon ? "text-warning" : ""}`}>
                  {d === 0 ? "today" : `in ${d}d`}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch
              checked={sub.shared}
              onCheckedChange={(v) => onUpdate({ shared: v, splitters: v && sub.splitters.length === 0
                ? [{ id: "me", email: "you@subshield.app", percent: 100 }]
                : sub.splitters })}
              aria-label="Shared plan"
            />
            <span className="text-xs text-muted-foreground">Shared</span>
          </div>
          {sub.shared && (
            <Button variant="ghost" size="sm" onClick={onToggleExpand} className="text-xs">
              <Users className="size-3.5 mr-1" /> Split
              {expanded ? <ChevronUp className="size-3 ml-1" /> : <ChevronDown className="size-3 ml-1" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove">
            <Trash2 className="size-4" />
          </Button>
          <a href={sub.cancelUrl} target="_blank" rel="noreferrer">
            <Button variant="destructive" size="sm" className="gap-1.5">
              Cancel <ExternalLink className="size-3" />
            </Button>
          </a>
        </div>
      </div>

      {sub.shared && expanded && (
        <SharedSplitter sub={sub} onUpdate={onUpdate} />
      )}
    </Card>
  );
}

/* ──────────────────────────── Shared Splitter ──────────────────────────── */

function SharedSplitter({
  sub, onUpdate,
}: { sub: Subscription; onUpdate: (patch: Partial<Subscription>) => void }) {
  const [newEmail, setNewEmail] = useState("");
  const total = sub.splitters.reduce((a, s) => a + s.percent, 0);

  const update = (id: string, percent: number) =>
    onUpdate({ splitters: sub.splitters.map((s) => (s.id === id ? { ...s, percent } : s)) });

  const remove = (id: string) =>
    onUpdate({ splitters: sub.splitters.filter((s) => s.id !== id) });

  const add = () => {
    if (!newEmail.includes("@")) { toast.error("Enter a valid email"); return; }
    const equal = Math.floor(100 / (sub.splitters.length + 1));
    onUpdate({
      splitters: [
        ...sub.splitters.map((s) => ({ ...s, percent: equal })),
        { id: crypto.randomUUID(), email: newEmail, percent: 100 - equal * sub.splitters.length },
      ],
    });
    setNewEmail("");
  };

  return (
    <div className="border-t border-border bg-muted/30 px-4 sm:px-5 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Split breakdown</div>
        <div className={`text-xs ${total === 100 ? "text-success" : "text-warning"}`}>
          {total === 100 ? <span className="inline-flex items-center gap-1"><Check className="size-3" /> Balanced</span> : `${total}% allocated`}
        </div>
      </div>

      <div className="space-y-3">
        {sub.splitters.map((sp) => (
          <div key={sp.id} className="grid grid-cols-12 gap-3 items-center">
            <div className="col-span-12 sm:col-span-5 flex items-center gap-2 text-sm truncate">
              <div className="size-7 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-accent-foreground">
                {sp.email[0]?.toUpperCase()}
              </div>
              <span className="truncate">{sp.email}</span>
            </div>
            <div className="col-span-7 sm:col-span-4">
              <Slider
                value={[sp.percent]}
                onValueChange={([v]) => update(sp.id, v)}
                max={100}
                step={1}
              />
            </div>
            <div className="col-span-3 sm:col-span-2 text-sm tabular-nums">
              {fmtMoney((sub.cost * sp.percent) / 100)}
              <div className="text-[10px] text-muted-foreground">{sp.percent}%</div>
            </div>
            <div className="col-span-2 sm:col-span-1 flex justify-end">
              <Button variant="ghost" size="icon" onClick={() => remove(sp.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Separator />

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="roommate@home.io"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="flex-1"
        />
        <Button onClick={add} variant="secondary" className="gap-1.5">
          <Plus className="size-4" /> Add person
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          size="sm"
          className="bg-[#3D95CE] hover:bg-[#3D95CE]/90 text-white gap-1.5"
          onClick={() => toast.success("Venmo requests drafted")}
        >
          Send Venmo Request
        </Button>
        <Button
          size="sm"
          className="bg-[#1F8A70] hover:bg-[#1F8A70]/90 text-white gap-1.5"
          onClick={() => toast.success("Pushed to Splitwise")}
        >
          Add to Splitwise
        </Button>
      </div>
    </div>
  );
}

/* ──────────────────────────── Add Modal ──────────────────────────── */

function AddSubscriptionModal({ onAdd }: { onAdd: (s: Subscription) => void }) {
  const [manual, setManual] = useState(false);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>("Monthly");
  const [date, setDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [category, setCategory] = useState("Entertainment");

  const palette = ["#10A37F", "#E50914", "#1DB954", "#0A84FF", "#7B61FF", "#FF6B35"];
  const submit = () => {
    if (!name || !cost) { toast.error("Name and cost are required"); return; }
    const s: Subscription = {
      id: crypto.randomUUID(),
      name, cost: parseFloat(cost), cycle, renewalDate: new Date(date).toISOString(),
      category, shared: false, splitters: [],
      cancelUrl: `https://www.google.com/search?q=cancel+${encodeURIComponent(name)}+subscription`,
      color: palette[Math.floor(Math.random() * palette.length)],
      initials: name.slice(0, 2).toUpperCase(),
      lastUsedDaysAgo: 0,
      source: "manual",
      status: "active",
    };
    onAdd(s);
  };

  const connect = (provider: "Gmail" | "Microsoft") => {
    toast.success(`Connecting ${provider}…`, { description: "Scanning inbox for subscription receipts" });
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="text-display text-2xl">Track a subscription</DialogTitle>
        <DialogDescription>
          {manual ? "Enter details manually — your data stays local." : "Sync your inbox and SubShield handles the rest."}
        </DialogDescription>
      </DialogHeader>

      {!manual ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border p-5 bg-gradient-to-br from-accent/40 to-muted/30 space-y-4">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl shield-gradient flex items-center justify-center shrink-0">
                <Mail className="size-5 text-primary-foreground" />
              </div>
              <div>
                <div className="font-semibold">Connect Inbox to Auto-Track</div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  SubShield will automatically detect new subscriptions, update renewal dates from digital receipts, and automatically remove canceled plans.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <Button type="button" variant="outline" className="gap-2 bg-background justify-start h-11" onClick={() => connect("Gmail")}>
                <GoogleIcon /> Connect Gmail
              </Button>
              <Button type="button" variant="outline" className="gap-2 bg-background justify-start h-11" onClick={() => connect("Microsoft")}>
                <OutlookIcon /> Connect Microsoft
              </Button>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Shield className="size-3" /> Read-only access · encrypted · revoke anytime
            </div>
          </div>

          <button
            type="button"
            onClick={() => setManual(true)}
            className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 py-1"
          >
            Or enter details manually
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Service name</Label>
            <Input id="name" placeholder="Disney+" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cost">Cost (USD)</Label>
              <Input id="cost" type="number" step="0.01" placeholder="9.99" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Billing cycle</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as BillingCycle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Next renewal</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setManual(false)}
            className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 py-1"
          >
            ← Back to inbox sync
          </button>
        </div>
      )}

      {manual && (
        <DialogFooter>
          <Button onClick={submit} className="shield-gradient text-primary-foreground w-full sm:w-auto">
            Add to Shield
          </Button>
        </DialogFooter>
      )}
    </DialogContent>
  );
}

/* ──────────────────────────── Notification Settings ──────────────────────────── */

function NotificationSettings() {
  const [renewalAlert, setRenewalAlert] = useState(true);
  const [renewalDays, setRenewalDays] = useState([3]);
  const [vibeCheck, setVibeCheck] = useState(true);
  const [inactiveDays, setInactiveDays] = useState([7]);
  const [priceHike, setPriceHike] = useState(true);
  const [trialEnd, setTrialEnd] = useState(true);
  const [weekly, setWeekly] = useState(false);

  return (
    <SheetContent className="overflow-y-auto">
      <SheetHeader>
        <SheetTitle className="text-display text-2xl">Notifications</SheetTitle>
        <p className="text-sm text-muted-foreground">Stay one step ahead of every renewal.</p>
      </SheetHeader>

      <div className="mt-6 space-y-6 pr-1">
        <SettingBlock
          title="Renewal reminders"
          desc="A heads-up before any subscription renews."
          checked={renewalAlert}
          onCheckedChange={setRenewalAlert}
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Notify me</span>
            <span className="font-medium">{renewalDays[0]} days before</span>
          </div>
          <Slider value={renewalDays} onValueChange={setRenewalDays} min={1} max={14} step={1} />
        </SettingBlock>

        <SettingBlock
          title="Usage Vibe Checks"
          desc="If you haven't used a service in a while, we'll ask if you want to cancel before it renews."
          checked={vibeCheck}
          onCheckedChange={setVibeCheck}
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Inactivity threshold</span>
            <span className="font-medium">{inactiveDays[0]} days</span>
          </div>
          <Slider value={inactiveDays} onValueChange={setInactiveDays} min={3} max={30} step={1} />
        </SettingBlock>

        <SettingBlock title="Price hike alerts" desc="Notify if a subscription cost increases." checked={priceHike} onCheckedChange={setPriceHike} />
        <SettingBlock title="Trial ending soon" desc="Alert 24 hours before a free trial converts." checked={trialEnd} onCheckedChange={setTrialEnd} />
        <SettingBlock title="Weekly summary" desc="Sunday morning recap of spend and renewals." checked={weekly} onCheckedChange={setWeekly} />
      </div>
    </SheetContent>
  );
}

function SettingBlock({
  title, desc, checked, onCheckedChange, children,
}: { title: string; desc: string; checked: boolean; onCheckedChange: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-4 space-y-3 bg-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{title}</div>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
      {checked && children && <div className="space-y-2 pt-1">{children}</div>}
    </div>
  );
}

/* ──────────────────────────── Virtual Shields ──────────────────────────── */

function VirtualCardSection() {
  return (
    <Card className="bg-card border-border overflow-hidden">
      <div className="p-5 sm:p-6 flex flex-col lg:flex-row gap-6 lg:items-start">
        {/* Stylized mock card */}
        <div className="relative shrink-0 mx-auto lg:mx-0">
          <div
            className="relative w-[320px] h-[200px] rounded-2xl p-5 flex flex-col justify-between text-white shadow-2xl overflow-hidden"
            style={{
              background: "linear-gradient(145deg, #0f172a 0%, #1e293b 40%, #0f172a 100%)",
            }}
          >
            {/* Glow / sheen */}
            <div className="absolute -top-16 -right-16 size-48 rounded-full bg-[#10b981] opacity-20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 size-36 rounded-full bg-[#3b82f6] opacity-15 blur-2xl pointer-events-none" />

            {/* Card top row */}
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg shield-gradient flex items-center justify-center">
                  <Shield className="size-4 text-primary-foreground" />
                </div>
                <span className="text-xs font-semibold tracking-widest uppercase opacity-80">SubShield</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider opacity-60 font-medium">Virtual Debit</span>
            </div>

            {/* Card chip */}
            <div className="relative z-10">
              <div className="w-11 h-8 rounded-md border border-white/20 bg-yellow-500/20 flex items-center justify-center">
                <div className="w-7 h-5 rounded-sm border border-white/10 bg-yellow-400/30" />
              </div>
            </div>

            {/* Card bottom row */}
            <div className="relative z-10 space-y-1">
              <div className="text-[11px] uppercase tracking-wider opacity-60">Trial Protection Status</div>
              <div className="text-lg font-semibold tracking-tight">Active ($0.00 Limit)</div>
              <div className="flex items-center gap-1.5 text-[10px] opacity-60">
                <span className="inline-block size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Monitoring 8 trials
              </div>
            </div>
          </div>
        </div>

        {/* Info / description */}
        <div className="flex-1 space-y-4">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-lg bg-accent flex items-center justify-center shrink-0 mt-0.5">
              <CreditCard className="size-4 text-accent-foreground" />
            </div>
            <div>
              <h3 className="font-medium">$0.00-limit virtual card</h3>
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                This virtual card is capped at $0.00 to automatically block charges and force-cancel the trial if you forget to do it manually.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <Info className="size-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium">How it works</h3>
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                When you start a free trial, generate a unique virtual card number. Since the limit is $0.00, any attempt to bill you after the trial ends will be declined — giving you a safety net even if you miss the cancellation deadline.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.success("New virtual card generated")}>
              <Plus className="size-3.5" /> Generate new card
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => toast("Viewing transaction history")}>
              <ExternalLink className="size-3.5" /> View blocked attempts
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ──────────────────────────── Brand Icons ──────────────────────────── */

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function OutlookIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="#0078D4">
      <path d="M7.88 12.04c0-1.65-.78-2.47-2.34-2.47-1.55 0-2.34.82-2.34 2.47 0 1.65.79 2.47 2.36 2.47 1.55 0 2.32-.82 2.32-2.47zM5.54 8c2.84 0 4.27 1.35 4.27 4.04S8.38 16.08 5.54 16.08C2.7 16.08 1.28 14.73 1.28 12.04S2.7 8 5.54 8zm5.94 7.97V8.11h1.4l4.36 5.62V8.11h1.5v7.86h-1.4l-4.37-5.61v5.61h-1.49zM22.5 4H12.91v3.04h.5C16.95 7.04 19.5 9.6 19.5 13s-2.55 5.96-6.09 5.96h-.5V22h9.59c.83 0 1.5-.67 1.5-1.5V5.5c0-.83-.67-1.5-1.5-1.5z" />
    </svg>
  );
}
