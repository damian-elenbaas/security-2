import { Catch, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Contract, ContractDocument } from './contract.schema';
import { UserService } from '../user/user.service';
import { OrganisationService } from '../organisation/organisation.service';
import { FieldService } from '../field/field.service';
import * as mongoose from 'mongoose';
import logger from 'src/logger';

@Injectable()
export class ContractService {
	constructor(
		@InjectModel(Contract.name)
		private contractModel: Model<ContractDocument>,
		private readonly userService: UserService,
		private readonly organisationService: OrganisationService,
		private readonly fieldService: FieldService,
	) {}

	async createContract(
		userId: string,
		contract: Contract,
	): Promise<Contract> {
		try {
			// The user that last edited the contract is based on the token given
			contract.lastEditedBy = await this.userService.getUserInfo(userId);

			//The last edited date is set to the current date
			contract.lastEditedDate = new Date();

			//Get the organisation
			let orgId: any = contract.organisation;
			contract.organisation =
			 	await this.organisationService.getOrganisationById(orgId);

			//Give the optional fields the correct reference
			for await (let responseField of contract.responses) {
				let tempField = await this.fieldService.getFieldById(
					responseField.field.id,
				);

				responseField.field = tempField['_id'];
			}

			const createdContract = new this.contractModel(contract);
			return createdContract.save().catch((err) => {
				if (err.code == 11000) {
					throw new HttpException(
						'Contract name `' +
							contract.title +
							'` already exists in organisation`' +
							contract.organisation.name +
							'`',
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

	async getContractById(id: string): Promise<Contract> {
		const contract = await this.contractModel
			.findOne({ id: id })
			.populate('organisation', 'id');

		if (contract == null) {
			throw new HttpException('Contract not found', HttpStatus.NOT_FOUND);
		}

		contract.organisation =
			await this.organisationService.getOrganisationByIdWithoutImg(
				contract.organisation.id,
			);
		return contract;
	}

	async getContractByIdWithFields(id: string): Promise<Contract> {
		const contract = await this.contractModel
			.findOne({ id: id })
			.populate('organisation', 'id')
			.populate({
				path: 'responses',
				populate: {
					path: 'field',
					populate: {
						path: 'category',
					},
				},
			});

		if (contract == null) {
			throw new HttpException('Contract not found', HttpStatus.NOT_FOUND);
		}

		contract.organisation =
			await this.organisationService.getOrganisationByIdWithoutImg(
				contract.organisation.id,
			);
		return contract;
	}

	async getContractsByOrganisation(id: string): Promise<any> {
		let result = {
			organisation: null,
			contracts: null,
		};

		result.organisation =
			await this.organisationService.getOrganisationByIdWithoutImg(id);

		result.contracts = await this.contractModel.find({
			organisation: result.organisation,
		});
		return result;
	}

	async deleteContract(id: string) {
		var contract = await this.contractModel.findOneAndDelete({ id: id });
		if (contract == null)
			throw new HttpException(
				'Contract not found ',
				HttpStatus.NOT_FOUND,
			);

		return contract;
	}

	async getOrganisationContractCount(id: string): Promise<number> {
		const result = await this.getContractsByOrganisation(id);
		return result.contracts.length;
	}

	async editContract(id: string, contract: Contract): Promise<string> {
		return await this.contractModel.findOneAndUpdate(
			{ id: id },
			contract,
			{
				new: true,
			},
		);
	}
}
