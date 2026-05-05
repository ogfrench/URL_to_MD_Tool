"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { titleFor } from "@/lib/url";
import { isCancelled } from "@/lib/format";

export function useConversionJob() {
  const [items, setItems] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [jobId, setJobId] = useState(null);
  const streamRef = useRef(null);
  const reconnectAttemptedRef = useRef(false);

  useEffect(() => () => streamRef.current?.close(), []);

  const updateItem = useCallback((id, patch) => {
    setItems((cur) => cur.map((i) => {
      if (i.id !== id) return i;
      const next = { ...i };
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) next[k] = v;
      }
      return next;
    }));
  }, []);

  const stats = useMemo(() => {
    const s = { queued: 0, working: 0, done: 0, error: 0, cancelled: 0 };
    items.forEach((i) => {
      if (isCancelled(i)) s.cancelled += 1;
      else if (i.status in s) s[i.status] += 1;
    });
    return s;
  }, [items]);

  const progress = items.length
    ? Math.round(((stats.done + stats.error + stats.cancelled) / items.length) * 100)
    : 0;

  function applyEvent(msg) {
    if (msg.type === "status") {
      updateItem(msg.url_id, {
        status: msg.status,
        title: msg.title,
        size: msg.size,
        filename: msg.filename,
        error: msg.error || null,
      });
    } else if (msg.type === "item_added") {
      setItems((cur) => cur.some((x) => x.id === msg.item.id)
        ? cur
        : [...cur, { ...msg.item, title: titleFor(msg.item.url), size: null, filename: null, error: null }]);
    } else if (msg.type === "cap_reached") {
      toast.warning(`Crawl limit reached at ${msg.max_pages} pages`);
    } else if (msg.type === "done") {
      setIsRunning(false);
      streamRef.current?.close();
      streamRef.current = null;
    }
  }

  function openStream(id) {
    streamRef.current?.close();
    const es = new EventSource(`/api/jobs/${id}/stream`);
    streamRef.current = es;
    es.onopen = () => { reconnectAttemptedRef.current = false; };
    es.onmessage = (e) => applyEvent(JSON.parse(e.data));
    es.onerror = () => {
      if (es.readyState !== EventSource.CLOSED) return;
      if (!reconnectAttemptedRef.current) {
        reconnectAttemptedRef.current = true;
        toast.info("Reconnecting…");
        setTimeout(() => openStream(id), 800);
      } else {
        toast.error("Lost connection. Refresh to resume.");
        setIsRunning(false);
      }
    };
  }

  const start = useCallback(async ({ urls, format, name, options }) => {
    if (!urls.length || isRunning) return null;
    reconnectAttemptedRef.current = false;
    setIsRunning(true);
    try {
      const r = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, format, collection: name, options }),
      });
      if (!r.ok) {
        if (r.status === 503) throw new Error("Server is busy, retry shortly.");
        if (r.status >= 500) throw new Error("Something went wrong on the server.");
        throw new Error("That request looks invalid.");
      }
      const data = await r.json();
      setJobId(data.job_id);
      setItems((data.items || []).map((i) => ({
        ...i, title: titleFor(i.url), size: null, filename: null, error: null,
      })));
      openStream(data.job_id);
      return data.job_id;
    } catch (e) {
      setIsRunning(false);
      toast.error(`Couldn't save: ${e.message || "unknown error"}`);
      return null;
    }
  }, [isRunning]);

  const stop = useCallback(async () => {
    if (!jobId) return;
    streamRef.current?.close();
    streamRef.current = null;
    try { await fetch(`/api/jobs/${jobId}/cancel`, { method: "POST" }); }
    catch { toast.warning("Cancel may not have reached the server."); }
    setIsRunning(false);
    setItems((cur) => cur.map((i) =>
      (i.status === "queued" || i.status === "working")
        ? { ...i, status: "error", error: "Cancelled" }
        : i,
    ));
  }, [jobId]);

  const retryItem = useCallback(async (id) => {
    if (!jobId) return;
    updateItem(id, { status: "working", error: null });
    setIsRunning(true);
    if (!streamRef.current || streamRef.current.readyState === EventSource.CLOSED) openStream(jobId);
    try {
      const r = await fetch(`/api/jobs/${jobId}/retry/${id}`, { method: "POST" });
      if (!r.ok) throw new Error();
    } catch {
      updateItem(id, { status: "error", error: "Retry failed" });
      toast.error("Retry failed");
    }
  }, [jobId, updateItem]);

  const reset = useCallback(() => {
    streamRef.current?.close();
    streamRef.current = null;
    setItems([]);
    setIsRunning(false);
    setJobId(null);
  }, []);

  return { items, isRunning, jobId, stats, progress, start, stop, retryItem, reset };
}
