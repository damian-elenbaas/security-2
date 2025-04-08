import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Field, FieldDocument } from './field.schema';
import { CategoryService } from '../category/category.service';
import { Category } from '../category/category.schema';
import logger from 'src/logger';

@Injectable()
export class FieldService {
	constructor(
		@InjectModel(Field.name)
		private fieldModel: Model<FieldDocument>,
		private categoryService: CategoryService,
	) {}

	async createField(newField: Field): Promise<Field> {
		if ('category' in newField) {
			try {
				const category = await this.categoryService.getCategoryById(
					String(newField.category),
				);

				newField.category = category;
			} catch (e) {
				throw new HttpException(
					'Category not found',
					HttpStatus.NOT_FOUND,
				);
			}

			const createdField = new this.fieldModel(newField);
			return createdField.save().catch((err) => {
				if (err.code == 11000) {
					throw new HttpException(
						'The field name and category combination or shortcode already exists',
						HttpStatus.BAD_REQUEST,
					);
				}

				logger.error('Error: ', err.message);
				throw new HttpException('Error', HttpStatus.BAD_REQUEST);
			});
		}

		throw new HttpException(
			'Missing input category',
			HttpStatus.BAD_REQUEST,
		);
	}

	async editField(id: string, newField: Field): Promise<Field> {
		if ('category' in newField) {
			try {
				const category = await this.categoryService.getCategoryById(
					String(newField.category),
				);

				newField.category = category;
			} catch (e) {
				throw new HttpException(
					'Category not found',
					HttpStatus.NOT_FOUND,
				);
			}

			return await this.fieldModel
				.findOneAndUpdate({ id: id }, newField, {
					new: true,
				})
				.catch((err) => {
					if (err.code == 11000) {
						throw new HttpException(
							'The field name and category combination or shortcode already exists',
							HttpStatus.BAD_REQUEST,
						);
					}

					logger.error('Error: ', err.message);
					throw new HttpException('Error', HttpStatus.BAD_REQUEST);
				});
		}

		throw new HttpException(
			'Missing input category',
			HttpStatus.BAD_REQUEST,
		);
	}

	async getAllFields(): Promise<Field[]> {
		return this.fieldModel.find().populate('category');
	}

	async getFieldById(id: string): Promise<Field> {
		const field = this.fieldModel.findOne({ id: id });

		if (field == null) {
			throw new HttpException('Field not found', HttpStatus.NOT_FOUND);
		}

		return field;
	}

	async getFieldByIdWithCategory(id: string): Promise<Field> {
		return this.fieldModel.findOne({ id: id }).populate('category');
	}

	async deleteField(id: string): Promise<Field> {
		var field = await this.fieldModel.findOneAndDelete({ id: id });
		if (field == null)
			throw new HttpException('Field not found ', HttpStatus.NOT_FOUND);
		return field;
	}

	// Deletes a category and it's children fields.
	async deleteFieldsAndParentCat(categoryId: string): Promise<Category> {
		let fields = await this.getAllFields();

		for (let field of fields) {
			if (field.category.id == categoryId) {
				await this.deleteField(field.id);
			}
		}

		return await this.categoryService.deleteCategory(categoryId);
	}
}
