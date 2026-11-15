"use client";

import { Search } from "lucide-react";

type FilterOption = string | { value: string; label: string };
type Filter = { label: string; value: string; onChange: (value: string) => void; options: FilterOption[] };
const input = "min-h-11 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100";

export function matchesRecordSearch(values: unknown[], query: string) {
  const text = values.filter(value => value != null).join(" ").toLocaleLowerCase();
  return query.trim().toLocaleLowerCase().split(/\s+/).every(word => text.includes(word));
}

export function RecordFilters({ search, onSearch, placeholder, count, total, filters = [], onReset, responsiveGrid = false }: {
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  count: number;
  total: number;
  filters?: Filter[];
  onReset: () => void;
  responsiveGrid?: boolean;
}) {
  return (
    <section aria-label="Search and filters" className="print:hidden overflow-visible rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
      <div className={responsiveGrid ? "grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-8" : "flex flex-col items-stretch gap-3 md:flex-row md:items-end"}>
        <label className={responsiveGrid ? "min-w-0 text-xs font-semibold text-zinc-600 xl:col-span-2" : "min-w-0 flex-1 text-xs font-semibold text-zinc-600"}>
          Search
          <div className="relative mt-2">
            <Search size={17} className="pointer-events-none absolute left-3 top-3 text-zinc-400" />
            <input type="search" value={search} onChange={event => onSearch(event.target.value)} placeholder={placeholder} className={input + " pl-10"} />
          </div>
        </label>
        {filters.map(filter => (
          <label key={filter.label} className={responsiveGrid ? "min-w-0 text-xs font-semibold text-zinc-600" : "text-xs font-semibold text-zinc-600 md:w-44"}>
            {filter.label}
            <select value={filter.value} onChange={event => filter.onChange(event.target.value)} className={input + " mt-2"}>
              <option value="">All {filter.label.toLowerCase() === "status" ? "statuses" : filter.label.toLowerCase() === "class" ? "classes" : filter.label.toLowerCase() + "s"}</option>
              {filter.options.map(option => typeof option === "string"
                ? <option key={option} value={option}>{option}</option>
                : <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        ))}
        <button type="button" onClick={onReset} className={`min-h-11 rounded-md border px-4 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 ${responsiveGrid ? "w-full" : ""}`}>Clear filters</button>
      </div>
      <p role="status" className="mt-3 text-xs text-zinc-500">Showing {count} of {total} loaded records{count === 0 ? " · No matches. Try changing your search or filters." : ""}</p>
    </section>
  );
}
