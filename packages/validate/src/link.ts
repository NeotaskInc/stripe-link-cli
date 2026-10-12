import { execFile } from 'node:child_process';

// Runs a Link CLI command and returns its JSON output, or undefined when the
// CLI is unavailable, logged out, or fails. Output can contain personal data,
// so it is never logged.
export type LinkCli = (args: string[]) => Promise<unknown>;

function exec(command: string, args: string[]) {
  return new Promise<{ code?: string; stdout?: string }>((resolve) => {
    execFile(
      command,
      args,
      { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout) =>
        resolve(
          error
            ? { code: (error as NodeJS.ErrnoException).code?.toString() }
            : { stdout },
        ),
    );
  });
}

export const linkCli: LinkCli = async (args) => {
  const argv = [...args, '--format', 'json'];
  let result = await exec('link-cli', argv);
  if (result.code === 'ENOENT') {
    result = await exec('npx', ['-y', '@stripe/link-cli', ...argv]);
  }
  try {
    return result.stdout === undefined ? undefined : JSON.parse(result.stdout);
  } catch {
    return undefined;
  }
};

export type Address = Partial<Record<(typeof addressFields)[number], string>>;
const addressFields = [
  'line_1',
  'line_2',
  'locality',
  'administrative_area',
  'postal_code',
  'country_code',
] as const;

type ShippingRecord = { is_default?: boolean; address?: Address | null };

export async function defaultShippingAddress(
  cli: LinkCli,
): Promise<{ address: Address } | { skipped: string }> {
  const records = await cli(['shipping-address', 'list']);
  if (!Array.isArray(records)) {
    return { skipped: 'Could not read Link shipping addresses with link-cli.' };
  }
  const usable = (records as ShippingRecord[]).filter((r) => r.address);
  const defaults = usable.filter((r) => r.is_default);
  const chosen =
    defaults.length === 1
      ? defaults[0]
      : usable.length === 1
        ? usable[0]
        : undefined;
  return chosen?.address
    ? { address: chosen.address }
    : { skipped: 'The Link account has no single default shipping address.' };
}

const normalize = (value: unknown) =>
  typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').toLowerCase()
    : '';

export function sameAddress(expected: Address, actual: Address) {
  return addressFields.every(
    (field) => normalize(expected[field]) === normalize(actual[field]),
  );
}

type SpendRequest = {
  network_id?: string;
  amount?: number;
  created_at?: string;
  status?: string;
};

// Finds the newest spend request the cancel scenario should have created.
// `available: false` means link-cli could not list spend requests at all.
export async function findSpendRequest(
  cli: LinkCli,
  match: { networkId: string; amount: number; since: number },
): Promise<{ available: false } | { available: true; request?: SpendRequest }> {
  const requests = await cli(['spend-request', 'list', '--include-history']);
  if (!Array.isArray(requests)) return { available: false };
  const request = (requests as SpendRequest[])
    .filter(
      (r) =>
        r.network_id === match.networkId &&
        r.amount === match.amount &&
        Date.parse(r.created_at ?? '') >= match.since,
    )
    .sort(
      (a, b) => Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? ''),
    )[0];
  return { available: true, request };
}
