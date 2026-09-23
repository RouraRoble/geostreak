/** Native share sheet with a copy-to-clipboard fallback. Browser-only. */
export type ShareResult = 'shared' | 'copied' | 'unavailable';

export async function shareOrCopy(title: string, text: string, url: string): Promise<ShareResult> {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title, text, url });
      return 'shared';
    }
  } catch {
    // user cancelled the native sheet — fall through to clipboard so the button still "does" something
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return 'unavailable';
  }
}
