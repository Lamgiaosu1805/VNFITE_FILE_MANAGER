const proxyIpWhitelist = new Set([
    '42.113.122.155',
    '14.224.135.196',
    '42.113.122.118'
]);
  
function ipClientWhitelistMiddleware(req, res, next) {
    // Lấy IP client thực sự từ header X-Forwarded-For
    const xForwardedFor = req.headers['x-forwarded-for'];
    const clientIp = xForwardedFor ? xForwardedFor.split(',')[0].trim() : req.ip;
    console.log("ClientIP: ", clientIp)
  
    if (!proxyIpWhitelist.has(clientIp)) {
        return res.status(403).send('Forbidden: IP not allowed');
    }
  
    next();
}
  
module.exports = ipClientWhitelistMiddleware;