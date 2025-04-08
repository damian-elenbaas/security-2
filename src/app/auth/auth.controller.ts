import {
	Body,
	Controller,
	HttpException,
	HttpStatus,
	Param,
	Post,
	Put,
	UseGuards,
} from '@nestjs/common';
import { RolesGuard } from 'src/roles/roles.guard';

import {
	UserRegistration,
	UserCredentials,
	TokenString,
	ResourceId,
	IdentityModel,
} from '../models/auth.model';
import { User } from '../user/user.schema';

import { AuthService } from './auth.service';
import { InjectToken, Token } from './token.decorator';
import logger from 'src/logger';

@Controller()
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('register')
	@UseGuards(RolesGuard)
	async register(@Body() newUser: UserRegistration): Promise<ResourceId> {
		let identityUser = null;

		try {
			identityUser = await this.authService.registerUser(
				newUser.email,
				newUser.password,
			);

			return {
				id: await this.authService.createUser(
					identityUser.id,
					newUser.name,
					newUser.email,
					newUser.jobTitle,
					newUser.role,
					newUser.organisations,
				),
			};
		} catch (e) {
			logger.error(e);

			if (identityUser != null) {
				await this.authService.deleteIdentity(identityUser.id);
			}

			if (e.message == 'Email is already in use') {
				throw new HttpException(
					'Email is already in use',
					HttpStatus.BAD_REQUEST,
				);
			}

			throw new HttpException('Invalid input', HttpStatus.BAD_REQUEST);
		}
	}

	@Put('editIdentity')
	async editUser(
		@InjectToken() token: Token,
		@Body() identity: IdentityModel,
	) {
		return this.authService.editUser(token.id, identity);
	}

	@Put(':id')
	@UseGuards(RolesGuard)
	async editUserById(@Param('id') userId: string, @Body() userInfo: UserRegistration): Promise<User> {
		let identityUser = null;
		try {
			identityUser = await this.authService.editUser(userId, userInfo);

			return await this.authService.editUserInfo(
					userId,
					userInfo.name,
					userInfo.email,
					userInfo.jobTitle,
					userInfo.role,
					userInfo.organisations
				);
		} catch (e) {
			logger.error(e);

			if (identityUser != null) {
				await this.authService.deleteIdentity(identityUser.id);
			}

			if (e.message == 'Email is already in use') {
				throw new HttpException(
					'Email is already in use',
					HttpStatus.BAD_REQUEST,
				);
			}

			throw new HttpException('Invalid input', HttpStatus.BAD_REQUEST);
		}
	}

	@Post('login')
	async login(@Body() credentials: UserCredentials): Promise<TokenString> {
		try {
			return {
				token: await this.authService.generateToken(
					credentials.email,
					credentials.password,
				),
			};
		} catch (e) {
			logger.error(e);
			throw new HttpException(
				'Invalid credentials',
				HttpStatus.UNAUTHORIZED,
			);
		}
	}
}
