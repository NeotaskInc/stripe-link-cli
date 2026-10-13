import { parseArgs } from 'node:util';
import { type Channel, channels } from './channels/index.ts';
import { createPrinter } from './output.ts';
import { runValidation } from './run.ts';
import { createSptAdapter } from './spt.ts';
import { readStripeTestKey } from './stripe-config.ts';
import { validations } from './validations/index.ts';

const help = `Usage: pnpm validate [--channel <channels>] [--timeout <seconds>] [--port <port>] [--json]

Starts a local test seller and prints a task for each validation. Give each task
to the buyer agent in any order or concurrently. Reads Link data through link-cli.
See packages/validate/README.md.

--channel limits the run to payment channels, comma-separated (${Object.keys(channels).join(', ')}).
--timeout defaults to 1800 seconds; 0 waits indefinitely.
--json prints one JSON event per line, for scripts.
Exit codes: 0 passed, 1 setup error, 2 failed, 3 timed out, 130 interrupted.`;

async function main() {
  const { values } = parseArgs({
    options: {
      port: { type: 'string', default: '0' },
      channel: { type: 'string' },
      timeout: { type: 'string', default: '1800' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) return console.log(help);
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('--port must be an integer from 0 to 65535.');
  }
  const timeout = Number(values.timeout);
  if (!Number.isInteger(timeout) || timeout < 0) {
    throw new Error('--timeout must be a whole number of seconds.');
  }

  const selected = values.channel?.split(',').map((c) => c.trim());
  const unknown = selected?.filter((c) => !(c in channels));
  if (unknown?.length) {
    throw new Error(
      `Unknown channel ${unknown.join(', ')}. Use: ${Object.keys(channels).join(', ')}.`,
    );
  }
  const chosen = selected
    ? validations.filter((v) => selected.includes(v.channel as Channel))
    : validations;
  if (!chosen.length) throw new Error('No validations use those channels.');

  const adapter = createSptAdapter(readStripeTestKey());
  const interrupt = new AbortController();
  process.once('SIGINT', () => interrupt.abort());
  process.once('SIGTERM', () => interrupt.abort());
  process.exitCode = await runValidation({
    adapter,
    port,
    validations: chosen,
    timeoutMs: timeout * 1000,
    signal: interrupt.signal,
    write: values.json
      ? (event) => console.log(JSON.stringify(event))
      : createPrinter(),
  });
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
