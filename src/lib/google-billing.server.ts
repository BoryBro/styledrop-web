import { readFileSync } from "node:fs";
import { JWT } from "google-auth-library";

type BillingWindow = {
  from: string;
  to: string;
};

type GeminiBillingSnapshot = {
  amount: number;
  currency: string | null;
  source: "bigquery_actual";
};

function parseServiceAccountJson() {
  const inlineRaw = process.env.GCP_BILLING_SERVICE_ACCOUNT_JSON?.trim();
  const jsonPath = process.env.GCP_BILLING_SERVICE_ACCOUNT_JSON_PATH?.trim();
  let fileRaw = "";
  if (jsonPath) {
    try { fileRaw = readFileSync(jsonPath, "utf8").trim(); } catch { fileRaw = ""; }
  }
  const raw = inlineRaw || fileRaw;
  if (!raw) return null;

  try {
    return JSON.parse(raw) as {
      client_email?: string;
      private_key?: string;
      project_id?: string;
    };
  } catch {
    return null;
  }
}

function parseDatasetTarget(raw: string) {
  const parts = raw.split(".").map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) return null;

  return {
    projectId: parts[0],
    datasetId: parts[1],
  };
}

function getBillingConfig() {
  const serviceAccount = parseServiceAccountJson();
  const exportTable = process.env.GCP_BILLING_EXPORT_TABLE?.trim();
  const exportDatasetRaw = process.env.GCP_BILLING_EXPORT_DATASET?.trim();
  const exportDataset = exportDatasetRaw ? parseDatasetTarget(exportDatasetRaw) : null;

  if (!serviceAccount?.client_email || !serviceAccount.private_key || (!exportTable && !exportDataset)) {
    return null;
  }

  const queryProjectId =
    process.env.GCP_BILLING_QUERY_PROJECT_ID?.trim()
    || serviceAccount.project_id?.trim()
    || exportDataset?.projectId
    || exportTable?.split(".")[0];

  if (!queryProjectId) return null;

  return {
    exportTable,
    exportDataset,
    queryProjectId,
    serviceDescription: process.env.GCP_BILLING_SERVICE_DESCRIPTION?.trim() || "Gemini API",
    serviceAccount,
  };
}

function readBigQueryValue(value: unknown) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function runBigQueryQuery<T>({
  accessToken,
  queryProjectId,
  query,
  queryParameters,
}: {
  accessToken: string;
  queryProjectId: string;
  query: string;
  queryParameters?: Array<Record<string, unknown>>;
}) {
  const response = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${queryProjectId}/queries`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        useLegacySql: false,
        parameterMode: queryParameters?.length ? "NAMED" : undefined,
        queryParameters,
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`BigQuery billing query failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function detectBillingExportTable({
  accessToken,
  queryProjectId,
  exportDataset,
}: {
  accessToken: string;
  queryProjectId: string;
  exportDataset: { projectId: string; datasetId: string } | null;
}) {
  if (!exportDataset) return null;

  const payload = await runBigQueryQuery<{
    rows?: Array<{ f?: Array<{ v?: unknown }> }>;
  }>({
    accessToken,
    queryProjectId,
    query: `
      SELECT table_name
      FROM \`${exportDataset.projectId}.${exportDataset.datasetId}.INFORMATION_SCHEMA.TABLES\`
      WHERE table_name LIKE 'gcp_billing_export_resource_v1_%'
         OR table_name LIKE 'gcp_billing_export_v1_%'
      ORDER BY
        CASE
          WHEN table_name LIKE 'gcp_billing_export_resource_v1_%' THEN 0
          ELSE 1
        END,
        creation_time DESC
      LIMIT 1
    `,
  });

  const tableName = payload.rows?.[0]?.f?.[0]?.v;
  if (typeof tableName !== "string" || !tableName.trim()) return null;

  return `${exportDataset.projectId}.${exportDataset.datasetId}.${tableName.trim()}`;
}

export async function getGeminiBillingSnapshot(window: BillingWindow): Promise<GeminiBillingSnapshot | null> {
  const config = getBillingConfig();
  if (!config) return null;

  const auth = new JWT({
    email: config.serviceAccount.client_email,
    key: config.serviceAccount.private_key,
    scopes: ["https://www.googleapis.com/auth/bigquery.readonly"],
  });

  const accessTokenResponse = await auth.getAccessToken();
  const accessToken =
    typeof accessTokenResponse === "string"
      ? accessTokenResponse
      : accessTokenResponse?.token ?? null;
  if (!accessToken) return null;

  const exportTable = config.exportTable || await detectBillingExportTable({
    accessToken,
    queryProjectId: config.queryProjectId,
    exportDataset: config.exportDataset,
  });

  if (!exportTable) return null;

  const query = `
    SELECT
      COUNT(*) AS row_count,
      COALESCE(SUM(cost), 0) AS amount,
      ANY_VALUE(currency) AS currency
    FROM \`${exportTable}\`
    WHERE service.description = @serviceDescription
      AND usage_start_time >= TIMESTAMP(@fromTs)
      AND usage_start_time <= TIMESTAMP(@toTs)
  `;

  const payload = await runBigQueryQuery<{
    rows?: Array<{ f?: Array<{ v?: unknown }> }>;
  }>({
    accessToken,
    queryProjectId: config.queryProjectId,
    query,
    queryParameters: [
      {
        name: "serviceDescription",
        parameterType: { type: "STRING" },
        parameterValue: { value: config.serviceDescription },
      },
      {
        name: "fromTs",
        parameterType: { type: "STRING" },
        parameterValue: { value: window.from },
      },
      {
        name: "toTs",
        parameterType: { type: "STRING" },
        parameterValue: { value: window.to },
      },
    ],
  });

  const row = payload.rows?.[0]?.f ?? [];
  const rowCount = readBigQueryValue(row[0]?.v);
  const amount = readBigQueryValue(row[1]?.v);
  const currency = typeof row[2]?.v === "string" ? row[2].v : null;

  if (rowCount == null || rowCount <= 0 || amount == null) return null;

  return {
    amount: Math.round(amount),
    currency,
    source: "bigquery_actual",
  };
}

export function hasGeminiBillingConfig() {
  return getBillingConfig() !== null;
}
