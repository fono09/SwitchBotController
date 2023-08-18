import config from "npm:config";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";
import { Buffer } from "https://deno.land/std@0.168.0/node/buffer.ts";

const token = config.get("switchbot.token");
const secret = config.get("switchbot.secret");

function generateHeader(token: string, secret: string) {
  const t = Date.now();
  const nonce = "requestID";
  const data = token + t + nonce;
  const signTerm = createHmac("sha256", secret)
    .update(Buffer.from(data, "utf-8"))
    .digest();
  const sign = signTerm.toString("base64");

  return {
    "Content-Type": "application/json",
    "Authorization": token,
    "sign": sign,
    "nonce": nonce,
    "t": t,
  };
}

const ac = "01-202201081420-44258596";
const plug = "441793102387";

let ac_params = {
  temp: 22,
  mode: 5,
  fan_speed: 4,
  power_state: "on",
};

let body, headers, res, json;

headers = generateHeader(token, secret);
res = await fetch(`https://api.switch-bot.com/v1.1/devices`, {
  headers: { ...headers },
});
json = await res.json();
console.log(json);

headers = generateHeader(token, secret);
body = JSON.stringify({
  action: "setupWebhook",
  url: "https://swb-wh.fono.jp/",
  deviceList: "ALL",
})
res = await fetch(`https://api.switch-bot.com/v1.1/webhook/setupWebhook`, {
  method: "POST",
  headers: { ...headers, "Content-Length": body.length, },
  body: body
});;
json = await res.json();
console.log(json);


const server = Deno.listen({ port: 8080 });
for await (const conn of server) {
  serveHttp(conn);
}

async function serveHttp(conn: Deno.Conn) {
  // This "upgrades" a network connection into an HTTP connection.
  const httpConn = Deno.serveHttp(conn);
  // Each request sent over the HTTP connection will be yielded as an async
  // iterator from the HTTP connection.
  for await (const requestEvent of httpConn) {
    // The native HTTP server uses the web standard `Request` and `Response`
    // objects.
    const body = `Your user-agent is:\n\n${
      requestEvent.request.headers.get("user-agent") ?? "Unknown"
    }`;
    // The requestEvent's `.respondWith()` method is how we send the response
    // back to the client.
    try {
      console.log(await requestEvent.request.json())
    } catch {
      requestEvent.respondWith(
        new Response(null, {
          status: 204,
        }),
      );
      return
    }

    requestEvent.respondWith(
      new Response(body, {
        status: 200,
      }),
    );
  }
}
