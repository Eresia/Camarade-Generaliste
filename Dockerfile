FROM	node:19-alpine

WORKDIR	/usr/src/bot-discord

COPY	package.json /usr/src/bot-discord

RUN	npm install

COPY	. /usr/src/bot-discord

CMD	[ "node", "Bot.js" ]
