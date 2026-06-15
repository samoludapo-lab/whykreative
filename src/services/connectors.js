import { connectorDefinitions } from "./catalog.js";
import { cleanSecret } from "./sanitize.js";

export function createConnectorService(config) {
  const connectorState = Object.fromEntries(
    connectorDefinitions.map((connector) => {
      const envSecret = providerSecret(config, connector.id);
      return [
        connector.id,
        {
          connected: Boolean(envSecret),
          source: envSecret ? "env" : null,
          last4: envSecret ? "env" : null,
          updatedAt: null
        }
      ];
    })
  );

  return {
    list() {
      return connectorDefinitions.map((connector) => ({
        ...connector,
        ...connectorState[connector.id]
      }));
    },
    upsert(id, secretValue) {
      const connector = connectorDefinitions.find((item) => item.id === id);
      if (!connector) return null;
      const secret = cleanSecret(secretValue);
      connectorState[id] = {
        connected: Boolean(secret),
        source: secret ? "dashboard" : null,
        last4: secret ? secret.slice(-4) : null,
        updatedAt: new Date().toISOString()
      };
      return { ...connector, ...connectorState[id] };
    },
    remove(id) {
      const connector = connectorDefinitions.find((item) => item.id === id);
      if (!connector) return null;
      connectorState[id] = {
        connected: false,
        source: null,
        last4: null,
        updatedAt: new Date().toISOString()
      };
      return { ...connector, ...connectorState[id] };
    }
  };
}

function providerSecret(config, id) {
  if (id === "r2") return config.storage.accessKeyId;
  if (id === "tiktok") return config.providers.tiktokClientId;
  return config.providers[id] || "";
}
