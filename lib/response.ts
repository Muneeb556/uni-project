export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json') || text.trimStart().startsWith('<')) {
    throw new Error(response.ok ? 'The server returned an unexpected page' : 'The server connection is unavailable');
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('The server returned an invalid response');
  }
}
