FROM node:alpine as builder
WORKDIR '/app'
COPY package.json .
RUN npm install
RUN npm i web-vitals --save-dev
RUN npm install --save --legacy-peer-deps
RUN npm install antd enquire-js rc-queue-anim rc-scroll-anim rc-tween-one --save
RUN npm install rc-banner-anim --save
RUN npm install @ant-design/compatible --save
RUN npm install babel-plugin-import --save-dev
RUN npm install react-app-rewired customize-cra less less-loader
COPY ./ ./
RUN npm run build

FROM nginx
EXPOSE 80
COPY --from=builder /app/build /usr/share/nginx/html