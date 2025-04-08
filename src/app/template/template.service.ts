import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TemplateDocument, Template } from './template.schema';
import { Buffer } from 'buffer';
import sharp from 'sharp';
import logger from 'src/logger';

@Injectable()
export class TemplateService {
	constructor(
		@InjectModel(Template.name)
		private templateModel: Model<TemplateDocument>,
	) {}

	async getTemplates(): Promise<Template[]> {
		return await this.templateModel.find().exec();
	}

	async createTemplate(
		name: string,
		content: string,
		templateImage: string,
	): Promise<Template> {
		if (!await this.checkIfBase64(templateImage))
			throw new HttpException('Invalid input', HttpStatus.BAD_REQUEST);
		const template = new this.templateModel({
			name: name,
			content: content,
			templateImage: templateImage,
		});

		await template.save().catch((err) => {
			if (err.code == 11000) {
				throw new HttpException(
					'Template name `' + name + '` already exists',
					HttpStatus.BAD_REQUEST,
				);
			}

			logger.error('Error: ', err.message);
			throw new HttpException('Error', HttpStatus.BAD_REQUEST);
		});

		return template;
	}

	async deleteTemplate(id: string): Promise<Template> {
		var template = await this.templateModel.findOneAndDelete({ id: id });
		if (template == null)
			throw new HttpException(
				'template not found ',
				HttpStatus.NOT_FOUND,
			);
		return template;
	}

	async updateTemplate(id: string, template: Template): Promise<Template> {
		if (template.templateImage !== undefined) {
			if (!await this.checkIfBase64(template.templateImage))
				throw new HttpException(
					'Invalid input',
					HttpStatus.BAD_REQUEST,
				);
		}
		if ((await this.getTemplateById(id)) == null)
			throw new HttpException(
				'Template not found ',
				HttpStatus.NOT_FOUND,
			);

		return await this.templateModel
			.findOneAndUpdate({ id: id }, template, {
				new: true,
			})
			.catch((err) => {
				if (err.code == 11000) {
					throw new HttpException(
						'Template name `' + template.name + '` already exists',
						HttpStatus.BAD_REQUEST,
					);
				}

				logger.error('Error: ', err.message);
				throw new HttpException('Error', HttpStatus.BAD_REQUEST);
			});
	}

	async getTemplateById(id: string): Promise<Template> {
		var template = await this.templateModel.findOne({ id: id });
		if (template == null)
			throw new HttpException(
				'template not found ',
				HttpStatus.NOT_FOUND,
			);
		return template;
	}

	async checkIfBase64(str: string) {
		const matches = str.match(/^data:image\/(png|jpg|jpeg);base64,(.+)$/);
		if (!matches) return false;
		const base64Data = matches[2];
		const buffer = Buffer.from(base64Data, 'base64');
		try {
			const metadata = await sharp(buffer).metadata();
			return !!metadata.format;
		  } catch (err) {
			return false;
		  }
	}
}
