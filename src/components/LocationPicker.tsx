import { useDeferredValue, useEffect, useRef, useState } from "react";
import { PiMapPinFill, PiMagnifyingGlass } from "react-icons/pi";
import { searchLocations } from "../lib/geoapify";
import type { SelectedLocation } from "../lib/types";

type LocationPickerProps = {
  apiKey: string;
  placeholder: string;
  value: SelectedLocation | null;
  onSelect: (location: SelectedLocation) => void;
  onUseCurrent?: () => Promise<void> | void;
  onClear?: () => void;
  busy?: boolean;
  emptyLabel?: string;
};

export function LocationPicker({
  apiKey,
  placeholder,
  value,
  onSelect,
  onUseCurrent,
  onClear,
  busy = false,
  emptyLabel = "No place picked"
}: LocationPickerProps) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<SelectedLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const deferredQuery = useDeferredValue(query.trim());
  const skipSearchQueryRef = useRef<string | null>(null);

  useEffect(() => {
    const nextQuery = value?.label ?? "";
    setQuery((currentQuery) => (currentQuery === nextQuery ? currentQuery : nextQuery));

    if (!value) {
      skipSearchQueryRef.current = null;
    }
  }, [value?.label]);

  useEffect(() => {
    if (!apiKey) {
      setResults([]);
      setLoading(false);
      setLoadError(null);
      return;
    }

    if (skipSearchQueryRef.current === deferredQuery) {
      setResults([]);
      setLoading(false);
      setLoadError(null);
      return;
    }

    if (deferredQuery.length < 3) {
      setResults([]);
      setLoading(false);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    searchLocations({
      apiKey,
      query: deferredQuery,
      language: navigator.language
    })
      .then((nextResults) => {
        if (!cancelled) {
          setResults(nextResults);
          setLoadError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setResults([]);
          setLoadError(
            error instanceof Error ? error.message : "Could not search for that place."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, deferredQuery]);

  function handleSelect(location: SelectedLocation) {
    skipSearchQueryRef.current = location.label;
    setQuery(location.label);
    setResults([]);
    setLoadError(null);
    setFocused(false);
    onSelect(location);
  }

  function handleQueryChange(nextQuery: string) {
    if (skipSearchQueryRef.current && nextQuery !== skipSearchQueryRef.current) {
      skipSearchQueryRef.current = null;
    }

    setQuery(nextQuery);
  }

  function handleClear() {
    skipSearchQueryRef.current = null;
    setQuery("");
    setResults([]);
    setLoadError(null);
    setFocused(false);
    onClear?.();
  }

  const showSuggestions = focused && query.trim().length >= 3;

  if (!apiKey) {
    return (
      <div className="location-picker">
        <div className="location-picker location-picker--empty">
          <p className="muted">
            Add `GEOAPIFY_API_KEY` to search places, or use your live location instead.
          </p>
        </div>
        <div className="location-picker__actions">
          {onUseCurrent ? (
            <button className="soft-button soft-button--small" onClick={() => void onUseCurrent()} type="button">
              <PiMapPinFill />
              {busy ? "Locating..." : "Use my location"}
            </button>
          ) : null}
          {value && onClear ? (
            <button className="ghost-button ghost-button--small" onClick={handleClear} type="button">
              Clear
            </button>
          ) : null}
        </div>
        <div className={`location-pill ${value ? "" : "location-pill--empty"}`}>
          <PiMapPinFill />
          <span>{value?.label ?? emptyLabel}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="location-picker">
      <div className="location-picker__search">
        <PiMagnifyingGlass />
        <input
          aria-label="Search for a place"
          autoComplete="off"
          onBlur={() => {
            window.setTimeout(() => setFocused(false), 120);
          }}
          onChange={(event) => handleQueryChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setFocused(false);
              setResults([]);
              return;
            }

            if (event.key === "Enter" && results[0]) {
              event.preventDefault();
              handleSelect(results[0]);
            }
          }}
          placeholder={placeholder}
          spellCheck={false}
          type="text"
          value={query}
        />
      </div>

      <p className="composer-note composer-note--tight">
        Search by address, neighborhood, district, or city.
      </p>

      {showSuggestions ? (
        <div className="location-picker__suggestions">
          {loading ? <p className="muted">Searching places...</p> : null}
          {!loading && loadError ? <p className="muted">{loadError}</p> : null}
          {!loading && !loadError && results.length === 0 ? (
            <p className="muted">No matching places yet. Try a fuller address or area name.</p>
          ) : null}
          {!loading && !loadError
            ? results.map((result) => (
                <button
                  className="location-picker__suggestion"
                  key={`${result.label}:${result.latitude}:${result.longitude}`}
                  onClick={() => handleSelect(result)}
                  onMouseDown={(event) => event.preventDefault()}
                  type="button"
                >
                  <PiMapPinFill />
                  <span>{result.label}</span>
                </button>
              ))
            : null}
        </div>
      ) : null}

      {query.trim().length > 0 && query.trim().length < 3 ? (
        <p className="muted">Type at least 3 letters to search.</p>
      ) : null}

      <div className="location-picker__actions">
        {onUseCurrent ? (
          <button className="soft-button soft-button--small" onClick={() => void onUseCurrent()} type="button">
            <PiMapPinFill />
            {busy ? "Locating..." : "Use my location"}
          </button>
        ) : null}
        {value && onClear ? (
          <button className="ghost-button ghost-button--small" onClick={handleClear} type="button">
            Clear
          </button>
        ) : null}
      </div>

      <div className={`location-pill ${value ? "" : "location-pill--empty"}`}>
        <PiMapPinFill />
        <span>{value?.label ?? emptyLabel}</span>
      </div>
    </div>
  );
}
