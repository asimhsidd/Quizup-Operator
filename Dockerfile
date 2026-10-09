FROM public.ecr.aws/docker/library/node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .

# Origin of the KWIZ backend, e.g. https://play.kwiz.live (baked into the bundle)
ARG VITE_BACKEND_URL
RUN npm run build

FROM public.ecr.aws/docker/library/nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
