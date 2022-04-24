FROM node:alpine as builder
WORKDIR '/app'
COPY package.json .
RUN npm install --save --legacy-peer-deps
RUN npm install postcss-normalize --legacy-peer-deps
RUN npm install antd enquire-js rc-queue-anim rc-scroll-anim rc-tween-one --save --legacy-peer-deps
RUN npm install rc-banner-anim --save --legacy-peer-deps
RUN npm install @ant-design/compatible --save --legacy-peer-deps
RUN npm install babel-plugin-import --save-dev --legacy-peer-deps
RUN npm install react-app-rewired customize-cra less less-loader --legacy-peer-deps
COPY ./ ./
RUN npm run build

FROM nginx
EXPOSE 80
COPY --from=builder /app/build /usr/share/nginx/html