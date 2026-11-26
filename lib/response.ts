export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json') || text.trimStart().startsWith('<')) {
    if (!response.ok) {
      if (response.status === 404) throw new Error('Resource not found (404)');
      if (response.status === 401) throw new Error('Authentication required');
      if (response.status === 403) throw new Error('Access denied');
      throw new Error(`The server returned an error (${response.status})`);
    }
    throw new Error('The server returned an unexpected page');
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('The server returned an invalid response');
  }
}
