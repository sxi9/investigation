// A stand-in for MISP, TheHive and Jira used by the Walkthrough 6 capture: accepts the pushes and answers like the real APIs.
const http = require('http');
const seen = [];
http.createServer((req, res) => {
  let body = ''; req.on('data', c => { body += c; }); req.on('end', () => {
    let j = null; try { j = JSON.parse(body); } catch (e) {}
    seen.push({ url: req.url, auth: req.headers.authorization || '', body: j });
    res.setHeader('content-type', 'application/json');
    if (req.url.startsWith('/misp/events')) return res.end(JSON.stringify({ Event: { id: '1042', uuid: 'f3b2c9e4-1b2c-4d5e-8f90-123456789abc', info: j && j.Event && j.Event.info } }));
    if (req.url.startsWith('/hive/api/v1/alert')) return res.end(JSON.stringify({ _id: '~409632', title: j && j.title }));
    if (req.url.startsWith('/jira/rest/api/3/issue')) return res.end(JSON.stringify({ id: '10077', key: 'SEC-77', self: 'http://127.0.0.1:9797/jira/rest/api/3/issue/10077' }));
    if (req.url === '/seen') return res.end(JSON.stringify(seen));
    res.statusCode = 404; res.end('{"error":"no such route"}');
  });
}).listen(9797, '127.0.0.1', () => console.log('mock TIP on 9797'));
