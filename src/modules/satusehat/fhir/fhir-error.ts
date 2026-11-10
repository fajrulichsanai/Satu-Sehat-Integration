/** Ambil pesan yang bisa dibaca dari OperationOutcome FHIR bila ada. */
export function readableFhirError(error?: unknown): string {
  if (error === undefined || error === null || error === '') {
    return 'tidak diketahui';
  }
  let parsed: unknown = error;
  if (typeof error === 'string') {
    try {
      parsed = JSON.parse(error);
    } catch {
      return error.length > 300 ? `${error.slice(0, 300)}…` : error;
    }
  }
  const outcome = parsed as {
    issue?: {
      details?: { text?: string };
      diagnostics?: string;
      code?: string;
    }[];
  };
  const texts = (outcome?.issue ?? [])
    .map((i) => i.details?.text || i.diagnostics || i.code)
    .filter(Boolean);
  if (texts.length) return texts.join('; ');
  const raw = typeof error === 'string' ? error : JSON.stringify(error);
  return raw.length > 300 ? `${raw.slice(0, 300)}…` : raw;
}
