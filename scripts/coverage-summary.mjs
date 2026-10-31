// Print the unit-test coverage totals as a Markdown table (for the GitHub Actions run summary).
import { readFile } from 'node:fs/promises';

const { total } = JSON.parse(
  await readFile(new URL('../coverage/coverage-summary.json', import.meta.url), 'utf8'),
);
const rows = ['statements', 'branches', 'functions', 'lines'].map(
  (k) =>
    `| ${k[0].toUpperCase() + k.slice(1)} | ${total[k].pct}% | ${total[k].covered} / ${total[k].total} |`,
);
console.log(
  ['### Coverage of `packages/core`', '', '| Metric | Covered | |', '| --- | --- | --- |', ...rows].join(
    '\n',
  ),
);
