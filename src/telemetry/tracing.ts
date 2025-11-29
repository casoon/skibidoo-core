// OpenTelemetry Tracing Setup
// src/telemetry/tracing.ts

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { env } from "@/config";

const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || "skibidoo-core";
const SERVICE_VERSION = process.env.npm_package_version || "1.0.0";

let sdk: NodeSDK | null = null;

export function initTracing(): void {
  // Skip in test environment
  if (env.NODE_ENV === "test") {
    return;
  }

  // Skip if OTEL is disabled
  if (process.env.OTEL_DISABLED === "true") {
    console.log("[tracing] OpenTelemetry disabled");
    return;
  }

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
    "deployment.environment": env.NODE_ENV,
  });

  const traceExporter = new OTLPTraceExporter({
    url: OTEL_ENDPOINT + "/v1/traces",
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-http": {
          ignoreIncomingRequestHook: (req) => {
            const url = req.url || "";
            return url.includes("/health") || url.includes("/metrics");
          },
        },
        "@opentelemetry/instrumentation-pg": {
          enhancedDatabaseReporting: true,
        },
      }),
    ],
  });

  sdk.start();
  console.log("[tracing] OpenTelemetry initialized - exporting to", OTEL_ENDPOINT);

  process.on("SIGTERM", () => {
    sdk?.shutdown()
      .then(() => console.log("[tracing] OpenTelemetry shut down"))
      .catch((err) => console.error("[tracing] Error shutting down", err));
  });
}

export function shutdownTracing(): Promise<void> {
  if (sdk) {
    return sdk.shutdown();
  }
  return Promise.resolve();
}
