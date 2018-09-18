/*!
 * This file is part of Monitool.
 *
 * Monitool is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Monitool is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Monitool. If not, see <http://www.gnu.org/licenses/>.
 */

import axios from 'axios';
import exprEval from 'expr-eval';
import factorial from 'factorial';
import uuid from 'uuid/v4';


export default class Project {

	static async fetchCrossCutting(indicatorId) {
		const response = await axios.get(
			'/api/resources/project',
			{params: {mode: 'crossCutting', indicatorId: indicatorId}}
		);

		return response.data.map(i => new Project(i));
	}

	static async fetchShort() {
		const response = await axios.get('/api/resources/project?mode=short');
		return response.data;
	}

	static async get(id) {
		const response = await axios.get('/api/resources/project/' + id);
		return new Project(response.data);
	}

	/**
	 * Does it makes sense to display links for input and reporting?
	 */
	get isReadyForReporting() {
		return this.dataSources.some(ds => ds.variables.length && ds.siteIds.length);
	}

	constructor(data) {
		var now = new Date().toISOString().substring(0, 10);
		var oneYear = new Date();
		oneYear.setFullYear(oneYear.getFullYear() + 1);
		oneYear = oneYear.toISOString().substring(0, 10);

		this._id = uuid()
		this.type = "project";
		this.name = "";
		this.active = true;
		this.start = now;
		this.end = oneYear;
		this.themes = [];
		this.crossCutting = {};
		this.extraIndicators = [];
		this.logicalFrames = [];
		this.sites = [];
		this.groups = [];
		this.dataSources = [];
		this.users = [];
		this.visibility = 'public';

		if (data)
			Object.assign(this, data);
	}


	canInputForm(projectUser, dataSourceId) {
		if (!projectUser)
			return false;

		if (projectUser.role === 'owner')
			return true;

		if (projectUser.role === 'input') {
			// Check if user is explicitly forbidden
			if (!projectUser.dataSourceIds.includes(dataSourceId))
				return false;

			// Check if sites where user is allowed intersect with the data source.
			var dataSource = this.dataSources.find(ds => ds.id === dataSourceId);

			return !!projectUser.siteIds.filter(e => dataSource.siteIds.includes(e)).length;
		}

		return false;
	}


	/**
	 * Scan all internal references to sites, variables, partitions, and partitions elements
	 * inside the project to ensure that there are no broken links and repair them if needed.
	 */
	sanitize(indicators) {
		if (!['private', 'public'].includes(this.visibility))
			this.visibility = 'private';

		//////////////////
		// Sanitize links to input sites
		//////////////////

		var siteIds = this.sites.map(e => e.id);

		// Filter groups members
		this.groups.forEach(group => {
			group.members = group.members.filter(e => siteIds.includes(e))
		});

		this.users.forEach(this._sanitizeUser, this);
		this.dataSources.forEach(this._sanitizeDataSource, this);

		/////////////
		// Sanitize links to variables from indicators
		/////////////

		this.logicalFrames.forEach(logicalFrame => {
			logicalFrame.indicators.forEach(this._sanitizeIndicator, this);
			logicalFrame.purposes.forEach(purpose => {
				purpose.indicators.forEach(this._sanitizeIndicator, this);
				purpose.outputs.forEach(output => {
					output.indicators.forEach(this._sanitizeIndicator, this);
					output.activities.forEach(activity => {
						activity.indicators.forEach(this._sanitizeIndicator, this);
					});
				});
			});
		});

		// Sanitize indicators only if the list is provided.
		if (indicators) {
			for (var indicatorId in this.crossCutting) {
				var indicator = indicators.find(i => i._id == indicatorId);
				if (!indicator) {
					delete this.crossCutting[indicatorId];
					continue;
				}

				var commonThemes = indicator.themes.filter(t => this.themes.includes(t));
				if (commonThemes.length === 0)
					delete this.crossCutting[indicatorId];
			}
		}

		for (var indicatorId in this.crossCutting)
			this._sanitizeIndicator(this.crossCutting[indicatorId]);

		this.extraIndicators.forEach(this._sanitizeIndicator, this);
	}

	/**
	 * Scan all references to variables, partitions and partitions elements
	 * inside a given indicator to ensure that there are no broken links
	 * and repair them if needed.
	 */
	_sanitizeIndicator(indicator) {
		if (indicator.computation === null)
			return;

		// try to retrive the symbols from the formula.
		var symbols = null;
		try {
			const parser = new exprEval.Parser();
			parser.consts = {};
   			symbols = parser.parse(indicator.computation.formula).variables();
		}
		catch (e) {
			// if we fail to retrieve symbols => computation is invalid.
			indicator.computation = null;
			return;
		}

		for (var key in indicator.computation.parameters) {
			// This key is useless.
			if (!symbols.includes(key)) {
				delete indicator.computation.parameters[key];
				continue;
			}

			var parameter = indicator.computation.parameters[key];
			var variable = this.dataSources
				.reduce((memo, ds) => [...memo, ds.variables], [])
				.find(v => v.id === parameter.variableId);

			// Element was not found.
			if (!variable) {
				indicator.computation = null;
				return;
			}

			for (var partitionId in parameter.filter) {
				var partition = variable.partitions.find(p => p.id === partitionId);
				if (!partition) {
					indicator.computation = null;
					return;
				}

				var variableIds = parameter.filter[partitionId];
				for (var i = 0; i < variableIds.length; ++i) {
					if (!partition.elements.find(e => e.id === variableIds[i])) {
						indicator.computation = null;
						return;
					}
				}
			}
		}
	}

	/**
	 * Scan references to sites and remove broken links
	 * If no valid links remain, change the user to read only mode
	 */
	_sanitizeUser(user) {
		if (user.role === 'input') {
			user.siteIds = user.siteIds.filter(id => this.sites.find(site => site.id === id));
			user.dataSourceIds = user.dataSourceIds.filter(dsId => this.dataSources.find(ds => ds.id === dsId));

			if (user.siteIds.length == 0 || user.dataSourceIds.length == 0) {
				delete user.siteIds;
				delete user.dataSourceIds;
				user.role = 'read';
			}
		}
		else {
			delete user.siteIds;
			delete user.dataSourceIds;
		}
	}

	_sanitizeDataSource(dataSource) {
		var siteIds = this.sites.map(site => site.id);

		// Remove deleted sites
		dataSource.siteIds = dataSource.siteIds.filter(siteId => siteIds.includes(siteId));

		// Sanitize order and distribution
		dataSource.variables.forEach(variable => {
			if (variable.distribution < 0 || variable.distribution > variable.partitions.length)
				variable.distribution = Math.floor(variable.partitions.length / 2);
		});

		if (dataSource.periodicity === 'free')
			dataSource.start = dataSource.end = null;
	}

	async save() {
		const response = await axios.put(
			'/api/resources/project/' + this._id,
			JSON.parse(angular.toJson(this))
		);

		Object.assign(this, response.data);
	}

	async delete() {
		return axios.delete('/api/resources/project/' + this._id);
	}

}
