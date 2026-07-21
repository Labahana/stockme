import type { getGraphqlClient } from "@/lib/shopify";

type GraphqlClient = Awaited<ReturnType<typeof getGraphqlClient>>;

function formatGraphqlErrors(errors: unknown): string {
  if (!errors) return "GraphQL error";
  if (typeof errors === "string") return errors;
  if (Array.isArray(errors)) {
    return errors
      .map((e) =>
        typeof e === "string"
          ? e
          : (e as { message?: string })?.message ?? JSON.stringify(e),
      )
      .join("; ");
  }
  if (typeof errors === "object") {
    const obj = errors as {
      message?: string;
      graphQLErrors?: Array<{ message?: string }>;
    };
    if (obj.graphQLErrors?.length) {
      return obj.graphQLErrors
        .map((e) => e.message ?? "GraphQL error")
        .join("; ");
    }
    if (obj.message) return obj.message;
    try {
      return JSON.stringify(errors);
    } catch {
      return "GraphQL error";
    }
  }
  return String(errors);
}

export async function shopifyGql<T>(
  client: GraphqlClient,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await client.request(query, { variables });

  if (response.errors) {
    console.error(
      "Shopify GraphQL errors:",
      JSON.stringify(response.errors, null, 2),
    );
    // Partial success: Shopify often returns data alongside field-level errors
    // (e.g. unitCost ACCESS_DENIED). Prefer data so catalog sync can continue.
    if (response.data) {
      return response.data as T;
    }
    throw new Error(formatGraphqlErrors(response.errors));
  }

  if (!response.data) {
    throw new Error("Empty GraphQL response");
  }

  return response.data as T;
}
