import type { getGraphqlClient } from "@/lib/shopify";

type GraphqlClient = Awaited<ReturnType<typeof getGraphqlClient>>;

export async function shopifyGql<T>(
  client: GraphqlClient,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await client.request(query, { variables });

  if (response.errors) {
    const messages = Array.isArray(response.errors)
      ? response.errors.map((e: { message?: string }) => e.message ?? "GraphQL error")
      : [String(response.errors)];
    throw new Error(messages.join("; "));
  }

  if (!response.data) {
    throw new Error("Empty GraphQL response");
  }

  return response.data as T;
}
