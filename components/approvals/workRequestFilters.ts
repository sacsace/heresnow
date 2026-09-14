export type WorkRequestTypeFilter = "all" | "OVERTIME" | "EARLY_LEAVE";

export type WorkRequestListFilters = {
  search: string;
  typeFilter: WorkRequestTypeFilter;
  dateFrom: string;
  dateTo: string;
};

function formatYmd(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Local calendar month bounds (YYYY-MM-DD) */
export function currentMonthDateRange(reference = new Date()): { from: string; to: string } {
  const from = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const to = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  return { from: formatYmd(from), to: formatYmd(to) };
}

export const defaultWorkRequestListFilters = (): WorkRequestListFilters => {
  const { from, to } = currentMonthDateRange();
  return {
    search: "",
    typeFilter: "all",
    dateFrom: from,
    dateTo: to,
  };
};

/** YYYY-MM-DD for filter comparison */
export function toCalendarDay(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function matchesWorkRequestFilters(params: {
  filterDate: string;
  requestType: "EARLY_LEAVE" | "OVERTIME";
  searchText: string;
  filters: WorkRequestListFilters;
}): boolean {
  const { filterDate, requestType, searchText, filters } = params;
  const q = filters.search.trim().toLowerCase();

  if (filters.typeFilter !== "all" && requestType !== filters.typeFilter) return false;
  if (filters.dateFrom && filterDate < filters.dateFrom) return false;
  if (filters.dateTo && filterDate > filters.dateTo) return false;
  if (q && !searchText.includes(q)) return false;
  return true;
}

export function hasWorkRequestListFilters(filters: WorkRequestListFilters): boolean {
  const defaults = defaultWorkRequestListFilters();
  return (
    filters.search.trim().length > 0 ||
    filters.typeFilter !== "all" ||
    filters.dateFrom !== defaults.dateFrom ||
    filters.dateTo !== defaults.dateTo
  );
}
