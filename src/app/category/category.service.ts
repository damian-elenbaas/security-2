import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Category, CategoryDocument } from './category.schema';
import logger from 'src/logger';

@Injectable()
export class CategoryService {
	constructor(
		@InjectModel(Category.name)
		private categoryModel: Model<CategoryDocument>,
	) {}

	async createCategory(newCategory: Category): Promise<Category> {
		try {
			const createdCategory = new this.categoryModel(newCategory);
			return createdCategory.save().catch((err) => {
				if (err.code == 11000) {
					throw new HttpException(
						'Category name `' +
							newCategory.name +
							'` already exists',
						HttpStatus.BAD_REQUEST,
					);
				}

				logger.error('Error: ', err.message);
				throw new HttpException('Error', HttpStatus.BAD_REQUEST);
			});
		} catch (e) {
			throw new HttpException('Invalid input', HttpStatus.BAD_REQUEST);
		}
	}

	async getCategoryById(id: string): Promise<Category> {
		const category = this.categoryModel.findOne({ id: id });

		if (category == null) {
			throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
		}

		return category;
	}

	async editCategoryById(categoryToEdit: Category): Promise<Category> {
		return await this.categoryModel
			.findOneAndUpdate(
				{ id: categoryToEdit.id },
				categoryToEdit,
				{
					new: true,
				},
			)
			.catch((err) => {
				if (err.code == 11000) {
					throw new HttpException(
						'Categorie naam `' +
						categoryToEdit.name +
						'` is al in gebruik.',
						HttpStatus.BAD_REQUEST,
					);
				}
			logger.error('Error: ', err.message);
			throw new HttpException('Error', HttpStatus.BAD_REQUEST);
		});
	}

	async getAllCategories(): Promise<Category[]> {
		return this.categoryModel.find();
	}

	async deleteCategory(id: string): Promise<Category> {
		return this.categoryModel.findOneAndDelete({ id: id });
	}
}
