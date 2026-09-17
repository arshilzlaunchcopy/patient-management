"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { searchPatientsAction, type PickerPatient } from "@/lib/messages/actions";
import { PICKER_LIMIT } from "@/lib/messages/constants";
import { displayBD } from "@/lib/phone";
import { ComposeForm, type SavedText } from "./compose-form";
import { cardClass, inputClass, labelClass } from "@/components/ui/styles";

const DEBOUNCE_MS = 300;

const smallButton =
  "rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-sm font-medium text-neutral-800 hover:bg-neutral-50";

/**
 * "Choose patients myself": a search box, tick anyone, send to the ticked
 * list. The selection lives here in the browser and travels to the server
 * only when Send is pressed, as a list of ids the server looks up again.
 */
export function CustomAudience({
  picker,
  pricePerSegment,
  templates,
  initialBody,
  fills,
}: {
  /** The audience dropdown, rendered by the page so it can stay a shared component. */
  picker: React.ReactNode;
  pricePerSegment: number;
  templates: SavedText[];
  initialBody?: string;
  fills?: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerPatient[]>([]);
  const [selected, setSelected] = useState<PickerPatient[]>([]);
  const [searching, startSearch] = useTransition();
  const lastQuery = useRef("");

  useEffect(() => {
    const term = query.trim();
    if (term === lastQuery.current) return;
    const handle = setTimeout(() => {
      lastQuery.current = term;
      if (!term) {
        setResults([]);
        return;
      }
      startSearch(async () => {
        const rows = await searchPatientsAction(term);
        // Ignore a slow reply for a query the doctor has already moved past.
        if (lastQuery.current === term) setResults(rows);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const selectedIds = new Set(selected.map((p) => p.id));

  function add(p: PickerPatient) {
    setSelected((s) => (s.some((x) => x.id === p.id) ? s : [...s, p]));
  }
  function remove(id: string) {
    setSelected((s) => s.filter((x) => x.id !== id));
  }
  function addAllResults() {
    setSelected((s) => {
      const have = new Set(s.map((x) => x.id));
      return [...s, ...results.filter((r) => !have.has(r.id))];
    });
  }

  const unselectedResults = results.filter((r) => !selectedIds.has(r.id));
  const audienceLabel = `Chosen patients (${selected.length})`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
      <section className={`${cardClass} p-5`} aria-labelledby="audience-heading">
        <h2 id="audience-heading" className="mb-4 text-base font-semibold text-neutral-900">
          Audience
        </h2>
        {picker}

        <div className="mt-5">
          <label htmlFor="picker-search" className={labelClass}>
            Find patients to add
          </label>
          <input
            id="picker-search"
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder="Name, phone or serial"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-sm text-neutral-500" aria-live="polite">
            {searching
              ? "Searching…"
              : query.trim() && results.length === 0
                ? "No active patient matches."
                : results.length === PICKER_LIMIT
                  ? `Showing the first ${PICKER_LIMIT} matches. Type more to narrow it down.`
                  : "Tick a patient to add them to the list."}
          </p>
        </div>

        {unselectedResults.length > 0 ? (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Matches
              </span>
              {unselectedResults.length > 1 ? (
                <button type="button" onClick={addAllResults} className={smallButton}>
                  Add all {unselectedResults.length}
                </button>
              ) : null}
            </div>
            <ul className="max-h-72 divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200">
              {unselectedResults.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-neutral-50">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => add(p)}
                      className="h-5 w-5 shrink-0 accent-accent"
                      aria-label={`Add ${p.name}`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-base font-medium text-neutral-900">
                        {p.name}
                      </span>
                      <span className="block text-sm text-neutral-600">
                        <span className="tabular-nums">{displayBD(p.phone)}</span>
                        {p.serial_no ? <span className="ml-2 text-neutral-400">{p.serial_no}</span> : null}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Selected
              <span className="ml-2 font-normal normal-case tracking-normal">{selected.length}</span>
            </h3>
            {selected.length > 0 ? (
              <button type="button" onClick={() => setSelected([])} className={smallButton}>
                Clear all
              </button>
            ) : null}
          </div>
          {selected.length === 0 ? (
            <p className="text-base text-neutral-500">Nobody selected yet.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-neutral-100 overflow-y-auto">
              {selected.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    checked
                    onChange={() => remove(p.id)}
                    className="h-5 w-5 shrink-0 accent-accent"
                    aria-label={`Remove ${p.name}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-neutral-900">
                      {p.name}
                    </span>
                    <span className="block text-sm text-neutral-600">
                      <span className="tabular-nums">{displayBD(p.phone)}</span>
                      {p.serial_no ? <span className="ml-2 text-neutral-400">{p.serial_no}</span> : null}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className={`${cardClass} p-5`} aria-labelledby="compose-heading">
        <h2 id="compose-heading" className="mb-4 text-base font-semibold text-neutral-900">
          Message to {selected.length === 0 ? "your chosen patients" : audienceLabel.toLowerCase()}
        </h2>
        <ComposeForm
          hidden={{ segment: "custom", ids: selected.map((p) => p.id).join(",") }}
          recipientCount={selected.length}
          audienceLabel={audienceLabel}
          pricePerSegment={pricePerSegment}
          templates={templates}
          initialBody={initialBody}
          fills={fills}
        />
      </section>
    </div>
  );
}
