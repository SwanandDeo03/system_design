const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

// Do NOT crash app if OTEL is misconfigured
if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  console.log('OpenTelemetry disabled (no OTLP endpoint)');
  module.exports = null;
  return;
}

let sdk;

try {
  sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start().then(() => {
    console.log('OpenTelemetry SDK started');
  });
} catch (err) {
  console.error('OpenTelemetry failed to start:', err);
}

process.on('SIGTERM', async () => {
  if (sdk) {
    await sdk.shutdown().catch(() => {});
  }
});

module.exports = sdk;
