const express = require('express');
const router = express.Router();

// 简单的用户数据库（实际应用中应该使用真实数据库）
const users = [
    { username: 'admin', password: 'admin' }
];

// 登录路由
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    // 查找用户
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        // 设置会话
        req.session.user = {
            username: user.username
        };
        res.json({ success: true, message: '登录成功' });
    } else {
        res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
});

// 登出路由 - POST
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, message: '登出失败' });
        }
        res.json({ success: true, message: '登出成功' });
    });
});

// 登出路由 - GET（用于页面链接）
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('登出失败');
        }
        res.redirect('/login');
    });
});

// 获取用户信息
router.get('/user', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ 
            success: true, 
            user: req.session.user 
        });
    } else {
        res.status(401).json({ 
            success: false, 
            message: '未登录' 
        });
    }
});

module.exports = router;