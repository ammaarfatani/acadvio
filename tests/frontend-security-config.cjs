const assert=require('node:assert/strict');
(async()=>{const previous=process.env.NODE_ENV;try{
 const config=(await import('../next.config.mjs')).default;
 assert.equal(config.poweredByHeader,false);assert.equal(config.productionBrowserSourceMaps,false);assert.equal(config.reactStrictMode,true);
 process.env.NODE_ENV='production';const rules=await config.headers(),headers=Object.fromEntries(rules[0].headers.map(h=>[h.key,h.value]));
 assert.equal(rules[0].source,'/:path*');assert.equal(headers['X-Content-Type-Options'],'nosniff');assert.equal(headers['X-Frame-Options'],'DENY');assert.equal(headers['Referrer-Policy'],'strict-origin-when-cross-origin');assert.match(headers['Content-Security-Policy'],/frame-ancestors 'none'/);assert.match(headers['Strict-Transport-Security'],/max-age=31536000/);
 console.log('PASS: 9 canonical frontend security-config checks.');
}finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}})().catch(e=>{console.error(e);process.exitCode=1});
