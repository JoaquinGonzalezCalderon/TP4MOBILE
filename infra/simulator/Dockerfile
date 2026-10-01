FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY simulator.mjs .
CMD ["npm","start"]
