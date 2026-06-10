// CSP 中间件
function cspMiddleware(req, res, next) {
    // 处理 Chrome 开发者工具的 CSP 请求
    if (req.path.includes('.well-known/appspecific/')) {
        res.status(404).send('Not Found');
        return;
    }
    
    // 设置基本的 CSP 头部
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; img-src 'self' data: https:; font-src 'self' https://cdnjs.cloudflare.com; connect-src 'self'; media-src 'self'"
    );
    
    next();
}

module.exports = cspMiddleware;