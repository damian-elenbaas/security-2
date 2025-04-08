import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserService } from '../user/user.service';

import { OrganisationDocument, Organisation } from './organisation.schema';
import * as sharp from 'sharp';
import logger from 'src/logger';

@Injectable()
export class OrganisationService {
	constructor(
		@InjectModel(Organisation.name)
		private organisationModel: Model<OrganisationDocument>,
		private readonly userService: UserService,
	) { }

	async createOrganisation(
		name: string,
		organisationImage: string,
		organisationIdentifier: string,
		address: string,
		city: string,
		zipcode: string,
		country: string,
		representative: string
	): Promise<Organisation> {
		if (!await this.checkIfBase64(organisationImage))
			throw new HttpException('Invalid input', HttpStatus.BAD_REQUEST);
		const organisation = new this.organisationModel({
			name: name,
			organisationImage: organisationImage,
			organisationIdentifier: organisationIdentifier,
			address: address,
			city: city,
			zipcode: zipcode,
			country: country,
			representative: representative
		});

		await organisation.save().catch((err) => {
			if (err.code == 11000) {
				throw new HttpException(
					'Organisation name `' + name + '` already exists',
					HttpStatus.BAD_REQUEST,
				);
			}

			logger.error('Error: ', err.message);
			throw new HttpException('Error', HttpStatus.BAD_REQUEST);
		});
		return organisation;
	}

	async getOrganisations(): Promise<Organisation[]> {
		return await this.organisationModel.find();
	}

	async updateOrganisation(
		id: string,
		organisation: Organisation,
	): Promise<Organisation> {
		if (organisation.organisationImage !== undefined) {
			if (!await this.checkIfBase64(organisation.organisationImage))
				throw new HttpException(
					'Invalid input',
					HttpStatus.BAD_REQUEST,
				);
		}
		if ((await this.getOrganisationById(id)) == null)
			throw new HttpException(
				'Organisation not found ',
				HttpStatus.NOT_FOUND,
			);
		return await this.organisationModel
			.findOneAndUpdate({ id: id }, organisation, { new: true })
			.catch((err) => {
				if (err.code == 11000) {
					throw new HttpException(
						'Organisation name `' +
						organisation.name +
						'` already exists',
						HttpStatus.BAD_REQUEST,
					);
				}

				logger.error('Error: ', err.message);
				throw new HttpException('Error', HttpStatus.BAD_REQUEST);
			});
	}

	async deleteOrganisation(id: string): Promise<Organisation> {
		var org = await this.organisationModel.findOneAndDelete({ id: id });
		if (org == null)
			throw new HttpException(
				'Organisation not found ',
				HttpStatus.NOT_FOUND,
			);

		return org;
	}

	async getOrganisationsById(ids: string[]): Promise<Organisation[]> {
		var orgs = await this.organisationModel.find({ id: { $in: ids } });
		if (orgs == null)
			throw new HttpException(
				'Organisation not found ',
				HttpStatus.NOT_FOUND,
			);
		return orgs;
	}

	async getOrganisationById(id: string): Promise<Organisation> {
		var org = await this.organisationModel.findOne({ id: id });
		if (org == null)
			throw new HttpException(
				'Organisation not found ',
				HttpStatus.NOT_FOUND,
			);
		return org;
	}

	async getOrganisationByIdWithoutImg(id: string): Promise<Organisation> {
		var org = await this.organisationModel
			.findOne({ id: id })
			.select('-organisationImage');
		if (org == null)
			throw new HttpException(
				'Organisation not found ',
				HttpStatus.NOT_FOUND,
			);
		return org;
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
			console.error(err);
			return false;
		  }
	}

	async getOrganisationUserCount(organisationId: string): Promise<number> {
		const org = await this.getOrganisationByIdWithoutImg(organisationId);
		const users = await this.userService.getUsersFromOrganisation(org);
		return users.length;
	}

	async getOrganisationContractCount(
		organisationId: string,
	): Promise<number> {
		const org = await this.getOrganisationByIdWithoutImg(organisationId);
		const contracts = await this.userService.getUsersFromOrganisation(org);
		return contracts.length;
	}
}
