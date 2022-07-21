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
			console.error(`Method Not Allowed [${request.method}]:`);
			return new Response("Method Not Allowed", { status: 405 });
		}
		const { searchParams } = new URL(request.url)
		const reqUrl = searchParams.get('url')

		//Request URL Check
		if (reqUrl == null || '' || undefined) {
			console.error(`No URL Error:`);
			return new Response("No URL Error", { status: 400 });
		}
		
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
		if (!res.headers.get('content-type')?.startsWith('image/') ||
			!res.headers.get('content-type')?.startsWith('video/') ||
			!res.headers.get('content-type')?.startsWith('image/')) {
			console.warn(`Not Media File [${res.headers.get('content-type')}]: ${reqUrl}`);
			return Response.redirect(reqUrl, 301);
		}

		return new Response(await res.blob(), { headers: { 'content-type': `${res.headers.get('content-type') }` } })
	},
};
