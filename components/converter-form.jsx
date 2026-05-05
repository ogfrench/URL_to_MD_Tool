"use client";

/* eslint-disable @next/next/no-img-element */

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Clipboard,
  Download,
  FileText,
  FileType,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Search,
  Square,
  Trash2,
  Wand2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { ProtinusMark } from "@/components/protinus-mark";
import { normalizeUrl, domainFor, faviconFor } from "@/lib/url";
import { fmtSize, fmtTimeAgo, isCancelled } from "@/lib/format";
import { useConversionJob } from "@/lib/hooks/use-conversion-job";
import { List } from "react-window";

const PASTE_SAMPLE = [
  "https://www.protinus.nl/over-ons",
  "https://en.wikipedia.org/wiki/PDF",
  "https://www.dailydoseofds.com/p/10-must-use-slash-commands-in-claude-code/",
];
const CRAWL_SAMPLE = "https://en.wikipedia.org/wiki/Markdown";


function derivePhase({ isRunning, items, stats }) {
  if (isRunning) return "running";
  if (items.length === 0) return "idle";
  if (stats.cancelled > 0) return "stopped";
  if (stats.done === 0) return "nothing";
  if (stats.error > 0) return "errors";
  return "saved";
}

function TopBarTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors ${
        active
          ? "bg-white text-[var(--navy)]"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export function ConverterForm() {
  const [tab, setTab] = useState("new");
  const [collections, setCollections] = useState([]);

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((d) => setCollections(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Couldn't load Library. Check your connection."));
  }, []);

  function addCollection(payload) {
    setCollections((c) => [payload, ...c.filter((x) => x.id !== payload.id)]);
  }

  async function deleteCollection(id) {
    const prev = collections;
    setCollections((c) => c.filter((x) => x.id !== id));
    try {
      const r = await fetch(`/api/collections/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      toast.success("Deleted");
    } catch {
      setCollections(prev);
      toast.error("Couldn't delete. Try again.");
    }
  }

  async function renameCollection(id, name) {
    const prev = collections;
    setCollections((c) => c.map((x) => x.id === id ? { ...x, name } : x));
    try {
      const r = await fetch(`/api/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setCollections(prev);
      toast.error("Couldn't rename. Try again.");
    }
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <header className="border-b border-[var(--line)] bg-[var(--navy)] text-white">
        <div className="mx-auto flex max-w-[1240px] items-center gap-5 px-7 py-3.5">
          <div className="flex items-center gap-2.5">
            <ProtinusMark />
            <span className="text-[17px] font-bold tracking-tight">
              Protinus<em className="ml-0.5 not-italic font-extrabold text-[var(--green)]">ETA</em>
            </span>
          </div>
          <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
            URL → Doc
          </span>
          <div className="ml-auto flex items-center gap-1 rounded-lg bg-white/10 p-1">
            <TopBarTab active={tab === "new"} onClick={() => setTab("new")}>
              Save
            </TopBarTab>
            <TopBarTab active={tab === "library"} onClick={() => setTab("library")}>
              Library
              <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                tab === "library" ? "bg-[var(--green)] text-white" : "bg-white/20 text-white"
              }`}>
                {collections.length}
              </span>
            </TopBarTab>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-7 py-10">
        {tab === "new" ? (
          <NewSave onCreateCollection={addCollection} />
        ) : (
          <Library collections={collections} onDelete={deleteCollection} onRename={renameCollection} onGoNew={() => setTab("new")} />
        )}
      </main>
    </div>
  );
}

function NewSave({ onCreateCollection }) {
  const [text, setText] = useState("");
  const [format, setFormat] = useState("markdown");
  const [name, setName] = useState("");
  const [recursive, setRecursive] = useState(false);
  const [maxPages, setMaxPages] = useState(100);
  const [includeImages, setIncludeImages] = useState(true);
  const [pageSize, setPageSize] = useState("A4");

  const { items, isRunning, jobId, stats, progress, start: startJob, stop, retryItem, reset } = useConversionJob();

  const validUrls = useMemo(() => {
    const seen = new Set();
    return text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map(normalizeUrl)
      .filter((u) => {
        if (!u || seen.has(u)) return false;
        seen.add(u);
        return true;
      });
  }, [text]);

  const lineCount = text.split(/\r?\n/).filter((l) => l.trim()).length;
  const invalidCount = Math.max(0, lineCount - validUrls.length);

  const phase = derivePhase({ isRunning, items, stats });

  const headerLabel = {
    idle: "Ready",
    running: `Saving · ${stats.done + stats.error + stats.cancelled} of ${items.length}`,
    stopped: `Stopped · ${stats.done} of ${items.length}`,
    nothing: "Nothing saved",
    errors: `Saved with errors · ${stats.done} of ${items.length}`,
    saved: `Saved · ${items.length} of ${items.length}`,
  }[phase];

  function start() {
    startJob({
      urls: validUrls,
      format,
      name,
      options: { images: includeImages, reader: true, pageSize, recursive, maxPages },
    });
  }

  const downloadOne = useCallback((item) => {
    if (!jobId) return;
    window.open(`/api/files/${jobId}/${item.id}`, "_blank");
  }, [jobId]);

  function downloadMerged() {
    if (!jobId) return;
    window.location.href = `/api/jobs/${jobId}/merged`;
    const firstDomain = domainFor(items[0]?.url) || "Untitled";
    const stamp = new Date().toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const extra = items.length > 1 ? ` +${items.length - 1}` : "";
    onCreateCollection({
      id: jobId,
      name: name || `${firstDomain}${extra} · ${stamp}`,
      format,
      createdAt: Date.now(),
      urls: items.map((i) => i.url),
      done: stats.done,
      errors: stats.error,
    });
  }

  function loadSample() {
    if (recursive) setText(CRAWL_SAMPLE);
    else setText(PASTE_SAMPLE.join("\n"));
  }

  async function paste() {
    try {
      const t = await navigator.clipboard.readText();
      setText((cur) => (cur ? `${cur.replace(/\s+$/, "")}\n${t}` : t));
    } catch {
      toast.error("Clipboard unavailable. Use Ctrl+V into the box.");
    }
  }

  function clearAll() {
    setText("");
    reset();
  }

  function handleModeChange(v) {
    if (!v) return;
    const next = v === "crawl";
    if (next !== recursive) setText("");
    setRecursive(next);
  }

  const formatLabel = format === "pdf" ? "PDF" : "Markdown";
  const ctaLabel = recursive
    ? `Make ${formatLabel} from site`
    : `Make ${formatLabel}${validUrls.length > 1 ? ` · ${validUrls.length}` : ""}`;

  const showOutput = items.length > 0 || isRunning;

  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-2xl sm:text-3xl md:text-[32px] lg:text-[36px] font-bold leading-tight text-[var(--navy)]">
          Bookmarks forget. <span className="text-[var(--green)]">Your library remembers.</span>
        </h1>
        <p className="mt-3 text-sm sm:text-base md:text-lg leading-6 text-[var(--muted)]">
          Paste a list of links or crawl a whole site. Get a clean PDF or Markdown you can read offline, search later, and actually keep.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[440px_minmax(0,1fr)]">
      <Card className={`relative flex flex-col overflow-hidden p-6 min-h-[540px] transition-colors ${isRunning ? "border-[var(--green)]" : ""}`}>
        {isRunning && (
          <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 bg-[var(--green-soft)] py-1.5 text-xs font-semibold text-[var(--green-2)]">
            <Spinner size="xs" /> Saving · settings locked
          </div>
        )}
        <fieldset disabled={isRunning} className={`contents ${isRunning ? "[&_*]:cursor-not-allowed" : ""}`}>
          <div className={isRunning ? "opacity-50 transition-opacity pt-6" : "transition-opacity"}>
          <ToggleGroup
            type="single"
            value={recursive ? "crawl" : "paste"}
            onValueChange={handleModeChange}
            variant="outline"
            spacing="default"
            className="grid w-full grid-cols-2 gap-3"
          >
            <ToggleGroupItem value="paste" className="!h-9 w-full rounded-md text-sm" title="Save a list of specific webpages">Paste links</ToggleGroupItem>
            <ToggleGroupItem value="crawl" className="!h-9 w-full rounded-md text-sm" title="Follow links on a site from one starting URL">
              <Repeat className="size-4" /> Crawl site
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="relative mt-6">
            {recursive ? (
              <Input
                placeholder="https://docs.example.com/guide/"
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                className="h-11 font-mono text-sm pr-10"
              />
            ) : (
              <Textarea
                placeholder={"Paste one URL per line\n\nhttps://example.com/article-1\nhttps://example.com/article-2"}
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                className="min-h-[140px] max-h-[220px] resize-none font-mono text-[13px] pr-10"
              />
            )}
            <div className="absolute right-2 top-2 flex gap-1">
              <IconButton tooltip="Paste from clipboard" className="size-7" onClick={paste}>
                <Clipboard className="size-3.5" />
              </IconButton>
              {(text || items.length > 0) && (
                <IconButton tooltip="Clear" className="size-7" onClick={clearAll}>
                  <X className="size-3.5" />
                </IconButton>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted)]">
            <span>
              {validUrls.length > 0 ? (
                <>
                  <span className="font-medium text-[var(--ink-2)]">{validUrls.length}</span> valid
                  {invalidCount > 0 && <span className="ml-2 text-[var(--danger)]">· {invalidCount} invalid</span>}
                </>
              ) : (
                <span>{recursive ? "One URL to start the crawl" : "One URL per line"}</span>
              )}
            </span>
            <button type="button" onClick={loadSample} className="inline-flex items-center gap-1 text-[var(--muted)] hover:text-[var(--navy)]">
              <Wand2 className="size-3" /> Try with {recursive ? "an example" : "examples"}
            </button>
          </div>

          </div>
        </fieldset>

        <div className="mt-auto pt-6 space-y-3">
          <Label className="text-sm font-medium text-[var(--ink-2)]">Save as</Label>
          <ToggleGroup
            type="single"
            value={format}
            onValueChange={(v) => v && setFormat(v)}
            variant="outline"
            spacing="default"
            disabled={isRunning}
            className="grid grid-cols-2 gap-3"
          >
            <ToggleGroupItem value="markdown" className="!h-9 w-full rounded-md px-4 text-sm"><FileText className="size-4" /> Markdown</ToggleGroupItem>
            <ToggleGroupItem value="pdf" className="!h-9 w-full rounded-md px-4 text-sm"><FileType className="size-4" /> PDF</ToggleGroupItem>
          </ToggleGroup>
          {!isRunning ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={!validUrls.length}
                  className="!h-12 w-full text-base !font-semibold"
                >
                  <Play className="size-4 fill-current" /> {ctaLabel}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="!max-w-md">
                <AlertDialogHeader>
                  <div className="flex items-center justify-between gap-3">
                    <AlertDialogTitle className="!text-lg">Ready to save</AlertDialogTitle>
                    <Badge className="bg-[var(--green-soft)] text-[var(--green-2)] font-mono">
                      .{format === "pdf" ? "PDF" : "MD"}
                    </Badge>
                  </div>
                  <AlertDialogDescription className="!text-sm">
                    {recursive
                      ? `Crawl ${domainFor(validUrls[0]) || "the starting URL"} → one merged ${formatLabel} file.`
                      : `${validUrls.length} webpage${validUrls.length === 1 ? "" : "s"} → one merged ${formatLabel} file.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="dlg-name" className="text-sm font-medium">Name</Label>
                    <Input id="dlg-name" placeholder="e.g. Compliance research Q2" value={name} onChange={(e) => setName(e.target.value)} className="h-9" autoFocus={false} />
                    <p className="text-xs text-[var(--muted)]">Optional. Defaults to today's date.</p>
                  </div>
                  {recursive && (
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="dlg-maxpages" className="text-sm font-normal">Max pages</Label>
                      <Input
                        id="dlg-maxpages"
                        type="number"
                        min="1"
                        max="1000"
                        value={maxPages}
                        onChange={(e) => setMaxPages(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="h-8 w-24 text-right font-mono"
                      />
                    </div>
                  )}
                  {format === "pdf" && (
                    <>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="dlg-images" className="text-sm font-normal">Include images</Label>
                        <Switch id="dlg-images" checked={includeImages} onCheckedChange={setIncludeImages} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-normal">Page size</Label>
                        <ToggleGroup type="single" value={pageSize} onValueChange={(v) => v && setPageSize(v)} variant="outline" size="sm">
                          <ToggleGroupItem value="A4">A4</ToggleGroupItem>
                          <ToggleGroupItem value="Letter">Letter</ToggleGroupItem>
                        </ToggleGroup>
                      </div>
                    </>
                  )}
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={start} className="!font-semibold">
                    <Play className="size-4 fill-current" /> Make {formatLabel}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="!h-12 w-full text-base !font-semibold">
                  <Square className="size-4 fill-current" /> Stop
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="!max-w-sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Stop now?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {stats.queued + stats.working > 0
                      ? `${stats.queued + stats.working} webpage${stats.queued + stats.working === 1 ? "" : "s"} won't finish. The ${stats.done} already done stay available to download.`
                      : "Finished items stay available to download."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep going</AlertDialogCancel>
                  <AlertDialogAction onClick={stop} variant="destructive" className="!font-semibold">
                    <Square className="size-4 fill-current" /> Stop now
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </Card>

      <Card className="flex flex-col p-0 min-h-[540px]">
        {showOutput ? (
          <OutputBody
            items={items}
            stats={stats}
            progress={progress}
            phase={phase}
            headerLabel={headerLabel}
            format={format}
            isRunning={isRunning}
            onRetry={retryItem}
            onDownloadOne={downloadOne}
            onDownloadMerged={downloadMerged}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-10 py-16 text-center">
            <FileText className="mb-3 size-8 text-[var(--green-2)] opacity-60" />
            <p className="max-w-[28ch] text-sm text-[var(--muted)]">
              Your file lands here once it's ready.
            </p>
          </div>
        )}
      </Card>
      </div>
    </>
  );
}

function OutputBody({ items, stats, progress, phase, headerLabel, format, isRunning, onRetry, onDownloadOne, onDownloadMerged }) {
  const canDownload = stats.done >= 1;
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
        <div>
          <div className="text-sm font-semibold text-[var(--ink)]">{headerLabel}</div>
          {phase === "errors" && (
            <div className="text-xs text-[var(--muted)]">Includes the {stats.done} that worked.</div>
          )}
          {phase === "stopped" && stats.done > 0 && (
            <div className="text-xs text-[var(--muted)]">Includes the {stats.done} saved before stop.</div>
          )}
        </div>
        {phase !== "nothing" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onDownloadMerged} disabled={!canDownload} className="h-10 px-5 font-semibold">
                <Download className="size-4" />
                {isRunning && stats.done >= 1 ? `Download partial · ${stats.done}` : "Download"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {canDownload
                ? `One merged ${format === "pdf" ? "PDF" : "Markdown"} file with ${stats.done} page${stats.done === 1 ? "" : "s"}`
                : "Nothing finished yet"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="space-y-2 border-b border-[var(--line)] px-6 py-3">
        <Progress value={progress} className="h-1.5" />
        <div className="flex flex-wrap gap-3 text-xs text-[var(--muted)]">
          {stats.queued > 0 && <span>{stats.queued} queued</span>}
          {stats.working > 0 && <span className="flex items-center gap-1"><Spinner size="xs" /> {stats.working} working</span>}
          {stats.done > 0 && <span className="text-[var(--green-2)]">{stats.done} done</span>}
          {stats.error > 0 && <span className="text-[var(--danger)]">{stats.error} failed</span>}
          {stats.cancelled > 0 && <span>{stats.cancelled} stopped</span>}
        </div>
      </div>

      <div className="min-h-0 flex-1" style={{ height: 600 }}>
        <List
          rowCount={items.length}
          rowHeight={64}
          rowComponent={VirtualItemRow}
          rowProps={{ items, format, onRetry, onDownloadOne }}
        />
      </div>
    </>
  );
}

function VirtualItemRow({ index, style, items, format, onRetry, onDownloadOne }) {
  const item = items[index];
  if (!item) return null;
  return <ItemRow style={style} item={item} format={format} onRetry={onRetry} onDownload={onDownloadOne} />;
}

const ItemRow = memo(function ItemRow({ item, format, onRetry, onDownload, style }) {
  const cancelled = isCancelled(item);
  const domain = item.domain || domainFor(item.url);
  const ext = format === "pdf" ? ".pdf" : ".md";
  const fname = item.filename || `${(item.title || "untitled").toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 40)}${ext}`;

  let badge;
  if (cancelled) badge = <Badge variant="secondary">Stopped</Badge>;
  else if (item.status === "done") badge = <Badge className="bg-[var(--green-soft)] text-[var(--green-2)]">Done</Badge>;
  else if (item.status === "error") badge = <Badge variant="destructive">Failed</Badge>;
  else if (item.status === "working") badge = <Badge variant="outline" className="gap-1"><Spinner size="xs" /> Saving</Badge>;
  else badge = <Badge variant="outline">Queued</Badge>;

  const handleRetry = useCallback(() => onRetry(item.id), [onRetry, item.id]);
  const handleDownload = useCallback(() => onDownload(item), [onDownload, item]);

  return (
    <div style={style} className="flex items-center gap-3 border-b border-[var(--line)] px-6">
      <img src={faviconFor(item.url)} alt="" className="size-5 rounded-sm" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[var(--navy)]" title={item.title}>{item.title || domain}</div>
        <div className="truncate font-mono text-[11px] text-[var(--muted)]" title={item.url}>
          {domain} · {fname}
          {item.error && !cancelled && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="ml-2 cursor-help text-[var(--danger)] underline decoration-dotted underline-offset-2">· {item.error}</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm break-words">{item.error}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      {badge}
      <div className="w-16 text-right font-mono text-[11px] text-[var(--muted)]">{fmtSize(item.size)}</div>
      <div className="flex items-center gap-1">
        {item.status === "done" && (
          <IconButton tooltip="Download this file" onClick={handleDownload}><Download className="size-4" /></IconButton>
        )}
        {item.status === "error" && !cancelled && (
          <IconButton tooltip="Retry" onClick={handleRetry}><RotateCcw className="size-4" /></IconButton>
        )}
        {(item.status === "queued" || item.status === "working") && (
          <span className="grid size-9 place-items-center text-[var(--muted)]">
            <Spinner />
          </span>
        )}
      </div>
    </div>
  );
});

function Library({ collections, onDelete, onRename, onGoNew }) {
  const [query, setQuery] = useState("");
  const filtered = collections.filter((c) => !query || (c.name || "").toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--navy)]">Library</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <Input
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-60 pl-8"
            />
          </div>
          <Button onClick={onGoNew} className="h-10 px-4 font-semibold">
            <Plus className="size-4" /> Save webpages
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-16 text-center">
          <div className="text-base font-semibold text-[var(--ink)]">{query ? "No matches" : "Nothing saved yet"}</div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {query ? "Try a different term." : "Save your first webpage from the Save tab."}
          </p>
          {!query && (
            <Button onClick={onGoNew} className="mt-5 h-10 px-5 font-semibold">
              <Plus className="size-4" /> Save webpages
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CollectionCard key={c.id} collection={c} onDelete={onDelete} onRename={onRename} />
          ))}
        </div>
      )}
    </>
  );
}

function CollectionCard({ collection, onDelete, onRename }) {
  const isPdf = collection.format === "pdf";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(collection.name || "");

  useEffect(() => {
    if (!editing) setDraft(collection.name || "");
  }, [collection.name, editing]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== collection.name) onRename?.(collection.id, trimmed);
    setEditing(false);
  }

  return (
    <Card className="flex flex-col gap-3 p-5 transition-colors hover:border-[var(--ink-2)] hover:bg-[var(--canvas-2)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") { setDraft(collection.name || ""); setEditing(false); }
              }}
              className="h-8 text-base font-bold text-[var(--navy)]"
            />
          ) : (
            <h3
              className="truncate text-base font-bold text-[var(--navy)] cursor-text hover:bg-[var(--secondary)] -mx-1 px-1 rounded"
              title="Click to rename"
              onClick={() => { setDraft(collection.name || ""); setEditing(true); }}
            >
              {collection.name || "Untitled"}
            </h3>
          )}
          <div className="mt-1 text-xs text-[var(--muted)]">
            {collection.done} file{collection.done !== 1 ? "s" : ""}
            {collection.errors > 0 && <span className="text-[var(--danger)]"> · {collection.errors} failed</span>}
            <span className="mx-1.5 opacity-50">·</span>
            {fmtTimeAgo(collection.createdAt)}
          </div>
        </div>
        <Badge variant={isPdf ? "default" : "secondary"} className="shrink-0">
          {isPdf ? "PDF" : "MD"}
        </Badge>
      </div>

      <div className="mt-auto flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild className="h-10 flex-1 font-semibold">
              <a href={`/api/jobs/${collection.id}/merged`}>
                <Download className="size-4" /> Download
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>One merged {collection.format === "pdf" ? "PDF" : "Markdown"} file</TooltipContent>
        </Tooltip>
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Delete">
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this document?</AlertDialogTitle>
              <AlertDialogDescription>&quot;{collection.name || "Untitled"}&quot; will be removed from the Library and disk.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(collection.id)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  );
}
