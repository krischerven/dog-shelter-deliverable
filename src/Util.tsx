import Swal from 'sweetalert2';

type MockResponseOptions = {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
};

class MockFetch {
  private routes: Map<string, MockResponseOptions>;

  constructor() {
    this.routes = new Map();
  }

  /**
   * Registers a mock route with a specified URL and response.
   */
  addMockRoute(url: string, options: MockResponseOptions) {
    this.routes.set(url, options);
  }

  /**
   * Simulates the fetch function.
   */
  simulateFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input.url;
    const mockResponse = this.routes.get(url);

    if (!mockResponse) {
      return Promise.reject(
        new Error(
          `No mock response found for URL: ${url} (body ${JSON.stringify(init)})`,
        ),
      );
    }

    const {
      status = 200,
      statusText = 'OK',
      headers = {},
      body = '',
    } = mockResponse;

    const headersObj = new Headers(headers);

    const response = new Response(body, {
      status,
      statusText,
      headers: headersObj,
    });

    return Promise.resolve(response);
  }
}

const mockFetch = new MockFetch();

// Add a mock route
mockFetch.addMockRoute('https://api.example.com/data', {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello, world!' }),
});

// Replace the global fetch with our simulated fetch
export function coldFetch(
  input: RequestInfo,
  init?: RequestInit,
): Promise<Response> {
  return mockFetch.simulateFetch(input, init);
}

export function objectToQueryParams(obj: Record<string, any>): string {
  const params = new URLSearchParams();

  Object.keys(obj).forEach((key) => {
    params.append(key, obj[key]);
  });

  return params.toString();
}

export function popup(body: string) {
  Swal.fire("", body);
}

export function error(body: string) {
  Swal.fire("Error", body);
}