import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

import { JwtPayload, verify, sign } from 'jsonwebtoken';
import { hash, compare } from 'bcrypt';

import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

import { Identity, IdentityDocument } from './identity.schema';
import { User, UserDocument } from '../user/user.schema';
import { Role } from '../models/auth.model';
import { OrganisationService } from '../organisation/organisation.service';
import { userInfo } from 'os';
import logger from 'src/logger';

@Injectable()
export class AuthService {
	constructor(
		@InjectModel(Identity.name)
		private identityModel: Model<IdentityDocument>,
		@InjectModel(User.name) private userModel: Model<UserDocument>,

		private organisationService: OrganisationService,
	) {}

	async createUser(
		id: string,
		name: string,
		email: string,
		jobTitle: string,
		role: Role,
		orgId: string[],
	): Promise<string> {
		var organisations = await this.organisationService.getOrganisationsById(
			orgId,
		);

		const user = new this.userModel({
			id: id,
			name: name,
			email,
			jobTitle,
			role,
			organisations,
		});

		await user.save().catch((err) => {
			if (err.code == 11000) {
				throw new HttpException(
					'Email `' + email + '` already exists',
					HttpStatus.BAD_REQUEST,
				);
			}
		});
		return user.id;
	}

	async editUserInfo(
		userId: string,
		name: string,
		email: string,
		jobTitle: string,
		role: Role,
		orgId: string[],
	): Promise<any> {
		var organisations = await this.organisationService.getOrganisationsById(
			orgId,
		);

		const user = await this.userModel.findOneAndUpdate(
			{
				id: userId
			},
			{
				name,
				email,
				jobTitle,
				role,
				organisations,
			}, 
			{
				new: true,
			}
		).catch((err) => {
			if (err.code == 11000) {
				throw new HttpException(
					'Email `' + email + '` already exists',
					HttpStatus.BAD_REQUEST,
				);
			}
		});
		return user;
	}

	async editUser(userId: string, identity: any) {
		
		const oldUser = await this.identityModel.findOne({
			id: userId,
		});

		if (!identity.password && !identity.newPassword) {
			await this.identityModel
				.findOneAndUpdate(
					{ id: userId },
					{ email: identity.email },
					{
						new: true,
					},
				)
				.catch((err) => {
					if (err.code == 11000) {
						throw new HttpException(
							'Email `' + identity.email + '` already exists',
							HttpStatus.BAD_REQUEST,
						);
					}
				});

			return {
				statusCode: 200,
				message: 'Email changed successfully',
			};
		} else {
			let newHashedPassword = null;
			if (identity.password) {
				const password = identity.password;

				if (password.length < 6) {
					throw new HttpException(
						'Password must be at least 6 characters long',
						HttpStatus.BAD_REQUEST,
					);
				}
//Dus als je alleen password meegeeft hoeft het oude ww niet overeen te komen -> is dat een probleem als admin? Maar dan wel als je token weet te onderscheppen
				newHashedPassword = await this.hashPassword(password);
			} else {
				const newPassword = identity.newPassword;
				const oldPassword = identity.oldPassword;

				if (identity.oldPassword != null) {
					
					if (!oldUser || !(await compare(oldPassword, oldUser.hash))) {
						throw new HttpException(
							'Old password is incorrect',
							HttpStatus.UNAUTHORIZED,
						);
					}
				}

				if (newPassword.length < 6) {
					throw new HttpException(
						'Password must be at least 6 characters long',
						HttpStatus.BAD_REQUEST,
					);
				}
				newHashedPassword = await this.hashPassword(newPassword);
			}

			await this.identityModel
				.findOneAndUpdate(
					{ id: userId },
					{
						email: identity.email,
						hash: newHashedPassword,
					},
					{
						new: true,
					},
				)
				.catch((err) => {
					if (err.code == 11000) {
						throw new HttpException(
							'Email `' + identity.email + '` already exists',
							HttpStatus.BAD_REQUEST,
						);
					}
				});

			return {
				statusCode: 200,
				message: 'Email & password changed successfully',
			};
		}
	}

	async verifyToken(token: string): Promise<string | JwtPayload> {
		return new Promise((resolve, reject) => {
			verify(token, process.env.JWT_SECRET, (err, payload) => {
				if (err) reject(err);
				else resolve(payload);
			});
		});
	}

	async registerUser(email: string, password: string) {
		const generatedHash = await this.hashPassword(password);

		const identity = new this.identityModel({
			email,
			hash: generatedHash,
		});

		return await identity.save().catch((err) => {
			if (err.code == 11000) {
				throw new HttpException(
					'Email `' + email + '` already exists',
					HttpStatus.BAD_REQUEST,
				);
			}
		});
	}

	async hashPassword(password: string): Promise<string> {
		return new Promise((resolve, reject) => {
			hash(
				password,
				parseInt(process.env.SALT_ROUNDS, 10),
				(err, hash) => {
					if (err) reject(err);
					else resolve(hash);
				},
			);
		});
	}

	// Deletes user based on MongoDB _id
	async deleteIdentity(id: string) {
		const identity = await this.identityModel.findOne({ _id: id });
		if (identity != null) {
			return await identity.remove();
		}
	}

	async generateToken(email: string, password: string): Promise<string> {
		const identity = await this.identityModel.findOne({ email });

		if (!identity || !(await compare(password, identity.hash)))
			throw new Error('user not authorized');

		const user = await this.userModel.findOne({ email });

		return new Promise((resolve, reject) => {
			sign(
				{ id: user.id },
				process.env.JWT_SECRET,
				{ expiresIn: '1h' },
				(err: Error, token: string) => {
					if (err) reject(err);
					else resolve(token);
				},
			);
		});
	}
}
