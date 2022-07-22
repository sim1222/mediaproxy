/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
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
		if (request.method !== 'GET') {
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
		//Check Chache
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
			return cachedResult //Cached Response
		};


		//Get Remote
		const res = await fetch(reqUrl)

		//404
		if (res.status == 404) {
			console.warn(`Not Found: ${reqUrl}`);
			return new Response("Not Found", { status: 404 })
		}

		//Not 200
		if (res.status !== 200) {
			console.warn(`Unknown Status [${res.status}]: ${reqUrl}`);
			return new Response(`Unknown Status [${res.status}]`, { status: 500 })
		}

		//Not Media Redirect
		if (res.headers.get('content-type')?.startsWith('image/') ||
			res.headers.get('content-type')?.startsWith('video/') ||
			res.headers.get('content-type')?.startsWith('audio/')) {
			console.log(`Request Success!: ${reqUrl}`);
			const Result = new Response(await res.blob(), {
				headers: {
					'Cache-Control': 'max-age=14400',
					ETag: `W/\"${crypto.randomUUID()}\"`,
					'content-type': `${res.headers.get('content-type') ?? "application/octet-stream"}`
				}
			});
			//Save Cache
			console.log(`Saving Cache...: ${reqUrl}`)
			ctx.waitUntil(cache.put(cacheKey, Result.clone()));
			return Result;
		} else {
			console.error(`Unknown Error [${res.headers.get('content-type')}]: ${reqUrl}`);
			return new Response(`Unknown Error`, { status: 500 });
		}

	},
};
