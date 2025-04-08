import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Role } from '../models/auth.model';
import { User, UserDocument } from './user.schema';
import { Organisation } from '../organisation/organisation.schema';
import { Identity } from '../auth/identity.schema';
import logger from 'src/logger';

@Injectable()
export class UserService {
	constructor(
		@InjectModel('User') private userModel: Model<UserDocument>,
		@InjectModel(Identity.name) private identityModel: Model<Identity>,
	) {}

	// ##### User #####

	async getAllUsers(): Promise<User[]> {
		return this.userModel.find().populate('organisations','name');
	}

	async getAllUsersByRole(role: Role): Promise<User[]> {
		return this.userModel.find({ role: role }).exec();
	}

	async getUserInfo(userId: string): Promise<User> {
		return this.userModel
			.findOne({ id: userId })
			.populate('organisations', 'name');
	}

	async getOrganisationsFromUser(userId: string): Promise<Organisation[]> {
		return this.userModel.findOne({ id: userId}).populate('organisations');
	}

	async editUser(id: string, user: User): Promise<User> {
		return this.userModel
			.findOneAndUpdate(
				{ id: id },
				{
					$set: {
						name: user.name,
						email: user.email,
					},
				},
				{ new: true },
			)
			.populate('organisations', 'name')
			.catch((err) => {
				if (err.code == 11000) {
					throw new HttpException(
						'Email is already in use',
						HttpStatus.BAD_REQUEST,
					);
				}

				logger.error('Error: ', err.message);
				throw new HttpException('Error', HttpStatus.BAD_REQUEST);
			});
	}

	async editUserById(id: string, user: User): Promise<User> {
		return this.userModel.findOneAndUpdate({ id: id }, user, {
			new: true,
			runValidators: true,
		});
	}

	async getUserById(userId: string): Promise<User> {
		const user = this.userModel
			.findOne({ id: userId })
			.populate({
				path: 'organisations',
				select: {
					'organisationImage': 0,
				}
			});
			if (user == null) {
				throw new HttpException('Contract not found', HttpStatus.NOT_FOUND);
			}
	
			return user;
	}

	getUsersFromOrganisation(organisation: Organisation) {
		return this.userModel.find({
			organisations: { $in: organisation['_id'] },
		});
	}

	async deleteIdentityByIdAndUserById(
		id: string,
		adminId: string,
	): Promise<User> {
		if (adminId == id)
			throw new HttpException(
				'You cannot delete yourself',
				HttpStatus.BAD_REQUEST,
			);

		let toBeDeletedIdentity = await this.identityModel.findOneAndDelete({
			id: id,
		});

		if (toBeDeletedIdentity == null)
			throw new HttpException(
				'Identity not found ',
				HttpStatus.NOT_FOUND,
			);

		if (adminId == id)
			throw new HttpException(
				'You cannot delete yourself',
				HttpStatus.BAD_REQUEST,
			);

		let toBeDeletedUser = await this.userModel.findOneAndDelete({ id: id });

		if (toBeDeletedUser == null)
			throw new HttpException('User not found ', HttpStatus.NOT_FOUND);

		return toBeDeletedUser;
	}

	// ##### Other #####

	async checkIfAdmin(userId: string): Promise<boolean> {
		const user = await this.userModel.findOne({ id: userId });

		if (user.role === Role.Admin) {
			return true;
		}

		return false;
	}
}
