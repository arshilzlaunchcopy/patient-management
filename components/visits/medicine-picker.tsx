"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addMedicineAction, searchMedicinesAction, type MedicineHit } from "@/lib/medicines/actions";
import { SEARCH_LIMIT } from "@/lib/medicines/constants";
import { buttonSecondaryClass, inputClass, labelClass } from "@/components/ui/styles";
import { Spinner } from "@/components/ui/spinner";

const DEBOUNCE_MS = 250;

/**
 * Suggestions for the three dose fields. They are plain text inputs with a
 * datalist, so anything can be typed: insulin units, puffs, drops, weekly
 * tablets, "SOS". The suggestions just save typing for the common cases.
 */
const DOSES = [
  "1+0+1",
  "1+1+1",
  "1+0+0",
  "0+0+1",
  "0+1+0",
  "1+1+0",
  "0+1+1",
  "1+1+1+1",
  "½+0+½",
  "½+½+½",
  "½+0+0",
  "0+0+½",
  "1+½+1",
  "2+0+2",
  "2+2+2",
  "1 tab once weekly",
  "10 units",
  "12+0+8 units",
  "0+0+10 units",
  "14+0+10 units",
  "5 ml",
  "5 ml+5 ml+5 ml",
  "2.5 ml+2.5 ml+2.5 ml",
  "1 puff twice daily",
  "2 puffs twice daily",
  "1 drop each eye 3 times daily",
  "apply thinly twice daily",
  "1 sachet daily",
  "SOS",
];

const TIMINGS = [
  "after meal",
  "before meal",
  "with meal",
  "30 min before meal",
  "empty stomach",
  "after breakfast",
  "after dinner",
  "at bedtime",
  "morning",
  "when needed",
  "same day each week",
];

const DURATIONS = [
  "5 days",
  "7 days",
  "10 days",
  "15 days",
  "1 month",
  "2 months",
  "3 months",
  "6 months",
  "until next visit",
  "continue",
];

/** "Tablet (Extended Release)" → "Tab." and so on; unknown forms keep their name. */
export function formAbbreviation(form: string | null): string {
  const f = (form ?? "").toLowerCase();
  if (!f) return "";
  if (f.startsWith("tablet")) return "Tab.";
  if (f.startsWith("capsule")) return "Cap.";
  if (f.startsWith("syrup")) return "Syr.";
  if (f.includes("suspension")) return "Susp.";
  if (f.includes("oral solution")) return "Sol.";
  if (f.includes("drops")) return "Drops";
  if (f.includes("insulin") || f.includes("pen") || f.includes("cartridge")) return "Inj.";
  if (f.includes("injection") || f.includes("infusion") || f.startsWith("iv") || f.startsWith("im") || f.startsWith("sc")) return "Inj.";
  if (f.startsWith("ophthalmic")) return "Eye";
  if (f.startsWith("ointment")) return "Oint.";
  if (f.startsWith("cream")) return "Cream";
  if (f.includes("gel")) return "Gel";
  if (f.includes("inhaler")) return "Inhaler";
  if (f.includes("sachet") || f.includes("powder")) return "Sachet";
  if (f.includes("suppository")) return "Supp.";
  return form ?? "";
}

/** One prescription line, e.g. "Tab. Comet 500 mg (Metformin) — 1+0+1 after meal — 1 month". */
export function prescriptionLine(
  m: MedicineHit,
  dose: string,
  timing: string,
  duration: string,
): string {
  const head = [formAbbreviation(m.dosage_form), m.brand_name, m.strength].filter(Boolean).join(" ");
  const generic = m.generic ? ` (${m.generic})` : "";
  const how = [dose.trim(), timing.trim()].filter(Boolean).join(" ");
  return [head + generic, how, duration.trim()].filter(Boolean).join(" — ");
}

/**
 * A text field with a dropdown of suggestions. Not a native <datalist>:
 * Electron-based browsers and many Android browsers never show those. The
 * list opens on focus or the ▾ button, narrows as you type, and anything
 * typed that is not in the list is kept as typed.
 */
function SuggestInput({
  id,
  label,
  value,
  onChange,
  options,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // Narrow the list only while typing; opening it to browse shows everything.
  const [filtering, setFiltering] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const q = value.trim().toLowerCase();
  const shown = filtering && q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  const list = shown.length ? shown : options;

  return (
    <div ref={wrap} className={`relative ${className ?? ""}`}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          autoComplete="off"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setFiltering(true);
            setOpen(true);
          }}
          onFocus={() => {
            setFiltering(false);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter") {
              e.preventDefault();
              if (open && list[0] && q) onChange(list[0]);
              setOpen(false);
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          className={`${inputClass} pr-10`}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Show ${label.toLowerCase()} suggestions`}
          onClick={() => {
            setFiltering(false);
            setOpen((v) => !v);
          }}
          className="absolute inset-y-0 right-0 mt-1.5 flex w-10 items-center justify-center text-neutral-500 hover:text-neutral-800"
        >
          ▾
        </button>
      </div>
      {open ? (
        <ul
          id={`${id}-options`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full min-w-44 overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {list.map((o) => (
            <li key={o}>
              <button
                type="button"
                role="option"
                aria-selected={o === value}
                onClick={() => {
                  onChange(o);
                  setFiltering(false);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-base hover:bg-accent-soft/60 ${
                  o === value ? "bg-accent-soft font-medium text-accent-strong" : "text-neutral-800"
                }`}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Search box over the medicines index. Type a brand, generic, company or
 * indication, set how it is taken, tap a result and a line is appended to
 * the prescription. Nothing is saved until the visit itself is saved.
 */
export function MedicinePicker({ onPick }: { onPick: (line: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MedicineHit[]>([]);
  const [searching, startSearch] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dose, setDose] = useState(DOSES[0]);
  const [timing, setTiming] = useState(TIMINGS[0]);
  const [duration, setDuration] = useState("1 month");
  const [adding, setAdding] = useState(false);
  const [saving, startSave] = useTransition();
  const [draft, setDraft] = useState({ brand_name: "", generic: "", strength: "", dosage_form: "Tablet", manufacturer: "" });
  const lastQuery = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = query.trim();
    if (term === lastQuery.current) return;
    const handle = setTimeout(() => {
      lastQuery.current = term;
      setError(null);
      if (term.length < 2) {
        setResults([]);
        return;
      }
      startSearch(async () => {
        try {
          const rows = await searchMedicinesAction(term);
          if (lastQuery.current === term) setResults(rows);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Search failed.");
        }
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  function pick(m: MedicineHit) {
    onPick(prescriptionLine(m, dose, timing, duration));
    setQuery("");
    setResults([]);
    setAdding(false);
    inputRef.current?.focus();
  }

  function saveNew() {
    startSave(async () => {
      const r = await addMedicineAction(draft);
      if (r.error || !r.medicine) {
        setError(r.error ?? "Could not save.");
        return;
      }
      pick(r.medicine);
      setDraft({ brand_name: "", generic: "", strength: "", dosage_form: "Tablet", manufacturer: "" });
    });
  }

  const term = query.trim();
  const showNoResults = term.length >= 2 && !searching && results.length === 0 && !error;

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <div>
        <label htmlFor="medicine-search" className={labelClass}>
          Add medicine
        </label>
        <div className="relative">
          <input
            ref={inputRef}
            id="medicine-search"
            type="search"
            autoComplete="off"
            placeholder="Brand, generic, company, or what it treats: Comet, metformin, Square, type 2 DM"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (results[0]) pick(results[0]);
              }
            }}
            className={inputClass}
          />
          {searching ? (
            <span className="pointer-events-none absolute inset-y-0 right-3 mt-1.5 flex items-center text-neutral-500">
              <Spinner />
            </span>
          ) : null}
        </div>
      </div>

      {/* How it is taken. Typed freely; the lists are only suggestions. */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SuggestInput id="medicine-dose" label="Dose" value={dose} onChange={setDose} options={DOSES} />
        <SuggestInput id="medicine-timing" label="When" value={timing} onChange={setTiming} options={TIMINGS} />
        <SuggestInput
          id="medicine-duration"
          label="For"
          value={duration}
          onChange={setDuration}
          options={DURATIONS}
          className="col-span-2 sm:col-span-1"
        />
      </div>
      <p className="mt-1.5 text-sm text-neutral-500">
        Type anything in these three: 12+0+8 units, 1 puff twice daily, SOS… Tap a result below to
        add the line.
      </p>

      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="mt-3 max-h-72 divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200 bg-white">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => pick(m)}
                className="flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2.5 text-left transition-colors hover:bg-accent-soft/40 focus:bg-accent-soft/40 focus:outline-none"
              >
                <span className="min-w-0">
                  <span className="text-base font-medium text-neutral-900">
                    {m.brand_name}
                    {m.strength ? <span className="ml-1.5 font-normal text-neutral-700">{m.strength}</span> : null}
                  </span>
                  <span className="block text-sm text-neutral-600">
                    {[m.dosage_form, m.generic].filter(Boolean).join(" · ")}
                    {m.drug_class ? (
                      <span className="ml-1.5 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
                        {m.drug_class}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-neutral-500">
                  {m.manufacturer}
                  {m.source === "doctor" ? <span className="ml-1.5 text-xs text-accent-strong">added by you</span> : null}
                </span>
              </button>
            </li>
          ))}
          {results.length === SEARCH_LIMIT ? (
            <li className="px-3 py-2 text-sm text-neutral-500">
              Showing the first {SEARCH_LIMIT}. Type more to narrow it down.
            </li>
          ) : null}
        </ul>
      ) : null}

      {showNoResults ? (
        <div className="mt-3 text-sm text-neutral-600">
          Nothing matches “{term}”.{" "}
          {!adding ? (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setDraft((d) => ({ ...d, brand_name: term }));
              }}
              className="font-medium text-accent-strong hover:underline"
            >
              Add it as a new brand
            </button>
          ) : null}
        </div>
      ) : null}

      {adding ? (
        <div className="mt-3 grid gap-3 rounded-md border border-neutral-200 bg-white p-3 sm:grid-cols-2 md:grid-cols-5">
          {(
            [
              ["brand_name", "Brand", "Comet"],
              ["strength", "Strength", "500 mg"],
              ["dosage_form", "Form", "Tablet"],
              ["generic", "Generic", "Metformin Hydrochloride"],
              ["manufacturer", "Company", "Square"],
            ] as const
          ).map(([key, label, placeholder]) => (
            <div key={key}>
              <label htmlFor={`new-${key}`} className={labelClass}>
                {label}
              </label>
              <input
                id={`new-${key}`}
                type="text"
                value={draft[key]}
                placeholder={placeholder}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                className={inputClass}
              />
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-3 sm:col-span-2 md:col-span-5">
            <button
              type="button"
              onClick={saveNew}
              disabled={saving || !draft.brand_name.trim()}
              className={buttonSecondaryClass}
            >
              {saving ? "Saving…" : "Save and add to prescription"}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-sm text-neutral-600 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
