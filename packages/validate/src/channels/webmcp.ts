import type { ChannelContext } from '../seller.ts';
import { productLine, purchase, readJson } from './api.ts';

// WebMCP: the store page registers a page-provided "purchase" tool via
// document.modelContext.registerTool(). Browser automation discovers and
// invokes the tool directly (no visible UI interaction); the tool's
// execute() posts to this seller's purchase route on the agent's behalf.
export async function webmcp(context: ChannelContext) {
  const { request, page, base, run, adapter, report, send, fail } = context;
  const { observed, validation } = run;

  if (request.method === 'GET' && page === '/') {
    observed.api_viewed = true;
    report({ step: 'api_viewed' });
    const { network_id, currency, test_mode } = adapter.documentation;
    const description = `Buy ${validation.product.name} from this store using a test shared payment token.`;
    const purchaseUrl = `${base}/purchase`;
    send(
      200,
      'text/html; charset=utf-8',
      `<!doctype html><html lang="en"><meta charset="utf-8"><title>Trail Depot</title><h1>Trail Depot</h1>` +
        `<p>${productLine(context)}</p>` +
        `<p>network_id: ${network_id}, currency: ${currency}, test_mode: ${test_mode}</p>` +
        `<script>
document.modelContext?.registerTool({
  name: 'purchase',
  description: ${JSON.stringify(description)},
  inputSchema: {
    type: 'object',
    properties: {
      spt: {
        type: 'string',
        description: 'Test shared payment token for this seller and price',
      },
    },
    required: ['spt'],
  },
  annotations: { consequentialHint: true },
  execute: async ({ spt }) => {
    const response = await fetch(${JSON.stringify(purchaseUrl)}, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WebMCP-Tool': 'purchase',
      },
      body: JSON.stringify({ spt }),
    });
    return response.json();
  },
});
</script></html>`,
    );
    return;
  }

  if (request.method === 'POST' && page === '/purchase') {
    if (request.headers['x-webmcp-tool'] !== 'purchase') {
      fail(400, "Use the page's WebMCP purchase tool to buy this product.");
      return;
    }
    const body = await readJson(context);
    if (body === undefined) return;
    await purchase(context, body);
    return;
  }

  context.reply(404, { error: 'Not found' });
}
