import type { ChannelContext } from '../seller.ts';
import { checkoutPage, purchase } from './browser.ts';

// Expose the card checkout form as a declarative WebMCP tool. Chrome derives
// its input schema from the form fields and fills them before submitting.
export async function webmcp(context: ChannelContext) {
  const { request, page, run, report, send, fail, reply } = context;
  if (request.method === 'GET' && page === '/') {
    run.observed.api_viewed = true;
    report({ step: 'api_viewed' });
    send(
      200,
      'text/html; charset=utf-8',
      checkoutPage(
        context,
        `<script>
const form = document.querySelector('form');
form.setAttribute('toolname', 'purchase');
form.setAttribute('tooldescription', 'Place an order using card details and a shipping address.');
form.setAttribute('toolautosubmit', '');
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!event.agentInvoked) return;
  event.respondWith((async () => {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { 'X-WebMCP-Tool': 'purchase' },
      body: new URLSearchParams(new FormData(form)),
    });
    if (!response.ok) return response.json();
    form.hidden = true;
    const result = document.createElement('p');
    result.textContent = 'Order placed';
    form.after(result);
    return { status: 'confirmed' };
  })());
});
</script>`,
      ),
    );
    return;
  }
  if (request.method === 'POST' && page === '/purchase') {
    if (request.headers['x-webmcp-tool'] !== 'purchase') {
      fail(
        400,
        "Use the checkout form's WebMCP purchase tool to place the order.",
      );
      return;
    }
    await purchase(context);
    return;
  }
  reply(404, { error: 'Not found' });
}
