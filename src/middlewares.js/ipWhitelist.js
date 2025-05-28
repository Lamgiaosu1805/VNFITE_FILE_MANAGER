const proxyIpWhitelist = new Set([
    '42.113.122.155',
    '14.224.135.196'
]);
  
function ipWhitelistMiddleware(req, res, next) {
    const clientIp = req.ip || req.connection.remoteAddress;

    if (!proxyIpWhitelist.has(clientIp)) {
        return res.status(403).send('Forbidden: IP not allowed');
    }

    next();
}
  
module.exports = ipWhitelistMiddleware;