/**
 * Proxmox VE authentication methods
 */

import "server-only";
import { ProxmoxClient } from "./client.js";
import type {
  ProxmoxTicketCredentials,
  ProxmoxTicketRequest,
  ProxmoxTicketResponse,
} from "./types.js";

/**
 * Login to Proxmox VE and obtain a ticket
 */
export async function login(
  host: string,
  port: number,
  username: string,
  password: string,
  realm = "pam",
): Promise<ProxmoxTicketCredentials> {
  // Create a temporary client without credentials to make the login request
  const loginUrl = `https://${host}:${port}/api2/json/access/ticket`;

  // Proxmox expects form-encoded data for login
  const body = new URLSearchParams({
    username: `${username}@${realm}`,
    password,
  });

  const response = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    // Allow self-signed certificates
    // @ts-expect-error - Node.js fetch supports agent option
    agent: new (await import("node:https")).Agent({
      rejectUnauthorized: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const ticketData = data.data as ProxmoxTicketResponse;

  return createTicketCredentials(ticketData);
}

/**
 * Refresh an existing ticket before it expires
 */
export async function refreshTicket(
  client: ProxmoxClient,
): Promise<ProxmoxTicketCredentials> {
  const credentials = client.getCredentials();

  if (credentials.type !== "ticket") {
    throw new Error("Can only refresh ticket-based credentials");
  }

  // Use the existing ticket to get a new one
  // Note: This uses the same endpoint as login, but we're already authenticated
  const response = await client.post<ProxmoxTicketResponse>(
    "/access/ticket",
    new URLSearchParams({
      username: "", // Not needed when using existing ticket
      password: "", // Not needed when using existing ticket
    }),
  );

  const newCredentials = createTicketCredentials(response);

  // Update the client's credentials
  client.updateCredentials(newCredentials);

  return newCredentials;
}

/**
 * Create ticket credentials from API response
 */
export function createTicketCredentials(
  response: ProxmoxTicketResponse,
): ProxmoxTicketCredentials {
  // Tickets expire after 2 hours
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 2);

  return {
    type: "ticket",
    ticket: response.ticket,
    csrfToken: response.CSRFPreventionToken,
    expiresAt,
  };
}
