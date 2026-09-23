/**
 * Archive: past puzzle numbers per mode, linked as practice rounds (never today's puzzle, never an
 * answer). Computed client-side so "today" always matches the visitor's clock.
 */
import { useEffect, useState } from 'preact/hooks';
import { site } from '../site.config';
import { puzzleNumber, utcDateString } from '../lib/geo';
import { withBase } from '../lib/url';

const DAYS = 60;

interface Row {
  date: string;
  puzzle: number;
}

export default function Archive() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    const today = new Date();
    const out: Row[] = [];
    for (let i = 1; i <= DAYS; i++) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
      const date = utcDateString(d);
      const puzzle = puzzleNumber(date, site.epoch);
      if (puzzle >= 1) out.push({ date, puzzle });
    }
    setRows(out);
  }, []);

  if (rows === null) {
    return <p class="muted small">Loading archive…</p>;
  }
  if (rows.length === 0) {
    return (
      <p class="muted">
        The archive fills in once puzzles have run — daily puzzle #1 is {site.epoch}. Check back after launch, or{' '}
        <a href={withBase('/outline/')}>play today's puzzle</a> in the meantime.
      </p>
    );
  }

  return (
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Puzzle #</th>
            <th scope="col">Outline</th>
            <th scope="col">Capitals</th>
            <th scope="col">Bigger</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.date}>
              <td>{r.date}</td>
              <td>#{r.puzzle}</td>
              <td>
                <a href={`${withBase('/outline/')}?date=${r.date}`}>Play</a>
              </td>
              <td>
                <a href={`${withBase('/capitals/')}?date=${r.date}`}>Play</a>
              </td>
              <td>
                <a href={`${withBase('/bigger/')}?date=${r.date}`}>Play</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
