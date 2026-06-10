FROM node:18-alpine

# 设置生产环境
ENV NODE_ENV=production

# 限制 Node.js 堆内存大小，适配低内存服务器
ENV NODE_OPTIONS="--max-old-space-size=200"

WORKDIR /app

# 复制依赖清单
COPY package.json package-lock.json ./

# 仅安装生产依赖，跳过 devDependencies
RUN npm ci --omit=dev

# 复制源码
COPY src/ ./src/
COPY public/ ./public/
COPY app.js ./

# 创建运行时所需的目录
RUN mkdir -p music public/covers

EXPOSE 3000

CMD ["node", "app.js"]
