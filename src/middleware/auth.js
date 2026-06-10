// 认证中间件
function authMiddleware(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    next();
}

// API认证中间件
function apiAuthMiddleware(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, message: '未登录' });
    }
    next();
}

module.exports = {
    authMiddleware,
    apiAuthMiddleware
};