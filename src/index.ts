/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { stat } from "fs";

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	kv: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
}


export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		//Request Method Check
		if (!(request.method === 'GET' || request.method === 'HEAD')) {
			console.warn(`Method Not Allowed [${request.method}]:`);
			return new Response("Method Not Allowed", { status: 405 });
		}
		const { searchParams } = new URL(request.url)
		const reqUrl = searchParams.get('url')

		//Request URL Check
		if (reqUrl == null || reqUrl == '' || reqUrl == undefined) {
			console.warn(`No URL Error:`);
			return new Response("No URL Error", { status: 400 });
		}

		const cacheUrl = new URL(request.url);
		const cacheKey = new Request(cacheUrl.toString(), request);
		const cache = caches.default;
		//Check Cache
		const cachedResult = await cache.match(cacheKey);
		if (cachedResult) {
			const etag = request.headers.get('If-None-Match');
			if (etag !== null && etag === cachedResult.headers.get('ETag')) {
				console.log(`304 Not Modified: ${request.url}`);
				return new Response(null, {
					status: 304,
					headers: cachedResult.headers,
				})
			}
			console.log(`Cache hit for: ${request.url}`);
			if (request.method === 'HEAD') {
				return new Response(null, {
					status: 200,
					headers: cachedResult.headers,
				})
			}
			return cachedResult //Cached Response
		};

		const check = async (res: Response) => {

			const status = {
				// 200: 'OK',
				// 301: 'Moved Permanently',
				// 302: 'Found',
				// 303: 'See Other',
				// 304: 'Not Modified',
				// 307: 'Temporary Redirect',
				// 308: 'Permanent Redirect',
				// 400: 'Bad Request',
				// 401: 'Unauthorized',
				403: 'Forbidden',
				404: 'Not Found',
				// 405: 'Method Not Allowed',
				// 406: 'Not Acceptable',
				// 408: 'Request Timeout',
				// 409: 'Conflict',
				// 410: 'Gone',
				// 411: 'Length Required',
				// 412: 'Precondition Failed',
				// 413: 'Payload Too Large',
				// 414: 'URI Too Long',
				// 415: 'Unsupported Media Type',
				// 416: 'Range Not Satisfiable',
				// 417: 'Expectation Failed',
				// 418: 'I\'m a teapot',
				// 421: 'Misdirected Request',
				// 422: 'Unprocessable Entity',
				// 423: 'Locked',
				// 424: 'Failed Dependency',
				// 425: 'Too Early',
				// 426: 'Upgrade Required',
				// 428: 'Precondition Required',
				// 429: 'Too Many Requests',
				// 431: 'Request Header Fields Too Large',
				// 451: 'Unavailable For Legal Reasons',
				// 500: 'Internal Server Error',
				// 501: 'Not Implemented',
				// 502: 'Bad Gateway',
				// 503: 'Service Unavailable',
				// 504: 'Gateway Timeout',
				// 505: 'HTTP Version Not Supported',
				// 506: 'Variant Also Negotiates',
				// 507: 'Insufficient Storage',
				// 508: 'Loop Detected',
				// 510: 'Not Extended',
				// 511: 'Network Authentication Required',
				522: 'Connection Timed Out',
				// 524: 'A Timeout Occurred',
				// 598: 'Network read timeout error',
				// 599: 'Network connect timeout error'
			}

			if (Object.keys(status).includes(res.status.toString())) { 
				console.warn(`${status[res.status as keyof typeof status]}: ${reqUrl}`);
				const img = await env.kv.get(res.status.toString(), 'arrayBuffer');
				return new Response(img, { status: res.status, headers: { 'content-type': 'image/png' } });
			}

			if (res.status !== 200) {
				console.warn(`Unknown Status [${res.status}]: ${reqUrl}`);
				return new Response(`Unknown Status [${res.status}]`, { status: 500 });
			}

			//Not Media Redirect
			if (res.headers.get('content-type')?.startsWith('image/') ||
				res.headers.get('content-type')?.startsWith('video/') ||
				res.headers.get('content-type')?.startsWith('audio/')) {
				console.log(`Request Success!: ${reqUrl}`);
				const Result = new Response(await res.blob(), {
					headers: {
						'Cache-Control': 'max-age=2678400', //1 Month
						ETag: `W/\"${crypto.randomUUID()}\"`,
						'content-type': res.headers.get('content-type') ?? "application/octet-stream",
						'Content-Disposition': res.headers.get('Content-Disposition') ?? `inline; filename="${reqUrl.split('/').pop()}"`,
						'X-Cache': 'HIT',
					}
				});
				if (Result.body != null) {
					//Save Cache
					console.log(`Saving Cache...: ${reqUrl}`);
					ctx.waitUntil(cache.put(cacheKey, Result.clone()));
				}
				Result.headers.set('X-Cache', 'MISS');
				return Result;
			} else {
				console.error(`Redirecting... [${res.headers.get('content-type')}]: ${reqUrl}`);
				return Response.redirect(reqUrl, 301);
			}
		}

		if (request.method === 'HEAD') {
			const res = await fetch(reqUrl, {
				method: 'HEAD',
			});
			return check(res);
		}

		//Get Remote
		const res = await fetch(reqUrl, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 simkey-MediaProxy https://github.com/sim1222/mediaproxy',
			}
		})
		return await check(res);

	},
};
