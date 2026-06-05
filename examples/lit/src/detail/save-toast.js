import { html, nothing } from 'lit';

export function renderSaveToast(saveResult) {
  if (!saveResult) return nothing;
  return html`
    <div class="alert alert-${saveResult.success ? 'success' : 'danger'} position-fixed bottom-0 end-0 m-3">
      ${saveResult.success ? '✓ Saved' : `Error: ${saveResult.error}`}
    </div>
  `;
}
