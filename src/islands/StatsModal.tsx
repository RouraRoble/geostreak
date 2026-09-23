/**
 * Global stats modal: streak + histogram per mode, hard-mode/units toggles, export/import.
 * Mount once per page (`client:load`). Any other island opens it by dispatching:
 *   window.dispatchEvent(new CustomEvent('geostreak:open-stats', { detail: { mode: 'outline' } }))
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { loadStats, saveStats, exportCode, exportJson, importCode, importJson, ImportError, MODES, type Mode, type StatsState } from '../lib/stats';

const MODE_LABEL: Record<Mode, string> = { outline: 'Outline', capitals: 'Capitals', bigger: 'Bigger or smaller' };
const MODE_UNIT: Record<Mode, string> = { outline: 'guesses', capitals: 'score', bigger: 'score' };
const MODE_MAX: Record<Mode, number> = { outline: 6, capitals: 10, bigger: 10 };

function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

export default function StatsModal() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Mode>('outline');
  const [stats, setStats] = useState<StatsState | null>(null);
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [copyMsg, setCopyMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // The element focused right before the modal opened (usually the "Stats" button that triggered
  // it) — focus returns there on close instead of falling back to <body>.
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      // A real click captures the button that was focused right before the event. An *auto*-open
      // (dispatched from a `setTimeout` after a round finishes) happens with nothing meaningful
      // focused — `document.activeElement` is `<body>` because the just-unmounted answer buttons
      // already lost focus — so treat BODY as "no trigger" and fall back on close (see below) instead
      // of trying to refocus BODY, which leaves keyboard users stranded with no visible focus at all.
      const active = document.activeElement;
      triggerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
      if (detailMode(e)) setTab(detailMode(e)!);
      setStats(loadStats());
      setOpen(true);
    };
    window.addEventListener('geostreak:open-stats', onOpen);
    return () => window.removeEventListener('geostreak:open-stats', onOpen);
  }, []);

  function detailMode(e: Event): Mode | undefined {
    return (e as CustomEvent<{ mode?: Mode }>).detail?.mode;
  }

  useEffect(() => {
    if (open) {
      dialogRef.current?.focus();
      return;
    }
    // Prefer the element that actually triggered the open; if there wasn't one (auto-open) or it's no
    // longer in the document, fall back to this page's "Stats" button so focus never gets silently
    // dropped on <body>.
    const fallback = document.querySelector<HTMLElement>('[data-stats-trigger]');
    const target = triggerRef.current && document.contains(triggerRef.current) ? triggerRef.current : fallback;
    target?.focus();
    triggerRef.current = null;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      // Trap Tab focus inside the dialog so keyboard users can't tab out into the page behind it.
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open || !stats) return null;

  function update(next: StatsState) {
    setStats(next);
    saveStats(next);
  }

  /** Confirms before an import replaces the current stats — restoring a backup wipes whatever is
   *  currently on this device/browser, so a stray click or a bad paste shouldn't silently do that. */
  function confirmReplace(current: StatsState): boolean {
    const played = MODES.reduce((n, m) => n + current.modes[m].played, 0);
    if (played === 0) return true;
    return window.confirm(`Replace your current stats (${played} game${played === 1 ? '' : 's'} played) with this backup? This can't be undone.`);
  }

  const m = stats.modes[tab];
  const winPct = pct(m.won, m.played);
  const max = MODE_MAX[tab];
  const histKeys = tab === 'outline' ? [...Array.from({ length: 6 }, (_, i) => String(i + 1)), 'x'] : Array.from({ length: max + 1 }, (_, i) => String(i));
  const histMax = Math.max(1, ...histKeys.map((k) => m.distribution[k] ?? 0));

  return (
    <div class="gs-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div class="gs-modal" role="dialog" aria-modal="true" aria-label="Your GeoStreak stats" ref={dialogRef} tabIndex={-1}>
        <button type="button" class="gs-modal__close" aria-label="Close" onClick={() => setOpen(false)}>
          ×
        </button>
        <h2 style="margin-top:0">Your stats</h2>

        <div class="mode-tabs" role="tablist" aria-label="Mode">
          {MODES.map((mo) => (
            <button key={mo} type="button" class="mode-tab" role="tab" aria-selected={tab === mo} onClick={() => setTab(mo)}>
              {MODE_LABEL[mo]}
            </button>
          ))}
        </div>

        <div class="stat-grid">
          <div>
            <div class="stat-grid__value">{m.played}</div>
            <div class="stat-grid__label">Played</div>
          </div>
          <div>
            <div class="stat-grid__value">{winPct}%</div>
            <div class="stat-grid__label">Win rate</div>
          </div>
          <div>
            <div class="stat-grid__value">{m.currentStreak}</div>
            <div class="stat-grid__label">Streak</div>
          </div>
          <div>
            <div class="stat-grid__value">{m.maxStreak}</div>
            <div class="stat-grid__label">Best streak</div>
          </div>
        </div>

        <h3 style="margin-top:var(--space-4)">{MODE_LABEL[tab]} — {MODE_UNIT[tab]} distribution</h3>
        <div>
          {histKeys.map((k) => {
            const v = m.distribution[k] ?? 0;
            return (
              <div class="hist-row" key={k}>
                <span>{k === 'x' ? '✕' : k}</span>
                <span class="hist-row__bar">
                  <span style={`width:${pct(v, histMax)}%`} />
                </span>
                <span>{v}</span>
              </div>
            );
          })}
        </div>

        <h3>Settings</h3>
        <label class="toggle">
          <input type="checkbox" checked={stats.hardMode} onChange={(e) => update({ ...stats, hardMode: (e.target as HTMLInputElement).checked })} />
          Hard mode (Outline: hide proximity % and direction, distance only)
        </label>
        <div class="field-row">
          <span class="small muted">Distance units</span>
          <div class="units-toggle" role="group" aria-label="Distance units">
            <button type="button" aria-pressed={stats.units === 'km'} onClick={() => update({ ...stats, units: 'km' })}>
              km
            </button>
            <button type="button" aria-pressed={stats.units === 'mi'} onClick={() => update({ ...stats, units: 'mi' })}>
              mi
            </button>
          </div>
        </div>

        <h3>Back up your streak</h3>
        <p class="small muted">
          Your streak lives only in this browser. Copy the code below before switching devices or clearing site data, then paste it
          back in with "Import" on the new device.
        </p>
        <div class="field-row">
          <button
            type="button"
            class="btn btn--secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(exportCode(stats));
              setCopyMsg('Code copied');
              setTimeout(() => setCopyMsg(''), 2500);
            }}
          >
            Copy backup code
          </button>
          <button
            type="button"
            class="btn btn--secondary"
            onClick={() => {
              const blob = new Blob([exportJson(stats)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'geostreak-stats.json';
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Download JSON
          </button>
          <span role="status" class="small" style="color:var(--accent)">
            {copyMsg}
          </span>
        </div>

        <label htmlFor="gs-import">Restore a backup code or paste JSON</label>
        <div class="field-row">
          <input id="gs-import" type="text" value={importText} placeholder="GS1:… or {...}" onInput={(e) => setImportText((e.target as HTMLInputElement).value)} />
          <button
            type="button"
            class="btn"
            onClick={() => {
              try {
                const restored = importText.trim().startsWith('GS1:') ? importCode(importText) : importJson(importText);
                if (!confirmReplace(stats)) return;
                update(restored);
                setImportMsg('Stats restored.');
                setImportText('');
              } catch (err) {
                setImportMsg(err instanceof ImportError ? err.message : 'Could not read that backup.');
              }
              setTimeout(() => setImportMsg(''), 4000);
            }}
          >
            Import
          </button>
        </div>
        <div class="field-row">
          <button type="button" class="btn btn--secondary" onClick={() => fileRef.current?.click()}>
            Import a .json file instead
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            aria-label="Import a stats JSON file"
            class="visually-hidden"
            onChange={async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (!file) return;
              try {
                const restored = importJson(await file.text());
                if (!confirmReplace(stats)) return;
                update(restored);
                setImportMsg('Stats restored.');
              } catch (err) {
                setImportMsg(err instanceof ImportError ? err.message : 'Could not read that file.');
              }
              setTimeout(() => setImportMsg(''), 4000);
            }}
          />
        </div>
        {importMsg && <p role="status" class="small" style="color:var(--accent)">{importMsg}</p>}
      </div>
    </div>
  );
}
