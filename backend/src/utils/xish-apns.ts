/**
 * xish-apns.ts — Apple Push Notification Service utility for PassKit pass updates.
 *
 * Apple Wallet calls our webServiceURL to register devices. When we award points we
 * push an empty notification so iOS fetches the refreshed .pkpass automatically.
 *
 * No extra npm dependency: uses Node.js built-in http2 + TLS client certificate
 * (the same pass signing certificate already in APPLE_PASS_CERT_B64 / pass.pem).
 */

import * as http2  from "http2";
import * as path   from "path";
import * as fs     from "fs";
import pool        from "../config/db";

const CERTS_DIR = path.resolve(__dirname, "../../certs");

function loadPem(envKey: string, fileName: string): string | null {
  const b64 = process.env[envKey];
  if (b64) return Buffer.from(b64, "base64").toString("utf-8");
  const fp = path.join(CERTS_DIR, fileName);
  return fs.existsSync(fp) ? fs.readFileSync(fp, "utf-8") : null;
}

async function pushOneDevice(
  pushToken: string,
  cert: string,
  key: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Apple Wallet always uses the production APNs gateway (no sandbox for passes).
    const client = http2.connect("https://api.push.apple.com", {
      cert,
      key,
      rejectUnauthorized: true,
    });

    client.on("error", (err) => {
      client.destroy();
      reject(err);
    });

    const payload = "{}";
    const req = client.request({
      ":method":        "POST",
      ":path":          `/3/device/${pushToken}`,
      "content-type":   "application/json",
      "apns-topic":     process.env.APPLE_PASS_TYPE_ID || "pass.io.xish.loyalty",
      "apns-push-type": "background",
      "content-length": String(Buffer.byteLength(payload)),
    });

    req.write(payload);
    req.end();

    req.on("response", (headers) => {
      const status = Number(headers[":status"]);
      let body = "";
      req.setEncoding("utf8");
      req.on("data", (d) => { body += d; });
      req.on("end", () => {
        client.close();
        if (status === 200) {
          resolve();
        } else {
          // 410 = device token no longer valid — log but don't throw
          if (status === 410) {
            console.warn(`[XISH APNs] Device token invalid (410), skipping: ${pushToken.slice(0, 8)}…`);
            resolve();
          } else {
            reject(new Error(`APNs ${status}: ${body}`));
          }
        }
      });
    });

    req.on("error", (err) => {
      client.destroy();
      reject(err);
    });
  });
}

/**
 * Send a silent APNs push to every device registered for this XISH member.
 * iOS Wallet will then call GET /api/xish/wallet/passkit/v1/passes/… to fetch
 * the updated .pkpass. Non-fatal: errors are logged but never thrown.
 */
export async function sendPassUpdatePush(memberId: number): Promise<void> {
  try {
    const cert = loadPem("APPLE_PASS_CERT_B64", "pass.pem");
    const key  = loadPem("APPLE_PASS_KEY_B64",  "passkit.key.pem");
    if (!cert || !key) {
      console.warn("[XISH APNs] Certificates not available — push skipped");
      return;
    }

    const result = await pool.query<{ push_token: string }>(
      `SELECT DISTINCT push_token
       FROM xish_wallet_device_registrations
       WHERE member_id = $1`,
      [memberId]
    );

    if (result.rows.length === 0) {
      console.log(`[XISH APNs] No registered devices for member ${memberId} — pass update will be fetched on next open`);
      return;
    }

    console.log(`[XISH APNs] Sending push to ${result.rows.length} device(s) for member ${memberId}`);

    const outcomes = await Promise.allSettled(
      result.rows.map((r) => pushOneDevice(r.push_token, cert, key))
    );

    outcomes.forEach((o, i) => {
      if (o.status === "rejected") {
        console.error(`[XISH APNs] Push #${i} failed:`, o.reason?.message ?? o.reason);
      } else {
        console.log(`[XISH APNs] Push #${i} delivered`);
      }
    });
  } catch (err: any) {
    console.error("[XISH APNs] sendPassUpdatePush error:", err?.message ?? err);
  }
}
