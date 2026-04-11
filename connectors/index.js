import { hubspotConnector } from './hubspot.js';

const CONNECTORS = {
  hubspot: hubspotConnector,
  // salesforce: salesforceConnector,  // futuro
  // csv: csvConnector,                // futuro
};

/**
 * Devuelve el conector para la fuente indicada, o null si no existe.
 * @param {string} source
 */
export function getConnector(source) {
  return CONNECTORS[source] || null;
}
