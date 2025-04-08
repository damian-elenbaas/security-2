import { config } from 'dotenv';
config();

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';
import { urlencoded, json } from 'express';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
	const app = await NestFactory.create(AppModule, { cors: true });
	const globalPrefix = 'api';

	const port = process.env.PORT || 3333;

	const limiter = rateLimit({
		windowMs: 60 * 1000,
		limit: 5,
		message: 'Too many requests, please try again later.',
	})
	
	app.setGlobalPrefix(globalPrefix);
	app.use(json({ limit: '50mb' }));
	app.use(urlencoded({ extended: true, limit: '50mb' }));
	app.use(limiter);
	await app.listen(port);

	Logger.log(
		`🚀 ${process.env.PROJECT_NAME
		} API is running on: ${await app.getUrl()}`,
	);
}
bootstrap();
